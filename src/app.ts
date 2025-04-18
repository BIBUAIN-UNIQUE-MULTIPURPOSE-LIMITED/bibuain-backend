import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cron from "node-cron";
import dbConnect from "./config/database";
import {
  In,
  IsNull,
  LessThan,
  Not,
} from "typeorm";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import path from "path";
import { Trade, TradeStatus } from "./models/trades";
import { User, UserType } from "./models/user";
import errorHandlerMiddleware from "./middlewares/errorMiddleware";
import userRoutes from "./routes/userRoutes";
import adminRoutes from "./routes/adminRoutes";
import chatsRouter from "./routes/chatRoutes";
import activityRoutes from "./routes/activityLogsRoutes";
import bankRoutes from "./routes/bankRoutes";
import messageRouter from "./routes/messagesRoutes";
import tradeRoutes from "./routes/tradeRoutes";
import messageTemplateRoutes from "./routes/templateMessages";
import notificationRoutes from "./routes/notificationRoutes";
import shiftRoutes from "./routes/shiftRoutes";
import accountRoutes from "./routes/accountRoutes";
import { fetchAndStoreTrades } from "./utils/fetchAndStoreTrades";
// import { assignTradesToPayers } from "./utils/assignTradesToPayer";
import { initializeShiftCrons } from "./utils/initiateShifts";
// import {startChatMonitor} from "./controllers/tradeController"
const app = express();

// CORS Configuration
const corsOptions = {
  origin: ["https://app.bibuain.ng", "http://localhost:5173", "*", "https://bibuain-j9nsdjrab-azeezat-nasirs-projects.vercel.app/"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware Setup
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/account", accountRoutes);
app.use("/api/v1/notification", notificationRoutes);
app.use("/api/v1/shift", shiftRoutes);
app.use("/api/v1/trade", tradeRoutes);
app.use("/api/v1/activity", activityRoutes);
app.use("/api/v1/banks", bankRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/chat", chatsRouter);
app.use("/api/v1/message-templates", messageTemplateRoutes);
app.use("/api/v1/message", messageRouter);

// (async () => {
//   try {
//     await startChatMonitor();
//     console.log("Chat monitor started");
//   } catch (err) {
//     console.error("Failed to start chat monitor:", err);
//   }
// })();

// Static File Serving
const uploadsDir = path.resolve();
app.use("/uploads", express.static(path.join(uploadsDir, "uploads")));

// Debugging Endpoint
app.get("/debug", (req: Request, res: Response) => {
  // console.log(req.cookies);
  res.json(req.cookies);
});

// Error Handling Middleware
app.use(errorHandlerMiddleware);

// 404 Handler
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ message: "Resource Not Found!" });
});

export default app;
