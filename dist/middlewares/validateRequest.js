"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { validationResult } = require("express-validator");
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const firstError = errors.array()[0].msg;
        return res.status(400).json({ message: firstError, success: false });
    }
    next();
};
exports.default = validateRequest;
