import { Router } from "express";
import { param } from "express-validator";
import { uploadSingleFile } from "../config/multer";
import {
  createMessage,
  deleteMessage,
  getMessages,
  markMessageAsSeen,
} from "../controllers/messagesController";
import { authenticate } from "../middlewares/authenticate";
import validateRequest from "../middlewares/validateRequest";

const router: any = Router();

router.post(
  "/create",
  validateRequest,
  authenticate,
  uploadSingleFile,
  createMessage,
);

// Get all messages for a chat
router.get(
  "/all/:chatId",
  [param("chatId").isUUID().withMessage("Invalid chat ID.")],
  validateRequest,
  authenticate,
  getMessages,
);

// Delete a specific message by ID
router.delete(
  "/:chatId/:messageId",
  [
    param("chatId").isUUID().withMessage("Invalid chat ID."),
    param("messageId").isUUID().withMessage("Invalid message ID."),
  ],
  validateRequest,
  authenticate,
  deleteMessage,
);

// Mark a message as seen
router.put(
  "/:chatId/:messageId/seen",
  [
    param("chatId").isUUID().withMessage("Invalid chat ID."),
    param("messageId").isUUID().withMessage("Invalid message ID."),
  ],
  validateRequest,
  authenticate,
  markMessageAsSeen,
);

export default router;
