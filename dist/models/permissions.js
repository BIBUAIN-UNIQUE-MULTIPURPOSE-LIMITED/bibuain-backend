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
exports.Permission = void 0;
const typeorm_1 = require("typeorm");
const role_permissions_1 = require("./role_permissions");
let Permission = class Permission {
};
exports.Permission = Permission;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Permission.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, unique: true }),
    __metadata("design:type", String)
], Permission.prototype, "permissionName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50 }),
    __metadata("design:type", String)
], Permission.prototype, "module", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], Permission.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => role_permissions_1.RolePermission, (rolePermission) => rolePermission.permission),
    __metadata("design:type", Array)
], Permission.prototype, "rolePermissions", void 0);
exports.Permission = Permission = __decorate([
    (0, typeorm_1.Entity)("permissions")
], Permission);
