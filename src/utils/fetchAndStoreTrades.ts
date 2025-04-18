import { Trade, TradePlatform } from "../models/trades";
import dbConnect from "../config/database";
import { DeepPartial, In } from "typeorm";
import { ActivityLog, ActivityType } from "../models/activityLogs";
import { NoonesService } from "../config/noones";
import { PaxfulService } from "../config/paxful";
import { Account, ForexPlatform } from "../models/accounts";
import { Chat } from "../models/chats";


interface ServiceResponse<T> {
  data: {
    trades?: T[];
    trade?: T;
    [key: string]: any;
  };
  status: string;
  timestamp: number;
}

interface RawTrade {
  trade_hash: string;
  trade_status: string;
  fiat_amount_requested: number;
  crypto_amount_requested: number;
  crypto_amount_total: number;
  fee_crypto_amount: number;
  fee_percentage: number;
  source_id: number | string;
  responder_username: string;
  owner_username: string;
  payment_method_name: string;
  location_iso: string | null;
  fiat_currency_code: string;
  crypto_currency_code: string;
  started_at: string;
  completed_at: string | null;
  is_active_offer: boolean;
  offer_hash: string | null;
  margin: number | null;
  fiat_price_per_btc?: number;
  crypto_rate_usd?: number;
  crypto_current_rate_usd?: number;
}

interface TradeActivityLogEntry {
  action: ActivityType;
  performedBy: string;
  performedAt: Date;
  details?: Record<string, any>;
}

const calculateRates = (trade: RawTrade) => {
  const btcRate = trade.fiat_price_per_btc?.toString() || "0";
  const dollarRate = (
    trade.crypto_current_rate_usd ||
    trade.crypto_rate_usd ||
    0
  ).toString();
  const btcAmount = (trade.crypto_amount_total / 100000000).toString();
  return { btcRate, dollarRate, btcAmount };
};


const createActivityLog = (
  action: ActivityType,
  description: string,
  details: Record<string, any>
): TradeActivityLogEntry => ({
  action,
  performedBy: "system",
  performedAt: new Date(),
  details,
});

const normalizeTrade = (
  trade: RawTrade,
  platform: TradePlatform,
  account: Account
): DeepPartial<any> => {
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
    margin: trade.margin?.toString(),
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
      createActivityLog(
        ActivityType.TRADE_CREATED,
        `Trade created from ${platform}`,
        {
          platform,
          tradeHash: trade.trade_hash,
          accountId: account.id,
          accountUsername: account.account_username,
        }
      ),
    ],
  };
};

async function initializeService(
  account: Account,
  ServiceClass: any
): Promise<any> {
  try {
    let service;
    if (account.platform === ForexPlatform.PAXFUL) {
      service = new ServiceClass({
        clientId: account.api_key,
        clientSecret: account.api_secret,
        accountId: account.id,
        label: account.account_username,
      });
    } else {
      service = new ServiceClass({
        apiKey: account.api_key,
        apiSecret: account.api_secret,
        accountId: account.id,
        label: account.account_username,
      });
      await service.initialize();
    }

    console.log(
      `Initialized ${account.platform} service for account ${account.account_username}`
    );
    return service;
  } catch (error) {
    console.error(
      `Failed to initialize ${account.platform} service for account ${account.account_username}:`,
      error
    );
    return null;
  }
}

async function fetchTradesForService(
  service: NoonesService | PaxfulService,
  account: Account
): Promise<{ trade: RawTrade; account: Account }[]> {
  try {
    const trades = await service.listActiveTrades();
    if (account.platform === ForexPlatform.PAXFUL) {
      // console.log(`This is Paxful ${account.account_username}`, trades);
    } else {
      // console.log(`This is Noones ${account.account_username}`, trades);
    }
    return trades.map((trade: any) => ({ trade, account }));
  } catch (error) {
    console.error(
      `Error fetching trades for ${account.platform} account ${account.account_username}:`,
      error
    );
    return [];
  }
}

