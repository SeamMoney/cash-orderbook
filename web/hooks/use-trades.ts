"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TradeEntry } from "@/components/orderbook/trade-ticker";
import { API_BASE } from "@/lib/config";

/**
 * Hook to fetch recent trades from the REST API.
 * Polls at the given interval (default: 3s).
 */
export function useTrades(
  limit = 50,
  pollIntervalMs = 3000,
): {
  trades: TradeEntry[];
  loading: boolean;
  error: string | null;
} {
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchTrades = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE}/trades?limit=${limit}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Array<{
        id?: string;
        price: number;
        quantity: number;
        side: "buy" | "sell";
        timestamp: number;
      }>;

      if (mountedRef.current) {
        const mapped: TradeEntry[] = data.map((t, i) => ({
          id: t.id ?? `trade-${t.timestamp}-${i}`,
          price: t.price,
          quantity: t.quantity,
          side: t.side,
          timestamp: t.timestamp,
        }));
        setTrades(mapped);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch trades",
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [limit]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchTrades();

    const interval = setInterval(() => {
      void fetchTrades();
    }, pollIntervalMs);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchTrades, pollIntervalMs]);

  return { trades, loading, error };
}
