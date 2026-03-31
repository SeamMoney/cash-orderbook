"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE = "http://localhost:3100";

/** Market data from the /market endpoint. */
export interface MarketData {
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

/**
 * Hook to fetch market data from the REST API /market endpoint.
 * Polls at the given interval (default: 5s).
 */
export function useMarket(pollIntervalMs = 5000): {
  market: MarketData | null;
  loading: boolean;
  error: string | null;
} {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchMarket = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE}/market`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as MarketData;

      if (mountedRef.current) {
        setMarket(data);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch market data",
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchMarket();

    const interval = setInterval(() => {
      void fetchMarket();
    }, pollIntervalMs);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchMarket, pollIntervalMs]);

  return { market, loading, error };
}
