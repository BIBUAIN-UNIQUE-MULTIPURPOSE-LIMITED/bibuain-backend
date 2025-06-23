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

export interface UserProfile {
  user: string;
}

export interface TradeChat {
  messages: string[];
  attachments: string[];
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
  private paxfulApi: any;
  public accountId?: string;
  public label?: string;

  constructor(config: PaxfulAccountConfig) {
    if (!config.clientId || !config.clientSecret) {
      throw new Error("Client ID and secret are required for Paxful service");
    }

    this.paxfulApi = usePaxful({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });

    this.accountId = config.accountId;
    this.label = config.label;
  }

  private async makeRequest(
    endpoint: string,
    data: Record<string, any> = {},
  ): Promise<any> {
    try {
      const response = await this.paxfulApi.invoke(endpoint, data);
      console.log(
        `[PaxfulService] Response from ${endpoint} for account ${this.label}:`,
        {
          status: response.status,
          data: response.data,
        },
      );
      return response;
    } catch (error: unknown) {
      console.error(`[${this.label}] Request failed:`, {
        endpoint,
        error: (error as Error).message,
      });
      throw new Error(
        `Paxful API Error for account ${this.label}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Lists active trades for the Paxful account.
   */
  async listActiveTrades(): Promise<any[]> {
    try {
      const response = await this.paxfulApi.invoke("/paxful/v1/trade/list", {
        active: true,
      });

      if (!response.data?.trades) {
        console.warn(`[${this.label}] No trades data in response:`, response);
        return [];
      }

      return response.data.trades;
    } catch (error: unknown) {
      throw new Error(
        `Failed to list active trades for account ${this.label}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Fetches details of a specific trade by its hash.
   * @param {string} tradeHash - The hash of the trade to fetch details for.
   */
  async getTradeDetails(tradeHash: string) {
    return await this.makeRequest("/paxful/v1/trade/get", {
      trade_hash: tradeHash,
    });
  }

  /**
   * Marks a trade as paid.
   * @param {string} tradeHash - The hash of the trade to mark as paid.
   * @returns {Promise<boolean>} - Returns true if the trade was successfully marked as paid.
   */
  async markTradeAsPaid(tradeHash: string): Promise<boolean> {
    try {
      const tradeDetails = await this.getTradeDetails(tradeHash);

      if (
        tradeDetails.data?.trade_status === "completed" ||
        tradeDetails.data?.trade_status === "paid"
      ) {
        return true;
      }
      if (
        ["cancelled", "expired", "disputed"].includes(
          tradeDetails.data?.trade_status,
        )
      ) {
        throw new Error(
          `Trade is in ${tradeDetails.data.status} state and cannot be marked as paid`,
        );
      }

      // If trade is active, attempt to mark as paid
      const response = await this.makeRequest("/paxful/v1/trade/paid", {
        trade_hash: tradeHash,
      });

      // Handle API response
      if (response.data?.status === "error") {
        throw new Error(response.data.message || "Paxful API returned error");
      }

      return true;
    } catch (error: unknown) {
      console.error(
        `[${this.label}] Error marking trade ${tradeHash} as paid:`,
        error,
      );
      throw new Error(`HTTP ${(error as Error).message} error`);
    }
  }

  /*
   * Fetches the current Bitcoin price from Paxful.
   * @returns {Promise<number>}
   * @throws {Error} If the API request fails or returns an error.
   */
  async getBitcoinPrice(): Promise<number> {
    const paxfulRateResponse = await this.makeRequest(
      "/paxful/v1/currency/btc",
      {},
    );
    return paxfulRateResponse.price;
  }

  /**
   * Fetches the current USDT price from Paxful.
   * @returns {Promise<number>}
   * @throws {Error} If the API request fails or returns an error.
   */
  async getWalletBalance(cryptoCurrency = "BTC"): Promise<string> {
    console.log(
      `[PaxfulService] Fetching ${cryptoCurrency} balance for account: ${this.label}`,
    );

    const response = await this.makeRequest("/paxful/v1/wallet/balance", {
      crypto_currency_code: cryptoCurrency,
    });
    console.log(
      `[PaxfulService] ${cryptoCurrency} balance for ${this.label}:`,
      response.data.balance,
    );
    return response.data.balance;
  }

  /**
   * Fetches the current USDT price from Paxful.
   * @returns {Promise<number>}
   * @throws {Error} If the API request fails or returns an error.
   */
  async getTradeChat(tradeHash: string): Promise<TradeChat> {
    try {
      const response = await this.makeRequest("/paxful/v1/trade-chat/get", {
        trade_hash: tradeHash,
      });

      return {
        messages: response.data.messages,
        attachments: response.data.attachments,
      };
    } catch (error: unknown) {
      throw new Error(
        `Failed to fetch trade chat for account ${this.label}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Sends a message in the trade chat.
   * @param {string} tradeHash - The hash of the trade to send the message in.
   * @param {string} message - The message to send.
   * @returns {Promise<TradeMessage>} - The sent trade message.
   * @throws {Error} If the API request fails or returns an error.
   */
  async sendTradeMessage(
    tradeHash: string,
    message: string,
  ): Promise<TradeMessage> {
    try {
      const response = await this.makeRequest("/paxful/v1/trade-chat/post", {
        trade_hash: tradeHash,
        message: message,
      });
      console.log(response);
      return response.data ? response.data.message : response.error.message;
    } catch (error: unknown) {
      throw new Error(
        `Failed to send trade message for account ${this.label}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Fetches the transaction history for the Paxful wallet.
   * @param {Object} options - Optional parameters for filtering the transaction history.
   * @param {string} options.type - The type of transactions to fetch (e.g., "deposit", "withdrawal").
   * @param {number} options.limit - The maximum number of transactions to return.
   * @param {number} options.offset - The offset for pagination.
   * @param {string} options.currency - The currency to filter transactions by.
   * @returns {Promise<WalletTransaction[]>} - The list of wallet transactions.
   * @throws {Error} If the API request fails or returns an error.
   */
  async getTransactionHistory(
    options: {
      type?: string;
      limit?: number;
      offset?: number;
      currency?: string;
    } = {},
  ): Promise<WalletTransaction[]> {
    try {
      const response = await this.makeRequest(
        "/paxful/v1/wallet/transactions",
        options,
      );
      return response.data.transactions;
    } catch (error: unknown) {
      throw new Error(
        `Failed to fetch transaction history for account ${this.label}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Lists offers for the Paxful account.
   * @param {Object} params - Optional parameters for filtering offers.
   * @param {string} params.type - The type of offers to list (e.g., "buy", "sell").
   * @param {string} params.status - The status of offers to list (e.g., "active", "paused", "closed").
   * @param {number} params.offset - The offset for pagination.
   * @param {number} params.limit - The maximum number of offers to return.
   * @returns {Promise<OfferDetails[]>} - The list of offer details.
   * @throws {Error} If the API request fails or returns an error.
   */
  async listOffers(
    params: {
      type?: "buy" | "sell";
      status?: "active" | "paused" | "closed";
      offset?: number;
      limit?: number;
    } = {},
  ): Promise<OfferDetails[]> {
    try {
      const response = await this.makeRequest("/paxful/v1/offer/list", params);
      return response.data.offers;
    } catch (error: unknown) {
      throw new Error(
        `Failed to list offers for account ${this.label}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Cancels a trade by its hash.
   * @param {string} tradeHash - The hash of the trade to cancel.
   * @returns {Promise<boolean>} - Returns true if the trade was successfully cancelled.
   * @throws {Error} If the API request fails or returns an error.
   */
  async cancelTrade(tradeHash: string): Promise<boolean> {
    try {
      await this.makeRequest("/paxful/v1/trade/cancel", {
        trade_hash: tradeHash,
      });
      return true;
    } catch (error: unknown) {
      throw new Error(
        `Failed to cancel trade for account ${this.label}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Uploads a document to a trade.
   * @param {string} tradeHash - The hash of the trade to upload the document to.
   * @param {Buffer} document - The document buffer to upload.
   * @param {string} filename - The name of the file being uploaded.
   * @returns {Promise<{document_id: string, url: string}>} - The uploaded document details.
   * @throws {Error} If the API request fails or returns an error.
   */
  async uploadTradeDocument(
    tradeHash: string,
    document: Buffer,
    filename: string,
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
        },
      );
      return response.data.document;
    } catch (error: unknown) {
      throw new Error(
        `Failed to upload trade document for account ${this.label}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Fetches the user profile for a given username.
   * @param {string} username - The username to fetch the profile for.
   * @returns {Promise<any>} - The user profile data.
   * @throws {Error} If the API request fails or returns an error.
   */
  async getUserProfile(username: string): Promise<UserProfile> {
    try {
      const response = await this.makeRequest("/paxful/v1/user/info", {
        username: username,
      });
      return response.data.user;
    } catch (error: unknown) {
      throw new Error(
        `Failed to fetch user profile for account ${this.label}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Fetches feedback for a given username.
   * @param {Object} params - Optional parameters for filtering feedback.
   * @param {string} params.username - The username to fetch feedback for.
   * @param {string} params.type - The type of feedback to fetch ("received" or "given").
   * @param {number} params.limit - The maximum number of feedback items to return.
   * @param {number} params.offset - The offset for pagination.
   * @returns {Promise<any[]>} - The list of feedback items.
   * @throws {Error} If the API request fails or returns an error.
   */
  async getFeedback(
    params: {
      username?: string;
      type?: "received" | "given";
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<any[]> {
    try {
      const response = await this.makeRequest(
        "/paxful/v1/feedback/list",
        params,
      );
      return response.data.feedback;
    } catch (error: unknown) {
      throw new Error(
        `Failed to fetch feedback for account ${this.label}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Lists active offers for the Paxful account.
   * @param {string} offerType - The type of offers to list ("buy" or "sell").
   * @returns {Promise<any[]>} - The list of active offers.
   * @throws {Error} If the API request fails or returns an error.
   */
  async listActiveOffers(offerType?: "buy" | "sell"): Promise<any[]> {
    try {
      const params: Record<string, any> = { active: true };
      if (offerType) {
        params.offer_type = offerType;
      }

      const response = await this.paxfulApi.invoke(
        "/paxful/v1/offer/list",
        params,
      );

      if (!response.data?.offers) {
        console.warn(`[${this.label}] No offers data in response:`, response);
        return [];
      }

      return response.data.offers;
    } catch (error: unknown) {
      throw new Error(
        `Failed to list active offers for account ${this.label}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Fetches deactivated offers for the Paxful account.
   * @returns {Promise<any[]>} - The list of deactivated offers.
   * @throws {Error} If the API request fails or returns an error.
   */
  async getDeactivatedOffers(): Promise<boolean[]> {
    try {
      const params = {
        active: "false",
        offer_type: "buy",
      };

      const response = await this.paxfulApi.invoke(
        "/paxful/v1/offer/all",
        params,
      );

      if (!response?.data?.offers) {
        console.warn("No offers found in Paxful response:", response);
        return [];
      }

      return response.data.offers.filter(
        (offer: { active: boolean }) => offer.active === false,
      );
    } catch (err: unknown) {
      console.error("Error fetching Paxful deactivated offers:", err);
      throw new Error(
        `Failed to fetch Paxful deactivated offers: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Fetches details of a specific offer by its hash.
   * @param {string} offerHash - The hash of the offer to fetch details for.
   * @returns {Promise<any>} - The offer details.
   * @throws {Error} If the API request fails or returns an error.
   */
  async getOfferDetails(offerHash: string): Promise<string | null> {
    try {
      const params = { offer_hash: offerHash };
      const response = await this.paxfulApi.invoke(
        "/paxful/v1/offer/get",
        params,
      );

      const offer = response?.data;
      if (!offer || typeof offer !== "object") {
        console.warn(
          "[PaxfulService] → No offer data found in Paxful response:",
          response,
        );
        return null;
      }

      return offer;
    } catch (err: unknown) {
      console.error("[PaxfulService] → Error in getOfferDetails:", err);
      throw new Error(
        `Failed to fetch offer details: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Activates a Paxful offer by its hash.
   * @param {string} offerHash - The hash of the offer to activate.
   * @returns {Promise<string>} - The response from the activation request.
   * @throws {Error} If the API request fails or returns an error.
   */
  async activateOffer(offerHash: string): Promise<string> {
    try {
      const params: Record<string, string> = { offer_hash: offerHash };
      const response = await this.paxfulApi.invoke(
        "/paxful/v1/offer/activate",
        params,
      );
      console.log(`Activated Paxful offer ${offerHash}:`, response);
      return response;
    } catch (error: unknown) {
      throw new Error(
        `Failed to activate Paxful offer ${offerHash}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Deactivates a Paxful offer by its hash.
   * @param {string} offerHash - The hash of the offer to deactivate.
   * @returns {Promise<string>} - The response from the deactivation request.
   * @throws {Error} If the API request fails or returns an error.
   */
  async turnOnAllOffers(): Promise<number> {
    try {
      const response = await this.paxfulApi.invoke(
        "/paxful/v1/offer/turn-on",
        {},
      );
      console.log(response);
      return response.data;
    } catch (error: unknown) {
      throw new Error(
        `Failed to turn off all offers for account ${this.label}: ${(error as Error).message}`,
      );
    }
  }

  /*
   * Updates a Paxful offer with a new margin.
   * @param {string} offerId - The ID of the offer to update.
   * @param {number} margin - The new margin to set for the offer.
   * @returns {Promise<string>} - The response from the update request.
   * @throws {Error} If the API request fails or returns an error.
   */
  async updateOffer(offerId: string, margin: number): Promise<string> {
    try {
      const response = await this.makeRequest("/paxful/v1/offer/update", {
        offer_hash: offerId,
        margin: margin,
      });
      return response;
    } catch (error: unknown) {
      console.error(`[${this.label}] Paxful offer update failed:`, error);
      throw new Error(
        `Failed to update offer for account ${this.label}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Turns off all offers for the Paxful account.
   * @returns {Promise<number>} - The number of offers turned off.
   * @throws {Error} If the API request fails or returns an error.
   */
  async turnOffAllOffers(): Promise<number> {
    try {
      const response = await this.paxfulApi.invoke(
        "/paxful/v1/offer/turn-off",
        {},
      );
      console.log(response);
      return response.data;
    } catch (error: unknown) {
      throw new Error(
        `Failed to turn off all offers for account ${this.label}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Fetches the current Bitcoin price in NGN (Nigerian Naira) from Paxful.
   * @returns {Promise<number>} - The Bitcoin price in NGN.
   * @throws {Error} If the API request fails or returns an error.
   */
  async getBitcoinPriceInNgn(): Promise<number> {
    try {
      const btcUsdResponse = await this.makeRequest(
        "/paxful/v1/currency/btc",
        {},
      );
      if (!btcUsdResponse?.price) {
        throw new Error("Invalid BTC price response");
      }

      const btcPriceUsd = Number.parseFloat(btcUsdResponse.price);

      // Get NGN rate
      const listResponse = await this.makeRequest(
        "/paxful/v1/currency/list",
        {},
      );
      if (listResponse?.data?.currencies) {
        const ngnData = listResponse.data.currencies.find(
          (cur: { code: string }) => cur.code.toLowerCase() === "ngn",
        );

        if (ngnData?.rate?.usd) {
          return btcPriceUsd * Number.parseFloat(ngnData.rate.usd);
        }
      }
      throw new Error("NGN rate not found in response");
    } catch (error) {
      console.error("Error fetching BTC/NGN rate from Paxful:", error);
      throw new Error(`Failed to fetch BTC/NGN rate: ${error}`);
    }
  }

  /**
   * Fetches the current USDT price in NGN (Nigerian Naira) from Paxful.
   * @returns {Promise<number>} - The USDT price in NGN.
   * @throws {Error} If the API request fails or returns an error.
   */
  async getUsdtPriceInNgn(): Promise<number> {
    try {
      const listResponse = await this.makeRequest(
        "/paxful/v1/currency/list",
        {},
      );
      if (listResponse?.data?.currencies) {
        const ngnData = listResponse.data.currencies.find(
          (cur: { code: string }) => cur.code.toLowerCase() === "ngn",
        );

        if (ngnData?.rate?.usdt) {
          return Number.parseFloat(ngnData.rate.usdt);
        }
        // Fallback to USD rate if USDT rate not available
        if (ngnData?.rate?.usd) {
          return Number.parseFloat(ngnData.rate.usd);
        }
      }
      throw new Error("USDT/NGN rate not found");
    } catch (error) {
      console.error("Error fetching USDT/NGN rate from Paxful:", error);
      throw new Error(`Failed to fetch USDT/NGN rate: ${error}`);
    }
  }

  /**
   * Fetches feedback statistics for a user based on their username, role, and rating.
   * @param {Object} params - Parameters for fetching feedback stats.
   * @param {string} params.username - The username to fetch feedback stats for.
   * @param {string} params.role - The role of the user ("buyer" or "seller").
   * @param {number} params.rating - The rating to filter feedback by (0 for negative, 1 for positive).
   * @returns {Promise<number>} - The total count of feedback matching the criteria.
   * @throws {Error} If the API request fails or returns an error.
   */
  async getFeedbackStats(params: {
    username?: string;
    role?: "buyer" | "seller";
    rating: number;
  }): Promise<number> {
    try {
      const apiRating = params.rating === 0 ? -1 : params.rating;
      const requestParams = {
        username: params.username,
        role: params.role,
        rating: apiRating,
        page: 1,
      };
      const response = await this.makeRequest(
        "/paxful/v1/feedback/list",
        requestParams,
      );

      if (response && response.status === "error") {
        console.log(
          `[paxfulService] API returned error: ${response.error?.message || "Unknown error"}`,
        );
        return 0;
      }

      // Check different possible response formats
      if (response?.data && typeof response.data.total_count === "number") {
        return response.data.total_count;
      } else if (response.total_count !== undefined) {
        return response.total_count;
      } else if (response.data && Array.isArray(response.data.feedback)) {
        return response.data.feedback.length;
      } else if (Array.isArray(response.feedback)) {
        return response.feedback.length;
      }

      console.log("[paxfulService] Unexpected response format:", response);
      return 0;
    } catch (error: unknown) {
      console.error(
        "Error in Paxful getFeedbackStats:",
        (error as Error).message,
      );
      return 0;
    }
  }

  async listCompletedTrades(page = 1): Promise<any[]> {
    try {
      const response = await this.makeRequest("/paxful/v1/trade/completed", {
        page,
      });
      if (!response.data?.trades) {
        console.warn(
          `[${this.label}] No completed trades data found. Response:`,
          response,
        );
        return [];
      }
      return response.data.trades;
    } catch (error: unknown) {
      throw new Error(
        `Failed to list completed trades for account ${this.label}: ${(error as Error).message}`,
      );
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

      const response = await this.makeRequest(
        "/paxful/v1/offer/create",
        requestParams,
      );
      return {
        offer_hash: response.data.offer_hash,
        message: response.data.message,
        offer_id: response.data.offer_id,
        success: true,
      };
    } catch (error: unknown) {
      console.error("Error creating Paxful offer:", error);
      throw new Error(`Failed to create offer: ${(error as Error).message}`);
    }
  }
}
