import http from "http";
import { Server } from "socket.io";
import app from "./app";
import dbConnect from "./config/database";
import { Notification } from "./models/notifications";

// Error handling for unhandled rejections and exceptions
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  // console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error: Error) => {
  // console.error("Uncaught Exception thrown:", error);
  process.exit(1);
});

const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://app.bibuain.ng", "https://bibuain-frontend.onrender.com", "https://bibuain.onrender.com", '*', "https://main.d3k29622cc2yrv.amplifyapp.com"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
});



class OnlineUsersManager {
  private users: Set<string> = new Set();
  private userSockets: Map<string, Set<string>> = new Map();

  addUser(userId: string, socketId: string): void {
    if (!userId || typeof userId !== "string") {
      throw new Error("Invalid user ID");
    }

    this.users.add(userId);

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)?.add(socketId);

    // Emit updated online users list immediately
    io.emit("onlineUsers", this.getOnlineUsers());
    io.emit("userStatusUpdate", { userId, status: "online" });
  }

  removeSocket(userId: string, socketId: string): boolean {
    if (!userId || !socketId) return false;

    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socketId);

      // If user has no more active sockets, remove them from online users
      if (userSocketSet.size === 0) {
        this.users.delete(userId);
        this.userSockets.delete(userId);

        // Emit updated online users list
        io.emit("onlineUsers", this.getOnlineUsers());
        io.emit("userStatusUpdate", { userId, status: "offline" });
        return true;
      }
    }
    return false;
  }

  getOnlineUsers(): string[] {
    return Array.from(this.users);
  }

  isUserOnline(userId: string): boolean {
    return this.users.has(userId);
  }

  getUserSockets(userId: string): Set<string> | undefined {
    return this.userSockets.get(userId);
  }

  // New method to handle initial user connection
  handleInitialConnection(userId: string, socketId: string): void {
    this.addUser(userId, socketId);
  }
}

export const onlineUsersManager = new OnlineUsersManager();

// Set up socket.io instance in app for global access
app.set("io", io);

io.use((socket, next) => {
  const userId =
    socket.handshake.auth.userId || (socket.handshake.query.userId as string);
  if (!userId) {
    return next(new Error("Authentication error"));
  }
  socket.data.userId = userId;
  next();
});

io.on("connection", (socket) => {
  // console.log("A user connected:", socket.id);
  const userId = socket.data.userId;

  // Handle initial connection and join
  socket.on("join", (joinUserId: string) => {
    try {
      if (joinUserId === userId) {
        onlineUsersManager.handleInitialConnection(userId, socket.id);
        socket.join(`notifications:${userId}`);
      } else {
        throw new Error("User ID mismatch");
      }
    } catch (error) {
      console.error("Error in join event:", error);
      socket.emit("error", "Invalid user ID provided");
    }
  });

  // Handle user status updates
  socket.on(
    "userStatusUpdate",
    ({ userId: statusUserId, status }: { userId: string; status: string }) => {
      try {
        if (statusUserId === userId) {
          if (status === "offline") {
            const wasRemoved = onlineUsersManager.removeSocket(
              userId,
              socket.id
            );
            if (wasRemoved) {
              socket.leave(`notifications:${userId}`);
            }
          } else {
            onlineUsersManager.addUser(userId, socket.id);
            socket.join(`notifications:${userId}`);
          }
        } else {
          throw new Error("User ID mismatch");
        }
      } catch (error) {
        console.error("Error in userStatusUpdate:", error);
        socket.emit("error", "Error updating user status");
      }
    }
  );

  // Handle joining chat rooms
  socket.on("joinChat", (chatId: string) => {
    if (typeof chatId === "string" && chatId.trim()) {
      socket.join(chatId);
      // console.log(`User joined chat: ${chatId}`);
    }
  });

  // Handle leaving chat rooms
  socket.on("leaveChat", (chatId: string) => {
    if (typeof chatId === "string" && chatId.trim()) {
      socket.leave(chatId);
      // console.log(`User left chat: ${chatId}`);
    }
  });

  // Handle chat messages
  socket.on("sendMessage", (data: { chatId: string; message: any }) => {
    const { chatId, message } = data;
    if (chatId && message) {
      io.to(chatId).emit("receiveMessage", data);
    }
  });

  // Handle typing indicators
  socket.on("typing", (data: { chatId: string; user: any }) => {
    socket.to(data.chatId).emit("typing", data);
  });

  socket.on("stopTyping", (data: { chatId: string; user: any }) => {
    socket.to(data.chatId).emit("stopTyping", data);
  });

  // Notification handlers
  socket.on("joinNotificationRoom", (notifyUserId: string) => {
    if (notifyUserId === userId) {
      socket.join(`notifications:${userId}`);
      // console.log(`User ${userId} joined their notification room`);
    }
  });

  socket.on("leaveNotificationRoom", (notifyUserId: string) => {
    if (notifyUserId === userId) {
      socket.leave(`notifications:${userId}`);
      // console.log(`User ${userId} left their notification room`);
    }
  });

  socket.on(
    "markNotificationRead",
    async (data: { userId: string; notificationId: string }) => {
      try {
        if (data.userId === userId) {
          const notificationRepo = dbConnect.getRepository(Notification);
          const notification = await notificationRepo.findOne({
            where: { id: data.notificationId, user: { id: data.userId } },
          });

          if (notification) {
            notification.read = true;
            await notificationRepo.save(notification);

            io.to(`notifications:${data.userId}`).emit("notificationUpdate", {
              type: "READ_STATUS_UPDATE",
              notificationId: data.notificationId,
              read: true,
            });
          }
        }
      } catch (error) {
        console.error("Error updating notification read status:", error);
        socket.emit("error", "Error updating notification");
      }
    }
  );

  // Handle disconnection
  socket.on("disconnect", () => {
    if (userId) {
      const wasRemoved = onlineUsersManager.removeSocket(userId, socket.id);
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
(async () => {
  try {
    await dbConnect.initialize();
    console.log("✅ Database connected");

    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to connect to DB:", err);
    process.exit(1);
  }
})();