import express from "express";
import {
  getCurrencyRates,
  getRates,
  getTradeDetails,
  getWalletBalances,
  sendTradeChatMessage,
  setOrUpdateRates,
  getPayerTrade,
  markTradeAsPaid,
  getDashboardStats,
  getCompletedPaidTrades,
  updateOffers,
  turnOffAllOffers,
  turnOnAllOffers,
  reassignTrade,
  getLiveTrades,
  assignLiveTrades,
  getAllTrades,
  getUnfinishedTrades,
  getOffersMargin,
  getAccounts,
  updateAccountRates,
  getFeedbackStats,
  getActiveFundedTotal,
  getCapRate,
  updateCapRate,
  getVendorCoin,
  escalateTrade,
  getEscalatedTrades,
  getEscalatedTradeById,
  getPlatformRates,
  cancelTrade,
  getCompletedPayerTrades,
  activateDeactivatedOffers,
  getOfferDetailsController,
  activateOfferController,
  getCCstats,
  getPlatformCostPrice
} from "../controllers/tradeController";
import { authenticate, roleAuth } from "../middlewares/authenticate";
import { User, UserType } from "../models/user";

const router: any = express.Router();

router.use(authenticate);

// Currency and Rates Endpoints:
router.get("/currency/rates", getCurrencyRates);

router.post(
  "/set-rates",
  roleAuth([UserType.ADMIN, UserType.RATER]),
  setOrUpdateRates
);

router.get(
  "/get-rates",
  roleAuth([UserType.ADMIN, UserType.RATER, UserType.PAYER]),
  getRates
);

router.get("/accounts", roleAuth([UserType.ADMIN, UserType.RATER]), getAccounts);

router.post("/update-account-rates", updateAccountRates);


// Trade Endpoints:
router.get("/live-trades", getLiveTrades);

router.post("/assign-live-trade", assignLiveTrades);

router.get('/active-funded-coin', getActiveFundedTotal)

router.get("/payer/trade/info/:platform/:tradeHash/:accountId", getTradeDetails);

router.post("/mark-paid/:tradeId", markTradeAsPaid);

router.post("/:tradeId/chat-message", sendTradeChatMessage);

router.get("/all-trades", getAllTrades);

router.get("/unfinished-trades", getUnfinishedTrades);

// Payer and Dashboard Endpoints:
router.get("/dashboard", roleAuth([UserType.ADMIN]), getDashboardStats);

router.get("/feedback-stats", getFeedbackStats);

router.get("/payer/assignedTrade/:id", getPayerTrade);

router.get(
  "/completed",
  getCompletedPaidTrades
); 

router.get(
  "/payer-trade",
  getCompletedPayerTrades
); 

// Wallet and Offers Endpoints

router.get(
  "/wallet-balances",
  // roleAuth([UserType.ADMIN, UserType.RATER]),
  getWalletBalances
);

router.get(
  "/offers",
  roleAuth([UserType.ADMIN, UserType.RATER]),
  getOffersMargin
);

router.post(
  "/offers/update",
  roleAuth([UserType.ADMIN, UserType.RATER]),
  updateOffers
);

router.get(
  "/offers/turn-off",
  roleAuth([UserType.ADMIN, UserType.RATER]),
  turnOffAllOffers
);

router.get(
  "/offers/turn-on",
  roleAuth([UserType.ADMIN, UserType.RATER]),
  turnOnAllOffers
);

router.get("/get-offer", getOfferDetailsController)

router.post("/activate", activateOfferController)


router.post('/activate-deactivated', activateDeactivatedOffers);


router.post(
  "/reassign-trade/:tradeId",
  roleAuth([UserType.ADMIN, UserType.CC]),
  reassignTrade
);

router.get("/cap-btn/ngn", getCapRate);

router.post("/cap-btc/ngn", updateCapRate);

router.get(
  "/vendor-coin",
  getVendorCoin
);

router.post('/:tradeId/escalate', escalateTrade);
router.get('/escalated', getEscalatedTrades);
router.get('/escalated-trades/:id', getEscalatedTradeById);

router.post('/:tradeId/cancel', cancelTrade);

router.get('/get-ngnrates', getPlatformRates);

router.get("/ccstat", roleAuth([UserType.CC]), getCCstats);

router.get("/costprice/:platform", getPlatformCostPrice);

export default router;
