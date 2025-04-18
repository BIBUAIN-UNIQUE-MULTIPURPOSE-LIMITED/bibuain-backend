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
exports.getActivityLogById = exports.getActivityLogs = exports.deleteActivityLogs = exports.createActivityLog = void 0;
const database_1 = __importDefault(require("../config/database"));
const activityLogs_1 = require("../models/activityLogs");
const user_1 = require("../models/user");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
const typeorm_1 = require("typeorm");
// Create a new activity log
const createActivityLog = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { activity, description, details, isSystemGenerated } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        // Validate input
        if (!activity || !description) {
            throw new errorHandler_1.default("Activity and description are required", 400);
        }
        // Validate activity type
        if (!Object.values(activityLogs_1.ActivityType).includes(activity)) {
            throw new errorHandler_1.default("Invalid activity type", 400);
        }
        const activityLogRepo = database_1.default.getRepository(activityLogs_1.ActivityLog);
        const userRepo = database_1.default.getRepository(user_1.User);
        let user;
        if (userId) {
            user = yield userRepo.findOne({ where: { id: userId } });
            if (!user) {
                throw new errorHandler_1.default("User not found", 404);
            }
        }
        const activityLog = activityLogRepo.create({
            activity,
            description,
            details,
            isSystemGenerated: isSystemGenerated || false,
            user: user,
            userRole: user === null || user === void 0 ? void 0 : user.userType,
        });
        yield activityLogRepo.save(activityLog);
        res.status(201).json({
            success: true,
            message: "Activity log created successfully",
            data: activityLog,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createActivityLog = createActivityLog;
// Delete activity logs (Admin only)
const deleteActivityLogs = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { ids } = req.body;
        const userType = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userType;
        // Check if user is admin
        if (userType !== "admin") {
            throw new errorHandler_1.default("Unauthorized access", 403);
        }
        // Validate input
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            throw new errorHandler_1.default("Valid log IDs array is required", 400);
        }
        const activityLogRepo = database_1.default.getRepository(activityLogs_1.ActivityLog);
        // Delete logs
        const result = yield activityLogRepo.delete(ids);
        if (result.affected === 0) {
            throw new errorHandler_1.default("No logs found with the provided IDs", 404);
        }
        res.json({
            success: true,
            message: `Successfully deleted ${result.affected} activity logs`,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteActivityLogs = deleteActivityLogs;
// Get activity logs with filters
const getActivityLogs = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { startDate, endDate, activity, userId, userRole, isSystemGenerated, page = 1, limit = 10, sortBy = "timestamp", sortOrder = "DESC", } = req.query;
        const activityLogRepo = database_1.default.getRepository(activityLogs_1.ActivityLog);
        // Build where conditions
        const whereConditions = {};
        if (startDate && endDate) {
            whereConditions.timestamp = (0, typeorm_1.Between)(new Date(startDate), new Date(endDate));
        }
        if (activity) {
            whereConditions.activity = activity;
        }
        if (userId) {
            whereConditions.user = { id: userId };
        }
        if (userRole) {
            whereConditions.userRole = userRole;
        }
        if (isSystemGenerated !== undefined) {
            whereConditions.isSystemGenerated = isSystemGenerated === "true";
        }
        // Calculate skip for pagination
        const skip = (Number(page) - 1) * Number(limit);
        // Get logs with pagination and filters
        const [logs, total] = yield activityLogRepo.findAndCount({
            where: whereConditions,
            relations: ["user"],
            order: { [sortBy]: sortOrder },
            skip,
            take: Number(limit),
        });
        // Calculate pagination metadata
        const totalPages = Math.ceil(total / Number(limit));
        const hasNextPage = Number(page) < totalPages;
        const hasPreviousPage = Number(page) > 1;
        res.json({
            success: true,
            // data: {
            //   logs,
            //   pagination: {
            //     total,
            //     totalPages,
            //     currentPage: Number(page),
            //     hasNextPage,
            //     hasPreviousPage,
            //   },
            data: logs,
            // },
            message: "Activity logs retrieved successfully",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getActivityLogs = getActivityLogs;
// Get single activity log bxy ID
const getActivityLogById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const activityLogRepo = database_1.default.getRepository(activityLogs_1.ActivityLog);
        const log = yield activityLogRepo.findOne({
            where: { id },
            relations: ["user"],
        });
        if (!log) {
            throw new errorHandler_1.default("Activity log not found", 404);
        }
        res.json({
            success: true,
            data: log,
            message: "Activity log retrieved successfully",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getActivityLogById = getActivityLogById;
