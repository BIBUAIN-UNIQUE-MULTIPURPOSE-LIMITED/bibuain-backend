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
exports.User = exports.UserType = void 0;
const typeorm_1 = require("typeorm");
const roles_1 = require("./roles");
const shift_1 = require("./shift");
const notifications_1 = require("./notifications");
var UserType;
(function (UserType) {
    UserType["ADMIN"] = "admin";
    UserType["PAYER"] = "payer";
    UserType["RATER"] = "rater";
    UserType["CEO"] = "ceo";
    UserType["CC"] = "customer-support";
})(UserType || (exports.UserType = UserType = {}));
let User = class User {
};
exports.User = User;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], User.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, unique: true }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255, nullable: true }),
    __metadata("design:type", String)
], User.prototype, "password", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: UserType,
        nullable: false,
    }),
    __metadata("design:type", String)
], User.prototype, "userType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], User.prototype, "avatar", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    __metadata("design:type", String)
], User.prototype, "fullName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 15, nullable: true, unique: true }),
    __metadata("design:type", String)
], User.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "twoFaEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255, nullable: true }),
    __metadata("design:type", String)
], User.prototype, "twoFaSecret", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "twoFaVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true, unique: true }),
    __metadata("design:type", Object)
], User.prototype, "emailVerificationCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "emailVerificationExp", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 6, nullable: true }),
    __metadata("design:type", String)
], User.prototype, "phoneVerificationCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "phoneVerificationExp", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "isEmailVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false, nullable: false }),
    __metadata("design:type", Boolean)
], User.prototype, "isPhoneVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255, nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "resetPasswordToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "resetPasswordExp", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 6, nullable: true }),
    __metadata("design:type", String)
], User.prototype, "twoFaCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "twoFaExpires", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "clockedIn", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => roles_1.Role, (role) => role.users, {
        eager: true,
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)({ name: "role_id" }),
    __metadata("design:type", roles_1.Role)
], User.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: ["active", "inactive", "suspended"],
        default: "active",
    }),
    __metadata("design:type", String)
], User.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => shift_1.Shift, (shift) => shift.user),
    __metadata("design:type", Array)
], User.prototype, "shifts", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => notifications_1.Notification, (notification) => notification.user),
    __metadata("design:type", Array)
], User.prototype, "notifications", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], User.prototype, "updatedAt", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)("users")
], User);
