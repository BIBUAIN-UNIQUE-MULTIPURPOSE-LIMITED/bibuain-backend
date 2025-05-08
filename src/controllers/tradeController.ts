import { Request, Response, NextFunction } from "express";
import { UserRequest } from "../middlewares/authenticate";
import dbConnect from "../config/database";
import { Trade, TradeStatus } from "../models/trades";
import { Rates } from "../models/rates";
import { Account, ForexPlatform } from "../models/accounts";
import { NoonesService } from "../config/noones";
import paxfulService, { PaxfulService } from "../config/paxful";
import { BinanceService } from "../config/binance";
import ErrorHandler from "../utils/errorHandler";
import { User, UserType } from "../models/user";
import { In, IsNull, MoreThanOrEqual, Not } from "typeorm";
import { createNotification } from "./notificationController";
import { NotificationType, PriorityLevel } from "../models/notifications";
import { Shift, ShiftStatus } from "../models/shift";
import { Server } from "socket.io";
import app from "../app";

interface PlatformServices {
  noones: NoonesService[];
  paxful: PaxfulService[];
  binance: BinanceService[];
}

interface WalletBalance {
  currency: string;
  name: string;
  balance: number;
  type: string;
}

interface PlatformService {
  platform: string;
  label: string;
  accountId: string;
  getBalance(): Promise<any>;
}

const DECIMALS: Record<string, number> = {
  BTC: 8,
  USDT: 6,
  BNB: 8,
  FDUSD: 8,
};

// In-memory storage for reset timers (in a production app, use Redis or a database)
const resetTimers: Record<string, { expiresAt: Date }> = {};

// This map tracks recently modified trades to prevent immediate reassignment
const recentlyModifiedTrades = new Map<string, number>();

/**
 * Initialize platform services with accounts from your database.
 */
async function initializePlatformServices(): Promise<PlatformServices> {
  const accountRepo = dbConnect.getRepository(Account);
  const accounts = await accountRepo.find();

  const services: PlatformServices = {
    noones: [],
    paxful: [],
    binance: [],
  };

  for (const account of accounts) {
    const decryptedKey = account.api_key;
    const decryptedSecret = account.api_secret;

    switch (account.platform) {
      case "noones":
        services.noones.push(
          new NoonesService({
            apiKey: decryptedKey,
            apiSecret: decryptedSecret,
            accountId: account.id,
            label: account.account_username,
          })
        );
        break;
      case "paxful":
        services.paxful.push(
          new PaxfulService({
            clientId: decryptedKey,
            clientSecret: decryptedSecret,
            accountId: account.id,
            label: account.account_username,
          })
        );
        break;
      case "binance":
        services.binance.push(
          new BinanceService({
            apiKey: decryptedKey,
            apiSecret: decryptedSecret,
            accountId: account.id,
            label: account.account_username,
          })
        );
        break;
    }
  }

  return services;
}

export const getAccounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accountRepo = dbConnect.getRepository(Account);
    // Only select the fields you need (e.g., id, account_username, and platform)
    const accounts = await accountRepo.find({
      select: ["id", "account_username", "platform"],
    });
    return res.status(200).json({
      success: true,
      message: "Accounts fetched successfully",
      data: accounts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dashboard stats.
 */
export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tradeRepository = dbConnect.getRepository(Trade);

    const currentlyAssigned = await tradeRepository.count({
      where: { status: TradeStatus.ASSIGNED },
    });

    const notYetAssigned = await tradeRepository.count({
      where: { status: TradeStatus.ACTIVE_FUNDED },
    });

    const escalated = await tradeRepository.count({
      where: { status: TradeStatus.ESCALATED },
    });

    const paidButNotMarked = await tradeRepository.count({
      where: { status: TradeStatus.COMPLETED, completedAt: undefined },
    });

    const totalTradesNGN = await tradeRepository
      .createQueryBuilder("trade")
      .select("SUM(trade.amount)", "totalNGN")
      .where("trade.status = :status", { status: TradeStatus.COMPLETED })
      .getRawOne();

    const totalTradesBTC = await tradeRepository
      .createQueryBuilder("trade")
      .select("SUM(trade.cryptoAmountTotal)", "totalBTC")
      .where("trade.status = :status", { status: TradeStatus.COMPLETED })
      .getRawOne();

    const averageResponseTime = await tradeRepository
      .createQueryBuilder("trade")
      .select(
        "AVG(EXTRACT(EPOCH FROM (trade.completedAt - trade.assignedAt)))",
        "averageResponseTime"
      )
      .where("trade.status = :status", { status: TradeStatus.COMPLETED })
      .andWhere("trade.completedAt IS NOT NULL")
      .andWhere("trade.assignedAt IS NOT NULL")
      .getRawOne();

    // Only count trades that are externally "active funded" but have not been processed internally.
    // That is, exclude trades with status ASSIGNED or PENDING.
    const activeFunded = await tradeRepository
      .createQueryBuilder("trade")
      .where("LOWER(trade.tradeStatus) = :externalStatus", { externalStatus: "active funded" })
      .andWhere("trade.status NOT IN (:...excluded)", { excluded: [TradeStatus.ASSIGNED, TradeStatus.ACTIVE_FUNDED, TradeStatus.CANCELLED] })
      .getCount();

    const stats = {
      currentlyAssigned,
      notYetAssigned,
      escalated,
      paidButNotMarked,
      activeFunded,
      totalTradesNGN: totalTradesNGN.totalNGN || 0,
      totalTradesBTC: totalTradesBTC.totalBTC || 0,
      averageResponseTime: averageResponseTime.averageResponseTime || 0,
    };

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    return next(error);
  }
};

export const getFeedbackStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("Starting getFeedbackStats controller...");

    // Fetch all accounts
    const accountRepo = dbConnect.getRepository(Account);
    const accounts = await accountRepo.find();

    // console.log(`Found ${accounts.length} total accounts`);

    // Filter to only include Paxful and Noones accounts
    const filteredAccounts = accounts.filter(account =>
      account.platform.toLowerCase() === "paxful" ||
      account.platform.toLowerCase() === "noones"
    );

    console.log(`Filtered to ${filteredAccounts.length} Paxful/Noones accounts`);
    console.log("Processing accounts:", filteredAccounts.map(a => `${a.id}: ${a.platform} (${a.account_username})`));

    // Process each account concurrently
    const statsArray = await Promise.all(
      filteredAccounts.map(async (account) => {
        console.log(`Processing account: ${account.id} - ${account.platform} (${account.account_username})`);

        const lowerPlatform = account.platform.toLowerCase();
        let service: NoonesService | PaxfulService | null = null;
        let serviceInitialized = false;

        try {
          // Create the appropriate service instance
          if (lowerPlatform === "noones") {
            console.log(`Creating NoonesService for ${account.account_username}`);
            service = new NoonesService({
              apiKey: account.api_key,
              apiSecret: account.api_secret,
              accountId: account.id,
              label: account.account_username,
            });
          } else if (lowerPlatform === "paxful") {
            console.log(`Creating PaxfulService for ${account.account_username}`);
            service = new PaxfulService({
              clientId: account.api_key,
              clientSecret: account.api_secret,
              accountId: account.id,
              label: account.account_username,
            });
          } else {
            // Unsupported platform - shouldn't reach here due to filtering
            console.log(`Unsupported platform: ${account.platform}`);
            return {
              accountId: account.id,
              accountUsername: account.account_username,
              platform: account.platform,
              positiveFeedback: 0,
              negativeFeedback: 0,
              positivePercentage: 0,
              negativePercentage: 0,
              error: "Unsupported platform"
            };
          }

          // Initialize the service if necessary
          if (service && "initialize" in service && typeof service.initialize === "function") {
            console.log(`Initializing service for ${account.account_username}`);
            await service.initialize();
            serviceInitialized = true;
            console.log(`Service for ${account.account_username} initialized successfully`);
          } else if (service) {
            serviceInitialized = true; // Paxful doesn't need initialization
            console.log(`Service for ${account.account_username} doesn't require initialization`);
          }
        } catch (error: any) {
          // Service initialization failed
          console.error(`Failed to initialize service for account ${account.account_username}:`, error);
          return {
            accountId: account.id,
            accountUsername: account.account_username,
            platform: account.platform,
            positiveFeedback: 0,
            negativeFeedback: 0,
            positivePercentage: 0,
            negativePercentage: 0,
            error: `Service initialization failed: ${error.message}`
          };
        }

        if (!service || !serviceInitialized) {
          console.log(`Service not available for ${account.account_username}`);
          return {
            accountId: account.id,
            accountUsername: account.account_username,
            platform: account.platform,
            positiveFeedback: 0,
            negativeFeedback: 0,
            positivePercentage: 0,
            negativePercentage: 0,
            error: "Service not available"
          };
        }

        // Retrieve positive and negative feedback stats
        let positiveFeedbackCount = 0;
        let negativeFeedbackCount = 0;
        let positiveError = null;
        let negativeError = null;

        console.log(`Fetching positive feedback for ${account.account_username}`);
        try {
          // Make sure getFeedbackStats exists on the service
          if (typeof service.getFeedbackStats !== 'function') {
            throw new Error(`getFeedbackStats is not a function on ${lowerPlatform} service`);
          }

          positiveFeedbackCount = await service.getFeedbackStats({
            username: account.account_username,
            role: "buyer", // or dynamically determine based on your needs
            rating: 1,
          });

          // console.log(`Received positive feedback count for ${account.account_username}: ${positiveFeedbackCount}`);
        } catch (error: any) {
          console.error(`Error fetching positive feedback for ${account.account_username}:`, error);
          positiveError = error && typeof error === 'object' && 'message' in error
            ? error.message
            : "Unknown error";
        }

        console.log(`Fetching negative feedback for ${account.account_username}`);
        try {
          negativeFeedbackCount = await service.getFeedbackStats({
            username: account.account_username,
            role: "buyer", // or dynamically determine
            rating: 0, // this will be converted to -1 inside the service methods
          });

          console.log(`Received negative feedback count for ${account.account_username}: ${negativeFeedbackCount}`);
        } catch (error: any) {
          console.error(`Error fetching negative feedback for ${account.account_username}:`, error);
          negativeError = error && typeof error === 'object' && 'message' in error
            ? error.message
            : "Unknown error";
        }

        // Calculate percentages
        const totalFeedback = positiveFeedbackCount + negativeFeedbackCount;
        const positivePercentage =
          totalFeedback > 0 ? Math.round((positiveFeedbackCount / totalFeedback) * 100) : 0;
        const negativePercentage =
          totalFeedback > 0 ? Math.round((negativeFeedbackCount / totalFeedback) * 100) : 0;

        console.log(`Feedback stats for ${account.account_username}: Positive=${positiveFeedbackCount} (${positivePercentage}%), Negative=${negativeFeedbackCount} (${negativePercentage}%)`);

        // Include error information in the response
        return {
          accountId: account.id,
          accountUsername: account.account_username,
          platform: account.platform,
          positiveFeedback: positiveFeedbackCount,
          negativeFeedback: negativeFeedbackCount,
          positivePercentage,
          negativePercentage,
          errors: {
            positive: positiveError,
            negative: negativeError
          }
        };
      })
    );

    console.log(`Completed processing ${statsArray.length} accounts`);

    // Return all account stats, even those with errors
    return res.status(200).json({
      success: true,
      data: statsArray,
    });
  } catch (error: any) {
    console.error("Error in getFeedbackStats controller:", error);
    return next(error);
  }
};

/**
 * Fetch all active offers from a list of services.
 */
