import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Unique,
  Index,
  OneToMany,
} from "typeorm";
import { User } from "./user";

export enum TradePlatform {
  PAXFUL = "paxful",
  NOONES = "noones",
  BINANCE = "binance",
}

export enum TradeStatus {
  PENDING = "pending",
  ACTIVE_FUNDED = "Active Funded",
  ASSIGNED = "assigned",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  DISPUTED = "disputed",
  ESCALATED = "escalated",
  PAID = "paid",
  SUCCESSFUL = "successful"
}

export enum FeedbackType {
  POSITIVE = "positive",
  NEGATIVE = "negative",
}

@Entity("trades")
@Unique("UQ_TRADE_HASH", ["tradeHash"])
@Index("IDX_ACCOUNT_PLATFORM", ["accountId", "platform"])
export class Trade {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 100 })
  @Index({ unique: true })
  tradeHash!: string;

  @ManyToOne(() => Trade, { nullable: true })
  @JoinColumn({ name: 'parent_trade_id' })
  parentTrade?: Trade;

  @OneToMany(() => Trade, trade => trade.parentTrade)
  childTrades?: Trade[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'escalated_by_id' })
  escalatedBy?: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_cc_agent_id' })
  assignedCcAgent?: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_payer_id' })
  assignedPayer?: User;

  @Column({
    type: "varchar",
    length: 100,
    nullable: false,
    comment: "External account identifier for the trade",
  })
  @Index()
  accountId!: string;

  @Column({ type: "enum", enum: TradePlatform, nullable: true })
  platform!: TradePlatform;

  @Column({ type: "enum", enum: TradeStatus, default: TradeStatus.ACTIVE_FUNDED })
  status!: TradeStatus;

  @Column({ type: "varchar", nullable: true })
  tradeStatus!: string;

  @Column({ type: "json", nullable: true })
  tradeDetails?: any;

  @Column({ type: "json", nullable: true })
  tradeChat?: any;

  @Column({ type: "enum", enum: FeedbackType, nullable: true })
  feedback?: FeedbackType;

  @Column({
    type: "numeric",
    precision: 20,
    scale: 2,
    nullable: true,
  })
  amount!: number;

  @Column({
    type: "numeric",
    precision: 20,
    scale: 8,
    nullable: true,
  })
  cryptoAmountRequested!: number;

  @Column({ type: 'timestamptz', nullable: true, comment: 'Original trade time from platform' })
  platformCreatedAt!: Date;

  @Column({
    type: "numeric",
    precision: 20,
    scale: 8,
    nullable: true,
  })
  cryptoAmountTotal!: number;

  @Column({
    type: "numeric",
    precision: 20,
    scale: 8,
    nullable: true,
  })
  feeCryptoAmount!: number;

  @Column({ type: "boolean", default: false })
  flagged!: boolean;
  
  @Column({ type: "boolean", default: false })
  isEscalated!: boolean;
  
  @Column({ type: "text", nullable: true })
  escalationReason!: string | null;

  @Column({ name: "escalated_by_id", type: "uuid", nullable: true })
  escalatedById!: string | null;

  @Column({ name: "assigned_cc_agent_id", type: "uuid", nullable: true })
  assignedCcAgentId!: string | null;

  @Column({
    type: "numeric",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  feePercentage!: number;

  @Column({ type: "varchar", length: 100, nullable: true })
  sourceId!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  responderUsername!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  ownerUsername!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  paymentMethod!: string;

  @Column({ type: "varchar", length: 2, nullable: true })
  locationIso?: string;

  @Column({ type: "varchar", length: 3, nullable: true })
  fiatCurrency!: string;

  @Column({ type: "varchar", length: 10, nullable: true })
  cryptoCurrencyCode!: string;

  @Column({ type: "boolean", default: false })
  isActiveOffer!: boolean;

  @Column({ type: "varchar", length: 100, nullable: true })
  offerHash?: string;

  @Column({
    type: "numeric",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  margin?: number;

  @Column({
    type: "numeric",
    precision: 20,
    scale: 2,
    nullable: true,
  })
  dollarRate?: number;

  @Column({
    type: "numeric",
    precision: 20,
    scale: 8,
    nullable: true
  })
  btcRate?: number;

  @Column({
    type: "numeric",
    precision: 20,
    scale: 8,
    nullable: true,
  })
  btcAmount?: number;

  @Column({ name: "assigned_payer_id", type: "uuid", nullable: true })
  assignedPayerId?: string | null;

  @Column({ type: "timestamp", nullable: true })
  assignedAt?: Date | null;

  @Column({ type: "timestamp", nullable: true })
  completedAt?: Date;

  @Column("float", { nullable: true })
  btcNgnRate!: number;
  
  @Column("float", { nullable: true })
  usdtNgnRate!: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  notes?: string;

  @Column({ type: "jsonb", nullable: true })
  platformMetadata?: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  activityLog?: Array<{
    action: string;
    performedBy: string;
    performedAt: Date;
    details?: Record<string, any>;
  }>;
  
  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    comment: 'UTC timestamp of when the row was created',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
    comment: 'UTC timestamp of last update',
  })
  updatedAt!: Date;
}
