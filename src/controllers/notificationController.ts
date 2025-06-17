import type { NextFunction, RequestHandler, Response } from "express";
import type { Server } from "socket.io";
import dbConnect from "../config/database";
import type { UserRequest } from "../middlewares/authenticate";
import {
  Notification,
  NotificationType,
  PriorityLevel,
} from "../models/notifications";
import { User } from "../models/user";
import { io } from "../server";
import ErrorHandler from "../utils/errorHandler";

/*
 * Fetch all notifications for a user
 * Returns notifications with related account information
 */
export const getUserNotifications: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const notificationRepo = dbConnect.getRepository(Notification);
    const notifications = await notificationRepo.find({
      where: { user: { id: userId } },
      relations: ["relatedAccount"],
    });
    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

/*
 * mark unread notifications for a user as read
 */
export const markAllNotificationsAsRead: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const notificationRepo = dbConnect.getRepository(Notification);

    const result = await notificationRepo
      .createQueryBuilder()
      .update(Notification)
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
  } catch (error) {
    next(error);
  }
};

/*
 * Mark a specific notification as read
 * Emits a socket event for real-time updates
 */
export const markNotificationAsRead: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    const notificationId = req.params.id;

    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const notificationRepo = dbConnect.getRepository(Notification);
    const notification = await notificationRepo.findOne({
      where: { id: notificationId, user: { id: userId } },
    });

    if (!notification) {
      throw new ErrorHandler("Notification not found", 404);
    }

    notification.read = true;
    await notificationRepo.save(notification);

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
  } catch (error) {
    next(error);
  }
};

/*
 * Delete a specific notification
 * Emits a socket event for real-time updates
 */
export const deleteNotification: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    const notificationId = req.params.id;

    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const notificationRepo = dbConnect.getRepository(Notification);
    const notification = await notificationRepo.findOne({
      where: { id: notificationId, user: { id: userId } },
    });

    if (!notification) {
      throw new ErrorHandler("Notification not found", 404);
    }

    await notificationRepo.remove(notification);

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
  } catch (error) {
    next(error);
  }
};

/*
 * Setup WebSocket for notifications
 * Handles joining/leaving notification rooms and marking notifications as read
 */
export const setupNotificationSocket = (io: Server) => {
  io.on("connection", (socket: any) => {
    // Join notification room
    socket.on("joinNotificationRoom", (userId: string) => {
      if (userId && typeof userId === "string") {
        socket.join(`notifications:${userId}`);
      }
    });

    // Leave notification room
    socket.on("leaveNotificationRoom", (userId: string) => {
      if (userId && typeof userId === "string") {
        socket.leave(`notifications:${userId}`);
      }
    });

    // Handle read status updates
    socket.on(
      "markNotificationRead",
      async (data: { userId: string; notificationId: string }) => {
        try {
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
        } catch (error) {
          console.error("Error updating notification read status:", error);
        }
      },
    );
  });
};

/*
 * Mark all notifications as completed (read)
 * This is a bulk operation to mark all unread notifications as read
 */
export const markAllNotificationsAsCompleted: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const notificationRepo = dbConnect.getRepository(Notification);

    const result = await notificationRepo
      .createQueryBuilder()
      .update(Notification)
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
  } catch (error) {
    next(error);
  }
};

/*
 * Create a new notification
 * This function creates a notification and emits it via WebSocket
 * It can be used for various types of notifications (system, user, etc.)
 */
export const createNotification = async ({
  userId,
  title,
  description,
  type = NotificationType.SYSTEM,
  priority = PriorityLevel.MEDIUM,
  relatedAccountId = null,
}: {
  userId: string;
  title: string;
  description: string;
  type?: NotificationType;
  priority?: PriorityLevel;
  relatedAccountId?: string | null;
}) => {
  try {
    const userRepo = dbConnect.getRepository(User);
    const notificationRepo = dbConnect.getRepository(Notification);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }

    let relatedAccount: User | null = null;

    if (relatedAccountId) {
      relatedAccount = await userRepo.findOne({
        where: { id: relatedAccountId },
      });

      if (!relatedAccount) {
        throw new Error("Related Account not found!");
      }
    }

    // Create the notification
    const notification = notificationRepo.create({
      user: { id: user.id },
      title,
      description,
      type,
      priority,
      relatedAccount: relatedAccount ? { id: relatedAccount.id } : undefined,
      read: false,
    });

    const savedNotification = await notificationRepo.save(notification);
    if (io) {
      io.to(`notifications:${userId}`).emit("newNotification", {
        type: "NEW_NOTIFICATION",
        notification: savedNotification,
      });
    }

    return savedNotification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

/*
 * Create a new notification handler
 * This is an Express.js request handler to create a notification
 * It validates input and calls the createNotification function
 */
export const createNotificationHandler: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const { userId, title, description, type, priority, relatedAccountId } =
      req.body as {
        userId: string;
        title: string;
        description: string;
        type?: NotificationType;
        priority?: PriorityLevel;
        relatedAccountId?: string | null;
      };

    if (!userId || !title || !description) {
      throw new ErrorHandler("userId, title and description are required", 400);
    }

    const notification = await createNotification({
      userId,
      title,
      description,
      type,
      priority,
      relatedAccountId,
    });

    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (err) {
    next(err);
  }
};
