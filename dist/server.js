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
exports.onlineUsersManager = exports.io = void 0;
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app"));
const database_1 = __importDefault(require("./config/database"));
const notifications_1 = require("./models/notifications");
// Error handling for unhandled rejections and exceptions
process.on("unhandledRejection", (reason, promise) => {
    // console.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
});
process.on("uncaughtException", (error) => {
    // console.error("Uncaught Exception thrown:", error);
    process.exit(1);
});
const server = http_1.default.createServer(app_1.default);
exports.io = new socket_io_1.Server(server, {
    cors: {
        origin: ["http://localhost:5173", "https://app.bibuain.ng"],
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        credentials: true,
    },
});
class OnlineUsersManager {
    constructor() {
        this.users = new Set();
        this.userSockets = new Map();
    }
    addUser(userId, socketId) {
        var _a;
        if (!userId || typeof userId !== "string") {
            throw new Error("Invalid user ID");
        }
        this.users.add(userId);
        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        (_a = this.userSockets.get(userId)) === null || _a === void 0 ? void 0 : _a.add(socketId);
        // Emit updated online users list immediately
        exports.io.emit("onlineUsers", this.getOnlineUsers());
        exports.io.emit("userStatusUpdate", { userId, status: "online" });
    }
    removeSocket(userId, socketId) {
        if (!userId || !socketId)
            return false;
        const userSocketSet = this.userSockets.get(userId);
        if (userSocketSet) {
            userSocketSet.delete(socketId);
            // If user has no more active sockets, remove them from online users
            if (userSocketSet.size === 0) {
                this.users.delete(userId);
                this.userSockets.delete(userId);
                // Emit updated online users list
                exports.io.emit("onlineUsers", this.getOnlineUsers());
                exports.io.emit("userStatusUpdate", { userId, status: "offline" });
                return true;
            }
        }
        return false;
    }
    getOnlineUsers() {
        return Array.from(this.users);
    }
    isUserOnline(userId) {
        return this.users.has(userId);
    }
    getUserSockets(userId) {
        return this.userSockets.get(userId);
    }
    // New method to handle initial user connection
    handleInitialConnection(userId, socketId) {
        this.addUser(userId, socketId);
    }
}
exports.onlineUsersManager = new OnlineUsersManager();
// Set up socket.io instance in app for global access
app_1.default.set("io", exports.io);
exports.io.use((socket, next) => {
    const userId = socket.handshake.auth.userId || socket.handshake.query.userId;
    if (!userId) {
        return next(new Error("Authentication error"));
    }
    socket.data.userId = userId;
    next();
});
exports.io.on("connection", (socket) => {
    // console.log("A user connected:", socket.id);
    const userId = socket.data.userId;
    // Handle initial connection and join
    socket.on("join", (joinUserId) => {
        try {
            if (joinUserId === userId) {
                exports.onlineUsersManager.handleInitialConnection(userId, socket.id);
                socket.join(`notifications:${userId}`);
            }
            else {
                throw new Error("User ID mismatch");
            }
        }
        catch (error) {
            console.error("Error in join event:", error);
            socket.emit("error", "Invalid user ID provided");
        }
    });
    // Handle user status updates
    socket.on("userStatusUpdate", ({ userId: statusUserId, status }) => {
        try {
            if (statusUserId === userId) {
                if (status === "offline") {
                    const wasRemoved = exports.onlineUsersManager.removeSocket(userId, socket.id);
                    if (wasRemoved) {
                        socket.leave(`notifications:${userId}`);
                    }
                }
                else {
                    exports.onlineUsersManager.addUser(userId, socket.id);
                    socket.join(`notifications:${userId}`);
                }
            }
            else {
                throw new Error("User ID mismatch");
            }
        }
        catch (error) {
            console.error("Error in userStatusUpdate:", error);
            socket.emit("error", "Error updating user status");
        }
    });
    // Handle joining chat rooms
    socket.on("joinChat", (chatId) => {
        if (typeof chatId === "string" && chatId.trim()) {
            socket.join(chatId);
            // console.log(`User joined chat: ${chatId}`);
        }
    });
    // Handle leaving chat rooms
    socket.on("leaveChat", (chatId) => {
        if (typeof chatId === "string" && chatId.trim()) {
            socket.leave(chatId);
            // console.log(`User left chat: ${chatId}`);
        }
    });
    // Handle chat messages
    socket.on("sendMessage", (data) => {
        const { chatId, message } = data;
        if (chatId && message) {
            exports.io.to(chatId).emit("receiveMessage", data);
        }
    });
    // Handle typing indicators
    socket.on("typing", (data) => {
        socket.to(data.chatId).emit("typing", data);
    });
    socket.on("stopTyping", (data) => {
        socket.to(data.chatId).emit("stopTyping", data);
    });
    // Notification handlers
    socket.on("joinNotificationRoom", (notifyUserId) => {
        if (notifyUserId === userId) {
            socket.join(`notifications:${userId}`);
            // console.log(`User ${userId} joined their notification room`);
        }
    });
    socket.on("leaveNotificationRoom", (notifyUserId) => {
        if (notifyUserId === userId) {
            socket.leave(`notifications:${userId}`);
            // console.log(`User ${userId} left their notification room`);
        }
    });
    socket.on("markNotificationRead", (data) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            if (data.userId === userId) {
                const notificationRepo = database_1.default.getRepository(notifications_1.Notification);
                const notification = yield notificationRepo.findOne({
                    where: { id: data.notificationId, user: { id: data.userId } },
                });
                if (notification) {
                    notification.read = true;
                    yield notificationRepo.save(notification);
                    exports.io.to(`notifications:${data.userId}`).emit("notificationUpdate", {
                        type: "READ_STATUS_UPDATE",
                        notificationId: data.notificationId,
                        read: true,
                    });
                }
            }
        }
        catch (error) {
            console.error("Error updating notification read status:", error);
            socket.emit("error", "Error updating notification");
        }
    }));
    // Handle disconnection
    socket.on("disconnect", () => {
        if (userId) {
            const wasRemoved = exports.onlineUsersManager.removeSocket(userId, socket.id);
            if (wasRemoved) {
                socket.leave(`notifications:${userId}`);
            }
        }
        // console.log("User disconnected:", socket.id);
    });
    // Handle socket errors
    socket.on("error", (error) => {
        console.error("Socket error:", error);
    });
});
// Database connection
// dbConnect();
const PORT = process.env.PORT || 7001;
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield database_1.default.initialize();
        console.log("✅ Database connected");
        server.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });
    }
    catch (err) {
        console.error("❌ Failed to connect to DB:", err);
        process.exit(1);
    }
}))();
