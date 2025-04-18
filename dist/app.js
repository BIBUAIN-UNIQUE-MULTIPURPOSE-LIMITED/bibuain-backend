"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const errorMiddleware_1 = __importDefault(require("./middlewares/errorMiddleware"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const activityLogsRoutes_1 = __importDefault(require("./routes/activityLogsRoutes"));
const bankRoutes_1 = __importDefault(require("./routes/bankRoutes"));
const messagesRoutes_1 = __importDefault(require("./routes/messagesRoutes"));
const tradeRoutes_1 = __importDefault(require("./routes/tradeRoutes"));
const templateMessages_1 = __importDefault(require("./routes/templateMessages"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const shiftRoutes_1 = __importDefault(require("./routes/shiftRoutes"));
const accountRoutes_1 = __importDefault(require("./routes/accountRoutes"));
// import {startChatMonitor} from "./controllers/tradeController"
const app = (0, express_1.default)();
// CORS Configuration
const corsOptions = {
    origin: ["https://app.bibuain.ng", "http://localhost:5173", "*", "https://bibuain-j9nsdjrab-azeezat-nasirs-projects.vercel.app/"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
};
// Middleware Setup
app.use((0, cors_1.default)(corsOptions));
app.use((0, cookie_parser_1.default)());
app.use(body_parser_1.default.json());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// // Cron Job for Trade Assignment
// cron
//   .schedule("*/10 * * * * *", async () => {
//     console.log("Running trade assignment job...");
//     await fetchAndStoreTrades();
//     await assignTradesToPayers();
//   })
//   .start();
// initializeShiftCrons();
// API Routes
app.use("/api/v1/admin", adminRoutes_1.default);
app.use("/api/v1/account", accountRoutes_1.default);
app.use("/api/v1/notification", notificationRoutes_1.default);
app.use("/api/v1/shift", shiftRoutes_1.default);
app.use("/api/v1/trade", tradeRoutes_1.default);
app.use("/api/v1/activity", activityLogsRoutes_1.default);
app.use("/api/v1/banks", bankRoutes_1.default);
app.use("/api/v1/user", userRoutes_1.default);
app.use("/api/v1/chat", chatRoutes_1.default);
app.use("/api/v1/message-templates", templateMessages_1.default);
app.use("/api/v1/message", messagesRoutes_1.default);
// (async () => {
//   try {
//     await startChatMonitor();
//     console.log("Chat monitor started");
//   } catch (err) {
//     console.error("Failed to start chat monitor:", err);
//   }
// })();
// Static File Serving
const uploadsDir = path_1.default.resolve();
app.use("/uploads", express_1.default.static(path_1.default.join(uploadsDir, "uploads")));
// Debugging Endpoint
app.get("/debug", (req, res) => {
    // console.log(req.cookies);
    res.json(req.cookies);
});
// Error Handling Middleware
app.use(errorMiddleware_1.default);
// 404 Handler
app.use((req, res, next) => {
    res.status(404).json({ message: "Resource Not Found!" });
});
exports.default = app;
