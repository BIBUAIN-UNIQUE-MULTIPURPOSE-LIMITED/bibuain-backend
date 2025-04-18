import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from "typeorm";
import { User } from "./user";

export enum ActivityType {
  // Rate Related
  RATE_UPDATE = "rate_update",

  // User Authentication
  USER_LOGIN = "user_login",
  USER_LOGOUT = "user_logout",
  LOGIN_FAILED = "login_failed",
  TWO_FA_GENERATED = "two_fa_generated",
  TWO_FA_VERIFIED = "two_fa_verified",
  TWO_FA_FAILED = "two_fa_failed",

  USER_CREATE = "user_create",
  USER_UPDATE = "user_update",
  USER_DELETE = "user_delete",
  USER_PROFILE_UPDATE = "user_profile_update",
  USER_STATUS_CHANGE = "user_status_change",

  EMAIL_VERIFICATION = "email_verification",
  EMAIL_VERIFICATION_REQUEST = "email_verification_request",
  EMAIL_VERIFICATION_FAILED = "email_verification_failed",
  EMAIL_VERIFICATION_EXPIRED = "email_verification_expired",

  PASSWORD_RESET_REQUEST = "password_reset_request",
  PASSWORD_RESET = "password_reset",
  PASSWORD_RESET_FAILED = "password_reset_failed",
  PASSWORD_CHANGE = "password_change",
  PASSWORD_CHANGE_FAILED = "password_change_failed",

  SHIFT_CREATE = "shift_create",
  SHIFT_UPDATE = "shift_update",
  SHIFT_DELETE = "shift_delete",

  PHONE_VERIFICATION_REQUEST = "phone_verification_request",
  PHONE_VERIFICATION = "phone_verification",
  PHONE_VERIFICATION_FAILED = "phone_verification_failed",

  TWO_FA_ENABLED = "two_fa_enabled",
  TWO_FA_DISABLED = "two_fa_disabled",
  TWO_FA_STATUS_CHANGE = "two_fa_status_change",

  SYSTEM = "system",
  SYSTEM_ERROR = "system_error",
  SYSTEM_WARNING = "system_warning",
  SYSTEM_MAINTENANCE = "system_maintenance",

  SESSION_EXPIRED = "session_expired",
  SESSION_TERMINATED = "session_terminated",

  ROLE_ASSIGNED = "role_assigned",
  ROLE_REMOVED = "role_removed",
  ROLE_UPDATED = "role_updated",

  API_ACCESS_GRANTED = "api_access_granted",
  API_ACCESS_REVOKED = "api_access_revoked",
  API_KEY_GENERATED = "api_key_generated",

  DATA_EXPORT = "data_export",
  DATA_IMPORT = "data_import",

  ACCOUNT_LOCKED = "account_locked",
  ACCOUNT_UNLOCKED = "account_unlocked",
  ACCOUNT_SUSPENDED = "account_suspended",
  ACCOUNT_REACTIVATED = "account_reactivated",

  TRADE_CREATED = "TRADE_CREATED",
  TRADE_UPDATED = "TRADE_UPDATED",
  TRADE_ASSIGNED = "TRADE_ASSIGNED",
  TRADE_COMPLETED = "TRADE_COMPLETED",
  TRADE_CANCELLED = "TRADE_CANCELLED",
  TRADE_DISPUTED = "TRADE_DISPUTED",
  TRADE_ESCALATED = "TRADE_ESCALATED",

  SHIFT_CLOCK_IN = "shift_clock_in",
  SHIFT_CLOCK_OUT = "shift_clock_out",
  SHIFT_BREAK_START = "shift_break_start",
  SHIFT_BREAK_END = "shift_break_end",
  SHIFT_BREAK_DURATION_UPDATED = "shift_break_duration_updated",
  SHIFT_STATUS_UPDATED = "shift_status_updated",
  SHIFT_FORCE_CLOSED = "shift_force_closed",
  SHIFT_DELETED = "shift_deleted",
  SHIFT_APPROVED = "shift_approved",
  SHIFT_REJECTED = "shift_rejected",
  SHIFT_REPORT_SUBMITTED = "shift_report_submitted",
  SHIFT_TIME_RECORDED = "shift_time_recorded",
  SHIFT_OVERTIME_RECORDED = "shift_overtime_recorded",
  SHIFT_LATE_ARRIVAL = "shift_late_arrival",
  SHIFT_EARLY_DEPARTURE = "shift_early_departure",
  SHIFT_MISSED_CLOCKIN = "shift_missed_clockin",
  SHIFT_MISSED_CLOCKOUT = "shift_missed_clockout",
  SHIFT_BREAK_VIOLATION = "shift_break_violation",
  SHIFT_SCHEDULE_MODIFIED = "shift_schedule_modified",

  BREAK_DURATION_UPDATED = "break_duration_updated",
  BREAK_LIMIT_EXCEEDED = "break_limit_exceeded",
  BREAK_POLICY_VIOLATION = "break_policy_violation",

  SHIFT_AUDIT_COMPLETED = "shift_audit_completed",
  SHIFT_POLICY_VIOLATION = "shift_policy_violation",
  SHIFT_CORRECTION_REQUESTED = "shift_correction_requested",
  SHIFT_CORRECTION_APPROVED = "shift_correction_approved",
  SHIFT_CORRECTION_REJECTED = "shift_correction_rejected",
}

@Entity("activity_logs")
export class ActivityLog {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn({ type: "timestamp" })
  timestamp!: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @Column({ type: "varchar", nullable: true })
  userRole?: string;

  @Column({
    type: "enum",
    enum: ActivityType,
  })
  activity!: ActivityType;

  @Column({ type: "varchar", length: 255 })
  description!: string;

  @Column({ type: "jsonb", nullable: true })
  details?: Record<string, any>;

  @Column({ type: "boolean", default: false })
  isSystemGenerated!: boolean;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>;
}
