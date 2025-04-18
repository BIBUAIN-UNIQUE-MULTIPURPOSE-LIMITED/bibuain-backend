"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const templateMessages_1 = require("../controllers/templateMessages");
const authenticate_1 = require("../middlewares/authenticate");
const user_1 = require("../models/user");
const validateRequest_1 = __importDefault(require("../middlewares/validateRequest"));
const express_validator_1 = require("express-validator");
const messageTemplates_1 = require("../models/messageTemplates");
const trades_1 = require("../models/trades");
const router = express_1.default.Router();
// Validation middleware for template creation and updates
const validateTemplateFields = [
    (0, express_validator_1.body)("type")
        .isIn(Object.values(messageTemplates_1.TemplateType))
        .withMessage("Invalid template type"),
    (0, express_validator_1.body)("platform")
        .isIn(Object.values(trades_1.TradePlatform))
        .withMessage("Invalid platform"),
    (0, express_validator_1.body)("content").isString().notEmpty().withMessage("Content is required"),
    (0, express_validator_1.body)("followUpDelayMinutes")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Follow-up delay must be a positive number"),
    (0, express_validator_1.body)("displayOrder")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Display order must be a positive number"),
    (0, express_validator_1.body)("availableVariables")
        .optional()
        .isArray()
        .withMessage("Available variables must be an array"),
    (0, express_validator_1.body)("availableVariables.*.name")
        .optional()
        .isString()
        .notEmpty()
        .withMessage("Variable name is required"),
    (0, express_validator_1.body)("availableVariables.*.description")
        .optional()
        .isString()
        .notEmpty()
        .withMessage("Variable description is required"),
    (0, express_validator_1.body)("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean"),
    (0, express_validator_1.body)("tags").optional().isArray().withMessage("Tags must be an array"),
    (0, express_validator_1.body)("tags.*").optional().isString().withMessage("Each tag must be a string"),
];
// Routes with authentication and authorization
router
    .route("/")
    .post(authenticate_1.authenticate, (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), validateTemplateFields, validateRequest_1.default, templateMessages_1.createMessageTemplate)
    .get(templateMessages_1.getAllMessageTemplates);
router
    .route("/:id")
    .get(templateMessages_1.getSingleMessageTemplate)
    .put(authenticate_1.authenticate, (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), validateTemplateFields, validateRequest_1.default, templateMessages_1.updateMessageTemplate)
    .delete(authenticate_1.authenticate, (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), templateMessages_1.deleteMessageTemplate);
exports.default = router;
