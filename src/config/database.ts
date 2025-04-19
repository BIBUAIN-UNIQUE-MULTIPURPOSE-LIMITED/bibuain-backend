import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { User } from "../models/user";
import { Role } from "../models/roles";
import { RolePermission } from "../models/role_permissions";
import { Permission } from "../models/permissions";
import { Chat } from "../models/chats";
import { Message } from "../models/messages";
import { Bank } from "../models/bank";
import { Shift } from "../models/shift";
import { ActivityLog } from "../models/activityLogs";
import { Trade } from "../models/trades";
import { Notification } from "../models/notifications";
import { AutoMessageTemplate } from "../models/messageTemplates";
import { Rates } from "../models/rates";
import { Account } from "../models/accounts";

dotenv.config();

const db_name = process.env.DB_NAME;
const username = process.env.DB_USER;
const password = process.env.DB_PASSWORD;
const host = process.env.DB_HOST;


const dbConnect = new DataSource({
  type: "postgres",
  host: `${host}`,
  port: 5432,
  username: username,
  password: password,
  database: db_name,
  synchronize: false,
  logging: false,
  entities: [
    User,
    Account,
    AutoMessageTemplate,
    Notification,
    Rates,
    ActivityLog,
    Role,
    Trade,
    Shift,
    Bank,
    RolePermission,
    Permission,
    Chat,
    Message,
  ],
  // Uncomment if you want to use migrations
  migrations: ["src/migration/**/*.ts"],
});

// Initialize database connection
dbConnect.initialize()
  .then(() => console.log("Database connected successfully!"))
  .catch((error) => console.error("Database connection error:", error));

export default dbConnect;