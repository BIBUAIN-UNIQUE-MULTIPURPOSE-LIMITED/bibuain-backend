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
exports.RolePermission = void 0;
const typeorm_1 = require("typeorm");
const roles_1 = require("./roles");
const permissions_1 = require("./permissions");
let RolePermission = class RolePermission {
};
exports.RolePermission = RolePermission;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], RolePermission.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => roles_1.Role, (role) => role.rolePermissions, {
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)({ name: "role_id" }),
    __metadata("design:type", roles_1.Role)
], RolePermission.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => permissions_1.Permission, (permission) => permission.rolePermissions, {
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)({ name: "permission_id" }),
    __metadata("design:type", permissions_1.Permission)
], RolePermission.prototype, "permission", void 0);
exports.RolePermission = RolePermission = __decorate([
    (0, typeorm_1.Entity)("role_permissions")
], RolePermission);
