import { Request, Response, NextFunction, RequestHandler } from "express";
import dbConnect from "../config/database";
import { ActivityLog, ActivityType } from "../models/activityLogs";
import { User } from "../models/user";
import ErrorHandler from "../utils/errorHandler";
import { Between, Like } from "typeorm";
import { UserRequest } from "middlewares/authenticate";

// Create a new activity log
export const createActivityLog: RequestHandler = async (
  req: UserRequest,
  res,
  next
) => {
  try {
    const { activity, description, details, isSystemGenerated } = req.body;
    const userId = req.user?.id;

    // Validate input
    if (!activity || !description) {
      throw new ErrorHandler("Activity and description are required", 400);
    }

    // Validate activity type
    if (!Object.values(ActivityType).includes(activity)) {
      throw new ErrorHandler("Invalid activity type", 400);
    }

    const activityLogRepo = dbConnect.getRepository(ActivityLog);
    const userRepo = dbConnect.getRepository(User);

    let user;
    if (userId) {
      user = await userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new ErrorHandler("User not found", 404);
      }
    }

    const activityLog = activityLogRepo.create({
      activity,
      description,
      details,
      isSystemGenerated: isSystemGenerated || false,
      user: user,
      userRole: user?.userType,
    });

    await activityLogRepo.save(activityLog);

    res.status(201).json({
      success: true,
      message: "Activity log created successfully",
      data: activityLog,
    });
  } catch (error) {
    next(error);
  }
};

// Delete activity logs (Admin only)
export const deleteActivityLogs: RequestHandler = async (
  req: UserRequest,
  res,
  next
) => {
  try {
    const { ids } = req.body;
    const userType = req.user?.userType;

    // Check if user is admin
    if (userType !== "admin") {
      throw new ErrorHandler("Unauthorized access", 403);
    }

    // Validate input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new ErrorHandler("Valid log IDs array is required", 400);
    }

    const activityLogRepo = dbConnect.getRepository(ActivityLog);

    // Delete logs
    const result = await activityLogRepo.delete(ids);

    if (result.affected === 0) {
      throw new ErrorHandler("No logs found with the provided IDs", 404);
    }

    res.json({
      success: true,
      message: `Successfully deleted ${result.affected} activity logs`,
    });
  } catch (error) {
    next(error);
  }
};

// Get activity logs with filters
export const getActivityLogs: RequestHandler = async (
  req: UserRequest,
  res,
  next
) => {
  try {
    const {
      startDate,
      endDate,
      activity,
      userId,
      userRole,
      isSystemGenerated,
      page = 1,
      limit = 10,
      sortBy = "timestamp",
      sortOrder = "DESC",
    } = req.query;

    const activityLogRepo = dbConnect.getRepository(ActivityLog);

    // Build where conditions
    const whereConditions: any = {};

    if (startDate && endDate) {
      whereConditions.timestamp = Between(
        new Date(startDate as string),
        new Date(endDate as string)
      );
    }

    if (activity) {
      whereConditions.activity = activity;
    }

    if (userId) {
      whereConditions.user = { id: userId };
    }

    if (userRole) {
      whereConditions.userRole = userRole;
    }

    if (isSystemGenerated !== undefined) {
      whereConditions.isSystemGenerated = isSystemGenerated === "true";
    }

    // Calculate skip for pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Get logs with pagination and filters
    const [logs, total] = await activityLogRepo.findAndCount({
      where: whereConditions,
      relations: ["user"],
      order: { [sortBy as string]: sortOrder },
      skip,
      take: Number(limit),
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / Number(limit));
    const hasNextPage = Number(page) < totalPages;
    const hasPreviousPage = Number(page) > 1;

    res.json({
      success: true,
      // data: {
      //   logs,
      //   pagination: {
      //     total,
      //     totalPages,
      //     currentPage: Number(page),
      //     hasNextPage,
      //     hasPreviousPage,
      //   },
      data: logs,
      // },
      message: "Activity logs retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get single activity log bxy ID
export const getActivityLogById: RequestHandler = async (
  req: UserRequest,
  res,
  next
) => {
  try {
    const { id } = req.params;

    const activityLogRepo = dbConnect.getRepository(ActivityLog);
    const log = await activityLogRepo.findOne({
      where: { id },
      relations: ["user"],
    });

    if (!log) {
      throw new ErrorHandler("Activity log not found", 404);
    }

    res.json({
      success: true,
      data: log,
      message: "Activity log retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
};
