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
exports.Account = exports.ForexPlatform = void 0;
const typeorm_1 = require("typeorm");
var ForexPlatform;
(function (ForexPlatform) {
    ForexPlatform["NOONES"] = "noones";
    ForexPlatform["PAXFUL"] = "paxful";
    ForexPlatform["BINANCE"] = "binance";
})(ForexPlatform || (exports.ForexPlatform = ForexPlatform = {}));
let Account = class Account {
};
exports.Account = Account;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Account.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "varchar",
        length: 100,
        comment: "Account username on the platform",
    }),
    __metadata("design:type", String)
], Account.prototype, "account_username", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: false }),
    __metadata("design:type", String)
], Account.prototype, "api_key", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: false }),
    __metadata("design:type", String)
], Account.prototype, "api_secret", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: ForexPlatform,
        nullable: false,
    }),
    __metadata("design:type", String)
], Account.prototype, "platform", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: ["active", "inactive", "suspended"],
        default: "active",
    }),
    __metadata("design:type", String)
], Account.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], Account.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], Account.prototype, "updatedAt", void 0);
exports.Account = Account = __decorate([
    (0, typeorm_1.Entity)("accounts")
], Account);
