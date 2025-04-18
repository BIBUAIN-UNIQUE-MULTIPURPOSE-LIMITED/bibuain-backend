"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bankController_1 = require("../controllers/bankController");
const authenticate_1 = require("../middlewares/authenticate");
const user_1 = require("../models/user");
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate);
// Rater Routes
router.post("/add", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN, user_1.UserType.RATER]), bankController_1.addBank);
router.get("/single/:id", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), bankController_1.getBankById);
router.get("/", (0, authenticate_1.roleAuth)([user_1.UserType.PAYER, user_1.UserType.ADMIN, user_1.UserType.RATER]), bankController_1.getAllBanks);
router.get("/free", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN, user_1.UserType.PAYER, user_1.UserType.RATER]), bankController_1.getFreeBanks);
router.get("/funded", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN, user_1.UserType.PAYER, user_1.UserType.RATER]), bankController_1.getFundedBanks);
router.put("/:id", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN, user_1.UserType.RATER]), bankController_1.updateBank);
router.delete("/:id", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), bankController_1.deleteBank);
exports.default = router;
