"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityLog = exports.ActivityType = void 0;
const typeorm_1 = require("typeorm");
const user_1 = require("./user");
var ActivityType;
(function (ActivityType) {
    // Rate Related
    ActivityType["RATE_UPDATE"] = "rate_update";
    // User Authentication
    ActivityType["USER_LOGIN"] = "user_login";
    ActivityType["USER_LOGOUT"] = "user_logout";
    ActivityType["LOGIN_FAILED"] = "login_failed";
    ActivityType["TWO_FA_GENERATED"] = "two_fa_generated";
    ActivityType["TWO_FA_VERIFIED"] = "two_fa_verified";
    ActivityType["TWO_FA_FAILED"] = "two_fa_failed";
    ActivityType["USER_CREATE"] = "user_create";
    ActivityType["USER_UPDATE"] = "user_update";
    ActivityType["USER_DELETE"] = "user_delete";
    ActivityType["USER_PROFILE_UPDATE"] = "user_profile_update";
    ActivityType["USER_STATUS_CHANGE"] = "user_status_change";
    ActivityType["EMAIL_VERIFICATION"] = "email_verification";
    ActivityType["EMAIL_VERIFICATION_REQUEST"] = "email_verification_request";
    ActivityType["EMAIL_VERIFICATION_FAILED"] = "email_verification_failed";
    ActivityType["EMAIL_VERIFICATION_EXPIRED"] = "email_verification_expired";
    ActivityType["PASSWORD_RESET_REQUEST"] = "password_reset_request";
    ActivityType["PASSWORD_RESET"] = "password_reset";
    ActivityType["PASSWORD_RESET_FAILED"] = "password_reset_failed";
    ActivityType["PASSWORD_CHANGE"] = "password_change";
    ActivityType["PASSWORD_CHANGE_FAILED"] = "password_change_failed";
    ActivityType["SHIFT_CREATE"] = "shift_create";
    ActivityType["SHIFT_UPDATE"] = "shift_update";
    ActivityType["SHIFT_DELETE"] = "shift_delete";
    ActivityType["PHONE_VERIFICATION_REQUEST"] = "phone_verification_request";
    ActivityType["PHONE_VERIFICATION"] = "phone_verification";
    ActivityType["PHONE_VERIFICATION_FAILED"] = "phone_verification_failed";
    ActivityType["TWO_FA_ENABLED"] = "two_fa_enabled";
    ActivityType["TWO_FA_DISABLED"] = "two_fa_disabled";
    ActivityType["TWO_FA_STATUS_CHANGE"] = "two_fa_status_change";
    ActivityType["SYSTEM"] = "system";
    ActivityType["SYSTEM_ERROR"] = "system_error";
    ActivityType["SYSTEM_WARNING"] = "system_warning";
    ActivityType["SYSTEM_MAINTENANCE"] = "system_maintenance";
    ActivityType["SESSION_EXPIRED"] = "session_expired";
    ActivityType["SESSION_TERMINATED"] = "session_terminated";
    ActivityType["ROLE_ASSIGNED"] = "role_assigned";
    ActivityType["ROLE_REMOVED"] = "role_removed";
    ActivityType["ROLE_UPDATED"] = "role_updated";
    ActivityType["API_ACCESS_GRANTED"] = "api_access_granted";
    ActivityType["API_ACCESS_REVOKED"] = "api_access_revoked";
    ActivityType["API_KEY_GENERATED"] = "api_key_generated";
    ActivityType["DATA_EXPORT"] = "data_export";
    ActivityType["DATA_IMPORT"] = "data_import";
    ActivityType["ACCOUNT_LOCKED"] = "account_locked";
    ActivityType["ACCOUNT_UNLOCKED"] = "account_unlocked";
    ActivityType["ACCOUNT_SUSPENDED"] = "account_suspended";
    ActivityType["ACCOUNT_REACTIVATED"] = "account_reactivated";
    ActivityType["TRADE_CREATED"] = "TRADE_CREATED";
    ActivityType["TRADE_UPDATED"] = "TRADE_UPDATED";
    ActivityType["TRADE_ASSIGNED"] = "TRADE_ASSIGNED";
    ActivityType["TRADE_COMPLETED"] = "TRADE_COMPLETED";
    ActivityType["TRADE_CANCELLED"] = "TRADE_CANCELLED";
    ActivityType["TRADE_DISPUTED"] = "TRADE_DISPUTED";
    ActivityType["TRADE_ESCALATED"] = "TRADE_ESCALATED";
    ActivityType["SHIFT_CLOCK_IN"] = "shift_clock_in";
    ActivityType["SHIFT_CLOCK_OUT"] = "shift_clock_out";
    ActivityType["SHIFT_BREAK_START"] = "shift_break_start";
    ActivityType["SHIFT_BREAK_END"] = "shift_break_end";
    ActivityType["SHIFT_BREAK_DURATION_UPDATED"] = "shift_break_duration_updated";
    ActivityType["SHIFT_STATUS_UPDATED"] = "shift_status_updated";
    ActivityType["SHIFT_FORCE_CLOSED"] = "shift_force_closed";
    ActivityType["SHIFT_DELETED"] = "shift_deleted";
    ActivityType["SHIFT_APPROVED"] = "shift_approved";
    ActivityType["SHIFT_REJECTED"] = "shift_rejected";
    ActivityType["SHIFT_REPORT_SUBMITTED"] = "shift_report_submitted";
    ActivityType["SHIFT_TIME_RECORDED"] = "shift_time_recorded";
    ActivityType["SHIFT_OVERTIME_RECORDED"] = "shift_overtime_recorded";
    ActivityType["SHIFT_LATE_ARRIVAL"] = "shift_late_arrival";
    ActivityType["SHIFT_EARLY_DEPARTURE"] = "shift_early_departure";
    ActivityType["SHIFT_MISSED_CLOCKIN"] = "shift_missed_clockin";
    ActivityType["SHIFT_MISSED_CLOCKOUT"] = "shift_missed_clockout";
    ActivityType["SHIFT_BREAK_VIOLATION"] = "shift_break_violation";
    ActivityType["SHIFT_SCHEDULE_MODIFIED"] = "shift_schedule_modified";
    ActivityType["BREAK_DURATION_UPDATED"] = "break_duration_updated";
    ActivityType["BREAK_LIMIT_EXCEEDED"] = "break_limit_exceeded";
    ActivityType["BREAK_POLICY_VIOLATION"] = "break_policy_violation";
    ActivityType["SHIFT_AUDIT_COMPLETED"] = "shift_audit_completed";
    ActivityType["SHIFT_POLICY_VIOLATION"] = "shift_policy_violation";
    ActivityType["SHIFT_CORRECTION_REQUESTED"] = "shift_correction_requested";
    ActivityType["SHIFT_CORRECTION_APPROVED"] = "shift_correction_approved";
    ActivityType["SHIFT_CORRECTION_REJECTED"] = "shift_correction_rejected";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
let ActivityLog = class ActivityLog {
};
exports.ActivityLog = ActivityLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], ActivityLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], ActivityLog.prototype, "timestamp", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_1.User, { nullable: true, onDelete: "SET NULL" }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", user_1.User)
], ActivityLog.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], ActivityLog.prototype, "userRole", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: ActivityType,
    }),
    __metadata("design:type", String)
], ActivityLog.prototype, "activity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255 }),
    __metadata("design:type", String)
], ActivityLog.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], ActivityLog.prototype, "details", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], ActivityLog.prototype, "isSystemGenerated", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], ActivityLog.prototype, "metadata", void 0);
exports.ActivityLog = ActivityLog = __decorate([
    (0, typeorm_1.Entity)("activity_logs")
], ActivityLog);
