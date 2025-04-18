import multer, { FileFilterCallback } from "multer";
import path from "path";
import { Request } from "express";
import errorHandler from "../utils/errorHandler";

// Configure storage
const storage = multer.diskStorage({
  destination: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    cb(null, "uploads/");
  },
  filename: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const extname = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${Date.now()}${extname}`);
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowedFileTypes = /pdf|docx?|xlsx?|txt|jpe?g|png|webp|zip|csv/;
  const mimeTypes =
    /application\/(pdf|msword|vnd.openxmlformats-officedocument.wordprocessingml.document|vnd.ms-excel|vnd.openxmlformats-officedocument.spreadsheetml.sheet|octet-stream|zip)|text\/plain|image\/(jpeg|png|webp)|text\/csv/;

  const extname = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;

  if (allowedFileTypes.test(extname) && mimeTypes.test(mimeType)) {
    cb(null, true);
  } else {
    const error = new errorHandler("Invalid file type", 400);
    cb(error as unknown as null, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const uploadSingleFile = upload.single("file");

export const uploadMultipleFiles = upload.array("files", 5);
