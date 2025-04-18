import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { SimpleConsoleLogger } from "typeorm";

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
      (error) => this.handleApiError(error)
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
  private handleApiError(error: any): never {
    const errorMessage = error.response?.data?.msg || error.message;
    const errorCode = error.response?.status;

    switch (errorCode) {
      case 401:
        throw new Error(
          `Authentication failed for account ${this.label}. Please check your API credentials.`
        );
      case 403:
        throw new Error("API key does not have the required permissions.");
      case 429:
        throw new Error("Rate limit exceeded. Please try again later.");
      case 418:
        throw new Error(
          "IP has been auto-banned for continuing to send requests after receiving 429 codes."
        );
      case 404:
        throw new Error("The requested endpoint does not exist.");
      default:
        throw new Error(`Binance API Error (${errorCode}): ${errorMessage}`);
    }
  }

  /**
   * Fetches the current average price for the provided symbol.
   * (This is a public endpoint so no signature is required.)
   */
  async getAveragePrice(symbol: string): Promise<AveragePriceResponse> {
    try {
      const response = await this.apiClient.get("/api/v3/avgPrice", {
        params: { symbol },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch average price for ${symbol}: ${error.message}`
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
        `/api/v3/account?${finalQuery}`
      );
      const accountInfo = response.data as AccountInfo;
      return accountInfo.balances.filter(
        (balance) =>
          parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0
      );
    } catch (error: any) {
      throw new Error(`Failed to fetch wallet balance: ${error.message}`);
    }
  }

  /**
   * Retrieves the total BTC balance (free + locked).
   */
  async getBTCBalance(): Promise<string> {
    try {
      const balances = await this.getWalletBalance();
      const btcBalance = balances.find((b) => b.asset === "BTC");
      if (!btcBalance) return "0";

      const total = (
        parseFloat(btcBalance.free) + parseFloat(btcBalance.locked)
      ).toString();
      return total;
    } catch (error: any) {
      throw new Error(`Failed to fetch BTC balance: ${error.message}`);
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
    } catch (error: any) {
      throw new Error(`Failed to fetch rates: ${error.message}`);
    }
  }

  /**
   * Returns the available balance for a given asset.
   */
  async getAvailableBalance(asset: string): Promise<{
    free: string;
    locked: string;
    total: string;
  }> {
    try {
      const balances = await this.getWalletBalance();
      const assetBalance = balances.find((b) => b.asset === asset);

      if (!assetBalance) {
        return { free: "0", locked: "0", total: "0" };
      }

      return {
        free: assetBalance.free,
        locked: assetBalance.locked,
        total: (
          parseFloat(assetBalance.free) + parseFloat(assetBalance.locked)
        ).toString(),
      };
    } catch (error: any) {
      throw new Error(`Failed to fetch ${asset} balance: ${error.message}`);
    }
  }
}
