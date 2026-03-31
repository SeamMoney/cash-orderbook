/**
 * In-memory orderbook state maintained by the event indexer.
 *
 * Stores:
 *   - Full bid/ask depth (price -> aggregated quantity)
 *   - Recent trades (last 1000)
 *   - Per-user balance cache (address -> { cash, usdc })
 *   - Candle aggregation per timeframe (1m, 5m, 15m, 1h, 1d)
 *   - Market info (last price, 24h volume)
 *   - Per-user open orders
 *
 * Emits events via EventEmitter so the WebSocket server can push
 * real-time updates when state changes.
 */

import { EventEmitter } from "node:events";

import type {
  Order,
  OrderSide,
  OrderType,
  Trade,
  UserBalances,
  DepthLevel,
  OrderbookDepth,
  Candle,
  CandleInterval,
  MarketInfo,
} from "@cash/shared";

import { PRICE_SCALE, CASH_DECIMALS, USDC_DECIMALS } from "@cash/shared";

// ============================================================
// Event types emitted by OrderbookState
// ============================================================

export interface OrderbookStateEvents {
  /** Emitted when bid or ask depth changes */
  orderbookUpdate: [delta: { bids: Array<{ price: number; quantity: number }>; asks: Array<{ price: number; quantity: number }> }];
  /** Emitted when a new trade is processed */
  trade: [trade: Trade];
  /** Emitted when a user's balance changes */
  balanceUpdate: [address: string, balances: UserBalances];
}

// ============================================================
// Constants
// ============================================================

const MAX_RECENT_TRADES = 1000;
const MAX_CANDLES_PER_INTERVAL = 500;

/** Candle interval durations in milliseconds */
const INTERVAL_MS: Record<CandleInterval, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "1d": 86_400_000,
};

/** All supported candle intervals */
export const CANDLE_INTERVALS: CandleInterval[] = ["1m", "5m", "15m", "1h", "1d"];

// ============================================================
// OrderbookState class
// ============================================================

export class OrderbookState extends EventEmitter {
  /** Bid depth: price (raw) -> quantity (raw) */
  private bids: Map<number, number> = new Map();

  /** Ask depth: price (raw) -> quantity (raw) */
  private asks: Map<number, number> = new Map();

  /** Recent trades (newest first) */
  private trades: Trade[] = [];

  /** Open orders: orderId -> Order */
  private orders: Map<string, Order> = new Map();

  /** Per-user balance cache: address -> UserBalances */
  private balances: Map<string, UserBalances> = new Map();

  /** Candle data per interval */
  private candles: Map<CandleInterval, Candle[]> = new Map();

  /** Current (open) candle per interval */
  private currentCandle: Map<CandleInterval, Candle> = new Map();

  /** Market info */
  private marketInfo: MarketInfo = {
    pairId: 0,
    pair: "CASH/USDC",
    baseAsset: "CASH",
    quoteAsset: "USDC",
    lotSize: 1,
    tickSize: 1,
    minSize: 1,
    status: "active",
    lastPrice: 0,
    volume24h: 0,
  };

  /** Last indexed ledger version */
  private lastIndexedVersion: number = 0;

  /** Trade ID counter */
  private tradeIdCounter: number = 0;

  constructor() {
    super();
    for (const interval of CANDLE_INTERVALS) {
      this.candles.set(interval, []);
    }
  }

  // ============================================================
  // Getters
  // ============================================================

  getLastIndexedVersion(): number {
    return this.lastIndexedVersion;
  }

  setLastIndexedVersion(version: number): void {
    this.lastIndexedVersion = version;
  }

  /**
   * Get orderbook depth with bids sorted descending, asks ascending.
   * Each level includes a cumulative total.
   */
  getDepth(): OrderbookDepth {
    const bidLevels = this.getSortedLevels(this.bids, "desc");
    const askLevels = this.getSortedLevels(this.asks, "asc");
    return { bids: bidLevels, asks: askLevels };
  }

  /**
   * Get recent trades (newest first), optionally limited.
   */
  getTrades(limit: number = 50): Trade[] {
    return this.trades.slice(0, Math.min(limit, MAX_RECENT_TRADES));
  }

  /**
   * Get open orders for a specific address.
   */
  getOrdersForAddress(address: string): Order[] {
    const result: Order[] = [];
    for (const order of this.orders.values()) {
      if (order.owner === address) {
        result.push(order);
      }
    }
    return result;
  }

  /**
   * Get balances for a specific address.
   * Returns zeroed balances if address has no cached data.
   */
  getBalances(address: string): UserBalances {
    return this.balances.get(address) ?? {
      cash: { available: 0, locked: 0 },
      usdc: { available: 0, locked: 0 },
    };
  }

