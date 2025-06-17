import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { UserType } from "../models/user";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

/*
 * Authentication Middleware
 * Validates JWT token and attaches user information to the request object
 */
declare module "jsonwebtoken" {
  export interface JwtPayload {
    id: string;
    email: string;
    userType: UserType;
  }
}

export interface UserRequest extends Request {
  user?: JwtPayload;
}

/*
 * Middleware to authenticate user using JWT token
 * Checks for token in cookies and verifies it
 * If valid, attaches user information to the request object
 */
export const authenticate = (
  req: UserRequest,
  res: Response,
  next: NextFunction,
): void => {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
    console.error("Authentication error:", err);
  }
};

/*
 * Middleware to check if the user is an admin
 * If user is authenticated and has admin privileges, allows access
 * Otherwise, returns a 403 Forbidden response
 */
export const isAdmin = (
  req: UserRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (req.user.userType !== UserType.ADMIN) {
    res.status(403).json({ message: "Access denied: Admins only" });
    return;
  }

  next();
};

/*
 * Role-based Authorization Middleware
 * Checks if the user has the required role(s) to access a resource
 * If user is authenticated and has the required role, allows access
 * Otherwise, returns a 403 Forbidden response
 */
export const roleAuth = (requiredUserType: UserType | UserType[]) => {
  return (req: UserRequest, res: Response, next: NextFunction): void => {
    try {
      const user = req.user;

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
    } catch (error) {
      console.error("Error in roleAuth middleware:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
};
