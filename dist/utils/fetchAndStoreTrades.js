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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAndStoreTrades = void 0;
const trades_1 = require("../models/trades");
const database_1 = __importDefault(require("../config/database"));
const activityLogs_1 = require("../models/activityLogs");
const noones_1 = require("../config/noones");
const paxful_1 = require("../config/paxful");
const accounts_1 = require("../models/accounts");
const calculateRates = (trade) => {
    var _a;
    const btcRate = ((_a = trade.fiat_price_per_btc) === null || _a === void 0 ? void 0 : _a.toString()) || "0";
    const dollarRate = (trade.crypto_current_rate_usd ||
        trade.crypto_rate_usd ||
        0).toString();
    const btcAmount = (trade.crypto_amount_total / 100000000).toString();
    return { btcRate, dollarRate, btcAmount };
};
const createActivityLog = (action, description, details) => ({
    action,
    performedBy: "system",
    performedAt: new Date(),
    details,
});
const normalizeTrade = (trade, platform, account) => {
    var _a;
    const rates = calculateRates(trade);
    return {
        tradeHash: trade.trade_hash,
        platform,
        accountId: account.id,
        tradeStatus: trade.trade_status,
        amount: trade.fiat_amount_requested.toString(),
        cryptoAmountRequested: trade.crypto_amount_requested.toString(),
        cryptoAmountTotal: trade.crypto_amount_total.toString(),
        feeCryptoAmount: trade.fee_crypto_amount.toString(),
        feePercentage: trade.fee_percentage.toString(),
        sourceId: trade.source_id.toString(),
        responderUsername: trade.responder_username,
        ownerUsername: trade.owner_username,
        paymentMethod: trade.payment_method_name,
        locationIso: trade.location_iso || undefined,
        fiatCurrency: trade.fiat_currency_code,
        cryptoCurrencyCode: trade.crypto_currency_code,
        isActiveOffer: trade.is_active_offer,
        offerHash: trade.offer_hash || undefined,
        margin: (_a = trade.margin) === null || _a === void 0 ? void 0 : _a.toString(),
        dollarRate: rates.dollarRate,
        btcRate: rates.btcRate,
        btcAmount: rates.btcAmount,
        completedAt: trade.completed_at ? new Date(trade.completed_at) : undefined,
        platformMetadata: {
            rawData: trade,
            accountId: account.id,
            accountUsername: account.account_username,
            lastUpdated: new Date(),
        },
        activityLog: [
            createActivityLog(activityLogs_1.ActivityType.TRADE_CREATED, `Trade created from ${platform}`, {
                platform,
                tradeHash: trade.trade_hash,
                accountId: account.id,
                accountUsername: account.account_username,
            }),
        ],
    };
};
function initializeService(account, ServiceClass) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let service;
            if (account.platform === accounts_1.ForexPlatform.PAXFUL) {
                service = new ServiceClass({
                    clientId: account.api_key,
                    clientSecret: account.api_secret,
                    accountId: account.id,
                    label: account.account_username,
                });
            }
            else {
                service = new ServiceClass({
                    apiKey: account.api_key,
                    apiSecret: account.api_secret,
                    accountId: account.id,
                    label: account.account_username,
                });
                yield service.initialize();
            }
            console.log(`Initialized ${account.platform} service for account ${account.account_username}`);
            return service;
        }
        catch (error) {
            console.error(`Failed to initialize ${account.platform} service for account ${account.account_username}:`, error);
            return null;
        }
    });
}
function fetchTradesForService(service, account) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const trades = yield service.listActiveTrades();
            if (account.platform === accounts_1.ForexPlatform.PAXFUL) {
                // console.log(`This is Paxful ${account.account_username}`, trades);
            }
            else {
                // console.log(`This is Noones ${account.account_username}`, trades);
            }
            return trades.map((trade) => ({ trade, account }));
        }
        catch (error) {
            console.error(`Error fetching trades for ${account.platform} account ${account.account_username}:`, error);
            return [];
        }
    });
}
function processTradeBatch(batch, queryRunner) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = { inserted: 0, updated: 0, errors: 0 };
        for (const trade of batch) {
            const innerQueryRunner = queryRunner.manager.connection.createQueryRunner();
            yield innerQueryRunner.connect();
            yield innerQueryRunner.startTransaction();
            try {
                // Find existing trade within the current transaction
                const existingTrade = yield innerQueryRunner.manager.findOne(trades_1.Trade, {
                    where: { tradeHash: trade.tradeHash },
                });
                let tradeId;
                if (existingTrade) {
                    // Handle update
                    const { tradeHash, createdAt } = trade, updateData = __rest(trade, ["tradeHash", "createdAt"]);
                    const newActivityLog = [
                        ...(existingTrade.activityLog || []),
                        ...(trade.activityLog || []),
                    ];
                    const updatedTrade = yield innerQueryRunner.manager.save(trades_1.Trade, Object.assign(Object.assign(Object.assign({}, existingTrade), updateData), { accountId: trade.accountId, activityLog: newActivityLog, id: existingTrade.id }));
                    tradeId = updatedTrade.id;
                    results.updated++;
                }
                else {
                    // Handle insert
                    const tradeEntity = innerQueryRunner.manager.create(trades_1.Trade, Object.assign(Object.assign({}, trade), { accountId: trade.accountId, platformMetadata: trade.platformMetadata || {}, activityLog: trade.activityLog || [] }));
                    const savedTrade = yield innerQueryRunner.manager.save(trades_1.Trade, tradeEntity);
                    tradeId = savedTrade.id;
                    results.inserted++;
                }
                if (trade.tradeStatus === "Dispute open") {
                    console.warn("Another Dispute");
                    const escalatedTradeExists = yield innerQueryRunner.manager.findOne(trades_1.Trade, {
                        where: { trade: { id: tradeId } },
                    });
                    // if (!escalatedTradeExists) {
                    //   const escalatedTrade = new EscalatedTrade();
                    //   escalatedTrade.trade = { id: tradeId } as Trade;
                    //   escalatedTrade.platform = mapTradePlatformToPlatform(
                    //     trade.platform || "paxful"
                    //   );
                    //   escalatedTrade.amount = parseFloat(trade.amount?.toString() || "0");
                    //   escalatedTrade.status = TradeStatus.PENDING;
                    //   await innerQueryRunner.manager.save(EscalatedTrade, escalatedTrade);
                    //   const activityLogEntry = createActivityLog(
                    //     ActivityType.TRADE_ESCALATED,
                    //     `Trade escalated due to Dispute Open status`,
                    //     { escalatedAt: new Date() }
                    //   );
                    //   await innerQueryRunner.manager.update(
                    //     Trade,
                    //     { id: tradeId },
                    //     {
                    //       activityLog: () =>
                    //         `array_append(activityLog, '${JSON.stringify(
                    //           activityLogEntry
                    //         )}')`,
                    //     }
                    //   );
                    // }
                }
                yield innerQueryRunner.commitTransaction();
            }
            catch (error) {
                console.error(`Error processing trade ${trade.tradeHash}:`, error ``);
                yield innerQueryRunner.rollbackTransaction();
                results.errors++;
            }
            finally {
                yield innerQueryRunner.release();
            }
        }
        return results;
    });
}
const fetchAndStoreTrades = () => __awaiter(void 0, void 0, void 0, function* () {
    const stats = { inserted: 0, updated: 0, errors: 0 };
    const connection = database_1.default;
    const queryRunner = connection.createQueryRunner();
    yield queryRunner.connect();
    yield queryRunner.startTransaction();
    try {
        console.log("Starting trade fetch and store process...");
        const accountRepository = queryRunner.manager.getRepository(accounts_1.Account);
        const tradeRepository = queryRunner.manager.getRepository(trades_1.Trade);
        const latestRate = yield queryRunner.manager
            .getRepository("rates")
            .createQueryBuilder("rates")
            .orderBy("rates.createdAt", "DESC")
            .getOne();
        const sellingPrice = latestRate ? parseFloat(latestRate.sellingPrice) : 0;
        const [noonesAccounts, paxfulAccounts] = yield Promise.all([
            accountRepository.find({
                where: { platform: accounts_1.ForexPlatform.NOONES, status: "active" },
            }),
            accountRepository.find({
                where: { platform: accounts_1.ForexPlatform.PAXFUL, status: "active" },
            }),
        ]);
        // Initialize services
        const noonesServices = yield Promise.all(noonesAccounts.map((account) => initializeService(account, noones_1.NoonesService)));
        const paxfulServices = yield Promise.all(paxfulAccounts.map((account) => initializeService(account, paxful_1.PaxfulService)));
        // Fetch trades
        const tradesPromises = [
            ...noonesServices.map((service, index) => service ? fetchTradesForService(service, noonesAccounts[index]) : []),
            ...paxfulServices.map((service, index) => service ? fetchTradesForService(service, paxfulAccounts[index]) : []),
        ];
        const allTradesResults = yield Promise.all(tradesPromises);
        let normalizedTrades = allTradesResults.flat().map(({ trade, account }) => {
            const platform = account.platform === accounts_1.ForexPlatform.NOONES
                ? trades_1.TradePlatform.NOONES
                : trades_1.TradePlatform.PAXFUL;
            return normalizeTrade(trade, platform, account);
        });
        normalizedTrades = normalizedTrades.map((trade) => {
            if (parseFloat(trade.dollarRate) > sellingPrice) {
                return Object.assign(Object.assign({}, trade), { flagged: true });
            }
            return trade;
        });
        // Process trades in smaller batches with independent transactions
        const BATCH_SIZE = 5;
        for (let i = 0; i < normalizedTrades.length; i += BATCH_SIZE) {
            const batch = normalizedTrades.slice(i, i + BATCH_SIZE);
            try {
                const batchResults = yield processTradeBatch(batch, queryRunner);
                stats.inserted += batchResults.inserted;
                stats.updated += batchResults.updated;
                stats.errors += batchResults.errors;
            }
            catch (error) {
                console.error("Error processing batch:", error);
                stats.errors += batch.length;
            }
        }
        yield queryRunner.commitTransaction();
        console.log("Trade processing completed:", stats);
        return stats;
    }
    catch (error) {
        console.error("Error in trade fetch and store process:", error);
        yield queryRunner.rollbackTransaction();
        throw error;
    }
    finally {
        yield queryRunner.release();
    }
});
exports.fetchAndStoreTrades = fetchAndStoreTrades;
