"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const shiftController_1 = require("../controllers/shiftController");
const authenticate_1 = require("../middlewares/authenticate");
const validateRequest_1 = __importDefault(require("../middlewares/validateRequest"));
const user_1 = require("../models/user");
const router = express_1.default.Router();
// Clock In/Out Routes
router.post("/clock-in", authenticate_1.authenticate, shiftController_1.clockIn);
router.post("/clock-out", authenticate_1.authenticate, shiftController_1.clockOut);
// Break Management Routes
router.post("/break/start", authenticate_1.authenticate, shiftController_1.startBreak);
router.post("/break/end", authenticate_1.authenticate, shiftController_1.endBreak);
// Metrics Routes
router.get("/metrics", authenticate_1.authenticate, [
    (0, express_validator_1.query)("startDate").isISO8601().withMessage("Invalid start date format"),
    (0, express_validator_1.query)("endDate").isISO8601().withMessage("Invalid end date format"),
], validateRequest_1.default, shiftController_1.getShiftMetrics);
router.get("/metrics/:userId", authenticate_1.authenticate, (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), [
    (0, express_validator_1.param)("userId").isUUID().withMessage("Invalid user ID"),
    (0, express_validator_1.query)("startDate").isISO8601().withMessage("Invalid start date format"),
    (0, express_validator_1.query)("endDate").isISO8601().withMessage("Invalid end date format"),
], validateRequest_1.default, shiftController_1.getShiftMetrics);
// Admin Routes
router.post("/:shiftId/force-end", authenticate_1.authenticate, (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), [
    (0, express_validator_1.param)("shiftId").isUUID().withMessage("Invalid shift ID"),
    (0, express_validator_1.body)("adminNotes").optional().isString().trim(),
], validateRequest_1.default, shiftController_1.forceEndShift);
router.get("/current-shift", authenticate_1.authenticate, shiftController_1.getCurrentShift);
exports.default = router;
