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
exports.EscalatedTrade = exports.Platform = exports.TradeStatus = void 0;
const typeorm_1 = require("typeorm");
const user_1 = require("./user");
const chats_1 = require("./chats");
const trades_1 = require("./trades");
var TradeStatus;
(function (TradeStatus) {
    TradeStatus["PENDING"] = "pending";
    TradeStatus["RESOLVED"] = "resolved";
    TradeStatus["ASSIGNED"] = "assigned";
})(TradeStatus || (exports.TradeStatus = TradeStatus = {}));
var Platform;
(function (Platform) {
    Platform["PAXFUL"] = "paxful";
    Platform["NOONES"] = "noones";
    Platform["BINANCE"] = "binance";
})(Platform || (exports.Platform = Platform = {}));
let EscalatedTrade = class EscalatedTrade {
};
exports.EscalatedTrade = EscalatedTrade;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], EscalatedTrade.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => trades_1.Trade, { nullable: false, onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)({ name: "trade_id" }),
    __metadata("design:type", trades_1.Trade)
], EscalatedTrade.prototype, "trade", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_1.User, (user) => user.id, {
        nullable: true,
        onDelete: "SET NULL",
    }),
    __metadata("design:type", Object)
], EscalatedTrade.prototype, "assignedCcAgent", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => chats_1.Chat, (chat) => chat.id, { nullable: true }),
    __metadata("design:type", chats_1.Chat)
], EscalatedTrade.prototype, "chat", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: TradeStatus,
        default: TradeStatus.PENDING,
    }),
    __metadata("design:type", String)
], EscalatedTrade.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: Platform,
        nullable: false,
    }),
    __metadata("design:type", String)
], EscalatedTrade.prototype, "platform", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_1.User, (user) => user.id, {
        nullable: true,
        onDelete: "SET NULL",
    }),
    __metadata("design:type", Object)
], EscalatedTrade.prototype, "assignedPayer", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_1.User, (user) => user.id, {
        nullable: true,
        onDelete: "SET NULL",
    }),
    __metadata("design:type", Object)
], EscalatedTrade.prototype, "escalatedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], EscalatedTrade.prototype, "complaint", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 10, scale: 2, nullable: false }),
    __metadata("design:type", Number)
], EscalatedTrade.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], EscalatedTrade.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], EscalatedTrade.prototype, "updatedAt", void 0);
exports.EscalatedTrade = EscalatedTrade = __decorate([
    (0, typeorm_1.Entity)("escalated_trades")
], EscalatedTrade);
