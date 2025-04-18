"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.getCCstats = exports.cancelTrade = exports.getEscalatedTradeById = exports.getEscalatedTrades = exports.escalateTrade = exports.getVendorCoin = exports.getActiveFundedTotal = exports.getRates = exports.setOrUpdateRates = exports.getCapRate = exports.updateCapRate = exports.getUnfinishedTrades = exports.getAllTrades = exports.reassignTrade = exports.getCompletedPayerTrades = exports.getCompletedPaidTrades = exports.getPayerTrade = exports.markTradeAsPaid = exports.getWalletBalances = exports.sendTradeChatMessage = exports.getTradeDetails = exports.assignLiveTrades = exports.getLiveTrades = exports.assignLiveTradesInternal = exports.getCurrencyRates = exports.updateAccountRates = exports.getOffersMargin = exports.turnOffAllOffers = exports.updateOffers = exports.getPlatformRates = exports.fetchPlatformRates = exports.activateDeactivatedOffers = exports.activateOfferController = exports.getOfferDetailsController = exports.turnOnAllOffers = exports.getFeedbackStats = exports.getDashboardStats = exports.getAccounts = void 0;
const database_1 = __importDefault(require("../config/database"));
const trades_1 = require("../models/trades");
const rates_1 = require("../models/rates");
const accounts_1 = require("../models/accounts");
const noones_1 = require("../config/noones");
const paxful_1 = __importStar(require("../config/paxful"));
const binance_1 = require("../config/binance");
const errorHandler_1 = __importDefault(require("../utils/errorHandler"));
const user_1 = require("../models/user");
const typeorm_1 = require("typeorm");
const notificationController_1 = require("./notificationController");
const notifications_1 = require("../models/notifications");
const shift_1 = require("../models/shift");
const DECIMALS = {
    BTC: 8,
    USDT: 6,
};
// This map tracks recently modified trades to prevent immediate reassignment
const recentlyModifiedTrades = new Map();
/**
 * Initialize platform services with accounts from your database.
 */
function initializePlatformServices() {
    return __awaiter(this, void 0, void 0, function* () {
        const accountRepo = database_1.default.getRepository(accounts_1.Account);
        const accounts = yield accountRepo.find();
        const services = {
            noones: [],
            paxful: [],
            binance: [],
        };
        for (const account of accounts) {
            const decryptedKey = account.api_key;
            const decryptedSecret = account.api_secret;
            switch (account.platform) {
                case "noones":
                    services.noones.push(new noones_1.NoonesService({
                        apiKey: decryptedKey,
                        apiSecret: decryptedSecret,
                        accountId: account.id,
                        label: account.account_username,
                    }));
                    break;
                case "paxful":
                    services.paxful.push(new paxful_1.PaxfulService({
                        clientId: decryptedKey,
                        clientSecret: decryptedSecret,
                        accountId: account.id,
                        label: account.account_username,
                    }));
                    break;
                case "binance":
                    services.binance.push(new binance_1.BinanceService({
                        apiKey: decryptedKey,
                        apiSecret: decryptedSecret,
                        accountId: account.id,
                        label: account.account_username,
                    }));
                    break;
            }
        }
        return services;
    });
}
const getAccounts = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const accountRepo = database_1.default.getRepository(accounts_1.Account);
        // Only select the fields you need (e.g., id, account_username, and platform)
        const accounts = yield accountRepo.find({
            select: ["id", "account_username", "platform"],
        });
        return res.status(200).json({
            success: true,
            message: "Accounts fetched successfully",
            data: accounts,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAccounts = getAccounts;
/**
 * Get dashboard stats.
 */
const getDashboardStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tradeRepository = database_1.default.getRepository(trades_1.Trade);
        const currentlyAssigned = yield tradeRepository.count({
            where: { status: trades_1.TradeStatus.ASSIGNED },
        });
        const notYetAssigned = yield tradeRepository.count({
            where: { status: trades_1.TradeStatus.ACTIVE_FUNDED },
        });
        const escalated = yield tradeRepository.count({
            where: { status: trades_1.TradeStatus.ESCALATED },
        });
        const paidButNotMarked = yield tradeRepository.count({
            where: { status: trades_1.TradeStatus.COMPLETED, completedAt: undefined },
        });
        const totalTradesNGN = yield tradeRepository
            .createQueryBuilder("trade")
            .select("SUM(trade.amount)", "totalNGN")
            .where("trade.status = :status", { status: trades_1.TradeStatus.COMPLETED })
            .getRawOne();
        const totalTradesBTC = yield tradeRepository
            .createQueryBuilder("trade")
            .select("SUM(trade.cryptoAmountTotal)", "totalBTC")
            .where("trade.status = :status", { status: trades_1.TradeStatus.COMPLETED })
            .getRawOne();
        const averageResponseTime = yield tradeRepository
            .createQueryBuilder("trade")
            .select("AVG(EXTRACT(EPOCH FROM (trade.completedAt - trade.assignedAt)))", "averageResponseTime")
            .where("trade.status = :status", { status: trades_1.TradeStatus.COMPLETED })
            .andWhere("trade.completedAt IS NOT NULL")
            .andWhere("trade.assignedAt IS NOT NULL")
            .getRawOne();
        // Only count trades that are externally "active funded" but have not been processed internally.
        // That is, exclude trades with status ASSIGNED or PENDING.
        const activeFunded = yield tradeRepository
            .createQueryBuilder("trade")
            .where("LOWER(trade.tradeStatus) = :externalStatus", { externalStatus: "active funded" })
            .andWhere("trade.status NOT IN (:...excluded)", { excluded: [trades_1.TradeStatus.ASSIGNED, trades_1.TradeStatus.ACTIVE_FUNDED, trades_1.TradeStatus.CANCELLED] })
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
    }
    catch (error) {
        return next(error);
    }
});
exports.getDashboardStats = getDashboardStats;
const getFeedbackStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("Starting getFeedbackStats controller...");
        // Fetch all accounts
        const accountRepo = database_1.default.getRepository(accounts_1.Account);
        const accounts = yield accountRepo.find();
        console.log(`Found ${accounts.length} total accounts`);
        // Filter to only include Paxful and Noones accounts
        const filteredAccounts = accounts.filter(account => account.platform.toLowerCase() === "paxful" ||
            account.platform.toLowerCase() === "noones");
        console.log(`Filtered to ${filteredAccounts.length} Paxful/Noones accounts`);
        console.log("Processing accounts:", filteredAccounts.map(a => `${a.id}: ${a.platform} (${a.account_username})`));
        // Process each account concurrently
        const statsArray = yield Promise.all(filteredAccounts.map((account) => __awaiter(void 0, void 0, void 0, function* () {
            console.log(`Processing account: ${account.id} - ${account.platform} (${account.account_username})`);
            const lowerPlatform = account.platform.toLowerCase();
            let service = null;
            let serviceInitialized = false;
            try {
                // Create the appropriate service instance
                if (lowerPlatform === "noones") {
                    console.log(`Creating NoonesService for ${account.account_username}`);
                    service = new noones_1.NoonesService({
                        apiKey: account.api_key,
                        apiSecret: account.api_secret,
                        accountId: account.id,
                        label: account.account_username,
                    });
                }
                else if (lowerPlatform === "paxful") {
                    console.log(`Creating PaxfulService for ${account.account_username}`);
                    service = new paxful_1.PaxfulService({
                        clientId: account.api_key,
                        clientSecret: account.api_secret,
                        accountId: account.id,
                        label: account.account_username,
                    });
                }
                else {
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
                    yield service.initialize();
                    serviceInitialized = true;
                    console.log(`Service for ${account.account_username} initialized successfully`);
                }
                else if (service) {
                    serviceInitialized = true; // Paxful doesn't need initialization
                    console.log(`Service for ${account.account_username} doesn't require initialization`);
                }
            }
            catch (error) {
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
                positiveFeedbackCount = yield service.getFeedbackStats({
                    username: account.account_username,
                    role: "buyer", // or dynamically determine based on your needs
                    rating: 1,
                });
                console.log(`Received positive feedback count for ${account.account_username}: ${positiveFeedbackCount}`);
            }
            catch (error) {
                console.error(`Error fetching positive feedback for ${account.account_username}:`, error);
                positiveError = error && typeof error === 'object' && 'message' in error
                    ? error.message
                    : "Unknown error";
            }
            console.log(`Fetching negative feedback for ${account.account_username}`);
            try {
                negativeFeedbackCount = yield service.getFeedbackStats({
                    username: account.account_username,
                    role: "buyer", // or dynamically determine
                    rating: 0, // this will be converted to -1 inside the service methods
                });
                console.log(`Received negative feedback count for ${account.account_username}: ${negativeFeedbackCount}`);
            }
            catch (error) {
                console.error(`Error fetching negative feedback for ${account.account_username}:`, error);
                negativeError = error && typeof error === 'object' && 'message' in error
                    ? error.message
                    : "Unknown error";
            }
            // Calculate percentages
            const totalFeedback = positiveFeedbackCount + negativeFeedbackCount;
            const positivePercentage = totalFeedback > 0 ? Math.round((positiveFeedbackCount / totalFeedback) * 100) : 0;
            const negativePercentage = totalFeedback > 0 ? Math.round((negativeFeedbackCount / totalFeedback) * 100) : 0;
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
        })));
        console.log(`Completed processing ${statsArray.length} accounts`);
        // Return all account stats, even those with errors
        return res.status(200).json({
            success: true,
            data: statsArray,
        });
    }
    catch (error) {
        console.error("Error in getFeedbackStats controller:", error);
        return next(error);
    }
});
exports.getFeedbackStats = getFeedbackStats;
/**
 * Fetch all active offers from a list of services.
 */
