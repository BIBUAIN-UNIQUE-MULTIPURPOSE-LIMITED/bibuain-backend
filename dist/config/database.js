"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const dotenv_1 = __importDefault(require("dotenv"));
const user_1 = require("../models/user");
const roles_1 = require("../models/roles");
const role_permissions_1 = require("../models/role_permissions");
const permissions_1 = require("../models/permissions");
const chats_1 = require("../models/chats");
const messages_1 = require("../models/messages");
const bank_1 = require("../models/bank");
const shift_1 = require("../models/shift");
const activityLogs_1 = require("../models/activityLogs");
const trades_1 = require("../models/trades");
const notifications_1 = require("../models/notifications");
const messageTemplates_1 = require("../models/messageTemplates");
const rates_1 = require("../models/rates");
const accounts_1 = require("../models/accounts");
dotenv_1.default.config();
const db_name = process.env.DB_NAME;
const username = process.env.DB_USER;
const password = process.env.DB_PASSWORD;
const host = process.env.DB_HOST;
const dbConnect = new typeorm_1.DataSource({
    type: "postgres",
    host: `${host}`,
    port: 5432,
    username: username,
    password: password,
    database: db_name,
    synchronize: false,
    logging: true,
    entities: [
        user_1.User,
        accounts_1.Account,
        messageTemplates_1.AutoMessageTemplate,
        notifications_1.Notification,
        rates_1.Rates,
        activityLogs_1.ActivityLog,
        roles_1.Role,
        trades_1.Trade,
        shift_1.Shift,
        bank_1.Bank,
        role_permissions_1.RolePermission,
        permissions_1.Permission,
        chats_1.Chat,
        messages_1.Message,
    ],
    // Uncomment if you want to use migrations
    migrations: ["src/migration/**/*.ts"],
});
// Initialize database connection
dbConnect.initialize()
    .then(() => console.log("Database connected successfully!"))
    .catch((error) => console.error("Database connection error:", error));
exports.default = dbConnect;
