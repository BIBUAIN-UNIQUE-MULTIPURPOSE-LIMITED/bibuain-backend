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
exports.Notification = exports.PriorityLevel = exports.NotificationType = void 0;
const typeorm_1 = require("typeorm");
const user_1 = require("./user");
var NotificationType;
(function (NotificationType) {
    NotificationType["SYSTEM"] = "system";
    NotificationType["INDIVIDUAL"] = "individual";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var PriorityLevel;
(function (PriorityLevel) {
    PriorityLevel["HIGH"] = "high";
    PriorityLevel["MEDIUM"] = "medium";
    PriorityLevel["LOW"] = "low";
})(PriorityLevel || (exports.PriorityLevel = PriorityLevel = {}));
let Notification = class Notification {
};
exports.Notification = Notification;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Notification.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_1.User, (user) => user.notifications, {
        eager: true,
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", user_1.User)
], Notification.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255 }),
    __metadata("design:type", String)
], Notification.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Notification.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: NotificationType,
        default: NotificationType.SYSTEM,
    }),
    __metadata("design:type", String)
], Notification.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_1.User, { nullable: true, onDelete: "SET NULL" }),
    (0, typeorm_1.JoinColumn)({ name: "related_account_id" }),
    __metadata("design:type", user_1.User)
], Notification.prototype, "relatedAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], Notification.prototype, "read", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: PriorityLevel,
        default: PriorityLevel.MEDIUM,
    }),
    __metadata("design:type", String)
], Notification.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], Notification.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], Notification.prototype, "updatedAt", void 0);
exports.Notification = Notification = __decorate([
    (0, typeorm_1.Entity)("notifications")
], Notification);
