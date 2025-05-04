import { Request, Response, NextFunction, RequestHandler } from "express";
import dbConnect from "../config/database";
import { UserRequest } from "../middlewares/authenticate";
import { Shift, ShiftType, ShiftStatus, ShiftEndType } from "../models/shift";
import { User, UserType } from "../models/user";
import ErrorHandler from "../utils/errorHandler";
import { io } from "../server";
import { Between } from "typeorm";


const SHIFT_TIMES = {
  [ShiftType.MORNING]: { start: "08:00", end: "15:00" },
  [ShiftType.AFTERNOON]: { start: "15:00", end: "21:00" },
  [ShiftType.NIGHT]: { start: "21:00", end: "08:00" },
};

const getShiftTypeFromTime = (date: Date): ShiftType => {
  const currentTime = date.getHours() * 100 + date.getMinutes();
  if (currentTime >= 800 && currentTime < 1500) {
    return ShiftType.MORNING;
  } else if (currentTime >= 1500 && currentTime < 2100) {
    return ShiftType.AFTERNOON;
  } else {
    return ShiftType.NIGHT;
  }
};

export const clockIn: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ErrorHandler("Unauthorized", 401);

    const userRepo = dbConnect.getRepository(User);
    const shiftRepo = dbConnect.getRepository(Shift);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) throw new ErrorHandler("User not found", 404);

    // Determine shift type dynamically
    const now = new Date();
    const shiftType = getShiftTypeFromTime(now);

    // Check if an active shift already exists for this user and shift type
    let currentShift = await shiftRepo.findOne({
      where: {
        user: { id: userId },
        shiftType,
        status: ShiftStatus.ACTIVE,
      },
    });

    if (!currentShift) {
      // Create a new shift record if none exists
      currentShift = new Shift();
      currentShift.user = user;
      currentShift.shiftType = shiftType;
      currentShift.status = ShiftStatus.ACTIVE;
      currentShift.totalWorkDuration = 0;
      currentShift.breaks = [];
    }

    // Update shift record with clock-in details
    currentShift.isClockedIn = true;
    currentShift.clockInTime = now;

    // Determine scheduled start time for the shift from SHIFT_TIMES
    const [startHour, startMinute] = SHIFT_TIMES[shiftType].start.split(":").map(Number);
    const scheduledStart = new Date(now);
    scheduledStart.setHours(startHour, startMinute, 0, 0);

    // Calculate if the user is late and by how many minutes
    if (now > scheduledStart) {
      currentShift.isLateClockIn = true;
      currentShift.lateMinutes = Math.floor((now.getTime() - scheduledStart.getTime()) / 60000);
    } else {
      currentShift.isLateClockIn = false;
      currentShift.lateMinutes = 0;
    }

    await shiftRepo.save(currentShift);
    await userRepo.update(userId, { clockedIn: true });

    io.emit("shiftUpdate", {
      userId: user.id,
      status: "clocked-in",
      shiftId: currentShift.id,
    });

    res.json({
      success: true,
      message: "Successfully clocked in",
      data: currentShift,
    });
  } catch (error) {
    next(error);
  }
};

export const clockOut: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {  // Explicitly specify return type as Promise<void>
  const userId = req.user?.id;
  if (!userId) {
    next(new ErrorHandler("Unauthorized", 401));
    return;  // Return early without returning a value
  }

  const userRepo = dbConnect.getRepository(User);
  const shiftRepo = dbConnect.getRepository(Shift);

  try {
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      next(new ErrorHandler("User not found", 404));
      return;  // Return early without returning a value
    }

    let activeShift = await shiftRepo.findOne({
      where: { user: { id: userId }, status: ShiftStatus.ACTIVE },
    });

    if (!activeShift) {
      next(new ErrorHandler("No active shift found", 404));
      return;  // Return early without returning a value
    }

    const now = new Date();

    try {
      // Gracefully close the shift
      activeShift.clockOutTime = now;
      activeShift.isClockedIn = false;
      activeShift.totalWorkDuration += calculateWorkDuration(
        activeShift.clockInTime,
        now,
        activeShift.breaks
      );
      activeShift.overtimeMinutes = calculateOvertime(
        activeShift.shiftType,
        activeShift.totalWorkDuration
      );
      activeShift.status = ShiftStatus.ENDED;

      // First update the user's clockedIn status to false
      await userRepo.update(userId, { clockedIn: false });
      
      // Then save the shift
      await shiftRepo.save(activeShift);

      io.emit("shiftUpdate", {
        userId: user.id,
        status: "clocked-out",
        shiftId: activeShift.id,
      });

      res.json({
        success: true,
        message: "Successfully clocked out",
        data: activeShift,
      });
    } catch (shiftError) {
      console.error("Error updating shift:", shiftError);
      // Even if there's an error with the shift, make sure the user is clocked out
      await userRepo.update(userId, { clockedIn: false });
      
      activeShift.status = ShiftStatus.FORCE_CLOSED;
      activeShift.clockOutTime = now;
      activeShift.isClockedIn = false; // Explicitly set isClockedIn to false
      
      await shiftRepo.save(activeShift);

      next(new ErrorHandler("Unexpected error. Shift forcefully ended.", 500));
    }
  } catch (error) {
    console.error("Unexpected error during clock-out:", error);
    try {
      // Make sure the user is marked as clocked out regardless of errors
      await userRepo.update(userId, { clockedIn: false });
      
      let activeShift = await shiftRepo.findOne({
        where: { user: { id: userId }, status: ShiftStatus.ACTIVE },
      });
      if (activeShift) {
        activeShift.status = ShiftStatus.FORCE_CLOSED;
        activeShift.clockOutTime = new Date();
        activeShift.isClockedIn = false; // Explicitly set isClockedIn to false
        await shiftRepo.save(activeShift);
      }
    } catch (cleanupError) {
      console.error("Error during shift force closure:", cleanupError);
    }
    next(new ErrorHandler("Critical error occurred. Shift forcefully closed.", 500));
  }
}

