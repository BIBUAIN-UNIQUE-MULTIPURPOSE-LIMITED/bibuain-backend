"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMultipleFiles = exports.uploadSingleFile = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
// Configure storage
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        const extname = path_1.default.extname(file.originalname);
        cb(null, `${file.fieldname}-${Date.now()}${extname}`);
    },
});
const fileFilter = (req, file, cb) => {
    const allowedFileTypes = /pdf|docx?|xlsx?|txt|jpe?g|png|webp|zip|csv/;
    const mimeTypes = /application\/(pdf|msword|vnd.openxmlformats-officedocument.wordprocessingml.document|vnd.ms-excel|vnd.openxmlformats-officedocument.spreadsheetml.sheet|octet-stream|zip)|text\/plain|image\/(jpeg|png|webp)|text\/csv/;
    const extname = path_1.default.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;
    if (allowedFileTypes.test(extname) && mimeTypes.test(mimeType)) {
        cb(null, true);
    }
    else {
        const error = new errorHandler_1.default("Invalid file type", 400);
        cb(error, false);
    }
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 },
});
exports.uploadSingleFile = upload.single("file");
exports.uploadMultipleFiles = upload.array("files", 5);
