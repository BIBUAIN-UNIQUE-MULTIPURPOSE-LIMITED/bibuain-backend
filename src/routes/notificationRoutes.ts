import {
  deleteNotification,
  getUserNotifications,
  markAllNotificationsAsCompleted,
  markAllNotificationsAsRead,
  createNotificationHandler
} from "../controllers/notificationController";
import express from "express";
import { authenticate } from "../middlewares/authenticate";

const router: any = express.Router();

router.get("/all", authenticate, getUserNotifications);

// Route for marking all notifications complete

router.get("/read", authenticate, markAllNotificationsAsCompleted);

// Route for deleteing a notification

router.delete("/:notificationId", authenticate, deleteNotification);
router.post("/", authenticate, createNotificationHandler);

export default router;
