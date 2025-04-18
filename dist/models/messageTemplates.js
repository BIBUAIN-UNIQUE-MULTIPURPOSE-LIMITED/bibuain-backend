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
exports.AutoMessageTemplate = exports.Platform = exports.TemplateType = void 0;
const typeorm_1 = require("typeorm");
var TemplateType;
(function (TemplateType) {
    TemplateType["WELCOME"] = "welcome";
    TemplateType["PAYMENT_MADE"] = "payment_made";
    TemplateType["COIN_RELEASE"] = "coin_release";
})(TemplateType || (exports.TemplateType = TemplateType = {}));
var Platform;
(function (Platform) {
    Platform["PAXFUL"] = "paxful";
    Platform["NOONES"] = "noones";
})(Platform || (exports.Platform = Platform = {}));
let AutoMessageTemplate = class AutoMessageTemplate {
};
exports.AutoMessageTemplate = AutoMessageTemplate;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], AutoMessageTemplate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: TemplateType,
        comment: "Type of auto-message template",
    }),
    __metadata("design:type", String)
], AutoMessageTemplate.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: Platform,
        comment: "Platform for which this template is used",
    }),
    __metadata("design:type", String)
], AutoMessageTemplate.prototype, "platform", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "text",
        comment: "Content of the message template with variable placeholders",
    }),
    __metadata("design:type", String)
], AutoMessageTemplate.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "jsonb",
        nullable: true,
        comment: "Available variables that can be used in the template",
    }),
    __metadata("design:type", Array)
], AutoMessageTemplate.prototype, "availableVariables", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "int",
        nullable: true,
        comment: "Delay in minutes before sending follow-up message",
    }),
    __metadata("design:type", Number)
], AutoMessageTemplate.prototype, "followUpDelayMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "jsonb",
        nullable: true,
        comment: "Follow-up message content if needed",
    }),
    __metadata("design:type", Array)
], AutoMessageTemplate.prototype, "followUpContent", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "boolean",
        default: true,
        comment: "Whether this template is currently active",
    }),
    __metadata("design:type", Boolean)
], AutoMessageTemplate.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "int",
        default: 0,
        comment: "Order of template when multiple templates exist for same type",
    }),
    __metadata("design:type", Number)
], AutoMessageTemplate.prototype, "displayOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "jsonb",
        nullable: true,
        comment: "Feedback templates for automated feedback",
    }),
    __metadata("design:type", Array)
], AutoMessageTemplate.prototype, "feedbackTemplates", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "simple-array",
        nullable: true,
        comment: "Tags for template categorization and filtering",
    }),
    __metadata("design:type", Array)
], AutoMessageTemplate.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], AutoMessageTemplate.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], AutoMessageTemplate.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)(),
    __metadata("design:type", Date)
], AutoMessageTemplate.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "uuid",
        comment: "ID of admin who created this template",
    }),
    __metadata("design:type", String)
], AutoMessageTemplate.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "uuid",
        nullable: true,
        comment: "ID of admin who last updated this template",
    }),
    __metadata("design:type", String)
], AutoMessageTemplate.prototype, "updatedBy", void 0);
exports.AutoMessageTemplate = AutoMessageTemplate = __decorate([
    (0, typeorm_1.Entity)("message_templates"),
    (0, typeorm_1.Index)(["type", "platform", "isActive"])
], AutoMessageTemplate);
