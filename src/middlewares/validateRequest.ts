import { NextFunction, Request, Response } from "express";
const { validationResult } = require("express-validator");

const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0].msg;
    return res.status(400).json({ message: firstError, success: false });
  }
  next();
};

export default validateRequest;
