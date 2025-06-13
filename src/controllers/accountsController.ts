import type { NextFunction, RequestHandler, Response } from "express";
import { validationResult } from "express-validator";
import dbConnect from "../config/database";
import type { UserRequest } from "../middlewares/authenticate";
import { Account } from "../models/accounts";
import { User } from "../models/user";
import ErrorHandler from "../utils/errorHandler";

/*
 * Accounts Controller
 * Handles CRUD operations for Forex accounts
 */
export const createAccount: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ErrorHandler("Validation errors", 400);
    }

    const { account_username, api_key, api_secret, platform } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const accountRepo = dbConnect.getRepository(Account);
    const userRepo = dbConnect.getRepository(User);

    const existingAccount = await accountRepo.findOne({
      where: { account_username, platform },
    });
    if (existingAccount) {
      throw new ErrorHandler(
        "Account username already exists on this platform",
        409,
      );
    }

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    const newAccount = accountRepo.create({
      account_username,
      api_key,
      api_secret,
      platform,
    });

    await accountRepo.save(newAccount);

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
  } catch (error) {
    next(error);
  }
};

/*
 * Update Account
 * Allows users to update their Forex account details
 * Validates input and checks for existing usernames on the same platform
 */
export const updateAccount: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ErrorHandler("Validation errors", 400);
    }

    const { id } = req.params;
    const { account_username, api_secret, status } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const accountRepo = dbConnect.getRepository(Account);

    const account = await accountRepo.findOne({
      where: { id },
    });

    if (!account) {
      throw new ErrorHandler("Account not found", 404);
    }

    // Check if the new username already exists on the same platform
    if (account_username && account_username !== account.account_username) {
      const existingAccount = await accountRepo.findOne({
        where: { account_username, platform: account.platform },
      });
      if (existingAccount) {
        throw new ErrorHandler(
          "Account username already exists on this platform",
          409,
        );
      }
      account.account_username = account_username;
    }

    // Update API secret directly
    if (api_secret) {
      account.api_secret = api_secret;
    }

    if (status) account.status = status;

    await accountRepo.save(account);

    res.json({
      success: true,
      message: "Account updated successfully",
      data: {
        id: account.id,
        status: account.status,
        updatedAt: account.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/*
 * Delete Account
 * Permanently deletes a Forex account by ID
 * Ensures the account exists before deletion
 */
export const deleteAccount: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const accountRepo = dbConnect.getRepository(Account);
    const account = await accountRepo.findOne({
      where: { id },
    });

    if (!account) {
      throw new ErrorHandler("Account not found", 404);
    }

    await accountRepo.remove(account);

    res.json({
      success: true,
      message: "Account permanently deleted",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

/*
 * Get All Accounts
 * Retrieves all Forex accounts with limited details
 * Ensures the user is authenticated before accessing accounts
 */
export const getAllAccounts: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const accountRepo = dbConnect.getRepository(Account);
    const accounts = await accountRepo.find({
      select: ["id", "account_username", "platform", "status", "createdAt"],
    });

    res.json({
      success: true,
      data: accounts,
      count: accounts.length,
    });
  } catch (error) {
    next(error);
  }
};

/*
 * Get Single Account
 * Retrieves a single Forex account by ID
 * Ensures the account exists and limits sensitive data exposure
 */
export const getSingleAccount: RequestHandler = async (
  req: UserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const accountRepo = dbConnect.getRepository(Account);
    const account = await accountRepo.findOne({
      where: { id },
    });

    if (!account) {
      throw new ErrorHandler("Account not found", 404);
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
  } catch (error) {
    next(error);
  }
};
