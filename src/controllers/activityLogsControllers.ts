import type { RequestHandler } from "express";
import type { UserRequest } from "middlewares/authenticate";
import { Between } from "typeorm";
import dbConnect from "../config/database";
import { ActivityLog, ActivityType } from "../models/activityLogs";
import { User } from "../models/user";
import ErrorHandler from "../utils/errorHandler";

/*
 * Activity Logs Controller
 * Handles CRUD operations for activity logs
 */
export const createActivityLog: RequestHandler = async (
  req: UserRequest,
  res,
  next,
) => {
  try {
    const { activity, description, details, isSystemGenerated } = req.body;
    const userId = req.user?.id;

    if (!activity || !description) {
      throw new ErrorHandler("Activity and description are required", 400);
    }

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

/*
 * Delete activity logs by IDs
 * Only accessible by admin users
 */
export const deleteActivityLogs: RequestHandler = async (
  req: UserRequest,
  res,
  next,
) => {
  try {
    const { ids } = req.body;
    const userType = req.user?.userType;

    if (userType != "admin") {
      throw new ErrorHandler("Unauthorized access", 403);
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new ErrorHandler("Valid log IDs array is required", 400);
    }

    const activityLogRepo = dbConnect.getRepository(ActivityLog);

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

/*
 * Get activity logs with filters and pagination
 * Supports filtering by date range, activity type, user ID, user role, and system-generated flag
 */
export const getActivityLogs: RequestHandler = async (
  req: UserRequest,
  res,
  next,
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
    const whereConditions: Record<string, any> = {};

    if (startDate && endDate) {
      whereConditions.timestamp = Between(
        new Date(startDate as string),
        new Date(endDate as string),
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
    const logs = await activityLogRepo.findAndCount({
      where: whereConditions,
      relations: ["user"],
      order: { [sortBy as string]: sortOrder },
      skip,
      take: Number(limit),
    });

    res.json({
      success: true,
      data: logs,
      message: "Activity logs retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
};

/*
 * Get a single activity log by ID
 * Returns the log details along with the associated user
 */
export const getActivityLogById: RequestHandler = async (
  req: UserRequest,
  res,
  next,
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
