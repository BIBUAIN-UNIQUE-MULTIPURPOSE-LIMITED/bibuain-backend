import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Shift } from "./shift";

export enum BankTag {
  FRESH = "fresh",
  UNFUNDED = "unfunded",
  FUNDED = "funded",
  USED = "used",
  ROLLOVER = "rollover",
}

@Entity("banks")
export class Bank {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 100 })
  bankName!: string;

  @Column({ type: "varchar", length: 100 })
  accountName!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  additionalNotes?: string;

  @Column({ type: "varchar", length: 50 })
  accountNumber!: string;

  @Column({ type: "float", default: 0 })
  funds!: number;

  @Column({ type: "enum", enum: BankTag, default: BankTag.UNFUNDED })
  tag!: BankTag;

  // Link to shift when bank is used in a shift
  @ManyToOne(() => Shift, { nullable: true })
  @JoinColumn({ name: "shift_id" })
  shift?: Shift;

  @Column({ type: "simple-json", nullable: true })
  logs?: { description: string; createdAt: Date }[];

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;
}
