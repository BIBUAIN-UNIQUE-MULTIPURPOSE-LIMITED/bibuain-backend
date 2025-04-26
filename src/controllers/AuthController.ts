import { Request, Response, NextFunction, RequestHandler } from "express";
import { User } from "../models/user";
import dbConnect from "../config/database";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import { v4 as uuidv4 } from "uuid";
import { validationResult } from "express-validator";
import { UserRequest } from "../middlewares/authenticate";
import ErrorHandler from "../utils/errorHandler";
import cloudinary from "../config/cloudinary";
import fs from "fs";
import sendEmail from "../services/mailService";
import crypto from "crypto";
import { ActivityLog, ActivityType } from "../models/activityLogs";
import { io } from "../server";


const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const TOKEN_EXPIRATION = "1d";

const setTokenCookie = (res: Response, token: string) => {
  res.cookie("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 24 * 60 * 60 * 1000 * 10,
    path: "/"
  });
};
const createLog = async (
  user: User | null,
  activity: ActivityType,
  description: string,
  details?: Record<string, any>
) => {
  if (user === null) {
    return;
  }
  const activityLogRepo = dbConnect.getRepository(ActivityLog);
  const log = activityLogRepo.create({
    user: user,
    userRole: user?.userType,
    activity,
    description,
    details,
    isSystemGenerated: !user,
  });
  await activityLogRepo.save(log);
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ErrorHandler("Validation errors", 400);
    }

    const { email, password } = req.body;
    const userRepo = dbConnect.getRepository(User);
    const user = await userRepo.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      await createLog(null, ActivityType.USER_LOGIN, "Failed login attempt", {
        email,
        reason: "Invalid credentials",
      });
      return next(new ErrorHandler("Invalid credentials", 401));
    }

    if (user.status !== "active") {
      await createLog(
        user,
        ActivityType.USER_LOGIN,
        "Login attempted on inactive account",
        { status: user.status }
      );
      throw new ErrorHandler("User account is not active", 403);
    }

    // Generate a 6-digit 2FA code
    const twoFaCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.twoFaCode = twoFaCode;
    user.twoFaExpires = new Date(Date.now() + 10 * 60 * 1000);
    await userRepo.save(user);

    const mailOptions = {
      from: "Bibuain Crypto <no-reply@bibuain.crypto>",
      to: user.email,
      subject: "Your 2FA Code",
      text: `Your 2FA code is: ${twoFaCode}. This code will expire in 10 minutes.`,
    };
    await sendEmail(mailOptions);

    await createLog(user, ActivityType.USER_LOGIN, "2FA code sent for login", {
      email: user.email,
    });

    res.json({
      success: true,
      message: `2FA code sent to ${user.email}. Please verify.`,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyTwoFa: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, twoFaCode } = req.body;
    const userRepo = dbConnect.getRepository(User);
    const user = await userRepo.findOne({ where: { email } });
    if (!user || !user.twoFaCode || !user.twoFaExpires) {
      await createLog(null, ActivityType.USER_LOGIN, "Failed 2FA verification", { email, reason: "2FA not initiated or user not found" });
      throw new ErrorHandler("2FA not initiated or user not found", 404);
    }
    if (new Date() > user.twoFaExpires || user.twoFaCode !== twoFaCode) {
      await createLog(user, ActivityType.USER_LOGIN, "Invalid 2FA attempt", { email: user.email });
      throw new ErrorHandler("Invalid or expired 2FA code", 401);
    }

    user.twoFaCode = undefined;
    user.twoFaExpires = undefined;
    await userRepo.save(user);

    const token = jwt.sign({ id: user.id, userType: user.userType }, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
    setTokenCookie(res, token);

    await createLog(user, ActivityType.USER_LOGIN, "User logged in successfully", {
      email: user.email,
      userType: user.userType,
      loginTime: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "2FA verified and login successful",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};


export const logout = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.id) {
      const userRepo = dbConnect.getRepository(User);
      const user = await userRepo.findOne({ where: { id: req.user.id } });
      if (user) {
        // Update clockedIn to false on logout
        user.clockedIn = false;
        await userRepo.save(user);

        await createLog(user, ActivityType.USER_LOGOUT, "User logged out successfully", {
          email: user.email,
          logoutTime: new Date().toISOString(),
        });
        io.emit("userStatusUpdate", { userId: user.id, status: "offline" });
      }
    }
    res.clearCookie("token");
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};


export const getCurrentUser = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const userRepo = dbConnect.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });

    // if (!user || !user.isEmailVerified) {
    if (!user) {
      return next(new ErrorHandler("Invalid email! Please try again.", 401));
    }
    const token = jwt.sign(
      { id: user.id, userType: user.userType },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRATION }
    );

    setTokenCookie(res, token);
    res.json({
      success: true,
      data: user,
      message: `Welcome Back, ${user.fullName}`,
    });
  } catch (error) {
    next(error);
  }
};

