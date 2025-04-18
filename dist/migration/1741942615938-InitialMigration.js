"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitialMigration1741942615938 = void 0;
class InitialMigration1741942615938 {
    constructor() {
        this.name = 'InitialMigration1741942615938';
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`CREATE TABLE "permissions" ("id" SERIAL NOT NULL, "permissionName" character varying(100) NOT NULL, "module" character varying(50) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_56583ae1f32a17a0925f4a5f893" UNIQUE ("permissionName"), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`);
            yield queryRunner.query(`CREATE TABLE "role_permissions" ("id" SERIAL NOT NULL, "role_id" integer, "permission_id" integer, CONSTRAINT "PK_84059017c90bfcb701b8fa42297" PRIMARY KEY ("id"))`);
            yield queryRunner.query(`CREATE TABLE "roles" ("id" SERIAL NOT NULL, "roleName" character varying(50) NOT NULL, "description" character varying(255), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_992f24b9d80eb1312440ca577f1" UNIQUE ("roleName"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
            yield queryRunner.query(`CREATE TYPE "public"."shifts_shifttype_enum" AS ENUM('morning', 'afternoon', 'night')`);
            yield queryRunner.query(`CREATE TYPE "public"."shifts_status_enum" AS ENUM('active', 'on_break', 'pending_approval', 'approved', 'rejected', 'ended', 'force_closed')`);
            yield queryRunner.query(`CREATE TYPE "public"."shifts_shiftendtype_enum" AS ENUM('admin_force_close', 'pending_admin_approval')`);
            yield queryRunner.query(`CREATE TABLE "shifts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "shiftType" "public"."shifts_shifttype_enum" NOT NULL, "status" "public"."shifts_status_enum" NOT NULL DEFAULT 'active', "isClockedIn" boolean NOT NULL DEFAULT false, "clockInTime" TIMESTAMP, "clockOutTime" TIMESTAMP, "breaks" json, "overtimeMinutes" integer NOT NULL DEFAULT '0', "totalWorkDuration" integer NOT NULL DEFAULT '0', "isLateClockIn" boolean NOT NULL DEFAULT false, "lateMinutes" integer NOT NULL DEFAULT '0', "shiftEndType" "public"."shifts_shiftendtype_enum", "shiftEndReport" character varying, "approvedByAdminId" uuid, "approvalTime" TIMESTAMP, "adminNotes" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "PK_84d692e367e4d6cdf045828768c" PRIMARY KEY ("id"))`);
            yield queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('system', 'individual')`);
            yield queryRunner.query(`CREATE TYPE "public"."notifications_priority_enum" AS ENUM('high', 'medium', 'low')`);
            yield queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "description" text NOT NULL, "type" "public"."notifications_type_enum" NOT NULL DEFAULT 'system', "read" boolean NOT NULL DEFAULT false, "priority" "public"."notifications_priority_enum" NOT NULL DEFAULT 'medium', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid, "related_account_id" uuid, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
            yield queryRunner.query(`CREATE TYPE "public"."users_usertype_enum" AS ENUM('admin', 'payer', 'rater', 'ceo', 'customer-support')`);
            yield queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'inactive', 'suspended')`);
            yield queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(100) NOT NULL, "password" character varying(255), "userType" "public"."users_usertype_enum" NOT NULL, "avatar" character varying, "fullName" character varying(100) NOT NULL, "phone" character varying(15), "twoFaEnabled" boolean NOT NULL DEFAULT true, "twoFaSecret" character varying(255), "twoFaVerified" boolean NOT NULL DEFAULT false, "emailVerificationCode" character varying, "emailVerificationExp" TIMESTAMP, "phoneVerificationCode" character varying(6), "phoneVerificationExp" TIMESTAMP, "isEmailVerified" boolean NOT NULL DEFAULT false, "isPhoneVerified" boolean NOT NULL DEFAULT false, "resetPasswordToken" character varying(255), "resetPasswordExp" TIMESTAMP, "twoFaCode" character varying(6), "twoFaExpires" TIMESTAMP, "clockedIn" boolean NOT NULL DEFAULT false, "status" "public"."users_status_enum" NOT NULL DEFAULT 'active', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "role_id" integer, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "UQ_2a223a16ab656df79dca16185fb" UNIQUE ("emailVerificationCode"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
            yield queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "seen" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "attachments" json, "chatId" uuid NOT NULL, "senderId" uuid NOT NULL, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
            yield queryRunner.query(`CREATE TABLE "chats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0117647b3c4a4e5ff198aeb6206" PRIMARY KEY ("id"))`);
            yield queryRunner.query(`CREATE TABLE "banks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bankName" character varying(100) NOT NULL, "accountName" character varying(100) NOT NULL, "additionalNotes" character varying(255), "accountNumber" character varying(50) NOT NULL, "funds" double precision NOT NULL DEFAULT '0', "logs" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3975b5f684ec241e3901db62d77" PRIMARY KEY ("id"))`);
            yield queryRunner.query(`CREATE TYPE "public"."trades_platform_enum" AS ENUM('paxful', 'noones', 'binance')`);
            yield queryRunner.query(`CREATE TYPE "public"."trades_status_enum" AS ENUM('pending', 'assigned', 'completed', 'cancelled', 'disputed')`);
            yield queryRunner.query(`CREATE TABLE "trades" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tradeHash" character varying(100) NOT NULL, "accountId" character varying(100) NOT NULL, "platform" "public"."trades_platform_enum" NOT NULL, "status" "public"."trades_status_enum" NOT NULL DEFAULT 'pending', "tradeStatus" character varying NOT NULL, "amount" numeric(20,2) NOT NULL, "cryptoAmountRequested" numeric(20,8) NOT NULL, "cryptoAmountTotal" numeric(20,8) NOT NULL, "feeCryptoAmount" numeric(20,8) NOT NULL, "flagged" boolean NOT NULL DEFAULT false, "feePercentage" numeric(10,2) NOT NULL, "sourceId" character varying(100) NOT NULL, "responderUsername" character varying(100) NOT NULL, "ownerUsername" character varying(100) NOT NULL, "paymentMethod" character varying(100) NOT NULL, "locationIso" character varying(2), "fiatCurrency" character varying(3) NOT NULL, "cryptoCurrencyCode" character varying(10) NOT NULL, "isActiveOffer" boolean NOT NULL DEFAULT false, "offerHash" character varying(100), "margin" numeric(10,2), "dollarRate" numeric(20,2), "btcRate" numeric(20,8), "btcAmount" numeric(20,8), "assigned_payer_id" uuid, "assignedAt" TIMESTAMP, "completedAt" TIMESTAMP, "notes" character varying(255), "platformMetadata" jsonb, "activityLog" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_TRADE_HASH" UNIQUE ("tradeHash"), CONSTRAINT "PK_c6d7c36a837411ba5194dc58595" PRIMARY KEY ("id")); COMMENT ON COLUMN "trades"."accountId" IS 'External account identifier for the trade'`);
            yield queryRunner.query(`CREATE UNIQUE INDEX "IDX_b2de1d752e0886761f55af9a39" ON "trades" ("tradeHash") `);
            yield queryRunner.query(`CREATE INDEX "IDX_f8103b383ee5c33a3d3a72d95b" ON "trades" ("accountId") `);
            yield queryRunner.query(`CREATE INDEX "IDX_ACCOUNT_PLATFORM" ON "trades" ("accountId", "platform") `);
            yield queryRunner.query(`CREATE TYPE "public"."escalated_trades_status_enum" AS ENUM('pending', 'resolved', 'assigned')`);
            yield queryRunner.query(`CREATE TYPE "public"."escalated_trades_platform_enum" AS ENUM('paxful', 'noones', 'binance')`);
            yield queryRunner.query(`CREATE TABLE "escalated_trades" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."escalated_trades_status_enum" NOT NULL DEFAULT 'pending', "platform" "public"."escalated_trades_platform_enum" NOT NULL, "complaint" text, "amount" numeric(10,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "trade_id" uuid NOT NULL, "assignedCcAgentId" uuid, "chatId" uuid, "assignedPayerId" uuid, "escalatedById" uuid, CONSTRAINT "REL_17cef794c1aef3c1919b452804" UNIQUE ("trade_id"), CONSTRAINT "PK_7923d4dfe4a10a0be5632ecacdf" PRIMARY KEY ("id"))`);
            yield queryRunner.query(`CREATE TYPE "public"."activity_logs_activity_enum" AS ENUM('rate_update', 'user_login', 'user_logout', 'login_failed', 'two_fa_generated', 'two_fa_verified', 'two_fa_failed', 'user_create', 'user_update', 'user_delete', 'user_profile_update', 'user_status_change', 'email_verification', 'email_verification_request', 'email_verification_failed', 'email_verification_expired', 'password_reset_request', 'password_reset', 'password_reset_failed', 'password_change', 'password_change_failed', 'shift_create', 'shift_update', 'shift_delete', 'phone_verification_request', 'phone_verification', 'phone_verification_failed', 'two_fa_enabled', 'two_fa_disabled', 'two_fa_status_change', 'system', 'system_error', 'system_warning', 'system_maintenance', 'session_expired', 'session_terminated', 'role_assigned', 'role_removed', 'role_updated', 'api_access_granted', 'api_access_revoked', 'api_key_generated', 'data_export', 'data_import', 'account_locked', 'account_unlocked', 'account_suspended', 'account_reactivated', 'TRADE_CREATED', 'TRADE_UPDATED', 'TRADE_ASSIGNED', 'TRADE_COMPLETED', 'TRADE_CANCELLED', 'TRADE_DISPUTED', 'TRADE_ESCALATED', 'shift_clock_in', 'shift_clock_out', 'shift_break_start', 'shift_break_end', 'shift_break_duration_updated', 'shift_status_updated', 'shift_force_closed', 'shift_deleted', 'shift_approved', 'shift_rejected', 'shift_report_submitted', 'shift_time_recorded', 'shift_overtime_recorded', 'shift_late_arrival', 'shift_early_departure', 'shift_missed_clockin', 'shift_missed_clockout', 'shift_break_violation', 'shift_schedule_modified', 'break_duration_updated', 'break_limit_exceeded', 'break_policy_violation', 'shift_audit_completed', 'shift_policy_violation', 'shift_correction_requested', 'shift_correction_approved', 'shift_correction_rejected')`);
            yield queryRunner.query(`CREATE TABLE "activity_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "userRole" character varying, "activity" "public"."activity_logs_activity_enum" NOT NULL, "description" character varying(255) NOT NULL, "details" jsonb, "isSystemGenerated" boolean NOT NULL DEFAULT false, "metadata" jsonb, "user_id" uuid, CONSTRAINT "PK_f25287b6140c5ba18d38776a796" PRIMARY KEY ("id"))`);
            yield queryRunner.query(`CREATE TYPE "public"."message_templates_type_enum" AS ENUM('welcome', 'payment_made', 'coin_release')`);
            yield queryRunner.query(`CREATE TYPE "public"."message_templates_platform_enum" AS ENUM('paxful', 'noones')`);
            yield queryRunner.query(`CREATE TABLE "message_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."message_templates_type_enum" NOT NULL, "platform" "public"."message_templates_platform_enum" NOT NULL, "content" text NOT NULL, "availableVariables" jsonb, "followUpDelayMinutes" integer, "followUpContent" jsonb, "isActive" boolean NOT NULL DEFAULT true, "displayOrder" integer NOT NULL DEFAULT '0', "feedbackTemplates" jsonb, "tags" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "createdBy" uuid NOT NULL, "updatedBy" uuid, CONSTRAINT "PK_9ac2bd9635be662d183f314947d" PRIMARY KEY ("id")); COMMENT ON COLUMN "message_templates"."type" IS 'Type of auto-message template'; COMMENT ON COLUMN "message_templates"."platform" IS 'Platform for which this template is used'; COMMENT ON COLUMN "message_templates"."content" IS 'Content of the message template with variable placeholders'; COMMENT ON COLUMN "message_templates"."availableVariables" IS 'Available variables that can be used in the template'; COMMENT ON COLUMN "message_templates"."followUpDelayMinutes" IS 'Delay in minutes before sending follow-up message'; COMMENT ON COLUMN "message_templates"."followUpContent" IS 'Follow-up message content if needed'; COMMENT ON COLUMN "message_templates"."isActive" IS 'Whether this template is currently active'; COMMENT ON COLUMN "message_templates"."displayOrder" IS 'Order of template when multiple templates exist for same type'; COMMENT ON COLUMN "message_templates"."feedbackTemplates" IS 'Feedback templates for automated feedback'; COMMENT ON COLUMN "message_templates"."tags" IS 'Tags for template categorization and filtering'; COMMENT ON COLUMN "message_templates"."createdBy" IS 'ID of admin who created this template'; COMMENT ON COLUMN "message_templates"."updatedBy" IS 'ID of admin who last updated this template'`);
            yield queryRunner.query(`CREATE INDEX "IDX_47c34966ec3fe38e6545ced04d" ON "message_templates" ("type", "platform", "isActive") `);
            yield queryRunner.query(`CREATE TABLE "rates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sellingPrice" numeric(50,8) NOT NULL, "costPricePaxful" numeric(50,8) NOT NULL, "costPriceNoones" numeric(50,8) NOT NULL, "usdtNgnRate" numeric(50,8) NOT NULL, "markup2" numeric(50,8) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2c804ed4019b80ce48eedba5cec" PRIMARY KEY ("id"))`);
            yield queryRunner.query(`CREATE TYPE "public"."accounts_platform_enum" AS ENUM('noones', 'paxful', 'binance')`);
            yield queryRunner.query(`CREATE TYPE "public"."accounts_status_enum" AS ENUM('active', 'inactive', 'suspended')`);
            yield queryRunner.query(`CREATE TABLE "accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "account_username" character varying(100) NOT NULL, "api_key" text NOT NULL, "api_secret" text NOT NULL, "platform" "public"."accounts_platform_enum" NOT NULL, "status" "public"."accounts_status_enum" NOT NULL DEFAULT 'active', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id")); COMMENT ON COLUMN "accounts"."account_username" IS 'Account username on the platform'`);
            yield queryRunner.query(`CREATE TABLE "chat_participants" ("chat_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_36c99e4a017767179cc49d0ac74" PRIMARY KEY ("chat_id", "user_id"))`);
            yield queryRunner.query(`CREATE INDEX "IDX_9946d299e9ccfbee23aa40c554" ON "chat_participants" ("chat_id") `);
            yield queryRunner.query(`CREATE INDEX "IDX_b4129b3e21906ca57b503a1d83" ON "chat_participants" ("user_id") `);
            yield queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_178199805b901ccd220ab7740ec" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
            yield queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_17022daf3f885f7d35423e9971e" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
            yield queryRunner.query(`ALTER TABLE "shifts" ADD CONSTRAINT "FK_dc1e84f1d1e75e990952c40859c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
            yield queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
            yield queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_617e0dec72043a889cf5bb16c17" FOREIGN KEY ("related_account_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
            yield queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
            yield queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_36bc604c820bb9adc4c75cd4115" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
            yield queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
            yield queryRunner.query(`ALTER TABLE "trades" ADD CONSTRAINT "FK_198b0372dec071a6d587cc3f94b" FOREIGN KEY ("assigned_payer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
            yield queryRunner.query(`ALTER TABLE "escalated_trades" ADD CONSTRAINT "FK_17cef794c1aef3c1919b4528046" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
            yield queryRunner.query(`ALTER TABLE "escalated_trades" ADD CONSTRAINT "FK_8c42fe52f5d531efc84622a87d9" FOREIGN KEY ("assignedCcAgentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
            yield queryRunner.query(`ALTER TABLE "escalated_trades" ADD CONSTRAINT "FK_a809e3f9509e9f7eace6f5ee411" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
            yield queryRunner.query(`ALTER TABLE "escalated_trades" ADD CONSTRAINT "FK_2b008f9d67bd698b77dc1717e39" FOREIGN KEY ("assignedPayerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
            yield queryRunner.query(`ALTER TABLE "escalated_trades" ADD CONSTRAINT "FK_6689446c184e3d589610c852234" FOREIGN KEY ("escalatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
            yield queryRunner.query(`ALTER TABLE "activity_logs" ADD CONSTRAINT "FK_d54f841fa5478e4734590d44036" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
            yield queryRunner.query(`ALTER TABLE "chat_participants" ADD CONSTRAINT "FK_9946d299e9ccfbee23aa40c5545" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
            yield queryRunner.query(`ALTER TABLE "chat_participants" ADD CONSTRAINT "FK_b4129b3e21906ca57b503a1d834" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`ALTER TABLE "chat_participants" DROP CONSTRAINT "FK_b4129b3e21906ca57b503a1d834"`);
            yield queryRunner.query(`ALTER TABLE "chat_participants" DROP CONSTRAINT "FK_9946d299e9ccfbee23aa40c5545"`);
            yield queryRunner.query(`ALTER TABLE "activity_logs" DROP CONSTRAINT "FK_d54f841fa5478e4734590d44036"`);
            yield queryRunner.query(`ALTER TABLE "escalated_trades" DROP CONSTRAINT "FK_6689446c184e3d589610c852234"`);
            yield queryRunner.query(`ALTER TABLE "escalated_trades" DROP CONSTRAINT "FK_2b008f9d67bd698b77dc1717e39"`);
            yield queryRunner.query(`ALTER TABLE "escalated_trades" DROP CONSTRAINT "FK_a809e3f9509e9f7eace6f5ee411"`);
            yield queryRunner.query(`ALTER TABLE "escalated_trades" DROP CONSTRAINT "FK_8c42fe52f5d531efc84622a87d9"`);
            yield queryRunner.query(`ALTER TABLE "escalated_trades" DROP CONSTRAINT "FK_17cef794c1aef3c1919b4528046"`);
            yield queryRunner.query(`ALTER TABLE "trades" DROP CONSTRAINT "FK_198b0372dec071a6d587cc3f94b"`);
            yield queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_2db9cf2b3ca111742793f6c37ce"`);
            yield queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_36bc604c820bb9adc4c75cd4115"`);
            yield queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1"`);
            yield queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_617e0dec72043a889cf5bb16c17"`);
            yield queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
            yield queryRunner.query(`ALTER TABLE "shifts" DROP CONSTRAINT "FK_dc1e84f1d1e75e990952c40859c"`);
            yield queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_17022daf3f885f7d35423e9971e"`);
            yield queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_178199805b901ccd220ab7740ec"`);
            yield queryRunner.query(`DROP INDEX "public"."IDX_b4129b3e21906ca57b503a1d83"`);
            yield queryRunner.query(`DROP INDEX "public"."IDX_9946d299e9ccfbee23aa40c554"`);
            yield queryRunner.query(`DROP TABLE "chat_participants"`);
            yield queryRunner.query(`DROP TABLE "accounts"`);
            yield queryRunner.query(`DROP TYPE "public"."accounts_status_enum"`);
            yield queryRunner.query(`DROP TYPE "public"."accounts_platform_enum"`);
            yield queryRunner.query(`DROP TABLE "rates"`);
            yield queryRunner.query(`DROP INDEX "public"."IDX_47c34966ec3fe38e6545ced04d"`);
            yield queryRunner.query(`DROP TABLE "message_templates"`);
            yield queryRunner.query(`DROP TYPE "public"."message_templates_platform_enum"`);
            yield queryRunner.query(`DROP TYPE "public"."message_templates_type_enum"`);
            yield queryRunner.query(`DROP TABLE "activity_logs"`);
            yield queryRunner.query(`DROP TYPE "public"."activity_logs_activity_enum"`);
            yield queryRunner.query(`DROP TABLE "escalated_trades"`);
            yield queryRunner.query(`DROP TYPE "public"."escalated_trades_platform_enum"`);
            yield queryRunner.query(`DROP TYPE "public"."escalated_trades_status_enum"`);
            yield queryRunner.query(`DROP INDEX "public"."IDX_ACCOUNT_PLATFORM"`);
            yield queryRunner.query(`DROP INDEX "public"."IDX_f8103b383ee5c33a3d3a72d95b"`);
            yield queryRunner.query(`DROP INDEX "public"."IDX_b2de1d752e0886761f55af9a39"`);
            yield queryRunner.query(`DROP TABLE "trades"`);
            yield queryRunner.query(`DROP TYPE "public"."trades_status_enum"`);
            yield queryRunner.query(`DROP TYPE "public"."trades_platform_enum"`);
            yield queryRunner.query(`DROP TABLE "banks"`);
            yield queryRunner.query(`DROP TABLE "chats"`);
            yield queryRunner.query(`DROP TABLE "messages"`);
            yield queryRunner.query(`DROP TABLE "users"`);
            yield queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
            yield queryRunner.query(`DROP TYPE "public"."users_usertype_enum"`);
            yield queryRunner.query(`DROP TABLE "notifications"`);
            yield queryRunner.query(`DROP TYPE "public"."notifications_priority_enum"`);
            yield queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
            yield queryRunner.query(`DROP TABLE "shifts"`);
            yield queryRunner.query(`DROP TYPE "public"."shifts_shiftendtype_enum"`);
            yield queryRunner.query(`DROP TYPE "public"."shifts_status_enum"`);
            yield queryRunner.query(`DROP TYPE "public"."shifts_shifttype_enum"`);
            yield queryRunner.query(`DROP TABLE "roles"`);
            yield queryRunner.query(`DROP TABLE "role_permissions"`);
            yield queryRunner.query(`DROP TABLE "permissions"`);
        });
    }
}
exports.InitialMigration1741942615938 = InitialMigration1741942615938;