function fetchAllOffers(services) {
    return __awaiter(this, void 0, void 0, function* () {
        const serviceArray = Array.isArray(services) ? services : [services];
        const allOffers = [];
        for (const service of serviceArray) {
            try {
                let offers = [];
                if (service instanceof noones_1.NoonesService) {
                    const rawOffers = yield service.listActiveOffers();
                    // console.log('Raw Noones offers:', rawOffers); // Debug logging
                    offers = rawOffers.map((offer) => (Object.assign(Object.assign({}, offer), { margin: offer.margin || offer.profit_margin, platform: "noones", account_username: service.accountId, crypto_currency_code: offer.crypto_currency_code || offer.coin_code, offer_hash: offer.offer_hash || offer.id })));
                }
                else if (service instanceof paxful_1.PaxfulService) {
                    offers = yield service.listOffers({ status: "active" });
                    offers = offers.map((offer) => (Object.assign(Object.assign({}, offer), { margin: offer.margin, platform: "paxful", account_username: service.accountId, crypto_currency_code: offer.crypto_currency_code, offer_hash: offer.offer_hash })));
                }
                console.log(`Processed ${offers.length} offers for ${service.label}`); // Debug logging
                allOffers.push(...offers);
            }
            catch (error) {
                console.error(`Error fetching offers for service ${service.label}:`, error);
            }
        }
        return allOffers;
    });
}
const turnOnAllOffers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const services = yield initializePlatformServices();
        const allServices = [...services.noones, ...services.paxful];
        const platformResults = [];
        for (const svc of allServices) {
            try {
                yield svc.turnOnAllOffers();
                platformResults.push({
                    platform: svc.label,
                    success: true,
                });
            }
            catch (err) {
                console.error(`Error turning on offers for ${svc.label}:`, err);
                platformResults.push({
                    platform: svc.label,
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
    }
    catch (error) {
        console.error("Critical error in turnOnAllOffersController:", error);
        return next(error);
    }
});
exports.turnOnAllOffers = turnOnAllOffers;
const getOfferDetailsController = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { offer_hash } = req.body;
        if (!offer_hash) {
            return res
                .status(400)
                .json({ success: false, message: "Missing offer_hash in request body" });
        }
        const services = yield initializePlatformServices();
        // assume your initializer returns { noones: [...], paxful: [ PaxfulService ] }
        const paxfulService = services.paxful[0];
        if (!paxfulService) {
            return res
                .status(500)
                .json({ success: false, message: "Paxful service not available" });
        }
        console.log(`[Controller] → Fetching offer details for ${offer_hash}`);
        const offer = yield paxfulService.getOfferDetails(offer_hash);
        if (!offer) {
            return res
                .status(404)
                .json({ success: false, message: "Offer not found" });
        }
        return res.status(200).json({
            success: true,
            data: offer,
        });
    }
    catch (err) {
        console.error("[Controller] → Error in getOfferDetailsController:", err);
        return next(err);
    }
});
exports.getOfferDetailsController = getOfferDetailsController;
const activateOfferController = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
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
        const services = yield initializePlatformServices();
        let result;
        if (platform.toLowerCase() === "paxful") {
            const paxfulService = services.paxful[0];
            if (!paxfulService) {
                return res
                    .status(500)
                    .json({ success: false, message: "Paxful service not available" });
            }
            console.log(`[activateOfferController] → Activating Paxful offer ${offer_hash}`);
            result = yield paxfulService.activateOffer(offer_hash);
        }
        else if (platform.toLowerCase() === "noones") {
            const noonesService = services.noones[0];
            if (!noonesService) {
                return res
                    .status(500)
                    .json({ success: false, message: "Noones service not available" });
            }
            console.log(`[activateOfferController] → Activating Noones offer ${offer_hash}`);
            result = yield noonesService.activateOffer(offer_hash);
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
    }
    catch (err) {
        console.error("[activateOfferController] → Error activating offer:", err);
        return next(err);
    }
});
exports.activateOfferController = activateOfferController;
const activateDeactivatedOffers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const services = yield initializePlatformServices();
        const allServices = [...services.noones, ...services.paxful];
        const platformResults = [];
        for (const service of allServices) {
            try {
                console.log(`[${service.label}] → Fetching deactivated offers...`);
                const deactivatedOffers = yield service.getDeactivatedOffers();
                console.log(`[${service.label}] → Found ${deactivatedOffers.length} deactivated offers`);
                let activatedCount = 0;
                for (const offer of deactivatedOffers) {
                    const hash = offer.hash;
                    if (!hash)
                        continue;
                    try {
                        console.log(`  ↳ Reactivating offer ${hash}...`);
                        yield service.activateOffer(hash);
                        console.log(`  ✓ Reactivated ${hash}`);
                        activatedCount++;
                    }
                    catch (err) {
                        console.error(`  ✗ Failed to reactivate ${hash}:`, err);
                    }
                }
                platformResults.push({
                    platform: service.label,
                    success: true,
                    offersActivated: activatedCount
                });
            }
            catch (err) {
                console.error(`Error processing deactivated offers for ${service.label}:`, err);
                platformResults.push({
                    platform: service.label,
                    success: false,
                    offersActivated: 0,
                    error: err instanceof Error ? err.message : String(err)
                });
            }
        }
        const overallSuccess = platformResults.every(r => r.success);
        return res.status(200).json({
            success: overallSuccess,
            message: "Processed deactivated offers across all platforms",
            platformResults
        });
    }
    catch (error) {
        console.error("Critical error in activateDeactivatedOffersController:", error);
        return next(error);
    }
});
exports.activateDeactivatedOffers = activateDeactivatedOffers;
const fetchPlatformRates = () => __awaiter(void 0, void 0, void 0, function* () {
    const accountRepository = database_1.default.getRepository(accounts_1.Account);
    // Find one active account for each platform.
    const [paxfulAccount, noonesAccount] = yield Promise.all([
        accountRepository.findOne({
            where: {
                platform: accounts_1.ForexPlatform.PAXFUL,
                status: 'active',
            },
        }),
        accountRepository.findOne({
            where: {
                platform: accounts_1.ForexPlatform.NOONES,
                status: 'active',
            },
        }),
    ]);
    if (!paxfulAccount && !noonesAccount) {
        throw new errorHandler_1.default("No active Paxful or Noones accounts found", 404);
    }
    const rates = {};
    // Fetch Paxful rates if the account exists.
    if (paxfulAccount) {
        try {
            const paxfulService = new paxful_1.PaxfulService({
                clientId: paxfulAccount.api_key,
                clientSecret: paxfulAccount.api_secret,
                label: paxfulAccount.account_username,
            });
            const [btcNgnRate, usdtNgnRate] = yield Promise.all([
                paxfulService.getBitcoinPriceInNgn(),
                paxfulService.getUsdtPriceInNgn(),
            ]);
            rates.paxful = {
                btcNgnRate,
                usdtNgnRate,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            console.error("Error fetching Paxful rates:", error);
            // Optionally, you might continue without Paxful rates.
        }
    }
    // Fetch Noones rates if the account exists.
    if (noonesAccount) {
        try {
            const noonesService = new noones_1.NoonesService({
                apiKey: noonesAccount.api_key,
                apiSecret: noonesAccount.api_secret,
                label: noonesAccount.account_username,
            });
            const [btcPriceUsd, ngnUsdRate] = yield Promise.all([
                noonesService.getBitcoinPrice(),
                noonesService.getNgnRate(),
            ]);
            rates.noones = {
                btcNgnRate: btcPriceUsd * ngnUsdRate,
                usdtNgnRate: ngnUsdRate, // Since 1 USDT = 1 USD.
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            console.error("Error fetching Noones rates:", error);
            // Optionally, continue without Noones rates.
        }
    }
    if (!rates.paxful && !rates.noones) {
        throw new errorHandler_1.default("Failed to fetch rates from both Paxful and Noones", 500);
    }
    return rates;
});
exports.fetchPlatformRates = fetchPlatformRates;
const getPlatformRates = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rates = yield (0, exports.fetchPlatformRates)();
        return res.status(200).json({
            success: true,
            data: rates,
        });
    }
    catch (error) {
        console.error("Error in getPlatformRates:", error);
        return next(new errorHandler_1.default("Internal server error while processing rates request", 500));
    }
});
exports.getPlatformRates = getPlatformRates;
const updateOffers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Extract values from the request body
        const { account_username, platform, costprice, usdtrate, } = req.body;
        // console.log(`Updating offers for ${platform} account: ${account_username}`);
        // console.log(`Parameters: costprice=${costprice}, usdtrate=${usdtrate}`);
        // Retrieve the account record
        const accountRepository = database_1.default.getRepository(accounts_1.Account);
        const account = yield accountRepository.findOne({ where: { account_username } });
        if (!account) {
            return res.status(404).json({
                success: false,
                message: "Account not found",
            });
        }
        // Create the service instance based on the platform
        let service;
        const platformKey = platform.toLowerCase();
        if (platformKey === "paxful") {
            service = new paxful_1.PaxfulService({
                clientId: account.api_key,
                clientSecret: account.api_secret,
                label: account.account_username,
            });
        }
        else if (platformKey === "noones") {
            service = new noones_1.NoonesService({
                apiKey: account.api_key,
                apiSecret: account.api_secret,
                label: account.account_username,
            });
        }
        else {
            return res.status(400).json({
                success: false,
                message: "Unsupported platform",
            });
        }
        // Get current rates
        const rates = yield (0, exports.fetchPlatformRates)();
        console.log("Platform rates for NGN: ", rates);
        if (!rates[platformKey]) {
            return res.status(400).json({
                success: false,
                message: `Rates not available for the ${platform} platform`,
            });
        }
        const currentRate = rates[platformKey];
        // Calculate margins
        const btcMargin = (((costprice / currentRate.btcNgnRate) - 1) * 100);
        console.log("BTC Margin: ", btcMargin);
        const usdtMargin = (((usdtrate / currentRate.usdtNgnRate) - 1) * 100);
        console.log(`Calculated margins - BTC: ${btcMargin}, USDT: ${usdtMargin}`);
        // Fetch active offers for this account
        let offers = [];
        try {
            if (platformKey === "paxful") {
                offers = yield service.listOffers({ status: "active" });
            }
            else if (platformKey === "noones") {
                offers = yield service.listActiveOffers();
                // Ensure offers is always an array
                if (!Array.isArray(offers)) {
                    console.log("Noones offers not returned as an array, converting:", offers);
                    offers = offers ? [offers] : [];
                }
            }
            // console.log(`Found ${offers.length} active offers for ${platform}`);
        }
        catch (error) {
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
        // Update each offer
        const updateResults = [];
        for (const offer of offers) {
            const offerId = offer.offer_hash || offer.id || offer.hash;
            if (!offerId) {
                console.warn(`No offer ID found for offer:`, offer);
                continue;
            }
            // Determine which margin to use based on offer currency
            const offerCurrency = offer.currency || offer.coin_code || "BTC";
            const marginToApply = offerCurrency.toUpperCase() === "USDT" ? usdtMargin : btcMargin;
            console.log(`Updating ${platform} offer ${offerId} (${offerCurrency}) with margin ${marginToApply}`);
            try {
                const updateResult = yield service.updateOffer(offerId, marginToApply);
                // Handle different response formats
                let isSuccess = false;
                if (typeof updateResult === "boolean") {
                    isSuccess = updateResult;
                }
                else if ((updateResult === null || updateResult === void 0 ? void 0 : updateResult.status) === 'success') {
                    isSuccess = true;
                    if (((_a = updateResult === null || updateResult === void 0 ? void 0 : updateResult.data) === null || _a === void 0 ? void 0 : _a.success) !== undefined) {
                        isSuccess = updateResult.data.success === true;
                    }
                }
                else if ((updateResult === null || updateResult === void 0 ? void 0 : updateResult.success) !== undefined) {
                    isSuccess = updateResult.success === true;
                }
                updateResults.push({
                    offerId,
                    currency: offerCurrency,
                    margin: marginToApply,
                    success: isSuccess,
                    data: updateResult,
                });
                console.log(`Update result for ${offerId}: ${isSuccess ? "SUCCESS" : "FAILED"}`);
            }
            catch (error) {
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
    }
    catch (error) {
        console.error("Error in updateOffers:", error);
        return next(error);
    }
});
exports.updateOffers = updateOffers;
const turnOffAllOffers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const services = yield initializePlatformServices();
        for (const service of [...services.paxful, ...services.noones]) {
            yield service.turnOffAllOffers();
        }
        return res.status(200).json({
            success: true,
            message: `Turned off offers on all platforms`,
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.turnOffAllOffers = turnOffAllOffers;
const getOffersMargin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const services = yield initializePlatformServices();
        // Fetch offers from both platforms.
        const noonesOffers = yield fetchAllOffers(services.noones);
        const paxfulOffers = yield fetchAllOffers(services.paxful);
        const allOffers = [...noonesOffers, ...paxfulOffers];
        // Filter to include only offers with an offer_hash for USDT or BTC.
        const filteredOffers = allOffers.filter((offer) => offer.offer_hash &&
            (offer.crypto_currency_code === "USDT" ||
                offer.crypto_currency_code === "BTC"));
        // Group offers by account_username.
        const grouped = {};
        filteredOffers.forEach((offer) => {
            const account = offer.account_username;
            if (!account)
                return;
            if (!grouped[account]) {
                grouped[account] = { platform: offer.platform };
            }
            if (offer.crypto_currency_code === "BTC") {
                grouped[account].marginBTC = offer.margin;
            }
            else if (offer.crypto_currency_code === "USDT") {
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
    }
    catch (error) {
        return next(error);
    }
});
exports.getOffersMargin = getOffersMargin;
const updateAccountRates = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { platformRates } = req.body;
        // Validate required field.
        if (!platformRates || typeof platformRates !== "object") {
            return next(new errorHandler_1.default("Missing required field: platformRates is required", 400));
        }
        const ratesRepository = database_1.default.getRepository(rates_1.Rates);
        const ratesAll = yield ratesRepository.find();
        if (ratesAll.length === 0) {
            return next(new errorHandler_1.default("No rates record found", 404));
        }
        const rates = ratesAll[0];
        // Update the platformRates field.
        rates.platformRates = platformRates;
        yield ratesRepository.save(rates);
        return res.status(200).json({
            success: true,
            message: "Account rates updated successfully",
            data: rates.platformRates,
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.updateAccountRates = updateAccountRates;
/**
 * GET Currency Rates
 */
const getCurrencyRates = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const services = yield initializePlatformServices();
        const rates = {};
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
            paxful_1.default.getBitcoinPrice().then(rate => {
                rates.paxfulRate = rate;
                console.log("Paxful rate: ", rate);
            }).catch(error => console.error("Error fetching Paxful rate:", error))
        ];
        // Wait for all promises to settle
        yield Promise.allSettled(ratePromises);
        if (Object.keys(rates).length === 0) {
            return next(new errorHandler_1.default("Failed to fetch rates from any platform", 500));
        }
        return res.status(200).json({ data: Object.assign({}, rates), success: true });
    }
    catch (error) {
        console.log(error.message);
        return next(error);
    }
});
exports.getCurrencyRates = getCurrencyRates;
// Helper function to mark a trade as recently modified
const markTradeAsModified = (tradeId) => {
    recentlyModifiedTrades.set(tradeId, Date.now());
};
// Clean up old entries from the map periodically
setInterval(() => {
    const now = Date.now();
    recentlyModifiedTrades.forEach((time, hash) => {
        if (now - time > 40000) {
            recentlyModifiedTrades.delete(hash);
        }
    });
}, 30000);
// Helper function to check database connection
const checkDbConnection = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield database_1.default.query("SELECT 1");
        return true;
    }
    catch (err) {
        console.log("Database connection check failed:", err);
        return false;
    }
});
const processingLock = new Map();
const upsertLiveTrades = (liveTrades) => __awaiter(void 0, void 0, void 0, function* () {
    const tradeRepo = database_1.default.getRepository(trades_1.Trade);
    for (const t of liveTrades) {
        const mapped = {
            tradeHash: t.trade_hash,
            accountId: t.accountId,
            platform: t.platform,
            tradeStatus: t.trade_status,
            amount: t.fiat_amount_requested,
            cryptoAmountRequested: t.crypto_amount_requested,
            cryptoAmountTotal: t.crypto_amount_total,
            feeCryptoAmount: t.fee_crypto_amount,
            feePercentage: t.fee_percentage,
            sourceId: t.source_id,
            responderUsername: t.responder_username,
            ownerUsername: t.owner_username,
            paymentMethod: t.payment_method_name || null,
            locationIso: t.location_iso,
            fiatCurrency: t.fiat_currency_code,
            cryptoCurrencyCode: t.crypto_currency_code,
            isActiveOffer: t.is_active_offer,
            offerHash: t.offer_hash,
            margin: t.margin,
            btcRate: t.fiat_price_per_btc,
            btcNgnRate: t.fiat_price_per_crypto,
            usdtNgnRate: t.crypto_current_rate_usd,
        };
        const existing = yield tradeRepo.findOne({ where: { tradeHash: mapped.tradeHash } });
        if (existing) {
            // Update the tradeStatus to ensure it's current
            if (existing.tradeStatus !== mapped.tradeStatus) {
                // console.log(`Trade ${mapped.tradeHash} status changed from ${existing.tradeStatus} to ${mapped.tradeStatus}`);
                // If the trade was previously assigned but is now cancelled/completed on the platform
                if (existing.status === trades_1.TradeStatus.ASSIGNED &&
                    (mapped.tradeStatus.toLowerCase() === 'cancelled' ||
                        mapped.tradeStatus.toLowerCase() === 'completed')) {
                    mapped.tradeStatus = mapped.tradeStatus.toLowerCase() === 'cancelled'
                        ? trades_1.TradeStatus.CANCELLED
                        : trades_1.TradeStatus.COMPLETED;
                }
            }
            yield tradeRepo.update(existing.id, mapped);
        }
        else {
            yield tradeRepo.save(mapped);
        }
    }
});
const aggregateLiveTrades = () => __awaiter(void 0, void 0, void 0, function* () {
    const services = yield initializePlatformServices();
    let all = [];
    for (const svc of services.paxful) {
        try {
            const pax = yield svc.listActiveTrades();
            all = all.concat(pax.map((t) => (Object.assign(Object.assign({}, t), { platform: 'paxful', accountId: svc.accountId }))));
        }
        catch (err) {
            console.error(`Paxful listActiveTrades error for ${svc.accountId}:`, err);
        }
    }
    for (const svc of services.noones) {
        try {
            const noones = yield svc.listActiveTrades();
            all = all.concat(noones.map((t) => (Object.assign(Object.assign({}, t), { platform: 'noones', accountId: svc.accountId }))));
        }
        catch (err) {
            console.error(`Noones listActiveTrades error for ${svc.accountId}:`, err);
        }
    }
    const filtered = all.filter((t) => t.trade_status.toLowerCase() === 'active funded');
    yield upsertLiveTrades(filtered);
    return filtered;
});
const syncCancelledTrades = () => __awaiter(void 0, void 0, void 0, function* () {
    const services = yield initializePlatformServices();
    const liveHashes = new Set();
    // gather all active‐funded hashes
    for (const list of [services.paxful, services.noones]) {
        for (const svc of list) {
            try {
                const trades = yield svc.listActiveTrades();
                trades.forEach((t) => liveHashes.add(t.trade_hash));
            }
            catch (err) {
                console.error('syncCancelledTrades list error:', err);
            }
        }
    }
    const repo = database_1.default.getRepository(trades_1.Trade);
    const stale = yield repo.find({
        where: [
            { status: trades_1.TradeStatus.ACTIVE_FUNDED },
            { status: trades_1.TradeStatus.ASSIGNED },
            {
                tradeStatus: (0, typeorm_1.Not)(trades_1.TradeStatus.CANCELLED),
                status: (0, typeorm_1.Not)((0, typeorm_1.In)([trades_1.TradeStatus.COMPLETED, trades_1.TradeStatus.ESCALATED])),
                isEscalated: true
            }
        ],
    });
    for (const t of stale) {
        if (!liveHashes.has(t.tradeHash)) {
            t.status = trades_1.TradeStatus.CANCELLED;
            t.notes = 'Auto‐cancelled: no longer active on platform';
            t.assignedPayerId = undefined;
            yield repo.save(t);
            console.log(`Auto‐cancelled trade ${t.tradeHash}`);
        }
    }
});
// In the safeAssignTrade function
function safeAssignTrade(tradeHash, processFn) {
    return __awaiter(this, void 0, void 0, function* () {
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
            yield processFn();
        }
        finally {
            processingLock.delete(tradeHash);
        }
    });
}
const assignLiveTradesInternal = () => __awaiter(void 0, void 0, void 0, function* () {
    const queryRunner = database_1.default.createQueryRunner();
    yield queryRunner.connect();
    yield queryRunner.startTransaction();
    try {
        // 0) Cancel any stale trades no longer active on platform
        yield syncCancelledTrades();
        // 1) Fetch all "active funded" trades from platforms
        const liveTrades = yield aggregateLiveTrades();
        if (liveTrades.length === 0) {
            // console.log('No live trades found.');
            yield queryRunner.commitTransaction();
            return [];
        }
        // 2) Load existing DB entries for these trades
        const hashes = liveTrades.map(t => t.trade_hash);
        const existingTrades = yield queryRunner.manager.find(trades_1.Trade, {
            where: { tradeHash: (0, typeorm_1.In)(hashes) }
        });
        const existingMap = new Map(existingTrades.map(t => [t.tradeHash, t]));
        // 3) Normalize and persist immediate status changes
        for (const td of liveTrades) {
            const lower = td.trade_status.toLowerCase();
            const existing = existingMap.get(td.trade_hash);
            if (existing) {
                // a) If already escalated, enforce and skip
                if (existing.isEscalated) {
                    if (existing.status !== trades_1.TradeStatus.ESCALATED) {
                        existing.status = trades_1.TradeStatus.ESCALATED;
                        yield queryRunner.manager.save(existing);
                        console.log(`Enforced ESCALATED for ${td.trade_hash}`);
                    }
                    continue;
                }
                // b) Map platform statuses
                if (lower === 'active funded') {
                    if (existing.status !== trades_1.TradeStatus.ACTIVE_FUNDED) {
                        existing.status = trades_1.TradeStatus.ACTIVE_FUNDED;
                        existing.tradeStatus = td.trade_status;
                        yield queryRunner.manager.save(existing);
                        console.log(`Set ${td.trade_hash} → ACTIVE_FUNDED`);
                    }
                }
                else if (lower === 'paid' || lower === 'completed') {
                    if (existing.status !== trades_1.TradeStatus.COMPLETED) {
                        existing.status = trades_1.TradeStatus.COMPLETED;
                        existing.tradeStatus = td.trade_status;
                        existing.assignedPayerId = undefined;
                        yield queryRunner.manager.save(existing);
                        // console.log(`Set ${td.trade_hash} → COMPLETED`);
                    }
                }
                else if (lower === 'successful') {
                    if (existing.status !== trades_1.TradeStatus.SUCCESSFUL) {
                        existing.status = trades_1.TradeStatus.SUCCESSFUL;
                        existing.tradeStatus = td.trade_status;
                        existing.assignedPayerId = undefined;
                        yield queryRunner.manager.save(existing);
                        console.log(`Set ${td.trade_hash} → SUCCESSFUL`);
                    }
                }
                else if (['cancelled', 'expired', 'disputed'].includes(lower)) {
                    if (existing.status !== trades_1.TradeStatus.CANCELLED) {
                        existing.status = trades_1.TradeStatus.CANCELLED;
                        existing.tradeStatus = td.trade_status;
                        existing.assignedPayerId = undefined;
                        yield queryRunner.manager.save(existing);
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
            return (lower === 'active funded' &&
                !(existing && existing.isEscalated) &&
                !recentlyModified // Don't reassign recently modified trades
            );
        });
        if (toAssign.length === 0) {
            console.log('No pending trades to assign');
            yield queryRunner.commitTransaction();
            return [];
        }
        // 5) FIFO sort
        toAssign.sort((a, b) => {
            const aT = new Date(a.created_at || 0).getTime();
            const bT = new Date(b.created_at || 0).getTime();
            return aT - bT;
        });
        // 6) Determine free payers
        const available = yield getAvailablePayers();
        const assigned = yield queryRunner.manager.find(trades_1.Trade, {
            where: {
                status: trades_1.TradeStatus.ASSIGNED,
                assignedPayerId: (0, typeorm_1.In)(available.map(p => p.id))
            }
        });
        const busySet = new Set(assigned.map(t => t.assignedPayerId));
        const free = available.filter(p => !busySet.has(p.id));
        // console.log(`Pending: ${toAssign.length}, Available: ${available.length}, Free: ${free.length}`);
        // 7) Assign PENDING trades to free payers
        const out = [];
        const services = yield initializePlatformServices();
        for (const td of toAssign) {
            yield safeAssignTrade(td.trade_hash, () => __awaiter(void 0, void 0, void 0, function* () {
                const t = yield queryRunner.manager.findOne(trades_1.Trade, {
                    where: { tradeHash: td.trade_hash },
                    lock: { mode: 'pessimistic_write' }
                });
                if (!t || t.status !== trades_1.TradeStatus.ACTIVE_FUNDED)
                    return;
                // Double-check it wasn't recently modified
                const lastModified = recentlyModifiedTrades.get(td.trade_hash);
                if (lastModified && (currentTime - lastModified < 10000)) {
                    console.log(`Skipping ${td.trade_hash} - recently modified`);
                    return;
                }
                if (free.length > 0) {
                    const payer = free.shift();
                    t.status = trades_1.TradeStatus.ASSIGNED;
                    t.tradeStatus = td.trade_status;
                    t.assignedPayerId = payer.id;
                    t.assignedAt = new Date();
                    const saved = yield queryRunner.manager.save(t);
                    console.log(`Assigned ${td.trade_hash} → payer ${payer.id}`);
                    // Optionally fetch details/chat here
                    out.push(saved);
                }
                else {
                    console.log(`${td.trade_hash} remains PENDING (no free payers)`);
                }
            }));
        }
        yield queryRunner.commitTransaction();
        return out;
    }
    catch (err) {
        yield queryRunner.rollbackTransaction();
        console.error('Error in assignLiveTradesInternal:', err);
        throw err;
    }
    finally {
        yield queryRunner.release();
    }
});
exports.assignLiveTradesInternal = assignLiveTradesInternal;
const getLiveTrades = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const trades = yield aggregateLiveTrades();
        return res.status(200).json({ success: true, data: trades });
    }
    catch (err) {
        return next(err);
    }
});
exports.getLiveTrades = getLiveTrades;
const assignLiveTrades = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const processedTrades = yield (0, exports.assignLiveTradesInternal)();
        return res.status(200).json({
            success: true,
            message: "Live trades processed with FIFO assignment.",
            data: processedTrades,
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.assignLiveTrades = assignLiveTrades;
let isProcessing = false;
const pollAndAssignLiveTrades = () => __awaiter(void 0, void 0, void 0, function* () {
    if (isProcessing)
        return;
    isProcessing = true;
    try {
        // Check database connection first
        const isConnected = yield checkDbConnection();
        if (!isConnected) {
            console.log("Database not connected, skipping trade assignment cycle");
            return;
        }
        const assigned = yield (0, exports.assignLiveTradesInternal)();
        if (assigned.length)
            console.log(`Assigned ${assigned.length} trades`);
    }
    catch (error) {
        console.error('pollAndAssignLiveTrades error:', error);
        // Type check the error before accessing properties
        if (error instanceof Error) {
            // Now TypeScript knows this is an Error object with a message property
            if (error.message.includes('not Connected')) {
                // console.log('Connection issue detected, attempting recovery...');
                try {
                    // Some databases allow explicit reconnection
                    yield database_1.default.connect();
                    // console.log('Successfully reconnected to database');
                }
                catch (reconnectErr) {
                    console.error('Failed to reconnect:', reconnectErr);
                }
            }
        }
    }
    finally {
        isProcessing = false;
    }
});
setInterval(pollAndAssignLiveTrades, 2000);
// const getAvailablePayers = async (): Promise<User[]> => {
//   const userRepository = dbConnect.getRepository(User);
//   // Instead of joining with the Shift table, we simply filter by clockedIn.
//   const payers = await userRepository.find({
//     where: { userType: UserType.PAYER, clockedIn: true },
//     order: { createdAt: "ASC" },
//   });
//   return payers;
// };
const getAvailablePayers = () => __awaiter(void 0, void 0, void 0, function* () {
    const userRepository = database_1.default.getRepository(user_1.User);
    const shiftRepository = database_1.default.getRepository(shift_1.Shift);
    // First, get all clocked-in payers
    const payers = yield userRepository.find({
        where: { userType: user_1.UserType.PAYER, clockedIn: true },
        order: { createdAt: "ASC" },
    });
    // Then, filter out those who are on break
    const activePayerIds = new Set();
    // Find all active shifts that are not on break
    const activeShifts = yield shiftRepository.find({
        where: {
            status: shift_1.ShiftStatus.ACTIVE, // Only ACTIVE shifts, not ON_BREAK
            user: { userType: user_1.UserType.PAYER }
        },
        relations: ["user"],
    });
    // Collect IDs of users with active shifts
    activeShifts.forEach(shift => {
        activePayerIds.add(shift.user.id);
    });
    // Filter the payers to only include those with active shifts
    return payers.filter(payer => activePayerIds.has(payer.id));
});
const getTradeDetails = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g;
    try {
        const { platform, tradeHash, accountId } = req.params;
        console.log("Received Params:", { platform, tradeHash, accountId });
        if (!platform || !tradeHash || !accountId) {
            return next(new errorHandler_1.default("Platform, trade hash, and account ID are required", 400));
        }
        const services = yield initializePlatformServices();
        let externalTrade;
        let tradeChat;
        switch (platform) {
            case "noones": {
                const service = services.noones.find((s) => s.accountId === accountId);
                if (!service) {
                    return next(new errorHandler_1.default("Account not found", 404));
                }
                externalTrade = yield service.getTradeDetails(tradeHash);
                tradeChat = yield service.getTradeChat(tradeHash);
                break;
            }
            case "paxful": {
                const service = services.paxful.find((s) => s.accountId === accountId);
                if (!service) {
                    return next(new errorHandler_1.default("Account not found", 404));
                }
                const response = yield service.getTradeDetails(tradeHash);
                externalTrade = response.data.trade;
                tradeChat = yield service.getTradeChat(tradeHash);
                break;
            }
            default:
                return next(new errorHandler_1.default("Unsupported platform", 400));
        }
        const tradeRepository = database_1.default.getRepository(trades_1.Trade);
        const tradeRecord = yield tradeRepository.findOne({
            where: { tradeHash },
            relations: ["assignedPayer"],
        });
        if (!tradeRecord) {
            return next(new errorHandler_1.default("No trade record found in the database", 404));
        }
        let tradeDuration = null;
        if (tradeRecord.assignedAt && tradeRecord.completedAt) {
            tradeDuration =
                (tradeRecord.completedAt.getTime() - tradeRecord.assignedAt.getTime()) / 1000;
        }
        const formattedExternalTrade = {
            btcRate: (externalTrade === null || externalTrade === void 0 ? void 0 : externalTrade.fiat_price_per_btc) || null,
            dollarRate: (externalTrade === null || externalTrade === void 0 ? void 0 : externalTrade.fiat_price_per_crypto) || null,
            amount: (externalTrade === null || externalTrade === void 0 ? void 0 : externalTrade.fiat_amount_requested) || null,
            bankName: ((_b = (_a = externalTrade === null || externalTrade === void 0 ? void 0 : externalTrade.bank_accounts) === null || _a === void 0 ? void 0 : _a.to) === null || _b === void 0 ? void 0 : _b.bank_name) || "N/A",
            accountNumber: ((_d = (_c = externalTrade === null || externalTrade === void 0 ? void 0 : externalTrade.bank_accounts) === null || _c === void 0 ? void 0 : _c.to) === null || _d === void 0 ? void 0 : _d.account_number) || "N/A",
            accountHolder: ((_f = (_e = externalTrade === null || externalTrade === void 0 ? void 0 : externalTrade.bank_accounts) === null || _e === void 0 ? void 0 : _e.to) === null || _f === void 0 ? void 0 : _f.holder_name) || "N/A",
            buyer_name: (externalTrade === null || externalTrade === void 0 ? void 0 : externalTrade.buyer_name) || "Anonymous"
        };
        const formattedMessages = ((_g = tradeChat === null || tradeChat === void 0 ? void 0 : tradeChat.messages) === null || _g === void 0 ? void 0 : _g.map((msg) => {
            var _a, _b;
            return ({
                id: msg.id || Math.random().toString(36).substr(2, 9),
                content: msg.text || "",
                sender: {
                    id: ((_a = msg.author) === null || _a === void 0 ? void 0 : _a.externalId) || "system",
                    fullName: ((_b = msg.author) === null || _b === void 0 ? void 0 : _b.userName) || "System"
                },
                createdAt: msg.timestamp && !isNaN(msg.timestamp)
                    ? new Date(parseInt(msg.timestamp) * 1000).toISOString()
                    : new Date().toISOString()
            });
        })) || [];
        return res.status(200).json({
            success: true,
            data: {
                externalTrade: formattedExternalTrade,
                tradeChat: {
                    messages: formattedMessages,
                    attachments: (tradeChat === null || tradeChat === void 0 ? void 0 : tradeChat.attachments) || []
                },
                tradeRecord: tradeRecord,
                tradeDuration: tradeDuration
            }
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.getTradeDetails = getTradeDetails;
const sendTradeChatMessage = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { tradeId } = req.params;
        const { content } = req.body;
        if (!tradeId || !content) {
            return next(new errorHandler_1.default("Trade ID and content are required", 400));
        }
        const tradeRepository = database_1.default.getRepository(trades_1.Trade);
        const trade = yield tradeRepository.findOne({ where: { id: tradeId } });
        if (!trade) {
            return next(new errorHandler_1.default("Trade not found", 404));
        }
        // Only allow trades from supported platforms.
        if (trade.platform !== "paxful" && trade.platform !== "noones") {
            return next(new errorHandler_1.default("Unsupported platform", 400));
        }
        const services = yield initializePlatformServices();
        const platformService = (_a = services[trade.platform]) === null || _a === void 0 ? void 0 : _a.find((s) => s.accountId === trade.accountId);
        if (!platformService) {
            return next(new errorHandler_1.default("Platform service not found", 404));
        }
        try {
            yield platformService.sendTradeMessage(trade.tradeHash, content);
        }
        catch (err) {
            // Log the error but assume the message was sent if the external system
            // indicates that it was accepted (you might check err.response or other details)
            console.error("Error during sendTradeMessage:", err);
            // Optionally, check the error details here.
        }
        return res.status(200).json({
            success: true,
            message: "Message posted successfully"
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.sendTradeChatMessage = sendTradeChatMessage;
/**
 * Get wallet balances.
 */
const getWalletBalances = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const accountRepository = database_1.default.getRepository(accounts_1.Account);
        const accounts = yield accountRepository.find({
            where: { status: "active" },
        });
        const services = [];
        const balances = {};
        // Loop over each account to initialize services
        for (const account of accounts) {
            try {
                switch (account.platform) {
                    case "noones":
                        services.push({
                            platform: "noones",
                            label: account.account_username,
                            accountId: account.id,
                            getBalance: () => __awaiter(void 0, void 0, void 0, function* () {
                                const service = new noones_1.NoonesService({
                                    apiKey: account.api_key,
                                    apiSecret: account.api_secret,
                                    label: account.account_username,
                                });
                                yield service.initialize();
                                // Assume NoonesService.getWalletBalances() returns multiple currencies,
                                // so filter below will handle only BTC and USDT.
                                return service.getWalletBalances();
                            }),
                        });
                        break;
                    case "paxful":
                        services.push({
                            platform: "paxful",
                            label: account.account_username,
                            accountId: account.id,
                            getBalance: () => __awaiter(void 0, void 0, void 0, function* () {
                                const service = new paxful_1.PaxfulService({
                                    clientId: account.api_key,
                                    clientSecret: account.api_secret,
                                    label: account.account_username,
                                });
                                // Only return BTC balance for Paxful as they don't return USDT.
                                const btcBalance = yield service.getWalletBalance();
                                return [
                                    {
                                        currency: "BTC",
                                        name: "Bitcoin",
                                        balance: btcBalance,
                                        type: "crypto",
                                    },
                                ];
                            }),
                        });
                        break;
                    case "binance":
                        services.push({
                            platform: "binance",
                            label: account.account_username,
                            accountId: account.id,
                            getBalance: () => __awaiter(void 0, void 0, void 0, function* () {
                                const service = new binance_1.BinanceService({
                                    apiKey: account.api_key,
                                    apiSecret: account.api_secret,
                                    label: account.account_username,
                                });
                                // Get BTC balance using your existing method
                                const btcBalance = yield service.getBTCBalance();
                                // Get USDT balance using getAvailableBalance method
                                const usdtData = yield service.getAvailableBalance("USDT");
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
                                        balance: usdtData.total,
                                        type: "crypto",
                                    },
                                ];
                            }),
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
            }
            catch (error) {
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
        yield Promise.all(services.map((service) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const balance = yield service.getBalance();
                balances[service.accountId] = {
                    platform: service.platform,
                    label: service.label,
                    balances: balance, // This will now be an array with BTC (and USDT for Binance/Noones)
                };
            }
            catch (error) {
                console.error(`Error fetching balance for ${service.label}:`, error);
                balances[service.accountId] = {
                    error: "Failed to fetch balance",
                    platform: service.platform,
                    label: service.label,
                    balances: [],
                };
            }
        })));
        // Transform balances to filter out any currencies besides BTC and USDT
        const transformedBalances = {};
        for (const [accountId, balanceData] of Object.entries(balances)) {
            if (balanceData.error) {
                transformedBalances[accountId] = {
                    error: balanceData.error,
                    platform: balanceData.platform,
                    label: balanceData.label,
                    balances: [],
                };
            }
            else {
                transformedBalances[accountId] = {
                    balances: (balanceData.balances || [])
                        .filter((balance) => ["BTC", "USDT"].includes(balance.currency.toUpperCase()))
                        .map((balance) => ({
                        currency: balance.currency,
                        name: balance.name,
                        balance: balance.balance,
                        type: balance.type,
                    })),
                    platform: balanceData.platform,
                    label: balanceData.label,
                };
            }
        }
        return res.status(200).json({
            success: true,
            data: transformedBalances,
        });
    }
    catch (error) {
        console.error("Unexpected error in getWalletBalances:", error);
        return next(error);
    }
});
exports.getWalletBalances = getWalletBalances;
// export const markTradeAsPaid = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const { tradeId } = req.params;
//     if (!tradeId ) {
//       return next(new ErrorHandler("Trade ID are required", 400));
//     }
//     const tradeRepository = dbConnect.getRepository(Trade);
//     const trade = await tradeRepository.findOne({ where: { id: tradeId } });
//     if (!trade) {
//       return next(new ErrorHandler("Trade not found", 404));
//     }
//     // Only allow trades from paxful or noones
//     if (trade.platform !== "paxful" && trade.platform !== "noones") {
//       return next(new ErrorHandler("Unsupported platform", 400));
//     }
//     const services = await initializePlatformServices();
//     const platformService = services[trade.platform]?.find(
//       (s: any) => s.accountId === trade.accountId
//     );
//     if (!platformService) {
//       return next(new ErrorHandler("Platform service not found", 404));
//     }
//     // Call the platform-specific methods.
//     await platformService.markTradeAsPaid(trade.tradeHash);
//     return res.status(200).json({
//       success: true,
//       message: "Trade marked as paid and vendor notified successfully",
//     });
//   } catch (error) {
//     return next(error);
//   }
// };
const markTradeAsPaid = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { tradeId } = req.params;
        if (!tradeId) {
            return next(new errorHandler_1.default("Trade ID is required", 400));
        }
        const tradeRepository = database_1.default.getRepository(trades_1.Trade);
        const trade = yield tradeRepository.findOne({ where: { id: tradeId } });
        if (!trade) {
            return next(new errorHandler_1.default("Trade not found", 404));
        }
        // Only allow trades from paxful or noones
        if (trade.platform !== "paxful" && trade.platform !== "noones") {
            return next(new errorHandler_1.default("Unsupported platform", 400));
        }
        const services = yield initializePlatformServices();
        const platformService = (_a = services[trade.platform]) === null || _a === void 0 ? void 0 : _a.find((s) => s.accountId === trade.accountId);
        if (!platformService) {
            return next(new errorHandler_1.default("Platform service not found", 404));
        }
        // Call the platform-specific methods to mark as paid
        yield platformService.markTradeAsPaid(trade.tradeHash);
        // Update trade status to completed in our database
        trade.status = trades_1.TradeStatus.COMPLETED;
        trade.completedAt = new Date();
        yield tradeRepository.save(trade);
        // Mark this trade as recently modified to prevent reassignment
        markTradeAsModified(trade.tradeHash);
        // console.log(`✅ TRADE MARKED AS PAID AND COMPLETED: ${trade.tradeHash}`);
        return res.status(200).json({
            success: true,
            message: "Trade marked as paid and completed successfully",
            trade
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.markTradeAsPaid = markTradeAsPaid;
/**
 * Get payer's assigned trade.
 */
const getPayerTrade = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const tradeRepository = database_1.default.getRepository(trades_1.Trade);
        const assignedTrade = yield tradeRepository.findOne({
            where: {
                assignedPayerId: id,
                status: trades_1.TradeStatus.ASSIGNED,
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
        if (!assignedTrade.assignedPayer) {
            const reloadedTrade = yield tradeRepository.findOne({
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
            if (!(reloadedTrade === null || reloadedTrade === void 0 ? void 0 : reloadedTrade.assignedPayer)) {
                console.error(`Failed to load assignedPayer relation for trade ${assignedTrade.id}`);
                return next(new errorHandler_1.default("Error loading trade details: Missing assigned payer information", 500));
            }
            return res.status(200).json({
                success: true,
                data: Object.assign(Object.assign({}, reloadedTrade), { platformMetadata: Object.assign(Object.assign({}, reloadedTrade.platformMetadata), { sensitiveData: undefined }) }),
            });
        }
        const sanitizedTrade = Object.assign(Object.assign({}, assignedTrade), { platformMetadata: Object.assign(Object.assign({}, assignedTrade.platformMetadata), { sensitiveData: undefined }) });
        return res.status(200).json({
            success: true,
            data: sanitizedTrade,
        });
    }
    catch (error) {
        console.error("Error in getPayerTrade:", error);
        return next(new errorHandler_1.default("Error retrieving trade details", 500));
    }
});
exports.getPayerTrade = getPayerTrade;
const getCompletedPaidTrades = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const queryRunner = database_1.default.createQueryRunner();
    yield queryRunner.connect();
    try {
        const userId = (_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a.id;
        const userType = (_c = (_b = req === null || req === void 0 ? void 0 : req.user) === null || _b === void 0 ? void 0 : _b.userType) !== null && _c !== void 0 ? _c : "";
        const isPrivileged = ["admin", "customer-support"].includes(userType);
        const page = parseInt(req.query.page || "1", 10);
        const limit = parseInt(req.query.limit || "10", 10);
        const skip = (page - 1) * limit;
        const tradeRepo = queryRunner.manager.getRepository(trades_1.Trade);
        let qb = tradeRepo
            .createQueryBuilder("trade")
            .leftJoinAndSelect("trade.assignedPayer", "assignedPayer")
            .where("trade.status != :completedStatus", {
            completedStatus: trades_1.TradeStatus.COMPLETED
        });
        if (!isPrivileged) {
            qb = qb.andWhere("assignedPayer.id = :userId", { userId });
        }
        else if (typeof req.query.payerId === "string" && req.query.payerId.trim()) {
            qb = qb.andWhere("assignedPayer.id = :payerId", { payerId: req.query.payerId });
        }
        const totalCount = yield qb.getCount();
        const totalPages = Math.ceil(totalCount / limit);
        const dbTrades = yield qb
            .orderBy("trade.updatedAt", "DESC")
            .skip(skip)
            .take(limit)
            .getMany();
        const services = yield initializePlatformServices();
        const paidOrDisputedTrades = [];
        for (const trade of dbTrades) {
            try {
                const svcList = services[trade.platform];
                if (!(svcList === null || svcList === void 0 ? void 0 : svcList.length)) {
                    continue;
                }
                const svc = svcList.find((s) => s.accountId === trade.accountId);
                if (!svc) {
                    continue;
                }
                const platformTrade = yield svc.getTradeDetails(trade.tradeHash);
                if (!platformTrade) {
                    continue;
                }
                const platformStatus = ((_d = platformTrade.trade_status) === null || _d === void 0 ? void 0 : _d.toLowerCase()) || "";
                const isPaid = platformStatus === "paid";
                const isDisputed = platformStatus === "disputed" || !!platformTrade.dispute;
                if (isPaid || isDisputed) {
                    const updatedStatus = isPaid ? trades_1.TradeStatus.PAID : trades_1.TradeStatus.DISPUTED;
                    const updateData = {
                        status: updatedStatus,
                        tradeStatus: platformStatus,
                        updatedAt: new Date(),
                    };
                    if (isPaid && platformTrade.paid_at) {
                        updateData.paidAt = new Date(platformTrade.paid_at);
                    }
                    if (isDisputed) {
                        if (platformTrade.dispute_started_at) {
                            updateData.disputeStartedAt = new Date(platformTrade.dispute_started_at);
                        }
                        if ((_e = platformTrade.dispute) === null || _e === void 0 ? void 0 : _e.reason) {
                            updateData.disputeReason = platformTrade.dispute.reason;
                        }
                        if ((_f = platformTrade.dispute) === null || _f === void 0 ? void 0 : _f.reason_type) {
                            updateData.disputeReasonType = platformTrade.dispute.reason_type;
                        }
                    }
                    yield tradeRepo.update(trade.id, updateData);
                    paidOrDisputedTrades.push(Object.assign(Object.assign({}, trade), updateData));
                }
            }
            catch (err) {
                console.error(`Error checking platform status for trade ${trade.id}:`, err);
            }
        }
        const filteredTotal = paidOrDisputedTrades.length;
        const filteredTotalPages = Math.ceil(filteredTotal / limit);
        return res.status(200).json({
            success: true,
            data: {
                trades: paidOrDisputedTrades,
                pagination: {
                    total: filteredTotal,
                    totalPages: filteredTotalPages,
                    currentPage: page,
                    itemsPerPage: limit,
                },
            },
        });
    }
    catch (error) {
        console.error("Error in getCompletedPaidTrades:", error);
        return next(new errorHandler_1.default(`Error retrieving paid or disputed trades: ${error.message}`, 500));
    }
    finally {
        yield queryRunner.release();
    }
});
exports.getCompletedPaidTrades = getCompletedPaidTrades;
const getCompletedPayerTrades = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const queryRunner = database_1.default.createQueryRunner();
    yield queryRunner.connect();
    try {
        const userId = (_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a.id;
        const userType = (_c = (_b = req === null || req === void 0 ? void 0 : req.user) === null || _b === void 0 ? void 0 : _b.userType) !== null && _c !== void 0 ? _c : "";
        const isPrivileged = ["admin", "customer-support", "payer"].includes(userType);
        const page = parseInt(req.query.page || "1", 10);
        const limit = parseInt(req.query.limit || "10", 10);
        const skip = (page - 1) * limit;
        const tradeRepo = queryRunner.manager.getRepository(trades_1.Trade);
        const rateRepo = queryRunner.manager.getRepository(rates_1.Rates);
        let qb = tradeRepo
            .createQueryBuilder("trade")
            .leftJoinAndSelect("trade.assignedPayer", "assignedPayer")
            .where("(trade.status IN (:...statuses) OR LOWER(trade.tradeStatus) IN (:...statusStrings))", {
            statuses: [trades_1.TradeStatus.COMPLETED, trades_1.TradeStatus.PAID],
            statusStrings: ["completed", "paid", "success"],
        });
        if (!isPrivileged) {
            qb = qb.andWhere("assignedPayer.id = :userId", { userId });
        }
        else if (typeof req.query.payerId === "string" && req.query.payerId.trim()) {
            qb = qb.andWhere("assignedPayer.id = :payerId", { payerId: req.query.payerId });
        }
        const [dbTrades, total] = yield qb
            .orderBy("trade.completedAt", "DESC")
            .skip(skip)
            .take(limit)
            .getManyAndCount();
        const services = yield initializePlatformServices();
        const mappedTrades = [];
        for (const trade of dbTrades) {
            try {
                const tradeStatus = trade.tradeStatus.toLowerCase();
                const isDone = ["completed", "paid", "success"].includes(tradeStatus);
                if (!isDone) {
                    const svcList = services[trade.platform];
                    const svc = svcList === null || svcList === void 0 ? void 0 : svcList.find((s) => s.accountId === trade.accountId);
                    const platformTrade = svc ? yield svc.getTradeDetails(trade.tradeHash) : null;
                    if (platformTrade) {
                        const platformStatus = (_e = (_d = platformTrade.status) === null || _d === void 0 ? void 0 : _d.toLowerCase()) !== null && _e !== void 0 ? _e : "";
                        const completeNow = ["completed", "paid", "success"].includes(platformStatus);
                        if (completeNow) {
                            yield tradeRepo.update(trade.id, {
                                status: trades_1.TradeStatus.COMPLETED,
                                tradeStatus: platformStatus,
                                completedAt: platformTrade.completedAt
                                    ? new Date(platformTrade.completedAt)
                                    : new Date(),
                            });
                            trade.status = trades_1.TradeStatus.COMPLETED;
                            trade.tradeStatus = platformStatus;
                            trade.completedAt = platformTrade.completedAt
                                ? new Date(platformTrade.completedAt)
                                : new Date();
                        }
                        else {
                            yield tradeRepo.update(trade.id, {
                                status: trades_1.TradeStatus.ACTIVE_FUNDED,
                                tradeStatus: platformStatus,
                                notes: `Platform status: ${platformStatus}`,
                            });
                            trade.status = trades_1.TradeStatus.ACTIVE_FUNDED;
                            trade.tradeStatus = platformStatus;
                            trade.notes = `Platform status: ${platformStatus}`;
                        }
                    }
                    else {
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
                        id: ((_f = trade.assignedPayer) === null || _f === void 0 ? void 0 : _f.id) || null,
                        name: ((_g = trade.assignedPayer) === null || _g === void 0 ? void 0 : _g.fullName) || null,
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
                    usdCost: trade.usdtNgnRate,
                    status: trade.status,
                    tradeStatus: trade.tradeStatus,
                    notes: trade.notes || null,
                });
            }
            catch (err) {
                console.error(`Error verifying trade ${trade.id}:`, err);
                mappedTrades.push({
                    id: trade.id,
                    tradeHash: trade.tradeHash,
                    platform: trade.platform,
                    accountId: trade.accountId,
                    assignedPayer: {
                        id: ((_h = trade.assignedPayer) === null || _h === void 0 ? void 0 : _h.id) || null,
                        name: ((_j = trade.assignedPayer) === null || _j === void 0 ? void 0 : _j.fullName) || null,
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
    }
    catch (error) {
        console.error("Error in getCompletedPaidTrades:", error);
        return next(new errorHandler_1.default(`Error retrieving completed trades: ${error.message}`, 500));
    }
    finally {
        yield queryRunner.release();
    }
});
exports.getCompletedPayerTrades = getCompletedPayerTrades;
const reassignTrade = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const queryRunner = database_1.default.createQueryRunner();
    yield queryRunner.connect();
    yield queryRunner.startTransaction();
    try {
        const { tradeId } = req.params;
        if (!tradeId)
            throw new errorHandler_1.default("Trade ID is required", 400);
        const tradeRepo = queryRunner.manager.getRepository(trades_1.Trade);
        const trade = yield tradeRepo.findOne({
            where: { id: tradeId },
            lock: { mode: "pessimistic_write" },
        });
        if (!trade)
            throw new errorHandler_1.default("Trade not found", 404);
        if ([trades_1.TradeStatus.COMPLETED, trades_1.TradeStatus.CANCELLED].includes(trade.status)) {
            throw new errorHandler_1.default("This trade cannot be reassigned", 400);
        }
        // Use the getAvailablePayers function to get only users who are clocked in AND not on break
        const availablePayers = yield getAvailablePayers();
        if (availablePayers.length === 0)
            throw new errorHandler_1.default("No available payers", 400);
        const sortedPayers = availablePayers.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        let nextPayer;
        if (!trade.assignedPayerId) {
            nextPayer = sortedPayers[0];
        }
        else {
            const idx = sortedPayers.findIndex(p => String(p.id) === String(trade.assignedPayerId));
            nextPayer = sortedPayers[(idx + 1) % sortedPayers.length];
        }
        // 2) check if that payer already has an ASSIGNED trade
        const inFlight = yield tradeRepo.findOne({
            where: {
                assignedPayerId: nextPayer.id,
                status: trades_1.TradeStatus.ASSIGNED,
            },
        });
        if (inFlight) {
            // queue it up
            trade.status = trades_1.TradeStatus.ACTIVE_FUNDED;
            trade.assignedPayerId = nextPayer.id;
        }
        else {
            // assign immediately
            trade.status = trades_1.TradeStatus.ASSIGNED;
            trade.assignedPayerId = nextPayer.id;
            trade.assignedAt = new Date();
        }
        trade.isEscalated = false;
        yield tradeRepo.save(trade);
        yield queryRunner.commitTransaction();
        const updated = yield database_1.default.getRepository(trades_1.Trade).findOne({
            where: { id: tradeId },
            relations: ["assignedPayer"],
        });
        return res.status(200).json({
            success: true,
            message: "Trade reassigned successfully",
            data: updated,
        });
    }
    catch (err) {
        yield queryRunner.rollbackTransaction();
        return next(err);
    }
    finally {
        yield queryRunner.release();
    }
});
exports.reassignTrade = reassignTrade;
const getAllTrades = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const queryRunner = database_1.default.createQueryRunner();
    yield queryRunner.connect();
    try {
        const page = parseInt(req.query.page || "1", 10);
        const limit = parseInt(req.query.limit || "10", 10);
        const skip = (page - 1) * limit;
        // 1) Fetch live “Active Funded” trades from platforms
        const liveTrades = yield aggregateLiveTrades();
        const liveHashes = liveTrades.map((t) => t.trade_hash);
        // 2) Query DB for PENDING *or* any trade whose hash is in the live list
        const tradeRepo = queryRunner.manager.getRepository(trades_1.Trade);
        const qb = tradeRepo
            .createQueryBuilder("trade")
            .leftJoinAndSelect("trade.assignedPayer", "assignedPayer")
            .where("trade.status = :active_funded", { pending: trades_1.TradeStatus.ACTIVE_FUNDED })
            .orderBy("trade.createdAt", "ASC")
            .skip(skip)
            .take(limit);
        const [dbTrades, total] = yield qb.getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        // 3) Initialize platform services once
        const services = yield initializePlatformServices();
        // 4) Build a map of DB trades by hash for quick lookup
        const dbMap = new Map(dbTrades.map((t) => [t.tradeHash, t]));
        // 5) Enhance each DB trade with message count and live data if present
        const enhanced = [];
        for (const trade of dbTrades) {
            let messageCount = 0;
            let isLive = liveHashes.includes(trade.tradeHash);
            // If it’s live, pull in the platform’s “live” fields
            if (isLive) {
                const live = liveTrades.find((l) => l.trade_hash === trade.tradeHash);
                trade.tradeStatus = "Active Funded";
                trade.amount = live.fiat_amount_requested;
                trade.cryptoCurrencyCode = live.crypto_currency_code;
                trade.fiatCurrency = live.fiat_currency_code;
            }
            // Now fetch chat if the platform supports it
            const svcList = services[trade.platform];
            const svc = svcList === null || svcList === void 0 ? void 0 : svcList.find((s) => s.accountId === trade.accountId);
            if (svc && typeof svc.getTradeChat === "function") {
                try {
                    const chat = yield svc.getTradeChat(trade.tradeHash);
                    messageCount = Array.isArray(chat.messages) ? chat.messages.length : 0;
                }
                catch (err) {
                    console.error(`Chat error for ${trade.tradeHash}:`, err);
                }
            }
            enhanced.push(Object.assign(Object.assign({}, trade), { messageCount,
                isLive }));
        }
        // 6) Add any *purely* live trades (not yet in DB) at the end
        for (const live of liveTrades) {
            if (!dbMap.has(live.trade_hash)) {
                // find service
                const svcList = services[live.platform];
                const svc = svcList === null || svcList === void 0 ? void 0 : svcList.find((s) => s.accountId === live.account_id);
                let messageCount = 0;
                if (svc && typeof svc.getTradeChat === "function") {
                    try {
                        const chat = yield svc.getTradeChat(live.trade_hash);
                        messageCount = Array.isArray(chat.messages) ? chat.messages.length : 0;
                    }
                    catch (err) {
                        console.error(`Chat error for live ${live.trade_hash}:`, err);
                    }
                }
                enhanced.push({
                    id: live.trade_hash,
                    tradeHash: live.trade_hash,
                    platform: live.platform,
                    accountId: live.account_id,
                    amount: live.fiat_amount_requested,
                    status: trades_1.TradeStatus.ACTIVE_FUNDED,
                    tradeStatus: "Active Funded",
                    createdAt: live.created_at,
                    cryptoCurrencyCode: live.crypto_currency_code,
                    fiatCurrency: live.fiat_currency_code,
                    assignedPayer: null,
                    messageCount,
                    isLive: true,
                });
            }
        }
        // 7) Sort by message count desc
        enhanced.sort((a, b) => b.messageCount - a.messageCount);
        // 8) Return
        return res.status(200).json({
            success: true,
            data: {
                trades: enhanced,
                pagination: {
                    total,
                    totalPages,
                    currentPage: page,
                    itemsPerPage: limit,
                },
            },
        });
    }
    catch (err) {
        console.error("Error in getAllTrades:", err);
        return next(new errorHandler_1.default(`Error retrieving trades: ${err.message}`, 500));
    }
    finally {
        yield queryRunner.release();
    }
});
exports.getAllTrades = getAllTrades;
const getUnfinishedTrades = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tradeRepository = database_1.default.getRepository(trades_1.Trade);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        // Example: return trades that are not completed or not marked as "Paid"
        const [trades, total] = yield tradeRepository.findAndCount({
            where: { status: (0, typeorm_1.Not)(trades_1.TradeStatus.COMPLETED) },
            skip,
            take: limit,
            order: { createdAt: "DESC" },
        });
        const totalPages = Math.ceil(total / limit);
        return res.status(200).json({
            success: true,
            data: { trades, pagination: { total, totalPages, currentPage: page, itemsPerPage: limit } },
        });
    }
    catch (error) {
        return next(new errorHandler_1.default(`Error retrieving unfinished trades: ${error.message}`, 500));
    }
});
exports.getUnfinishedTrades = getUnfinishedTrades;
const updateCapRate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { btcngnrate, usdtngnrate, marketCap } = req.body;
        const ratesRepo = database_1.default.getRepository(rates_1.Rates);
        const existingRates = yield ratesRepo.findOne({ where: {} });
        if (!existingRates) {
            return res.status(404).json({ success: false, message: "Rates not found" });
        }
        if (btcngnrate !== undefined) {
            existingRates.btcngnrate = btcngnrate;
        }
        if (usdtngnrate !== undefined) {
            existingRates.usdtNgnRate = usdtngnrate;
        }
        // Add handling for marketCap
        if (marketCap !== undefined) {
            existingRates.marketcap = marketCap;
        }
        yield ratesRepo.save(existingRates);
        return res.status(200).json({
            success: true,
            message: "Rates updated successfully",
            data: existingRates,
        });
    }
    catch (error) {
        console.error("Error updating rates:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});
exports.updateCapRate = updateCapRate;
const getCapRate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ratesRepo = database_1.default.getRepository(rates_1.Rates);
        const rates = yield ratesRepo.findOne({ where: {} });
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
    }
    catch (error) {
        next(error);
    }
});
exports.getCapRate = getCapRate;
const setOrUpdateRates = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { sellingPrice, usdtNgnRate, platformRates } = req.body;
        // Validate required fields
        if (sellingPrice === undefined ||
            usdtNgnRate === undefined ||
            !platformRates ||
            typeof platformRates !== "object") {
            return next(new errorHandler_1.default("Missing required fields: sellingPrice, usdtNgnRate, and platformRates are required", 400));
        }
        const ratesRepository = database_1.default.getRepository(rates_1.Rates);
        const ratesAll = yield ratesRepository.find();
        let rates = ratesAll.length > 0 ? ratesAll[0] : new rates_1.Rates();
        // Set global rate values
        rates.sellingPrice = sellingPrice;
        rates.usdtNgnRate = usdtNgnRate;
        // Save the dynamic platform rates object into a JSON field
        // Make sure your Rates entity has a JSON column (e.g., platformRates) defined.
        rates.platformRates = platformRates;
        yield ratesRepository.save(rates);
        return res.status(ratesAll.length > 0 ? 200 : 201).json({
            success: true,
            message: ratesAll.length > 0
                ? "Rates updated successfully"
                : "Rates set successfully",
            data: rates,
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.setOrUpdateRates = setOrUpdateRates;
const getRates = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const ratesRepository = database_1.default.getRepository(rates_1.Rates);
        const ratesAll = yield ratesRepository.find();
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
    }
    catch (error) {
        return next(error);
    }
});
exports.getRates = getRates;
const getActiveFundedTotal = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const liveTrades = yield aggregateLiveTrades();
        let totalActiveFundedBTC = 0;
        let totalActiveFundedUSDT = 0;
        for (const trade of liveTrades) {
            const code = (trade.crypto_currency_code || "").toUpperCase();
            const raw = parseFloat((_a = trade.crypto_amount_total) !== null && _a !== void 0 ? _a : "0");
            const decimals = DECIMALS[code] || 0;
            const amt = raw / Math.pow(10, decimals);
            if (code === "BTC") {
                totalActiveFundedBTC += amt;
            }
            else if (code === "USDT") {
                totalActiveFundedUSDT += amt;
            }
        }
        return res.status(200).json({
            success: true,
            data: {
                btc: totalActiveFundedBTC,
                usdt: totalActiveFundedUSDT,
            },
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.getActiveFundedTotal = getActiveFundedTotal;
/**
 * GET /trade/vendor-coin
 * Returns the total BTC and USDT from trades that the platform reports as "paid".
 */
const getVendorCoin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const services = yield initializePlatformServices();
        let totalVendorCoinBTC = 0;
        let totalVendorCoinUSDT = 0;
        const tradeRepository = database_1.default.getRepository(trades_1.Trade);
        const processedTradeHashes = new Set();
        // Flatten Paxful + Noones
        const allServices = [...services.paxful, ...services.noones];
        for (const svc of allServices) {
            // Remove the hard‑coded "1" so we get all completed trades
            const completedTrades = yield svc.listCompletedTrades();
            for (const trade of completedTrades) {
                // Platform payload uses `trade.trade_status`, not `trade.status`
                const status = (trade.trade_status || "").toLowerCase();
                if (status !== "paid")
                    continue;
                const code = (trade.crypto_currency_code || "").toUpperCase();
                const amt = parseFloat((_a = trade.crypto_amount_requested) !== null && _a !== void 0 ? _a : "0");
                if (code === "BTC") {
                    totalVendorCoinBTC += amt;
                }
                else if (code === "USDT") {
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
    }
    catch (error) {
        console.error("Error in getVendorCoin:", error);
        return next(error);
    }
});
exports.getVendorCoin = getVendorCoin;
// Endpoint 1: Escalate a trade
const escalateTrade = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { tradeId } = req.params;
    const { reason, escalatedById } = req.body;
    try {
        const tradeRepo = database_1.default.getRepository(trades_1.Trade);
        const trade = yield tradeRepo.findOne({ where: { id: tradeId } });
        if (!trade)
            throw new Error('Trade not found');
        trade.isEscalated = true;
        trade.status = trades_1.TradeStatus.ESCALATED;
        trade.escalationReason = reason;
        trade.escalatedById = escalatedById;
        trade.assignedPayerId = undefined;
        yield tradeRepo.save(trade);
        // Mark this trade as recently modified to prevent reassignment
        markTradeAsModified(trade.tradeHash);
        // console.log(`✅ MARKED AS MODIFIED: ${trade.tradeHash}`);
        // Notify CC
        const ccAgent = yield database_1.default.getRepository(user_1.User).findOne({ where: { userType: user_1.UserType.CC } });
        if (ccAgent) {
            yield (0, notificationController_1.createNotification)({
                userId: ccAgent.id,
                title: 'Trade Escalated',
                description: `Trade ${tradeId} has been escalated.`,
                type: notifications_1.NotificationType.SYSTEM,
                priority: notifications_1.PriorityLevel.HIGH,
                relatedAccountId: null
            });
        }
        return res.status(200).json({ success: true, message: 'Trade escalated successfully' });
    }
    catch (err) {
        return next(err);
    }
});
exports.escalateTrade = escalateTrade;
// Endpoint 2: Get escalated trades
const getEscalatedTrades = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tradeRepo = database_1.default.getRepository(trades_1.Trade);
        const escalatedTrades = yield tradeRepo.find({
            where: { status: trades_1.TradeStatus.ESCALATED },
            relations: ['assignedPayer', 'escalatedBy'],
            order: { updatedAt: 'DESC' }
        });
        return res.status(200).json({
            success: true,
            data: escalatedTrades
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.getEscalatedTrades = getEscalatedTrades;
/**
 * Get escalated trade by ID with full details
 */
const getEscalatedTradeById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
        const { id } = req.params;
        if (!id) {
            return next(new errorHandler_1.default("Escalated trade ID is required", 400));
        }
        const tradeRepo = database_1.default.getRepository(trades_1.Trade);
        // Find the trade with all necessary relations
        const trade = yield tradeRepo.findOne({
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
            return next(new errorHandler_1.default("Escalated trade not found", 404));
        }
        // Initialize platform services
        const services = yield initializePlatformServices();
        let externalTrade = null;
        let tradeChat = null;
        try {
            // Only attempt to fetch external data if we have required fields
            if (trade.platform && trade.tradeHash && trade.accountId) {
                // Fetch platform-specific trade details
                switch (trade.platform.toLowerCase()) {
                    case "noones": {
                        const service = services.noones.find(s => s.accountId === trade.accountId);
                        if (service) {
                            externalTrade = yield service.getTradeDetails(trade.tradeHash);
                            tradeChat = yield service.getTradeChat(trade.tradeHash);
                        }
                        break;
                    }
                    case "paxful": {
                        const service = services.paxful.find(s => s.accountId === trade.accountId);
                        if (service) {
                            const response = yield service.getTradeDetails(trade.tradeHash);
                            externalTrade = (_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.trade;
                            tradeChat = yield service.getTradeChat(trade.tradeHash);
                        }
                        break;
                    }
                }
            }
        }
        catch (externalError) {
            console.error('Error fetching external trade data:', externalError);
            // Continue without external data rather than failing
        }
        // Format the response
        const responseData = {
            trade: Object.assign(Object.assign({}, trade), { escalatedBy: trade.escalatedBy ? {
                    id: trade.escalatedBy.id,
                    fullName: trade.escalatedBy.fullName,
                    avatar: trade.escalatedBy.avatar
                } : null, assignedCcAgent: trade.assignedCcAgent ? {
                    id: trade.assignedCcAgent.id,
                    fullName: trade.assignedCcAgent.fullName,
                    avatar: trade.assignedCcAgent.avatar
                } : null, assignedPayer: trade.assignedPayer ? {
                    id: trade.assignedPayer.id,
                    fullName: trade.assignedPayer.fullName,
                    avatar: trade.assignedPayer.avatar
                } : null }),
            externalTrade: externalTrade ? {
                btcRate: externalTrade.fiat_price_per_btc,
                dollarRate: externalTrade.fiat_amount_requested,
                amount: externalTrade.fiat_amount_requested,
                bankName: (_c = (_b = externalTrade.bank_accounts) === null || _b === void 0 ? void 0 : _b.to) === null || _c === void 0 ? void 0 : _c.bank_name,
                accountNumber: (_e = (_d = externalTrade.bank_accounts) === null || _d === void 0 ? void 0 : _d.to) === null || _e === void 0 ? void 0 : _e.account_number,
                accountHolder: (_g = (_f = externalTrade.bank_accounts) === null || _f === void 0 ? void 0 : _f.to) === null || _g === void 0 ? void 0 : _g.holder_name,
                buyer_name: externalTrade.buyer_name
            } : null,
            tradeChat: tradeChat ? {
                messages: ((_h = tradeChat.messages) === null || _h === void 0 ? void 0 : _h.map((msg) => {
                    var _a, _b;
                    return ({
                        id: msg.id || Math.random().toString(36).substr(2, 9),
                        content: msg.text || "",
                        sender: {
                            id: ((_a = msg.author) === null || _a === void 0 ? void 0 : _a.externalId) || "system",
                            fullName: ((_b = msg.author) === null || _b === void 0 ? void 0 : _b.userName) || "System"
                        },
                        createdAt: msg.timestamp && !isNaN(msg.timestamp)
                            ? new Date(parseInt(msg.timestamp) * 1000).toISOString()
                            : new Date().toISOString()
                    });
                })) || [],
                attachments: tradeChat.attachments || []
            } : null
        };
        return res.status(200).json({
            success: true,
            data: responseData
        });
    }
    catch (error) {
        return next(error);
    }
});
exports.getEscalatedTradeById = getEscalatedTradeById;
const cancelTrade = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const queryRunner = database_1.default.createQueryRunner();
    yield queryRunner.connect();
    yield queryRunner.startTransaction();
    try {
        const { tradeId } = req.params;
        if (!tradeId)
            throw new errorHandler_1.default("Trade ID is required", 400);
        const tradeRepo = queryRunner.manager.getRepository(trades_1.Trade);
        const trade = yield tradeRepo.findOne({
            where: { id: tradeId },
            lock: { mode: "pessimistic_write" },
        });
        if (!trade)
            throw new errorHandler_1.default("Trade not found", 404);
        if (trade.status === trades_1.TradeStatus.COMPLETED) {
            throw new errorHandler_1.default("Completed trades cannot be cancelled", 400);
        }
        if (trade.status === trades_1.TradeStatus.CANCELLED) {
            throw new errorHandler_1.default("Trade is already cancelled", 400);
        }
        // Find the account associated with this trade
        const accountRepo = queryRunner.manager.getRepository(accounts_1.Account);
        const account = yield accountRepo.findOne({
            where: { id: trade.accountId }
        });
        if (!account) {
            throw new errorHandler_1.default("Account associated with this trade not found", 404);
        }
        // Call the appropriate service based on the platform
        let cancellationResult = false;
        if (trade.platform === "noones") {
            // Type assertion to ensure TypeScript knows these are strings
            const apiKey = account.api_key;
            const apiSecret = account.api_secret;
            if (!apiKey || !apiSecret) {
                throw new errorHandler_1.default("API credentials not found for this account", 500);
            }
            const noonesService = new noones_1.NoonesService({
                apiKey,
                apiSecret,
                accountId: account.id,
                label: account.account_username,
            });
            cancellationResult = yield noonesService.cancelTrade(trade.tradeHash);
        }
        else if (trade.platform === "paxful") {
            // Type assertion to ensure TypeScript knows these are strings
            const clientId = account.api_key;
            const clientSecret = account.api_secret;
            if (!clientId || !clientSecret) {
                throw new errorHandler_1.default("API credentials not found for this account", 500);
            }
            const paxfulService = new paxful_1.PaxfulService({
                clientId,
                clientSecret,
                accountId: account.id,
                label: account.account_username,
            });
            cancellationResult = yield paxfulService.cancelTrade(trade.tradeHash);
        }
        else {
            throw new errorHandler_1.default(`Unsupported platform: ${trade.platform}`, 400);
        }
        if (!cancellationResult) {
            throw new errorHandler_1.default("Failed to cancel trade on platform", 500);
        }
        // Update trade status in our database
        trade.status = trades_1.TradeStatus.CANCELLED;
        trade.isEscalated = false;
        yield tradeRepo.save(trade);
        yield queryRunner.commitTransaction();
        return res.status(200).json({
            success: true,
            message: "Trade cancelled successfully",
            data: trade,
        });
    }
    catch (err) {
        yield queryRunner.rollbackTransaction();
        return next(err);
    }
    finally {
        yield queryRunner.release();
    }
});
exports.cancelTrade = cancelTrade;
const getCCstats = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const tradeRepo = database_1.default.getRepository(trades_1.Trade);
    const shiftRepo = database_1.default.getRepository(shift_1.Shift);
    // 1) Total trades
    const totalTrades = yield tradeRepo.count();
    // 2) New trades today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const newTradesToday = yield tradeRepo.count({
        where: { createdAt: (0, typeorm_1.MoreThanOrEqual)(startOfToday) }
    });
    // 3) Avg response time (completedAt - createdAt) in hours
    const completedTrades = yield tradeRepo.find({
        where: { status: trades_1.TradeStatus.COMPLETED }
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
    const escalatedCount = yield tradeRepo.count({
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
    const activeVendors = yield shiftRepo.count({
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
});
exports.getCCstats = getCCstats;
