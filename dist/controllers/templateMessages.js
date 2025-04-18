"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllMessageTemplates = exports.getSingleMessageTemplate = exports.deleteMessageTemplate = exports.updateMessageTemplate = exports.createMessageTemplate = void 0;
const typeorm_1 = require("typeorm");
const messageTemplates_1 = require("../models/messageTemplates");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
// Validation helper
const validateTemplateData = (data) => {
    const errors = [];
    if (data.type && !Object.values(messageTemplates_1.TemplateType).includes(data.type)) {
        errors.push("Invalid template type");
    }
    if (data.platform && !Object.values(messageTemplates_1.Platform).includes(data.platform)) {
        errors.push("Invalid platform");
    }
    if (data.content && typeof data.content !== "string") {
        errors.push("Content must be a string");
    }
    if (data.followUpDelayMinutes &&
        (typeof data.followUpDelayMinutes !== "number" ||
            data.followUpDelayMinutes < 0)) {
        errors.push("Follow-up delay must be a positive number");
    }
    if (data.displayOrder &&
        (typeof data.displayOrder !== "number" || data.displayOrder < 0)) {
        errors.push("Display order must be a positive number");
    }
    if (data.availableVariables) {
        if (!Array.isArray(data.availableVariables)) {
            errors.push("Available variables must be an array");
        }
        else {
            data.availableVariables.forEach((variable, index) => {
                if (!variable.name || !variable.description) {
                    errors.push(`Variable at index ${index} must have name and description`);
                }
            });
        }
    }
    return errors;
};
// Create Message Template
const createMessageTemplate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        if (((_b = req.user) === null || _b === void 0 ? void 0 : _b.userType) !== "admin") {
            throw new errorHandler_1.default("Access denied: Only admins can create templates", 403);
        }
        const templateData = Object.assign(Object.assign({}, req.body), { createdBy: req.user.id });
        // Validate required fields
        if (!templateData.type || !templateData.platform || !templateData.content) {
            throw new errorHandler_1.default("Type, platform, and content are required", 400);
        }
        // Validate template data
        const validationErrors = validateTemplateData(templateData);
        if (validationErrors.length > 0) {
            throw new errorHandler_1.default(validationErrors.join(", "), 400);
        }
        const templateRepo = (0, typeorm_1.getRepository)(messageTemplates_1.AutoMessageTemplate);
        // Check for duplicate template
        const existingTemplate = yield templateRepo.findOne({
            where: {
                type: templateData.type,
                platform: templateData.platform,
                isActive: true,
            },
        });
        if (existingTemplate) {
            throw new errorHandler_1.default("Active template already exists for this type and platform", 409);
        }
        const newTemplate = templateRepo.create(templateData);
        yield templateRepo.save(newTemplate);
        res.status(201).json({
            success: true,
            message: "Message template created successfully",
            data: newTemplate,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createMessageTemplate = createMessageTemplate;
// Update Message Template
const updateMessageTemplate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        if (((_b = req.user) === null || _b === void 0 ? void 0 : _b.userType) !== "admin") {
            throw new errorHandler_1.default("Access denied: Only admins can update templates", 403);
        }
        const { id } = req.params;
        const updateData = Object.assign(Object.assign({}, req.body), { updatedBy: req.user.id });
        // Validate template data
        const validationErrors = validateTemplateData(updateData);
        if (validationErrors.length > 0) {
            throw new errorHandler_1.default(validationErrors.join(", "), 400);
        }
        const templateRepo = (0, typeorm_1.getRepository)(messageTemplates_1.AutoMessageTemplate);
        // Find existing template
        const template = yield templateRepo.findOne({ where: { id } });
        if (!template) {
            throw new errorHandler_1.default("Template not found", 404);
        }
        // Check for duplicate if type or platform is being changed
        if ((updateData.type || updateData.platform) &&
            updateData.isActive !== false) {
            const existingTemplate = yield templateRepo.findOne({
                where: {
                    type: updateData.type || template.type,
                    platform: updateData.platform || template.platform,
                    isActive: true,
                    id: (0, typeorm_1.Not)(id),
                },
            });
            if (existingTemplate) {
                throw new errorHandler_1.default("Active template already exists for this type and platform", 409);
            }
        }
        // Update template
        const updatedTemplate = yield templateRepo.save(Object.assign(Object.assign({}, template), updateData));
        res.status(200).json({
            success: true,
            message: "Template updated successfully",
            data: updatedTemplate,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateMessageTemplate = updateMessageTemplate;
// Delete Message Template
const deleteMessageTemplate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            throw new errorHandler_1.default("Unauthorized access", 401);
        }
        if (((_b = req.user) === null || _b === void 0 ? void 0 : _b.userType) !== "admin") {
            throw new errorHandler_1.default("Access denied: Only admins can delete templates", 403);
        }
        const { id } = req.params;
        const templateRepo = (0, typeorm_1.getRepository)(messageTemplates_1.AutoMessageTemplate);
        const template = yield templateRepo.findOne({ where: { id } });
        if (!template) {
            throw new errorHandler_1.default("Template not found", 404);
        }
        yield templateRepo.softRemove(template);
        res.status(200).json({
            success: true,
            message: "Template deleted successfully",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteMessageTemplate = deleteMessageTemplate;
// Get Single Message Template
const getSingleMessageTemplate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const templateRepo = (0, typeorm_1.getRepository)(messageTemplates_1.AutoMessageTemplate);
        const template = yield templateRepo.findOne({ where: { id } });
        if (!template) {
            throw new errorHandler_1.default("Template not found", 404);
        }
        res.status(200).json({
            success: true,
            message: "Template retrieved successfully",
            data: template,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSingleMessageTemplate = getSingleMessageTemplate;
// Get All Message Templates with filter
const getAllMessageTemplates = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { type, platform, isActive, tags } = req.query;
        const templateRepo = (0, typeorm_1.getRepository)(messageTemplates_1.AutoMessageTemplate);
        const query = templateRepo.createQueryBuilder("template");
        if (type) {
            query.andWhere("template.type = :type", { type });
        }
        if (platform) {
            query.andWhere("template.platform = :platform", { platform });
        }
        if (isActive !== undefined) {
            query.andWhere("template.isActive = :isActive", {
                isActive: isActive === "true",
            });
        }
        if (tags) {
            const tagArray = Array.isArray(tags) ? tags : [tags];
            query.andWhere("template.tags && :tags", { tags: tagArray });
        }
        // Order by display order and creation date
        query
            .orderBy("template.displayOrder", "ASC")
            .addOrderBy("template.createdAt", "DESC");
        const templates = yield query.getMany();
        res.status(200).json({
            success: true,
            message: "Templates retrieved successfully",
            data: templates,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllMessageTemplates = getAllMessageTemplates;
