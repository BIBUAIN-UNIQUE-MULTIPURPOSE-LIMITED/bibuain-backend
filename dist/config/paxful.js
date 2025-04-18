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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaxfulTradeDetails = exports.fetchPaxfulTrades = exports.PaxfulService = void 0;
const PaxfulApi_js_1 = require("@paxful/sdk-js/dist/PaxfulApi.js");
class PaxfulService {
    constructor(config) {
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
        this.paxfulApi = new PaxfulApi_js_1.PaxfulApi({
            clientId: config.clientId,
            clientSecret: config.clientSecret,
        });
        this.accountId = config.accountId;
        this.label = config.label;
    }
    makeRequest(endpoint_1) {
        return __awaiter(this, arguments, void 0, function* (endpoint, data = {}) {
            try {
                // console.log(`[${this.label}] Making request to ${endpoint}`);
                const response = yield this.paxfulApi.invoke(endpoint, data);
                return response;
            }
            catch (error) {
                console.error(`[${this.label}] Request failed:`, {
                    endpoint,
                });
                throw new Error(`Paxful API Error for account ${this.label}: ${error.message}`);
            }
        });
    }
    // Add a new method for fetching trades from Paxful
    listActiveTrades() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Use the correct endpoint for trades – adjust params as needed
                const response = yield this.paxfulApi.invoke("/paxful/v1/trade/list", { active: true });
                // Adjust the check based on how Paxful returns the trades data
                if (!((_a = response.data) === null || _a === void 0 ? void 0 : _a.trades)) {
                    console.warn(`[${this.label}] No trades data in response:`, response);
                    return [];
                }
                return response.data.trades;
            }
            catch (error) {
                throw new Error(`Failed to list active trades for account ${this.label}: ${error.message}`);
            }
        });
    }
    getTradeDetails(tradeHash) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.makeRequest("/paxful/v1/trade/get", {
                trade_hash: tradeHash,
            });
        });
    }
    markTradeAsPaid(tradeHash) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            try {
                // First get the current trade status
                const tradeDetails = yield this.getTradeDetails(tradeHash);
                // Check if trade is already completed
                if (((_a = tradeDetails.data) === null || _a === void 0 ? void 0 : _a.trade_status) === 'completed' || ((_b = tradeDetails.data) === null || _b === void 0 ? void 0 : _b.trade_status) === 'paid') {
                    return true; // Already paid, consider this a success
                }
                // Check if trade is in a terminal state
                if (['cancelled', 'expired', 'disputed'].includes((_c = tradeDetails.data) === null || _c === void 0 ? void 0 : _c.trade_status)) {
                    throw new Error(`Trade is in ${tradeDetails.data.status} state and cannot be marked as paid`);
                }
                // If trade is active, attempt to mark as paid
                const response = yield this.makeRequest("/paxful/v1/trade/paid", {
                    trade_hash: tradeHash,
                });
                // Handle API response
                if (((_d = response.data) === null || _d === void 0 ? void 0 : _d.status) === 'error') {
                    throw new Error(response.data.message || 'Paxful API returned error');
                }
                return true;
            }
            catch (error) {
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
                    const errorData = ((_e = error.response.data) === null || _e === void 0 ? void 0 : _e.error) || error.response.data;
                    throw new Error((errorData === null || errorData === void 0 ? void 0 : errorData.message) || `HTTP ${error.response.status} error`);
                }
                // Re-throw other errors
                throw error;
            }
        });
    }
    getBitcoinPrice() {
        return __awaiter(this, void 0, void 0, function* () {
            const paxfulApi = new PaxfulApi_js_1.PaxfulApi({
                clientId: "qdmuUssOPik1cCfGD3lxQjUu6EYzUoP2olFh4TGkormR0JBC",
                clientSecret: "qtyTukmnNSzbQv8UQJzsSglALTHWCukWcaJUjX8lGGAC8Ex3",
            });
            const paxfulRateResponse = yield paxfulApi.invoke("/paxful/v1/currency/btc", {});
            return paxfulRateResponse.price;
        });
    }
    getWalletBalance() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.makeRequest("/paxful/v1/wallet/balance");
            return response.data.balance;
        });
    }
    getTradeChat(tradeHash) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.makeRequest("/paxful/v1/trade-chat/get", {
                    trade_hash: tradeHash,
                });
                console.log(response);
                return {
                    messages: response.data.messages,
                    attachments: response.data.attachments,
                };
            }
            catch (error) {
                throw new Error(`Failed to fetch trade chat for account ${this.label}: ${error.message}`);
            }
        });
    }
    sendTradeMessage(tradeHash, message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.makeRequest("/paxful/v1/trade-chat/post", {
                    trade_hash: tradeHash,
                    message: message,
                });
                console.log(response);
                return response.data ? response.data.message : response.error.message;
            }
            catch (error) {
                throw new Error(`Failed to send trade message for account ${this.label}: ${error.message}`);
            }
        });
    }
    getTransactionHistory() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            try {
                const response = yield this.makeRequest("/paxful/v1/wallet/transactions", options);
                return response.data.transactions;
            }
            catch (error) {
                throw new Error(`Failed to fetch transaction history for account ${this.label}: ${error.message}`);
            }
        });
    }
    listOffers() {
        return __awaiter(this, arguments, void 0, function* (params = {}) {
            try {
                const response = yield this.makeRequest("/paxful/v1/offer/list", params);
                return response.data.offers;
            }
            catch (error) {
                throw new Error(`Failed to list offers for account ${this.label}: ${error.message}`);
            }
        });
    }
    cancelTrade(tradeHash) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.makeRequest("/paxful/v1/trade/cancel", {
                    trade_hash: tradeHash,
                });
                return true;
            }
            catch (error) {
                throw new Error(`Failed to cancel trade for account ${this.label}: ${error.message}`);
            }
        });
    }
    uploadTradeDocument(tradeHash, document, filename) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.makeRequest("/paxful/v1/trade/document/upload", {
                    trade_hash: tradeHash,
                    document: document,
                    filename: filename,
                });
                return response.data.document;
            }
            catch (error) {
                throw new Error(`Failed to upload trade document for account ${this.label}: ${error.message}`);
            }
        });
    }
    getUserProfile(username) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.makeRequest("/paxful/v1/user/info", {
                    username: username,
                });
                return response.data.user;
            }
            catch (error) {
                throw new Error(`Failed to fetch user profile for account ${this.label}: ${error.message}`);
            }
        });
    }
    getFeedback() {
        return __awaiter(this, arguments, void 0, function* (params = {}) {
            try {
                const response = yield this.makeRequest("/paxful/v1/feedback/list", params);
                return response.data.feedback;
            }
            catch (error) {
                throw new Error(`Failed to fetch feedback for account ${this.label}: ${error.message}`);
            }
        });
    }
    listActiveOffers(offerType) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const params = { active: true };
                if (offerType) {
                    params.offer_type = offerType;
                }
                const response = yield this.paxfulApi.invoke("/paxful/v1/offer/list", params);
                if (!((_a = response.data) === null || _a === void 0 ? void 0 : _a.offers)) {
                    console.warn(`[${this.label}] No offers data in response:`, response);
                    return [];
                }
                return response.data.offers;
            }
            catch (error) {
                throw new Error(`Failed to list active offers for account ${this.label}: ${error.message}`);
            }
        });
    }
    getDeactivatedOffers() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const params = {
                    is_blocked: "true",
                    offer_type: "buy"
                };
                const response = yield this.paxfulApi.invoke("/paxful/v1/offer/all", params);
                // Check if we have a valid response with offers
                if (!((_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.offers)) {
                    console.warn("No offers found in Paxful response:", response);
                    return [];
                }
                // Log is_blocked status for each offer
                response.data.offers.forEach((offer, index) => {
                    console.log(`Offer ${index} is_blocked status:`, offer.is_blocked);
                });
                // Alternatively, log the count of blocked offers
                const blockedOffers = response.data.offers.filter((offer) => offer.is_blocked === true);
                console.log(`Found ${blockedOffers.length} blocked offers out of ${response.data.offers.length} total`);
                // Return all blocked offers
                return response.data.offers.filter((offer) => offer.is_blocked === true);
            }
            catch (err) {
                console.error("Error fetching Paxful deactivated offers:", err);
                throw new Error(`Failed to fetch Paxful deactivated offers: ${err.message}`);
            }
        });
    }
    getOfferDetails(offerHash) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[PaxfulService] → getOfferDetails(${offerHash}) called`);
            try {
                const params = { offer_hash: offerHash };
                const response = yield this.paxfulApi.invoke("/paxful/v1/offer/get", params);
                // The wrapper returns:
                // { status: 'success', timestamp: ..., data: { id: ..., offer_hash: ..., … } }
                const offer = response === null || response === void 0 ? void 0 : response.data;
                if (!offer || typeof offer !== "object") {
                    console.warn("[PaxfulService] → No offer data found in Paxful response:", response);
                    return null;
                }
                console.log("[PaxfulService] → Retrieved offer details:", 
                // you can JSON.stringify if you want a single‑line dump
                offer);
                return offer;
            }
            catch (err) {
                console.error("[PaxfulService] → Error in getOfferDetails:", err);
                throw new Error(`Failed to fetch offer details: ${err.message}`);
            }
        });
    }
    activateOffer(offerHash) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const params = { offer_hash: offerHash };
                const response = yield this.paxfulApi.invoke("/paxful/v1/offer/activate", params);
                console.log(`Activated Paxful offer ${offerHash}:`, response);
                return response;
            }
            catch (error) {
                throw new Error(`Failed to activate Paxful offer ${offerHash}: ${error.message}`);
            }
        });
    }
    turnOnAllOffers() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.paxfulApi.invoke("/paxful/v1/offer/turn-on", {});
                console.log(response);
                return response.data;
            }
            catch (error) {
                throw new Error(`Failed to turn off all offers for account ${this.label}: ${error.message}`);
            }
        });
    }
    updateOffer(offerId, margin) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`[${this.label}] Updating Paxful offer ${offerId} with margin ${margin}`);
                const response = yield this.makeRequest("/paxful/v1/offer/update", {
                    offer_hash: offerId,
                    margin: margin,
                });
                console.log(`[${this.label}] Paxful update response:`, response);
                return response;
            }
            catch (error) {
                console.error(`[${this.label}] Paxful offer update failed:`, error);
                throw new Error(`Failed to update offer for account ${this.label}: ${error.message}`);
            }
        });
    }
    turnOffAllOffers() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.paxfulApi.invoke("/paxful/v1/offer/turn-off", {});
                console.log(response);
                return response.data;
            }
            catch (error) {
                throw new Error(`Failed to turn off all offers for account ${this.label}: ${error.message}`);
            }
        });
    }
    getBitcoinPriceInNgn() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                // Get BTC price in USD
                const btcUsdResponse = yield this.makeRequest("/paxful/v1/currency/btc", {});
                if (!(btcUsdResponse === null || btcUsdResponse === void 0 ? void 0 : btcUsdResponse.price)) {
                    throw new Error("Invalid BTC price response");
                }
                const btcPriceUsd = parseFloat(btcUsdResponse.price);
                // Get NGN rate
                const listResponse = yield this.makeRequest("/paxful/v1/currency/list", {});
                if ((_a = listResponse === null || listResponse === void 0 ? void 0 : listResponse.data) === null || _a === void 0 ? void 0 : _a.currencies) {
                    const ngnData = listResponse.data.currencies.find((cur) => cur.code.toLowerCase() === "ngn");
                    if ((_b = ngnData === null || ngnData === void 0 ? void 0 : ngnData.rate) === null || _b === void 0 ? void 0 : _b.usd) {
                        return btcPriceUsd * parseFloat(ngnData.rate.usd);
                    }
                }
                throw new Error("NGN rate not found in response");
            }
            catch (error) {
                console.error("Error fetching BTC/NGN rate from Paxful:", error);
                throw new Error(`Failed to fetch BTC/NGN rate: ${error}`);
            }
        });
    }
    getUsdtPriceInNgn() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const listResponse = yield this.makeRequest("/paxful/v1/currency/list", {});
                if ((_a = listResponse === null || listResponse === void 0 ? void 0 : listResponse.data) === null || _a === void 0 ? void 0 : _a.currencies) {
                    const ngnData = listResponse.data.currencies.find((cur) => cur.code.toLowerCase() === "ngn");
                    if ((_b = ngnData === null || ngnData === void 0 ? void 0 : ngnData.rate) === null || _b === void 0 ? void 0 : _b.usdt) {
                        return parseFloat(ngnData.rate.usdt);
                    }
                    // Fallback to USD rate if USDT rate not available
                    if ((_c = ngnData === null || ngnData === void 0 ? void 0 : ngnData.rate) === null || _c === void 0 ? void 0 : _c.usd) {
                        return parseFloat(ngnData.rate.usd);
                    }
                }
                throw new Error("USDT/NGN rate not found");
            }
            catch (error) {
                console.error("Error fetching USDT/NGN rate from Paxful:", error);
                throw new Error(`Failed to fetch USDT/NGN rate: ${error}`);
            }
        });
    }
    getFeedbackStats(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
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
                const response = yield this.makeRequest("/paxful/v1/feedback/list", requestParams);
                // Log the full response for debugging
                console.log(`[paxfulService] Full response for ${params.username}:`, JSON.stringify(response));
                // Check for errors in the response
                if (response && response.status === 'error') {
                    console.log(`[paxfulService] API returned error: ${((_a = response.error) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error'}`);
                    return 0;
                }
                // Check different possible response formats
                if (response && response.data && typeof response.data.total_count === 'number') {
                    return response.data.total_count;
                }
                else if (response.total_count !== undefined) {
                    return response.total_count;
                }
                else if (response.data && Array.isArray(response.data.feedback)) {
                    return response.data.feedback.length;
                }
                else if (Array.isArray(response.feedback)) {
                    return response.feedback.length;
                }
                console.log('[paxfulService] Unexpected response format:', response);
                return 0;
            }
            catch (error) {
                console.error('Error in Paxful getFeedbackStats:', error.message);
                return 0;
            }
        });
    }
    listCompletedTrades() {
        return __awaiter(this, arguments, void 0, function* (page = 1) {
            var _a;
            try {
                const response = yield this.makeRequest("/paxful/v1/trade/completed", { page });
                if (!((_a = response.data) === null || _a === void 0 ? void 0 : _a.trades)) {
                    console.warn(`[${this.label}] No completed trades data found. Response:`, response);
                    return [];
                }
                return response.data.trades;
            }
            catch (error) {
                throw new Error(`Failed to list completed trades for account ${this.label}: ${error.message}`);
            }
        });
    }
    createOffer(params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const requestParams = {
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
                if (params.country)
                    requestParams.country = params.country;
                // console.log(`[${this.label}] Creating Paxful offer...`);
                const response = yield this.makeRequest("/paxful/v1/offer/create", requestParams);
                // console.log(response);
                return {
                    success: true,
                };
            }
            catch (error) {
                console.error("Error creating Paxful offer:", error);
                throw new Error(`Failed to create offer: ${error.message}`);
            }
        });
    }
}
exports.PaxfulService = PaxfulService;
const apiConfig = {
    clientId: process.env.PAXFUL_CLIENT_ID ||
        "L4HJDA4ic91JwsWLkQCDeZkue7TH4jmpn4kyKUuKkRSUdCF3",
    clientSecret: process.env.PAXFUL_CLIENT_SECRET ||
        "5lVWlN54pPhnrqWkU8mqv1P2ExEpadN7LuQ4RiIKQtF36nk2",
};
const paxfulService = new PaxfulService(apiConfig);
const fetchPaxfulTrades = () => __awaiter(void 0, void 0, void 0, function* () { return paxfulService.listActiveTrades(); });
exports.fetchPaxfulTrades = fetchPaxfulTrades;
const getPaxfulTradeDetails = (tradeHash) => __awaiter(void 0, void 0, void 0, function* () { return paxfulService.getTradeDetails(tradeHash); });
exports.getPaxfulTradeDetails = getPaxfulTradeDetails;
exports.default = paxfulService;
