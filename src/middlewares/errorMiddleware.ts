import { Request, Response, NextFunction } from "express";

type ErrorHandler = {
  message?: string;
  status?: number;
  stack?: string;
};

const errorHandlerMiddleware = (
  err: ErrorHandler,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (process.env.NODE_ENV !== "production") {
    console.error(`Error Stack: ${err.stack}`);
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};

export default errorHandlerMiddleware;
