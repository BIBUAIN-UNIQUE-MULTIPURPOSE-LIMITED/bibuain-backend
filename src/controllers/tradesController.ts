// import { NextFunction, Response } from "express";
// import { UserRequest } from "middlewares/authenticate";
// import { Trade } from "../models/trades";
// import { getRepository } from "typeorm";
// import noonesApi from "config/noones";
// import { getPaxfulTradeChat } from "config/paxful";
// import ErrorHandler from "utils/errorHandler";

// export const getPayerTrade = async (
//   req: UserRequest,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const { id } = req.params;
//     const tradeRepository = getRepository(Trade);

//     const assignedTrade = await tradeRepository
//       .createQueryBuilder("trade")
//       .leftJoinAndSelect("trade.assignedPayer", "payer")
//       .where("trade.assigned_payer_id = :payerId", { payerId: id })
//       .getOne();

//     if (!assignedTrade) {
//       return res.status(404).json({
//         success: false,
//         message: "No active trade found for this payer",
//       });
//     }

//     // Double-check the assigned payer is properly loaded
//     if (!assignedTrade.assignedPayer) {
//       // Try to reload the relation
//       const reloadedTrade = await tradeRepository.findOne({
//         where: { id: assignedTrade.id },
//         relations: ["assignedPayer"],
//       });

//       if (!reloadedTrade?.assignedPayer) {
//         console.error(
//           `Failed to load assignedPayer relation for trade ${assignedTrade.id}`
//         );
//         return res.status(500).json({
//           success: false,
//           message: "Error loading trade details",
//         });
//       }

//       return res.json({
//         success: true,
//         data: reloadedTrade,
//       });
//     }

//     return res.json({
//       success: true,
//       data: assignedTrade,
//     });
//   } catch (error) {
//     console.error("Error in getPayerTrade:", error);
//     return next(error);
//   }
// };

// /**
//  * Dummy live trades for testing.
//  */
// const getDummyLiveTrades = (): any[] => {
//   return [
//     {
//       trade_hash: "dummyTradeHash1",
//       platform: "paxful", // or "noones"
//       amount: 1000,
//       accountId: "dummyPaxfulAccountId", // Simulated external account identifier
//       status: "PENDING",
//     },
//     {
//       trade_hash: "dummyTradeHash2",
//       platform: "noones",
//       amount: 2000,
//       accountId: "dummyNoonesAccountId", // Simulated external account identifier
//       status: "PENDING",
//     },
//   ];
// };

// /**
//  * Helper function: Aggregate live (unassigned) trades from both platforms.
//  */
// const aggregateLiveTrades = async (): Promise<any[]> => {
//   const services = await initializePlatformServices();
//   let liveTrades: any[] = [];

//   // Fetch trades from Paxful.
//   for (const service of services.paxful) {
//     try {
//       const paxfulTrades = await service.listActiveTrades();
//       liveTrades = liveTrades.concat(
//         paxfulTrades.map((trade: any) => ({
//           ...trade,
//           platform: "paxful",
//           accountId: service.accountId,
//         }))
//       );
//     } catch (error) {
//       console.error(
//         `Error fetching Paxful trades for account ${service.accountId}:`,
//         error
//       );
//     }
//   }

//   // Fetch trades from Noones.
//   for (const service of services.noones) {
//     try {
//       const noonesTrades = await service.listActiveTrades();
//       liveTrades = liveTrades.concat(
//         noonesTrades.map((trade: any) => ({
//           ...trade,
//           platform: "noones",
//           accountId: service.accountId,
//         }))
//       );
//     } catch (error) {
//       console.error(
//         `Error fetching Noones trades for account ${service.accountId}:`,
//         error
//       );
//     }
//   }

//   // Return only trades with status "PENDING"
//   return liveTrades.filter((trade) => trade.status === "PENDING");
// };

// /**
//  * Get all available payers (users with role PAYER and clockedIn true).
//  */
// const getAvailablePayers = async (): Promise<User[]> => {
//   const userRepository = dbConnect.getRepository(User);
//   const payers = await userRepository.find({
//     where: { userType: UserType.PAYER, clockedIn: true },
//     order: { createdAt: "ASC" },
//   });
//   return payers;
// };
