"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const activityLogsControllers_1 = require("../controllers/activityLogsControllers");
const authenticate_1 = require("../middlewares/authenticate");
const user_1 = require("../models/user");
const router = (0, express_1.Router)();
// Apply authentication middleware to all routes
router.use(authenticate_1.authenticate);
router.post("/create", (0, authenticate_1.roleAuth)([
    user_1.UserType.ADMIN,
    user_1.UserType.PAYER,
    user_1.UserType.RATER,
    user_1.UserType.CEO,
    user_1.UserType.CC,
]), activityLogsControllers_1.createActivityLog);
// Other users can only see their own logs (filtered in controller)
router.get("/", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN, user_1.UserType.CEO]), activityLogsControllers_1.getActivityLogs);
// Get single log by ID - Admin and CEO access
router.get("/:id", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN, user_1.UserType.CEO]), activityLogsControllers_1.getActivityLogById);
// Delete logs - Admin only
router.delete("/", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), activityLogsControllers_1.deleteActivityLogs);
exports.default = router;
