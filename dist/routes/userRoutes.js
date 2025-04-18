"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const AuthController_1 = require("../controllers/AuthController");
const authenticate_1 = require("../middlewares/authenticate");
const validateRequest_1 = __importDefault(require("../middlewares/validateRequest"));
const adminController_1 = require("../controllers/adminController");
const multer_1 = require("../config/multer");
const router = (0, express_1.Router)();
router.post("/login", [
    (0, express_validator_1.body)("email").isEmail().withMessage("Please provide a valid email"),
    (0, express_validator_1.body)("password")
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters"),
], validateRequest_1.default, AuthController_1.login);
// router.put("/clock-status", updateClockStatus);
router.get("/me", authenticate_1.authenticate, AuthController_1.getCurrentUser);
router.get("/logout", authenticate_1.authenticate, AuthController_1.logout);
router.post("/enable-2fa", authenticate_1.authenticate, AuthController_1.enableTwoFa);
router.post("/verify-2fa", [(0, express_validator_1.body)("twoFaCode").notEmpty().withMessage("2FA code is required")], AuthController_1.verifyTwoFa);
router.post("/forget-password", AuthController_1.forgotPassword);
router.post("/verify-email", [(0, express_validator_1.body)("code").notEmpty().withMessage("Verification code is required")], AuthController_1.verifyEmail);
router.post("/reset-password", [
    (0, express_validator_1.body)("token").notEmpty().withMessage("Reset token is required"),
    (0, express_validator_1.body)("newPassword")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters"),
], AuthController_1.resetPassword);
router.get("/", adminController_1.getAllUsers);
// Get a single user by ID
router.get("/:id", [(0, express_validator_1.param)("id").isUUID().withMessage("Invalid user ID. It must be a UUID")], validateRequest_1.default, adminController_1.getSingleUser);
router.put("/update", authenticate_1.authenticate, multer_1.uploadSingleFile, AuthController_1.editUserDetails);
router.put("/change-password", authenticate_1.authenticate, AuthController_1.changePassword);
exports.default = router;
