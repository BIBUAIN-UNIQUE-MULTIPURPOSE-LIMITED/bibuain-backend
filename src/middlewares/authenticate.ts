import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User, UserType } from "../models/user"; // Import User model and UserType enum

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// Modify the JwtPayload interface to match the User model's properties
declare module "jsonwebtoken" {
  export interface JwtPayload {
    id: string;
    email: string;
    userType: UserType; // Use UserType enum here
  }
}

export interface UserRequest extends Request {
  user?: JwtPayload;
}

// Middleware for authentication
export const authenticate = (
  req: UserRequest,
  res: Response,
  next: NextFunction
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
  }
};

// Middleware for checking if the user is an admin
export const isAdmin = (
  req: UserRequest,
  res: Response,
  next: NextFunction
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

// Middleware for role-based authorization
export const roleAuth = (requiredUserType: UserType | UserType[]) => {
  return (req: UserRequest, res: Response, next: NextFunction): void => {
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
    } catch (error) {
      console.error("Error in roleAuth middleware:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
};