export const enableTwoFa: RequestHandler = async (
  req: UserRequest,
  res,
  next
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ErrorHandler("User ID is required", 400);
    }

    const userRepo = dbConnect.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    const secret = speakeasy.generateSecret({
      name: `YourApp (${user.email})`,
    });
    user.twoFaSecret = secret.base32;
    await userRepo.save(user);

    res.json({
      success: true,
      message: "2FA enabled successfully",
      data: { otpauthUrl: secret.otpauth_url },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail: RequestHandler = async (req, res, next) => {
  try {
    const { code, password } = req.body;

    // Validate input
    if (!code || typeof code !== "string") {
      throw new ErrorHandler(
        "Verification code is required and must be a string",
        400
      );
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      throw new ErrorHandler(
        "Password is required and must be at least 8 characters long",
        400
      );
    }

    const userRepo = dbConnect.getRepository(User);

    const user = await userRepo.findOne({
      where: { emailVerificationCode: code },
    });

    if (!user) {
      throw new ErrorHandler("Invalid or expired verification code", 400);
    }

    if (user.emailVerificationExp && user.emailVerificationExp < new Date()) {
      throw new ErrorHandler("Verification code has expired", 400);
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user record
    user.emailVerificationCode = null;
    user.emailVerificationExp = null;
    user.isEmailVerified = true;
    user.password = hashedPassword;

    await userRepo.save(user);

    await createLog(
      user,
      ActivityType.EMAIL_VERIFICATION,
      "Verified Email Successfully",
      {
        email: user.email,
        verificationTime: new Date().toISOString(),
      }
    );

    res.status(200).json({
      success: true,
      message: "Email verified and password set successfully",
      data: {
        userId: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const requestEmailVerification: RequestHandler = async (
  req: UserRequest,
  res,
  next
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ErrorHandler("User ID is required", 400);
    }

    const userRepo = dbConnect.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    const code = uuidv4().slice(0, 6).toUpperCase();
    user.emailVerificationCode = code;
    user.emailVerificationExp = new Date(Date.now() + 60 * 60 * 1000);
    await userRepo.save(user);

    await createLog(
      user,
      ActivityType.EMAIL_VERIFICATION_REQUEST,
      "Email verification requested",
      {
        email: user.email,
        requestTime: new Date().toISOString(),
      }
    );

    res.json({
      success: true,
      message: "Email verification code sent",
      data: { code },
    });
  } catch (error) {
    next(error);
  }
};

export const requestPasswordReset: RequestHandler = async (req, res, next) => {
  try {
    const { email } = req.body;
    const userRepo = dbConnect.getRepository(User);
    const user = await userRepo.findOne({ where: { email } });
    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    const resetToken = uuidv4();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExp = new Date(Date.now() + 60 * 60 * 1000);
    await userRepo.save(user);

    await createLog(
      user,
      ActivityType.PASSWORD_RESET_REQUEST,
      "Password reset requested",
      {
        email: user.email,
        requestTime: new Date().toISOString(),
      }
    );
    res.json({
      success: true,
      message: "Password reset email sent",
      data: { resetToken },
    });
  } catch (error) {
    next(error);
  }
};

// Controller for editing user details
export const editUserDetails = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ErrorHandler("Validation errors", 400);
    }

    const { fullName } = req.body;

    const userId = req.user?.id;
    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const userRepo = dbConnect.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    if (req.file) {
      if (!fs.existsSync(req.file.path)) {
        return next(new ErrorHandler("File not found", 404));
      }

      const result = await cloudinary.uploader.upload(req.file.path, {
        upload_preset: "ml_default",
      });
      fs.unlinkSync(req.file.path);
      user.avatar = result.secure_url;
    }

    user.fullName = fullName || user.fullName;

    await userRepo.save(user);

    const originalDetails = {
      fullName: user.fullName,
      avatar: user.avatar,
    };

    await createLog(
      user,
      ActivityType.USER_PROFILE_UPDATE,
      "User profile updated",
      {
        userId: user.id,
        changes: {
          fullName:
            fullName !== originalDetails.fullName
              ? {
                from: originalDetails.fullName,
                to: fullName,
              }
              : undefined,
          avatar:
            user.avatar !== originalDetails.avatar
              ? {
                from: originalDetails.avatar,
                to: user.avatar,
              }
              : undefined,
        },
      }
    );

    res.json({
      success: true,
      message: "User details updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Controller for Changing User Password

export const changePassword = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ErrorHandler("Validation errors", 400);
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const userRepo = dbConnect.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      throw new ErrorHandler("Current password is incorrect", 401);
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await userRepo.save(user);

    await createLog(
      user,
      ActivityType.PASSWORD_CHANGE,
      "Password changed successfully",
      {
        userId: user.id,
        changeTime: new Date().toISOString(),
      }
    );

    res.json({
      success: true,
      message: "Password changed successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

// Forget Password Controller

export const forgotPassword: RequestHandler = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new ErrorHandler("Email is required", 400);
    }

    const userRepo = dbConnect.getRepository(User);

    const user = await userRepo.findOne({ where: { email } });

    if (!user) {
      throw new ErrorHandler("User with this email does not exist", 404);
    }

    // Generate reset code and expiration
    const resetCode = crypto.randomBytes(32).toString("hex");
    const resetCodeExp = new Date(Date.now() + 30 * 60 * 1000);

    // Update user with reset code and expiration
    user.emailVerificationCode = resetCode;
    user.emailVerificationExp = resetCodeExp;
    await userRepo.save(user);

    // Send email with reset link
    const frontendUrl = process.env.FRONTEND_URL;
    const resetLink = `${frontendUrl}/reset-password?code=${resetCode}`;

    await sendEmail({
      to: email,
      subject: "Password Reset Request",
      html: `<p>Hi ${user.fullName},</p>
             <p>You requested to reset your password. Click the link below to reset it:</p>
             <p><a href="${resetLink}" target="_blank">Reset Password</a></p>
             <p>This link is valid for 30 minutes.</p>`,
    });

    await createLog(
      user,
      ActivityType.PASSWORD_RESET_REQUEST,
      "Forgot password request initiated",
      {
        email: user.email,
        requestTime: new Date().toISOString(),
      }
    );
    res.status(200).json({
      success: true,
      message: `Password reset email sent to ${email}`,
    });
  } catch (error) {
    next(error);
  }
};

// Reset Password

export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    const { newPassword, confirmNewPassword, code } = req.body;

    if (!newPassword || !confirmNewPassword || !code) {
      throw new ErrorHandler("All fields are required", 400);
    }

    if (newPassword !== confirmNewPassword) {
      throw new ErrorHandler("Passwords do not match", 400);
    }

    const userRepo = dbConnect.getRepository(User);

    const user = await userRepo.findOne({
      where: { emailVerificationCode: code },
    });

    if (!user) {
      throw new ErrorHandler("Invalid or expired reset code", 400);
    }

    if (!user.emailVerificationExp || user.emailVerificationExp < new Date()) {
      throw new ErrorHandler("Reset code has expired", 400);
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password and clear reset code/expiration
    user.password = hashedPassword;
    user.emailVerificationCode = null;
    user.emailVerificationExp = null;

    await userRepo.save(user);

    await createLog(
      user,
      ActivityType.PASSWORD_RESET,
      "Password reset successfully",
      {
        userId: user.id,
        resetTime: new Date().toISOString(),
      }
    );

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    next(error);
  }
};
