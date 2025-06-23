import "reflect-metadata";
import dotenv from "dotenv";
import { DataSource } from "typeorm";
import { Account } from "../models/accounts";
import { ActivityLog } from "../models/activityLogs";
import { Bank } from "../models/bank";
import { Chat } from "../models/chats";
import { AutoMessageTemplate } from "../models/messageTemplates";
import { Message } from "../models/messages";
import { Notification } from "../models/notifications";
import { Permission } from "../models/permissions";
import { Rates } from "../models/rates";
import { RolePermission } from "../models/role_permissions";
import { Role } from "../models/roles";
import { Shift } from "../models/shift";
import { Trade } from "../models/trades";
import { User } from "../models/user";

const isProd = process.env.NODE_ENV === "production";

dotenv.config({ path: isProd ? ".env.production" : ".env" });

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
  schema: "public",
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
  migrations: isProd ? ["dist/migration/**/*.js"] : ["src/migration/**/*.ts"],
  ssl: isProd
    ? {
        rejectUnauthorized: false,
      }
    : false,
});

export default dbConnect;
