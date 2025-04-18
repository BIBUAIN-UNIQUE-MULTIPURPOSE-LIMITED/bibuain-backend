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
exports.Rates = void 0;
const typeorm_1 = require("typeorm");
let Rates = class Rates {
};
exports.Rates = Rates;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Rates.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 50, scale: 8, nullable: false }),
    __metadata("design:type", String)
], Rates.prototype, "sellingPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 50, scale: 8, nullable: false }),
    __metadata("design:type", String)
], Rates.prototype, "usdtNgnRate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "numeric",
        precision: 20,
        scale: 2,
        default: 0,
        transformer: {
            to: (value) => value.toString(),
            from: (value) => parseFloat(value),
        },
    }),
    __metadata("design:type", Number)
], Rates.prototype, "marketcap", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "numeric",
        precision: 20,
        scale: 4,
        default: 0,
        transformer: {
            to: (value) => value.toString(),
            from: (value) => parseFloat(value),
        },
    }),
    __metadata("design:type", Number)
], Rates.prototype, "btcngnrate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], Rates.prototype, "platformRates", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 50, scale: 8, nullable: true }),
    __metadata("design:type", String)
], Rates.prototype, "paxfulRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "numeric", precision: 50, scale: 8, nullable: true }),
    __metadata("design:type", String)
], Rates.prototype, "noonesRate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], Rates.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], Rates.prototype, "updatedAt", void 0);
exports.Rates = Rates = __decorate([
    (0, typeorm_1.Entity)("rates")
], Rates);