export const startBreak: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ErrorHandler("Unauthorized", 401);

    const shiftRepo = dbConnect.getRepository(Shift);
    const activeShift = await shiftRepo.findOne({
      where: {
        user: { id: userId },
        status: ShiftStatus.ACTIVE,
      },
    });

    if (!activeShift) throw new ErrorHandler("No active shift found", 404);

    const now = new Date();
    const newBreak = {
      startTime: now,
      duration: 0,
    };

    activeShift.breaks = [...(activeShift.breaks || []), newBreak];
    activeShift.status = ShiftStatus.ON_BREAK;
    await shiftRepo.save(activeShift);
    
    // DO NOT update user's clockedIn status - they're still clocked in, just on break
    // await userRepo.update(userId, { clockedIn: false }); <-- REMOVE THIS

    io.emit("breakUpdate", {
      userId,
      status: "break-started",
      shiftId: activeShift.id,
    });

    res.json({
      success: true,
      message: "Break started successfully",
      data: activeShift,
    });
  } catch (error) {
    next(error);
  }
};

export const endBreak: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ErrorHandler("Unauthorized", 401);

    const shiftRepo = dbConnect.getRepository(Shift);
    const activeShift = await shiftRepo.findOne({
      where: {
        user: { id: userId },
        status: ShiftStatus.ON_BREAK,
      },
    });

    if (!activeShift) throw new ErrorHandler("No active break found", 404);

    const now = new Date();
    const currentBreak = activeShift.breaks[activeShift.breaks.length - 1];

    if (currentBreak && !currentBreak.endTime) {
      currentBreak.endTime = now;
      currentBreak.duration = Math.floor(
        (now.getTime() - new Date(currentBreak.startTime).getTime()) / 60000
      );
    }

    activeShift.status = ShiftStatus.ACTIVE;
    await shiftRepo.save(activeShift);
    
    // DO NOT need to update clockedIn status here - user remains clocked in
    // await userRepo.update(userId, { clockedIn: true }); <-- REMOVE THIS IF IT EXISTS

    io.emit("breakUpdate", {
      userId,
      status: "break-ended",
      shiftId: activeShift.id,
    });

    res.json({
      success: true,
      message: "Break ended successfully",
      data: activeShift,
    });
  } catch (error) {
    next(error);
  }
};

export const getShiftMetrics: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.params.userId;
    if (!userId) throw new ErrorHandler("User ID required", 400);

    const { startDate, endDate } = req.query;
    const shiftRepo = dbConnect.getRepository(Shift);
    
    // Build the where condition
    let whereCondition: any = { user: { id: userId } };
    if (startDate && endDate) {
      whereCondition = {
        ...whereCondition,
        createdAt: Between(new Date(startDate as string), new Date(endDate as string))
      };
    }

    const shifts = await shiftRepo.find({
      where: whereCondition,
      order: { createdAt: "DESC" },
    });

    const totalBreakDuration = shifts.reduce((acc, shift) => {
      const breakDurations =
        shift.breaks?.reduce(
          (sum, breakItem) => sum + (breakItem.duration || 0),
          0
        ) || 0;
      return acc + breakDurations;
    }, 0);

    const metrics = {
      totalShifts: shifts.length,
      totalWorkDuration: shifts.reduce(
        (acc, shift) => acc + (shift.totalWorkDuration || 0),
        0
      ),
      totalBreakDuration,
      totalOvertimeMinutes: shifts.reduce(
        (acc, shift) => acc + (shift.overtimeMinutes || 0),
        0
      ),
      totalLateMinutes: shifts.reduce(
        (acc, shift) => acc + (shift.lateMinutes || 0),
        0
      ),
      lateClockIns: shifts.filter((shift) => shift.isLateClockIn).length,
      shiftsByType: {
        [ShiftType.MORNING]: shifts.filter(
          (s) => s.shiftType === ShiftType.MORNING
        ).length,
        [ShiftType.AFTERNOON]: shifts.filter(
          (s) => s.shiftType === ShiftType.AFTERNOON
        ).length,
        [ShiftType.NIGHT]: shifts.filter((s) => s.shiftType === ShiftType.NIGHT)
          .length,
      },
    };

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};

