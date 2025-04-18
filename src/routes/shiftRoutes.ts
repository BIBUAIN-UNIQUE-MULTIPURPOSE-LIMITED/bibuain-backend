import express from "express";
import { body, param, query } from "express-validator";
import {
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  getShiftMetrics,
  forceEndShift,
  getCurrentShift,
} from "../controllers/shiftController";
import { authenticate, roleAuth } from "../middlewares/authenticate";
import validateRequest from "../middlewares/validateRequest";
import { User, UserType } from "../models/user";

const router: any = express.Router();

// Clock In/Out Routes
router.post("/clock-in", authenticate, clockIn);
router.post("/clock-out", authenticate, clockOut);

// Break Management Routes
router.post("/break/start", authenticate, startBreak);
router.post("/break/end", authenticate, endBreak);

// Metrics Routes
router.get(
  "/metrics",
  authenticate,
  [
    query("startDate").isISO8601().withMessage("Invalid start date format"),
    query("endDate").isISO8601().withMessage("Invalid end date format"),
  ],
  validateRequest,
  getShiftMetrics
);

router.get(
  "/metrics/:userId",
  authenticate,
  roleAuth([UserType.ADMIN]),
  [
    param("userId").isUUID().withMessage("Invalid user ID"),
    query("startDate").isISO8601().withMessage("Invalid start date format"),
    query("endDate").isISO8601().withMessage("Invalid end date format"),
  ],
  validateRequest,
  getShiftMetrics
);

// Admin Routes
router.post(
  "/:shiftId/force-end",
  authenticate,
  roleAuth([UserType.ADMIN]),
  [
    param("shiftId").isUUID().withMessage("Invalid shift ID"),
    body("adminNotes").optional().isString().trim(),
  ],
  validateRequest,
  forceEndShift
);

router.get("/current-shift", authenticate, getCurrentShift);

export default router;
