import { Request, Response, NextFunction } from "express";
import dbConnect from "../config/database";
import { Bank, BankTag } from "../models/bank";
import { Shift } from "../models/shift";
import ErrorHandler from "../utils/errorHandler";

// Add a new bank (Raters only)
export const addBank = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { bankName, accountName, accountNumber, additionalNotes, funds, tag } = req.body;

    // Validation
    if (!bankName || !accountName || !accountNumber) {
      throw new ErrorHandler(
        "All fields (Bank Name, Account Name, Account Number) are required.",
        400
      );
    }
    if (accountNumber.length < 10 || accountNumber.length > 20) {
      throw new ErrorHandler(
        "Account Number must be between 10 and 20 characters.",
        400
      );
    }

    const bankRepo = dbConnect.getRepository(Bank);
    const newBank = bankRepo.create({
      bankName,
      accountName,
      accountNumber,
      additionalNotes,
      funds: funds || 0,
      tag: tag || BankTag.UNFUNDED,
    });
    await bankRepo.save(newBank);

    res.status(201).json({
      success: true,
      message: "Bank added successfully.",
      data: newBank,
    });
  } catch (error) {
    next(error);
  }
};

// Fetch all banks (Admin/Raters View)
export const getAllBanks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const bankRepo = dbConnect.getRepository(Bank);
    const banks = await bankRepo.find();

    res.status(200).json({
      success: true,
      data: banks,
    });
  } catch (error) {
    next(error);
  }
};

// Fetch free banks (Banks tagged UNFUNDED)
export const getFreeBanks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const bankRepo = dbConnect.getRepository(Bank);
    const freeBanks = await bankRepo.find({ where: { tag: BankTag.UNFUNDED } });

    res.status(200).json({
      success: true,
      data: freeBanks,
    });
  } catch (error) {
    next(error);
  }
};

// Fetch funded banks (Banks tagged FUNDED)
export const getFundedBanks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const bankRepo = dbConnect.getRepository(Bank);
    const fundedBanks = await bankRepo.find({ where: { tag: BankTag.FUNDED } });

    res.status(200).json({
      success: true,
      data: fundedBanks,
    });
  } catch (error) {
    next(error);
  }
};

// Get single bank by ID
export const getBankById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const bankRepo = dbConnect.getRepository(Bank);
    const bank = await bankRepo.findOne({ where: { id } });

    if (!bank) {
      throw new ErrorHandler("Bank not found.", 404);
    }

    res.status(200).json({
      success: true,
      data: bank,
    });
  } catch (error) {
    next(error);
  }
};

// Update bank details (Raters: fund or modify)
export const updateBank = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { bankName, accountName, accountNumber, additionalNotes, funds, tag } = req.body;

    const bankRepo = dbConnect.getRepository(Bank);
    const bank = await bankRepo.findOne({ where: { id } });

    if (!bank) {
      throw new ErrorHandler("Bank not found.", 404);
    }

    // Update basic fields
    bank.bankName = bankName || bank.bankName;
    bank.accountName = accountName || bank.accountName;
    bank.accountNumber = accountNumber || bank.accountNumber;
    bank.additionalNotes = additionalNotes ?? bank.additionalNotes;

    // Tag transition: UNFUNDED -> FUNDED, or back to UNFUNDED
    if (funds !== undefined) {
      const prevFunds = bank.funds;
      bank.funds = funds;
      if (prevFunds === 0 && funds > 0) {
        bank.tag = BankTag.FUNDED;
      } else if (funds === 0) {
        bank.tag = BankTag.UNFUNDED;
      }
    }

    if (tag) {
      bank.tag = tag;
    }

    await bankRepo.save(bank);

    res.status(200).json({
      success: true,
      message: "Bank updated successfully.",
      data: bank,
    });
  } catch (error) {
    next(error);
  }
};

// Use a bank during a shift (Payers only)
export const useBank = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { amountUsed, shiftId } = req.body;

    const bankRepo = dbConnect.getRepository(Bank);
    const shiftRepo = dbConnect.getRepository(Shift);

    const bank = await bankRepo.findOne({ where: { id } });
    if (!bank) throw new ErrorHandler("Bank not found.", 404);

    const shift = await shiftRepo.findOne({ where: { id: shiftId } });
    if (!shift) throw new ErrorHandler("Shift not found.", 404);

    // Deduct funds and tag
    const remaining = bank.funds - amountUsed;
    bank.funds = remaining >= 0 ? remaining : 0;
    bank.shift = shift;
    bank.tag = bank.funds === 0 ? BankTag.ROLLOVER : BankTag.USED;
    

    // Log usage
    const logEntry = { description: `Used ${amountUsed}`, createdAt: new Date() };
    bank.logs = bank.logs ? [...bank.logs, logEntry] : [logEntry];

    await bankRepo.save(bank);

    res.status(200).json({ success: true, data: bank });
  } catch (error) {
    next(error);
  }
};

// Delete a bank (Raters only)
export const deleteBank = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const bankRepo = dbConnect.getRepository(Bank);
    const bank = await bankRepo.findOne({ where: { id } });
    if (!bank) throw new ErrorHandler("Bank not found.", 404);

    await bankRepo.remove(bank);
    res.status(200).json({ success: true, message: "Bank deleted successfully." });
  } catch (error) {
    next(error);
  }
};

// Daily refresh: mark UNFUNDED & ROLLOVER as FRESH
export const reloadFreshBanks = async () => {
  const bankRepo = dbConnect.getRepository(Bank);
  try {
    await bankRepo
      .createQueryBuilder()
      .update(Bank)
      .set({ tag: BankTag.UNFUNDED })
      .where("tag IN (:...tags)", { tags: [BankTag.ROLLOVER] })
      .execute();
  } catch (error) {
    console.error("Error in reloadFreshBanks:", error);
  }
};

// Fetch used banks (Banks tagged USED)
export const getUsedBanks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const bankRepo = dbConnect.getRepository(Bank);
    const usedBanks = await bankRepo.find({ where: { tag: BankTag.USED } });

    res.status(200).json({
      success: true,
      data: usedBanks,
    });
  } catch (error) {
    next(error);
  }
};

// Fetch rollover banks (Banks tagged ROLLOVER)
export const getRolloverBanks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const bankRepo = dbConnect.getRepository(Bank);
    const rolloverBanks = await bankRepo.find({ where: { tag: BankTag.ROLLOVER } });

    res.status(200).json({
      success: true,
      data: rolloverBanks,
    });
  } catch (error) {
    next(error);
  }
};

// Fetch fresh banks (Banks tagged FRESH)
export const getFreshBanks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const bankRepo = dbConnect.getRepository(Bank);
    const freshBanks = await bankRepo.find({ where: { tag: BankTag.FRESH } });

    res.status(200).json({
      success: true,
      data: freshBanks,
    });
  } catch (error) {
    next(error);
  }
};