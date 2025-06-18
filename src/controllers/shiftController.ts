import type { NextFunction, RequestHandler, Response } from "express";
import { Between, In } from "typeorm";
import dbConnect from "../config/database";
import type { UserRequest } from "../middlewares/authenticate";
import { Bank, BankTag } from "../models/bank";
import { Shift, ShiftEndType, ShiftStatus, ShiftType } from "../models/shift";
import { User, UserType } from "../models/user";
import { io } from "../server";
import ErrorHandler from "../utils/errorHandler";

const SHIFT_TIMES = {
  [ShiftType.MORNING]: { start: "08:00", end: "15:00" },
  [ShiftType.AFTERNOON]: { start: "15:00", end: "21:00" },
  [ShiftType.NIGHT]: { start: "21:00", end: "08:00" },
};

/*
 * Utility function to determine shift type based on current time
 * Returns ShiftType.MORNING, ShiftType.AFTERNOON, or ShiftType.NIGHT
 */
const getShiftTypeFromTime = (date: Date): ShiftType => {
  const currentTime = date.getHours() * 100 + date.getMinutes();
  if (currentTime >= 800 && currentTime < 1500) {
    return ShiftType.MORNING;
  } else if (currentTime >= 1500 && currentTime < 2100) {
    return ShiftType.AFTERNOON;
  } else if (
    (currentTime >= 2100 && currentTime <= 2359) ||
    (currentTime >= 0 && currentTime < 800)
  ) {
    return ShiftType.NIGHT;
  }
  throw new ErrorHandler("Invalid time for shift type", 400);
};

/*
 * Clock in handler
 * Creates or updates a shift record for the user
 * Determines shift type dynamically based on current time
 */
export const clockIn: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
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
    const [startHour, startMinute] = SHIFT_TIMES[shiftType].start
      .split(":")
      .map(Number);
    const scheduledStart = new Date(now);
    scheduledStart.setHours(startHour, startMinute, 0, 0);

    // Calculate if the user is late and by how many minutes
    if (now > scheduledStart) {
      currentShift.isLateClockIn = true;
      currentShift.lateMinutes = Math.floor(
        (now.getTime() - scheduledStart.getTime()) / 60000,
      );
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

/*
 * Update bank status during a shift
 * Adjusts the bank's funds and tag based on usage
 */
export const updateBankStatusDuringShift = async (
  bankId: string,
  amountUsed: number,
) => {
  const bankRepo = dbConnect.getRepository(Bank);
  const bank = await bankRepo.findOne({ where: { id: bankId } });

  if (!bank) return;

  const remaining = bank.funds - amountUsed;
  bank.funds = Math.max(0, remaining);

  // Update status based on remaining funds
  bank.tag = bank.funds > 0 ? BankTag.USED : BankTag.ROLLOVER;

  await bankRepo.save(bank);
};

/*
 * Clock out handler
 * Ends the user's shift and updates the bank status if applicable
 */
export const clockOut: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    next(new ErrorHandler("Unauthorized", 401));
    return;
  }

  const userRepo = dbConnect.getRepository(User);
  const shiftRepo = dbConnect.getRepository(Shift);
  const bankRepo = dbConnect.getRepository(Bank);

  try {
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      next(new ErrorHandler("User not found", 404));
      return;
    }

    const activeShift = await shiftRepo.findOne({
      where: { user: { id: userId }, status: ShiftStatus.ACTIVE },
      relations: ["bank"],
    });

    if (!activeShift) {
      next(new ErrorHandler("No active shift found", 404));
      return;
    }

    const now = new Date();

    try {
      // Update bank status if there's an associated bank
      if (activeShift.bank) {
        const bank = await bankRepo.findOne({
          where: { id: activeShift.bank.id },
        });
        if (bank) {
          // Change status based on remaining funds
          bank.tag = bank.funds > 0 ? BankTag.FUNDED : BankTag.ROLLOVER;
          bank.shift = undefined;
          await bankRepo.save(bank);
        }
      }

      activeShift.clockOutTime = now;
      activeShift.isClockedIn = false;
      activeShift.totalWorkDuration += calculateWorkDuration(
        activeShift.clockInTime,
        now,
        activeShift.breaks,
      );
      activeShift.overtimeMinutes = calculateOvertime(
        activeShift.shiftType,
        activeShift.totalWorkDuration,
      );
      activeShift.status = ShiftStatus.ENDED;

      await userRepo.update(userId, { clockedIn: false });
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
      await userRepo.update(userId, { clockedIn: false });

      activeShift.status = ShiftStatus.FORCE_CLOSED;
      activeShift.clockOutTime = now;
      activeShift.isClockedIn = false;
      await shiftRepo.save(activeShift);

      next(new ErrorHandler("Unexpected error. Shift forcefully ended.", 500));
    }
  } catch (error) {
    console.error("Unexpected error during clock-out:", error);
    try {
      await userRepo.update(userId, { clockedIn: false });

      const activeShift = await shiftRepo.findOne({
        where: { user: { id: userId }, status: ShiftStatus.ACTIVE },
        relations: ["bank"],
      });
      if (activeShift) {
        // Update bank status if shift is force closed
        if (activeShift.bank) {
          const bank = await bankRepo.findOne({
            where: { id: activeShift.bank.id },
          });
          if (bank) {
            bank.tag = bank.funds > 0 ? BankTag.FUNDED : BankTag.ROLLOVER;
            bank.shift = undefined;
            await bankRepo.save(bank);
          }
        }
        activeShift.status = ShiftStatus.FORCE_CLOSED;
        activeShift.clockOutTime = new Date();
        activeShift.isClockedIn = false;
        await shiftRepo.save(activeShift);
      }
    } catch (cleanupError) {
      console.error("Error during shift force closure:", cleanupError);
    }
    next(
      new ErrorHandler(
        "Critical error occurred. Shift forcefully closed.",
        500,
      ),
    );
  }
};

