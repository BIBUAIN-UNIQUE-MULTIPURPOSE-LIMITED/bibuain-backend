import express from "express";
import {
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  getSingleMessageTemplate,
  getAllMessageTemplates,
} from "../controllers/templateMessages";
import { authenticate, roleAuth } from "../middlewares/authenticate";
import { UserType } from "../models/user";
import validateRequest from "../middlewares/validateRequest";
import { body } from "express-validator";
import { TemplateType } from "../models/messageTemplates";
import { TradePlatform } from "../models/trades";

const router: any = express.Router();

// Validation middleware for template creation and updates
const validateTemplateFields = [
  body("type")
    .isIn(Object.values(TemplateType))
    .withMessage("Invalid template type"),
  body("platform")
    .isIn(Object.values(TradePlatform))
    .withMessage("Invalid platform"),
  body("content").isString().notEmpty().withMessage("Content is required"),
  body("followUpDelayMinutes")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Follow-up delay must be a positive number"),
  body("displayOrder")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Display order must be a positive number"),
  body("availableVariables")
    .optional()
    .isArray()
    .withMessage("Available variables must be an array"),
  body("availableVariables.*.name")
    .optional()
    .isString()
    .notEmpty()
    .withMessage("Variable name is required"),
  body("availableVariables.*.description")
    .optional()
    .isString()
    .notEmpty()
    .withMessage("Variable description is required"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("tags.*").optional().isString().withMessage("Each tag must be a string"),
];

// Routes with authentication and authorization
router
  .route("/")
  .post(
    authenticate,
    roleAuth([UserType.ADMIN]),
    validateTemplateFields,
    validateRequest,
    createMessageTemplate
  )
  .get(getAllMessageTemplates);

router
  .route("/:id")
  .get(getSingleMessageTemplate)
  .put(
    authenticate,
    roleAuth([UserType.ADMIN]),
    validateTemplateFields,
    validateRequest,
    updateMessageTemplate
  )
  .delete(authenticate, roleAuth([UserType.ADMIN]), deleteMessageTemplate);

export default router;
