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
exports.createNotificationHandler = exports.createNotification = exports.markAllNotificationsAsCompleted = exports.setupNotificationSocket = exports.deleteNotification = exports.markNotificationAsRead = exports.markAllNotificationsAsRead = exports.getUserNotifications = void 0;
const database_1 = __importDefault(require("../config/database"));
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
const notifications_1 = require("../models/notifications");
const user_1 = require("../models/user");
const server_1 = require("../server");
// Get all notifications for a user with pagination and filters
const getUserNotifications = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const notificationRepo = database_1.default.getRepository(notifications_1.Notification);
        const notifications = yield notificationRepo.find({
            where: { user: { id: userId } },
            relations: ["relatedAccount"],
        });
        console.log(`Here are the notifications`, notifications);
        res.json({
            success: true,
            data: notifications,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getUserNotifications = getUserNotifications;
// Mark all notifications as read for a user
const markAllNotificationsAsRead = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const notificationRepo = database_1.default.getRepository(notifications_1.Notification);
        const result = yield notificationRepo
            .createQueryBuilder()
            .update(notifications_1.Notification)
            .set({ read: true })
            .where("user.id = :userId AND read = :read", { userId, read: false })
            .execute();
        const io = req.app.get("io");
        if (io) {
            io.to(`notifications:${userId}`).emit("notificationsUpdate", {
                type: "MARK_ALL_READ",
                userId,
            });
        }
        res.json({
            success: true,
            message: "All notifications marked as read",
            data: {
                updatedCount: result.affected,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
// Mark a single notification as read
const markNotificationAsRead = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const notificationId = req.params.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const notificationRepo = database_1.default.getRepository(notifications_1.Notification);
        const notification = yield notificationRepo.findOne({
            where: { id: notificationId, user: { id: userId } },
        });
        if (!notification) {
            throw new errorHandler_1.default("Notification not found", 404);
        }
        notification.read = true;
        yield notificationRepo.save(notification);
        const io = req.app.get("io");
        if (io) {
            io.to(`notifications:${userId}`).emit("notificationUpdate", {
                type: "READ_STATUS_UPDATE",
                notificationId,
                read: true,
            });
        }
        res.json({
            success: true,
            message: "Notification marked as read",
            data: notification,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.markNotificationAsRead = markNotificationAsRead;
// Delete a notification
const deleteNotification = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const notificationId = req.params.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const notificationRepo = database_1.default.getRepository(notifications_1.Notification);
        const notification = yield notificationRepo.findOne({
            where: { id: notificationId, user: { id: userId } },
        });
        if (!notification) {
            throw new errorHandler_1.default("Notification not found", 404);
        }
        yield notificationRepo.remove(notification);
        // Emit socket event for real-time update
        const io = req.app.get("io");
        if (io) {
            io.to(`notifications:${userId}`).emit("notificationUpdate", {
                type: "NOTIFICATION_DELETED",
                notificationId,
            });
        }
        res.json({
            success: true,
            message: "Notification deleted successfully",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteNotification = deleteNotification;
// Setup socket handlers for notifications
const setupNotificationSocket = (io) => {
    io.on("connection", (socket) => {
        // Join notification room
        socket.on("joinNotificationRoom", (userId) => {
            if (userId && typeof userId === "string") {
                socket.join(`notifications:${userId}`);
            }
        });
        // Leave notification room
        socket.on("leaveNotificationRoom", (userId) => {
            if (userId && typeof userId === "string") {
                socket.leave(`notifications:${userId}`);
            }
        });
        // Handle read status updates
        socket.on("markNotificationRead", (data) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const notificationRepo = database_1.default.getRepository(notifications_1.Notification);
                const notification = yield notificationRepo.findOne({
                    where: { id: data.notificationId, user: { id: data.userId } },
                });
                if (notification) {
                    notification.read = true;
                    yield notificationRepo.save(notification);
                    io.to(`notifications:${data.userId}`).emit("notificationUpdate", {
                        type: "READ_STATUS_UPDATE",
                        notificationId: data.notificationId,
                        read: true,
                    });
                }
            }
            catch (error) {
                console.error("Error updating notification read status:", error);
            }
        }));
    });
};
exports.setupNotificationSocket = setupNotificationSocket;
// Controller for marking All notifications as complete
const markAllNotificationsAsCompleted = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const notificationRepo = database_1.default.getRepository(notifications_1.Notification);
        const result = yield notificationRepo
            .createQueryBuilder()
            .update(notifications_1.Notification)
            .set({ read: true })
            .where("user.id = :userId AND read = :read", { userId, read: false })
            .execute();
        res.json({
            success: true,
            message: "All notifications marked as completed (read)",
            data: {
                updatedCount: result.affected,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.markAllNotificationsAsCompleted = markAllNotificationsAsCompleted;
// Create a notification (utility function for internal use)
const createNotification = (_a) => __awaiter(void 0, [_a], void 0, function* ({ userId, title, description, type = notifications_1.NotificationType.SYSTEM, priority = notifications_1.PriorityLevel.MEDIUM, relatedAccountId = null, }) {
    try {
        const userRepo = database_1.default.getRepository(user_1.User);
        const notificationRepo = database_1.default.getRepository(notifications_1.Notification);
        console.log(`This is User ID`, userId);
        // Validate the user exists
        const user = yield userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error("User not found");
        }
        let relatedAccount = null;
        if (relatedAccountId) {
            relatedAccount = yield userRepo.findOne({
                where: { id: relatedAccountId },
            });
            if (!relatedAccount) {
                throw new Error("Related Account not found!");
            }
        }
        // Create the notification (Ensure fields match TypeORM expectations)
        const notification = notificationRepo.create({
            user: { id: user.id },
            title,
            description,
            type,
            priority,
            relatedAccount: relatedAccount ? { id: relatedAccount.id } : undefined, // Assign reference properly
            read: false,
        });
        const savedNotification = yield notificationRepo.save(notification);
        console.log(savedNotification);
        // Emit real-time notification via WebSocket
        if (server_1.io) {
            server_1.io.to(`notifications:${userId}`).emit("newNotification", {
                type: "NEW_NOTIFICATION",
                notification: savedNotification,
            });
        }
        return savedNotification;
    }
    catch (error) {
        console.error("Error creating notification:", error);
        throw error;
    }
});
exports.createNotification = createNotification;
const createNotificationHandler = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, title, description, type, priority, relatedAccountId, } = req.body;
        if (!userId || !title || !description) {
            throw new errorHandler_1.default("userId, title and description are required", 400);
        }
        const notification = yield (0, exports.createNotification)({
            userId,
            title,
            description,
            type,
            priority,
            relatedAccountId,
        });
        // send response, but do NOT return it
        res.status(201).json({
            success: true,
            data: notification,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.createNotificationHandler = createNotificationHandler;
