"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Trade = exports.FeedbackType = exports.TradeStatus = exports.TradePlatform = void 0;
const typeorm_1 = require("typeorm");
const user_1 = require("./user");
var TradePlatform;
(function (TradePlatform) {
    TradePlatform["PAXFUL"] = "paxful";
    TradePlatform["NOONES"] = "noones";
    TradePlatform["BINANCE"] = "binance";
})(TradePlatform || (exports.TradePlatform = TradePlatform = {}));
var TradeStatus;
(function (TradeStatus) {
    TradeStatus["PENDING"] = "pending";
    TradeStatus["ACTIVE_FUNDED"] = "Active Funded";
    TradeStatus["ASSIGNED"] = "assigned";
    TradeStatus["COMPLETED"] = "completed";
    TradeStatus["CANCELLED"] = "cancelled";
    TradeStatus["DISPUTED"] = "disputed";
    TradeStatus["ESCALATED"] = "escalated";
    TradeStatus["PAID"] = "paid";
    TradeStatus["SUCCESSFUL"] = "successful";
})(TradeStatus || (exports.TradeStatus = TradeStatus = {}));
var FeedbackType;
(function (FeedbackType) {
    FeedbackType["POSITIVE"] = "positive";
    FeedbackType["NEGATIVE"] = "negative";
})(FeedbackType || (exports.FeedbackType = FeedbackType = {}));
let Trade = class Trade {
};
exports.Trade = Trade;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Trade.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    (0, typeorm_1.Index)({ unique: true }),
    __metadata("design:type", String)
], Trade.prototype, "tradeHash", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Trade, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'parent_trade_id' }),
    __metadata("design:type", Trade)
], Trade.prototype, "parentTrade", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Trade, trade => trade.parentTrade),
    __metadata("design:type", Array)
], Trade.prototype, "childTrades", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'escalated_by_id' }),
    __metadata("design:type", user_1.User)
], Trade.prototype, "escalatedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'assigned_cc_agent_id' }),
    __metadata("design:type", user_1.User)
], Trade.prototype, "assignedCcAgent", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'assigned_payer_id' }),
    __metadata("design:type", user_1.User)
], Trade.prototype, "assignedPayer", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "varchar",
        length: 100,
        nullable: false,
        comment: "External account identifier for the trade",
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], Trade.prototype, "accountId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: TradePlatform, nullable: true }),
    __metadata("design:type", String)
], Trade.prototype, "platform", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: TradeStatus }),
    __metadata("design:type", String)
], Trade.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], Trade.prototype, "tradeStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "json", nullable: true }),
    __metadata("design:type", Object)
], Trade.prototype, "tradeDetails", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "json", nullable: true }),
    __metadata("design:type", Object)
], Trade.prototype, "tradeChat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: FeedbackType, nullable: true }),
    __metadata("design:type", String)
], Trade.prototype, "feedback", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "numeric",
        precision: 20,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Number)
], Trade.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "numeric",
        precision: 20,
        scale: 8,
        nullable: true,
    }),
    __metadata("design:type", Number)
], Trade.prototype, "cryptoAmountRequested", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "numeric",
        precision: 20,
        scale: 8,
        nullable: true,
    }),
    __metadata("design:type", Number)
], Trade.prototype, "cryptoAmountTotal", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "numeric",
        precision: 20,
        scale: 8,
        nullable: true,
    }),
    __metadata("design:type", Number)
], Trade.prototype, "feeCryptoAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], Trade.prototype, "flagged", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], Trade.prototype, "isEscalated", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], Trade.prototype, "escalationReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "escalated_by_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], Trade.prototype, "escalatedById", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "assigned_cc_agent_id", type: "uuid", nullable: true }),
    __metadata("design:type", Object)
], Trade.prototype, "assignedCcAgentId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "numeric",
        precision: 10,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Number)
], Trade.prototype, "feePercentage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", String)
], Trade.prototype, "sourceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", String)
], Trade.prototype, "responderUsername", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", String)
], Trade.prototype, "ownerUsername", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", String)
], Trade.prototype, "paymentMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 2, nullable: true }),
    __metadata("design:type", String)
], Trade.prototype, "locationIso", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 3, nullable: true }),
    __metadata("design:type", String)
], Trade.prototype, "fiatCurrency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10, nullable: true }),
    __metadata("design:type", String)
], Trade.prototype, "cryptoCurrencyCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], Trade.prototype, "isActiveOffer", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", String)
], Trade.prototype, "offerHash", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "numeric",
        precision: 10,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Number)
], Trade.prototype, "margin", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "numeric",
        precision: 20,
        scale: 2,
        nullable: true,
    }),
    __metadata("design:type", Number)
], Trade.prototype, "dollarRate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "numeric",
        precision: 20,
        scale: 8,
        nullable: true
    }),
    __metadata("design:type", Number)
], Trade.prototype, "btcRate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "numeric",
        precision: 20,
        scale: 8,
        nullable: true,
    }),
    __metadata("design:type", Number)
], Trade.prototype, "btcAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "assigned_payer_id", type: "uuid", nullable: true }),
    __metadata("design:type", String)
], Trade.prototype, "assignedPayerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], Trade.prototype, "assignedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], Trade.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)("float", { nullable: true }),
    __metadata("design:type", Number)
], Trade.prototype, "btcNgnRate", void 0);
__decorate([
    (0, typeorm_1.Column)("float", { nullable: true }),
    __metadata("design:type", Number)
], Trade.prototype, "usdtNgnRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255, nullable: true }),
    __metadata("design:type", String)
], Trade.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], Trade.prototype, "platformMetadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Array)
], Trade.prototype, "activityLog", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], Trade.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], Trade.prototype, "updatedAt", void 0);
exports.Trade = Trade = __decorate([
    (0, typeorm_1.Entity)("trades"),
    (0, typeorm_1.Unique)("UQ_TRADE_HASH", ["tradeHash"]),
    (0, typeorm_1.Index)("IDX_ACCOUNT_PLATFORM", ["accountId", "platform"])
], Trade);
