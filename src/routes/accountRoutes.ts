import express from "express";
import { authenticate, roleAuth } from "../middlewares/authenticate";
import { UserType } from "../models/user";
import {
  createAccount,
  deleteAccount,
  getAllAccounts,
  getSingleAccount,
  updateAccount,
} from "../controllers/accountsController";

const router: any = express.Router();

router.use(authenticate);

// Create account Route

router.post("/create", roleAuth([UserType.ADMIN]), createAccount);

// Update Account Route

router.put("/update/:id", roleAuth([UserType.ADMIN]), updateAccount);

// Delete Account

router.delete("/delete/:id", roleAuth([UserType.ADMIN]), deleteAccount);

// Get All Accounts

router.get("/all", roleAuth([UserType.ADMIN]), getAllAccounts);

// Get Single Account

router.get("/single/:id", roleAuth([UserType.ADMIN]), getSingleAccount);

export default router;
