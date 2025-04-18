import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("rates")
export class Rates {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "numeric", precision: 50, scale: 8, nullable: false })
  sellingPrice!: string;

  @Column({ type: "numeric", precision: 50, scale: 8, nullable: false })
  usdtNgnRate!: string;

  @Column({
    type: "numeric",
    precision: 20,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value.toString(),
      from: (value: string) => parseFloat(value),
    },
  })
  marketcap!: number;

  @Column({
    type: "numeric",
    precision: 20,
    scale: 4,
    default: 0,
    transformer: {
      to: (value: number) => value.toString(),
      from: (value: string) => parseFloat(value),
    },
  })
  btcngnrate!: number;

  // New dynamic column for platform-specific rate settings
  @Column({ type: "jsonb", nullable: true })
  platformRates?: Record<string, any>;

  @Column({ type: "numeric", precision: 50, scale: 8, nullable: true })
  paxfulRate?: string;

  @Column({ type: "numeric", precision: 50, scale: 8, nullable: true })
  noonesRate?: string;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;
}
