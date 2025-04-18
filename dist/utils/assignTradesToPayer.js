"use strict";
// import { Trade, TradePlatform, TradeStatus } from "../models/trades";
// import { User, UserType } from "../models/user";
// import dbConnect from "../config/database";
// import { createNotification } from "../controllers/notificationController";
// import { PriorityLevel } from "../models/notifications";
// import { NoonesService } from "../config/noones";
// import paxfulService from "../config/paxful";
// import {
//   AutoMessageTemplate,
//   Platform,
//   TemplateType,
// } from "../models/messageTemplates";
// import { ActivityLog, ActivityType } from "../models/activityLogs";
// interface PayerWithAssignment {
//   user_id: string;
//   user_email: string;
//   user_fullname: string;
//   user_status: string;
//   user_userType: UserType;
//   user_createdAt: Date;
//   user_clockin: boolean;
//   last_assigned_at: Date | null;
// }
// export const createActivityLog = async ({
//   userId,
//   activity,
//   description,
//   details,
//   isSystemGenerated = false,
// }: {
//   userId?: string;
//   activity: ActivityType;
//   description: string;
//   details?: Record<string, any>;
//   isSystemGenerated?: boolean;
// }) => {
//   const activityLogRepository = dbConnect.getRepository(ActivityLog);
//   const userRepository = dbConnect.getRepository(User);
//   let user;
//   if (userId) {
//     user = await userRepository.findOne({ where: { id: userId } });
//     if (!user) throw new Error("User not found");
//   }
//   const activityLog = activityLogRepository.create({
//     user,
//     userRole: user?.userType,
//     activity,
//     description,
//     details,
//     isSystemGenerated,
//   });
//   await activityLogRepository.save(activityLog);
//   return activityLog;
// };
// export const assignTradesToPayers = async (): Promise<void> => {
//   const queryRunner = dbConnect.createQueryRunner();
//   await queryRunner.connect();
//   await queryRunner.startTransaction();
//   try {
//     const tradeRepository = queryRunner.manager.getRepository(Trade);
//     const userRepository = queryRunner.manager.getRepository(User);
//     // Get pending trades with proper stale time handling
//     const staleTime = new Date(Date.now() - 5 * 60 * 1000);
//     const pendingTrades = await tradeRepository.find({
//       where: {
//         status: TradeStatus.PENDING || TradeStatus.ACTIVE_FUNDED,
//       },
//       order: { createdAt: "ASC" },
//     });
//     if (!pendingTrades.length) {
//       console.log("No pending trades found");
//       await queryRunner.commitTransaction();
//       return;
//     }
//     // Get available payers with proper type and clockin check
//     const availablePayers = await userRepository
//       .createQueryBuilder("user")
//       .select([
//         "user.id AS user_id",
//         "user.email AS user_email",
//         "user.fullName AS user_fullname",
//         "user.status AS user_status",
//         "user.userType AS user_userType",
//         "user.createdAt AS user_createdAt",
//         "user.clockin AS user_clockin", // include clockin
//         "MAX(trade.assignedAt) AS last_assigned_at",
//       ])
//       .leftJoin(
//         Trade,
//         "trade",
//         "trade.assignedPayerId = user.id AND trade.status = :assignedStatus",
//         { assignedStatus: TradeStatus.ASSIGNED }
//       )
//       .where("user.userType = :payerType", { payerType: UserType.PAYER })
//       .andWhere("user.status = :activeStatus", { activeStatus: "active" })
//       .andWhere("user.clockin = :clockin", { clockin: true }) // check clockin is true
//       .groupBy("user.id")
//       .addOrderBy("user.createdAt", "ASC")
//       .getRawMany<PayerWithAssignment>();
//     if (!availablePayers.length) {
//       console.log("No available payers found");
//       await queryRunner.commitTransaction();
//       return;
//     }
//     console.log(
//       `Found ${pendingTrades.length} trades and ${availablePayers.length} payers`
//     );
//     const assignedPayerIds = new Set<string>();
//     for (const trade of pendingTrades) {
//       let selectedPayer: PayerWithAssignment | null = null;
//       for (const payer of availablePayers) {
//         if (assignedPayerIds.has(payer.user_id)) continue;
//         // Check for active assignments using repository methods
//         const activeTrade = await tradeRepository.findOne({
//           where: {
//             assignedPayerId: payer.user_id,
//           },
//         });
//         console.log(activeTrade, payer);
//         if (!activeTrade) {
//           selectedPayer = payer;
//           assignedPayerIds.add(payer.user_id);
//           break;
//         }
//       }
//       if (!selectedPayer) {
//         console.log("No available payers without assigned trades");
//         break;
//       }
//       try {
//         // Final consistency check
//         const existingAssignment = await tradeRepository.findOne({
//           where: {
//             assignedPayerId: selectedPayer.user_id,
//             status: TradeStatus.ASSIGNED,
//           },
//         });
//         if (existingAssignment) {
//           console.log(`Payer ${selectedPayer.user_id} already has assignment`);
//           assignedPayerIds.delete(selectedPayer.user_id);
//           continue;
//         }
//         // Update trade with proper transaction handling
//         await tradeRepository.update(trade.id, {
//           assignedPayerId: selectedPayer.user_id,
//           assignedAt: new Date(),
//           status: TradeStatus.ASSIGNED,
//         });
//         // Create notification with proper user reference
//         await createNotification({
//           userId: selectedPayer.user_id,
//           title: "New Trade Assigned",
//           description: `Assigned trade ${trade.id} (${trade.amount} ${trade.fiatCurrency})`,
//           priority: PriorityLevel.HIGH,
//         });
//         // Activity log with proper typing
//         await createActivityLog({
//           userId: selectedPayer.user_id,
//           activity: ActivityType.TRADE_ASSIGNED,
//           description: `Assigned trade ${trade.id} to ${selectedPayer.user_fullname}`,
//           details: {
//             tradeId: trade.id,
//             amount: trade.amount,
//             currency: trade.fiatCurrency,
//           },
//           isSystemGenerated: true,
//         });
//         // Handle platform messages with proper type checking
//         const platform =
//           trade.platform === TradePlatform.NOONES
//             ? Platform.NOONES
//             : Platform.PAXFUL;
//         const template = await dbConnect.getRepository(AutoMessageTemplate).findOne({
//           where: { type: TemplateType.WELCOME, platform, isActive: true },
//           order: { displayOrder: "ASC" },
//         });
//         console.log(
//           `Assigned trade ${trade.id} to ${selectedPayer.user_fullname}`
//         );
//       } catch (error) {
//         console.error(`Error assigning trade ${trade.id}:`, error);
//         assignedPayerIds.delete(selectedPayer.user_id);
//         await queryRunner.rollbackTransaction();
//         throw error;
//       }
//     }
//     await queryRunner.commitTransaction();
//   } catch (error) {
//     console.error("Trade assignment failed:", error);
//     await queryRunner.rollbackTransaction();
//     throw error;
//   } finally {
//     await queryRunner.release();
//   }
// };
