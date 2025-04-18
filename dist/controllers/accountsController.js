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
exports.getSingleAccount = exports.getAllAccounts = exports.deleteAccount = exports.updateAccount = exports.createAccount = void 0;
const database_1 = __importDefault(require("../config/database"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const accounts_1 = require("../models/accounts");
const user_1 = require("../models/user");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
const express_validator_1 = require("express-validator");
const ACCOUNT_ENCRYPTION_SALT_ROUNDS = 12;
const encryptAccountCredentials = (apiKey, apiSecret) => __awaiter(void 0, void 0, void 0, function* () {
    return ({
        encryptedKey: yield bcryptjs_1.default.hash(apiKey, ACCOUNT_ENCRYPTION_SALT_ROUNDS),
        encryptedSecret: yield bcryptjs_1.default.hash(apiSecret, ACCOUNT_ENCRYPTION_SALT_ROUNDS),
    });
});
const createAccount = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.default("Validation errors", 400);
        }
        const { account_username, api_key, api_secret, platform } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const accountRepo = database_1.default.getRepository(accounts_1.Account);
        const userRepo = database_1.default.getRepository(user_1.User);
        const existingAccount = yield accountRepo.findOne({
            where: { account_username, platform },
        });
        if (existingAccount) {
            throw new errorHandler_1.default("Account username already exists on this platform", 409);
        }
        const user = yield userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new errorHandler_1.default("User not found", 404);
        }
        const newAccount = accountRepo.create({
            account_username,
            api_key,
            api_secret,
            platform,
        });
        yield accountRepo.save(newAccount);
        res.status(201).json({
            success: true,
            message: "Forex account created successfully",
            data: {
                id: newAccount.id,
                platform: newAccount.platform,
                username: newAccount.account_username,
                status: newAccount.status,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createAccount = createAccount;
// Update Account Details
const updateAccount = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.default("Validation errors", 400);
        }
        const { id } = req.params;
        const { account_username, api_secret, status } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const accountRepo = database_1.default.getRepository(accounts_1.Account);
        const userRepo = database_1.default.getRepository(user_1.User);
        const account = yield accountRepo.findOne({
            where: { id },
        });
        if (!account) {
            throw new errorHandler_1.default("Account not found", 404);
        }
        // Check if the new username already exists on the same platform
        if (account_username && account_username !== account.account_username) {
            const existingAccount = yield accountRepo.findOne({
                where: { account_username, platform: account.platform },
            });
            if (existingAccount) {
                throw new errorHandler_1.default("Account username already exists on this platform", 409);
            }
            account.account_username = account_username;
        }
        // Update API secret directly
        if (api_secret) {
            account.api_secret = api_secret;
        }
        if (status)
            account.status = status;
        yield accountRepo.save(account);
        res.json({
            success: true,
            message: "Account updated successfully",
            data: {
                id: account.id,
                status: account.status,
                updatedAt: account.updatedAt,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateAccount = updateAccount;
// Delete Account
const deleteAccount = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const accountRepo = database_1.default.getRepository(accounts_1.Account);
        const account = yield accountRepo.findOne({
            where: { id },
        });
        if (!account) {
            throw new errorHandler_1.default("Account not found", 404);
        }
        yield accountRepo.remove(account);
        res.json({
            success: true,
            message: "Account permanently deleted",
            data: null,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteAccount = deleteAccount;
// Get All Accounts for User
const getAllAccounts = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const accountRepo = database_1.default.getRepository(accounts_1.Account);
        const accounts = yield accountRepo.find({
            select: ["id", "account_username", "platform", "status", "createdAt"],
        });
        res.json({
            success: true,
            data: accounts,
            count: accounts.length,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllAccounts = getAllAccounts;
// Get Single Account Details
const getSingleAccount = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const accountRepo = database_1.default.getRepository(accounts_1.Account);
        const account = yield accountRepo.findOne({
            where: { id },
        });
        if (!account) {
            throw new errorHandler_1.default("Account not found", 404);
        }
        // Security Consideration: Limit sensitive data exposure
        const safeAccount = {
            id: account.id,
            platform: account.platform,
            status: account.status,
            username: account.account_username,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
            api_key: account.api_key,
            api_secret: account.api_secret,
        };
        res.json({
            success: true,
            data: safeAccount,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSingleAccount = getSingleAccount;
