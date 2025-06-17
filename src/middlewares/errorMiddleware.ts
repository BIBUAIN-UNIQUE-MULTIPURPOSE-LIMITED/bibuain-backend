import { Request, Response } from "express";

type ErrorHandler = {
  message?: string;
  status?: number;
  stack?: string;
};

/**
 * Error Handler Middleware
 * This middleware handles errors thrown in the application
 * It logs the error stack in development mode and sends a JSON response
 */
const errorHandlerMiddleware = (
  err: ErrorHandler,
  req: Request,
  res: Response,
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
