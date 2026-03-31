/**
 * Tests for candle OHLCV aggregation correctness after multiple trades.
 *
 * Validates:
 *   - open = first trade price
 *   - high = max price
 *   - low = min price
 *   - close = last trade price
 *   - volume = sum of quantities
 */

import { describe, it, expect, beforeEach } from "vitest";
import { OrderbookState } from "./orderbook-state.js";

describe("Candle OHLCV correctness", () => {
  let state: OrderbookState;

  beforeEach(() => {
    state = new OrderbookState();
  });

  /**
   * Helper to process a trade at a given price and quantity.
   * Uses PRICE_SCALE (1_000_000) and CASH_DECIMALS (10^6).
   */
  function addTrade(price: number, quantity: number): void {
    state.processTrade({
      taker_order_id: String(Math.random()),
      maker_order_id: String(Math.random()),
      price: price * 1_000_000, // price in raw units
      quantity: quantity * 1_000_000, // quantity in raw units
      quote_amount: price * quantity * 1_000_000,
      buyer: "0xBUYER",
      seller: "0xSELLER",
      pair_id: 0,
      taker_is_bid: true,
    });
  }

  it("single trade creates correct OHLCV candle", () => {
    addTrade(1.5, 100);

    const candles = state.getCandles("1m");
    expect(candles).toHaveLength(1);
    expect(candles[0].open).toBe(1.5);
    expect(candles[0].high).toBe(1.5);
    expect(candles[0].low).toBe(1.5);
    expect(candles[0].close).toBe(1.5);
    expect(candles[0].volume).toBe(100);
  });

  it("two trades: open = first, close = second", () => {
    addTrade(1.5, 50);
    addTrade(2.0, 30);

    const candles = state.getCandles("1m");
    expect(candles).toHaveLength(1);
    expect(candles[0].open).toBe(1.5);
    expect(candles[0].close).toBe(2.0);
  });

  it("high = max of all trade prices", () => {
    addTrade(1.5, 10);
    addTrade(3.0, 10);
    addTrade(2.0, 10);

    const candles = state.getCandles("1m");
    expect(candles[0].high).toBe(3.0);
  });

  it("low = min of all trade prices", () => {
    addTrade(2.0, 10);
    addTrade(1.0, 10);
    addTrade(1.5, 10);

    const candles = state.getCandles("1m");
    expect(candles[0].low).toBe(1.0);
  });

  it("volume = sum of all trade quantities", () => {
    addTrade(1.5, 100);
    addTrade(2.0, 50);
    addTrade(1.8, 75);

    const candles = state.getCandles("1m");
    expect(candles[0].volume).toBe(225);
  });

  it("OHLCV correct after sequence of 5 trades with varying prices", () => {
    // Simulate a price sequence: 1.50 → 1.80 → 1.20 → 2.00 → 1.75
    addTrade(1.5, 10);
    addTrade(1.8, 20);
    addTrade(1.2, 15);
    addTrade(2.0, 5);
    addTrade(1.75, 30);

    const candles = state.getCandles("1m");
    expect(candles).toHaveLength(1);

    const c = candles[0];
    expect(c.open).toBe(1.5);    // first trade
    expect(c.high).toBe(2.0);    // max price
    expect(c.low).toBe(1.2);     // min price
    expect(c.close).toBe(1.75);  // last trade
    expect(c.volume).toBe(80);   // 10+20+15+5+30
  });

  it("OHLCV correct for all candle intervals simultaneously", () => {
    addTrade(1.0, 10);
    addTrade(3.0, 20);
    addTrade(0.5, 5);
    addTrade(2.0, 15);

    // All intervals should have the same candle data (since all trades are within 1 minute)
    for (const interval of ["1m", "5m", "15m", "1h", "1d"] as const) {
      const candles = state.getCandles(interval);
      expect(candles).toHaveLength(1);
      expect(candles[0].open).toBe(1.0);
      expect(candles[0].high).toBe(3.0);
      expect(candles[0].low).toBe(0.5);
      expect(candles[0].close).toBe(2.0);
      expect(candles[0].volume).toBe(50);
    }
  });

  it("candle timestamp is bucket-aligned", () => {
    addTrade(1.5, 10);

    const candles = state.getCandles("1m");
    const ts = candles[0].timestamp;

    // Timestamp should be aligned to the minute (divisible by 60000)
    expect(ts % 60_000).toBe(0);
  });

  it("candle for 5m interval is aligned to 5 minutes", () => {
    addTrade(1.5, 10);

    const candles = state.getCandles("5m");
    const ts = candles[0].timestamp;

    // Timestamp should be aligned to 5 minutes (divisible by 300000)
    expect(ts % 300_000).toBe(0);
  });

  it("volume accumulates across many small trades", () => {
    for (let i = 0; i < 50; i++) {
      addTrade(1.5, 1);
    }

    const candles = state.getCandles("1m");
    expect(candles[0].volume).toBe(50);
  });

  it("high and low update correctly as prices fluctuate", () => {
    // Prices: 5, 3, 7, 1, 9, 2, 8, 4, 6
    const prices = [5, 3, 7, 1, 9, 2, 8, 4, 6];
    for (const p of prices) {
      addTrade(p, 10);
    }

    const candles = state.getCandles("1m");
    expect(candles[0].open).toBe(5);
    expect(candles[0].high).toBe(9);
    expect(candles[0].low).toBe(1);
    expect(candles[0].close).toBe(6);
    expect(candles[0].volume).toBe(90);
  });
});
