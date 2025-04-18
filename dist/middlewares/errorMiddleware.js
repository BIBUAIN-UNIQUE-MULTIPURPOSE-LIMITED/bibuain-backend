"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errorHandlerMiddleware = (err, req, res, next) => {
    if (process.env.NODE_ENV !== "production") {
        console.error(`Error Stack: ${err.stack}`);
    }
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
};
exports.default = errorHandlerMiddleware;
