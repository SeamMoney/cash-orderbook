/**
 * @cash/orderbook-sdk
 *
 * TypeScript SDK for interacting with the CASH/USDC spot orderbook on Aptos.
 * Wraps @aptos-labs/ts-sdk for chain interaction.
 */

export const SDK_VERSION = "0.1.0";

// Main client
export { CashOrderbook } from "./client.js";

// Types
export type {
  CashOrderbookConfig,
  PlaceOrderParams,
  CancelOrderParams,
  TransactionResult,
  NetworkType,
} from "./types.js";

export { ORDER_TYPE_MAP, MODULE_NAMES } from "./types.js";

// Re-export shared types for consumer convenience
export type {
  Order,
  OrderSide,
  OrderType,
  OrderStatus,
  Trade,
  AssetBalance,
  UserBalances,
  DepthLevel,
  OrderbookDepth,
  Candle,
  CandleInterval,
  MarketInfo,
} from "@cash/shared";

export {
  PRICE_SCALE,
  CASH_DECIMALS,
  USDC_DECIMALS,
  CASH_TOKEN_ADDRESS,
  USDC_TOKEN_ADDRESS,
} from "@cash/shared";
