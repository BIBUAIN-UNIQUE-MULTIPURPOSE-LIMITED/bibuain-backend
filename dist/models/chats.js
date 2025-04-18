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
exports.Chat = void 0;
const typeorm_1 = require("typeorm");
const user_1 = require("./user");
const messages_1 = require("./messages");
let Chat = class Chat {
};
exports.Chat = Chat;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Chat.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => user_1.User),
    (0, typeorm_1.JoinTable)({
        name: "chat_participants",
        joinColumn: {
            name: "chat_id",
            referencedColumnName: "id",
        },
        inverseJoinColumn: {
            name: "user_id",
            referencedColumnName: "id",
        },
    }),
    __metadata("design:type", Array)
], Chat.prototype, "participants", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => messages_1.Message, (message) => message.chat),
    __metadata("design:type", Array)
], Chat.prototype, "messages", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], Chat.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], Chat.prototype, "updatedAt", void 0);
exports.Chat = Chat = __decorate([
    (0, typeorm_1.Entity)("chats")
], Chat);
