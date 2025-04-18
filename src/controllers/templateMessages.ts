import { Request, Response, NextFunction } from "express";
import { getRepository, Not } from "typeorm";
import {
  AutoMessageTemplate,
  TemplateType,
  Platform,
} from "../models/messageTemplates";
import ErrorHandler from "../utils/errorHandler";
import { UserRequest } from "../middlewares/authenticate";

// Validation helper
const validateTemplateData = (data: Partial<AutoMessageTemplate>) => {
  const errors: string[] = [];

  if (data.type && !Object.values(TemplateType).includes(data.type)) {
    errors.push("Invalid template type");
  }

  if (data.platform && !Object.values(Platform).includes(data.platform)) {
    errors.push("Invalid platform");
  }

  if (data.content && typeof data.content !== "string") {
    errors.push("Content must be a string");
  }

  if (
    data.followUpDelayMinutes &&
    (typeof data.followUpDelayMinutes !== "number" ||
      data.followUpDelayMinutes < 0)
  ) {
    errors.push("Follow-up delay must be a positive number");
  }

  if (
    data.displayOrder &&
    (typeof data.displayOrder !== "number" || data.displayOrder < 0)
  ) {
    errors.push("Display order must be a positive number");
  }

  if (data.availableVariables) {
    if (!Array.isArray(data.availableVariables)) {
      errors.push("Available variables must be an array");
    } else {
      data.availableVariables.forEach((variable: any, index: any) => {
        if (!variable.name || !variable.description) {
          errors.push(
            `Variable at index ${index} must have name and description`
          );
        }
      });
    }
  }

  return errors;
};

// Create Message Template
export const createMessageTemplate = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.id) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    if (req.user?.userType !== "admin") {
      throw new ErrorHandler(
        "Access denied: Only admins can create templates",
        403
      );
    }

    const templateData = {
      ...req.body,
      createdBy: req.user.id,
    };

    // Validate required fields
    if (!templateData.type || !templateData.platform || !templateData.content) {
      throw new ErrorHandler("Type, platform, and content are required", 400);
    }

    // Validate template data
    const validationErrors = validateTemplateData(templateData);
    if (validationErrors.length > 0) {
      throw new ErrorHandler(validationErrors.join(", "), 400);
    }

    const templateRepo = getRepository(AutoMessageTemplate);

    // Check for duplicate template
    const existingTemplate = await templateRepo.findOne({
      where: {
        type: templateData.type,
        platform: templateData.platform,
        isActive: true,
      },
    });

    if (existingTemplate) {
      throw new ErrorHandler(
        "Active template already exists for this type and platform",
        409
      );
    }

    const newTemplate = templateRepo.create(templateData);
    await templateRepo.save(newTemplate);

    res.status(201).json({
      success: true,
      message: "Message template created successfully",
      data: newTemplate,
    });
  } catch (error) {
    next(error);
  }
};

// Update Message Template
export const updateMessageTemplate = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.id) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    if (req.user?.userType !== "admin") {
      throw new ErrorHandler(
        "Access denied: Only admins can update templates",
        403
      );
    }

    const { id } = req.params;
    const updateData = {
      ...req.body,
      updatedBy: req.user.id,
    };

    // Validate template data
    const validationErrors = validateTemplateData(updateData);
    if (validationErrors.length > 0) {
      throw new ErrorHandler(validationErrors.join(", "), 400);
    }

    const templateRepo = getRepository(AutoMessageTemplate);

    // Find existing template
    const template = await templateRepo.findOne({ where: { id } });
    if (!template) {
      throw new ErrorHandler("Template not found", 404);
    }

    // Check for duplicate if type or platform is being changed
    if (
      (updateData.type || updateData.platform) &&
      updateData.isActive !== false
    ) {
      const existingTemplate = await templateRepo.findOne({
        where: {
          type: updateData.type || template.type,
          platform: updateData.platform || template.platform,
          isActive: true,
          id: Not(id),
        },
      });

      if (existingTemplate) {
        throw new ErrorHandler(
          "Active template already exists for this type and platform",
          409
        );
      }
    }

    // Update template
    const updatedTemplate = await templateRepo.save({
      ...template,
      ...updateData,
    });

    res.status(200).json({
      success: true,
      message: "Template updated successfully",
      data: updatedTemplate,
    });
  } catch (error) {
    next(error);
  }
};

// Delete Message Template
export const deleteMessageTemplate = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.id) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    if (req.user?.userType !== "admin") {
      throw new ErrorHandler(
        "Access denied: Only admins can delete templates",
        403
      );
    }

    const { id } = req.params;
    const templateRepo = getRepository(AutoMessageTemplate);

    const template = await templateRepo.findOne({ where: { id } });
    if (!template) {
      throw new ErrorHandler("Template not found", 404);
    }

    await templateRepo.softRemove(template);

    res.status(200).json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get Single Message Template
export const getSingleMessageTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const templateRepo = getRepository(AutoMessageTemplate);

    const template = await templateRepo.findOne({ where: { id } });
    if (!template) {
      throw new ErrorHandler("Template not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Template retrieved successfully",
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

// Get All Message Templates with filter
export const getAllMessageTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { type, platform, isActive, tags } = req.query;
    const templateRepo = getRepository(AutoMessageTemplate);

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

    const templates = await query.getMany();

    res.status(200).json({
      success: true,
      message: "Templates retrieved successfully",
      data: templates,
    });
  } catch (error) {
    next(error);
  }
};
