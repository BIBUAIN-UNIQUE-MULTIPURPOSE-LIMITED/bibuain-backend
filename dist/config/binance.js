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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinanceService = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
class BinanceService {
    constructor(config) {
        this.baseUrl = "https://api3.binance.com";
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.accountId = config.accountId;
        this.label = config.label;
        this.apiClient = axios_1.default.create({
            baseURL: this.baseUrl,
            headers: {
                "X-MBX-APIKEY": this.apiKey,
            },
        });
        // Global error interceptor to handle API errors
        this.apiClient.interceptors.response.use((response) => response, (error) => this.handleApiError(error));
    }
    /**
     * Creates an HMAC SHA256 signature from the given query string.
     */
    createSignature(queryString) {
        return crypto_1.default
            .createHmac("sha256", this.apiSecret)
            .update(queryString)
            .digest("hex");
    }
    /**
     * Handles errors coming from the Binance API.
     */
    handleApiError(error) {
        var _a, _b, _c;
        const errorMessage = ((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.msg) || error.message;
        const errorCode = (_c = error.response) === null || _c === void 0 ? void 0 : _c.status;
        switch (errorCode) {
            case 401:
                throw new Error(`Authentication failed for account ${this.label}. Please check your API credentials.`);
            case 403:
                throw new Error("API key does not have the required permissions.");
            case 429:
                throw new Error("Rate limit exceeded. Please try again later.");
            case 418:
                throw new Error("IP has been auto-banned for continuing to send requests after receiving 429 codes.");
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
    getAveragePrice(symbol) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.apiClient.get("/api/v3/avgPrice", {
                    params: { symbol },
                });
                return response.data;
            }
            catch (error) {
                throw new Error(`Failed to fetch average price for ${symbol}: ${error.message}`);
            }
        });
    }
    /**
     * Retrieves the account information (signed endpoint) and returns balances with non-zero amounts.
     */
    getWalletBalance() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const timestamp = Date.now();
                const queryParams = new URLSearchParams({
                    timestamp: timestamp.toString(),
                }).toString();
                const signature = this.createSignature(queryParams);
                const finalQuery = `${queryParams}&signature=${signature}`;
                const response = yield this.apiClient.get(`/api/v3/account?${finalQuery}`);
                const accountInfo = response.data;
                return accountInfo.balances.filter((balance) => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0);
            }
            catch (error) {
                throw new Error(`Failed to fetch wallet balance: ${error.message}`);
            }
        });
    }
    /**
     * Retrieves the total BTC balance (free + locked).
     */
    getBTCBalance() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const balances = yield this.getWalletBalance();
                const btcBalance = balances.find((b) => b.asset === "BTC");
                if (!btcBalance)
                    return "0";
                const total = (parseFloat(btcBalance.free) + parseFloat(btcBalance.locked)).toString();
                return total;
            }
            catch (error) {
                throw new Error(`Failed to fetch BTC balance: ${error.message}`);
            }
        });
    }
    /**
     * Fetches multiple rate endpoints simultaneously.
     */
    fetchAllRates() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [btcUsdt, btcNgn] = yield Promise.all([
                    this.getAveragePrice("BTCUSDT"),
                    this.getAveragePrice("BTCNGN"),
                ]);
                return { btcUsdt, btcNgn };
            }
            catch (error) {
                throw new Error(`Failed to fetch rates: ${error.message}`);
            }
        });
    }
    /**
     * Returns the available balance for a given asset.
     */
    getAvailableBalance(asset) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const balances = yield this.getWalletBalance();
                const assetBalance = balances.find((b) => b.asset === asset);
                if (!assetBalance) {
                    return { free: "0", locked: "0", total: "0" };
                }
                return {
                    free: assetBalance.free,
                    locked: assetBalance.locked,
                    total: (parseFloat(assetBalance.free) + parseFloat(assetBalance.locked)).toString(),
                };
            }
            catch (error) {
                throw new Error(`Failed to fetch ${asset} balance: ${error.message}`);
            }
        });
    }
}
exports.BinanceService = BinanceService;
