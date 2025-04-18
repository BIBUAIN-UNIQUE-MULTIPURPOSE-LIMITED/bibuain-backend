import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from "typeorm";
import { User, UserType } from "./user";

export enum ShiftType {
  MORNING = "morning",
  AFTERNOON = "afternoon",
  NIGHT = "night",
}

export enum ShiftStatus {
  ACTIVE = "active",
  ON_BREAK = "on_break",
  PENDING_APPROVAL = "pending_approval",
  APPROVED = "approved",
  REJECTED = "rejected",
  ENDED = "ended",
  FORCE_CLOSED = "force_closed",
}

export enum ShiftEndType {
  ADMIN_FORCE_CLOSE = "admin_force_close",
  PENDING_ADMIN_APPROVAL = "pending_admin_approval",
}

@Entity("shifts")
export class Shift {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, (user) => user.shifts)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({
    type: "enum",
    enum: ShiftType,
    nullable: false,
  })
  shiftType!: ShiftType;

  @Column({
    type: "enum",
    enum: ShiftStatus,
    default: ShiftStatus.ACTIVE,
  })
  status!: ShiftStatus;

  @Column({ type: "boolean", default: false })
  isClockedIn!: boolean;

  @Column({ type: "timestamp", nullable: true })
  clockInTime!: Date;

  @Column({ type: "timestamp", nullable: true })
  clockOutTime?: Date;

  @Column({ type: "json", nullable: true })
  breaks!: {
    startTime: Date;
    endTime?: Date;
    duration: number;
  }[];

  @Column({ type: "int", default: 0 })
  overtimeMinutes!: number;

  @Column({ type: "int", default: 0 })
  totalWorkDuration!: number;

  @Column({ type: "boolean", default: false })
  isLateClockIn!: boolean;

  @Column({ type: "int", default: 0 })
  lateMinutes!: number;

  @Column({ type: "enum", enum: ShiftEndType, nullable: true })
  shiftEndType?: ShiftEndType;

  @Column({ type: "varchar", nullable: true })
  shiftEndReport?: string;

  @Column({ type: "uuid", nullable: true })
  approvedByAdminId?: string;

  @Column({ type: "timestamp", nullable: true })
  approvalTime?: Date;

  @Column({ type: "varchar", nullable: true })
  adminNotes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
