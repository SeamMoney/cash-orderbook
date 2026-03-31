/**
 * @cash/shared
 *
 * Shared types, constants, and ABIs for the CASH orderbook.
 */

// ---------------------------------------------------------------------------
// Price & Decimals
// ---------------------------------------------------------------------------

/** Price scale factor — all prices use 6 decimal places */
export const PRICE_SCALE = 1_000_000;

/** CASH token decimals */
export const CASH_DECIMALS = 6;

/** USDC token decimals (backward compat) */
export const USDC_DECIMALS = 6;

/** USD1 token decimals */
export const USD1_DECIMALS = 8;

/** USDT token decimals */
export const USDT_DECIMALS = 6;

/**
 * Default quote-asset decimals.
 * Set to USD1 (8) since USD1 is now the primary quote asset.
 * Use the per-stablecoin `decimals` field from STABLECOINS for multi-market support.
 */
export const QUOTE_DECIMALS = 8;

/** Helper: return the correct decimals for a given quote symbol */
export function quoteDecimalsFor(symbol: string): number {
  const entry = STABLECOINS.find(
    (s) => s.symbol.toLowerCase() === symbol.toLowerCase(),
  );
  return entry?.decimals ?? QUOTE_DECIMALS;
}

// ---------------------------------------------------------------------------
// Token Addresses — CASH
// ---------------------------------------------------------------------------

/** Mainnet CASH token address (legacy coin type) */
export const CASH_TOKEN_ADDRESS =
  "0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67::CASH::CASH";

// ---------------------------------------------------------------------------
// Token Addresses — USDC (backward compat)
// ---------------------------------------------------------------------------

/** Mainnet USDC token address (FA) */
export const USDC_TOKEN_ADDRESS =
  "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b";

/** Testnet USDC token address (FA) */
export const USDC_TESTNET_TOKEN_ADDRESS =
  "0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832";

// ---------------------------------------------------------------------------
// Token Addresses — USD1 (primary quote asset)
// ---------------------------------------------------------------------------

/** Mainnet USD1 token address (FA, 8 decimals) */
export const USD1_TOKEN_ADDRESS =
  "0x05fabd1b12e39967a3c24e91b7b8f67719a6dacee74f3c8b9fb7d93e855437d2";

/** Testnet USD1 token address (FA, 8 decimals, open minting) */
export const USD1_TESTNET_TOKEN_ADDRESS =
  "0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3";

// ---------------------------------------------------------------------------
// Token Addresses — USDT
// ---------------------------------------------------------------------------

/** Mainnet USDT token address (FA, 6 decimals) */
export const USDT_TOKEN_ADDRESS =
  "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b";

/** Testnet USDT token address (FA) */
export const USDT_TESTNET_TOKEN_ADDRESS =
  "0xd5d0d561493ea2b9410f67da804653ae44e793c2423707d4f11edb2e38192050";

// ---------------------------------------------------------------------------
// Token Addresses — USDe
// ---------------------------------------------------------------------------

/** Mainnet USDe token address (FA) */
export const USDE_TOKEN_ADDRESS =
  "0xf37a8864fe737eb8ec2c2931047047cbaed1beed3fb0e5b7c5526dafd3b9c2e9";

// ---------------------------------------------------------------------------
// Token Addresses — GHO
// ---------------------------------------------------------------------------

/** Mainnet GHO token address — TBD (Aave V3 Aptos deployment pending) */
export const GHO_TOKEN_ADDRESS = "TBD";

// ---------------------------------------------------------------------------
// StablecoinInfo type & STABLECOINS registry
// ---------------------------------------------------------------------------

/** Metadata for a supported stablecoin */
export interface StablecoinInfo {
  /** Short symbol, e.g. "USD1" */
  symbol: string;
  /** Human-readable name, e.g. "USD1 Stablecoin" */
  name: string;
  /** Mainnet fungible-asset address */
  address: string;
  /** Testnet fungible-asset address (if available) */
  testnetAddress?: string;
  /** Token decimals */
  decimals: number;
  /** CSS gradient for the token icon (from → to) */
  gradient: string;
  /** Primary brand hex colour */
  brandColor: string;
}

/** All supported stablecoins, ordered by priority (USD1 first) */
export const STABLECOINS: readonly StablecoinInfo[] = [
  {
    symbol: "USD1",
    name: "USD1 Stablecoin",
    address: USD1_TOKEN_ADDRESS,
    testnetAddress: USD1_TESTNET_TOKEN_ADDRESS,
    decimals: 8,
    gradient: "from-amber-400 to-yellow-500",
    brandColor: "#F59E0B",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: USDC_TOKEN_ADDRESS,
    testnetAddress: USDC_TESTNET_TOKEN_ADDRESS,
    decimals: 6,
    gradient: "from-blue-400 to-blue-600",
    brandColor: "#2775CA",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: USDT_TOKEN_ADDRESS,
    testnetAddress: USDT_TESTNET_TOKEN_ADDRESS,
    decimals: 6,
    gradient: "from-emerald-400 to-teal-500",
    brandColor: "#26A17B",
  },
  {
    symbol: "USDe",
    name: "Ethena USDe",
    address: USDE_TOKEN_ADDRESS,
    decimals: 6,
    gradient: "from-indigo-400 to-purple-500",
    brandColor: "#6366F1",
  },
  {
    symbol: "GHO",
    name: "GHO Stablecoin",
    address: GHO_TOKEN_ADDRESS,
    decimals: 6,
    gradient: "from-purple-400 to-pink-500",
    brandColor: "#A855F7",
  },
] as const;

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
