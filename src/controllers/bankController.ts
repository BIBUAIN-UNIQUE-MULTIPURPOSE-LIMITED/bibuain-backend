import type { NextFunction, Request, Response } from "express";
import dbConnect from "../config/database";
import { Bank, BankTag } from "../models/bank";
import { Shift } from "../models/shift";
import ErrorHandler from "../utils/errorHandler";

/**
 * Bank Controller
 * Handles CRUD operations for banks
 */
export const addBank = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      bankName,
      accountName,
      accountNumber,
      additionalNotes,
      funds,
      tag,
    } = req.body;

    if (!bankName || !accountName || !accountNumber) {
      throw new ErrorHandler(
        "All fields (Bank Name, Account Name, Account Number) are required.",
        400,
      );
    }
    if (accountNumber.length < 10 || accountNumber.length > 20) {
      throw new ErrorHandler(
        "Account Number must be between 10 and 20 characters.",
        400,
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

/*
 * Fetch all banks (Raters: view all banks)
 * Returns all banks regardless of their tag
 */
export const getAllBanks = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

/*
 * Fetch all banks (Raters: view all banks)
 * Returns all banks regardless of their tag
 */
export const getFreeBanks = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

/*
 * Fetch funded banks (Raters: view funded banks)
 * Returns banks tagged as FUNDED, along with their current shift and user
 * Used by Raters to see which banks are currently funded
 */
export const getFundedBanks = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const bankRepo = dbConnect.getRepository(Bank);
    // fetch the bank, its current shift, and that shift's user
    const fundedBanks = await bankRepo.find({
      where: { tag: BankTag.FUNDED },
      relations: ["shift", "shift.user"],
    });

    // Massage the response so each bank has a usedBy: fullName | null
    const data = fundedBanks.map((bank) => ({
      ...bank,
      usedBy: null,
    }));

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/*
 * Fetch a single bank by ID (Raters: view bank details)
 * Returns the bank details for a specific bank
 */
export const getBankById = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

/*
 * Update a bank (Raters: update bank details)
 * Allows updating bank details, including funds and tag
 * Tag transition: UNFUNDED -> FUNDED, or back to UNFUNDED
 */
export const updateBank = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const {
      bankName,
      accountName,
      accountNumber,
      additionalNotes,
      funds,
      tag,
    } = req.body;

    const bankRepo = dbConnect.getRepository(Bank);
    const bank = await bankRepo.findOne({ where: { id } });

    if (!bank) {
      throw new ErrorHandler("Bank not found.", 404);
    }

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

/*
 * Use a bank (Raters: assign bank to shift)
 * Deducts funds from the bank and associates it with a shift
 * Updates the bank's tag based on remaining funds
 * Adds a log entry for the assignment
 */
export const useBank = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { amountUsed, shiftId } = req.body;

    if (typeof amountUsed !== "number" || !shiftId) {
      throw new ErrorHandler(
        "Request body must include numeric `amountUsed` and `shiftId`.",
        400,
      );
    }

    const bankRepo = dbConnect.getRepository(Bank);
    const shiftRepo = dbConnect.getRepository(Shift);

    // Fetch bank
    const bank = await bankRepo.findOne({ where: { id } });
    if (!bank) throw new ErrorHandler("Bank not found.", 404);

    // Fetch shift
    const shift = await shiftRepo.findOne({
      where: { id: shiftId },
      relations: ["bank"],
    });
    if (!shift) throw new ErrorHandler("Shift not found.", 404);

    // Release old bank if different
    if (shift.bank && shift.bank.id !== bank.id) {
      const oldBank = await bankRepo.findOne({ where: { id: shift.bank.id } });
      if (oldBank) {
        oldBank.shift = undefined;
        oldBank.tag = oldBank.funds > 0 ? BankTag.FUNDED : BankTag.ROLLOVER;
        await bankRepo.save(oldBank);
      }
    }

    // Deduct funds and update status
    const remaining = bank.funds - amountUsed;
    bank.funds = Math.max(0, remaining);

    // Update status based on remaining funds
    bank.tag = bank.funds > 0 ? BankTag.USED : BankTag.ROLLOVER;

    // Associate with shift
    bank.shift = shift;
    shift.bank = bank;

    // Add log entry
    const logEntry = {
      description: `Assigned to shift ${shiftId} with initial amount used ${amountUsed}`,
      createdAt: new Date(),
    };
    bank.logs = bank.logs ? [...bank.logs, logEntry] : [logEntry];

    await bankRepo.save(bank);
    await shiftRepo.save(shift);

    res.status(200).json({
      success: true,
      data: {
        id: bank.id,
        funds: bank.funds,
        tag: bank.tag,
        shiftId: shift.id,
        logs: bank.logs,
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
      },
    });
  } catch (error) {
    next(error);
  }
};

/*
 * Delete a bank (Raters: remove bank)
 * Deletes a bank if it has no associated shifts
 * Returns an error if the bank is currently in use
 */
export const deleteBank = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const bankRepo = dbConnect.getRepository(Bank);
    const bank = await bankRepo.findOne({ where: { id } });
    if (!bank) throw new ErrorHandler("Bank not found.", 404);

    await bankRepo.remove(bank);
    res
      .status(200)
      .json({ success: true, message: "Bank deleted successfully." });
  } catch (error) {
    next(error);
  }
};

/*
 * Reload fresh banks (Raters: reset banks to UNFUNDED)
 * Resets all banks tagged as ROLLOVER to UNFUNDED
 * Used to refresh the state of banks at the start of a new day
 */
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

/*
 * Fetch used banks (Banks tagged USED)
 * Returns banks that are currently assigned to shifts
 * Includes the user who is using the bank
 */
export const getUsedBanks = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const bankRepo = dbConnect.getRepository(Bank);
    const usedBanks = await bankRepo.find({
      where: { tag: BankTag.USED },
      relations: ["shift", "shift.user"],
    });

    const data = usedBanks.map((bank) => ({
      id: bank.id,
      bankName: bank.bankName,
      accountName: bank.accountName,
      accountNumber: bank.accountNumber,
      funds: bank.funds,
      tag: bank.tag,
      usedBy: bank.shift?.user?.fullName || null,
      shiftId: bank.shift?.id || null,
    }));

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/*
 * Fetch rollover banks (Banks tagged ROLLOVER)
 * Returns banks that have been used but are now available for reuse
 * Used to track banks that can be reloaded with fresh funds
 */
export const getRolloverBanks = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const bankRepo = dbConnect.getRepository(Bank);
    const rolloverBanks = await bankRepo.find({
      where: { tag: BankTag.ROLLOVER },
    });

    res.status(200).json({
      success: true,
      data: rolloverBanks,
    });
  } catch (error) {
    next(error);
  }
};

/*
 * Fetch fresh banks (Banks tagged FRESH)
 * Returns banks that are newly created and not yet used
 * Used to display available banks for assignment
 */
export const getFreshBanks = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

/*
 * Fetch banks for a specific shift
 * Returns all banks associated with a given shift ID
 * Used to display banks available for a specific shift
 */
export const getBanksForShift = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const bankRepo = dbConnect.getRepository(Bank);
    const { shiftId } = req.params;
    const banks = await bankRepo.find({ where: { shift: { id: shiftId } } });
    res.status(200).json({ success: true, data: banks });
  } catch (err) {
    next(err);
  }
};
