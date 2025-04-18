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
exports.getMessages = exports.deleteMessage = exports.getMessageDetails = exports.getUnseenMessages = exports.getMessagesInChat = exports.markMessageAsSeen = exports.createMessage = void 0;
const database_1 = __importDefault(require("../config/database"));
const messages_1 = require("../models/messages");
const user_1 = require("../models/user");
const chats_1 = require("../models/chats");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
// Create a new message
const createMessage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { chatId, content } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const chatRepo = database_1.default.getRepository(chats_1.Chat);
        const messageRepo = database_1.default.getRepository(messages_1.Message);
        // Find the chat
        const chat = yield chatRepo.findOne({
            where: { id: chatId },
            relations: ["participants"],
        });
        if (!chat) {
            throw new errorHandler_1.default("Chat not found", 404);
        }
        // Find the sender (user)
        const sender = yield database_1.default.getRepository(user_1.User).findOne({ where: { id: userId } });
        if (!sender) {
            throw new errorHandler_1.default("User not found", 404);
        }
        // Create a new message
        const message = new messages_1.Message();
        message.chat = chat;
        message.sender = sender;
        message.content = content;
        message.seen = false;
        const attachments = [];
        if (req.file) {
            attachments.push({
                url: `/uploads/${req.file.filename}`,
                type: req.file.mimetype,
                name: req.file.originalname,
                size: req.file.size,
            });
        }
        console.log(attachments);
        if (attachments.length > 0) {
            message.attachments = attachments;
        }
        const savedMessage = yield messageRepo.save(message);
        req.app.get("io").to(chatId).emit("newMessage", savedMessage);
        res.json({
            success: true,
            message: "Message sent successfully",
            data: savedMessage,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createMessage = createMessage;
// Mark a message as seen by the user
const markMessageAsSeen = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { messageId } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const messageRepo = database_1.default.getRepository(messages_1.Message);
        const userRepo = database_1.default.getRepository(user_1.User);
        // Find the message
        const message = yield messageRepo.findOne({
            where: { id: messageId },
            relations: ["seenBy", "chat", "chat.participants"],
        });
        if (!message) {
            throw new errorHandler_1.default("Message not found", 404);
        }
        // Find the user
        const user = yield userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new errorHandler_1.default("User not found", 404);
        }
        // Save the updated message
        const updatedMessage = yield messageRepo.save(message);
        res.json({
            success: true,
            message: "Message marked as seen successfully",
            data: updatedMessage,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.markMessageAsSeen = markMessageAsSeen;
// Get all messages in a chat
const getMessagesInChat = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { chatId } = req.params;
        const messageRepo = database_1.default.getRepository(messages_1.Message);
        // Find all messages in the given chat
        const messages = yield messageRepo.find({
            where: { chat: { id: chatId } },
            order: { createdAt: "ASC" },
            relations: ["sender", "seenBy"],
        });
        if (!messages.length) {
            throw new errorHandler_1.default("No messages found", 404);
        }
        res.json({
            success: true,
            data: messages,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getMessagesInChat = getMessagesInChat;
// Get unseen messages for a specific user in a chat
const getUnseenMessages = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { chatId } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const messageRepo = database_1.default.getRepository(messages_1.Message);
        // Find messages that have not been seen by the user
        const unseenMessages = yield messageRepo
            .createQueryBuilder("message")
            .leftJoinAndSelect("message.sender", "sender")
            .leftJoinAndSelect("message.seenBy", "seenBy")
            .where("message.chatId = :chatId", { chatId })
            .andWhere("NOT EXISTS (SELECT 1 FROM message_seen_by WHERE message_id = message.id AND user_id = :userId)", { userId })
            .orderBy("message.createdAt", "ASC")
            .getMany();
        if (!unseenMessages) {
            throw new errorHandler_1.default("No unseen messages found", 404);
        }
        res.json({
            success: true,
            data: unseenMessages,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getUnseenMessages = getUnseenMessages;
// Get the details of a specific message
const getMessageDetails = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { messageId } = req.params;
        const messageRepo = database_1.default.getRepository(messages_1.Message);
        // Find the message by its ID
        const message = yield messageRepo.findOne({
            where: { id: messageId },
            relations: ["sender", "seenBy", "chat"],
        });
        if (!message) {
            throw new errorHandler_1.default("Message not found", 404);
        }
        res.json({
            success: true,
            data: message,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getMessageDetails = getMessageDetails;
// Delete a message
const deleteMessage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { messageId } = req.params;
        const messageRepo = database_1.default.getRepository(messages_1.Message);
        // Find the message to be deleted
        const message = yield messageRepo.findOne({ where: { id: messageId } });
        if (!message) {
            throw new errorHandler_1.default("Message not found", 404);
        }
        // Delete the message
        yield messageRepo.remove(message);
        res.json({
            success: true,
            message: "Message deleted successfully",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteMessage = deleteMessage;
// Get All Messages for a specific Chat
const getMessages = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { chatId } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const chatRepo = database_1.default.getRepository(chats_1.Chat);
        const messageRepo = database_1.default.getRepository(messages_1.Message);
        const chat = yield chatRepo.findOne({
            where: { id: chatId },
            relations: ["participants"],
        });
        if (!chat) {
            throw new errorHandler_1.default("Chat not found", 404);
        }
        if (!chat.participants.some((user) => user.id === userId)) {
            throw new errorHandler_1.default("You are not a participant of this chat", 403);
        }
        const messages = yield messageRepo.find({
            where: { chat: { id: chatId } },
            order: { createdAt: "ASC" },
        });
        res.json({
            success: true,
            data: messages,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getMessages = getMessages;
