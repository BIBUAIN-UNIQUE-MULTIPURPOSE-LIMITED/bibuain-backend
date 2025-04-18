import { Router } from "express";
import {
  createActivityLog,
  deleteActivityLogs,
  getActivityLogs,
  getActivityLogById,
} from "../controllers/activityLogsControllers";
import { authenticate, roleAuth } from "../middlewares/authenticate";
import { UserType } from "../models/user";

const router: Router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

router.post(
  "/create",
  roleAuth([
    UserType.ADMIN,
    UserType.PAYER,
    UserType.RATER,
    UserType.CEO,
    UserType.CC,
  ]),
  createActivityLog
);

// Other users can only see their own logs (filtered in controller)
router.get("/", roleAuth([UserType.ADMIN, UserType.CEO]), getActivityLogs);

// Get single log by ID - Admin and CEO access
router.get(
  "/:id",
  roleAuth([UserType.ADMIN, UserType.CEO]),
  getActivityLogById
);

// Delete logs - Admin only
router.delete("/", roleAuth([UserType.ADMIN]), deleteActivityLogs);

export default router;
