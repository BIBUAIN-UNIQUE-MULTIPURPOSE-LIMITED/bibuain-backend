import dotenv from "dotenv";
import axios from "axios";
import { AxiosError } from "axios";

dotenv.config();

export interface NoonesServiceConfig {
  apiKey: string;
  apiSecret: string;
  accountId?: string;
  label?: string;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export interface NoonesApiResponse<T> {
  data: T;
  status: string;
  timestamp: number;
}

interface WalletBalance {
  currency: string;
  name: string;
  balance: number;
  type: "crypto" | "fiat";
}

export interface ChatMessage {
  message_id: string;
  sender: string;
  content: string;
  timestamp: number;
  success: boolean;
}

export class NoonesService {
  private apiKey: string;
  private apiSecret: string;
  private token: string | null = null;
  private tokenExpiry: number | null = null;
  private isInitialized: boolean = false;
  public accountId?: string;
  public label?: string;

  constructor(config: NoonesServiceConfig) {
    if (!config.apiKey || !config.apiSecret) {
      throw new Error("API credentials are required");
    }

    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.accountId = config.accountId;
    this.label = config.label;
  }

  private handleApiError(error: any): never {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || "An error occurred";

      console.error(`[${this.label}] API Error:`, {
        status,
        message,
        url: error.config?.url,
        method: error.config?.method,
      });

      switch (status) {
        case 401:
          this.token = null;
          this.tokenExpiry = null;
          this.isInitialized = false;
          throw new Error(`Authentication failed for account ${this.label}`);
        case 429:
          throw new Error(`Rate limit exceeded for account ${this.label}`);
        case 404:
          throw new Error(`Resource not found: ${error.config?.url}`);
        default:
          throw new Error(`API Error (${status}): ${message}`);
      }
    }
    throw new Error(`Network error: ${error.message}`);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.getAccessToken();
      this.isInitialized = true;
      // console.log(`[${this.label}] Service initialized successfully`);
    } catch (error) {
      this.isInitialized = false;
      console.error(`[${this.label}] Initialization failed:`, error);
      throw error;
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    try {
      const url = "https://auth.noones.com/oauth2/token";
      const headers = { "Content-Type": "application/x-www-form-urlencoded" };
      const params = new URLSearchParams();
      params.append("response", "text");
      params.append("client_id", this.apiKey);
      params.append("client_secret", this.apiSecret);
      params.append("grant_type", "client_credentials");

      // console.log(`[${this.label}] Making request to ${url}`);
      const response = await axios.post<TokenResponse>(url, params, {
        headers,
      });

      if (!response.data.access_token) {
        throw new Error("No access token received");
      }

      this.token = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      return this.token;
    } catch (error: any) {
      this.token = null;
      this.tokenExpiry = null;
      // console.log(`This is nooones Response`, error);
      throw new Error(`Failed to fetch access token: ${error.message}`);
    }
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    params: URLSearchParams = new URLSearchParams()
  ): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const token = await this.getAccessToken();
      const url = `https://api.noones.com${endpoint}`;

