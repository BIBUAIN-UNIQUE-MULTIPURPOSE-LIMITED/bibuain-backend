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

  async getFundingWalletBalances(): Promise<AssetBalance[]> {
    try {
      const timestamp = Date.now();
      const queryParams = `timestamp=${timestamp}`;
      const signature = this.createSignature(queryParams);
  
      const response = await this.apiClient.get(`/sapi/v1/asset/wallet/balance`, {
        params: {
          timestamp,
          signature
        }
      });
  
      // Find the Funding wallet entry
      const fundingWallet = response.data.find((wallet: any) =>
        wallet.walletName === 'Funding' && wallet.activate === true
      );
  
      if (!fundingWallet) {
        console.log('No active Funding wallet found');
        return [];
      }
  
      // Return the funding wallet balance as a single total
      // Since this endpoint doesn't provide per-asset balances
      return [{
        asset: 'FUNDING_TOTAL',
        free: fundingWallet.balance,
        locked: '0' 
      }];
  
    } catch (error: any) {
      console.error('Error fetching funding wallet balances:', error);
      throw new Error(`Failed to fetch funding wallet balances: ${error.message}`);
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

      console.log(`Fetching wallet balance for Binance account: ${this.label}`);
      const response = await this.apiClient.get(
        `/sapi/v1/asset/wallet/balance?${finalQuery}`
      );

      console.log("Binance API response status:", response.status);

      // The response is an array of wallet objects, not an AccountInfo object
      const wallets = response.data;

      if (!Array.isArray(wallets)) {
        console.error('Unexpected response format from Binance API:', wallets);
        throw new Error('Unexpected response format from Binance API');
      }

      console.log(`Received ${wallets.length} wallet entries from Binance`);

      // Find the Spot wallet
      const spotWallet = wallets.find(wallet => wallet.walletName === 'Spot');

      if (!spotWallet) {
        console.log('No Spot wallet found');
        return [];
      }

      // Since the wallet balance endpoint doesn't provide per-asset balances,
      // we need to call another endpoint to get detailed account information
      // For now, we'll create a placeholder asset balance

      // To get actual asset balances, you should use the /api/v3/account endpoint
      // You would need to implement getAccountInfo() method separately

      if (parseFloat(spotWallet.balance) > 0) {
        return [{
          asset: 'TOTAL', // This is a placeholder. You should call getAccountInfo for detailed balances
          free: spotWallet.balance,
          locked: '0' // This endpoint doesn't provide locked balance separately
        }];
      }

      return [];
    } catch (error: any) {
      console.error(`Failed to fetch wallet balance for ${this.label}:`, error);
      throw new Error(`Failed to fetch wallet balance: ${error.message}`);
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
        `/api/v3/account?${finalQuery}`
      );

      const accountInfo = response.data as AccountInfo;

      return accountInfo;
    } catch (error: any) {
      console.error(`Failed to fetch account info for ${this.label}:`, error);
      throw new Error(`Failed to fetch account info: ${error.message}`);
    }
  }

  /**
   * Retrieves non-zero balances from the account.
   */
  async getNonZeroBalances(): Promise<AssetBalance[]> {
    try {
      const accountInfo = await this.getAccountInfo();

      const nonZeroBalances = accountInfo.balances.filter(
        (balance) => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0
      );

      console.log(`Found ${nonZeroBalances.length} non-zero balances`);
      return nonZeroBalances;
    } catch (error: any) {
      console.error(`Failed to fetch non-zero balances for ${this.label}:`, error);
      throw new Error(`Failed to fetch non-zero balances: ${error.message}`);
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
 * Retrieves all positive assets (Spot, Funding, etc) via getUserAsset.
 */
async getUserAssets(asset?: string): Promise<AssetBalance[]> {
  const timestamp = Date.now();
  const params: Record<string, any> = { timestamp };
  if (asset) {
    params.asset = asset;
  }
  // optionally include BTC valuation
  params.needBtcValuation = false;

  // signature covers all params
  const queryString = new URLSearchParams(params).toString();
  const signature = this.createSignature(queryString);

  const response = await this.apiClient.post(
    '/sapi/v3/asset/getUserAsset',
    null,
    { params: { ...params, signature } }
  );

  // response.data is an array of { asset, free, locked, … }
  const assets: any[] = response.data;

  // filter out zero balances and map to your AssetBalance type
  return assets
    .filter(a => parseFloat(a.free) > 0 || parseFloat(a.locked) > 0)
    .map(a => ({
      asset:  a.asset,
      free:   a.free,
      locked: a.locked,
    }));
}


  async getAvailableBalance(asset: string): Promise<{
    free: string;
    locked: string;
    total: string;
  }> {
    try {
      // Use the funding asset endpoint with POST method
      const timestamp = Date.now();
      const queryParams = asset ? `asset=${asset}&timestamp=${timestamp}` : `timestamp=${timestamp}`;
      const signature = this.createSignature(queryParams);
  
      const response = await this.apiClient.post(`/sapi/v3/asset/getUserAsset`, null, {
        params: {
          asset: asset || undefined, // Only include if not empty
          timestamp,
          signature
        }
      });
  
      // Log the response for debugging
      console.log(`Funding asset response for ${asset || 'all assets'}:`, JSON.stringify(response.data));
  
      // Check if we have valid data
      if (Array.isArray(response.data)) {
        // If asset was specified, find that specific asset
        if (asset) {
          const assetBalance = response.data.find(item => item.asset === asset);
          if (assetBalance) {
            const fmt = (s: string) => parseFloat(s).toFixed(8);
            const free = fmt(assetBalance.free || '0');
            const locked = fmt(assetBalance.locked || '0');
            const total = fmt((parseFloat(free) + parseFloat(locked)).toString());
            
            return { free, locked, total };
          }
        } 
        // If no specific asset was requested or asset wasn't found, 
        // return first asset in response (if available)
        else if (response.data.length > 0) {
          const assetBalance = response.data[0];
          const fmt = (s: string) => parseFloat(s).toFixed(8);
          const free = fmt(assetBalance.free || '0');
          const locked = fmt(assetBalance.locked || '0');
          const total = fmt((parseFloat(free) + parseFloat(locked)).toString());
          
          return { free, locked, total };
        }
      }
  
      // If no funding wallet balance found for this asset, return zeros
      return { free: "0", locked: "0", total: "0" };
  
    } catch (error: any) {
      console.error(`Failed to fetch funding wallet balance for ${asset}:`, error);
      // Log the full error for debugging
      console.error('Error details:', error.response?.data || error.message);
      // Return zeros on error instead of throwing
      return { free: "0", locked: "0", total: "0" };
    }
  }
}
