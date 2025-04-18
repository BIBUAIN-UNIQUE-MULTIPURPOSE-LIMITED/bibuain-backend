"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const authenticate_1 = require("../middlewares/authenticate");
const validateRequest_1 = __importDefault(require("../middlewares/validateRequest"));
const messagesController_1 = require("../controllers/messagesController");
const multer_1 = require("../config/multer");
const router = (0, express_1.Router)();
router.post("/create", validateRequest_1.default, authenticate_1.authenticate, multer_1.uploadSingleFile, messagesController_1.createMessage);
// Get all messages for a chat
router.get("/all/:chatId", [(0, express_validator_1.param)("chatId").isUUID().withMessage("Invalid chat ID.")], validateRequest_1.default, authenticate_1.authenticate, messagesController_1.getMessages);
// Delete a specific message by ID
router.delete("/:chatId/:messageId", [
    (0, express_validator_1.param)("chatId").isUUID().withMessage("Invalid chat ID."),
    (0, express_validator_1.param)("messageId").isUUID().withMessage("Invalid message ID."),
], validateRequest_1.default, authenticate_1.authenticate, messagesController_1.deleteMessage);
// Mark a message as seen
router.put("/:chatId/:messageId/seen", [
    (0, express_validator_1.param)("chatId").isUUID().withMessage("Invalid chat ID."),
    (0, express_validator_1.param)("messageId").isUUID().withMessage("Invalid message ID."),
], validateRequest_1.default, authenticate_1.authenticate, messagesController_1.markMessageAsSeen);
exports.default = router;
