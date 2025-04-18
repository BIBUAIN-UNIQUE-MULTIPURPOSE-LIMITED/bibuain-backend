import cron from "node-cron";
import { In, Between } from "typeorm";
import dbConnect from "../config/database";
import { User, UserType } from "../models/user";
import { Shift, ShiftType, ShiftStatus, ShiftEndType } from "../models/shift";

// Cron schedules for testing / production
const SHIFT_TIMES = {
  [ShiftType.MORNING]: "0 0 9 * * *", // 09:00:00 AM daily
  [ShiftType.AFTERNOON]: "0 0 15 * * *", // 03:00:00 PM daily
  [ShiftType.NIGHT]: "0 15 19 * * *", // 07:15:00 PM daily
};
/**
 * Helper: Determines if a given shift's period is over.
 *
 * We assume the following shift periods:
 * - MORNING: 06:00 (6 AM) to 14:00 (2 PM)
 * - AFTERNOON: 14:00 (2 PM) to 22:00 (10 PM)
 * - NIGHT: 22:00 (10 PM) to 06:00 (6 AM next day)
 *
 * Adjust these boundaries as needed.
 */
function isShiftPeriodOver(shiftType: ShiftType, now: Date): boolean {
  const currentHour = now.getHours();

  switch (shiftType) {
    case ShiftType.MORNING:
      // Morning shift is active from 6AM up to (but not including) 14 (2 PM)
      return currentHour >= 14;
    case ShiftType.AFTERNOON:
      // Afternoon shift is active from 14 (2 PM) up to 22 (10 PM)
      return currentHour >= 22 || currentHour < 14;
    case ShiftType.NIGHT:
      // Night shift is active from 22 (10 PM) up to 6AM (next day)
      // Note: if current time is between 22 and 23 or between 0 and 5, it's still night.
      return currentHour >= 6 && currentHour < 22;
    default:
      return true;
  }
}

/**
 * Updates open shifts, but only closes those whose period is over.
 */
async function closeActiveShifts() {
  const shiftRepo = dbConnect.getRepository(Shift);
  const userRepo = dbConnect.getRepository(User);

  // Find shifts that are currently active or on break.
  const activeShifts = await shiftRepo.find({
    where: {
      status: In([ShiftStatus.ACTIVE, ShiftStatus.ON_BREAK]),
    },
    relations: ["user"],
  });

  const now = new Date();

  for (const shift of activeShifts) {
    if (!isShiftPeriodOver(shift.shiftType, now)) {
      console.log(
        `Shift for user ${shift.user?.id} (${shift.shiftType}) is still within its period. Skipping closure.`
      );
      continue;
    }

    try {
      // First, close any open breaks.
      shift.breaks = closeOpenBreaks(shift.breaks || [], now);
      shift.clockOutTime = now;
      shift.status = ShiftStatus.PENDING_APPROVAL;
      shift.shiftEndType = ShiftEndType.PENDING_ADMIN_APPROVAL;

      if (shift.clockInTime) {
        const duration = now.getTime() - shift.clockInTime.getTime();
        shift.totalWorkDuration = Math.floor(duration / 60000);
      } else {
        shift.totalWorkDuration = 0;
        console.warn(
          `Warning: Shift for user ${shift.user?.id} has no clock-in time.`
        );
      }

      await shiftRepo.save(shift);

      if (shift.user?.clockedIn) {
        await userRepo.update(shift.user.id, { clockedIn: false });
      }
    } catch (error) {
      console.error(`Error closing shift for user ${shift.user?.id}:`, error);
    }
  }
}

/**
 * Given a shift type (e.g. MORNING), creates new shifts for eligible users
 * if they don't already have an active or pending shift of that type today.
 */
async function createNewShifts(shiftType: ShiftType) {
  const userRepo = dbConnect.getRepository(User);
  const shiftRepo = dbConnect.getRepository(Shift);

  const users = await userRepo.find({
    where: {
      userType: In([UserType.PAYER, UserType.RATER, UserType.CC]),
      isEmailVerified: true,
    },
  });

  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0
  );
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59
  );

  for (const user of users) {
    try {
      const existingShift = await shiftRepo.findOne({
        where: {
          user: { id: user.id },
          shiftType,
          createdAt: Between(startOfDay, endOfDay),
          status: In([ShiftStatus.ACTIVE, ShiftStatus.ON_BREAK]),
        },
      });

      if (existingShift) {
        console.log(
          `Skipping user ${user.id}: A ${shiftType} shift already exists and is still in progress.`
        );
        continue;
      }

      const shift = shiftRepo.create({
        user,
        shiftType,
        status: ShiftStatus.ACTIVE,
        breaks: [],
      });

      await shiftRepo.save(shift);
      console.log(`Created new ${shiftType} shift for user ${user.id}`);
    } catch (error) {
      console.error(`Error creating shift for user ${user.id}:`, error);
    }
  }
}

/**
 * Handles the overall shift change process:
 * - Closes shifts whose periods are over.
 * - Creates new shifts of the given type.
 */
async function handleShiftChange(newShiftType: ShiftType) {
  try {
    console.log(`Starting shift change to ${newShiftType}`);
    await closeActiveShifts();
    await createNewShifts(newShiftType);
    console.log(`Completed shift change to ${newShiftType}`);
  } catch (error) {
    console.error(`Error during ${newShiftType} shift change:`, error);
  }
}

/**
 * Schedule shift change cron jobs based on the SHIFT_TIMES settings.
 */
const shiftCrons = Object.entries(SHIFT_TIMES).map(([shiftType, cronTime]) => {
  console.log(`Scheduling ${shiftType} shift cron at ${cronTime}`);
  return cron.schedule(
    cronTime,
    () => handleShiftChange(shiftType as ShiftType),
    {
      timezone: "Asia/Karachi",
    }
  );
});

export const initializeShiftCrons = () => {
  console.log("Starting Shift Crons");
  shiftCrons.forEach((cronJob) => cronJob.start());
};

export const stopShiftCrons = () => {
  console.log("Stopping Shift Crons");
  shiftCrons.forEach((cronJob) => cronJob.stop());
};

function closeOpenBreaks(breaks: Shift["breaks"], now: Date) {
  return breaks.map((br) => ({
    ...br,
    endTime: br.endTime || now,
    duration:
      br.duration ||
      Math.floor((now.getTime() - br.startTime.getTime()) / 60000),
  }));
}
