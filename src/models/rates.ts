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

  @Column({ type: "numeric", precision: 50, scale: 8, nullable: true })
  sellingPrice!: string;

  @Column({ type: "numeric", precision: 50, scale: 8, nullable: true })
  usdtNgnRate!: string;

  @Column({
    type: "numeric",
    precision: 20,
    scale: 2,
    nullable: true,
  })
  marketcap!: number;

  @Column({
    type: "numeric",
    precision: 20,
    scale: 4,
    nullable: true,
  })
  btcngnrate!: number;

  @Column({ type: "jsonb", nullable: true })
  platformRates?: Record<string, any>;

  @Column({
    type: "jsonb",
    nullable: true,
    default: {}
  })
  platformCostPrices?: Record<string, number>;
  

  @Column({ type: "numeric", precision: 50, scale: 8, nullable: true })
  paxfulRate?: string;

  @Column({ type: "numeric", precision: 50, scale: 8, nullable: true })
  noonesRate?: string;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt!: Date;
}
