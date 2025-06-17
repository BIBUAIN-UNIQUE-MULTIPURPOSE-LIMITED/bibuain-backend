import type { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";

/**
 * Middleware to validate incoming requests using express-validator
 * It checks for validation errors and returns a 400 response if any are found
 */
const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0].msg;
    return res.status(400).json({ message: firstError, success: false });
  }
  next();
};

export default validateRequest;