export const forceEndShift: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { shiftId } = req.params;
    const { adminNotes } = req.body;
    const userId = req.user?.id;

    if (!userId || req.user?.userType !== UserType.ADMIN) {
      throw new ErrorHandler("Unauthorized", 401);
    }

    const shiftRepo = dbConnect.getRepository(Shift);
    const userRepo = dbConnect.getRepository(User);
    
    const shift = await shiftRepo.findOne({
      where: { id: shiftId },
      relations: ["user"],
    });

    if (!shift) throw new ErrorHandler("Shift not found", 404);

    const now = new Date();
    
    // Update user's clockedIn status first
    await userRepo.update(shift.user.id, { clockedIn: false });
    
    // Then update the shift
    shift.status = ShiftStatus.FORCE_CLOSED;
    shift.shiftEndType = ShiftEndType.ADMIN_FORCE_CLOSE;
    shift.clockOutTime = now;
    shift.adminNotes = adminNotes;
    shift.approvedByAdminId = userId;
    shift.approvalTime = now;
    shift.isClockedIn = false;
    shift.totalWorkDuration = calculateWorkDuration(
      shift.clockInTime,
      now,
      shift.breaks
    );

    await shiftRepo.save(shift);

    io.emit("shiftUpdate", {
      userId: shift.user.id,
      status: "force-closed",
      shiftId,
    });

    res.json({
      success: true,
      message: "Shift force closed successfully",
      data: shift,
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentShift: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ErrorHandler("Unauthorized", 401);

    const userRepo = dbConnect.getRepository(User);
    const shiftRepo = dbConnect.getRepository(Shift);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) throw new ErrorHandler("User not found", 404);

    const now = new Date();
    const shiftType = getShiftTypeFromTime(now);

    const isUserClockedIn = user.clockedIn || false;

    const currentShift = await shiftRepo.findOne({
      where: {
        user: { id: userId },
        status: ShiftStatus.ACTIVE,
      },
      relations: ["user"],
    });

    if (isUserClockedIn && !currentShift) {
      await userRepo.update(userId, { clockedIn: false });
      
      res.json({
        success: true,
        message: "No active shift found, user status corrected",
        data: {
          shift: null,
          currentSession: shiftType,
          isActive: false,
          clockedIn: false,
          workDuration: 0,
          breaks: [],
        },
      });
      return;
    }

    if (!currentShift) {
      res.json({
        success: true,
        message: "No active shift found for current session",
        data: {
          shift: null,
          currentSession: shiftType,
          isActive: false,
          clockedIn: false,
          workDuration: 0,
          breaks: [],
        },
      });
      return; 
    }
    res.json({
      success: true,
      message: "Current shift retrieved successfully",
      data: {
        shift: currentShift,
        currentSession: shiftType,
        isActive: currentShift.status === ShiftStatus.ACTIVE,
        clockedIn: currentShift.isClockedIn,  
        workDuration: currentShift.totalWorkDuration || 0,
        breaks: currentShift.breaks || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// export const getCurrentShift: RequestHandler = async (
//   req: UserRequest,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const userId = req.user?.id;
//     if (!userId) throw new ErrorHandler("Unauthorized", 401);

//     const userRepo = dbConnect.getRepository(User);
//     const shiftRepo = dbConnect.getRepository(Shift);

//     const user = await userRepo.findOne({ where: { id: userId } });
//     if (!user) throw new ErrorHandler("User not found", 404);

//     // Determine the current shift type dynamically
//     const now = new Date();
//     const shiftType = getShiftTypeFromTime(now);

//     // Find the active shift for the user matching the calculated shift type
//     const currentShift = await shiftRepo.findOne({
//       where: {
//         user: { id: userId },
//         shiftType,
//         status: ShiftStatus.ACTIVE,
//       },
//       relations: ["user"],
//     });

//     if (!currentShift) {
//       throw new ErrorHandler("No active shift found for current session", 404);
//     }

//     res.json({
//       success: true,
//       message: "Current shift retrieved successfully",
//       data: {
//         shift: currentShift,
//         currentSession: shiftType,
//         isActive: currentShift.status === ShiftStatus.ACTIVE,
//         clockedIn: currentShift.isClockedIn,
//         workDuration: currentShift.totalWorkDuration || 0,
//         breaks: currentShift.breaks || [],
//       },
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// Helper functions for calculations

const calculateWorkDuration = (
  clockIn: Date,
  clockOut: Date,
  breaks: any
): number => {
  const totalMs = clockOut.getTime() - clockIn.getTime();
  const breakTimeMs = breaks.reduce(
    (acc: any, b: any) => acc + (b.duration ? b.duration * 60000 : 0),
    0
  );
  return Math.max(0, (totalMs - breakTimeMs) / 60000);
};

const calculateOvertime = (
  shiftType: Shift["shiftType"],
  totalWorkDuration: number
): number => {
  const standardDurations = {
    morning: 7 * 60,
    afternoon: 6 * 60,
    night: 11 * 60,
  };

  return Math.max(0, totalWorkDuration - standardDurations[shiftType]);
};
