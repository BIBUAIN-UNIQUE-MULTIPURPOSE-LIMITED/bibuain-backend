import { Request, Response, NextFunction } from "express";
import dbConnect from "../config/database";
import { Bank } from "../models/bank";
import ErrorHandler from "../utils/errorHandler";

// Add a new bank (Raters only)
export const addBank = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { bankName, accountName, accountNumber, funds, additionalNotes } =
      req.body;

    // Validation
    if (!bankName || !accountName || !accountNumber) {
      throw new ErrorHandler(
        "All fields (Bank Name, Account Name, Account Number, Serial Number) are required.",
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

// Fetch free banks (Banks with 0 balance)
export const getFreeBanks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const bankRepo = dbConnect.getRepository(Bank);
    const freeBanks = await bankRepo.find({ where: { funds: 0 } });

    res.status(200).json({
      success: true,
      data: freeBanks,
    });
  } catch (error) {
    next(error);
  }
};

// Fetch funded banks (Banks with funds > 0)
export const getFundedBanks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const bankRepo = dbConnect.getRepository(Bank);
    const fundedBanks = await bankRepo
      .createQueryBuilder("bank")
      .where("bank.funds > :funds", { funds: 0 })
      .getMany();

    res.status(200).json({
      success: true,
      data: fundedBanks,
    });
  } catch (error) {
    next(error);
  }
};

// Fetch banks in use (Payers View - Only funded banks available for transactions)
export const getBanksInUse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const bankRepo = dbConnect.getRepository(Bank);
    const banksInUse = await bankRepo
      .createQueryBuilder("bank")
      .where("bank.funds > :funds", { funds: 0 })
      .getMany();

    res.status(200).json({
      success: true,
      data: banksInUse,
    });
  } catch (error) {
    next(error);
  }
};

// Update bank details (Raters only)
export const updateBank = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { bankName, accountName, accountNumber, additionalNotes, funds } =
      req.body;

    const bankRepo = dbConnect.getRepository(Bank);
    const bank = await bankRepo.findOne({ where: { id } });

    if (!bank) {
      throw new ErrorHandler("Bank not found.", 404);
    }

    // Update fields
    bank.bankName = bankName || bank.bankName;
    bank.accountName = accountName || bank.accountName;
    bank.accountNumber = accountNumber || bank.accountNumber;
    bank.additionalNotes = additionalNotes || bank.additionalNotes;
    bank.funds = funds !== undefined ? funds : bank.funds;

    // Save updates
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

    if (!bank) {
      throw new ErrorHandler("Bank not found.", 404);
    }

    // Delete bank
    await bankRepo.remove(bank);

    res.status(200).json({
      success: true,
      message: "Bank deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

// Automatically reload free banks at 1 AM daily (Scheduler logic)
export const reloadFreeBanks = async () => {
  const bankRepo = dbConnect.getRepository(Bank);

  try {
    // Update all banks with 0 funds to the default reload limit
    const reloadLimit = 1000; // Example limit for reloading
    await bankRepo
      .createQueryBuilder()
      .update(Bank)
      .set({ funds: reloadLimit })
      .where("funds = :funds", { funds: 0 })
      .execute();

    // console.log("Free banks reloaded successfully.");
  } catch (error) {
    console.error("Error reloading free banks:", error);
  }
};

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