  /**
   * Get candles for a specific interval.
   */
  getCandles(interval: CandleInterval): Candle[] {
    const closed = this.candles.get(interval) ?? [];
    const current = this.currentCandle.get(interval);
    if (current) {
      return [...closed, current];
    }
    return [...closed];
  }

  /**
   * Get market info.
   */
  getMarketInfo(): MarketInfo {
    return { ...this.marketInfo };
  }

  // ============================================================
  // Event Processing
  // ============================================================

  /**
   * Process an OrderPlaced event from the contract.
   */
  processOrderPlaced(event: {
    order_id: string;
    owner: string;
    pair_id: number;
    price: number;
    quantity: number;
    is_bid: boolean;
    order_type: number;
    timestamp: number;
  }): void {
    const orderTypeMap: Record<number, OrderType> = {
      0: "GTC",
      1: "IOC",
      2: "FOK",
      3: "PostOnly",
    };

    const side: OrderSide = event.is_bid ? "buy" : "sell";
    const type = orderTypeMap[event.order_type] ?? "GTC";

    const order: Order = {
      orderId: event.order_id,
      pairId: event.pair_id,
      owner: event.owner,
      side,
      type,
      price: event.price / PRICE_SCALE,
      quantity: event.quantity / 10 ** CASH_DECIMALS,
      remaining: event.quantity / 10 ** CASH_DECIMALS,
      status: "open",
      timestamp: event.timestamp,
    };

    // Add to orders map
    this.orders.set(event.order_id, order);

    // Add to depth (only GTC and PostOnly rest on the book)
    if (type === "GTC" || type === "PostOnly") {
      const depthMap = event.is_bid ? this.bids : this.asks;
      const existing = depthMap.get(event.price) ?? 0;
      depthMap.set(event.price, existing + event.quantity);

      // Emit orderbook delta
      const humanPrice = event.price / PRICE_SCALE;
      const newTotalQty = (depthMap.get(event.price) ?? 0) / 10 ** CASH_DECIMALS;
      this.emit("orderbookUpdate", {
        bids: event.is_bid ? [{ price: humanPrice, quantity: newTotalQty }] : [],
        asks: !event.is_bid ? [{ price: humanPrice, quantity: newTotalQty }] : [],
      });
    }

    // Update locked balance
    this.updateLockedOnPlace(event);

    // Emit balance update for the order placer
    this.emit("balanceUpdate", event.owner, this.getBalances(event.owner));
  }

  /**
   * Process an OrderCancelled event from the contract.
   */
  processOrderCancelled(event: {
    order_id: string;
    owner: string;
    pair_id: number;
    remaining_quantity: number;
    is_bid: boolean;
    price: number;
  }): void {
    const order = this.orders.get(event.order_id);
    if (order) {
      order.status = "cancelled";
      order.remaining = 0;
      this.orders.delete(event.order_id);
    }

    // Remove from depth
    const depthMap = event.is_bid ? this.bids : this.asks;
    const existing = depthMap.get(event.price) ?? 0;
    const newQty = existing - event.remaining_quantity;
    if (newQty <= 0) {
      depthMap.delete(event.price);
    } else {
      depthMap.set(event.price, newQty);
    }

    // Emit orderbook delta
    const humanPrice = event.price / PRICE_SCALE;
    const remainingAtLevel = newQty <= 0 ? 0 : newQty / 10 ** CASH_DECIMALS;
    this.emit("orderbookUpdate", {
      bids: event.is_bid ? [{ price: humanPrice, quantity: remainingAtLevel }] : [],
      asks: !event.is_bid ? [{ price: humanPrice, quantity: remainingAtLevel }] : [],
    });

    // Unlock balance
    this.updateLockedOnCancel(event);

    // Emit balance update for the order owner
    this.emit("balanceUpdate", event.owner, this.getBalances(event.owner));
  }

