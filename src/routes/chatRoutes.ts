import { Router } from "express";
import { body, param } from "express-validator";
import { authenticate } from "../middlewares/authenticate";
import validateRequest from "../middlewares/validateRequest";
import {
  createChat,
  getChats,
  getChat,
  deleteChat,
} from "../controllers/chatsController";

const router: any = Router();

// Create a new chat with two participants
router.post(
  "/create",
  [
    body("participants")
      .isArray({ min: 2, max: 2 })
      .withMessage("Participants must be exactly two users."),
    body("participants.*")
      .isUUID()
      .withMessage("Each participant must be a valid user ID."),
  ],
  validateRequest,
  authenticate,
  createChat
);

// Get all chats for the authenticated user
router.get("/all", authenticate, getChats);

// Get a single chat by ID
router.get(
  "/:chatId",
  [param("chatId").isUUID().withMessage("Invalid chat ID.")],
  validateRequest,
  authenticate,
  getChat
);

// Delete a chat
router.delete(
  "/:chatId",
  [param("chatId").isUUID().withMessage("Invalid chat ID.")],
  validateRequest,
  authenticate,
  deleteChat
);

export default router;
