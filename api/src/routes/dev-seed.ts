/**
 * POST /dev/seed — Dev-only endpoint that injects mock trading data
 * into the in-memory OrderbookState for frontend development.
 *
 * Only available when NODE_ENV !== "production".
 *
 * Returns { seeded: true, trades: N, candles: N }
 */

import { Hono } from "hono";
import type { OrderbookState } from "../state/orderbook-state.js";
import type { Trade, Candle, CandleInterval } from "@cash/shared";

// ============================================================
// Mock data generators
// ============================================================

/** Demo wallet address used for seeded balances */
const DEMO_WALLET = "0xd00d000000000000000000000000000000000000000000000000000000000001";

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// ============================================================
// Trade generation
// ============================================================

function generateMockTrades(count: number): Trade[] {
  const now = Date.now();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  const trades: Trade[] = [];

  for (let i = 0; i < count; i++) {
    // Spread trades across the last 24 hours
    const timeOffset = Math.floor(randomBetween(0, twentyFourHoursMs));
    const timestamp = now - timeOffset;

    // Realistic price around $0.10 with slight variation
    const price = roundTo(randomBetween(0.095, 0.105), 4);
    const quantity = roundTo(randomBetween(100, 50000), 2);
    const side = Math.random() > 0.5 ? "buy" : "sell";

    trades.push({
      tradeId: String(10000 + i),
      pairId: 0,
      makerOrderId: `maker-${10000 + i}`,
      takerOrderId: `taker-${10000 + i}`,
      price,
      quantity,
      side: side as "buy" | "sell",
      timestamp,
    });
  }

  // Sort newest first
  trades.sort((a, b) => b.timestamp - a.timestamp);
  return trades;
}

// ============================================================
// Candle generation — 180 days of daily data
// ============================================================

function generateDailyCandles(days: number): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  // Price narrative: start $0.05, climb to $0.25 around day 90, settle ~$0.10
  let price = 0.05;

  for (let d = days - 1; d >= 0; d--) {
    const dayStart = Math.floor((now - d * oneDayMs) / oneDayMs) * oneDayMs;
    const progress = (days - 1 - d) / (days - 1); // 0 → 1

    // Target price curve: bell-shaped climb then settling
    let target: number;
    if (progress < 0.5) {
      // First half: climb from 0.05 → 0.25
      target = 0.05 + 0.20 * (progress / 0.5);
    } else {
      // Second half: decline from 0.25 → 0.10
      const decline = (progress - 0.5) / 0.5;
      target = 0.25 - 0.15 * decline;
    }

    // Drift toward target with noise
    const drift = (target - price) * 0.15;
    const noise = (Math.random() - 0.5) * 0.015;
    const open = roundTo(Math.max(0.01, price), 6);

    price = price + drift + noise;
    price = Math.max(0.01, price);

    const close = roundTo(price, 6);
    const high = roundTo(Math.max(open, close) * (1 + Math.random() * 0.08), 6);
    const low = roundTo(Math.min(open, close) * (1 - Math.random() * 0.08), 6);
    const volume = roundTo(randomBetween(50_000, 500_000), 2);

    candles.push({
      open,
      high,
      low: Math.max(0.005, low),
      close,
      volume,
      timestamp: dayStart,
    });
  }

  return candles;
}

// ============================================================
// Route
// ============================================================