  /**
   * Process a Trade event from the contract.
   */
  processTrade(event: {
    taker_order_id: string;
    maker_order_id: string;
    price: number;
    quantity: number;
    quote_amount: number;
    buyer: string;
    seller: string;
    pair_id: number;
    taker_is_bid: boolean;
  }): void {
    this.tradeIdCounter++;

    const side: OrderSide = event.taker_is_bid ? "buy" : "sell";
    const humanPrice = event.price / PRICE_SCALE;
    const humanQuantity = event.quantity / 10 ** CASH_DECIMALS;
    const humanQuoteAmount = event.quote_amount / 10 ** USDC_DECIMALS;

    const trade: Trade = {
      tradeId: String(this.tradeIdCounter),
      pairId: event.pair_id,
      makerOrderId: event.maker_order_id,
      takerOrderId: event.taker_order_id,
      price: humanPrice,
      quantity: humanQuantity,
      side,
      timestamp: Date.now(),
    };

    // Add to front (newest first)
    this.trades.unshift(trade);
    if (this.trades.length > MAX_RECENT_TRADES) {
      this.trades.pop();
    }

    // Update market info
    this.marketInfo.lastPrice = humanPrice;
    this.updateVolume24h(humanQuantity);

    // Update candles
    this.updateCandles(humanPrice, humanQuantity);

    // Remove maker quantity from depth (partial fill decrements, full fill removes)
    const makerOrder = this.orders.get(event.maker_order_id);
    let depthChanged = false;
    let depthDeltaPrice = 0;
    let depthDeltaQty = 0;
    let depthDeltaIsBid = false;

    if (makerOrder) {
      const isMakerBid = makerOrder.side === "buy";
      const depthMap = isMakerBid ? this.bids : this.asks;
      const existing = depthMap.get(event.price) ?? 0;
      const newQty = existing - event.quantity;
      if (newQty <= 0) {
        depthMap.delete(event.price);
      } else {
        depthMap.set(event.price, newQty);
      }
      depthChanged = true;
      depthDeltaPrice = humanPrice;
      depthDeltaQty = newQty <= 0 ? 0 : newQty / 10 ** CASH_DECIMALS;
      depthDeltaIsBid = isMakerBid;
    }

    // Update balances for buyer and seller
    this.updateBalancesOnTrade(event.buyer, event.seller, humanQuantity, humanQuoteAmount);

    // Emit trade event
    this.emit("trade", trade);

    // Emit orderbook delta if depth changed
    if (depthChanged) {
      this.emit("orderbookUpdate", {
        bids: depthDeltaIsBid ? [{ price: depthDeltaPrice, quantity: depthDeltaQty }] : [],
        asks: !depthDeltaIsBid ? [{ price: depthDeltaPrice, quantity: depthDeltaQty }] : [],
      });
    }

    // Emit balance updates for both parties
    this.emit("balanceUpdate", event.buyer, this.getBalances(event.buyer));
    this.emit("balanceUpdate", event.seller, this.getBalances(event.seller));
  }

  /**
   * Process an OrderFilled event from the contract.
   */
  processOrderFilled(event: {
    order_id: string;
    fill_quantity: number;
    fill_price: number;
    owner: string;
    pair_id: number;
  }): void {
    const order = this.orders.get(event.order_id);
    if (order) {
      const fillHuman = event.fill_quantity / 10 ** CASH_DECIMALS;
      order.remaining = Math.max(0, order.remaining - fillHuman);
      if (order.remaining <= 0) {
        order.status = "filled";
        this.orders.delete(event.order_id);
      } else {
        order.status = "partially_filled";
      }
    }
  }

  /**
   * Process a Deposit event from the contract.
   */
  processDeposit(event: {
    user: string;
    asset: string;
    amount: number;
  }): void {
    const balances = this.getOrCreateBalances(event.user);
    const assetKey = this.assetKey(event.asset);
    if (assetKey) {
      balances[assetKey].available += event.amount / 10 ** (assetKey === "cash" ? CASH_DECIMALS : USDC_DECIMALS);
    }
    this.balances.set(event.user, balances);

    // Emit balance update
    this.emit("balanceUpdate", event.user, this.getBalances(event.user));
  }

  /**
   * Process a Withdraw event from the contract.
   */
  processWithdraw(event: {
    user: string;
    asset: string;
    amount: number;
  }): void {
    const balances = this.getOrCreateBalances(event.user);
    const assetKey = this.assetKey(event.asset);
    if (assetKey) {
      const decimals = assetKey === "cash" ? CASH_DECIMALS : USDC_DECIMALS;
      balances[assetKey].available = Math.max(0, balances[assetKey].available - event.amount / 10 ** decimals);
    }
    this.balances.set(event.user, balances);

    // Emit balance update
    this.emit("balanceUpdate", event.user, this.getBalances(event.user));
  }

  /**
   * Update market info from contract data.
   */
  updateMarketInfo(info: Partial<MarketInfo>): void {
    Object.assign(this.marketInfo, info);
  }

  // ============================================================
  // Internal Helpers
  // ============================================================

  private getSortedLevels(
    depthMap: Map<number, number>,
    direction: "asc" | "desc",
  ): DepthLevel[] {
    const entries = Array.from(depthMap.entries());
    entries.sort((a, b) => (direction === "asc" ? a[0] - b[0] : b[0] - a[0]));

    let cumulative = 0;
    return entries.map(([price, quantity]) => {
      cumulative += quantity / 10 ** CASH_DECIMALS;
      return {
        price: price / PRICE_SCALE,
        quantity: quantity / 10 ** CASH_DECIMALS,
        total: cumulative,
      };
    });
  }

