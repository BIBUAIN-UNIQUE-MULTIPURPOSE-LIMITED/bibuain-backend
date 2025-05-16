import { Router } from "express";
import {
  addBank,
  getAllBanks,
  getFreeBanks,
  getFundedBanks,
  updateBank,
  deleteBank,
  getBankById,
  useBank,
  reloadFreshBanks,
  getUsedBanks,
  getFreshBanks,
  getRolloverBanks,
  getBanksForShift
} from "../controllers/bankController";
import { authenticate, roleAuth } from "../middlewares/authenticate";
import { UserType } from "../models/user";

const router = Router();

// Apply authentication
router.use(authenticate);

// Rater/Admin routes
router.post(
  "/add",
  roleAuth([UserType.ADMIN, UserType.RATER]),
  addBank
);
router.get(
  "/single/:id",
  roleAuth([UserType.ADMIN, UserType.RATER]),
  getBankById
);
router.get(
  "/",
  roleAuth([UserType.ADMIN, UserType.RATER]),
  getAllBanks
);
router.get(
  "/free",
  roleAuth([UserType.ADMIN, UserType.RATER]),
  getFreeBanks
);
router.get(
  "/funded",
  roleAuth([UserType.ADMIN, UserType.RATER, UserType.PAYER]),
  getFundedBanks
);
router.put(
  "/:id",
  roleAuth([UserType.ADMIN, UserType.RATER]),
  updateBank
);
router.delete(
  "/:id",
  roleAuth([UserType.ADMIN, UserType.RATER]),
  deleteBank
);

router.get('/used', roleAuth([UserType.ADMIN, UserType.RATER,]), getUsedBanks);
router.get('/rollover', roleAuth([UserType.ADMIN, UserType.RATER]), getRolloverBanks);
router.get('/fresh', roleAuth([UserType.ADMIN, UserType.RATER]), getFreshBanks);

// Payer routes
// Use bank (spend funds)
router.post(
  "/use/:id",
  roleAuth([UserType.PAYER]),
  useBank
);

// Admin cron route (optional, protected)
router.post(
  "/refresh",
  roleAuth([UserType.ADMIN]),
  async (req, res, next) => {
    try {
      await reloadFreshBanks();
      res.status(200).json({ success: true, message: "Banks refreshed." });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/shift/:shiftId",
  roleAuth([UserType.PAYER, UserType.ADMIN, UserType.RATER]),
  getBanksForShift
);

export default router;
