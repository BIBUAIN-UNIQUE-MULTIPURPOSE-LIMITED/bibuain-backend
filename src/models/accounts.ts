import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from "typeorm";

export enum ForexPlatform {
  NOONES = "noones",
  PAXFUL = "paxful",
  BINANCE = "binance",
}

@Entity("accounts")
export class Account {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({
    type: "varchar",
    length: 100,
    comment: "Account username on the platform",
  })
  account_username!: string;

  @Column({ type: "text", nullable: false })
  api_key!: string;

  @Column({ type: "text", nullable: false })
  api_secret!: string;

  @Column({
    type: "enum",
    enum: ForexPlatform,
    nullable: false,
  })
  platform!: ForexPlatform;

  @Column({
    type: "enum",
    enum: ["active", "inactive", "suspended"],
    default: "active",
  })
  status!: "active" | "inactive" | "suspended";

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;
}
