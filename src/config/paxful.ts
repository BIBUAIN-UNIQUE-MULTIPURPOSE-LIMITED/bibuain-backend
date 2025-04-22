import crypto from "crypto";
import { PaxfulApi } from "@paxful/sdk-js/dist/PaxfulApi.js";
import usePaxful from "@paxful/sdk-js";

export interface PaxfulAccountConfig {
  clientId: string;
  clientSecret: string;
  accountId?: string;
  label?: string;
}

export interface TradeMessage {
  id: string;
  text: string;
  timestamp: number;
  sender: string;
}

export interface WalletTransaction {
  txid: string;
  type: string;
  amount: string;
  status: string;
  timestamp: number;
  currency: string;
}

export interface OfferDetails {
  id: string;
  type: string;
  currency: string;
  price: string;
  min_amount: string;
  max_amount: string;
  payment_method: string;
  status: string;
}

export class PaxfulService {
  private paxfulApi: PaxfulApi;
  public accountId?: string;
  public label?: string;

  constructor(config: PaxfulAccountConfig) {
    // console.log('Initializing PaxfulService with:', 
    //   {
    //   clientId: config.clientId ? 'PRESENT' : 'MISSING',
    //   clientIdLength: config.clientId?.length,
    //   clientSecretLength: config.clientSecret?.length,
    //   accountId: config.accountId,
    //   label: config.label
    // });

    if (!config.clientId || !config.clientSecret) {
      throw new Error("Client ID and secret are required for Paxful service");
    }

    this.paxfulApi = new PaxfulApi({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });
    this.accountId = config.accountId;
    this.label = config.label;
  }

  private async makeRequest(
    endpoint: string,
    data: Record<string, any> = {}
  ): Promise<any> {
    try {
      // console.log(`[${this.label}] Making request to ${endpoint}`);
      const response = await this.paxfulApi.invoke(endpoint, data);
      return response;
    } catch (error: any) {
      console.error(`[${this.label}] Request failed:`, {
        endpoint,
        
      });
      throw new Error(
        `Paxful API Error for account ${this.label}: ${error.message}`
      );
    }
  }

  // Add a new method for fetching trades from Paxful
  async listActiveTrades(): Promise<any[]> {
    try {
      // Use the correct endpoint for trades – adjust params as needed
      const response = await this.paxfulApi.invoke("/paxful/v1/trade/list", { active: true });

      // Adjust the check based on how Paxful returns the trades data
      if (!response.data?.trades) {
        console.warn(`[${this.label}] No trades data in response:`, response);
        return [];
      }

      return response.data.trades;
    } catch (error: any) {
      throw new Error(
        `Failed to list active trades for account ${this.label}: ${error.message}`
      );
    }
  }


  async getTradeDetails(tradeHash: string) {
    return await this.makeRequest("/paxful/v1/trade/get", {
      trade_hash: tradeHash,
    });
  }

