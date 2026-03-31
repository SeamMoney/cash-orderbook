/**
 * SDK-specific types for @cash/orderbook-sdk.
 * Re-exports shared types and adds SDK configuration types.
 */

// Re-export all shared types
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

/** Network type supported by the SDK */
export type NetworkType = "mainnet" | "testnet" | "devnet" | "local";

/** Configuration for the CashOrderbook client */
export interface CashOrderbookConfig {
  /** Aptos network to connect to */
  network: NetworkType;
  /** The address where cash_orderbook contracts are deployed */
  contractAddress: string;
  /** Base asset (CASH) metadata address */
  baseAsset: string;
  /** Quote asset (USDC) metadata address */
  quoteAsset: string;
  /** Optional API key for RPC rate limit bypass */
  apiKey?: string;
  /** Optional custom fullnode URL override */
  fullnodeUrl?: string;
}

/** Parameters for placing an order */
export interface PlaceOrderParams {
  /** Market pair ID (default 0 for CASH/USDC) */
  pairId: number;
  /** Price in human-readable units (e.g. 1.5 for 1.5 USDC per CASH) */
  price: number;
  /** Quantity in human-readable units (e.g. 100 for 100 CASH) */
  quantity: number;
  /** Order side: buy or sell */
  side: "buy" | "sell";
  /** Order type */
  orderType: "GTC" | "IOC" | "FOK" | "PostOnly" | "Market";
}

/** Parameters for cancelling an order */
export interface CancelOrderParams {
  /** Market pair ID */
  pairId: number;
  /** The order ID to cancel */
  orderId: string;
}

/** Transaction result from write operations */
export interface TransactionResult {
  /** Transaction hash */
  txHash: string;
}

/** Order type numeric mapping for contract calls */
export const ORDER_TYPE_MAP: Record<string, number> = {
  GTC: 0,
  IOC: 1,
  FOK: 2,
  PostOnly: 3,
} as const;

/** Module names within the contract package */
export const MODULE_NAMES = {
  ORDER_PLACEMENT: "order_placement",
  CANCEL: "cancel",
  ACCOUNTS: "accounts",
  VIEWS: "views",
  MARKET: "market",
} as const;
