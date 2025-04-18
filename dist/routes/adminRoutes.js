"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const adminController_1 = require("../controllers/adminController");
const validateRequest_1 = __importDefault(require("../middlewares/validateRequest"));
const authenticate_1 = require("../middlewares/authenticate");
const express_validator_1 = require("express-validator");
const user_1 = require("../models/user");
const router = express_1.default.Router();
router.post("/create-admin", adminController_1.createAdminUser);
router.use(authenticate_1.authenticate, authenticate_1.isAdmin);
router.post("/create-user", [
    (0, express_validator_1.body)("email").isEmail().withMessage("Please provide a valid email address"),
    (0, express_validator_1.body)("userType")
        .isIn(["admin", "payer", "rater", "ceo", "customer-support"])
        .withMessage("Invalid userType. Allowed values: admin, payer, rater, ceo, customer-support"),
    (0, express_validator_1.body)("fullName")
        .notEmpty()
        .withMessage("Full name is required")
        .isString()
        .withMessage("Full name must be a string")
        .isLength({ min: 3 })
        .withMessage("Full name must be at least 3 characters long"),
    (0, express_validator_1.body)("phone")
        .optional()
        .isMobilePhone("any")
        .withMessage("Phone must be a valid mobile number"),
], validateRequest_1.default, adminController_1.createUser);
router.get("/user/all", authenticate_1.authenticate, (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), adminController_1.getAllUsers);
router.get("/user/single/:id", authenticate_1.authenticate, (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), adminController_1.getSingleUser);
router.delete("/user/:id", adminController_1.deleteUser);
router.put("/user/:id", authenticate_1.authenticate, (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), [
    (0, express_validator_1.param)("id").isString().withMessage("Invalid user ID"),
    (0, express_validator_1.body)("email")
        .optional()
        .isEmail()
        .withMessage("Please provide a valid email address"),
    (0, express_validator_1.body)("fullName")
        .optional()
        .isString()
        .withMessage("Full name must be a string")
        .isLength({ min: 3 })
        .withMessage("Full name must be at least 3 characters long"),
    (0, express_validator_1.body)("phone")
        .optional()
        .isMobilePhone("any")
        .withMessage("Phone must be a valid mobile number"),
    (0, express_validator_1.body)("userType")
        .optional()
        .isIn(["admin", "payer", "rater", "ceo", "customer-support"])
        .withMessage("Invalid userType. Allowed values: admin, payer, rater, ceo, customer-support"),
    validateRequest_1.default,
], adminController_1.editUser);
exports.default = router;
