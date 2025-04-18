import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from "typeorm";
import { User } from "./user";

export enum NotificationType {
  SYSTEM = "system",
  INDIVIDUAL = "individual",
}

export enum PriorityLevel {
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

@Entity("notifications")
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, (user) => user.notifications, {
    eager: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text" })
  description!: string;

  @Column({
    type: "enum",
    enum: NotificationType,
    default: NotificationType.SYSTEM,
  })
  type!: NotificationType;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "related_account_id" })
  relatedAccount?: User;

  @Column({ type: "boolean", default: false })
  read!: boolean;

  @Column({
    type: "enum",
    enum: PriorityLevel,
    default: PriorityLevel.MEDIUM,
  })
  priority!: PriorityLevel;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;
}
