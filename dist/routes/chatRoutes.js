"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const authenticate_1 = require("../middlewares/authenticate");
const validateRequest_1 = __importDefault(require("../middlewares/validateRequest"));
const chatsController_1 = require("../controllers/chatsController");
const router = (0, express_1.Router)();
// Create a new chat with two participants
router.post("/create", [
    (0, express_validator_1.body)("participants")
        .isArray({ min: 2, max: 2 })
        .withMessage("Participants must be exactly two users."),
    (0, express_validator_1.body)("participants.*")
        .isUUID()
        .withMessage("Each participant must be a valid user ID."),
], validateRequest_1.default, authenticate_1.authenticate, chatsController_1.createChat);
// Get all chats for the authenticated user
router.get("/all", authenticate_1.authenticate, chatsController_1.getChats);
// Get a single chat by ID
router.get("/:chatId", [(0, express_validator_1.param)("chatId").isUUID().withMessage("Invalid chat ID.")], validateRequest_1.default, authenticate_1.authenticate, chatsController_1.getChat);
// Delete a chat
router.delete("/:chatId", [(0, express_validator_1.param)("chatId").isUUID().withMessage("Invalid chat ID.")], validateRequest_1.default, authenticate_1.authenticate, chatsController_1.deleteChat);
exports.default = router;
