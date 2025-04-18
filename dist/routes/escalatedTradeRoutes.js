"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const validateRequest_1 = __importDefault(require("../middlewares/validateRequest"));
const escalatedTradesController_1 = require("../controllers/escalatedTradesController");
const escalatedTrades_1 = require("../models/escalatedTrades");
const authenticate_1 = require("../middlewares/authenticate");
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate);
// Route to escalate a trade
router.post("/escalate", [
    (0, express_validator_1.body)("tradeId").notEmpty().withMessage("Trade ID is required."),
    (0, express_validator_1.body)("platform").notEmpty().withMessage("Platform is required."),
    (0, express_validator_1.body)("complaint")
        .isString()
        .notEmpty()
        .withMessage("Complaint is required."),
    (0, express_validator_1.body)("amount").isNumeric().withMessage("Amount must be a number."),
    (0, express_validator_1.body)("assignedPayerId").isUUID().withMessage("Invalid payer ID."),
    (0, express_validator_1.body)("escalatedById").isUUID().withMessage("Invalid escalatedBy ID."),
], validateRequest_1.default, escalatedTradesController_1.escalateTrade);
// Route to delete a trade
router.delete("/:id", [(0, express_validator_1.param)("id").isUUID().withMessage("Invalid trade ID.")], validateRequest_1.default, escalatedTradesController_1.deleteTrade);
// Route to fetch all trades
router.get("/all", [
    (0, express_validator_1.query)("status")
        .optional()
        .isIn(Object.values(escalatedTrades_1.TradeStatus))
        .withMessage("Invalid status value."),
], validateRequest_1.default, escalatedTradesController_1.getAllTrades);
// Route to fetch a specific trade by ID
router.get("/:id", [(0, express_validator_1.param)("id").isUUID().withMessage("Invalid trade ID.")], validateRequest_1.default, escalatedTradesController_1.getTradeById);
// Route to update a trade
router.put("/:id", [
    (0, express_validator_1.param)("id").isUUID().withMessage("Invalid trade ID."),
    (0, express_validator_1.body)().isObject().withMessage("Request body must be an object."),
], validateRequest_1.default, escalatedTradesController_1.updateTrade);
exports.default = router;
