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
exports.resetPassword = exports.forgotPassword = exports.changePassword = exports.editUserDetails = exports.requestPasswordReset = exports.requestEmailVerification = exports.verifyEmail = exports.enableTwoFa = exports.getCurrentUser = exports.logout = exports.verifyTwoFa = exports.login = void 0;
const user_1 = require("../models/user");
const database_1 = __importDefault(require("../config/database"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const speakeasy_1 = __importDefault(require("speakeasy"));
const uuid_1 = require("uuid");
const express_validator_1 = require("express-validator");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const fs_1 = __importDefault(require("fs"));
const mailService_1 = __importDefault(require("../services/mailService"));
const crypto_1 = __importDefault(require("crypto"));
const activityLogs_1 = require("../models/activityLogs");
const server_1 = require("../server");
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const TOKEN_EXPIRATION = "1d";
const setTokenCookie = (res, token) => {
    res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 24 * 60 * 60 * 1000 * 10,
    });
};
const createLog = (user, activity, description, details) => __awaiter(void 0, void 0, void 0, function* () {
    if (user === null) {
        return;
    }
    const activityLogRepo = database_1.default.getRepository(activityLogs_1.ActivityLog);
    const log = activityLogRepo.create({
        user: user,
        userRole: user === null || user === void 0 ? void 0 : user.userType,
        activity,
        description,
        details,
        isSystemGenerated: !user,
    });
    yield activityLogRepo.save(log);
});
const login = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.default("Validation errors", 400);
        }
        const { email, password } = req.body;
        const userRepo = database_1.default.getRepository(user_1.User);
        const user = yield userRepo.findOne({ where: { email } });
        if (!user || !(yield bcryptjs_1.default.compare(password, user.password))) {
            yield createLog(null, activityLogs_1.ActivityType.USER_LOGIN, "Failed login attempt", {
                email,
                reason: "Invalid credentials",
            });
            return next(new errorHandler_1.default("Invalid credentials", 401));
        }
        if (user.status !== "active") {
            yield createLog(user, activityLogs_1.ActivityType.USER_LOGIN, "Login attempted on inactive account", { status: user.status });
            throw new errorHandler_1.default("User account is not active", 403);
        }
        // Generate a 6-digit 2FA code
        const twoFaCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.twoFaCode = twoFaCode;
        user.twoFaExpires = new Date(Date.now() + 10 * 60 * 1000);
        yield userRepo.save(user);
        const mailOptions = {
            from: "Bibuain Crypto <no-reply@bibuain.crypto>",
            to: user.email,
            subject: "Your 2FA Code",
            text: `Your 2FA code is: ${twoFaCode}. This code will expire in 10 minutes.`,
        };
        yield (0, mailService_1.default)(mailOptions);
        yield createLog(user, activityLogs_1.ActivityType.USER_LOGIN, "2FA code sent for login", {
            email: user.email,
        });
        res.json({
            success: true,
            message: `2FA code sent to ${user.email}. Please verify.`,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.login = login;
const verifyTwoFa = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, twoFaCode } = req.body;
        const userRepo = database_1.default.getRepository(user_1.User);
        const user = yield userRepo.findOne({ where: { email } });
        if (!user || !user.twoFaCode || !user.twoFaExpires) {
            yield createLog(null, activityLogs_1.ActivityType.USER_LOGIN, "Failed 2FA verification", { email, reason: "2FA not initiated or user not found" });
            throw new errorHandler_1.default("2FA not initiated or user not found", 404);
        }
        if (new Date() > user.twoFaExpires || user.twoFaCode !== twoFaCode) {
            yield createLog(user, activityLogs_1.ActivityType.USER_LOGIN, "Invalid 2FA attempt", { email: user.email });
            throw new errorHandler_1.default("Invalid or expired 2FA code", 401);
        }
        user.twoFaCode = undefined;
        user.twoFaExpires = undefined;
        yield userRepo.save(user);
        const token = jsonwebtoken_1.default.sign({ id: user.id, userType: user.userType }, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
        setTokenCookie(res, token);
        yield createLog(user, activityLogs_1.ActivityType.USER_LOGIN, "User logged in successfully", {
            email: user.email,
            userType: user.userType,
            loginTime: new Date().toISOString(),
        });
        res.json({
            success: true,
            message: "2FA verified and login successful",
            data: user,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.verifyTwoFa = verifyTwoFa;
const logout = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) {
            const userRepo = database_1.default.getRepository(user_1.User);
            const user = yield userRepo.findOne({ where: { id: req.user.id } });
            if (user) {
                // Update clockedIn to false on logout
                user.clockedIn = false;
                yield userRepo.save(user);
                yield createLog(user, activityLogs_1.ActivityType.USER_LOGOUT, "User logged out successfully", {
                    email: user.email,
                    logoutTime: new Date().toISOString(),
                });
                server_1.io.emit("userStatusUpdate", { userId: user.id, status: "offline" });
            }
        }
        res.clearCookie("token");
        res.json({ success: true, message: "Logged out successfully" });
    }
    catch (error) {
        next(error);
    }
});
exports.logout = logout;
const getCurrentUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const userRepo = database_1.default.getRepository(user_1.User);
        const user = yield userRepo.findOne({ where: { id: userId } });
        // if (!user || !user.isEmailVerified) {
        if (!user) {
            return next(new errorHandler_1.default("Invalid email! Please try again.", 401));
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, userType: user.userType }, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
        setTokenCookie(res, token);
        res.json({
            success: true,
            data: user,
            message: `Welcome Back, ${user.fullName}`,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getCurrentUser = getCurrentUser;
const enableTwoFa = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("User ID is required", 400);
        }
        const userRepo = database_1.default.getRepository(user_1.User);
        const user = yield userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new errorHandler_1.default("User not found", 404);
        }
        const secret = speakeasy_1.default.generateSecret({
            name: `YourApp (${user.email})`,
        });
        user.twoFaSecret = secret.base32;
        yield userRepo.save(user);
        res.json({
            success: true,
            message: "2FA enabled successfully",
            data: { otpauthUrl: secret.otpauth_url },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.enableTwoFa = enableTwoFa;
const verifyEmail = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { code, password } = req.body;
        // Validate input
        if (!code || typeof code !== "string") {
            throw new errorHandler_1.default("Verification code is required and must be a string", 400);
        }
        if (!password || typeof password !== "string" || password.length < 8) {
            throw new errorHandler_1.default("Password is required and must be at least 8 characters long", 400);
        }
        const userRepo = database_1.default.getRepository(user_1.User);
        const user = yield userRepo.findOne({
            where: { emailVerificationCode: code },
        });
        if (!user) {
            throw new errorHandler_1.default("Invalid or expired verification code", 400);
        }
        if (user.emailVerificationExp && user.emailVerificationExp < new Date()) {
            throw new errorHandler_1.default("Verification code has expired", 400);
        }
        // Hash the password before saving
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        // Update user record
        user.emailVerificationCode = null;
        user.emailVerificationExp = null;
        user.isEmailVerified = true;
        user.password = hashedPassword;
        yield userRepo.save(user);
        yield createLog(user, activityLogs_1.ActivityType.EMAIL_VERIFICATION, "Verified Email Successfully", {
            email: user.email,
            verificationTime: new Date().toISOString(),
        });
        res.status(200).json({
            success: true,
            message: "Email verified and password set successfully",
            data: {
                userId: user.id,
                email: user.email,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.verifyEmail = verifyEmail;
const requestEmailVerification = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("User ID is required", 400);
        }
        const userRepo = database_1.default.getRepository(user_1.User);
        const user = yield userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new errorHandler_1.default("User not found", 404);
        }
        const code = (0, uuid_1.v4)().slice(0, 6).toUpperCase();
        user.emailVerificationCode = code;
        user.emailVerificationExp = new Date(Date.now() + 60 * 60 * 1000);
        yield userRepo.save(user);
        yield createLog(user, activityLogs_1.ActivityType.EMAIL_VERIFICATION_REQUEST, "Email verification requested", {
            email: user.email,
            requestTime: new Date().toISOString(),
        });
        res.json({
            success: true,
            message: "Email verification code sent",
            data: { code },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.requestEmailVerification = requestEmailVerification;
const requestPasswordReset = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        const userRepo = database_1.default.getRepository(user_1.User);
        const user = yield userRepo.findOne({ where: { email } });
        if (!user) {
            throw new errorHandler_1.default("User not found", 404);
        }
        const resetToken = (0, uuid_1.v4)();
        user.resetPasswordToken = resetToken;
        user.resetPasswordExp = new Date(Date.now() + 60 * 60 * 1000);
        yield userRepo.save(user);
        yield createLog(user, activityLogs_1.ActivityType.PASSWORD_RESET_REQUEST, "Password reset requested", {
            email: user.email,
            requestTime: new Date().toISOString(),
        });
        res.json({
            success: true,
            message: "Password reset email sent",
            data: { resetToken },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.requestPasswordReset = requestPasswordReset;
// Controller for editing user details
const editUserDetails = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.default("Validation errors", 400);
        }
        const { fullName } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const userRepo = database_1.default.getRepository(user_1.User);
        const user = yield userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new errorHandler_1.default("User not found", 404);
        }
        if (req.file) {
            if (!fs_1.default.existsSync(req.file.path)) {
                return next(new errorHandler_1.default("File not found", 404));
            }
            const result = yield cloudinary_1.default.uploader.upload(req.file.path, {
                upload_preset: "ml_default",
            });
            fs_1.default.unlinkSync(req.file.path);
            user.avatar = result.secure_url;
        }
        user.fullName = fullName || user.fullName;
        yield userRepo.save(user);
        const originalDetails = {
            fullName: user.fullName,
            avatar: user.avatar,
        };
        yield createLog(user, activityLogs_1.ActivityType.USER_PROFILE_UPDATE, "User profile updated", {
            userId: user.id,
            changes: {
                fullName: fullName !== originalDetails.fullName
                    ? {
                        from: originalDetails.fullName,
                        to: fullName,
                    }
                    : undefined,
                avatar: user.avatar !== originalDetails.avatar
                    ? {
                        from: originalDetails.avatar,
                        to: user.avatar,
                    }
                    : undefined,
            },
        });
        res.json({
            success: true,
            message: "User details updated successfully",
            data: user,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.editUserDetails = editUserDetails;
// Controller for Changing User Password
const changePassword = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw new errorHandler_1.default("Validation errors", 400);
        }
        const { currentPassword, newPassword } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!userId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        const userRepo = database_1.default.getRepository(user_1.User);
        const user = yield userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new errorHandler_1.default("User not found", 404);
        }
        const isPasswordValid = yield bcryptjs_1.default.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            throw new errorHandler_1.default("Current password is incorrect", 401);
        }
        user.password = yield bcryptjs_1.default.hash(newPassword, 12);
        yield userRepo.save(user);
        yield createLog(user, activityLogs_1.ActivityType.PASSWORD_CHANGE, "Password changed successfully", {
            userId: user.id,
            changeTime: new Date().toISOString(),
        });
        res.json({
            success: true,
            message: "Password changed successfully",
            data: null,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.changePassword = changePassword;
// Forget Password Controller
const forgotPassword = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        if (!email) {
            throw new errorHandler_1.default("Email is required", 400);
        }
        const userRepo = database_1.default.getRepository(user_1.User);
        const user = yield userRepo.findOne({ where: { email } });
        if (!user) {
            throw new errorHandler_1.default("User with this email does not exist", 404);
        }
        // Generate reset code and expiration
        const resetCode = crypto_1.default.randomBytes(32).toString("hex");
        const resetCodeExp = new Date(Date.now() + 30 * 60 * 1000);
        // Update user with reset code and expiration
        user.emailVerificationCode = resetCode;
        user.emailVerificationExp = resetCodeExp;
        yield userRepo.save(user);
        // Send email with reset link
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const resetLink = `${frontendUrl}/reset-password?code=${resetCode}`;
        yield (0, mailService_1.default)({
            to: email,
            subject: "Password Reset Request",
            html: `<p>Hi ${user.fullName},</p>
             <p>You requested to reset your password. Click the link below to reset it:</p>
             <p><a href="${resetLink}" target="_blank">Reset Password</a></p>
             <p>This link is valid for 30 minutes.</p>`,
        });
        yield createLog(user, activityLogs_1.ActivityType.PASSWORD_RESET_REQUEST, "Forgot password request initiated", {
            email: user.email,
            requestTime: new Date().toISOString(),
        });
        res.status(200).json({
            success: true,
            message: `Password reset email sent to ${email}`,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.forgotPassword = forgotPassword;
// Reset Password
const resetPassword = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { newPassword, confirmNewPassword, code } = req.body;
        if (!newPassword || !confirmNewPassword || !code) {
            throw new errorHandler_1.default("All fields are required", 400);
        }
        if (newPassword !== confirmNewPassword) {
            throw new errorHandler_1.default("Passwords do not match", 400);
        }
        const userRepo = database_1.default.getRepository(user_1.User);
        const user = yield userRepo.findOne({
            where: { emailVerificationCode: code },
        });
        if (!user) {
            throw new errorHandler_1.default("Invalid or expired reset code", 400);
        }
        if (!user.emailVerificationExp || user.emailVerificationExp < new Date()) {
            throw new errorHandler_1.default("Reset code has expired", 400);
        }
        // Hash the new password
        const hashedPassword = yield bcryptjs_1.default.hash(newPassword, 10);
        // Update user password and clear reset code/expiration
        user.password = hashedPassword;
        user.emailVerificationCode = null;
        user.emailVerificationExp = null;
        yield userRepo.save(user);
        yield createLog(user, activityLogs_1.ActivityType.PASSWORD_RESET, "Password reset successfully", {
            userId: user.id,
            resetTime: new Date().toISOString(),
        });
        res.status(200).json({
            success: true,
            message: "Password reset successfully",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.resetPassword = resetPassword;
