"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const notificationController_1 = require("../controllers/notificationController");
const express_1 = __importDefault(require("express"));
const authenticate_1 = require("../middlewares/authenticate");
const router = express_1.default.Router();
router.get("/all", authenticate_1.authenticate, notificationController_1.getUserNotifications);
// Route for marking all notifications complete
router.get("/read", authenticate_1.authenticate, notificationController_1.markAllNotificationsAsCompleted);
// Route for deleteing a notification
router.delete("/:notificationId", authenticate_1.authenticate, notificationController_1.deleteNotification);
router.post("/", authenticate_1.authenticate, notificationController_1.createNotificationHandler);
exports.default = router;
