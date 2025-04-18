export default class ErrorHandler extends Error {
  public status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ErrorHandler";
    Error.captureStackTrace(this, this.constructor);
  }
}
