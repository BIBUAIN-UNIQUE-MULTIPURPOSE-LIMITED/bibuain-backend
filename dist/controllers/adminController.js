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
exports.getSingleUser = exports.getAllUsers = exports.deleteUser = exports.editUser = exports.validatePassword = exports.createUser = exports.createAdminUser = void 0;
const database_1 = __importDefault(require("../config/database"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const user_1 = require("../models/user");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
const mailService_1 = __importDefault(require("../services/mailService"));
const crypto_1 = __importDefault(require("crypto"));
const createAdminUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, fullName, phone } = req.body;
        if (!email || !password || !fullName) {
            throw new errorHandler_1.default("All fields are required", 400);
        }
        const userRepo = database_1.default.getRepository(user_1.User);
        const existingUser = yield userRepo.findOne({
            where: { email },
        });
        if (existingUser) {
            throw new errorHandler_1.default("Username or email already exists", 409);
        }
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const adminUser = userRepo.create({
            email,
            password: hashedPassword,
            fullName,
            phone,
            userType: user_1.UserType.ADMIN,
            isEmailVerified: true
        });
        yield userRepo.save(adminUser);
        res.status(201).json({
            success: true,
            message: "Admin user created successfully",
            data: {
                id: adminUser.id,
                email: adminUser.email,
                fullName: adminUser.fullName,
                phone: adminUser.phone,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createAdminUser = createAdminUser;
const createUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, userType, fullName, phone, password } = req.body;
        // Validate password
        if (!password) {
            throw new errorHandler_1.default("Password is required", 400);
        }
        // Password validation
        const passwordValidation = (0, exports.validatePassword)(password);
        if (!passwordValidation.isValid) {
            throw new errorHandler_1.default(passwordValidation.message, 400);
        }
        // Validate userType
        if (!Object.values(user_1.UserType).includes(userType)) {
            throw new errorHandler_1.default("Invalid userType provided", 400);
        }
        const userRepo = database_1.default.getRepository(user_1.User);
        // Check if email already exists
        const existingUserByEmail = yield userRepo.findOne({ where: { email } });
        if (existingUserByEmail) {
            throw new errorHandler_1.default("Email already exists", 409);
        }
        // Check if phone number already exists
        if (phone) {
            const existingUserByPhone = yield userRepo.findOne({ where: { phone } });
            if (existingUserByPhone) {
                throw new errorHandler_1.default("Phone number already exists", 409);
            }
        }
        // Hash password
        const saltRounds = 10;
        const hashedPassword = yield bcryptjs_1.default.hash(password, saltRounds);
        // Generate email verification code
        const emailVerificationCode = crypto_1.default.randomBytes(32).toString("hex");
        const emailVerificationExp = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiration
        // Create and save the new user
        const newUser = userRepo.create({
            email,
            userType,
            fullName,
            phone,
            password: hashedPassword,
            emailVerificationCode,
            emailVerificationExp,
        });
        yield userRepo.save(newUser);
        // Generate verification link
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const verificationLink = `${frontendUrl}/verify-account?code=${emailVerificationCode}`;
        // Send email notification with verification link
        yield (0, mailService_1.default)({
            to: email,
            subject: "Verify Your Account",
            html: `<p>Hi ${fullName},</p>
             <p>Thank you for registering on our platform. Please click the link below to verify your account:</p>
             <p><a href="${verificationLink}" target="_blank">Click Here to Setup your account</a></p>
             <p>This link is valid for 24 hours.</p>`,
        });
        // Respond with success (exclude password from response)
        return res.status(201).json({
            success: true,
            message: `Verification email sent to ${email}`,
            data: {
                id: newUser.id,
                email: newUser.email,
                fullName: newUser.fullName,
                userType: newUser.userType,
                phone: newUser.phone,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createUser = createUser;
const validatePassword = (password) => {
    if (password.length < 8) {
        return {
            isValid: false,
            message: "Password must be at least 8 characters long",
        };
    }
    // Must contain at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
        return {
            isValid: false,
            message: "Password must contain at least one uppercase letter",
        };
    }
    // Must contain at least one lowercase letter
    if (!/[a-z]/.test(password)) {
        return {
            isValid: false,
            message: "Password must contain at least one lowercase letter",
        };
    }
    // Must contain at least one number
    if (!/\d/.test(password)) {
        return {
            isValid: false,
            message: "Password must contain at least one number",
        };
    }
    // Must contain at least one special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        return {
            isValid: false,
            message: "Password must contain at least one special character",
        };
    }
    return {
        isValid: true,
        message: "Password is valid",
    };
};
exports.validatePassword = validatePassword;
// Edit a user for admin
const editUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { id } = req.params;
        const { email, fullName, phone, userType } = req.body;
        const currentUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!currentUserId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        if (((_b = req.user) === null || _b === void 0 ? void 0 : _b.userType) !== "admin") {
            throw new errorHandler_1.default("Access denied: Only admins can edit users", 403);
        }
        const userRepo = database_1.default.getRepository(user_1.User);
        // Find the user to edit
        const userToEdit = yield userRepo.findOne({ where: { id } });
        if (!userToEdit) {
            throw new errorHandler_1.default("User not found", 404);
        }
        // Update email
        if (email) {
            const existingUserByEmail = yield userRepo.findOne({ where: { email } });
            if (existingUserByEmail && existingUserByEmail.id !== userToEdit.id) {
                throw new errorHandler_1.default("Email already in use by another user", 409);
            }
            userToEdit.email = email;
        }
        // Update full name
        if (fullName) {
            userToEdit.fullName = fullName;
        }
        // Update phone
        if (phone) {
            const existingUserByPhone = yield userRepo.findOne({ where: { phone } });
            if (existingUserByPhone && existingUserByPhone.id !== userToEdit.id) {
                throw new errorHandler_1.default("Phone number already in use by another user", 409);
            }
            userToEdit.phone = phone;
        }
        // Update userType
        if (userType && Object.values(user_1.UserType).includes(userType)) {
            userToEdit.userType = userType;
        }
        else if (userType) {
            throw new errorHandler_1.default("Invalid userType provided", 400);
        }
        // Save updated user
        const updatedUser = yield userRepo.save(userToEdit);
        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: {
                id: updatedUser.id,
                email: updatedUser.email,
                fullName: updatedUser.fullName,
                phone: updatedUser.phone,
                userType: updatedUser.userType,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.editUser = editUser;
// Delete a user for admin
const deleteUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const userIdToDelete = req.params.id;
        const currentUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        if (!currentUserId) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        if (((_b = req.user) === null || _b === void 0 ? void 0 : _b.userType) !== "admin") {
            throw new errorHandler_1.default("Access denied: Only admins can delete users", 403);
        }
        const userRepo = database_1.default.getRepository(user_1.User);
        const userToDelete = yield userRepo.findOne({
            where: { id: userIdToDelete },
        });
        if (!userToDelete) {
            throw new errorHandler_1.default("User not found", 404);
        }
        if (userToDelete.id === currentUserId) {
            throw new errorHandler_1.default("Admins cannot delete their own account", 400);
        }
        // Delete the user
        yield userRepo.remove(userToDelete);
        res.status(200).json({
            success: true,
            message: `User  deleted successfully`,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteUser = deleteUser;
// Get All User for Admin
const getAllUsers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userType, email, fullName, status, clockedIn } = req.query;
        const userRepo = database_1.default.getRepository(user_1.User);
        const query = userRepo.createQueryBuilder("user");
        if (userType) {
            query.andWhere("user.userType = :userType", { userType });
        }
        if (email) {
            query.andWhere("user.email LIKE :email", { email: `%${email}%` });
        }
        if (fullName) {
            query.andWhere("user.fullName LIKE :fullName", {
                fullName: `%${fullName}%`,
            });
        }
        if (status) {
            query.andWhere("user.status = :status", { status });
        }
        if (clockedIn) {
            // Convert string 'true'/'false' to boolean
            const isClockedIn = clockedIn === 'true';
            query.andWhere("user.clockedIn = :clockedIn", { clockedIn: isClockedIn });
        }
        const users = yield query.getMany();
        res.status(200).json({
            success: true,
            message: "Users retrieved successfully",
            data: users,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllUsers = getAllUsers;
// Get Single User for Admin
const getSingleUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const userRepo = database_1.default.getRepository(user_1.User);
        const user = yield userRepo.findOne({ where: { id } });
        if (!user) {
            throw new errorHandler_1.default("User not found", 404);
        }
        res.status(200).json({
            success: true,
            message: "User retrieved successfully",
            data: user,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSingleUser = getSingleUser;
