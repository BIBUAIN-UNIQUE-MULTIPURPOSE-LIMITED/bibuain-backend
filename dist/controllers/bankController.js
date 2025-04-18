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
exports.getBankById = exports.reloadFreeBanks = exports.deleteBank = exports.updateBank = exports.getBanksInUse = exports.getFundedBanks = exports.getFreeBanks = exports.getAllBanks = exports.addBank = void 0;
const database_1 = __importDefault(require("../config/database"));
const bank_1 = require("../models/bank");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
// Add a new bank (Raters only)
const addBank = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { bankName, accountName, accountNumber, funds, additionalNotes } = req.body;
        // Validation
        if (!bankName || !accountName || !accountNumber) {
            throw new errorHandler_1.default("All fields (Bank Name, Account Name, Account Number, Serial Number) are required.", 400);
        }
        if (accountNumber.length < 10 || accountNumber.length > 20) {
            throw new errorHandler_1.default("Account Number must be between 10 and 20 characters.", 400);
        }
        const bankRepo = database_1.default.getRepository(bank_1.Bank);
        const newBank = bankRepo.create({
            bankName,
            accountName,
            accountNumber,
            additionalNotes,
            funds: funds || 0,
        });
        yield bankRepo.save(newBank);
        res.status(201).json({
            success: true,
            message: "Bank added successfully.",
            data: newBank,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.addBank = addBank;
// Fetch all banks (Admin/Raters View)
const getAllBanks = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const bankRepo = database_1.default.getRepository(bank_1.Bank);
        const banks = yield bankRepo.find();
        res.status(200).json({
            success: true,
            data: banks,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllBanks = getAllBanks;
// Fetch free banks (Banks with 0 balance)
const getFreeBanks = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const bankRepo = database_1.default.getRepository(bank_1.Bank);
        const freeBanks = yield bankRepo.find({ where: { funds: 0 } });
        res.status(200).json({
            success: true,
            data: freeBanks,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getFreeBanks = getFreeBanks;
// Fetch funded banks (Banks with funds > 0)
const getFundedBanks = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const bankRepo = database_1.default.getRepository(bank_1.Bank);
        const fundedBanks = yield bankRepo
            .createQueryBuilder("bank")
            .where("bank.funds > :funds", { funds: 0 })
            .getMany();
        res.status(200).json({
            success: true,
            data: fundedBanks,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getFundedBanks = getFundedBanks;
// Fetch banks in use (Payers View - Only funded banks available for transactions)
const getBanksInUse = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const bankRepo = database_1.default.getRepository(bank_1.Bank);
        const banksInUse = yield bankRepo
            .createQueryBuilder("bank")
            .where("bank.funds > :funds", { funds: 0 })
            .getMany();
        res.status(200).json({
            success: true,
            data: banksInUse,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getBanksInUse = getBanksInUse;
// Update bank details (Raters only)
const updateBank = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { bankName, accountName, accountNumber, additionalNotes, funds } = req.body;
        const bankRepo = database_1.default.getRepository(bank_1.Bank);
        const bank = yield bankRepo.findOne({ where: { id } });
        if (!bank) {
            throw new errorHandler_1.default("Bank not found.", 404);
        }
        // Update fields
        bank.bankName = bankName || bank.bankName;
        bank.accountName = accountName || bank.accountName;
        bank.accountNumber = accountNumber || bank.accountNumber;
        bank.additionalNotes = additionalNotes || bank.additionalNotes;
        bank.funds = funds !== undefined ? funds : bank.funds;
        // Save updates
        yield bankRepo.save(bank);
        res.status(200).json({
            success: true,
            message: "Bank updated successfully.",
            data: bank,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateBank = updateBank;
// Delete a bank (Raters only)
const deleteBank = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const bankRepo = database_1.default.getRepository(bank_1.Bank);
        const bank = yield bankRepo.findOne({ where: { id } });
        if (!bank) {
            throw new errorHandler_1.default("Bank not found.", 404);
        }
        // Delete bank
        yield bankRepo.remove(bank);
        res.status(200).json({
            success: true,
            message: "Bank deleted successfully.",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteBank = deleteBank;
// Automatically reload free banks at 1 AM daily (Scheduler logic)
const reloadFreeBanks = () => __awaiter(void 0, void 0, void 0, function* () {
    const bankRepo = database_1.default.getRepository(bank_1.Bank);
    try {
        // Update all banks with 0 funds to the default reload limit
        const reloadLimit = 1000; // Example limit for reloading
        yield bankRepo
            .createQueryBuilder()
            .update(bank_1.Bank)
            .set({ funds: reloadLimit })
            .where("funds = :funds", { funds: 0 })
            .execute();
        // console.log("Free banks reloaded successfully.");
    }
    catch (error) {
        console.error("Error reloading free banks:", error);
    }
});
exports.reloadFreeBanks = reloadFreeBanks;
const getBankById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const bankRepo = database_1.default.getRepository(bank_1.Bank);
        const bank = yield bankRepo.findOne({ where: { id } });
        if (!bank) {
            throw new errorHandler_1.default("Bank not found.", 404);
        }
        res.status(200).json({
            success: true,
            data: bank,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getBankById = getBankById;
