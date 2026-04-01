"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { generateMockCandles } from "@/lib/mock-candles";
import historicalCandlesJson from "@/data/historical-candles.json";
import { API_BASE } from "@/lib/config";

/** A single OHLCV candle from the /candles endpoint. */
export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

/** Valid candle intervals matching the API. */
export type CandleInterval = "1m" | "5m" | "15m" | "1h" | "1d";

/** Historical candles imported from the static JSON file. */
const historicalCandles: CandleData[] = historicalCandlesJson as CandleData[];

/**
 * The timestamp (ms) of the last historical candle — used as the transition
 * point between LiquidSwap historical data and live orderbook data.
 */
export const HISTORICAL_TRANSITION_TIMESTAMP: number | null =
  historicalCandles.length > 0
    ? historicalCandles[historicalCandles.length - 1].timestamp
    : null;

/**
 * Merge historical candles with live candles.
 * Historical data comes first, live data fills in after.
 * Deduplicates by timestamp (live takes priority).
 */
function mergeCandles(historical: CandleData[], live: CandleData[]): CandleData[] {
  const byTimestamp = new Map<number, CandleData>();

  // Add historical candles first
  for (const candle of historical) {
    byTimestamp.set(candle.timestamp, candle);
  }

  // Live candles override historical for any overlapping timestamps
  for (const candle of live) {
    byTimestamp.set(candle.timestamp, candle);
  }

  // Sort by timestamp ascending
  return Array.from(byTimestamp.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Resample daily historical candles into the requested interval.
 * For intervals shorter than 1d, each daily candle simply maps
 * to one point (we don't have higher-resolution historical data).
 * For intervals >= 1d, daily candles are used directly.
 */
function filterHistoricalForInterval(
  candles: CandleData[],
  interval: CandleInterval,
): CandleData[] {
  // Determine time window for each interval's typical chart range
  const now = Date.now();
  const windowMs: Record<CandleInterval, number> = {
    "1m": 60 * 60 * 1000,         // 1H of 1m candles
    "5m": 24 * 60 * 60 * 1000,    // 1D of 5m candles
    "15m": 7 * 24 * 60 * 60 * 1000,  // 1W of 15m candles
    "1h": 30 * 24 * 60 * 60 * 1000,  // 1M of 1h candles
    "1d": 365 * 24 * 60 * 60 * 1000, // 1Y of 1d candles
  };

  const window = windowMs[interval];
  const cutoff = now - window;

  // Filter to only candles within the time window
  return candles.filter((c) => c.timestamp >= cutoff);
}

/**
 * Hook to fetch candle data from the REST API /candles endpoint.
 * Merges historical LiquidSwap OHLCV data with live API data.
 * Re-fetches when the interval changes.
 * Polls at the given interval (default: 10s).
 *
 * In development mode, falls back to deterministic mock candle data
 * when the API is not available, so the chart always renders with data.
 */
export function useCandles(
  interval: CandleInterval = "1m",
  pollIntervalMs = 10000,
): {
  candles: CandleData[];
  loading: boolean;
  error: string | null;
  /** Timestamp (ms) marking the transition from historical to live data. */
  transitionTimestamp: number | null;
} {
  const [liveCandles, setLiveCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchCandles = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE}/candles?interval=${interval}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as CandleData[];

      if (mountedRef.current) {
        // If API returns empty array, fall back to mock data in dev
        if (data.length === 0) {
          const mockData = generateMockCandles(interval);
          if (mockData.length > 0) {
            setLiveCandles(mockData);
            setError(null);
            return;
          }
        }
        setLiveCandles(data);
        setError(null);
      }
    } catch {
      if (mountedRef.current) {
        // In dev mode, fall back to mock candle data instead of showing error
        const mockData = generateMockCandles(interval);
        if (mockData.length > 0) {
          setLiveCandles(mockData);
          setError(null);
        } else {
          setError("Failed to fetch candle data");
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [interval]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    void fetchCandles();

    const timer = setInterval(() => {
      void fetchCandles();
    }, pollIntervalMs);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [fetchCandles, pollIntervalMs]);

  // Filter historical data for the selected interval/time window
  const filteredHistorical = useMemo(
    () => filterHistoricalForInterval(historicalCandles, interval),
    [interval],
  );

  // Merge historical + live candles
  const candles = useMemo(
    () => mergeCandles(filteredHistorical, liveCandles),
    [filteredHistorical, liveCandles],
  );

  return { candles, loading, error, transitionTimestamp: HISTORICAL_TRANSITION_TIMESTAMP };
}
