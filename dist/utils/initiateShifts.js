"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopShiftCrons = exports.initializeShiftCrons = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const typeorm_1 = require("typeorm");
const database_1 = __importDefault(require("../config/database"));
const user_1 = require("../models/user");
const shift_1 = require("../models/shift");
// Cron schedules for testing / production
const SHIFT_TIMES = {
    [shift_1.ShiftType.MORNING]: "0 0 9 * * *", // 09:00:00 AM daily
    [shift_1.ShiftType.AFTERNOON]: "0 0 15 * * *", // 03:00:00 PM daily
    [shift_1.ShiftType.NIGHT]: "0 15 19 * * *", // 07:15:00 PM daily
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
function isShiftPeriodOver(shiftType, now) {
    const currentHour = now.getHours();
    switch (shiftType) {
        case shift_1.ShiftType.MORNING:
            // Morning shift is active from 6AM up to (but not including) 14 (2 PM)
            return currentHour >= 14;
        case shift_1.ShiftType.AFTERNOON:
            // Afternoon shift is active from 14 (2 PM) up to 22 (10 PM)
            return currentHour >= 22 || currentHour < 14;
        case shift_1.ShiftType.NIGHT:
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
function closeActiveShifts() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const shiftRepo = database_1.default.getRepository(shift_1.Shift);
        const userRepo = database_1.default.getRepository(user_1.User);
        // Find shifts that are currently active or on break.
        const activeShifts = yield shiftRepo.find({
            where: {
                status: (0, typeorm_1.In)([shift_1.ShiftStatus.ACTIVE, shift_1.ShiftStatus.ON_BREAK]),
            },
            relations: ["user"],
        });
        const now = new Date();
        for (const shift of activeShifts) {
            if (!isShiftPeriodOver(shift.shiftType, now)) {
                console.log(`Shift for user ${(_a = shift.user) === null || _a === void 0 ? void 0 : _a.id} (${shift.shiftType}) is still within its period. Skipping closure.`);
                continue;
            }
            try {
                // First, close any open breaks.
                shift.breaks = closeOpenBreaks(shift.breaks || [], now);
                shift.clockOutTime = now;
                shift.status = shift_1.ShiftStatus.PENDING_APPROVAL;
                shift.shiftEndType = shift_1.ShiftEndType.PENDING_ADMIN_APPROVAL;
                if (shift.clockInTime) {
                    const duration = now.getTime() - shift.clockInTime.getTime();
                    shift.totalWorkDuration = Math.floor(duration / 60000);
                }
                else {
                    shift.totalWorkDuration = 0;
                    console.warn(`Warning: Shift for user ${(_b = shift.user) === null || _b === void 0 ? void 0 : _b.id} has no clock-in time.`);
                }
                yield shiftRepo.save(shift);
                if ((_c = shift.user) === null || _c === void 0 ? void 0 : _c.clockedIn) {
                    yield userRepo.update(shift.user.id, { clockedIn: false });
                }
            }
            catch (error) {
                console.error(`Error closing shift for user ${(_d = shift.user) === null || _d === void 0 ? void 0 : _d.id}:`, error);
            }
        }
    });
}
/**
 * Given a shift type (e.g. MORNING), creates new shifts for eligible users
 * if they don't already have an active or pending shift of that type today.
 */
function createNewShifts(shiftType) {
    return __awaiter(this, void 0, void 0, function* () {
        const userRepo = database_1.default.getRepository(user_1.User);
        const shiftRepo = database_1.default.getRepository(shift_1.Shift);
        const users = yield userRepo.find({
            where: {
                userType: (0, typeorm_1.In)([user_1.UserType.PAYER, user_1.UserType.RATER, user_1.UserType.CC]),
                isEmailVerified: true,
            },
        });
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        for (const user of users) {
            try {
                const existingShift = yield shiftRepo.findOne({
                    where: {
                        user: { id: user.id },
                        shiftType,
                        createdAt: (0, typeorm_1.Between)(startOfDay, endOfDay),
                        status: (0, typeorm_1.In)([shift_1.ShiftStatus.ACTIVE, shift_1.ShiftStatus.ON_BREAK]),
                    },
                });
                if (existingShift) {
                    console.log(`Skipping user ${user.id}: A ${shiftType} shift already exists and is still in progress.`);
                    continue;
                }
                const shift = shiftRepo.create({
                    user,
                    shiftType,
                    status: shift_1.ShiftStatus.ACTIVE,
                    breaks: [],
                });
                yield shiftRepo.save(shift);
                console.log(`Created new ${shiftType} shift for user ${user.id}`);
            }
            catch (error) {
                console.error(`Error creating shift for user ${user.id}:`, error);
            }
        }
    });
}
/**
 * Handles the overall shift change process:
 * - Closes shifts whose periods are over.
 * - Creates new shifts of the given type.
 */
function handleShiftChange(newShiftType) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`Starting shift change to ${newShiftType}`);
            yield closeActiveShifts();
            yield createNewShifts(newShiftType);
            console.log(`Completed shift change to ${newShiftType}`);
        }
        catch (error) {
            console.error(`Error during ${newShiftType} shift change:`, error);
        }
    });
}
/**
 * Schedule shift change cron jobs based on the SHIFT_TIMES settings.
 */
const shiftCrons = Object.entries(SHIFT_TIMES).map(([shiftType, cronTime]) => {
    console.log(`Scheduling ${shiftType} shift cron at ${cronTime}`);
    return node_cron_1.default.schedule(cronTime, () => handleShiftChange(shiftType), {
        timezone: "Asia/Karachi",
    });
});
const initializeShiftCrons = () => {
    console.log("Starting Shift Crons");
    shiftCrons.forEach((cronJob) => cronJob.start());
};
exports.initializeShiftCrons = initializeShiftCrons;
const stopShiftCrons = () => {
    console.log("Stopping Shift Crons");
    shiftCrons.forEach((cronJob) => cronJob.stop());
};
exports.stopShiftCrons = stopShiftCrons;
function closeOpenBreaks(breaks, now) {
    return breaks.map((br) => (Object.assign(Object.assign({}, br), { endTime: br.endTime || now, duration: br.duration ||
            Math.floor((now.getTime() - br.startTime.getTime()) / 60000) })));
}
