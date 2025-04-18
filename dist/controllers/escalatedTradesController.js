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
exports.escalateTrade = escalateTrade;
exports.deleteTrade = deleteTrade;
exports.getAllTrades = getAllTrades;
exports.getTradeById = getTradeById;
exports.updateTrade = updateTrade;
const database_1 = __importDefault(require("../config/database"));
const escalatedTrades_1 = require("../models/escalatedTrades");
const user_1 = require("../models/user");
const chats_1 = require("../models/chats");
const trades_1 = require("../models/trades");
const express_validator_1 = require("express-validator");
const paxful_1 = require("../config/paxful");
const noones_1 = require("../config/noones");
const accounts_1 = require("../models/accounts");
function escalateTrade(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { tradeId, escalatedById, assignedPayerId, complaint, tradeHash, platform, amount, } = req.body;
        console.log(req.body);
        try {
            const tradeRepo = database_1.default.getRepository(trades_1.Trade);
            const trade = yield tradeRepo.findOne({ where: { id: tradeId } });
            if (!complaint || !tradeId || !tradeHash) {
                return res.status(400).json({ message: "In complete details" });
            }
            if (!trade) {
                return res.status(404).json({ message: "Trade not found." });
            }
            const escalatedTradeRepo = database_1.default.getRepository(escalatedTrades_1.EscalatedTrade);
            const existingEscalation = yield escalatedTradeRepo.findOne({
                where: { trade: { id: tradeId } },
            });
            if (existingEscalation) {
                return res
                    .status(400)
                    .json({ message: "This trade is already escalated." });
            }
            const userRepo = database_1.default.getRepository(user_1.User);
            const ccUser = yield userRepo.findOne({ where: { userType: user_1.UserType.CC } });
            const payer = yield userRepo.findOne({ where: { id: assignedPayerId } });
            const escalatedBy = yield userRepo.findOne({
                where: { id: escalatedById },
            });
            if (!ccUser || !payer || !escalatedBy) {
                return res
                    .status(404)
                    .json({ message: "Invalid user details provided." });
            }
            const newEscalation = escalatedTradeRepo.create({
                trade,
                assignedCcAgent: ccUser,
                assignedPayer: payer,
                escalatedBy,
                amount,
                platform,
            });
            yield escalatedTradeRepo.save(newEscalation);
            return res.status(201).json({
                data: newEscalation,
                message: "Trade escalated successfully.",
                success: true,
            });
        }
        catch (error) {
            console.error("Error escalating trade:", error);
            return res.status(500).json({ message: "Internal server error." });
        }
    });
}
function deleteTrade(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        try {
            const tradeRepo = database_1.default.getRepository(escalatedTrades_1.EscalatedTrade);
            const trade = yield tradeRepo.findOne({
                where: { id },
                relations: ["chat"],
            });
            if (!trade) {
                return res.status(404).json({ message: "Trade not found." });
            }
            if (trade.chat) {
                const chatRepo = database_1.default.getRepository(chats_1.Chat);
                yield chatRepo.remove(trade.chat);
            }
            yield tradeRepo.remove(trade);
            return res
                .status(200)
                .json({ message: "Trade and associated data deleted successfully." });
        }
        catch (error) {
            console.error("Error deleting trade:", error);
            return res.status(500).json({ message: "Internal server error." });
        }
    });
}
function getAllTrades(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { status } = req.query;
        try {
            const tradeRepo = database_1.default.getRepository(escalatedTrades_1.EscalatedTrade);
            const query = tradeRepo
                .createQueryBuilder("trade")
                .leftJoinAndSelect("trade.chat", "chat")
                .leftJoinAndSelect("trade.trade", "trade")
                .leftJoinAndSelect("trade.assignedPayer", "payer")
                .leftJoinAndSelect("trade.escalatedBy", "escalatedBy");
            let trades;
            if (status && Object.values(escalatedTrades_1.TradeStatus).includes(status)) {
                query.andWhere("trade.status = :status", { status });
                trades = yield query.getMany();
            }
            else {
                trades = yield tradeRepo.find({
                    relations: ["trade", "chat", "assignedPayer", "escalatedBy"],
                });
            }
            return res.status(200).json({ data: trades.reverse(), success: true });
        }
        catch (error) {
            console.error("Error fetching trades:", error);
            return res.status(500).json({ message: "Internal server error." });
        }
    });
}
function getTradeById(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { id } = req.params;
        try {
            const tradeRepo = database_1.default.getRepository(escalatedTrades_1.EscalatedTrade);
            const accountRepo = database_1.default.getRepository(accounts_1.Account);
            const trade = yield tradeRepo.findOne({
                where: { id },
                relations: [
                    "chat",
                    "chat.messages",
                    "chat.messages.sender",
                    "assignedCcAgent",
                    "assignedPayer",
                    "escalatedBy",
                    "trade",
                ],
            });
            if (!trade) {
                return res.status(404).json({ message: "Trade not found." });
            }
            // Fetch the account associated with the trade
            const account = yield accountRepo.findOne({
                where: {
                    account_username: (_a = trade.trade.platformMetadata) === null || _a === void 0 ? void 0 : _a.accountUsername,
                },
            });
            if (!account) {
                return res
                    .status(404)
                    .json({ message: "Account not found for this trade." });
            }
            let service;
            switch (account.platform) {
                case "noones": {
                    service = new noones_1.NoonesService({
                        apiKey: account.api_key,
                        apiSecret: account.api_secret,
                    });
                    break;
                }
                case "paxful": {
                    service = new paxful_1.PaxfulService({
                        clientId: account.api_key,
                        clientSecret: account.api_secret,
                    });
                    break;
                }
                default: {
                    return res.status(400).json({ message: "Unsupported platform." });
                }
            }
            const tradeHash = trade.trade.tradeHash;
            const { messages, attachments } = yield service.getTradeChat(tradeHash);
            return res
                .status(200)
                .json({
                success: true,
                data: { trade, tradeChat: messages, attachments },
            });
        }
        catch (error) {
            console.error("Error fetching trade by ID:", error);
            return res.status(500).json({ message: "Internal server error." });
        }
    });
}
function updateTrade(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { id } = req.params;
        const updateData = req.body;
        try {
            const tradeRepo = database_1.default.getRepository(escalatedTrades_1.EscalatedTrade);
            const trade = yield tradeRepo.findOne({ where: { id } });
            if (!trade) {
                return res.status(404).json({ message: "Trade not found." });
            }
            Object.assign(trade, updateData);
            yield tradeRepo.save(trade);
            return res.status(200).json(trade);
        }
        catch (error) {
            console.error("Error updating trade:", error);
            return res.status(500).json({ message: "Internal server error." });
        }
    });
}