async function fetchAllOffers(
  services: NoonesService | PaxfulService | (NoonesService | PaxfulService)[]
): Promise<any[]> {
  const serviceArray = Array.isArray(services) ? services : [services];
  const allOffers: any[] = [];

  for (const service of serviceArray) {
    try {
      let offers: any[] = [];

      if (service instanceof NoonesService) {
        const rawOffers = await service.listActiveOffers();
        // console.log('Raw Noones offers:', rawOffers); // Debug logging

        offers = rawOffers.map((offer) => ({
          ...offer,
          margin: offer.margin || offer.profit_margin,
          platform: "noones",
          account_username: service.accountId,
          crypto_currency_code: offer.crypto_currency_code || offer.coin_code,
          offer_hash: offer.offer_hash || offer.id
        }));
      } else if (service instanceof PaxfulService) {
        offers = await service.listOffers({ status: "active" });
        offers = offers.map((offer) => ({
          ...offer,
          margin: offer.margin,
          platform: "paxful",
          account_username: service.accountId,
          crypto_currency_code: offer.crypto_currency_code,
          offer_hash: offer.offer_hash
        }));
      }

      console.log(`Processed ${offers.length} offers for ${service.label}`); // Debug logging
      allOffers.push(...offers);
    } catch (error) {
      console.error(
        `Error fetching offers for service ${service.label}:`,
        error
      );
    }
  }

  return allOffers;
}

export const turnOnAllOffers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {

    const services = await initializePlatformServices();
    const allServices = [...services.noones, ...services.paxful];

    const platformResults: Array<{
      platform: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const svc of allServices) {
      try {

        await svc.turnOnAllOffers();

        platformResults.push({
          platform: svc.label!,
          success: true,
        });
      } catch (err: any) {
        console.error(`Error turning on offers for ${svc.label}:`, err);
        platformResults.push({
          platform: svc.label!,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }


    const overallSuccess = platformResults.every((r) => r.success);

    return res.status(200).json({
      success: overallSuccess,
      message: "Turned on all offers across platforms",
      platformResults,
    });
  } catch (error) {
    console.error("Critical error in turnOnAllOffersController:", error);
    return next(error);
  }
};

export const getOfferDetailsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { offer_hash } = req.body;
    if (!offer_hash) {
      return res
        .status(400)
        .json({ success: false, message: "Missing offer_hash in request body" });
    }

    const services = await initializePlatformServices();
    // assume your initializer returns { noones: [...], paxful: [ PaxfulService ] }
    const paxfulService = services.paxful[0];
    if (!paxfulService) {
      return res
        .status(500)
        .json({ success: false, message: "Paxful service not available" });
    }

    console.log(`[Controller] → Fetching offer details for ${offer_hash}`);
    const offer = await paxfulService.getOfferDetails(offer_hash);

    if (!offer) {
      return res
        .status(404)
        .json({ success: false, message: "Offer not found" });
    }

    return res.status(200).json({
      success: true,
      data: offer,
    });
  } catch (err: any) {
    console.error("[Controller] → Error in getOfferDetailsController:", err);
    return next(err);
  }
};

export const activateOfferController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { offer_hash, platform } = req.body;
    if (!offer_hash) {
      return res
        .status(400)
        .json({ success: false, message: "Missing offer_hash in request body" });
    }

    if (!platform) {
      return res
        .status(400)
        .json({ success: false, message: "Missing platform in request body" });
    }

    // Grab your initialized services
    const services = await initializePlatformServices();

    let result;

    if (platform.toLowerCase() === "paxful") {
      const paxfulService = services.paxful[0];
      if (!paxfulService) {
        return res
          .status(500)
          .json({ success: false, message: "Paxful service not available" });
      }

      console.log(`[activateOfferController] → Activating Paxful offer ${offer_hash}`);
      result = await paxfulService.activateOffer(offer_hash);
    }
    else if (platform.toLowerCase() === "noones") {
      const noonesService = services.noones[0];
      if (!noonesService) {
        return res
          .status(500)
          .json({ success: false, message: "Noones service not available" });
      }

      console.log(`[activateOfferController] → Activating Noones offer ${offer_hash}`);
      result = await noonesService.activateOffer(offer_hash);
    }
    else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid platform. Use 'paxful' or 'noones'" });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error("[activateOfferController] → Error activating offer:", err);
    return next(err);
  }
};

