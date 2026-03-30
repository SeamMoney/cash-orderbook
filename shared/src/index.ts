/**
 * @cash/shared
 *
 * Shared types, constants, and ABIs for the CASH orderbook.
 */

/** Price scale factor — all prices use 6 decimal places */
export const PRICE_SCALE = 1_000_000;

/** CASH token decimals */
export const CASH_DECIMALS = 6;

/** USDC token decimals */
export const USDC_DECIMALS = 6;

/** Mainnet CASH token address */
export const CASH_TOKEN_ADDRESS =
  "0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67::CASH::CASH";

/** Mainnet USDC token address */
export const USDC_TOKEN_ADDRESS =
  "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b";

/** Order side */
export type OrderSide = "buy" | "sell";

/** Order type */
export type OrderType = "GTC" | "IOC" | "FOK" | "PostOnly" | "Market";

/** Order status */
export type OrderStatus = "open" | "partially_filled" | "filled" | "cancelled";

/** An order on the book */
export interface Order {
  orderId: string;
  pairId: number;
  owner: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  quantity: number;
  remaining: number;
  status: OrderStatus;
  timestamp: number;
}

/** A trade (fill) event */
export interface Trade {
  tradeId: string;
  pairId: number;
  makerOrderId: string;
  takerOrderId: string;
  price: number;
  quantity: number;
  side: OrderSide;
  timestamp: number;
}

/** User balance for an asset */
export interface AssetBalance {
  available: number;
  locked: number;
}

/** User balances for all assets */
export interface UserBalances {
  cash: AssetBalance;
  usdc: AssetBalance;
}

/** Orderbook depth level */
export interface DepthLevel {
  price: number;
  quantity: number;
  total: number;
}

/** Orderbook depth snapshot */
export interface OrderbookDepth {
  bids: DepthLevel[];
  asks: DepthLevel[];
}

/** OHLCV candle */
export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

/** Candle interval */
export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "1d";

/** Market info */
export interface MarketInfo {
  pairId: number;
  pair: string;
  baseAsset: string;
  quoteAsset: string;
  lotSize: number;
  tickSize: number;
  minSize: number;
  status: "active" | "paused" | "delisted";
  lastPrice: number;
  volume24h: number;
}
