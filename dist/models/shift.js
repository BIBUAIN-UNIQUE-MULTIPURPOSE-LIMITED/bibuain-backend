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
exports.Shift = exports.ShiftEndType = exports.ShiftStatus = exports.ShiftType = void 0;
const typeorm_1 = require("typeorm");
const user_1 = require("./user");
var ShiftType;
(function (ShiftType) {
    ShiftType["MORNING"] = "morning";
    ShiftType["AFTERNOON"] = "afternoon";
    ShiftType["NIGHT"] = "night";
})(ShiftType || (exports.ShiftType = ShiftType = {}));
var ShiftStatus;
(function (ShiftStatus) {
    ShiftStatus["ACTIVE"] = "active";
    ShiftStatus["ON_BREAK"] = "on_break";
    ShiftStatus["PENDING_APPROVAL"] = "pending_approval";
    ShiftStatus["APPROVED"] = "approved";
    ShiftStatus["REJECTED"] = "rejected";
    ShiftStatus["ENDED"] = "ended";
    ShiftStatus["FORCE_CLOSED"] = "force_closed";
})(ShiftStatus || (exports.ShiftStatus = ShiftStatus = {}));
var ShiftEndType;
(function (ShiftEndType) {
    ShiftEndType["ADMIN_FORCE_CLOSE"] = "admin_force_close";
    ShiftEndType["PENDING_ADMIN_APPROVAL"] = "pending_admin_approval";
})(ShiftEndType || (exports.ShiftEndType = ShiftEndType = {}));
let Shift = class Shift {
};
exports.Shift = Shift;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Shift.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_1.User, (user) => user.shifts),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", user_1.User)
], Shift.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: ShiftType,
        nullable: false,
    }),
    __metadata("design:type", String)
], Shift.prototype, "shiftType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: ShiftStatus,
        default: ShiftStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], Shift.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], Shift.prototype, "isClockedIn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], Shift.prototype, "clockInTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], Shift.prototype, "clockOutTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "json", nullable: true }),
    __metadata("design:type", Array)
], Shift.prototype, "breaks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 0 }),
    __metadata("design:type", Number)
], Shift.prototype, "overtimeMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 0 }),
    __metadata("design:type", Number)
], Shift.prototype, "totalWorkDuration", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], Shift.prototype, "isLateClockIn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 0 }),
    __metadata("design:type", Number)
], Shift.prototype, "lateMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: ShiftEndType, nullable: true }),
    __metadata("design:type", String)
], Shift.prototype, "shiftEndType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], Shift.prototype, "shiftEndReport", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "uuid", nullable: true }),
    __metadata("design:type", String)
], Shift.prototype, "approvedByAdminId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], Shift.prototype, "approvalTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], Shift.prototype, "adminNotes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Shift.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Shift.prototype, "updatedAt", void 0);
exports.Shift = Shift = __decorate([
    (0, typeorm_1.Entity)("shifts")
], Shift);
