import express from "express";
import {
  createAdminUser,
  createUser,
  deleteUser,
  editUser,
  getAllUsers,
  getSingleUser,
} from "../controllers/adminController";
import validateRequest from "../middlewares/validateRequest";
import { authenticate, isAdmin, roleAuth } from "../middlewares/authenticate";
import { body, param } from "express-validator";
import { User, UserType } from "../models/user";

const router: any = express.Router();

router.post("/create-admin", createAdminUser);

router.use(authenticate, isAdmin);

router.post(
  "/create-user",
  [
    body("email").isEmail().withMessage("Please provide a valid email address"),
    body("userType")
      .isIn(["admin", "payer", "rater", "ceo", "customer-support"])
      .withMessage(
        "Invalid userType. Allowed values: admin, payer, rater, ceo, customer-support"
      ),
    body("fullName")
      .notEmpty()
      .withMessage("Full name is required")
      .isString()
      .withMessage("Full name must be a string")
      .isLength({ min: 3 })
      .withMessage("Full name must be at least 3 characters long"),
    body("phone")
      .optional()
      .isMobilePhone("any")
      .withMessage("Phone must be a valid mobile number"),
  ],
  validateRequest,
  createUser
);

router.get("/user/all", authenticate, roleAuth([UserType.ADMIN]), getAllUsers);

router.get(
  "/user/single/:id",
  authenticate,
  roleAuth([UserType.ADMIN]),
  getSingleUser
);

router.delete("/user/:id", deleteUser);

router.put(
  "/user/:id",
  authenticate,
  roleAuth([UserType.ADMIN]),
  [
    param("id").isString().withMessage("Invalid user ID"),
    body("email")
      .optional()
      .isEmail()
      .withMessage("Please provide a valid email address"),
    body("fullName")
      .optional()
      .isString()
      .withMessage("Full name must be a string")
      .isLength({ min: 3 })
      .withMessage("Full name must be at least 3 characters long"),
    body("phone")
      .optional()
      .isMobilePhone("any")
      .withMessage("Phone must be a valid mobile number"),
    body("userType")
      .optional()
      .isIn(["admin", "payer", "rater", "ceo", "customer-support"])
      .withMessage(
        "Invalid userType. Allowed values: admin, payer, rater, ceo, customer-support"
      ),
    validateRequest,
  ],
  editUser
);

export default router;