  async markTradeAsPaid(tradeHash: string): Promise<boolean> {
    try {
        // First get the current trade status
        const tradeDetails = await this.getTradeDetails(tradeHash);
        
        // Check if trade is already completed
        if (tradeDetails.data?.trade_status === 'completed' || tradeDetails.data?.trade_status === 'paid') {
            return true; // Already paid, consider this a success
        }
        
        // Check if trade is in a terminal state
        if (['cancelled', 'expired', 'disputed'].includes(tradeDetails.data?.trade_status)) {
            throw new Error(`Trade is in ${tradeDetails.data.status} state and cannot be marked as paid`);
        }

        // If trade is active, attempt to mark as paid
        const response = await this.makeRequest("/paxful/v1/trade/paid", {
            trade_hash: tradeHash,
        });

        // Handle API response
        if (response.data?.status === 'error') {
            throw new Error(response.data.message || 'Paxful API returned error');
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


  async getBitcoinPrice(): Promise<number> {
    const paxfulApi = new PaxfulApi({
      clientId: "qdmuUssOPik1cCfGD3lxQjUu6EYzUoP2olFh4TGkormR0JBC",
      clientSecret: "qtyTukmnNSzbQv8UQJzsSglALTHWCukWcaJUjX8lGGAC8Ex3",
    });

    const paxfulRateResponse = await paxfulApi.invoke(
      "/paxful/v1/currency/btc",
      {}
    );
    return paxfulRateResponse.price;
  }

  async getWalletBalance(cryptoCurrency: string = 'BTC'): Promise<string> {
    const response = await this.makeRequest("/paxful/v1/wallet/balance", {
      crypto_currency_code: cryptoCurrency
    });
    return response.data.balance;
  }


  async getTradeChat(tradeHash: string): Promise<any> {
    try {
      const response = await this.makeRequest("/paxful/v1/trade-chat/get", {
        trade_hash: tradeHash,
      });
      console.log(response);
      return {
        messages: response.data.messages,
        attachments: response.data.attachments,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to fetch trade chat for account ${this.label}: ${error.message}`
      );
    }
  }

  async sendTradeMessage(
    tradeHash: string,
    message: string
  ): Promise<TradeMessage> {
    try {
      const response = await this.makeRequest("/paxful/v1/trade-chat/post", {
        trade_hash: tradeHash,
        message: message,
      });
      console.log(response);
      return response.data ? response.data.message : response.error.message;
    } catch (error: any) {
      throw new Error(
        `Failed to send trade message for account ${this.label}: ${error.message}`
      );
    }
  }

  async getTransactionHistory(
    options: {
      type?: string;
      limit?: number;
      offset?: number;
      currency?: string;
    } = {}
  ): Promise<WalletTransaction[]> {
    try {
      const response = await this.makeRequest(
        "/paxful/v1/wallet/transactions",
        options
      );
      return response.data.transactions;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch transaction history for account ${this.label}: ${error.message}`
      );
    }
  }

  async listOffers(
    params: {
      type?: "buy" | "sell";
      status?: "active" | "paused" | "closed";
      offset?: number;
      limit?: number;
    } = {}
  ): Promise<OfferDetails[]> {
    try {
      const response = await this.makeRequest("/paxful/v1/offer/list", params);
      return response.data.offers;
    } catch (error: any) {
      throw new Error(
        `Failed to list offers for account ${this.label}: ${error.message}`
      );
    }
  }

  async cancelTrade(tradeHash: string): Promise<boolean> {
    try {
      await this.makeRequest("/paxful/v1/trade/cancel", {
        trade_hash: tradeHash,
      });
      return true;
    } catch (error: any) {
      throw new Error(
        `Failed to cancel trade for account ${this.label}: ${error.message}`
      );
    }
  }

  async uploadTradeDocument(
    tradeHash: string,
    document: Buffer,
    filename: string
  ): Promise<{
    document_id: string;
    url: string;
  }> {
    try {
      const response = await this.makeRequest(
        "/paxful/v1/trade/document/upload",
        {
          trade_hash: tradeHash,
          document: document,
          filename: filename,
        }
      );
      return response.data.document;
    } catch (error: any) {
      throw new Error(
        `Failed to upload trade document for account ${this.label}: ${error.message}`
      );
    }
  }

  async getUserProfile(username: string): Promise<any> {
    try {
      const response = await this.makeRequest("/paxful/v1/user/info", {
        username: username,
      });
      return response.data.user;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch user profile for account ${this.label}: ${error.message}`
      );
    }
  }

  async getFeedback(
    params: {
      username?: string;
      type?: "received" | "given";
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<any[]> {
    try {
      const response = await this.makeRequest(
        "/paxful/v1/feedback/list",
        params
      );
      return response.data.feedback;
    } catch (error: any) {
      throw new Error(
        `Failed to fetch feedback for account ${this.label}: ${error.message}`
      );
    }
  }
  async listActiveOffers(offerType?: "buy" | "sell"): Promise<any[]> {
    try {
      const params: Record<string, any> = { active: true };
      if (offerType) {
        params.offer_type = offerType;
      }

      const response = await this.paxfulApi.invoke(
        "/paxful/v1/offer/list",
        params
      );

      if (!response.data?.offers) {
        console.warn(`[${this.label}] No offers data in response:`, response);
        return [];
      }

      return response.data.offers;
    } catch (error: any) {
      throw new Error(
        `Failed to list active offers for account ${this.label}: ${error.message}`
      );
    }
  }

  async getDeactivatedOffers(): Promise<any[]> {
    try {
      const params = {
        active: "false",
        offer_type: "buy" 
      };
      
      const response = await this.paxfulApi.invoke(
        "/paxful/v1/offer/all",
        params
      );
      
      // Check if we have a valid response with offers
      if (!response?.data?.offers) {
        console.warn("No offers found in Paxful response:", response);
        return [];
      }
      
      // Log is_blocked status for each offer
      response.data.offers.forEach((offer: any, index: number) => {
        // console.log(`Offer ${index} active status:`, offer.active);
      });
      
      // Alternatively, log the count of blocked offers
      const blockedOffers = response.data.offers.filter((offer: any) => offer.active === false);
      // console.log(`Found ${blockedOffers.length} blocked offers out of ${response.data.offers.length} total`);
      
      // Return all blocked offers
      return response.data.offers.filter((offer: any) => offer.active === false);
    } catch (err: any) {
      console.error("Error fetching Paxful deactivated offers:", err);
      throw new Error(`Failed to fetch Paxful deactivated offers: ${err.message}`);
    }
  }
  
 async getOfferDetails(offerHash: string): Promise<any> {
      console.log(`[PaxfulService] → getOfferDetails(${offerHash}) called`);
      try {
        const params = { offer_hash: offerHash };
        const response = await this.paxfulApi.invoke(
          "/paxful/v1/offer/get",
          params
        );
  
        // The wrapper returns:
        // { status: 'success', timestamp: ..., data: { id: ..., offer_hash: ..., … } }
        const offer = response?.data;
        if (!offer || typeof offer !== "object") {
          console.warn(
            "[PaxfulService] → No offer data found in Paxful response:",
            response
          );
          return null;
        }
  
        console.log(
          "[PaxfulService] → Retrieved offer details:",
          // you can JSON.stringify if you want a single‑line dump
          offer
        );
        return offer;
      } catch (err: any) {
        console.error("[PaxfulService] → Error in getOfferDetails:", err);
        throw new Error(`Failed to fetch offer details: ${err.message}`);
      }
    }
  

  async activateOffer(offerHash: string): Promise<any> {
    try {
      const params: Record<string, string> = { offer_hash: offerHash };
      const response = await this.paxfulApi.invoke("/paxful/v1/offer/activate", params);
      console.log(`Activated Paxful offer ${offerHash}:`, response);
      return response;
    } catch (error: any) {
      throw new Error(`Failed to activate Paxful offer ${offerHash}: ${error.message}`);
    }
  }

  async turnOnAllOffers(): Promise<number> {
    try {
      const response = await this.paxfulApi.invoke(
        "/paxful/v1/offer/turn-on",
        {}
      );
      console.log(response);
      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to turn off all offers for account ${this.label}: ${error.message}`
      );
    }
  }
  async updateOffer(offerId: string, margin: number): Promise<any> {
    try {
      console.log(`[${this.label}] Updating Paxful offer ${offerId} with margin ${margin}`);
      const response = await this.makeRequest("/paxful/v1/offer/update", {
        offer_hash: offerId,
        margin: margin,
      });
      console.log(`[${this.label}] Paxful update response:`, response);
      return response;
    } catch (error: any) {
      console.error(`[${this.label}] Paxful offer update failed:`, error);
      throw new Error(
        `Failed to update offer for account ${this.label}: ${error.message}`
      );
    }
  }
  async turnOffAllOffers(): Promise<number> {
    try {
      const response = await this.paxfulApi.invoke(
        "/paxful/v1/offer/turn-off",
        {}
      );
      console.log(response);
      return response.data;
    } catch (error: any) {
      throw new Error(
        `Failed to turn off all offers for account ${this.label}: ${error.message}`
      );
    }
  }

  async getBitcoinPriceInNgn(): Promise<number> {
    try {
      // Get BTC price in USD
      const btcUsdResponse = await this.makeRequest("/paxful/v1/currency/btc", {});
      if (!btcUsdResponse?.price) {
        throw new Error("Invalid BTC price response");
      }

      const btcPriceUsd = parseFloat(btcUsdResponse.price);

      // Get NGN rate
      const listResponse = await this.makeRequest("/paxful/v1/currency/list", {});
      if (listResponse?.data?.currencies) {
        const ngnData = listResponse.data.currencies.find(
          (cur: any) => cur.code.toLowerCase() === "ngn"
        );

        if (ngnData?.rate?.usd) {
          return btcPriceUsd * parseFloat(ngnData.rate.usd);
        }
      }
      throw new Error("NGN rate not found in response");
    } catch (error) {
      console.error("Error fetching BTC/NGN rate from Paxful:", error);
      throw new Error(`Failed to fetch BTC/NGN rate: ${error}`);
    }
  }

  async getUsdtPriceInNgn(): Promise<number> {
    try {
      const listResponse = await this.makeRequest("/paxful/v1/currency/list", {});
      if (listResponse?.data?.currencies) {
        const ngnData = listResponse.data.currencies.find(
          (cur: any) => cur.code.toLowerCase() === "ngn"
        );

        if (ngnData?.rate?.usdt) {
          return parseFloat(ngnData.rate.usdt);
        }
        // Fallback to USD rate if USDT rate not available
        if (ngnData?.rate?.usd) {
          return parseFloat(ngnData.rate.usd);
        }
      }
      throw new Error("USDT/NGN rate not found");
    } catch (error) {
      console.error("Error fetching USDT/NGN rate from Paxful:", error);
      throw new Error(`Failed to fetch USDT/NGN rate: ${error}`);
    }
  }
  async getFeedbackStats(params: { username?: string; role?: "buyer" | "seller"; rating: number }): Promise<number> {
    try {
      // Convert the 0 rating to -1 for negative feedback as per the API documentation
      const apiRating = params.rating === 0 ? -1 : params.rating;

      // console.log(`[paxfulService] Making request for ${params.username} with rating ${apiRating}`);

      const requestParams = {
        username: params.username,
        role: params.role,
        rating: apiRating,
        page: 1,
      };

      // console.log(`[paxfulService] Request params:`, requestParams);

      const response = await this.makeRequest("/paxful/v1/feedback/list", requestParams);

      // Log the full response for debugging
      console.log(`[paxfulService] Full response for ${params.username}:`, JSON.stringify(response));

      // Check for errors in the response
      if (response && response.status === 'error') {
        console.log(`[paxfulService] API returned error: ${response.error?.message || 'Unknown error'}`);
        return 0;
      }

      // Check different possible response formats
      if (response && response.data && typeof response.data.total_count === 'number') {
        return response.data.total_count;
      } else if (response.total_count !== undefined) {
        return response.total_count;
      } else if (response.data && Array.isArray(response.data.feedback)) {
        return response.data.feedback.length;
      } else if (Array.isArray(response.feedback)) {
        return response.feedback.length;
      }

      console.log('[paxfulService] Unexpected response format:', response);
      return 0;
    } catch (error: any) {
      console.error('Error in Paxful getFeedbackStats:', error.message);
      return 0;
    }
  }

  async listCompletedTrades(page: number = 1): Promise<any[]> {
    try {
      const response = await this.makeRequest("/paxful/v1/trade/completed", { page });
      if (!response.data?.trades) {
        console.warn(`[${this.label}] No completed trades data found. Response:`, response);
        return [];
      }
      return response.data.trades;
    } catch (error: any) {
      throw new Error(`Failed to list completed trades for account ${this.label}: ${error.message}`);
    }
  }


  async createOffer(params: any) {
    try {
      const requestParams: Record<string, any> = {
        type: params.type,
        margin: params.margin,
        currency: params.currency,
        min_amount: params.min_amount,
        max_amount: params.max_amount,
        payment_method: params.payment_method,
        payment_window: params.payment_window,
        offer_terms: params.offer_terms,
        crypto_currency: params.crypto_currency || "usdt",
      };

      if (params.price !== undefined) {
        requestParams.fixed_price = params.price;
        requestParams.is_fixed_price = true;
      }

      if (params.country) requestParams.country = params.country;

      // console.log(`[${this.label}] Creating Paxful offer...`);

      const response = await this.makeRequest(
        "/paxful/v1/offer/create",
        requestParams
      );
      // console.log(response);
      return {
        success: true,
      };
    } catch (error: any) {
      console.error("Error creating Paxful offer:", error);
      throw new Error(`Failed to create offer: ${error.message}`);
    }
  }
}


const apiConfig: PaxfulAccountConfig = {
  clientId:
    process.env.PAXFUL_CLIENT_ID ||
    "L4HJDA4ic91JwsWLkQCDeZkue7TH4jmpn4kyKUuKkRSUdCF3",
  clientSecret:
    process.env.PAXFUL_CLIENT_SECRET ||
    "5lVWlN54pPhnrqWkU8mqv1P2ExEpadN7LuQ4RiIKQtF36nk2",
};

const paxfulService = new PaxfulService(apiConfig);

export const fetchPaxfulTrades = async () => paxfulService.listActiveTrades();
export const getPaxfulTradeDetails = async (tradeHash: string) =>
  paxfulService.getTradeDetails(tradeHash);

export default paxfulService;
