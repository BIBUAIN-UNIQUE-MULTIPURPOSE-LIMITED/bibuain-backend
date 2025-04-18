import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

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

  @Column({ type: "simple-json", nullable: true })
  logs?: { description: string; createdAt: Date }[];

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;
}
