import crypto from "crypto";
import axios, { type AxiosError, type AxiosInstance } from "axios";

interface BinanceErrorResponse {
  code: number;
  msg: string;
}

export interface BinanceAccountConfig {
  apiKey: string;
  apiSecret: string;
  accountId?: string;
  label?: string;
}

export interface AveragePriceResponse {
  mins: number;
  price: string;
  closeTime: number;
}

export interface AssetBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface AccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: string;
  balances: AssetBalance[];
  permissions: string[];
}

export interface WalletBalance {
  walletName: string;
  activate: boolean;
  balance: string;
}

export class BinanceService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly apiClient: AxiosInstance;
  public readonly accountId?: string;
  public readonly label?: string;
  private readonly baseUrl = "https://api3.binance.com";

  constructor(config: BinanceAccountConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.accountId = config.accountId;
    this.label = config.label;

    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "X-MBX-APIKEY": this.apiKey,
      },
    });

    // Global error interceptor to handle API errors
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => this.handleApiError(error),
    );
  }

  /**
   * Creates an HMAC SHA256 signature from the given query string.
   */
  private createSignature(queryString: string): string {
    return crypto
      .createHmac("sha256", this.apiSecret)
      .update(queryString)
      .digest("hex");
  }

  /**
   * Handles errors coming from the Binance API.
   */
  private handleApiError(error: AxiosError<BinanceErrorResponse>): never {
    const errorMessage = error.response?.data?.msg || error.message;
    const errorCode = error.response?.status;

    switch (errorCode) {
      case 401:
        throw new Error(
          `Authentication failed for account ${this.label}. Please check your API credentials.`,
        );
      case 403:
        throw new Error("API key does not have the required permissions.");
      case 429:
        throw new Error("Rate limit exceeded. Please try again later.");
      case 418:
        throw new Error(
          "IP has been auto-banned for continuing to send requests after receiving 429 codes.",
        );
      case 404:
        throw new Error("The requested endpoint does not exist.");
      default:
        throw new Error(`Binance API Error (${errorCode}): ${errorMessage}`);
    }
  }

  /**
   * Fetches the current average price for the provided symbol.
   */
  async getAveragePrice(symbol: string): Promise<AveragePriceResponse> {
    try {
      const response = await this.apiClient.get("/api/v3/avgPrice", {
        params: { symbol },
      });
      return response.data;
    } catch (error: unknown) {
      throw new Error(
        `Failed to fetch average price for ${symbol}: ${(error as Error)?.message}`,
      );
    }
  }

  /**
   * Retrieves the funding wallet balances.
   * This is a signed endpoint that returns the total balance of the Funding wallet.
   */
  async getFundingWalletBalances(): Promise<AssetBalance[]> {
    try {
      const timestamp = Date.now();
      const queryParams = `timestamp=${timestamp}`;
      const signature = this.createSignature(queryParams);

      const response = await this.apiClient.get(
        `/sapi/v1/asset/wallet/balance`,
        {
          params: {
            timestamp,
            signature,
          },
        },
      );

      const fundingWallet = response.data.find(
        (wallet: WalletBalance) =>
          wallet.walletName === "Funding" && wallet.activate === true,
      );

      if (!fundingWallet) {
        console.log("No active Funding wallet found");
        return [];
      }
      return [
        {
          asset: "FUNDING_TOTAL",
          free: fundingWallet.balance,
          locked: "0",
        },
      ];
    } catch (error: unknown) {
      console.error("Error fetching funding wallet balances:", error);
      throw new Error(
        `Failed to fetch funding wallet balances: ${(error as Error)?.message}`,
      );
    }
  }

  /**
   * Retrieves the account information (signed endpoint) and returns balances with non-zero amounts.
   */
  async getWalletBalance(): Promise<AssetBalance[]> {
    try {
      const timestamp = Date.now();
      const queryParams = new URLSearchParams({
        timestamp: timestamp.toString(),
      }).toString();
      const signature = this.createSignature(queryParams);
      const finalQuery = `${queryParams}&signature=${signature}`;
      const response = await this.apiClient.get(
        `/sapi/v1/asset/wallet/balance?${finalQuery}`,
      );

      // The response is an array of wallet objects, not an AccountInfo object
      const wallets = response.data;

      if (!Array.isArray(wallets)) {
        console.error("Unexpected response format from Binance API:", wallets);
        throw new Error("Unexpected response format from Binance API");
      }

      const spotWallet = wallets.find((wallet) => wallet.walletName === "Spot");

      if (!spotWallet) {
        return [];
      }

      if (Number.parseFloat(spotWallet.balance) > 0) {
        return [
          {
            asset: "TOTAL",
            free: spotWallet.balance,
            locked: "0",
          },
        ];
      }

      return [];
    } catch (error: unknown) {
      console.error(`Failed to fetch wallet balance for ${this.label}:`, error);
      throw new Error(
        `Failed to fetch wallet balance: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Retrieves detailed account information including balances per asset.
   */
  async getAccountInfo(): Promise<AccountInfo> {
    try {
      const timestamp = Date.now();
      const queryParams = new URLSearchParams({
        timestamp: timestamp.toString(),
      }).toString();
      const signature = this.createSignature(queryParams);
      const finalQuery = `${queryParams}&signature=${signature}`;

      console.log(`Fetching account info for Binance account: ${this.label}`);
      const response = await this.apiClient.get(
        `/api/v3/account?${finalQuery}`,
      );

      const accountInfo = response.data as AccountInfo;

      return accountInfo;
    } catch (error: unknown) {
      console.error(`Failed to fetch account info for ${this.label}:`, error);
      throw new Error(
        `Failed to fetch account info: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Retrieves non-zero balances from the account.
   */
  async getNonZeroBalances(): Promise<AssetBalance[]> {
    try {
      const accountInfo = await this.getAccountInfo();

      const nonZeroBalances = accountInfo.balances.filter(
        (balance) =>
          Number.parseFloat(balance.free) > 0 ||
          Number.parseFloat(balance.locked) > 0,
      );

      return nonZeroBalances;
    } catch (error: unknown) {
      console.error(
        `Failed to fetch non-zero balances for ${this.label}:`,
        error,
      );
      throw new Error(
        `Failed to fetch non-zero balances: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Fetches multiple rate endpoints simultaneously.
   */
  async fetchAllRates(): Promise<{
    btcUsdt: AveragePriceResponse;
    btcNgn: AveragePriceResponse;
  }> {
    try {
      const [btcUsdt, btcNgn] = await Promise.all([
        this.getAveragePrice("BTCUSDT"),
        this.getAveragePrice("BTCNGN"),
      ]);
      return { btcUsdt, btcNgn };
    } catch (error: unknown) {
      throw new Error(`Failed to fetch rates: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieves all positive assets (Spot, Funding, etc) via getUserAsset.
   */
  async getUserAssets(asset?: string): Promise<AssetBalance[]> {
    const timestamp = Date.now();
    const params: Record<string, string | number | boolean> = { timestamp };
    if (asset) {
      params.asset = asset;
    }
    params.needBtcValuation = false;

    const queryString = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ).toString();
    const signature = this.createSignature(queryString);

    const response = await this.apiClient.post(
      "/sapi/v3/asset/getUserAsset",
      null,
      { params: { ...params, signature } },
    );

    const assets: { asset: string; free: string; locked: string }[] =
      response.data;

    return assets
      .filter(
        (a) => Number.parseFloat(a.free) > 0 || Number.parseFloat(a.locked) > 0,
      )
      .map((a) => ({
        asset: a.asset,
        free: a.free,
        locked: a.locked,
      }));
  }

  async getAvailableBalance(asset: string): Promise<{
    free: string;
    locked: string;
    total: string;
  }> {
    try {
      const timestamp = Date.now();
      const queryParams = asset
        ? `asset=${asset}&timestamp=${timestamp}`
        : `timestamp=${timestamp}`;
      const signature = this.createSignature(queryParams);

      const response = await this.apiClient.post(
        `/sapi/v3/asset/getUserAsset`,
        null,
        {
          params: {
            asset: asset || undefined,
            timestamp,
            signature,
          },
        },
      );

      if (Array.isArray(response.data)) {
        if (asset) {
          const assetBalance = response.data.find(
            (item) => item.asset === asset,
          );
          if (assetBalance) {
            const fmt = (s: string) => Number.parseFloat(s).toFixed(8);
            const free = fmt(assetBalance.free || "0");
            const locked = fmt(assetBalance.locked || "0");
            const total = fmt(
              (Number.parseFloat(free) + Number.parseFloat(locked)).toString(),
            );

            return { free, locked, total };
          }
        } else if (response.data.length > 0) {
          const assetBalance = response.data[0];
          const fmt = (s: string) => Number.parseFloat(s).toFixed(8);
          const free = fmt(assetBalance.free || "0");
          const locked = fmt(assetBalance.locked || "0");
          const total = fmt(
            (Number.parseFloat(free) + Number.parseFloat(locked)).toString(),
          );

          return { free, locked, total };
        }
      }
      return { free: "0", locked: "0", total: "0" };
    } catch (error: unknown) {
      console.error(
        `Failed to fetch funding wallet balance for ${asset}:`,
        error,
      );
      throw new Error(
        `Failed to fetch funding wallet balance: ${(error as Error).message}`,
      );
    }
  }
}