export function devSeedRoute(state: OrderbookState): Hono {
  const app = new Hono();

  app.post("/dev/seed", (c) => {
    // Double-check production guard (route should not be mounted, but belt-and-suspenders)
    if (process.env.NODE_ENV === "production") {
      return c.json({ error: "FORBIDDEN", message: "Seed endpoint disabled in production" }, 403);
    }

    // --- 1. Inject mock trades ---
    const trades = generateMockTrades(60);

    // Access internal trades array directly (it's private, so we use a type assertion)
    const stateAny = state as unknown as Record<string, unknown>;
    const existingTrades = stateAny["trades"] as Trade[];
    existingTrades.unshift(...trades);
    // Trim to MAX_RECENT_TRADES (1000)
    if (existingTrades.length > 1000) {
      existingTrades.length = 1000;
    }

    // --- 2. Inject daily candles (180 days) ---
    const dailyCandles = generateDailyCandles(180);
    const candlesMap = stateAny["candles"] as Map<CandleInterval, Candle[]>;
    const existingDaily = candlesMap.get("1d") ?? [];
    // Prepend historical candles (avoid duplicates by only adding older ones)
    const earliestExisting = existingDaily.length > 0 ? existingDaily[0]!.timestamp : Infinity;
    const newCandles = dailyCandles.filter((c) => c.timestamp < earliestExisting);
    candlesMap.set("1d", [...newCandles, ...existingDaily]);

    // Also generate 1h candles for the last 7 days (more granular recent data)
    const hourlyCandles = generateHourlyCandles(7);
    const existingHourly = candlesMap.get("1h") ?? [];
    const earliestHourly = existingHourly.length > 0 ? existingHourly[0]!.timestamp : Infinity;
    const newHourly = hourlyCandles.filter((c) => c.timestamp < earliestHourly);
    candlesMap.set("1h", [...newHourly, ...existingHourly]);

    // Generate 5m candles for the last 24h (chart default interval)
    const fiveMinCandles = generateSubHourCandles(5, 24);
    candlesMap.set("5m", fiveMinCandles);

    // Generate 15m candles for the last 7 days
    const fifteenMinCandles = generateSubHourCandles(15, 7 * 24);
    candlesMap.set("15m", fifteenMinCandles);

    // Generate 1m candles for the last 1h
    const oneMinCandles = generateSubHourCandles(1, 1);
    candlesMap.set("1m", oneMinCandles);

    // --- 3. Update market info ---
    state.updateMarketInfo({
      lastPrice: 0.10,
      volume24h: 142350,
    });

    // --- 4. Mock balances for demo wallet ---
    const balancesMap = stateAny["balances"] as Map<string, { cash: { available: number; locked: number }; usdc: { available: number; locked: number } }>;
    balancesMap.set(DEMO_WALLET, {
      cash: { available: 250_000, locked: 15_000 },
      usdc: { available: 50_000, locked: 5_000 },
    });

    const totalCandles = dailyCandles.length + hourlyCandles.length;

    console.log(`[DEV-SEED] Injected ${trades.length} trades, ${totalCandles} candles, market info, and demo balances`);

    return c.json({
      seeded: true,
      trades: trades.length,
      candles: totalCandles,
      demoWallet: DEMO_WALLET,
    });
  });

  return app;
}

// ============================================================
// Sub-hour candle generation (1m, 5m, 15m)
// ============================================================

function generateSubHourCandles(intervalMinutes: number, hours: number): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  const intervalMs = intervalMinutes * 60 * 1000;
  const totalIntervals = Math.floor((hours * 60) / intervalMinutes);

  let price = 0.095;

  for (let i = totalIntervals - 1; i >= 0; i--) {
    const start = Math.floor((now - i * intervalMs) / intervalMs) * intervalMs;

    const noise = (Math.random() - 0.5) * 0.003;
    const open = roundTo(price, 6);
    price = Math.max(0.01, price + noise);
    const close = roundTo(price, 6);
    const high = roundTo(Math.max(open, close) * (1 + Math.random() * 0.015), 6);
    const low = roundTo(Math.min(open, close) * (1 - Math.random() * 0.015), 6);
    const volume = roundTo(randomBetween(200, 5_000), 2);

    candles.push({ open, high, low: Math.max(0.005, low), close, volume, timestamp: start });
  }

  return candles;
}

// ============================================================
// Hourly candle generation for last N days
// ============================================================

function generateHourlyCandles(days: number): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  const oneHourMs = 60 * 60 * 1000;
  const totalHours = days * 24;

  let price = 0.095; // start near current price

  for (let h = totalHours - 1; h >= 0; h--) {
    const hourStart = Math.floor((now - h * oneHourMs) / oneHourMs) * oneHourMs;

    const noise = (Math.random() - 0.5) * 0.006;
    const open = roundTo(price, 6);
    price = Math.max(0.01, price + noise);
    const close = roundTo(price, 6);
    const high = roundTo(Math.max(open, close) * (1 + Math.random() * 0.03), 6);
    const low = roundTo(Math.min(open, close) * (1 - Math.random() * 0.03), 6);
    const volume = roundTo(randomBetween(2_000, 30_000), 2);

    candles.push({
      open,
      high,
      low: Math.max(0.005, low),
      close,
      volume,
      timestamp: hourStart,
    });
  }

  return candles;
}
