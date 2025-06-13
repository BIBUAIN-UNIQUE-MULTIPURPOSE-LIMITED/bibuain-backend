import { Router } from "express";
import { body, param } from "express-validator";
import { uploadSingleFile } from "../config/multer";
import {
  changePassword,
  editUserDetails,
  enableTwoFa,
  forgotPassword,
  getCurrentUser,
  login,
  logout,
  resetPassword,
  verifyEmail,
  verifyTwoFa,
} from "../controllers/AuthController";
import { getAllUsers, getSingleUser } from "../controllers/adminController";
import { authenticate } from "../middlewares/authenticate";
import validateRequest from "../middlewares/validateRequest";

const router: any = Router();

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  validateRequest,
  login,
);

router.get("/me", authenticate, getCurrentUser);

router.get("/logout", authenticate, logout);

router.post("/enable-2fa", authenticate, enableTwoFa);

router.post(
  "/verify-2fa",
  [body("twoFaCode").notEmpty().withMessage("2FA code is required")],
  verifyTwoFa,
);

router.post("/forget-password", forgotPassword);

router.post(
  "/verify-email",
  [body("code").notEmpty().withMessage("Verification code is required")],
  verifyEmail,
);

router.post(
  "/reset-password",
  [
    body("token").notEmpty().withMessage("Reset token is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
  ],
  resetPassword,
);

router.get("/", getAllUsers);

// Get a single user by ID

router.get(
  "/:id",
  [param("id").isUUID().withMessage("Invalid user ID. It must be a UUID")],
  validateRequest,
  getSingleUser,
);

router.put("/update", authenticate, uploadSingleFile, editUserDetails);

router.put("/change-password", authenticate, changePassword);

export default router;
