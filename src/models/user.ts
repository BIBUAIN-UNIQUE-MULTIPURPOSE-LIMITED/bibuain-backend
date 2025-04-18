import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { Role } from "./roles";
import { Shift } from "./shift";
import { Notification } from "./notifications";

export enum UserType {
  ADMIN = "admin",
  PAYER = "payer",
  RATER = "rater",
  CEO = "ceo",
  CC = "customer-support",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 100, unique: true })
  email!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  password!: string;

  @Column({
    type: "enum",
    enum: UserType,
    nullable: false,
  })
  userType!: UserType;

  @Column({ type: "varchar", nullable: true })
  avatar?: string;

  @Column({ type: "varchar", length: 100 })
  fullName!: string;

  @Column({ type: "varchar", length: 15, nullable: true, unique: true })
  phone?: string;

  @Column({ type: "boolean", default: true })
  twoFaEnabled!: boolean;

  @Column({ type: "varchar", length: 255, nullable: true })
  twoFaSecret?: string;

  @Column({ type: "boolean", default: false })
  twoFaVerified!: boolean;

  @Column({ type: "varchar", nullable: true, unique: true })
  emailVerificationCode?: string | null;

  @Column({ type: "timestamp", nullable: true })
  emailVerificationExp?: Date | null;

  @Column({ type: "varchar", length: 6, nullable: true })
  phoneVerificationCode?: string;

  @Column({ type: "timestamp", nullable: true })
  phoneVerificationExp?: Date;

  @Column({ type: "boolean", default: false })
  isEmailVerified!: boolean;

  @Column({ type: "boolean", default: false, nullable: false })
  isPhoneVerified!: boolean;

  @Column({ type: "varchar", length: 255, nullable: true })
  resetPasswordToken?: string | null;

  @Column({ type: "timestamp", nullable: true })
  resetPasswordExp?: Date | null;

  @Column({ type: "varchar", length: 6, nullable: true })
  twoFaCode?: string;

  @Column({ type: "timestamp", nullable: true })
  twoFaExpires?: Date;

  @Column({ type: "boolean", default: false })
  clockedIn!: boolean;

  @ManyToOne(() => Role, (role) => role.users, {
    eager: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @Column({
    type: "enum",
    enum: ["active", "inactive", "suspended"],
    default: "active",
  })
  status!: "active" | "inactive" | "suspended";

  @OneToMany(() => Shift, (shift) => shift.user)
  shifts!: Shift[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications!: Notification[];

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;
}
