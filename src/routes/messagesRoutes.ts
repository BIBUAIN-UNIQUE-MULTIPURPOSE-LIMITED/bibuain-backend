import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate } from "../middlewares/authenticate";
import validateRequest from "../middlewares/validateRequest";
import {
  createMessage,
  getMessages,
  deleteMessage,
  markMessageAsSeen,
} from "../controllers/messagesController";
import { uploadMultipleFiles, uploadSingleFile } from "../config/multer";

const router: any = Router();

router.post(
  "/create",
  validateRequest,
  authenticate,
  uploadSingleFile,
  createMessage
);

// Get all messages for a chat
router.get(
  "/all/:chatId",
  [param("chatId").isUUID().withMessage("Invalid chat ID.")],
  validateRequest,
  authenticate,
  getMessages
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
  deleteMessage
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
  markMessageAsSeen
);

export default router;
