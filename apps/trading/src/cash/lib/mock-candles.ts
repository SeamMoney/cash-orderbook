/**
 * Dev-mode mock candle data generator.
 *
 * Generates realistic-looking OHLCV candle data when the API is not running.
 * Uses a deterministic seed based on the interval so the chart always looks
 * consistent for the same time range. Simulates price movement with random
 * walks around a base price of ~0.25 USDC per CASH.
 */

import type { CandleData, CandleInterval } from "../hooks/use-candles";

/** Whether we're in development mode */
const IS_DEV = import.meta.env.DEV;

/** Simple seeded pseudo-random number generator (mulberry32) */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Map interval to duration in milliseconds and number of candles to generate */
const INTERVAL_CONFIG: Record<CandleInterval, { durationMs: number; count: number }> = {
  "1m": { durationMs: 60_000, count: 60 },        // 1 hour of 1m candles
  "5m": { durationMs: 300_000, count: 288 },       // 1 day of 5m candles
  "15m": { durationMs: 900_000, count: 672 },      // 1 week of 15m candles
  "1h": { durationMs: 3_600_000, count: 720 },     // 1 month of 1h candles
  "1d": { durationMs: 86_400_000, count: 365 },    // 1 year of 1d candles
};

/**
 * Generate mock candle data for a given interval.
 * Returns an array of CandleData with realistic price movement.
 */
export function generateMockCandles(interval: CandleInterval): CandleData[] {
  if (!IS_DEV) return [];

  const config = INTERVAL_CONFIG[interval];
  const { durationMs, count } = config;

  // Use interval string as seed for deterministic output
  const seedValue = interval.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const rand = seededRandom(seedValue * 31337);

  const now = Date.now();
  const startTime = now - count * durationMs;

  const candles: CandleData[] = [];
  let price = 0.25; // Base price: 0.25 USDC per CASH
  const volatility = 0.015; // 1.5% per candle max move

  for (let i = 0; i < count; i++) {
    const timestamp = startTime + i * durationMs;

    // Random walk with slight upward bias
    const change = (rand() - 0.48) * volatility * price;
    const open = price;
    price = Math.max(0.001, price + change);
    const close = price;

    // Intracandle high/low
    const highExtra = rand() * volatility * 0.5 * price;
    const lowExtra = rand() * volatility * 0.5 * price;
    const high = Math.max(open, close) + highExtra;
    const low = Math.max(0.001, Math.min(open, close) - lowExtra);

    // Volume: random between 1000 and 50000
    const volume = 1000 + rand() * 49000;

    candles.push({
      open: parseFloat(open.toFixed(6)),
      high: parseFloat(high.toFixed(6)),
      low: parseFloat(low.toFixed(6)),
      close: parseFloat(close.toFixed(6)),
      volume: parseFloat(volume.toFixed(2)),
      timestamp,
    });
  }

  return candles;
}
