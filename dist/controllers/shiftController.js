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
exports.getCurrentShift = exports.forceEndShift = exports.getShiftMetrics = exports.endBreak = exports.startBreak = exports.clockOut = exports.clockIn = void 0;
const database_1 = __importDefault(require("../config/database"));
const shift_1 = require("../models/shift");
const user_1 = require("../models/user");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
const server_1 = require("../server");
const typeorm_1 = require("typeorm");
// Define the scheduled start times for each shift type
const SHIFT_TIMES = {
    [shift_1.ShiftType.MORNING]: { start: "08:00", end: "15:00" },
    [shift_1.ShiftType.AFTERNOON]: { start: "15:00", end: "21:00" },
    [shift_1.ShiftType.NIGHT]: { start: "21:00", end: "08:00" },
};
// Helper function to determine the shift type based on the current time.
const getShiftTypeFromTime = (date) => {
    const currentTime = date.getHours() * 100 + date.getMinutes();
    if (currentTime >= 800 && currentTime < 1500) {
        return shift_1.ShiftType.MORNING;
    }
    else if (currentTime >= 1500 && currentTime < 2100) {
        return shift_1.ShiftType.AFTERNOON;
    }
    else {
        return shift_1.ShiftType.NIGHT;
    }
};
// Clock In Endpoint using time-based auto-detection
const clockIn = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId)
            throw new errorHandler_1.default("Unauthorized", 401);
        const userRepo = database_1.default.getRepository(user_1.User);
        const shiftRepo = database_1.default.getRepository(shift_1.Shift);
        const user = yield userRepo.findOne({ where: { id: userId } });
        if (!user)
            throw new errorHandler_1.default("User not found", 404);
        // Determine shift type dynamically
        const now = new Date();
        const shiftType = getShiftTypeFromTime(now);
        // Check if an active shift already exists for this user and shift type
        let currentShift = yield shiftRepo.findOne({
            where: {
                user: { id: userId },
                shiftType,
                status: shift_1.ShiftStatus.ACTIVE,
            },
        });
        if (!currentShift) {
            // Create a new shift record if none exists
            currentShift = new shift_1.Shift();
            currentShift.user = user;
            currentShift.shiftType = shiftType;
            currentShift.status = shift_1.ShiftStatus.ACTIVE;
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
        }
        else {
            currentShift.isLateClockIn = false;
            currentShift.lateMinutes = 0;
        }
        yield shiftRepo.save(currentShift);
        yield userRepo.update(userId, { clockedIn: true });
        server_1.io.emit("shiftUpdate", {
            userId: user.id,
            status: "clocked-in",
            shiftId: currentShift.id,
        });
        res.json({
            success: true,
            message: "Successfully clocked in",
            data: currentShift,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.clockIn = clockIn;
// Clock Out Endpoint (kept largely the same)
const clockOut = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId)
        return next(new errorHandler_1.default("Unauthorized", 401));
    const userRepo = database_1.default.getRepository(user_1.User);
    const shiftRepo = database_1.default.getRepository(shift_1.Shift);
    try {
        const user = yield userRepo.findOne({ where: { id: userId } });
        if (!user)
            return next(new errorHandler_1.default("User not found", 404));
        let activeShift = yield shiftRepo.findOne({
            where: { user: { id: userId }, status: shift_1.ShiftStatus.ACTIVE },
        });
        if (!activeShift)
            return next(new errorHandler_1.default("No active shift found", 404));
        const now = new Date();
        try {
            // Gracefully close the shift
            activeShift.clockOutTime = now;
            activeShift.isClockedIn = false;
            activeShift.totalWorkDuration += calculateWorkDuration(activeShift.clockInTime, now, activeShift.breaks);
            activeShift.overtimeMinutes = calculateOvertime(activeShift.shiftType, activeShift.totalWorkDuration);
            activeShift.status = shift_1.ShiftStatus.ENDED;
            yield shiftRepo.save(activeShift);
            yield userRepo.update(userId, { clockedIn: false });
            server_1.io.emit("shiftUpdate", {
                userId: user.id,
                status: "clocked-out",
                shiftId: activeShift.id,
            });
            res.json({
                success: true,
                message: "Successfully clocked out",
                data: activeShift,
            });
        }
        catch (shiftError) {
            console.error("Error updating shift:", shiftError);
            activeShift.status = shift_1.ShiftStatus.FORCE_CLOSED;
            activeShift.clockOutTime = now;
            yield shiftRepo.save(activeShift);
            yield userRepo.update(userId, { clockedIn: false });
            return next(new errorHandler_1.default("Unexpected error. Shift forcefully ended.", 500));
        }
    }
    catch (error) {
        console.error("Unexpected error during clock-out:", error);
        try {
            let activeShift = yield shiftRepo.findOne({
                where: { user: { id: userId }, status: shift_1.ShiftStatus.ACTIVE },
            });
            if (activeShift) {
                activeShift.status = shift_1.ShiftStatus.FORCE_CLOSED;
                activeShift.clockOutTime = new Date();
                yield shiftRepo.save(activeShift);
            }
            yield userRepo.update(userId, { clockedIn: false });
        }
        catch (cleanupError) {
            console.error("Error during shift force closure:", cleanupError);
        }
        return next(new errorHandler_1.default("Critical error occurred. Shift forcefully closed.", 500));
    }
});
exports.clockOut = clockOut;
// Start Break Endpoint (unchanged)
const startBreak = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId)
            throw new errorHandler_1.default("Unauthorized", 401);
        const shiftRepo = database_1.default.getRepository(shift_1.Shift);
        const activeShift = yield shiftRepo.findOne({
            where: {
                user: { id: userId },
                status: shift_1.ShiftStatus.ACTIVE,
            },
        });
        if (!activeShift)
            throw new errorHandler_1.default("No active shift found", 404);
        const now = new Date();
        const newBreak = {
            startTime: now,
            duration: 0,
        };
        activeShift.breaks = [...(activeShift.breaks || []), newBreak];
        activeShift.status = shift_1.ShiftStatus.ON_BREAK;
        yield shiftRepo.save(activeShift);
        // DO NOT update user's clockedIn status - they're still clocked in, just on break
        // await userRepo.update(userId, { clockedIn: false }); <-- REMOVE THIS
        server_1.io.emit("breakUpdate", {
            userId,
            status: "break-started",
            shiftId: activeShift.id,
        });
        res.json({
            success: true,
            message: "Break started successfully",
            data: activeShift,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.startBreak = startBreak;
// End Break Endpoint (unchanged)
const endBreak = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId)
            throw new errorHandler_1.default("Unauthorized", 401);
        const shiftRepo = database_1.default.getRepository(shift_1.Shift);
        const activeShift = yield shiftRepo.findOne({
            where: {
                user: { id: userId },
                status: shift_1.ShiftStatus.ON_BREAK,
            },
        });
        if (!activeShift)
            throw new errorHandler_1.default("No active break found", 404);
        const now = new Date();
        const currentBreak = activeShift.breaks[activeShift.breaks.length - 1];
        if (currentBreak && !currentBreak.endTime) {
            currentBreak.endTime = now;
            currentBreak.duration = Math.floor((now.getTime() - new Date(currentBreak.startTime).getTime()) / 60000);
        }
        activeShift.status = shift_1.ShiftStatus.ACTIVE;
        yield shiftRepo.save(activeShift);
        // DO NOT need to update clockedIn status here - user remains clocked in
        // await userRepo.update(userId, { clockedIn: true }); <-- REMOVE THIS IF IT EXISTS
        server_1.io.emit("breakUpdate", {
            userId,
            status: "break-ended",
            shiftId: activeShift.id,
        });
        res.json({
            success: true,
            message: "Break ended successfully",
            data: activeShift,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.endBreak = endBreak;
// Get Shift Metrics Endpoint (unchanged)
const getShiftMetrics = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.params.userId;
        if (!userId)
            throw new errorHandler_1.default("User ID required", 400);
        const { startDate, endDate } = req.query;
        const shiftRepo = database_1.default.getRepository(shift_1.Shift);
        // Build the where condition
        let whereCondition = { user: { id: userId } };
        if (startDate && endDate) {
            whereCondition = Object.assign(Object.assign({}, whereCondition), { createdAt: (0, typeorm_1.Between)(new Date(startDate), new Date(endDate)) });
        }
        const shifts = yield shiftRepo.find({
            where: whereCondition,
            order: { createdAt: "DESC" },
        });
        const totalBreakDuration = shifts.reduce((acc, shift) => {
            var _a;
            const breakDurations = ((_a = shift.breaks) === null || _a === void 0 ? void 0 : _a.reduce((sum, breakItem) => sum + (breakItem.duration || 0), 0)) || 0;
            return acc + breakDurations;
        }, 0);
        const metrics = {
            totalShifts: shifts.length,
            totalWorkDuration: shifts.reduce((acc, shift) => acc + (shift.totalWorkDuration || 0), 0),
            totalBreakDuration,
            totalOvertimeMinutes: shifts.reduce((acc, shift) => acc + (shift.overtimeMinutes || 0), 0),
            totalLateMinutes: shifts.reduce((acc, shift) => acc + (shift.lateMinutes || 0), 0),
            lateClockIns: shifts.filter((shift) => shift.isLateClockIn).length,
            shiftsByType: {
                [shift_1.ShiftType.MORNING]: shifts.filter((s) => s.shiftType === shift_1.ShiftType.MORNING).length,
                [shift_1.ShiftType.AFTERNOON]: shifts.filter((s) => s.shiftType === shift_1.ShiftType.AFTERNOON).length,
                [shift_1.ShiftType.NIGHT]: shifts.filter((s) => s.shiftType === shift_1.ShiftType.NIGHT)
                    .length,
            },
        };
        res.json({
            success: true,
            data: metrics,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getShiftMetrics = getShiftMetrics;
// Force End Shift Endpoint (unchanged)
const forceEndShift = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { shiftId } = req.params;
        const { adminNotes } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.userType) !== user_1.UserType.ADMIN) {
            throw new errorHandler_1.default("Unauthorized", 401);
        }
        const shiftRepo = database_1.default.getRepository(shift_1.Shift);
        const shift = yield shiftRepo.findOne({
            where: { id: shiftId },
            relations: ["user"],
        });
        if (!shift)
            throw new errorHandler_1.default("Shift not found", 404);
        const now = new Date();
        shift.status = shift_1.ShiftStatus.FORCE_CLOSED;
        shift.shiftEndType = shift_1.ShiftEndType.ADMIN_FORCE_CLOSE;
        shift.clockOutTime = now;
        shift.adminNotes = adminNotes;
        shift.approvedByAdminId = userId;
        shift.approvalTime = now;
        shift.isClockedIn = false;
        shift.totalWorkDuration = calculateWorkDuration(shift.clockInTime, now, shift.breaks);
        yield shiftRepo.save(shift);
        yield database_1.default.getRepository(user_1.User).update(shift.user.id, { clockedIn: false });
        server_1.io.emit("shiftUpdate", {
            userId: shift.user.id,
            status: "force-closed",
            shiftId,
        });
        res.json({
            success: true,
            message: "Shift force closed successfully",
            data: shift,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.forceEndShift = forceEndShift;
const getCurrentShift = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId)
            throw new errorHandler_1.default("Unauthorized", 401);
        const userRepo = database_1.default.getRepository(user_1.User);
        const shiftRepo = database_1.default.getRepository(shift_1.Shift);
        const user = yield userRepo.findOne({ where: { id: userId } });
        if (!user)
            throw new errorHandler_1.default("User not found", 404);
        // Determine the current shift type dynamically
        const now = new Date();
        const shiftType = getShiftTypeFromTime(now);
        // Find the active shift for the user matching the calculated shift type
        const currentShift = yield shiftRepo.findOne({
            where: {
                user: { id: userId },
                shiftType,
                status: shift_1.ShiftStatus.ACTIVE,
            },
            relations: ["user"],
        });
        if (!currentShift) {
            throw new errorHandler_1.default("No active shift found for current session", 404);
        }
        res.json({
            success: true,
            message: "Current shift retrieved successfully",
            data: {
                shift: currentShift,
                currentSession: shiftType,
                isActive: currentShift.status === shift_1.ShiftStatus.ACTIVE,
                clockedIn: currentShift.isClockedIn,
                workDuration: currentShift.totalWorkDuration || 0,
                breaks: currentShift.breaks || [],
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getCurrentShift = getCurrentShift;
// Helper functions for calculations
const calculateWorkDuration = (clockIn, clockOut, breaks) => {
    const totalMs = clockOut.getTime() - clockIn.getTime();
    const breakTimeMs = breaks.reduce((acc, b) => acc + (b.duration ? b.duration * 60000 : 0), 0);
    return Math.max(0, (totalMs - breakTimeMs) / 60000);
};
const calculateOvertime = (shiftType, totalWorkDuration) => {
    const standardDurations = {
        morning: 7 * 60,
        afternoon: 6 * 60,
        night: 11 * 60,
    };
    return Math.max(0, totalWorkDuration - standardDurations[shiftType]);
};
