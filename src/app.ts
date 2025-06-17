import path from "path";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Request, type Response } from "express";
import cron from "node-cron";
import { reloadFreshBanks } from "./controllers/bankController";
import {
  pollAndAssignLiveTrades,
  processTradeQueue,
} from "./controllers/tradeController";
import errorHandlerMiddleware from "./middlewares/errorMiddleware";
import accountRoutes from "./routes/accountRoutes";
import activityRoutes from "./routes/activityLogsRoutes";
import adminRoutes from "./routes/adminRoutes";
import bankRoutes from "./routes/bankRoutes";
import chatsRouter from "./routes/chatRoutes";
import messageRouter from "./routes/messagesRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import shiftRoutes from "./routes/shiftRoutes";
import messageTemplateRoutes from "./routes/templateMessages";
import tradeRoutes from "./routes/tradeRoutes";
import userRoutes from "./routes/userRoutes";

const app = express();
app.disable("x-powered-by");

// CORS Configuration
const corsOptions = {
  origin: [
    "https://app.bibuain.ng",
    "http://localhost:5173",
    "https://main.d251fvvwfaaim4.amplifyapp.com",
  ],
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

if (process.env.NODE_ENV !== "test") {
  // poll & assign every 5 seconds
  cron.schedule(
    "*/6 * * * * *",
    async () => {
      try {
        await pollAndAssignLiveTrades();
      } catch (e) {
        // console.error("[Cron] pollAndAssignLiveTrades error:", e);
        throw e;
      }
    },
    { scheduled: true, timezone: "Africa/Lagos" },
  );

  // process the queue every 5 seconds
  cron.schedule(
    "*/5 * * * * *",
    async () => {
      try {
        await processTradeQueue();
      } catch (e) {
        // console.error("[Cron] processTradeQueue error:", e);
        throw e;
      }
    },
    { scheduled: true, timezone: "Africa/Lagos" },
  );
}

cron.schedule(
  "0 1 * * *",
  async () => {
    try {
      await reloadFreshBanks();
      console.log("✅ Fresh banks reloaded at", new Date().toISOString());
    } catch (err) {
      console.error("❌ Error reloading fresh banks:", err);
    }
  },
  {
    scheduled: true,
    timezone: "Africa/Lagos",
  },
);

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

// Static File Serving
const uploadsDir = path.resolve();
app.use("/uploads", express.static(path.join(uploadsDir, "uploads")));

// Debugging Endpoint
app.get("/debug", (req: Request, res: Response) => {
  res.json(req.cookies);
});

// Error Handling Middleware
app.use(errorHandlerMiddleware);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "Resource Not Found!" });
});

export default app;
