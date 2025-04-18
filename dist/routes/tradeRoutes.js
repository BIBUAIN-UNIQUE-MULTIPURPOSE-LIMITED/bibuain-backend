"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tradeController_1 = require("../controllers/tradeController");
const authenticate_1 = require("../middlewares/authenticate");
const user_1 = require("../models/user");
const router = express_1.default.Router();
router.use(authenticate_1.authenticate);
// Currency and Rates Endpoints:
router.get("/currency/rates", tradeController_1.getCurrencyRates);
router.post("/set-rates", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN, user_1.UserType.RATER]), tradeController_1.setOrUpdateRates);
router.get("/get-rates", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN, user_1.UserType.RATER, user_1.UserType.PAYER]), tradeController_1.getRates);
router.get("/accounts", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN, user_1.UserType.RATER]), tradeController_1.getAccounts);
router.post("/update-account-rates", tradeController_1.updateAccountRates);
// Trade Endpoints:
router.get("/live-trades", tradeController_1.getLiveTrades);
router.post("/assign-live-trade", tradeController_1.assignLiveTrades);
router.get('/active-funded-coin', tradeController_1.getActiveFundedTotal);
router.get("/payer/trade/info/:platform/:tradeHash/:accountId", tradeController_1.getTradeDetails);
router.post("/mark-paid/:tradeId", tradeController_1.markTradeAsPaid);
router.post("/:tradeId/chat-message", tradeController_1.sendTradeChatMessage);
router.get("/all-trades", tradeController_1.getAllTrades);
router.get("/unfinished-trades", tradeController_1.getUnfinishedTrades);
// Payer and Dashboard Endpoints:
router.get("/dashboard", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN]), tradeController_1.getDashboardStats);
router.get("/feedback-stats", tradeController_1.getFeedbackStats);
router.get("/payer/assignedTrade/:id", tradeController_1.getPayerTrade);
router.get("/completed", tradeController_1.getCompletedPaidTrades);
router.get("/payer-trade", tradeController_1.getCompletedPayerTrades);
// Wallet and Offers Endpoints
router.get("/wallet-balances", 
// roleAuth([UserType.ADMIN, UserType.RATER]),
tradeController_1.getWalletBalances);
router.get("/offers", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN, user_1.UserType.RATER]), tradeController_1.getOffersMargin);
router.post("/offers/update", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN, user_1.UserType.RATER]), tradeController_1.updateOffers);
router.get("/offers/turn-off", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN, user_1.UserType.RATER]), tradeController_1.turnOffAllOffers);
router.get("/offers/turn-on", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN, user_1.UserType.RATER]), tradeController_1.turnOnAllOffers);
router.get("/get-offer", tradeController_1.getOfferDetailsController);
router.post("/activate", tradeController_1.activateOfferController);
router.post('/activate-deactivated', tradeController_1.activateDeactivatedOffers);
router.post("/reassign-trade/:tradeId", (0, authenticate_1.roleAuth)([user_1.UserType.ADMIN, user_1.UserType.CC]), tradeController_1.reassignTrade);
router.get("/cap-btn/ngn", tradeController_1.getCapRate);
router.post("/cap-btc/ngn", tradeController_1.updateCapRate);
router.get("/vendor-coin", tradeController_1.getVendorCoin);
router.post('/:tradeId/escalate', tradeController_1.escalateTrade);
router.get('/escalated', tradeController_1.getEscalatedTrades);
router.get('/escalated-trades/:id', tradeController_1.getEscalatedTradeById);
router.post('/:tradeId/cancel', tradeController_1.cancelTrade);
router.get('/get-ngnrates', tradeController_1.getPlatformRates);
router.get("/ccstat", (0, authenticate_1.roleAuth)([user_1.UserType.CC]), tradeController_1.getCCstats);
exports.default = router;