/*
 * Start a break during an active shift
 * Updates the shift status to ON_BREAK and records the break start time
 */
export const startBreak: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
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

/*
 * End the current break during an active shift
 * Updates the last break's end time and duration, then resumes the shift
 */
export const endBreak: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
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
        (now.getTime() - new Date(currentBreak.startTime).getTime()) / 60000,
      );
    }

    activeShift.status = ShiftStatus.ACTIVE;
    await shiftRepo.save(activeShift);

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

/*
 * Get shift metrics for a user
 * Returns total shifts, work duration, break duration, overtime, late minutes, and shift types
 * Optionally filters by date range
 */
export const getShiftMetrics: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
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
        createdAt: Between(
          new Date(startDate as string),
          new Date(endDate as string),
        ),
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
          0,
        ) || 0;
      return acc + breakDurations;
    }, 0);

    const metrics = {
      totalShifts: shifts.length,
      totalWorkDuration: shifts.reduce(
        (acc, shift) => acc + (shift.totalWorkDuration || 0),
        0,
      ),
      totalBreakDuration,
      totalOvertimeMinutes: shifts.reduce(
        (acc, shift) => acc + (shift.overtimeMinutes || 0),
        0,
      ),
      totalLateMinutes: shifts.reduce(
        (acc, shift) => acc + (shift.lateMinutes || 0),
        0,
      ),
      lateClockIns: shifts.filter((shift) => shift.isLateClockIn).length,
      shiftsByType: {
        [ShiftType.MORNING]: shifts.filter(
          (s) => s.shiftType === ShiftType.MORNING,
        ).length,
        [ShiftType.AFTERNOON]: shifts.filter(
          (s) => s.shiftType === ShiftType.AFTERNOON,
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

/*
 * Force end a shift by an admin
 * Updates the shift status, clock out time, and user clockedIn status
 */
export const forceEndShift: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
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

    await userRepo.update(shift.user.id, { clockedIn: false });

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
      shift.breaks,
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

/*
 * Get the current shift for a user
 * Returns the active shift or null if not clocked in
 */
export const getCurrentShift = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) throw new ErrorHandler("Unauthorized", 401);

    const now = new Date();
    const currentSession = getShiftTypeFromTime(now);

    const userRepo = dbConnect.getRepository(User);
    const shiftRepo = dbConnect.getRepository(Shift);

    const user = await userRepo.findOne({ where: { id: userId } });
    const isUserClockedIn = user?.clockedIn || false;

    const currentShift = await shiftRepo.findOne({
      where: {
        user: { id: userId },
        status: In([ShiftStatus.ACTIVE, ShiftStatus.ON_BREAK]),
      },
      relations: ["user", "bank"],
    });

    if (isUserClockedIn && !currentShift) {
      await userRepo.update(userId, { clockedIn: false });
      return res.json({
        success: true,
        message: "No active shift—status corrected",
        data: {
          shift: null,
          currentSession,
          isActive: false,
          clockedIn: false,
          workDuration: 0,
          breaks: [],
        },
      });
    }

    if (!currentShift) {
      return res.json({
        success: true,
        message: "No active shift found",
        data: {
          shift: null,
          currentSession,
          isActive: false,
          clockedIn: false,
          workDuration: 0,
          breaks: [],
        },
      });
    }

    return res.json({
      success: true,
      message: "Current shift retrieved successfully",
      data: {
        shift: currentShift,
        currentSession,
        isActive: true,
        clockedIn: currentShift.isClockedIn,
        workDuration: currentShift.totalWorkDuration || 0,
        breaks: currentShift.breaks || [],
      },
    });
  } catch (err) {
    next(err);
  }
};

/*
 * Calculate the total work duration excluding breaks
 * Returns the duration in minutes
 */
const calculateWorkDuration = (
  clockIn: Date,
  clockOut: Date,
  breaks: any,
): number => {
  const totalMs = clockOut.getTime() - clockIn.getTime();
  const breakTimeMs = breaks.reduce(
    (acc: any, b: any) => acc + (b.duration ? b.duration * 60000 : 0),
    0,
  );
  return Math.max(0, (totalMs - breakTimeMs) / 60000);
};

const calculateOvertime = (
  shiftType: Shift["shiftType"],
  totalWorkDuration: number,
): number => {
  const standardDurations = {
    morning: 7 * 60,
    afternoon: 6 * 60,
    night: 11 * 60,
  };

  return Math.max(0, totalWorkDuration - standardDurations[shiftType]);
};
