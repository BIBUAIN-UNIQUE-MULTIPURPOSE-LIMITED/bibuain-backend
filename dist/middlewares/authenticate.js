"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleAuth = exports.isAdmin = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_1 = require("../models/user"); // Import User model and UserType enum
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
// Middleware for authentication
const authenticate = (req, res, next) => {
    var _a;
    const token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token;
    if (!token) {
        res.status(401).json({ message: "Authentication required" });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    }
    catch (err) {
        res.status(401).json({ message: "Invalid or expired token" });
    }
};
exports.authenticate = authenticate;
// Middleware for checking if the user is an admin
const isAdmin = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ message: "Authentication required" });
        return;
    }
    if (req.user.userType !== user_1.UserType.ADMIN) {
        res.status(403).json({ message: "Access denied: Admins only" });
        return;
    }
    next();
};
exports.isAdmin = isAdmin;
// Middleware for role-based authorization
const roleAuth = (requiredUserType) => {
    return (req, res, next) => {
        try {
            const user = req.user; // Directly accessing user from the request
            if (!user) {
                res.status(401).json({ message: "Authentication required" });
                return;
            }
            const requiredRoles = Array.isArray(requiredUserType)
                ? requiredUserType
                : [requiredUserType];
            if (!requiredRoles.includes(user.userType)) {
                res.status(403).json({ message: "Access denied: Unauthorized role" });
                return;
            }
            next();
        }
        catch (error) {
            console.error("Error in roleAuth middleware:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    };
};
exports.roleAuth = roleAuth;
