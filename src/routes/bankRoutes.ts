import { Router } from "express";
import {
  addBank,
  getAllBanks,
  getFreeBanks,
  getFundedBanks,
  updateBank,
  deleteBank,
  getBankById,
} from "../controllers/bankController";
import { authenticate, roleAuth } from "../middlewares/authenticate";
import { UserType } from "../models/user";

const router: any = Router();

router.use(authenticate);

// Rater Routes
router.post("/add", roleAuth([UserType.ADMIN, UserType.RATER]), addBank);

router.get("/single/:id", roleAuth([UserType.ADMIN]), getBankById);

router.get(
  "/",
  roleAuth([UserType.PAYER, UserType.ADMIN, UserType.RATER]),
  getAllBanks
);

router.get(
  "/free",
  roleAuth([UserType.ADMIN, UserType.PAYER, UserType.RATER]),
  getFreeBanks
);

router.get(
  "/funded",
  roleAuth([UserType.ADMIN, UserType.PAYER, UserType.RATER]),
  getFundedBanks
);

router.put("/:id", roleAuth([UserType.ADMIN, UserType.RATER]), updateBank);

router.delete("/:id", roleAuth([UserType.ADMIN]), deleteBank);

export default router;