      // console.log(`[${this.label}] Making request to ${url}`);
      const response = await axios.post<NoonesApiResponse<T>>(url, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${token}`,
        },
      });

      // Add this debug log to see what the response contains
      // console.log(`[${this.label}] Response data:`, JSON.stringify(response.data));

      // Return the complete response data instead of just data.data
      return response.data;
    } catch (error) {
      return this.handleApiError(error as AxiosError);
    }
  }
  async getBitcoinPrice(): Promise<number> {
    try {
      const accessToken = await this.getAccessToken();
      const Btcparams = new URLSearchParams();
      Btcparams.append("response", "string");

      const response = await axios.post(
        "https://api.noones.com/noones/v1/currency/btc",
        Btcparams,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data.price;
    } catch (error) {
      console.error("Error fetching Bitcoin price:", error);
      throw new Error("Failed to fetch Bitcoin price");
    }
  }

  async getTradeDetails(tradeHash: string): Promise<any> {
    try {
      const params = new URLSearchParams({ trade_hash: tradeHash });
      const response = await this.makeAuthenticatedRequest<any>(
        "/noones/v1/trade/get",
        params
      );
      return response.data.trade;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch trade details for account ${this.label}: ${error.message}`
      );
    }
  }

  async listActiveTrades(): Promise<any[]> {
    try {
      const response = await this.makeAuthenticatedRequest<any>("/noones/v1/trade/list");
      console.log(response);
      return response.data?.trades;
    } catch (error: any) {
      throw new Error(
        `Failed to list active trades for account ${this.label}: ${error.message}`
      );
    }
  }


  async verifyCredentials(): Promise<boolean> {
    try {
      await this.initialize();
      return true;
    } catch (error) {
      return false;
    }
  }
  async getWalletBalances(): Promise<WalletBalance[]> {
    try {
      const response = await this.makeAuthenticatedRequest<any>("/noones/v1/user/wallet-balances");
      // console.log("Raw Noones API response:", JSON.stringify(response, null, 2));
  
      const balances: WalletBalance[] = [];
  
      // Extract data from the nested structure
      const data = response.data;
  
      // Add crypto currencies with null checks
      if (data?.cryptoCurrencies?.length) {
        data.cryptoCurrencies.forEach((crypto: any) => {
          balances.push({
            currency: crypto.code,
            name: crypto.name,
            balance: parseFloat(crypto.balance) || 0,
            type: "crypto",
          });
        });
      }
  
      // Add fiat currency with null checks
      if (data?.preferredFiatCurrency) {
        balances.push({
          currency: data.preferredFiatCurrency.code,
          name: data.preferredFiatCurrency.name,
          balance: parseFloat(data.preferredFiatCurrency.balance) || 0,
          type: "fiat",
        });
      }
  
      // console.log("Processed Noones balances:", JSON.stringify(balances, null, 2));
      return balances;
    } catch (error: any) {
      console.error(`Noones API error for ${this.label}:`, error);
      throw new Error(
        `Failed to fetch wallet balances for account ${this.label}: ${error.message}`
      );
    }
  }
  // Method to get trade chat history
  async getTradeChat(tradeHash: string): Promise<any> {
    try {
      const params = new URLSearchParams({
        trade_hash: tradeHash,
        limit: "50",
      });

      const response = await this.makeAuthenticatedRequest<{
        messages: ChatMessage[];
        attachments?: any[];
      }>("/noones/v1/trade-chat/get", params);

      // Log the response to debug
      // console.log('[Noones] Trade chat response:', response);

      // Return in the same format as Paxful
      return {
        messages: response.data.messages,
        attachments: response.data.attachments,
      };
    } catch (error: any) {
      console.error(`Failed to fetch trade chat for account ${this.label}:`, error);
      // Return empty arrays on error instead of throwing
      return {
        messages: [],
        attachments: []
      };
    }
  }

  // Method to send a chat message
  async sendTradeMessage(tradeHash: string, message: string): Promise<string> {
    try {
      const params = new URLSearchParams({
        trade_hash: tradeHash,
        message: message,
      });

      const response = await this.makeAuthenticatedRequest<{
        message: ChatMessage;
      }>("/noones/v1/trade-chat/post", params);
      console.log(response);

      if (response?.success) {
        return "Message Posted Successfully!";
      } else {
        return "Failed To send Message!";
      }
    } catch (error: any) {
      throw new Error(
        `Failed to send trade message for account ${this.label}: ${error.message}`
      );
    }
  }

  async markTradeAsPaid(tradeHash: string): Promise<boolean> {
    try {
        // First get the current trade status from Noones
        const tradeDetails = await this.getTradeDetails(tradeHash);
        
        // Check if trade is already completed
        if (tradeDetails.trade_status === 'completed' || tradeDetails.trade_status === 'paid') {
            return true; // Already paid, consider this a success
        }
        
        // Check if trade is in a terminal state
        if (['cancelled', 'expired', 'disputed', 'refunded'].includes(tradeDetails.trade_status)) {
            throw new Error(`Trade is in ${tradeDetails.status} state and cannot be marked as paid`);
        }

        // If trade is active, attempt to mark as paid
        const params = new URLSearchParams({ trade_hash: tradeHash });
        const response = await this.makeAuthenticatedRequest<{
            success: boolean;
            error?: { code: string; message: string };
        }>("/noones/v1/trade/paid", params);

        // Handle API response
        if (response.error) {
            throw new Error(response.error.message || 'Noones API returned error');
        }

        if (!response.success) {
            throw new Error('Noones API returned unsuccessful response');
        }

        return true;
    } catch (error: any) {
        // Handle HTTP errors
        if (error.response) {
            // Handle 404 - Trade not found
            if (error.response.status === 404) {
                throw new Error(`Trade ${tradeHash} not found - may have expired or been canceled`);
            }
            
            // Handle rate limiting
            if (error.response.status === 429) {
                throw new Error('Too many requests - please try again later');
            }
            
            // Handle other HTTP errors
            const errorData = error.response.data?.error || error.response.data;
            throw new Error(errorData?.message || `HTTP ${error.response.status} error`);
        }
        
        // Re-throw other errors
        throw error;
    }
}

  async getTransactionHistory(
    options: {
      currency?: string;
      type?: string;
      start_time?: number;
      end_time?: number;
      limit?: number;
    } = {}
  ): Promise<any[]> {
    try {
      const params = new URLSearchParams();

      if (options.currency) params.append("currency", options.currency);
      if (options.type) params.append("type", options.type);
      if (options.start_time)
        params.append("start_time", options.start_time.toString());
      if (options.end_time)
        params.append("end_time", options.end_time.toString());
      if (options.limit) params.append("limit", options.limit.toString());

      const response = await this.makeAuthenticatedRequest<{
        transactions: any[];
      }>("/noones/v1/wallet/transactions", params);

      if (!response.transactions) {
        console.warn(
          `[${this.label}] No transaction data in response:`,
          response
        );
        return [];
      }

      return response.transactions;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch transaction history for account ${this.label}: ${error.message}`
      );
    }
  }
  async listActiveOffers(offerType?: "buy" | "sell"): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      params.append("active", "true");
      if (offerType) {
        params.append("offer_type", offerType);
      }
  
      const response = await this.makeAuthenticatedRequest<any>(
        "/noones/v1/offer/list",
        params
      );
  
      // Handle different response structures
      if (response.data && Array.isArray(response.data.offers)) {
        return response.data.offers;
      } else if (Array.isArray(response.offers)) {
        return response.offers;
      } else if (Array.isArray(response)) {
        return response;
      }
  
      console.warn(`[${this.label}] No offers data in response:`, response);
      return [];
    } catch (error: any) {
      throw new Error(
        `Failed to list active offers for account ${this.label}: ${error.message}`
      );
    }
  }

  async getDeactivatedOffers(): Promise<any[]> {
    try {
      // For Noones service
      const params = new URLSearchParams();
      params.append("is_blocked", "true"); // Request inactive offers
      
      // Add any required parameters for the offer/all endpoint
      params.append("offer_type", "buy"); // Try using offer_type instead of type
      
      const response = await this.makeAuthenticatedRequest(
        "/noones/v1/offer/all",
        params
      );
      
      // console.log("Noones API full response:", JSON.stringify(response, null, 2));
    
      
      console.log("Deactivated offers Noones : ", response?.data?.offers.is_blocked)
      // Original check for offers
      if (response?.data?.offers) {
        return response.data.offers.filter((offer: any) => offer.is_blocked === true);
      }
      
      console.warn("No offers or trades found in Noones response:", response);
      return [];
    } catch (err: any) {
      console.error("Error fetching Noones deactivated offers:", err);
      throw new Error(`Failed to fetch Noones deactivated offers: ${err.message}`);
    }
  }

  async activateOffer(offerHash: string): Promise<any> {
    try {
      const params = new URLSearchParams();
      params.append('offer_hash', offerHash);
      const response = await this.makeAuthenticatedRequest("/noones/v1/offer/activate", params);
      console.log(`Activated Noones offer ${offerHash}:`, response);
      return response;
    } catch (error: any) {
      throw new Error(`Failed to activate Noones offer ${offerHash}: ${error.message}`);
    }
  }

  async turnOnAllOffers(): Promise<number> {
    try {
      const response = await this.makeAuthenticatedRequest<{
        count: number;
      }>("/noones/v1/offer/turn-on", new URLSearchParams());

      return response.count;
    } catch (error: any) {
      throw new Error(
        `Failed to turn off all offers for account ${this.label}: ${error.message}`
      );
    }
  }

  async updateOffer(offerHash: string, margin: number): Promise<any> {
    try {
      console.log(`[${this.label}] Updating Noones offer ${offerHash} with margin ${margin}`);
      const params = new URLSearchParams();
      params.append("offer_hash", offerHash);
      params.append("margin", margin.toString());
  
      const response = await this.makeAuthenticatedRequest<{
        status: string;
        data: { success: boolean };
      }>("/noones/v1/offer/update", params);
      
      console.log(`[${this.label}] Noones update response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${this.label}] Noones offer update failed:`, error);
      throw error;
    }
  }

  async turnOffAllOffers(): Promise<number> {
    try {
      const response = await this.makeAuthenticatedRequest<{
        count: number;
      }>("/noones/v1/offer/turn-off", new URLSearchParams());

      return response.count;
    } catch (error: any) {
      throw new Error(
        `Failed to turn off all offers for account ${this.label}: ${error.message}`
      );
    }
  }

  async getFeedbackStats(params: { username?: string; role?: "buyer" | "seller"; rating: number }): Promise<number> {
    try {
      const requestParams = new URLSearchParams();
      if (params.username) requestParams.append("username", params.username);
      if (params.role) requestParams.append("role", params.role);

      // Convert the 0 rating to -1 for negative feedback as per the API documentation
      const apiRating = params.rating === 0 ? -1 : params.rating;
      requestParams.append("rating", apiRating.toString());
      requestParams.append("page", "1");

      // console.log(`[noonesService] Making request for ${params.username} with rating ${apiRating}`);

      const response = await this.makeAuthenticatedRequest<any>(
        "/noones/v1/feedback/list",
        requestParams
      );

      // If the response is undefined, your makeAuthenticatedRequest may have issues
      if (response === undefined) {
        console.log("[noonesService] Response is undefined");
        return 0;
      }

      console.log('[noonesService] Full feedback response:', response);

      // Check different possible response structures
      if (response.data && typeof response.data.total_count === 'number') {
        return response.data.total_count;
      } else if (response.total_count !== undefined) {
        return response.total_count;
      } else if (response.data && Array.isArray(response.data.feedback)) {
        return response.data.feedback.length;
      } else if (Array.isArray(response.feedback)) {
        return response.feedback.length;
      }

      console.log('[noonesService] Unexpected response format:', response);
      return 0;
    } catch (error: any) {
      console.error('Error in Noones getFeedbackStats:', error.message);
      return 0;
    }
  }

  async getBitcoinPriceInNgn(): Promise<number> {
    try {
      const response = await this.makeAuthenticatedRequest<any>("/noones/v1/currency/list", new URLSearchParams());
      
      // Determine which property contains the currencies array
      let currencies;
      if (response.data && Array.isArray(response.data.currencies)) {
        currencies = response.data.currencies;
      } else if (Array.isArray(response.currencies)) {
        currencies = response.currencies;
      } else {
        console.error("Unexpected response structure:", JSON.stringify(response));
        throw new Error("Invalid response structure: currencies not found");
      }
      
      // Find NGN data
      const ngnData = currencies.find((cur: any) => {
        const currencyCode = 
          (cur.currency && cur.currency.toLowerCase()) || 
          (cur.code && cur.code.toLowerCase()) || 
          (cur.symbol && cur.symbol.toLowerCase()) || 
          '';
        
        return currencyCode === 'ngn' || 
               currencyCode === 'nigeria' || 
               currencyCode === 'naira' || 
               (cur.name && cur.name.toLowerCase().includes('nigeria'));
      });
      
      if (!ngnData) {
        // console.log("NGN not found in currencies list");
        throw new Error("NGN currency not found in the list");
      }
      
      // console.log("Found NGN data:", JSON.stringify(ngnData));
      
      // Extract the BTC rate directly from the rate object
      if (ngnData.rate && typeof ngnData.rate === 'object') {
        const btcRate = ngnData.rate.btc;
        if (btcRate) {
          return parseFloat(btcRate);
        }
      }
      
      // Fallback to calculating it
      const [btcPriceUsd, ngnRate] = await Promise.all([
        this.getBitcoinPrice(), 
        this.getNgnRate()
      ]);
      return btcPriceUsd * ngnRate;
    } catch (error) {
      console.error("Error fetching BTC/NGN rate from Noones:", error);
      throw new Error(`Failed to fetch BTC/NGN rate: ${error}`);
    }
  }
  
  async getUsdtPriceInNgn(): Promise<number> {
    // USDT is pegged to USD, so we just need the NGN rate
    try {
      return await this.getNgnRate();
    } catch (error) {
      console.error("Error fetching USDT/NGN rate from Noones:", error);
      throw new Error(`Failed to fetch USDT/NGN rate: ${error}`);
    }
  }

  async getNgnRate(): Promise<number> {
    try {
      const response = await this.makeAuthenticatedRequest<any>("/noones/v1/currency/list", new URLSearchParams());
      
      // Determine which property contains the currencies array
      let currencies;
      if (response.data && Array.isArray(response.data.currencies)) {
        currencies = response.data.currencies;
      } else if (Array.isArray(response.currencies)) {
        currencies = response.currencies;
      } else {
        console.error("Unexpected response structure:", JSON.stringify(response));
        throw new Error("Invalid response structure: currencies not found");
      }
      
      // Find NGN data
      const ngnData = currencies.find((cur: any) => {
        const currencyCode = 
          (cur.currency && cur.currency.toLowerCase()) || 
          (cur.code && cur.code.toLowerCase()) || 
          (cur.symbol && cur.symbol.toLowerCase()) || 
          '';
        
        return currencyCode === 'ngn' || 
               currencyCode === 'nigeria' || 
               currencyCode === 'naira' || 
               (cur.name && cur.name.toLowerCase().includes('nigeria'));
      });
      
      if (!ngnData) {
        // console.log("NGN not found in currencies list");
        throw new Error("NGN currency not found in the list");
      }
      
      // console.log("Found NGN data:", JSON.stringify(ngnData));
      
      // Extract the USDT rate from the rate object
      if (ngnData.rate && typeof ngnData.rate === 'object') {
        // For USDT/NGN, we want the USDT rate
        const usdtRate = ngnData.rate.usdt;
        if (usdtRate) {
          return parseFloat(usdtRate);
        }
      }
      
      // Fallback to USD rate if USDT is not available
      if (ngnData.rate && typeof ngnData.rate === 'object') {
        const usdRate = ngnData.rate.usd;
        if (usdRate) {
          return parseFloat(usdRate);
        }
      }
      
      console.error("USDT/USD rate not found in NGN data:", ngnData);
      throw new Error("NGN USDT/USD rate not found");
    } catch (error) {
      console.error("Error fetching NGN rate from Noones:", error);
      throw new Error(`Failed to fetch NGN rate: ${error}`);
    }
  }

  async listCompletedTrades(page: number = 1): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      // Assuming Noones exposes a similar endpoint as Paxful for completed trades.
      const response = await this.makeAuthenticatedRequest<any>("/noones/v1/trade/completed", params);
      if (!response.trades) {
        console.warn(`[${this.label}] No completed trades data found:`, response);
        return [];
      }
      return response.trades;
    } catch (error: any) {
      throw new Error(`Failed to list completed trades for account ${this.label}: ${error.message}`);
    }
  }

  async cancelTrade(tradeHash: string): Promise<boolean> {
    try {
      // Create params with the trade hash
      const params = new URLSearchParams();
      params.append("trade_hash", tradeHash);
      
      // Make the API request
      const response = await this.makeAuthenticatedRequest<{
        success: boolean;
        error?: { code: string; message: string };
      }>("/noones/v1/trade/cancel", params);
  
      // Check for API errors in the response
      if (response.error) {
        throw new Error(response.error.message || 'Noones API returned error');
      }
  
      // Check for success indicator in response
      if (response.data && response.data.success === true) {
        return true;
      } else if (response.success === true) {
        return true;
      }
  
      // If we couldn't confirm success, throw an error
      throw new Error('Trade cancellation failed - API did not confirm success');
    } catch (error: any) {
      // Handle HTTP errors
      if (error.response) {
        // Handle 404 - Trade not found
        if (error.response.status === 404) {
          throw new Error(`Trade ${tradeHash} not found - may have expired or been canceled already`);
        }
        
        // Handle rate limiting
        if (error.response.status === 429) {
          throw new Error('Too many requests - please try again later');
        }
        
        // Handle other HTTP errors
        const errorData = error.response.data?.error || error.response.data;
        throw new Error(errorData?.message || `HTTP ${error.response.status} error`);
      }
      
      // Re-throw with context
      throw new Error(
        `Failed to cancel trade for account ${this.label}: ${error.message}`
      );
    }
  }

  async createOffer(params: any) {
    const {
      tags,
      margin,
      currency,
      flow_type,
      offer_cap,
      duty_hours,
      custom_rate,
      fixed_price,
      location_id,
      offer_terms,
      bank_accounts,
      is_fixed_price,
      payment_method,
      payment_window,
      crypto_currency = "usdt",
      payment_country,
      offer_type_field,
      predefined_amount,
      custom_rate_active,
      payment_method_group,
      payment_method_label,
      bank_reference_message,
      show_only_trusted_user,
      country_limitation_list,
      country_limitation_type,
      require_min_past_trades,
      custom_rate_fiat_currency,
      auto_share_vendor_payment_account,
    } = params;

    try {
      // Prepare the request body for offer creation
      const requestParams = new URLSearchParams();
      requestParams.append("tags", tags);
      requestParams.append("margin", margin.toString());
      requestParams.append("currency", currency);
      requestParams.append(
        "offer_cap[range_max]",
        offer_cap.range_max.toString()
      );
      requestParams.append(
        "offer_cap[range_min]",
        offer_cap.range_min.toString()
      );
      requestParams.append("offer_terms", offer_terms);
      requestParams.append("payment_method", payment_method);
      requestParams.append("payment_window", payment_window.toString());
      requestParams.append("payment_country", payment_country);
      requestParams.append("offer_type_field", offer_type_field);

      // Optional fields
      if (flow_type) requestParams.append("flow_type", flow_type);
      if (duty_hours)
        requestParams.append("duty_hours", JSON.stringify(duty_hours));
      if (custom_rate !== undefined)
        requestParams.append("custom_rate", custom_rate.toString());
      if (fixed_price !== undefined)
        requestParams.append("fixed_price", fixed_price.toString());
      if (location_id)
        requestParams.append("location_id", location_id.toString());
      if (is_fixed_price) requestParams.append("is_fixed_price", "true");
      if (crypto_currency)
        requestParams.append("crypto_currency", crypto_currency);
      if (predefined_amount)
        requestParams.append("predefined_amount", predefined_amount);
      if (custom_rate_active !== undefined)
        requestParams.append(
          "custom_rate_active",
          custom_rate_active.toString()
        );
      if (payment_method_group)
        requestParams.append("payment_method_group", payment_method_group);
      if (payment_method_label)
        requestParams.append("payment_method_label", payment_method_label);
      if (bank_reference_message)
        requestParams.append(
          "bank_reference_message",
          JSON.stringify(bank_reference_message)
        );
      if (show_only_trusted_user !== undefined)
        requestParams.append(
          "show_only_trusted_user",
          show_only_trusted_user.toString()
        );
      if (country_limitation_list)
        requestParams.append(
          "country_limitation_list",
          country_limitation_list
        );
      if (country_limitation_type)
        requestParams.append(
          "country_limitation_type",
          country_limitation_type
        );
      if (require_min_past_trades)
        requestParams.append(
          "require_min_past_trades",
          require_min_past_trades.toString()
        );
      if (custom_rate_fiat_currency)
        requestParams.append(
          "custom_rate_fiat_currency",
          custom_rate_fiat_currency
        );
      if (auto_share_vendor_payment_account !== undefined)
        requestParams.append(
          "auto_share_vendor_payment_account",
          auto_share_vendor_payment_account.toString()
        );

      // Make the request to create the offer
      const response = await this.makeAuthenticatedRequest<any>(
        "/noones/v1/offer/create",
        requestParams
      );
      // console.log(response);
      if (response?.offer_hash) {
        return {
          success: true,
          offer_hash: response.offer_hash,
        };
      } else {
        throw new Error("Failed to create the offer");
      }
    } catch (error: any) {
      console.error("Error creating offer:", error);
      throw new Error(`Failed to create offer: ${error.message}`);
    }
  }
}
