import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import dbConnect from "../config/database";
import type { UserRequest } from "../middlewares/authenticate";
import { User, UserType } from "../models/user";
import sendEmail from "../services/mailService";
import ErrorHandler from "../utils/errorHandler";

/*
 * Admin Controller
 * Handles CRUD operations for admin users
 */
export const createAdminUser: RequestHandler = async (req, res, next) => {
  try {
    const { email, password, fullName, phone } = req.body;

    if (!email || !password || !fullName) {
      throw new ErrorHandler("All fields are required", 400);
    }

    const userRepo = dbConnect.getRepository(User);

    const existingUser = await userRepo.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ErrorHandler("Username or email already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const adminUser = userRepo.create({
      email,
      password: hashedPassword,
      fullName,
      phone,
      userType: UserType.ADMIN,
      isEmailVerified: true,
    });

    await userRepo.save(adminUser);

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
  } catch (error) {
    next(error);
  }
};

/*
 * Create a new user (for registration)
 * Validates password, checks for existing email/phone, hashes password,
 * generates email verification code, and sends verification email.
 */
export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, userType, fullName, phone, password } = req.body;

    if (!password) {
      throw new ErrorHandler("Password is required", 400);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      throw new ErrorHandler(passwordValidation.message, 400);
    }

    if (!Object.values(UserType).includes(userType)) {
      throw new ErrorHandler("Invalid userType provided", 400);
    }

    const userRepo = dbConnect.getRepository(User);

    const existingUserByEmail = await userRepo.findOne({ where: { email } });
    if (existingUserByEmail) {
      throw new ErrorHandler("Email already exists", 409);
    }

    if (phone) {
      const existingUserByPhone = await userRepo.findOne({ where: { phone } });
      if (existingUserByPhone) {
        throw new ErrorHandler("Phone number already exists", 409);
      }
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const emailVerificationCode = crypto.randomBytes(32).toString("hex");
    const emailVerificationExp = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newUser = userRepo.create({
      email,
      userType,
      fullName,
      phone,
      password: hashedPassword,
      emailVerificationCode,
      emailVerificationExp,
    });
    await userRepo.save(newUser);

    // Generate verification link
    const frontendUrl = process.env.FRONTEND_URL;
    const verificationLink = `${frontendUrl}/verify-account?code=${emailVerificationCode}`;

    // Send email notification with verification link
    await sendEmail({
      to: email,
      subject: "Verify Your Account",
      html: `<p>Hi ${fullName},</p>
             <p>Thank you for registering on our platform. Please click the link below to verify your account:</p>
             <p><a href="${verificationLink}" target="_blank">Click Here to Setup your account</a></p>
             <p>This link is valid for 24 hours.</p>`,
    });

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
  } catch (error) {
    next(error);
  }
};

/*
 * Validates password according to specified rules:
 * - At least 8 characters long
 * - Contains at least one uppercase letter
 * - Contains at least one lowercase letter
 * - Contains at least one number
 * - Contains at least one special character
 */
export const validatePassword = (
  password: string,
): { isValid: boolean; message: string } => {
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

/*
 * Edit user details (for admin)
 * Validates userType, checks for existing email/phone,
 * updates user details, and returns updated user data.
 */
export const editUser = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { email, fullName, phone, userType } = req.body;
    const currentUserId = req.user?.id;

    if (!currentUserId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    if (req.user?.userType != "admin") {
      throw new ErrorHandler("Access denied: Only admins can edit users", 403);
    }

    const userRepo = dbConnect.getRepository(User);
    const userToEdit = await userRepo.findOne({ where: { id } });
    if (!userToEdit) {
      throw new ErrorHandler("User not found", 404);
    }

    if (userToEdit.id === currentUserId) {
      throw new ErrorHandler("Admins cannot edit their own account", 400);
    }

    userToEdit.email = typeof email === "string" ? email : userToEdit.email;
    userToEdit.fullName =
      typeof fullName === "string" ? fullName : userToEdit.fullName;
    userToEdit.phone = typeof phone === "string" ? phone : userToEdit.phone;
    userToEdit.userType = userType || userToEdit.userType;

    const updatedUser = await userRepo.save(userToEdit);

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
  } catch (error) {
    next(error);
  }
};

/*
 * Delete user (for admin)
 * Validates userType, checks if user exists,
 * prevents deletion of own account by admin,
 * and deletes the user.
 */
export const deleteUser = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userIdToDelete = req.params.id;
    const currentUserId = req.user?.id;

    if (!currentUserId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    if (req.user?.userType != "admin") {
      throw new ErrorHandler(
        "Access denied: Only admins can delete users",
        403,
      );
    }

    const userRepo = dbConnect.getRepository(User);

    const userToDelete = await userRepo.findOne({
      where: { id: userIdToDelete },
    });
    if (!userToDelete) {
      throw new ErrorHandler("User not found", 404);
    }

    if (userToDelete.id === currentUserId) {
      throw new ErrorHandler("Admins cannot delete their own account", 400);
    }

    await userRepo.remove(userToDelete);

    res.status(200).json({
      success: true,
      message: `User  deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/*
 * Get All Users (for admin)
 * Retrieves all users with optional filters for userType, email, fullName, status, and clockedIn.
 */
export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userType, email, fullName, status, clockedIn } = req.query;
    const userRepo = dbConnect.getRepository(User);

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
      const isClockedIn = clockedIn === "true";
      query.andWhere("user.clockedIn = :clockedIn", { clockedIn: isClockedIn });
    }

    const users = await query.getMany();

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

/*
 * Get Single User (for admin)
 * Retrieves a single user by ID, ensuring the user exists.
 */
export const getSingleUser = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const userRepo = dbConnect.getRepository(User);

    const user = await userRepo.findOne({ where: { id } });

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