export const activateDeactivatedOffers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('Starting deactivated offer activation process...');

    const services = await initializePlatformServices();
    const allServices = [...services.noones, ...services.paxful];

    let totalActivated = 0;

    for (const service of allServices) {
      try {
        // console.log(`[${service.label}] → Fetching deactivated offers...`);
        const deactivatedOffers = await service.getDeactivatedOffers();
        // console.log(`[${service.label}] → Found ${deactivatedOffers.length} deactivated offers`);

        let activatedCount = 0;

        for (const offer of deactivatedOffers) {
          // Check different possible hash property names
          const hash = offer.offer_hash || offer.hash || offer.offer_id;

          if (!hash) {
            console.warn(`Offer without hash found, skipping`);
            continue;
          }

          try {
            console.log(`  ↳ Reactivating offer ${hash}...`);
            await service.activateOffer(hash);
            console.log(`  ✓ Reactivated ${hash}`);
            activatedCount++;

            // Add slight delay to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (err) {
            console.error(`  ✗ Failed to reactivate ${hash}:`, err);
          }
        }

        console.log(`[${service.label}] → Activated ${activatedCount} offers`);
        totalActivated += activatedCount;
      } catch (err) {
        console.error(`Error processing deactivated offers for ${service.label}:`, err);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully reactivated ${totalActivated} offers`,
      totalActivated
    });
  } catch (error) {
    console.error("Error in activateDeactivatedOffers controller:", error);
    return next(error);
  }
};

export const fetchPlatformRates = async () => {
  const accountRepository = dbConnect.getRepository(Account);

  // Find one active account for each platform.
  const [paxfulAccount, noonesAccount] = await Promise.all([
    accountRepository.findOne({
      where: {
        platform: ForexPlatform.PAXFUL,
        status: 'active',
      },
    }),
    accountRepository.findOne({
      where: {
        platform: ForexPlatform.NOONES,
        status: 'active',
      },
    }),
  ]);

  if (!paxfulAccount && !noonesAccount) {
    throw new ErrorHandler("No active Paxful or Noones accounts found", 404);
  }

  const rates: {
    paxful?: {
      btcNgnRate: number;
      usdtNgnRate: number;
      timestamp: string;
    };
    noones?: {
      btcNgnRate: number;
      usdtNgnRate: number;
      timestamp: string;
    };
  } = {};

  // Fetch Paxful rates if the account exists.
  if (paxfulAccount) {
    try {
      const paxfulService = new PaxfulService({
        clientId: paxfulAccount.api_key,
        clientSecret: paxfulAccount.api_secret,
        label: paxfulAccount.account_username,
      });

      const [btcNgnRate, usdtNgnRate] = await Promise.all([
        paxfulService.getBitcoinPriceInNgn(),
        paxfulService.getUsdtPriceInNgn(),
      ]);

      rates.paxful = {
        btcNgnRate,
        usdtNgnRate,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error fetching Paxful rates:", error);
      // Optionally, you might continue without Paxful rates.
    }
  }

  // Fetch Noones rates if the account exists.
  if (noonesAccount) {
    try {
      const noonesService = new NoonesService({
        apiKey: noonesAccount.api_key,
        apiSecret: noonesAccount.api_secret,
        label: noonesAccount.account_username,
      });

      const [btcPriceUsd, ngnUsdRate] = await Promise.all([
        noonesService.getBitcoinPrice(),
        noonesService.getNgnRate(),
      ]);

      rates.noones = {
        btcNgnRate: btcPriceUsd * ngnUsdRate,
        usdtNgnRate: ngnUsdRate, // Since 1 USDT = 1 USD.
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error fetching Noones rates:", error);
      // Optionally, continue without Noones rates.
    }
  }

  if (!rates.paxful && !rates.noones) {
    throw new ErrorHandler("Failed to fetch rates from both Paxful and Noones", 500);
  }

  return rates;
};

export const getPlatformRates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const rates = await fetchPlatformRates();
    return res.status(200).json({
      success: true,
      data: rates,
    });
  } catch (error) {
    console.error("Error in getPlatformRates:", error);
    return next(new ErrorHandler("Internal server error while processing rates request", 500));
  }
};

export const updateOffers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let {
      account_username,
      platform,
      costprice,
      usdtrate,
    } = req.body;

    // console.log("REceiveing from FE", req.body)

    // Validate required fields
    if (!account_username) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameter: account_username",
      });
    }

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameter: platform",
      });
    }

    if (costprice === undefined || costprice === null) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameter: costprice",
      });
    }

    if (usdtrate === undefined || usdtrate === null) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameter: usdtrate",
      });
    }

    if (typeof costprice === 'string') {
      costprice = parseFloat(costprice.replace(/,/g, ''));
    }

    if (typeof usdtrate === 'string') {
      usdtrate = parseFloat(usdtrate.replace(/,/g, ''));
    }

    if (isNaN(costprice) || isNaN(usdtrate)) {
      return res.status(400).json({
        success: false,
        message: "Cost price and USDT rate must be valid numbers",
      });
    }

    const platformKey = String(platform).toLowerCase();

    const accountRepository = dbConnect.getRepository(Account);
    // Replace the rate update section with this:

    const ratesRepo = dbConnect.getRepository(Rates);

    // Try to find an existing rate record
    let latestRate = await ratesRepo.findOne({
      where: {}, // No specific conditions - get any existing record
      order: { createdAt: "DESC" }
    });

    if (!latestRate) {
      // If no record exists, create a new one
      latestRate = ratesRepo.create({
        platformCostPrices: {}
      });
      // console.log(`Creating new rates record`);
     } 
    // else {
    //   console.log(`Found existing rates record with ID: ${latestRate.id}`);
    // }

    // Ensure platformCostPrices exists and is an object
    if (!latestRate.platformCostPrices || typeof latestRate.platformCostPrices !== 'object') {
      latestRate.platformCostPrices = {};
    }

    // Update the specific platform's cost price
    latestRate.platformCostPrices[platformKey] = costprice;

    try {
      // Save the updated record
      await ratesRepo.save(latestRate);
      // console.log(`Successfully updated cost price for ${platformKey} to ${costprice} in record ${latestRate.id}`);
    } catch (error) {
      console.error(`Failed to update cost price for ${platformKey}:`, error);
      return res.status(500).json({
        success: false,
        message: "Failed to update platform cost price in database",
        error: error instanceof Error ? error.message : String(error)
      });
    }
    const account = await accountRepository.findOne({
      where: { account_username: account_username }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    let service: PaxfulService | NoonesService;

    if (platformKey === "paxful") {
      service = new PaxfulService({
        clientId: account.api_key,
        clientSecret: account.api_secret,
        label: account.account_username,
      });
    } else if (platformKey === "noones") {
      service = new NoonesService({
        apiKey: account.api_key,
        apiSecret: account.api_secret,
        label: account.account_username,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Unsupported platform",
      });
    }

    const rates = await fetchPlatformRates();
    // console.log("Platform rates for NGN: ", rates);

    if (!rates[platformKey]) {
      return res.status(400).json({
        success: false,
        message: `Rates not available for the ${platform} platform`,
      });
    }
    const currentRate = rates[platformKey];

    const btcMargin = (((costprice / currentRate.btcNgnRate) - 1) * 100);
    // console.log("BTC Margin: ", btcMargin);
    const usdtMargin = (((usdtrate / currentRate.usdtNgnRate) - 1) * 100);

    // console.log(`Calculated margins - BTC: ${btcMargin}, USDT: ${usdtMargin}`);

    // Fetch active offers for this account
    let offers: any[] = [];

    try {
      if (platformKey === "paxful") {
        offers = await (service as PaxfulService).listOffers({ status: "active" });
      } else if (platformKey === "noones") {
        offers = await (service as NoonesService).listActiveOffers();
        if (!Array.isArray(offers)) {
          console.log("Noones offers not returned as an array, converting:", offers);
          offers = offers ? [offers] : [];
        }
      }

      // console.log(`Found ${offers.length} active offers for ${platform}`);
    } catch (error) {
      console.error(`Error fetching offers for ${platform}:`, error);
      return res.status(500).json({
        success: false,
        message: `Failed to fetch offers from ${platform}`,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    if (!offers || offers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active offers found for update.",
      });
    }

    const updateResults: any[] = [];

    for (const offer of offers) {
      const offerId = offer.offer_hash || offer.id || offer.hash;
      if (!offerId) {
        console.warn(`No offer ID found for offer:`, offer);
        continue;
      }

      const offerCurrency = offer.currency || offer.coin_code || "BTC";
      const marginToApply = offerCurrency.toUpperCase() === "USDT" ? usdtMargin : btcMargin;

      // console.log(`Updating ${platform} offer ${offerId} (${offerCurrency}) with margin ${marginToApply}`);

      try {
        const updateResult = await service.updateOffer(offerId, marginToApply);

        let isSuccess = false;
        if (typeof updateResult === "boolean") {
          isSuccess = updateResult;
        } else if (updateResult?.status === 'success') {
          isSuccess = true;
          if (updateResult?.data?.success !== undefined) {
            isSuccess = updateResult.data.success === true;
          }
        } else if (updateResult?.success !== undefined) {
          isSuccess = updateResult.success === true;
        }

        updateResults.push({
          offerId,
          currency: offerCurrency,
          margin: marginToApply,
          success: isSuccess,
          data: updateResult,
        });

        // console.log(`Update result for ${offerId}: ${isSuccess ? "SUCCESS" : "FAILED"}`);
      } catch (error) {
        console.error(`Error updating offer ${offerId}:`, error);
        updateResults.push({
          offerId,
          currency: offerCurrency,
          margin: marginToApply,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const overallSuccess = updateResults.some(result => result.success);

    return res.status(200).json({
      success: overallSuccess,
      message: "Offer was successfully updated",
      platform: platform,
      account: account_username,
      results: updateResults,
    });
  } catch (error) {
    console.error("Error in updateOffers:", error);
    return next(error);
  }
};

export const getPlatformCostPrice = async (
  req: Request,
  res: Response
) => {
  try {
    const { platform } = req.params;

    if (!platform) {
      return res.status(400).json({ 
        success: false, 
        message: "Platform is required" 
      });
    }

    const ratesRepo = dbConnect.getRepository(Rates);
    
    // Use proper options object structure for TypeORM
    const latestRate = await ratesRepo.findOne({
      where: {}, 
      order: { createdAt: "DESC" }, 
    });

    if (!latestRate?.platformCostPrices) {
      return res.status(404).json({
        success: false,
        message: "No cost price data found.",
      });
    }

    const costPrice = latestRate.platformCostPrices[platform.toLowerCase()];

    if (costPrice === undefined) {
      return res.status(404).json({
        success: false,
        message: `No cost price found for platform ${platform}`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        platform,
        costPrice,
      }
    });
  } catch (error) {
    console.error("Error fetching platform cost price:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error 
    });
  }
};

export const turnOffAllOffers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const services = await initializePlatformServices();

    for (const service of [...services.paxful, ...services.noones]) {
      await service.turnOffAllOffers();
    }
    return res.status(200).json({
      success: true,
      message: `Turned off offers on all platforms`,
    });
  } catch (error) {
    return next(error);
  }
};

export const getOffersMargin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const services = await initializePlatformServices();

    // Fetch offers from both platforms.
    const noonesOffers = await fetchAllOffers(services.noones);
    const paxfulOffers = await fetchAllOffers(services.paxful);
    const allOffers = [...noonesOffers, ...paxfulOffers];

    // Filter to include only offers with an offer_hash for USDT or BTC.
    const filteredOffers = allOffers.filter(
      (offer) =>
        offer.offer_hash &&
        (offer.crypto_currency_code === "USDT" ||
          offer.crypto_currency_code === "BTC")
    );

    // Group offers by account_username.
    const grouped: Record<
      string,
      {
        platform: string;
        marginBTC?: number;
        marginUSDT?: number;
      }
    > = {};

    filteredOffers.forEach((offer) => {
      const account = offer.account_username;
      if (!account) return;
      if (!grouped[account]) {
        grouped[account] = { platform: offer.platform };
      }
      if (offer.crypto_currency_code === "BTC") {
        grouped[account].marginBTC = offer.margin;
      } else if (offer.crypto_currency_code === "USDT") {
        grouped[account].marginUSDT = offer.margin;
      }
    });

    // Convert grouped object into an array.
    const responseData = Object.keys(grouped).map((account) => ({
      account_username: account,
      platform: grouped[account].platform,
      marginBTC: grouped[account].marginBTC,
      marginUSDT: grouped[account].marginUSDT,
    }));

    return res.status(200).json({
      success: true,
      message: "Margin data fetched successfully",
      data: responseData,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateAccountRates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { platformRates } = req.body;

    // Validate required field.
    if (!platformRates || typeof platformRates !== "object") {
      return next(
        new ErrorHandler(
          "Missing required field: platformRates is required",
          400
        )
      );
    }

    const ratesRepository = dbConnect.getRepository(Rates);
    const ratesAll = await ratesRepository.find();
    if (ratesAll.length === 0) {
      return next(new ErrorHandler("No rates record found", 404));
    }
    const rates = ratesAll[0];

    // Update the platformRates field.
    rates.platformRates = platformRates;

    await ratesRepository.save(rates);

    return res.status(200).json({
      success: true,
      message: "Account rates updated successfully",
      data: rates.platformRates,
    });
  } catch (error) {
    return next(error);
  }
};

export const getCurrencyRates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const services = await initializePlatformServices();

    const rates: {
      noonesRate?: number;
      binanceRate?: any;
      paxfulRate?: number;
    } = {};

    // Use Promise.allSettled for parallel fetching with error tolerance
    const ratePromises = [
      // Noones Rates
      ...(services.noones.length > 0 ? [
        services.noones[0].getBitcoinPrice().then(rate => {
          rates.noonesRate = rate;
          console.log("Noones rate: ", rate);
        }).catch(error => console.error("Error fetching Noones rate:", error))
      ] : []),

      // Binance Rates
      ...(services.binance.length > 0 ? [
        services.binance[0].fetchAllRates().then(({ btcUsdt }) => {
          rates.binanceRate = btcUsdt.price;
          console.log("Binance rate: ", btcUsdt.price);
        }).catch(error => console.error("Error fetching Binance rate:", error))
      ] : []),

      // Paxful Rates
      paxfulService.getBitcoinPrice().then(rate => {
        rates.paxfulRate = rate;
        console.log("Paxful rate: ", rate);
      }).catch(error => console.error("Error fetching Paxful rate:", error))
    ];

    // Wait for all promises to settle
    await Promise.allSettled(ratePromises);

    if (Object.keys(rates).length === 0) {
      return next(new ErrorHandler("Failed to fetch rates from any platform", 500));
    }

    return res.status(200).json({ data: { ...rates }, success: true });
  } catch (error: any) {
    console.log(error.message);
    return next(error);
  }
};

const markTradeAsModified = (tradeId: string) => {
  recentlyModifiedTrades.set(tradeId, Date.now());
};

setInterval(() => {
  const now = Date.now();
  recentlyModifiedTrades.forEach((time, hash) => {
    if (now - time > 40000) {
      recentlyModifiedTrades.delete(hash);
    }
  });
}, 30000);

const checkDbConnection = async (): Promise<boolean> => {
  // If DataSource hasn't finished initializing yet, skip the check
  if (!dbConnect.isInitialized) {
    console.warn("DB health-check skipped: DataSource not yet initialized");
    return false;
  }

  try {
    await dbConnect.query("SELECT 1");
    return true;
  } catch (err) {
    console.error("DB health-check failed after init:", err);
    return false;
  }
};

const processingLock = new Map<string, boolean>();

const upsertLiveTrades = async (liveTrades: any[]) => {
  const tradeRepo = dbConnect.getRepository(Trade);

  for (const t of liveTrades) {
    const lower = t.trade_status.toLowerCase();
    // map the platform‐string to your enum
    const statusMap: Record<string, TradeStatus> = {
      'active funded': TradeStatus.ACTIVE_FUNDED,
      'paid': TradeStatus.PAID,
      'completed': TradeStatus.COMPLETED,
      'successful': TradeStatus.SUCCESSFUL,
      'cancelled': TradeStatus.CANCELLED,
      'expired': TradeStatus.CANCELLED,
      'disputed': TradeStatus.DISPUTED,
    };
    const newStatus = statusMap[lower] ?? TradeStatus.ACTIVE_FUNDED;

    // build only the fields you need to upsert
    const mapped: Partial<Trade> = {
      tradeHash: t.trade_hash,
      accountId: t.accountId,
      platform: t.platform,
      tradeStatus: t.trade_status,
      status: newStatus,
      amount: t.fiat_amount_requested,
      cryptoAmountRequested: t.crypto_amount_requested,
      cryptoAmountTotal: t.crypto_amount_total,
      feeCryptoAmount: t.fee_crypto_amount,
      feePercentage: t.fee_percentage,
      sourceId: t.source_id,
      responderUsername: t.responder_username,
      ownerUsername: t.owner_username,
      paymentMethod: t.payment_method_name,
      locationIso: t.location_iso,
      fiatCurrency: t.fiat_currency_code,
      cryptoCurrencyCode: t.crypto_currency_code,
      isActiveOffer: t.is_active_offer,
      offerHash: t.offer_hash,
      margin: t.margin,
      btcRate: t.fiat_price_per_btc,
      btcNgnRate: t.fiat_price_per_crypto,
      usdtNgnRate: t.crypto_current_rate_usd,
      dollarRate: t.fiat_price_per_btc / t.crypto_current_rate_usd,
      ...(newStatus === TradeStatus.CANCELLED || newStatus === TradeStatus.COMPLETED || newStatus === TradeStatus.SUCCESSFUL || newStatus === TradeStatus.PAID
        ? { assignedPayerId: undefined }
        : {}
      ),
    };

    const existing = await tradeRepo.findOne({ where: { tradeHash: mapped.tradeHash } });
    if (existing) {
      // Check if status is changing to emit proper event
      const statusChanged = existing.status !== newStatus;
      const wasAssigned = existing.assignedPayerId !== undefined;
      
      // Update the trade
      await tradeRepo.update(existing.id, mapped);
      
      // If status changed to a terminal state, emit event
      if (statusChanged) {
        // Get the io instance
        const io: Server = app.get("io");
        
        // Emit event for status change
        io.emit("tradeStatusChanged", {
          tradeId: existing.id,
          status: newStatus,
        });
        
        // For previously assigned trades that are now terminal, notify specifically
        if (wasAssigned && (
          newStatus === TradeStatus.CANCELLED || 
          newStatus === TradeStatus.COMPLETED || 
          newStatus === TradeStatus.SUCCESSFUL || 
          newStatus === TradeStatus.PAID
        )) {
          // Use the emitTradeStatusChange function if available
          if (typeof emitTradeStatusChange === 'function') {
            emitTradeStatusChange(existing.id, newStatus, existing.assignedPayerId);
          }
          console.log(`Status changed for assigned trade ${existing.id}: ${existing.status} -> ${newStatus}`);
        }
      }
    } else {
      await tradeRepo.save(mapped as Trade);
    }
  }
};

const aggregateLiveTrades = async (): Promise<any[]> => {
  const services = await initializePlatformServices();
  let all: any[] = [];

  for (const svc of services.paxful) {
    try {
      const pax = await svc.listActiveTrades();
      all = all.concat(pax.map((t: any) => ({ ...t, platform: 'paxful', accountId: svc.accountId })));
    } catch (err) {
      console.error(`Paxful listActiveTrades error for ${svc.accountId}:`, err);
    }
  }

  for (const svc of services.noones) {
    try {
      const noones = await svc.listActiveTrades();
      all = all.concat(noones.map((t: any) => ({ ...t, platform: 'noones', accountId: svc.accountId })));
    } catch (err) {
      console.error(`Noones listActiveTrades error for ${svc.accountId}:`, err);
    }
  }

  const filtered = all.filter((t) => t.trade_status.toLowerCase() === 'active funded');
  await upsertLiveTrades(filtered);
  return filtered;
};

const syncCancelledTrades = async (): Promise<void> => {
  const services = await initializePlatformServices();
  const liveHashes = new Set<string>();

  // gather all active‐funded hashes
  for (const list of [services.paxful, services.noones]) {
    for (const svc of list) {
      try {
        const trades = await svc.listActiveTrades();
        trades.forEach((t: any) => liveHashes.add(t.trade_hash));
      } catch (err) {
        console.error('syncCancelledTrades list error:', err);
      }
    }
  }

  const repo = dbConnect.getRepository(Trade);
  const stale = await repo.find({
    where: [
      { status: TradeStatus.ACTIVE_FUNDED },
      { status: TradeStatus.ASSIGNED },
      { status: TradeStatus.ESCALATED },
      {
        tradeStatus: Not(TradeStatus.CANCELLED),
        status: Not(In([TradeStatus.COMPLETED, TradeStatus.ESCALATED])),
        isEscalated: true
      }
    ],
  });

  for (const t of stale) {
    if (!liveHashes.has(t.tradeHash)) {
      // Store the assignedPayerId before deletion for notifications
      const assignedPayerId = t.assignedPayerId;
      const tradeId = t.id;

      // Delete the trade
      await repo.delete(t.id);
      
      // Get the io instance
      const io: Server = app.get("io");
      
      // Emit generic deletion event (this works already in your code)
      io.emit("tradeDeleted", { tradeId: t.id });
      
      // Also emit specific status change event (new)
      if (assignedPayerId) {
        // Use emitTradeStatusChange if available
        if (typeof emitTradeStatusChange === 'function') {
          emitTradeStatusChange(tradeId, TradeStatus.CANCELLED, assignedPayerId);
        } else {
          // Otherwise emit directly to the assigned payer's room
          io.to(assignedPayerId).emit("tradeStatusChanged", {
            tradeId,
            status: TradeStatus.CANCELLED,
          });
        }
      }
      
      console.log(`Auto-cancelled & notified deletion of ${t.tradeHash}`);
    }
  }
};

async function safeAssignTrade(tradeHash: string, processFn: () => Promise<void>) {
  if (processingLock.get(tradeHash)) {
    console.log(`Trade ${tradeHash} is already being processed`);
    return;
  }

  // Add this check
  const lastModified = recentlyModifiedTrades.get(tradeHash);
  if (lastModified && (Date.now() - lastModified < 10000)) {
    console.log(`Trade ${tradeHash} was recently modified, skipping`);
    return;
  }

  processingLock.set(tradeHash, true);
  try {
    await processFn();
  } finally {
    processingLock.delete(tradeHash);
  }
}

export const assignLiveTradesInternal = async (): Promise<any[]> => {
  const queryRunner = dbConnect.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 0) Cancel any stale trades no longer active on platform
    await syncCancelledTrades();

    // 1) Fetch all "active funded" trades from platforms
    const liveTrades = await aggregateLiveTrades();
    if (liveTrades.length === 0) {
      // console.log('No live trades found.');
      await queryRunner.commitTransaction();
      return [];
    }

    // 2) Load existing DB entries for these trades
    const hashes = liveTrades.map(t => t.trade_hash);
    const existingTrades = await queryRunner.manager.find(Trade, {
      where: { tradeHash: In(hashes) }
    });
    const existingMap = new Map(existingTrades.map(t => [t.tradeHash, t]));

    // 3) Normalize and persist immediate status changes
    for (const td of liveTrades) {
      const lower = td.trade_status.toLowerCase();
      const existing = existingMap.get(td.trade_hash);

      if (existing) {

        if (existing.isEscalated === true) {
          if (existing.status !== TradeStatus.ESCALATED) {
            existing.status = TradeStatus.ESCALATED;
            await queryRunner.manager.save(existing);
            console.log(`Enforced ESCALATED for ${td.trade_hash}`);
            
          }
          continue;
        }

        // b) Map platform statuses
        if (lower === 'active funded') {
          if (existing.status !== TradeStatus.ACTIVE_FUNDED) {
            existing.status = TradeStatus.ACTIVE_FUNDED;
            existing.tradeStatus = td.trade_status;
            await queryRunner.manager.save(existing);
            console.log(`Set ${td.trade_hash} → ACTIVE_FUNDED`);
          }
        } else if (lower === 'paid' || lower === 'completed') {
          if (existing.status !== TradeStatus.COMPLETED) {
            existing.status = TradeStatus.COMPLETED;
            existing.tradeStatus = td.trade_status;
            existing.assignedPayerId = undefined;
            await queryRunner.manager.save(existing);
            const io: Server = app.get("io");
    io.emit("tradeStatusChanged", {
      tradeId: existing.id,
      status: existing.status,
    });
            // console.log(`Set ${td.trade_hash} → COMPLETED`);
          }
        } else if (lower === 'successful') {
          if (existing.status !== TradeStatus.SUCCESSFUL) {
            existing.status = TradeStatus.SUCCESSFUL;
            existing.tradeStatus = td.trade_status;
            existing.assignedPayerId = undefined;
            await queryRunner.manager.save(existing);
            const io: Server = app.get("io");
            io.emit("tradeStatusChanged", {
              tradeId: existing.id,
              status: existing.status,
            });
            // console.log(`Set ${td.trade_hash} → SUCCESSFUL`);
          }
        } else if (['cancelled', 'expired', 'disputed'].includes(lower)) {
          if (existing.status !== TradeStatus.CANCELLED) {
            existing.status = TradeStatus.CANCELLED;
            existing.tradeStatus = td.trade_status;
            existing.assignedPayerId = undefined;
            await queryRunner.manager.save(existing);
            const io: Server = app.get("io");
    io.emit("tradeStatusChanged", {
      tradeId: existing.id,
      status: existing.status,
    });
            // console.log(`Set ${td.trade_hash} → CANCELLED`);
          }
        }
      }
    }

    // 4) Filter only "active funded" (PENDING) & not escalated & not recently modified
    const currentTime = Date.now();
    const toAssign = liveTrades.filter(td => {
      const lower = td.trade_status.toLowerCase();
      const existing = existingMap.get(td.trade_hash);

      // Check if this trade was recently modified (within last 10 seconds)
      const lastModified = recentlyModifiedTrades.get(td.trade_hash);
      const recentlyModified = lastModified && (currentTime - lastModified < 10000);

      return (
        lower === 'active funded' &&
        !(existing && existing.isEscalated) &&
        !recentlyModified // Don't reassign recently modified trades
      );
    });

    if (toAssign.length === 0) {
      console.log('No pending trades to assign');
      await queryRunner.commitTransaction();
      return [];
    }

    // 5) FIFO sort
    toAssign.sort((a, b) => {
      const aT = new Date(a.created_at || 0).getTime();
      const bT = new Date(b.created_at || 0).getTime();
      return aT - bT;
    });

    // 6) Determine free payers
    const available = await getAvailablePayers();
    const assigned = await queryRunner.manager.find(Trade, {
      where: {
        status: TradeStatus.ASSIGNED,
        assignedPayerId: In(available.map(p => p.id))
      }
    });
    const busySet = new Set(assigned.map(t => t.assignedPayerId!));
    const free = available.filter(p => !busySet.has(p.id));
    // console.log(`Pending: ${toAssign.length}, Available: ${available.length}, Free: ${free.length}`);

    // 7) Assign PENDING trades to free payers
    const out: any[] = [];
    const services: PlatformServices = await initializePlatformServices();

    for (const td of toAssign) {
      await safeAssignTrade(td.trade_hash, async () => {
        const t = await queryRunner.manager.findOne(Trade, {
          where: { tradeHash: td.trade_hash },
          lock: { mode: 'pessimistic_write' }
        });
        if (!t || t.status !== TradeStatus.ACTIVE_FUNDED) return;

        // Double-check it wasn't recently modified
        const lastModified = recentlyModifiedTrades.get(td.trade_hash);
        if (lastModified && (currentTime - lastModified < 10000)) {
          console.log(`Skipping ${td.trade_hash} - recently modified`);
          return;
        }

        if (free.length > 0) {
          const payer = free.shift()!;
          t.status = TradeStatus.ASSIGNED;
          t.tradeStatus = td.trade_status;
          t.assignedPayerId = payer.id;
          t.assignedAt = new Date();
          const saved = await queryRunner.manager.save(t);
          console.log(`Assigned ${td.trade_hash} → payer ${payer.id} ${payer.fullName}`);

          // Optionally fetch details/chat here
          out.push(saved);
        } else {
          console.log(`${td.trade_hash} remains PENDING (no free payers)`);
        }
      });
    }

    await queryRunner.commitTransaction();
    return out;
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error('Error in assignLiveTradesInternal:', err);
    throw err;
  } finally {
    await queryRunner.release();
  }
};

export const getLiveTrades = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trades = await aggregateLiveTrades();
    return res.status(200).json({ success: true, data: trades });
  } catch (err) {
    return next(err);
  }
};

export const assignLiveTrades = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const processedTrades = await assignLiveTradesInternal();
    return res.status(200).json({
      success: true,
      message: "Live trades processed with FIFO assignment.",
      data: processedTrades,
    });
  } catch (error) {
    return next(error);
  }
};

let isProcessing = false;
const pollAndAssignLiveTrades = async () => {
  if (isProcessing) return;
  isProcessing = true;
  try {
    // Check database connection first
    const isConnected = await checkDbConnection();
    if (!isConnected) {
      // console.log("Database not connected, skipping trade assignment cycle");
      return;
    }

    const assigned = await assignLiveTradesInternal();
    if (assigned.length) console.log(`Assigned ${assigned.length} trades`);
  } catch (error: unknown) {
    console.error('pollAndAssignLiveTrades error:', error);

    // Type check the error before accessing properties
    if (error instanceof Error) {
      // Now TypeScript knows this is an Error object with a message property
      if (error.message.includes('not Connected')) {
        // console.log('Connection issue detected, attempting recovery...');
        try {
          // Some databases allow explicit reconnection
          await dbConnect.connect();
          // console.log('Successfully reconnected to database');
        } catch (reconnectErr) {
          console.error('Failed to reconnect:', reconnectErr);
        }
      }
    }
  } finally {
    isProcessing = false;
  }
};

setInterval(pollAndAssignLiveTrades, 2000);

const getAvailablePayers = async (): Promise<User[]> => {
  const userRepository = dbConnect.getRepository(User);
  const shiftRepository = dbConnect.getRepository(Shift);

  try {
    // 1. Get all users with PAYER role who are marked as clocked in
    const activePayerUsers = await userRepository.find({
      where: {
        userType: UserType.PAYER,
        clockedIn: true,      // Must be marked as clocked in
        status: "active"      // Must have an active account status
      },
      order: { createdAt: "ASC" }, // Maintain FIFO order
    });

    if (activePayerUsers.length === 0) {
      console.log("No clocked-in payers found.");
      return [];
    }

    // 2. Get the active shifts for these payers (specifically not on break)
    const activePayers = await shiftRepository.find({
      where: {
        status: ShiftStatus.ACTIVE, // Must be ACTIVE, not ON_BREAK
        user: {
          id: In(activePayerUsers.map(p => p.id)) // Only from our filtered payers
        }
      },
      relations: ["user"], // Include user data
    });

    // 3. Get the final list of eligible payers
    const availablePayers = activePayers.map(shift => shift.user);

    // 4. Double check the result by verifying each payer is actually clocked in
    const verifiedAvailablePayers = availablePayers.filter(payer => {
      const isEligible = payer && payer.clockedIn === true;
      if (!isEligible) {
        console.log(`Excluded payer ${payer.id}: not properly clocked in`);
      }
      return isEligible;
    });

    console.log(`Found ${verifiedAvailablePayers.length} ${verifiedAvailablePayers} truly available payers.`);
    return verifiedAvailablePayers;
  } catch (error) {
    console.error("Error getting available payers:", error);
    return []; // Return empty array on error
  }
};

export const getTradeDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { platform, tradeHash, accountId } = req.params;
    if (!platform || !tradeHash || !accountId) {
      return next(
        new ErrorHandler(
          "Platform, trade hash, and account ID are required",
          400
        )
      );
    }

    const services = await initializePlatformServices();
    let externalTrade: any;
    let tradeChat: any;

    switch (platform) {
      case "noones": {
        const svc = services.noones.find((s) => s.accountId === accountId);
        if (!svc) {
          return next(new ErrorHandler("Account not found", 404));
        }
        externalTrade = await svc.getTradeDetails(tradeHash);
        tradeChat = await svc.getTradeChat(tradeHash);
        break;
      }

      case "paxful": {
        const svc = services.paxful.find((s) => s.accountId === accountId);
        if (!svc) {
          return next(new ErrorHandler("Account not found", 404));
        }
        // fetch both trade details and chat
        const resp = await svc.getTradeDetails(tradeHash);
        externalTrade = resp.data.trade;
        tradeChat = await svc.getTradeChat(tradeHash);
        break;
      }

      default:
        return next(new ErrorHandler("Unsupported platform", 400));
    }

    const tradeRepository = dbConnect.getRepository(Trade);
    const tradeRecord = await tradeRepository.findOne({
      where: { tradeHash },
      relations: ["assignedPayer"],
    });

    if (!tradeRecord) {
      return next(new ErrorHandler("No trade record found in the database", 404));
    }

    let tradeDuration: number | null = null;
    if (tradeRecord.assignedAt && tradeRecord.completedAt) {
      tradeDuration =
        (tradeRecord.completedAt.getTime() - tradeRecord.assignedAt.getTime()) / 1000;
    }

    // 1) Pull raw messages & attachments
    const messages = Array.isArray(tradeChat.messages) ? tradeChat.messages : [];
    const attachments = tradeChat.attachments || [];

    // 2) Find the first chat message carrying bank_account payload
    const bankMsg = messages.find(
      (m: any) => m.content && typeof m.content === 'object' && m.content.bank_account
    );
    const ba = bankMsg ? (bankMsg.content as any).bank_account : {};

    // 3) Format externalTrade, overriding bank fields per-platform
    const formattedExternalTrade = {
      btcRate: externalTrade?.fiat_price_per_btc ?? null,
      dollarRate:
        externalTrade?.fiat_price_per_btc != null && externalTrade?.crypto_current_rate_usd
          ? externalTrade.fiat_price_per_btc / externalTrade.crypto_current_rate_usd
          : null,
      amount: externalTrade?.fiat_amount_requested ?? null,
      buyer_name: externalTrade?.buyer_name ?? "Anonymous",

      // Bank fields: for paxful only from chat, default to "N/A" if missing
      bankName: platform === "paxful"
        ? (ba.bank_name || "N/A")
        : (ba.bank_name || externalTrade?.bank_accounts?.to?.bank_name || "N/A"),

      accountNumber: platform === "paxful"
        ? (ba.account_number || "N/A")
        : (ba.account_number || externalTrade?.bank_accounts?.to?.account_number || "N/A"),

      accountHolder: platform === "paxful"
        ? (ba.holder_name || "N/A")
        : (ba.holder_name || externalTrade?.bank_accounts?.to?.holder_name || "N/A"),
    };

    // 4) Format messages for front-end
    const formattedMessages = messages.map((msg: any) => ({
      id: msg.id || Math.random().toString(36).substr(2, 9),
      content: msg.text ?? msg.content ?? "",
      sender: {
        id: msg.author?.externalId || "system",
        fullName: msg.author?.userName || "System",
      },
      createdAt: msg.timestamp && !isNaN(msg.timestamp)
        ? new Date(Number(msg.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
    }));

    // 5) Respond with everything
    return res.status(200).json({
      success: true,
      data: {
        externalTrade: formattedExternalTrade,
        tradeChat: {
          messages: formattedMessages,
          attachments,
        },
        tradeRecord,
        tradeDuration,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const sendTradeChatMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { tradeId } = req.params;
    const { content } = req.body;
    if (!tradeId || !content) {
      return next(new ErrorHandler("Trade ID and content are required", 400));
    }

    const tradeRepository = dbConnect.getRepository(Trade);
    const trade = await tradeRepository.findOne({ where: { id: tradeId } });
    if (!trade) {
      return next(new ErrorHandler("Trade not found", 404));
    }

    // Only allow trades from supported platforms.
    if (trade.platform !== "paxful" && trade.platform !== "noones") {
      return next(new ErrorHandler("Unsupported platform", 400));
    }

    const services = await initializePlatformServices();
    const platformService = services[trade.platform]?.find(
      (s: any) => s.accountId === trade.accountId
    );
    if (!platformService) {
      return next(new ErrorHandler("Platform service not found", 404));
    }

    try {
      await platformService.sendTradeMessage(trade.tradeHash, content);
    } catch (err) {
      // Log the error but assume the message was sent if the external system
      // indicates that it was accepted (you might check err.response or other details)
      console.error("Error during sendTradeMessage:", err);
      // Optionally, check the error details here.
    }

    return res.status(200).json({
      success: true,
      message: "Message posted successfully"
    });
  } catch (error) {
    return next(error);
  }
};

export const getWalletBalances = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const accountRepository = dbConnect.getRepository(Account);
    const accounts = await accountRepository.find({
      where: { status: "active" },
    });

    const services: PlatformService[] = [];
    const balances: Record<string, any> = {};

    // Loop over each account to initialize services
    for (const account of accounts) {
      try {
        switch (account.platform) {
          case "noones":
            services.push({
              platform: "noones",
              label: account.account_username,
              accountId: account.id,
              getBalance: async () => {
                const service = new NoonesService({
                  apiKey: account.api_key,
                  apiSecret: account.api_secret,
                  label: account.account_username,
                });
                await service.initialize();
                return service.getWalletBalances();
              },
            });
            break;
          case "paxful":
            services.push({
              platform: "paxful",
              label: account.account_username,
              accountId: account.id,
              getBalance: async () => {
                const service = new PaxfulService({
                  clientId: account.api_key,
                  clientSecret: account.api_secret,
                  label: account.account_username,
                });

                // Get both BTC and USDT balances
                const btcBalance = await service.getWalletBalance('BTC');
                const usdtBalance = await service.getWalletBalance('USDT');

                return [
                  {
                    currency: "BTC",
                    name: "Bitcoin",
                    balance: btcBalance,
                    type: "crypto",
                  },
                  {
                    currency: "USDT",
                    name: "Tether",
                    balance: usdtBalance,
                    type: "crypto",
                  }
                ];
              },
            });
            break;
          case "binance":
            services.push({
              platform: "binance",
              label: account.account_username,
              accountId: account.id,
              getBalance: async () => {
                try {
                  console.log(`Initializing Binance service for account: ${account.account_username}`);
                  const service = new BinanceService({
                    apiKey: account.api_key,
                    apiSecret: account.api_secret,
                    label: account.account_username,
                  });

                  // Now fetch BTC and USDT too
                  const btcData = await service.getAvailableBalance("BTC");
                  const usdtData = await service.getAvailableBalance("USDT");

                  console.log(`BTC balance: ${JSON.stringify(btcData)}`);
                  console.log(`USDT balance: ${JSON.stringify(usdtData)}`);

                  return [
                    {
                      currency: "BTC",
                      name: "Bitcoin",
                      balance: btcData.total,
                      type: "crypto",
                    },
                    {
                      currency: "USDT",
                      name: "Tether",
                      balance: usdtData.total,
                      type: "crypto",
                    },
                  ];
                } catch (error) {
                  console.error(`Error fetching Binance balances for ${account.account_username}:`, error);
                  throw error;
                }
              },

            });
            break;

          default:
            // Handle any unsupported platforms
            balances[account.id] = {
              error: "Platform not supported",
              platform: account.platform,
              label: account.account_username,
              balances: [],
            };
        }
      } catch (error) {
        console.error(`Error initializing service for account ${account.id}:`, error);
        // Set error response with an empty balances array
        balances[account.id] = {
          error: "Service initialization failed",
          platform: account.platform,
          label: account.account_username,
          balances: [],
        };
      }
    }

    // Execute balance fetching in parallel
    await Promise.all(
      services.map(async (service) => {
        try {
          const balance = await service.getBalance();
          balances[service.accountId] = {
            platform: service.platform,
            label: service.label,
            balances: balance, // This will now be an array with BTC (and USDT for Binance/Noones)
          };
        } catch (error) {
          console.error(`Error fetching balance for ${service.label}:`, error);
          balances[service.accountId] = {
            error: "Failed to fetch balance",
            platform: service.platform,
            label: service.label,
            balances: [],
          };
        }
      })
    );

    const transformedBalances: Record<string, any> = {};
    for (const [accountId, balanceData] of Object.entries(balances)) {
      // Format balance function with special handling for each platform
      const formatBalance = (balance: any, currency: string, platform: string) => {
        // Extract the raw balance value - could be string or number
        let raw = balance.free ?? balance.balance;

        // Handle specific conversions for each platform
        let asNumber: number;

        if (platform === "paxful" && currency === "BTC") {
          // Paxful returns satoshis
          asNumber = typeof raw === "string" ? parseFloat(raw) / 100000000 : raw / 100000000;
        } else {
          asNumber = typeof raw === "string" ? parseFloat(raw) : raw;
        }

        // Get appropriate decimal precision from lookup table
        const precision = DECIMALS[currency] ?? 8;

        // For very small numbers, return as string to prevent scientific notation
        if (asNumber < 0.0001) {
          return asNumber.toFixed(precision); // Returns string
        }

        // For larger numbers, return as number
        return parseFloat(asNumber.toFixed(precision));
      };

      if (balanceData.error) {
        transformedBalances[accountId] = {
          error: balanceData.error,
          platform: balanceData.platform,
          label: balanceData.label,
          balances: [],
        };
      } else {
        transformedBalances[accountId] = {
          balances: (balanceData.balances || [])
            .filter((balance: any) =>
              ["BTC", "USDT"].includes(
                (balance.currency || balance.asset).toUpperCase()
              )
            )
            .map((balance: any) => {
              const currency = (balance.currency || balance.asset).toUpperCase();
              return {
                currency: currency,
                name: balance.name || balance.asset || currency,
                balance: formatBalance(balance, currency, balanceData.platform),
                type: balance.type || "crypto",
              };
            }),
          platform: balanceData.platform,
          label: balanceData.label,
        };
      }
    }

    return res.status(200).json({
      success: true,
      data: transformedBalances,
    });
  } catch (error) {
    console.error("Unexpected error in getWalletBalances:", error);
    return next(error);
  }
};

export const markTradeAsPaid = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { tradeId } = req.params;

    if (!tradeId) {
      return next(new ErrorHandler("Trade ID is required", 400));
    }

    const tradeRepository = dbConnect.getRepository(Trade);
    const trade = await tradeRepository.findOne({ where: { id: tradeId } });
    if (!trade) {
      return next(new ErrorHandler("Trade not found", 404));
    }

    // Only allow trades from paxful or noones
    if (trade.platform !== "paxful" && trade.platform !== "noones") {
      return next(new ErrorHandler("Unsupported platform", 400));
    }

    const services = await initializePlatformServices();
    const platformService = services[trade.platform]?.find(
      (s: any) => s.accountId === trade.accountId
    );
    if (!platformService) {
      return next(new ErrorHandler("Platform service not found", 404));
    }

    // Call the platform-specific methods to mark as paid
    await platformService.markTradeAsPaid(trade.tradeHash);

    // Update trade status to completed in our database
    trade.status = TradeStatus.COMPLETED;
    trade.completedAt = new Date();
    await tradeRepository.save(trade);

    // Mark this trade as recently modified to prevent reassignment
    markTradeAsModified(trade.tradeHash);
    // console.log(`✅ TRADE MARKED AS PAID AND COMPLETED: ${trade.tradeHash}`);

    return res.status(200).json({
      success: true,
      message: "Trade marked as paid and completed successfully",
      trade
    });
  } catch (error) {
    return next(error);
  }
};

export const getPayerTrade = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const tradeRepository = dbConnect.getRepository(Trade);

    // Get the most recently assigned trade for this payer regardless of current status
    const assignedTrade = await tradeRepository.findOne({
      where: {
        assignedPayerId: id,
        isEscalated: false,
      },
      relations: {
        assignedPayer: true,
      },
      order: {
        assignedAt: "DESC",
      },
    });

    if (!assignedTrade) {
      return res.status(404).json({
        success: false
      });
    }

    // If trade status is terminal, return 404 to indicate no active trade
    if (["CANCELLED", "COMPLETED", "SUCCESSFUL", "PAID", "ESCALATED"].includes(assignedTrade.status)) {
      return res.status(404).json({
        success: false,
        message: `Trade is in terminal state: ${assignedTrade.status}`
      });
    }

    if (!assignedTrade.assignedPayer) {
      const reloadedTrade = await tradeRepository.findOne({
        where: { id: assignedTrade.id },
        relations: ["assignedPayer"],
        select: [
          "id",
          "tradeHash",
          "platform",
          "status",
          "tradeStatus",
          "amount",
          "cryptoAmountRequested",
          "cryptoAmountTotal",
          "feeCryptoAmount",
          "feePercentage",
          "sourceId",
          "responderUsername",
          "ownerUsername",
          "paymentMethod",
          "locationIso",
          "fiatCurrency",
          "cryptoCurrencyCode",
          "isActiveOffer",
          "offerHash",
          "margin",
          "btcRate",
          "dollarRate",
          "btcAmount",
          "assignedAt",
          "completedAt",
          "notes",
          "platformMetadata",
          "activityLog",
        ],
      });

      if (!reloadedTrade?.assignedPayer) {
        console.error(`Failed to load assignedPayer relation for trade ${assignedTrade.id}`);
        return next(new ErrorHandler("Error loading trade details: Missing assigned payer information", 500));
      }

      return res.status(200).json({
        success: true,
        data: {
          ...reloadedTrade,
          platformMetadata: {
            ...reloadedTrade.platformMetadata,
            sensitiveData: undefined,
          },
        },
      });
    }

    const sanitizedTrade = {
      ...assignedTrade,
      platformMetadata: {
        ...assignedTrade.platformMetadata,
        sensitiveData: undefined,
      },
    };

    return res.status(200).json({
      success: true,
      data: sanitizedTrade,
    });
  } catch (error) {
    console.error("Error in getPayerTrade:", error);
    return next(new ErrorHandler("Error retrieving trade details", 500));
  }
};

export const getCompletedPaidTrades = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.userType ?? "";
    const isPrivileged = ["admin", "customer-support"].includes(userType);

    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "10", 10);
    const skip = (page - 1) * limit;

    // Initialize platform services
    const services = await initializePlatformServices();
    let allTrades: any[] = [];

    // Collect trades from all platforms and accounts
    for (const platform of Object.keys(services) as Array<"noones" | "paxful">) {
      for (const service of services[platform]) {
        try {
          // Skip if user isn't privileged and doesn't match the payer ID filter
          if (!isPrivileged && service.accountId !== userId) {
            continue;
          }

          // Skip if a specific payerId is requested but doesn't match this service
          if (isPrivileged && 
              typeof req.query.payerId === "string" && 
              req.query.payerId.trim() && 
              service.accountId !== req.query.payerId) {
            continue;
          }

          // Fetch trades directly from the platform
          const platformTrades = await service.listActiveTrades();
          
          if (!platformTrades || !Array.isArray(platformTrades)) {
            continue;
          }

          // Process each trade from the platform
          for (const platformTrade of platformTrades) {
            const platformStatus = (platformTrade.trade_status || "").toLowerCase();
            const isPaid = platformStatus === "paid";
            const isDisputed = platformStatus === "disputed" || !!platformTrade.dispute;

            // Only include paid or disputed trades
            if (isPaid || isDisputed) {
              // Extract common fields (with platform-specific handling)
              const owner = platformTrade.owner_username 
                          
              const username = platformTrade.responder_username
                             
              const amount = platformTrade.fiat_amount_requested || 
                           platformTrade.amount_fiat || 
                           platformTrade.amount || 
                           "N/A";
                           
              const currency = platformTrade.fiat_currency_code || 
                             platformTrade.fiat_code || 
                             platformTrade.currency_code || 
                             "USD";
                             
              const createdAt = platformTrade.created_at || 
                              platformTrade.started_at || 
                              platformTrade.timestamp 

              const tradeDetails = {
                id: platformTrade.id || platformTrade.trade_id,
                tradeHash: platformTrade.trade_hash,
                platform,
                accountId: service.accountId,
                status: isPaid ? "PAID" : "DISPUTED",
                tradeStatus: platformStatus,
                updatedAt: new Date(),
                // Include essential trade information
                owner,
                username,
                amount,
                currency,
                createdAt: new Date(createdAt),
                assignedPayer: {
                  id: service.accountId,
                  username: service.label || "N/A",
                },
                // Include platform-specific data
                platformData: platformTrade,
                // Add status-specific timestamps
                ...(isPaid && platformTrade.paid_at ? { paidAt: new Date(platformTrade.paid_at) } : {}),
                ...(isDisputed ? {
                  disputeStartedAt: platformTrade.dispute_started_at ? new Date(platformTrade.dispute_started_at) : new Date(),
                  disputeReason: platformTrade.dispute?.reason || null,
                  disputeReasonType: platformTrade.dispute?.reason_type || null,
                } : {})
              };

              allTrades.push(tradeDetails);
            }
          }
        } catch (error) {
          console.error(`Error fetching trades from ${platform} (${service.accountId}):`, error);
          // Continue with other services on error
        }
      }
    }

    // Sort trades by updatedAt date (newest first)
    allTrades.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Calculate pagination
    const totalCount = allTrades.length;
    const totalPages = Math.ceil(totalCount / limit);
    const paginatedTrades = allTrades.slice(skip, skip + limit);

    return res.status(200).json({
      success: true,
      data: {
        trades: paginatedTrades,
        pagination: {
          total: totalCount,
          totalPages,
          currentPage: page,
          itemsPerPage: limit,
        },
      },
    });
  } catch (error: any) {
    console.error("Error in getCompletedPaidTrades:", error);
    return next(
      new ErrorHandler(
        `Error retrieving paid or disputed trades: ${error.message}`,
        500
      )
    );
  }
};

export const getCompletedPayerTrades = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  const queryRunner = dbConnect.createQueryRunner();
  await queryRunner.connect();

  try {
    const userId = req?.user?.id;
    const userType = req?.user?.userType ?? "";
    const isPrivileged = ["admin", "customer-support", "payer"].includes(userType);

    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "10", 10);
    const skip = (page - 1) * limit;

    const tradeRepo = queryRunner.manager.getRepository(Trade);

    const rateRepo = queryRunner.manager.getRepository(Rates);

    let qb = tradeRepo
      .createQueryBuilder("trade")
      .leftJoinAndSelect("trade.assignedPayer", "assignedPayer")
      .where(
        "(trade.status IN (:...statuses) OR LOWER(trade.tradeStatus) IN (:...statusStrings))",
        {
          statuses: [TradeStatus.COMPLETED, TradeStatus.PAID],
          statusStrings: ["completed", "paid", "success"],
        }
      );

    if (!isPrivileged) {
      qb = qb.andWhere("assignedPayer.id = :userId", { userId });
    } else if (typeof req.query.payerId === "string" && req.query.payerId.trim()) {
      qb = qb.andWhere("assignedPayer.id = :payerId", { payerId: req.query.payerId });
    }

    const [dbTrades, total] = await qb
      .orderBy("trade.completedAt", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const services = await initializePlatformServices();
    const mappedTrades = [];

    for (const trade of dbTrades) {
      try {
        const tradeStatus = trade.tradeStatus.toLowerCase();

        const isDone = ["completed", "paid", "success"].includes(tradeStatus);
        if (!isDone) {
          const svcList = services[trade.platform as "noones" | "paxful"];
          const svc = svcList?.find((s) => s.accountId === trade.accountId);
          const platformTrade = svc ? await svc.getTradeDetails(trade.tradeHash) : null;

          if (platformTrade) {
            const platformStatus = platformTrade.status?.toLowerCase() ?? "";
            const completeNow = ["completed", "paid", "success"].includes(platformStatus);

            if (completeNow) {
              await tradeRepo.update(trade.id, {
                status: TradeStatus.COMPLETED,
                tradeStatus: platformStatus,
                completedAt: platformTrade.completedAt
                  ? new Date(platformTrade.completedAt)
                  : new Date(),
              });

              trade.status = TradeStatus.COMPLETED;
              trade.tradeStatus = platformStatus;
              trade.completedAt = platformTrade.completedAt
                ? new Date(platformTrade.completedAt)
                : new Date();
            } else {
              await tradeRepo.update(trade.id, {
                status: TradeStatus.ACTIVE_FUNDED,
                tradeStatus: platformStatus,
                notes: `Platform status: ${platformStatus}`,
              });

              trade.status = TradeStatus.ACTIVE_FUNDED;
              trade.tradeStatus = platformStatus;
              trade.notes = `Platform status: ${platformStatus}`;
            }
          } else {
            trade.notes = "Could not verify with platform";
          }
        }

        // Map to frontend-friendly structure
        mappedTrades.push({
          id: trade.id,
          tradeHash: trade.tradeHash,
          platform: trade.platform,
          accountId: trade.ownerUsername,
          assignedPayer: {
            id: trade.assignedPayer?.id || null,
            name: trade.assignedPayer?.fullName || null,
          },
          btcBought: trade.cryptoAmountTotal,
          ngnPaid: trade.amount,
          payingBank: trade.paymentMethod,
          platformAccount: trade.ownerUsername,
          sellerUsername: trade.responderUsername,
          openedAt: trade.createdAt,
          paidAt: trade.completedAt,
          payerSpeed: trade.assignedAt && trade.completedAt
            ? (trade.completedAt.getTime() - trade.assignedAt.getTime()) / 1000
            : null,
          ngnSellingPrice: trade.btcRate,
          ngnCostPrice: trade.btcNgnRate,
          usdCost: trade.dollarRate,
          status: trade.status,
          tradeStatus: trade.tradeStatus,
          notes: trade.notes || null,
        });
      } catch (err) {
        console.error(`Error verifying trade ${trade.id}:`, err);
        mappedTrades.push({
          id: trade.id,
          tradeHash: trade.tradeHash,
          platform: trade.platform,
          accountId: trade.accountId,
          assignedPayer: {
            id: trade.assignedPayer?.id || null,
            name: trade.assignedPayer?.fullName || null,
          },
          btcBought: trade.cryptoAmountTotal,
          ngnPaid: trade.amount,
          payingBank: trade.paymentMethod,
          platformAccount: trade.accountId,
          sellerUsername: trade.responderUsername,
          openedAt: trade.createdAt,
          paidAt: trade.completedAt,
          payerSpeed: null,
          ngnSellingPrice: trade.btcRate,
          ngnCostPrice: trade.btcNgnRate,
          usdCost: trade.dollarRate,
          status: trade.status,
          tradeStatus: trade.tradeStatus,
          notes: `Verification error: ${err instanceof Error ? err.message : "Unknown"}`,
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        trades: mappedTrades,
        pagination: {
          total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          itemsPerPage: limit,
        },
      },
    });
  } catch (error: any) {
    console.error("Error in getCompletedPaidTrades:", error);
    return next(new ErrorHandler(`Error retrieving completed trades: ${error.message}`, 500));
  } finally {
    await queryRunner.release();
  }
};

export const reassignTrade = async (req: Request, res: Response, next: NextFunction) => {
  const queryRunner = dbConnect.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { tradeId } = req.params;
    if (!tradeId) throw new ErrorHandler("Trade ID is required", 400);

    const tradeRepo = queryRunner.manager.getRepository(Trade);
    const trade = await tradeRepo.findOne({
      where: { id: tradeId },
      lock: { mode: "pessimistic_write" },
    });
    if (!trade) throw new ErrorHandler("Trade not found", 404);
    if ([TradeStatus.COMPLETED, TradeStatus.CANCELLED].includes(trade.status)) {
      throw new ErrorHandler("This trade cannot be reassigned", 400);
    }

    // Use the getAvailablePayers function to get only users who are clocked in AND not on break
    const availablePayers = await getAvailablePayers();

    if (availablePayers.length === 0) throw new ErrorHandler("No available payers", 400);

    const sortedPayers = availablePayers.sort((a, b) =>
      String(a.id).localeCompare(String(b.id))
    );

    let nextPayer: User;
    if (!trade.assignedPayerId) {
      nextPayer = sortedPayers[0];
    } else {
      const idx = sortedPayers.findIndex(p => String(p.id) === String(trade.assignedPayerId));
      nextPayer = sortedPayers[(idx + 1) % sortedPayers.length];
    }

    // 2) check if that payer already has an ASSIGNED trade
    const inFlight = await tradeRepo.findOne({
      where: {
        assignedPayerId: nextPayer.id,
        status: TradeStatus.ASSIGNED,
      },
    });

    if (inFlight) {
      // queue it up
      trade.status = TradeStatus.ACTIVE_FUNDED;
      trade.assignedPayerId = nextPayer.id;
    } else {
      // assign immediately
      trade.status = TradeStatus.ASSIGNED;
      trade.assignedPayerId = nextPayer.id;
      trade.assignedAt = new Date();
    }

    trade.isEscalated = false;
    await tradeRepo.save(trade);
    await queryRunner.commitTransaction();

    const updated = await dbConnect.getRepository(Trade).findOne({
      where: { id: tradeId },
      relations: ["assignedPayer"],
    });

    return res.status(200).json({
      success: true,
      message: "Trade reassigned successfully",
      data: updated,
    });
  } catch (err) {
    await queryRunner.rollbackTransaction();
    return next(err);
  } finally {
    await queryRunner.release();
  }
};

export const getAllTrades = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const queryRunner = dbConnect.createQueryRunner();
  await queryRunner.connect();

  try {
    // Pagination
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '10', 10);
    const skip = (page - 1) * limit;

    // 1) Fetch live "Active Funded" trades
    const liveTrades = await aggregateLiveTrades();
    const liveHashes = liveTrades
      .filter(t => t.trade_status.toLowerCase() === 'active funded')
      .map(t => t.trade_hash);

    // 2) Query DB for ACTIVE_FUNDED trades
    const tradeRepo = queryRunner.manager.getRepository(Trade);
    const [dbTrades, total] = await tradeRepo
      .createQueryBuilder('trade')
      .leftJoinAndSelect('trade.assignedPayer', 'assignedPayer')
      .where('trade.status = :status', { status: TradeStatus.ACTIVE_FUNDED })
      .orderBy('trade.createdAt', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    // 3) Initialize platform services
    const services = await initializePlatformServices();

    // Helper to fetch message count
    async function fetchMessageCount(
      svc: PaxfulService | NoonesService,
      tradeHash: string
    ): Promise<number> {
      try {
        const chat = await svc.getTradeChat(tradeHash);
        // Paxful/Noones both return { messages: any[] } or array directly
        if (Array.isArray(chat)) return chat.length;
        if (Array.isArray(chat.messages)) return chat.messages.length;
        if (chat.data && Array.isArray(chat.data.messages)) {
          return chat.data.messages.length;
        }
        // fallback to first array
        for (const key of Object.keys(chat || {})) {
          if (Array.isArray((chat as any)[key])) {
            return (chat as any)[key].length;
          }
        }
        return 0;
      } catch {
        return 0;
      }
    }

    // 4) Enhance DB trades
    const enhancedDbTrades = await Promise.all(
      dbTrades.map(async trade => {
        // Narrow service by platform
        let svc: PaxfulService | NoonesService | undefined;
        switch (trade.platform) {
          case 'paxful':
            svc = services.paxful.find(s => s.accountId === trade.accountId);
            break;
          case 'noones':
            svc = services.noones.find(s => s.accountId === trade.accountId);
            break;
        }

        // Apply live values if applicable
        if (liveHashes.includes(trade.tradeHash)) {
          const live = liveTrades.find(l => l.trade_hash === trade.tradeHash)!;
          trade.amount = live.fiat_amount_requested;
          trade.cryptoCurrencyCode = live.crypto_currency_code;
          trade.fiatCurrency = live.fiat_currency_code;
        }

        // Get message count only if svc supports chat
        const messageCount = svc ? await fetchMessageCount(svc, trade.tradeHash) : 0;

        return {
          id: trade.id,
          tradeHash: trade.tradeHash,
          platform: trade.platform,
          accountId: trade.accountId,
          amount: trade.amount,
          status: trade.status,
          cryptoCurrencyCode: trade.cryptoCurrencyCode,
          fiatCurrency: trade.fiatCurrency,
          assignedPayer: trade.assignedPayer?.fullName,
          createdAt: trade.createdAt,
          updatedAt: trade.updatedAt,
          ownerUsername: trade.ownerUsername,
          responderUsername: trade.responderUsername,
          messageCount,
          isLive: liveHashes.includes(trade.tradeHash),
        };
      })
    );

    // 5) Enhance purely live trades not in DB
    const dbHashSet = new Set(dbTrades.map(t => t.tradeHash));
    const enhancedLiveOnly = await Promise.all(
      liveTrades
        .filter(l =>
          l.trade_status.toLowerCase() === 'active funded' &&
          !dbHashSet.has(l.trade_hash)
        )
        .map(async live => {
          let svc: PaxfulService | NoonesService | undefined;
          switch (live.platform) {
            case 'paxful':
              svc = services.paxful.find(s => s.accountId === live.account_id);
              break;
            case 'noones':
              svc = services.noones.find(s => s.accountId === live.account_id);
              break;
          }

          const messageCount = svc ? await fetchMessageCount(svc, live.trade_hash) : 0;

          return {
            id: live.trade_hash,
            tradeHash: live.trade_hash,
            platform: live.platform,
            accountId: live.accountId || live.account_id,
            amount: live.fiat_amount_requested,
            status: TradeStatus.ACTIVE_FUNDED,
            cryptoCurrencyCode: live.crypto_currency_code,
            fiatCurrency: live.fiat_currency_code,
            ownerUsername: live.ownerUsername || live.owner_username,
            responderUsername: live.responderUsername || live.responder_username,
            paymentMethod: live.payment_method_name,
            assignedPayer: live.assignedPayer,
            createdAt: live.createdAt,
            messageCount,
            isLive: true,
          };
        })
    );

    // 6) Combine & sort by messageCount desc
    const allTrades = [...enhancedDbTrades, ...enhancedLiveOnly];
    allTrades.sort((a, b) => b.messageCount - a.messageCount);

    // 7) Respond
    return res.status(200).json({
      success: true,
      data: {
        trades: allTrades,
        pagination: {
          total,
          totalPages,
          currentPage: page,
          itemsPerPage: limit,
        },
      },
    });
  } catch (err: any) {
    console.error('Error in getAllTrades:', err);
    return next(new ErrorHandler(`Error retrieving trades: ${err.message}`, 500));
  } finally {
    await queryRunner.release();
  }
};

export const getUnfinishedTrades = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tradeRepository = dbConnect.getRepository(Trade);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Example: return trades that are not completed or not marked as "Paid"
    const [trades, total] = await tradeRepository.findAndCount({
      where: { status: Not(TradeStatus.COMPLETED) },
      skip,
      take: limit,
      order: { createdAt: "DESC" },
    });

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: { trades, pagination: { total, totalPages, currentPage: page, itemsPerPage: limit } },
    });
  } catch (error: any) {
    return next(new ErrorHandler(`Error retrieving unfinished trades: ${error.message}`, 500));
  }
};

export const updateCapRate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { btcngnrate, marketCap } = req.body;

    const ratesRepo = dbConnect.getRepository(Rates);
    const existingRates = await ratesRepo.findOne({ where: {} });

    if (!existingRates) {
      return res.status(404).json({ success: false, message: "Rates not found" });
    }

    if (btcngnrate !== undefined) {
      existingRates.btcngnrate = btcngnrate;
    }

    // Add handling for marketCap
    if (marketCap !== undefined) {
      existingRates.marketcap = marketCap;
    }

    await ratesRepo.save(existingRates);

    return res.status(200).json({
      success: true,
      message: "Rates updated successfully",
      data: existingRates,
    });
  } catch (error) {
    console.error("Error updating rates:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getCapRate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ratesRepo = dbConnect.getRepository(Rates);
    const rates = await ratesRepo.findOne({ where: {} });

    if (!rates) {
      return res.status(404).json({
        success: false,
        message: "Rates not found",
      });
    }

    // Extract only the desired fields
    const { marketcap, btcngnrate } = rates;

    return res.status(200).json({
      success: true,
      message: "Rates fetched successfully",
      data: { marketcap, btcngnrate },
    });
  } catch (error) {
    next(error);
  }
};

export const setOrUpdateRates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { sellingPrice, usdtNgnRate, platformRates } = req.body;

    // Validate required fields
    if (
      sellingPrice === undefined ||
      usdtNgnRate === undefined ||
      !platformRates ||
      typeof platformRates !== "object"
    ) {
      return next(
        new ErrorHandler(
          "Missing required fields: sellingPrice, usdtNgnRate, and platformRates are required",
          400
        )
      );
    }

    const ratesRepository = dbConnect.getRepository(Rates);
    const ratesAll = await ratesRepository.find();
    let rates = ratesAll.length > 0 ? ratesAll[0] : new Rates();

    // Set global rate values
    rates.sellingPrice = sellingPrice;
    rates.usdtNgnRate = usdtNgnRate;

    // Save the dynamic platform rates object into a JSON field
    // Make sure your Rates entity has a JSON column (e.g., platformRates) defined.
    rates.platformRates = platformRates;

    await ratesRepository.save(rates);

    return res.status(ratesAll.length > 0 ? 200 : 201).json({
      success: true,
      message:
        ratesAll.length > 0
          ? "Rates updated successfully"
          : "Rates set successfully",
      data: rates,
    });
  } catch (error) {
    return next(error);
  }
};

export const getRates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ratesRepository = dbConnect.getRepository(Rates);
    const ratesAll = await ratesRepository.find();
    if (ratesAll.length === 0) {
      return res.status(200).json({
        success: true,
        data: {},
      });
    }
    const rates = ratesAll[0];
    return res.status(200).json({
      success: true,
      message: "Rates fetched successfully",
      data: rates,
    });
  } catch (error) {
    return next(error);
  }
};

export const getActiveFundedTotal = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const liveTrades = await aggregateLiveTrades();
    console.log(`Found ${liveTrades.length} live trades`);

    let totalActiveFundedBTC = 0;
    let totalActiveFundedUSDT = 0;

    for (const trade of liveTrades) {
      const code = (trade.crypto_currency_code || "").toUpperCase();
      const raw = parseFloat(trade.crypto_amount_total ?? "0");
      console.log(`Processing trade: ${trade.trade_hash}, Currency: ${code}, Raw amount: ${raw}, Status: ${trade.trade_status}`);

      const decimals = DECIMALS[code] || 0;
      const amt = raw / 10 ** decimals;
      console.log(`Adjusted amount: ${amt}`);

      if (code === "BTC") {
        totalActiveFundedBTC += amt;
        console.log(`Adding to BTC total, now: ${totalActiveFundedBTC}`);
      } else if (code === "USDT") {
        totalActiveFundedUSDT += amt;
        console.log(`Adding to USDT total, now: ${totalActiveFundedUSDT}`);
      }
    }

    console.log(`Final totals - BTC: ${totalActiveFundedBTC}, USDT: ${totalActiveFundedUSDT}`);
    return res.status(200).json({
      success: true,
      data: {
        btc: totalActiveFundedBTC,
        usdt: totalActiveFundedUSDT,
      },
    });
  } catch (error) {
    console.error("Error in getActiveFundedTotal:", error);
    return next(error);
  }
};

export const getVendorCoin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const services = await initializePlatformServices();
    let totalVendorCoinBTC = 0;
    let totalVendorCoinUSDT = 0;

    // Flatten Paxful + Noones
    const allServices = [...services.paxful, ...services.noones];

    for (const svc of allServices) {
      // Remove the hard‑coded "1" so we get all completed trades
      const completedTrades = await svc.listCompletedTrades();

      for (const trade of completedTrades) {
        const status = (trade.trade_status).toLowerCase();
        if (status !== "paid") continue;

        const code = (trade.crypto_currency_code || "").toUpperCase();
        const amt = parseFloat(trade.crypto_amount_requested ?? "0");

        if (code === "BTC") {
          totalVendorCoinBTC += amt;
        } else if (code === "USDT") {
          totalVendorCoinUSDT += amt;
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        btc: totalVendorCoinBTC,
        usdt: totalVendorCoinUSDT,
      },
    });
  } catch (error) {
    console.error("Error in getVendorCoin:", error);
    return next(error);
  }
};

export const escalateTrade = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { tradeId } = req.params;
  const { reason, escalatedById } = req.body;
  try {
    const tradeRepo = dbConnect.getRepository(Trade);
    const trade = await tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) throw new Error('Trade not found');

    trade.isEscalated = true;
    trade.status = TradeStatus.ESCALATED;
    trade.escalationReason = reason;
    trade.escalatedById = escalatedById;
    trade.assignedPayerId = undefined;
    await tradeRepo.save(trade);

    const io: Server = app.get("io");
    io.emit("tradeEscalated", { tradeId: trade.id });

    // Mark this trade as recently modified to prevent reassignment
    markTradeAsModified(trade.tradeHash);
    // console.log(`✅ MARKED AS MODIFIED: ${trade.tradeHash}`);

    // Notify CC
    const ccAgent = await dbConnect.getRepository(User).findOne({ where: { userType: UserType.CC } });
    if (ccAgent) {
      await createNotification({
        userId: ccAgent.id,
        title: 'Trade Escalated',
        description: `Trade ${tradeId} has been escalated.`,
        type: NotificationType.SYSTEM,
        priority: PriorityLevel.HIGH,
        relatedAccountId: null
      });
    }

    return res.status(200).json({ success: true, message: 'Trade escalated successfully' });
  } catch (err) {
    return next(err);
  }
};

export const getEscalatedTrades = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tradeRepo = dbConnect.getRepository(Trade);

    const escalatedTrades = await tradeRepo.find({
      where: { status: TradeStatus.ESCALATED },
      relations: ['assignedPayer', 'escalatedBy'],
      order: { updatedAt: 'DESC' }
    });

    return res.status(200).json({
      success: true,
      data: escalatedTrades
    });
  } catch (error) {
    return next(error);
  }
};

export const getEscalatedTradeById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(new ErrorHandler("Escalated trade ID is required", 400));
    }

    const tradeRepo = dbConnect.getRepository(Trade);

    // Find the trade with all necessary relations
    const trade = await tradeRepo.findOne({
      where: { id, isEscalated: true },
      relations: [
        'escalatedBy',
        'assignedCcAgent',
        'assignedPayer',
        'parentTrade',
        'childTrades'
      ]
    });

    if (!trade) {
      return next(new ErrorHandler("Escalated trade not found", 404));
    }

    // Initialize platform services
    const services = await initializePlatformServices();
    let externalTrade: any = null;
    let tradeChat: any = null;

    try {
      // Only attempt to fetch external data if we have required fields
      if (trade.platform && trade.tradeHash && trade.accountId) {
        // Fetch platform-specific trade details
        switch (trade.platform.toLowerCase()) {
          case "noones": {
            const service = services.noones.find(s => s.accountId === trade.accountId);
            if (service) {
              externalTrade = await service.getTradeDetails(trade.tradeHash);
              tradeChat = await service.getTradeChat(trade.tradeHash);
            }
            break;
          }
          case "paxful": {
            const service = services.paxful.find(s => s.accountId === trade.accountId);
            if (service) {
              const response = await service.getTradeDetails(trade.tradeHash);
              externalTrade = response?.data?.trade;
              tradeChat = await service.getTradeChat(trade.tradeHash);
            }
            break;
          }
        }
      }
    } catch (externalError) {
      console.error('Error fetching external trade data:', externalError);
      // Continue without external data rather than failing
    }

    // Format the response
    const responseData = {
      trade: {
        ...trade,
        escalatedBy: trade.escalatedBy ? {
          id: trade.escalatedBy.id,
          fullName: trade.escalatedBy.fullName,
          avatar: trade.escalatedBy.avatar
        } : null,
        assignedCcAgent: trade.assignedCcAgent ? {
          id: trade.assignedCcAgent.id,
          fullName: trade.assignedCcAgent.fullName,
          avatar: trade.assignedCcAgent.avatar
        } : null,
        assignedPayer: trade.assignedPayer ? {
          id: trade.assignedPayer.id,
          fullName: trade.assignedPayer.fullName,
          avatar: trade.assignedPayer.avatar
        } : null
      },
      externalTrade: externalTrade ? {
        btcRate: externalTrade.fiat_price_per_btc,
        dollarRate: externalTrade.fiat_price_per_btc / externalTrade?.crypto_current_rate_usd,
        amount: externalTrade.fiat_amount_requested,
        bankName: externalTrade.bank_accounts?.to?.bank_name,
        accountNumber: externalTrade.bank_accounts?.to?.account_number,
        accountHolder: externalTrade.bank_accounts?.to?.holder_name,
        buyer_name: externalTrade.buyer_name
      } : null,
      tradeChat: tradeChat ? {
        messages: tradeChat.messages?.map((msg: any) => ({
          id: msg.id || Math.random().toString(36).substr(2, 9),
          content: msg.text || "",
          sender: {
            id: msg.author?.externalId || "system",
            fullName: msg.author?.userName || "System"
          },
          createdAt: msg.timestamp && !isNaN(msg.timestamp)
            ? new Date(parseInt(msg.timestamp) * 1000).toISOString()
            : new Date().toISOString()
        })) || [],
        attachments: tradeChat.attachments || []
      } : null
    };

    return res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    return next(error);
  }
};

export const cancelTrade = async (req: Request, res: Response, next: NextFunction) => {
  const queryRunner = dbConnect.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { tradeId } = req.params;
    if (!tradeId) throw new ErrorHandler("Trade ID is required", 400);

    const tradeRepo = queryRunner.manager.getRepository(Trade);
    const trade = await tradeRepo.findOne({
      where: { id: tradeId },
      lock: { mode: "pessimistic_write" },
    });

    if (!trade) throw new ErrorHandler("Trade not found", 404);
    if (trade.status === TradeStatus.COMPLETED) {
      throw new ErrorHandler("Completed trades cannot be cancelled", 400);
    }
    if (trade.status === TradeStatus.CANCELLED) {
      throw new ErrorHandler("Trade is already cancelled", 400);
    }

    // Find the account associated with this trade
    const accountRepo = queryRunner.manager.getRepository(Account);
    const account = await accountRepo.findOne({
      where: { id: trade.accountId }
    });

    if (!account) {
      throw new ErrorHandler("Account associated with this trade not found", 404);
    }

    // Call the appropriate service based on the platform
    let cancellationResult = false;

    if (trade.platform === "noones") {
      // Type assertion to ensure TypeScript knows these are strings
      const apiKey = account.api_key as string;
      const apiSecret = account.api_secret as string;

      if (!apiKey || !apiSecret) {
        throw new ErrorHandler("API credentials not found for this account", 500);
      }

      const noonesService = new NoonesService({
        apiKey,
        apiSecret,
        accountId: account.id,
        label: account.account_username,
      });

      cancellationResult = await noonesService.cancelTrade(trade.tradeHash);
    } else if (trade.platform === "paxful") {
      // Type assertion to ensure TypeScript knows these are strings
      const clientId = account.api_key as string;
      const clientSecret = account.api_secret as string;

      if (!clientId || !clientSecret) {
        throw new ErrorHandler("API credentials not found for this account", 500);
      }

      const paxfulService = new PaxfulService({
        clientId,
        clientSecret,
        accountId: account.id,
        label: account.account_username,
      });

      cancellationResult = await paxfulService.cancelTrade(trade.tradeHash);
    } else {
      throw new ErrorHandler(`Unsupported platform: ${trade.platform}`, 400);
    }

    if (!cancellationResult) {
      throw new ErrorHandler("Failed to cancel trade on platform", 500);
    }

    // Update trade status in our database
    // trade.status = TradeStatus.CANCELLED;
    // trade.isEscalated = false
    // await tradeRepo.save(trade);

    await tradeRepo.delete(trade.id);

    await queryRunner.commitTransaction();
    const io: Server = req.app.get("io");

    io.emit("tradeDeleted", { tradeId: trade.id });

    return res.status(200).json({
      success: true,
      message: "Trade cancelled successfully",
      data: trade,
    });
  } catch (err) {
    await queryRunner.rollbackTransaction();
    return next(err);
  } finally {
    await queryRunner.release();
  }
};

export const getCCstats = async (_req: Request, res: Response) => {
  const tradeRepo = dbConnect.getRepository(Trade);
  const shiftRepo = dbConnect.getRepository(Shift);

  // 1) Total trades
  const totalTrades = await tradeRepo.count();

  // 2) New trades today
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const newTradesToday = await tradeRepo.count({
    where: { createdAt: MoreThanOrEqual(startOfToday) }
  });

  // 3) Avg response time (completedAt - createdAt) in hours
  const completedTrades = await tradeRepo.find({
    where: { status: TradeStatus.COMPLETED }
  });
  const totalHours = completedTrades.reduce((sum, t) => {
    if (t.completedAt) {
      return sum + ((t.completedAt.getTime() - t.createdAt.getTime()) / 36e5);
    }
    return sum;
  }, 0);
  const avgResponseTimeHours = completedTrades.length
    ? totalHours / completedTrades.length
    : 0;

  // 4) Escalation rate
  const escalatedCount = await tradeRepo.count({
    where: { isEscalated: true }
  });
  const escalationRatePercent = totalTrades
    ? (escalatedCount / totalTrades) * 100
    : 0;

  // 5) Resolution rate (completed / total)
  const resolutionRatePercent = totalTrades
    ? (completedTrades.length / totalTrades) * 100
    : 0;

  // 6) Active vendors: count shifts where clocked in
  const activeVendors = await shiftRepo.count({
    where: { isClockedIn: true }
  });

  return res.json({
    totalTrades,
    newTradesToday,
    avgResponseTimeHours,
    escalationRatePercent,
    resolutionRatePercent,
    activeVendors,
  });
};

export const emitTradeStatusChange = (tradeId: string, status: string, assignedPayerId?: string) => {
  const io: Server = app.get("io");
  
  // Emit to all clients watching this specific trade
  io.to(`trade:${tradeId}`).emit("tradeStatusChanged", {
    tradeId,
    status,
  });
  
  // Also emit to the assigned payer's room if available
  if (assignedPayerId) {
    io.to(assignedPayerId).emit("tradeStatusChanged", {
      tradeId,
      status,
    });
  }
  
  console.log(`Emitted tradeStatusChanged for ${tradeId}: ${status}`);
};

/**
 * Get the reset timer status for a payer
 */
export const getResetStatus = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req?.user?.id;
    
    if (!userId) {
      return next(new ErrorHandler("User not authenticated", 401));
    }

    // Get the current reset timer for this user
    const resetTimer = resetTimers[userId];
    const isActive = resetTimer && new Date() < resetTimer.expiresAt;
    
    return res.status(200).json({
      success: true,
      data: {
        isActive: isActive || false,
        expiresAt: isActive ? resetTimer.expiresAt : null,
      },
    });
  } catch (error: any) {
    console.error("Error in getResetStatus:", error);
    return next(new ErrorHandler(`Error getting reset status: ${error.message}`, 500));
  }
};

/**
 * Set a reset timer for a payer when they clock out
 */
export const setResetTimer = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req?.user?.id;
    
    if (!userId) {
      return next(new ErrorHandler("User not authenticated", 401));
    }

    // Set expiration time to 2 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);
    
    resetTimers[userId] = { expiresAt };
    
    return res.status(200).json({
      success: true,
      data: {
        isActive: true,
        expiresAt,
      },
    });
  } catch (error: any) {
    console.error("Error in setResetTimer:", error);
    return next(new ErrorHandler(`Error setting reset timer: ${error.message}`, 500));
  }
};

/**
 * Manually trigger a reset for a payer
 */
export const triggerManualReset = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req?.user?.id;
    
    if (!userId) {
      return next(new ErrorHandler("User not authenticated", 401));
    }

    // Clear the reset timer for this user
    delete resetTimers[userId];
    
    return res.status(200).json({
      success: true,
      data: {
        isActive: false,
        expiresAt: null,
      },
    });
  } catch (error: any) {
    console.error("Error in triggerManualReset:", error);
    return next(new ErrorHandler(`Error triggering manual reset: ${error.message}`, 500));
  }
};

function next(arg0: string, error: unknown) {
  throw new Error("Function not implemented.");
}
