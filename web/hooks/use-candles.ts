"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { generateMockCandles } from "@/lib/mock-candles";

const API_BASE = "http://localhost:3100";

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

/**
 * Hook to fetch candle data from the REST API /candles endpoint.
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
} {
  const [candles, setCandles] = useState<CandleData[]>([]);
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
            setCandles(mockData);
            setError(null);
            return;
          }
        }
        setCandles(data);
        setError(null);
      }
    } catch {
      if (mountedRef.current) {
        // In dev mode, fall back to mock candle data instead of showing error
        const mockData = generateMockCandles(interval);
        if (mockData.length > 0) {
          setCandles(mockData);
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

  return { candles, loading, error };
}