async function processTradeBatch(
  batch: DeepPartial<Trade>[],
  queryRunner: any
): Promise<{ inserted: number; updated: number; errors: number }> {
  const results = { inserted: 0, updated: 0, errors: 0 };

  for (const trade of batch) {
    const innerQueryRunner = queryRunner.manager.connection.createQueryRunner();
    await innerQueryRunner.connect();
    await innerQueryRunner.startTransaction();

    try {
      // Find existing trade within the current transaction
      const existingTrade = await innerQueryRunner.manager.findOne(Trade, {
        where: { tradeHash: trade.tradeHash },
      });

      let tradeId: string;

      if (existingTrade) {
        // Handle update
        const { tradeHash, createdAt, ...updateData } = trade;
        const newActivityLog = [
          ...(existingTrade.activityLog || []),
          ...(trade.activityLog || []),
        ];

        const updatedTrade = await innerQueryRunner.manager.save(Trade, {
          ...existingTrade,
          ...updateData,
          accountId: trade.accountId,
          activityLog: newActivityLog,
          id: existingTrade.id,
        });
        tradeId = updatedTrade.id;
        results.updated++;
      } else {
        // Handle insert
        const tradeEntity = innerQueryRunner.manager.create(Trade, {
          ...trade,
          accountId: trade.accountId,
          platformMetadata: trade.platformMetadata || {},
          activityLog: trade.activityLog || [],
        });
        const savedTrade = await innerQueryRunner.manager.save(
          Trade,
          tradeEntity
        );
        tradeId = savedTrade.id;
        results.inserted++;
      }

      if (trade.tradeStatus === "Dispute open") {
        console.warn("Another Dispute");
        const escalatedTradeExists = await innerQueryRunner.manager.findOne(
          Trade,
          {
            where: { trade: { id: tradeId } },
          }
        );

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

      await innerQueryRunner.commitTransaction();
    } catch (error: any) {
      console.error(`Error processing trade ${trade.tradeHash}:`, error``);
      await innerQueryRunner.rollbackTransaction();
      results.errors++;
    } finally {
      await innerQueryRunner.release();
    }
  }

  return results;
}

export const fetchAndStoreTrades = async () => {
  const stats = { inserted: 0, updated: 0, errors: 0 };
  const connection = dbConnect;
  const queryRunner = connection.createQueryRunner();

  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    console.log("Starting trade fetch and store process...");
    const accountRepository = queryRunner.manager.getRepository(Account);
    const tradeRepository = queryRunner.manager.getRepository(Trade);

    const latestRate = await queryRunner.manager
      .getRepository("rates")
      .createQueryBuilder("rates")
      .orderBy("rates.createdAt", "DESC")
      .getOne();

    const sellingPrice = latestRate ? parseFloat(latestRate.sellingPrice) : 0;

    const [noonesAccounts, paxfulAccounts] = await Promise.all([
      accountRepository.find({
        where: { platform: ForexPlatform.NOONES, status: "active" },
      }),
      accountRepository.find({
        where: { platform: ForexPlatform.PAXFUL, status: "active" },
      }),
    ]);

    // Initialize services
    const noonesServices = await Promise.all(
      noonesAccounts.map((account) => initializeService(account, NoonesService))
    );
    const paxfulServices = await Promise.all(
      paxfulAccounts.map((account) => initializeService(account, PaxfulService))
    );

    // Fetch trades
    const tradesPromises = [
      ...noonesServices.map((service: any, index: number) =>
        service ? fetchTradesForService(service, noonesAccounts[index]) : []
      ),
      ...paxfulServices.map((service, index) =>
        service ? fetchTradesForService(service, paxfulAccounts[index]) : []
      ),
    ];

    const allTradesResults = await Promise.all(tradesPromises);

    let normalizedTrades = allTradesResults.flat().map(({ trade, account }) => {
      const platform =
        account.platform === ForexPlatform.NOONES
          ? TradePlatform.NOONES
          : TradePlatform.PAXFUL;
      return normalizeTrade(trade, platform, account);
    });

    normalizedTrades = normalizedTrades.map((trade) => {
      if (parseFloat(trade.dollarRate) > sellingPrice) {
        return { ...trade, flagged: true };
      }
      return trade;
    });

    // Process trades in smaller batches with independent transactions
    const BATCH_SIZE = 5;
    for (let i = 0; i < normalizedTrades.length; i += BATCH_SIZE) {
      const batch = normalizedTrades.slice(i, i + BATCH_SIZE);
      try {
        const batchResults = await processTradeBatch(batch, queryRunner);
        stats.inserted += batchResults.inserted;
        stats.updated += batchResults.updated;
        stats.errors += batchResults.errors;
      } catch (error) {
        console.error("Error processing batch:", error);
        stats.errors += batch.length;
      }
    }

    await queryRunner.commitTransaction();
    console.log("Trade processing completed:", stats);
    return stats;
  } catch (error) {
    console.error("Error in trade fetch and store process:", error);
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
};
