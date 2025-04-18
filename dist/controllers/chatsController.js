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
exports.deleteChat = exports.getChat = exports.getChats = exports.createChat = void 0;
const chats_1 = require("../models/chats");
const user_1 = require("../models/user");
const database_1 = __importDefault(require("../config/database"));
const express_validator_1 = require("express-validator");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
const messages_1 = require("../models/messages");
// Create a Chat for Two Participants
const createChat = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.default("Validation errors", 400);
        }
        const { participants } = req.body;
        // Ensure exactly two participants
        if (!participants || participants.length !== 2) {
            throw new errorHandler_1.default("Exactly two participants are required", 400);
        }
        if (new Set(participants).size !== participants.length) {
            throw new errorHandler_1.default("Participants cannot be duplicate", 400);
        }
        const userRepo = database_1.default.getRepository(user_1.User);
        const chatRepo = database_1.default.getRepository(chats_1.Chat);
        // Verify that all participants exist in the system
        const users = yield userRepo.findByIds(participants);
        if (users.length !== participants.length) {
            throw new errorHandler_1.default("One or more participants not found", 404);
        }
        // Check if a chat with the same participants already exists
        const existingChat = yield chatRepo
            .createQueryBuilder("chat")
            .innerJoin("chat.participants", "participant")
            .where("participant.id IN (:...participants)", { participants })
            .groupBy("chat.id")
            .having("COUNT(participant.id) = :count", { count: participants.length })
            .getOne();
        if (existingChat) {
            throw new errorHandler_1.default("A chat with these participants already exists", 400);
        }
        // Create a new chat
        const newChat = new chats_1.Chat();
        newChat.participants = users;
        const savedChat = yield chatRepo.save(newChat);
        res.json({
            success: true,
            message: "Chat created successfully",
            data: savedChat,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createChat = createChat;
// Get All Chats for A User
const getChats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const chatRepo = database_1.default.getRepository(chats_1.Chat);
        const chats = yield chatRepo
            .createQueryBuilder("chat")
            .leftJoinAndSelect("chat.participants", "user")
            .where("chat.id IN (SELECT cp.chat_id FROM chat_participants cp WHERE cp.user_id = :userId)", { userId })
            .getMany();
        res.json({
            success: true,
            data: chats,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getChats = getChats;
// Get a single chat by ID
const getChat = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { chatId } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const chatRepo = database_1.default.getRepository(chats_1.Chat);
        const chat = yield chatRepo.findOne({
            where: { id: chatId },
            relations: ["participants", "messages", "messages.sender"], // Load sender relation
        });
        if (!chat) {
            throw new errorHandler_1.default("Chat not found", 404);
        }
        // Ensure the user is a participant of the chat
        if (!chat.participants.some((user) => user.id === userId)) {
            throw new errorHandler_1.default("You are not a participant of this chat", 403);
        }
        res.json({
            success: true,
            data: chat,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getChat = getChat;
// Delete A Chat
const deleteChat = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { chatId } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const chatRepo = database_1.default.getRepository(chats_1.Chat);
        const messageRepo = database_1.default.getRepository(messages_1.Message);
        // Find the chat with participants
        const chat = yield chatRepo.findOne({
            where: { id: chatId },
            relations: ["participants", "messages"],
        });
        if (!chat) {
            throw new errorHandler_1.default("Chat not found", 404);
        }
        // Ensure the user is a participant of the chat
        if (!chat.participants.some((user) => user.id === userId)) {
            throw new errorHandler_1.default("You are not a participant of this chat", 403);
        }
        // Delete all messages in the chat
        yield messageRepo.delete({ chat: { id: chatId } });
        // Delete the chat
        yield chatRepo.remove(chat);
        res.json({
            success: true,
            message: "Chat and its messages deleted successfully",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteChat = deleteChat;
