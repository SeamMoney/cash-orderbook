import { useState, useEffect, useCallback, useRef } from "react";
import { API_BASE } from "../lib/config";

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
  const hasDataRef = useRef(false);

  const fetchMarket = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE}/market`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as MarketData;

      if (mountedRef.current) {
        setMarket(data);
        hasDataRef.current = true;
        setError(null);
      }
    } catch {
      if (mountedRef.current) {
        // In dev mode, fall back to mock market data (only if no real data yet)
        if (import.meta.env.DEV && !hasDataRef.current) {
          setMarket({
            pairId: 0,
            pair: "CASH/USDC",
            baseAsset: "CASH",
            quoteAsset: "USDC",
            lotSize: 1,
            tickSize: 0.000001,
            minSize: 1,
            status: "active",
            lastPrice: 0.25,
            volume24h: 142_350.75,
          });
          hasDataRef.current = true;
          setError(null);
        } else {
          setError("Failed to fetch market data");
        }
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