  private getOrCreateBalances(address: string): UserBalances {
    const existing = this.balances.get(address);
    if (existing) {
      return { ...existing, cash: { ...existing.cash }, usdc: { ...existing.usdc } };
    }
    return {
      cash: { available: 0, locked: 0 },
      usdc: { available: 0, locked: 0 },
    };
  }

  private assetKey(assetAddress: string): "cash" | "usdc" | null {
    // We identify by convention — CASH contains "CASH", USDC is the known address
    const lower = assetAddress.toLowerCase();
    if (lower.includes("cash")) {
      return "cash";
    }
    // Default to usdc if it's the known USDC address or unknown
    return "usdc";
  }

  private updateLockedOnPlace(event: {
    is_bid: boolean;
    price: number;
    quantity: number;
    owner: string;
  }): void {
    const balances = this.getOrCreateBalances(event.owner);
    if (event.is_bid) {
      // Buy: lock quote (USDC)
      const quoteAmount = (event.price * event.quantity) / PRICE_SCALE / 10 ** USDC_DECIMALS;
      balances.usdc.locked += quoteAmount;
      balances.usdc.available = Math.max(0, balances.usdc.available - quoteAmount);
    } else {
      // Sell: lock base (CASH)
      const baseAmount = event.quantity / 10 ** CASH_DECIMALS;
      balances.cash.locked += baseAmount;
      balances.cash.available = Math.max(0, balances.cash.available - baseAmount);
    }
    this.balances.set(event.owner, balances);
  }

  /**
   * Update balances for both buyer and seller when a trade executes.
   * Buyer receives base (CASH), seller receives quote (USDC).
   * Buyer's locked USDC is released and debited; seller's locked CASH is released and debited.
   */
  private updateBalancesOnTrade(
    buyer: string,
    seller: string,
    baseAmount: number,
    quoteAmount: number,
  ): void {
    // Buyer: receives CASH (base), pays USDC (quote)
    const buyerBalances = this.getOrCreateBalances(buyer);
    buyerBalances.cash.available += baseAmount;
    // Unlock and debit USDC — the USDC was locked when the buy order was placed
    buyerBalances.usdc.locked = Math.max(0, buyerBalances.usdc.locked - quoteAmount);
    this.balances.set(buyer, buyerBalances);

    // Seller: receives USDC (quote), pays CASH (base)
    const sellerBalances = this.getOrCreateBalances(seller);
    sellerBalances.usdc.available += quoteAmount;
    // Unlock and debit CASH — the CASH was locked when the sell order was placed
    sellerBalances.cash.locked = Math.max(0, sellerBalances.cash.locked - baseAmount);
    this.balances.set(seller, sellerBalances);
  }

  private updateLockedOnCancel(event: {
    is_bid: boolean;
    price: number;
    remaining_quantity: number;
    owner: string;
  }): void {
    const balances = this.getOrCreateBalances(event.owner);
    if (event.is_bid) {
      const quoteAmount = (event.price * event.remaining_quantity) / PRICE_SCALE / 10 ** USDC_DECIMALS;
      balances.usdc.locked = Math.max(0, balances.usdc.locked - quoteAmount);
      balances.usdc.available += quoteAmount;
    } else {
      const baseAmount = event.remaining_quantity / 10 ** CASH_DECIMALS;
      balances.cash.locked = Math.max(0, balances.cash.locked - baseAmount);
      balances.cash.available += baseAmount;
    }
    this.balances.set(event.owner, balances);
  }

  private updateVolume24h(quantity: number): void {
    // Simplified: just add. In production, we'd track per-time windows.
    this.marketInfo.volume24h += quantity;
  }

  private updateCandles(price: number, volume: number): void {
    const now = Date.now();

    for (const interval of CANDLE_INTERVALS) {
      const intervalMs = INTERVAL_MS[interval];
      const bucketStart = Math.floor(now / intervalMs) * intervalMs;

      const current = this.currentCandle.get(interval);

      if (current && current.timestamp === bucketStart) {
        // Update existing candle
        current.high = Math.max(current.high, price);
        current.low = Math.min(current.low, price);
        current.close = price;
        current.volume += volume;
      } else {
        // Close previous candle (if any) and open new one
        if (current) {
          const closedCandles = this.candles.get(interval)!;
          closedCandles.push(current);
          if (closedCandles.length > MAX_CANDLES_PER_INTERVAL) {
            closedCandles.shift();
          }
        }

        // Open new candle
        this.currentCandle.set(interval, {
          open: price,
          high: price,
          low: price,
          close: price,
          volume,
          timestamp: bucketStart,
        });
      }
    }
  }
}
