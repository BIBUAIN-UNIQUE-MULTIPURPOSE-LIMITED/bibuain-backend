"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authenticate_1 = require("../middlewares/authenticate");
const user_1 = require("../models/user");
const accountsController_1 = require("../controllers/accountsController");
const router = express_1.default.Router();
router.use(authenticate_1.authenticate);
// Create account Route
router.post("/create", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), accountsController_1.createAccount);
// Update Account Route
router.put("/update/:id", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), accountsController_1.updateAccount);
// Delete Account
router.delete("/delete/:id", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), accountsController_1.deleteAccount);
// Get All Accounts
router.get("/all", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), accountsController_1.getAllAccounts);
// Get Single Account
router.get("/single/:id", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), accountsController_1.getSingleAccount);
exports.default = router;
