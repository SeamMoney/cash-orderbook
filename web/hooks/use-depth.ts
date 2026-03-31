"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/** Depth level from the REST API */
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

const API_BASE = "http://localhost:3100";

/**
 * Hook to fetch orderbook depth from the REST API.
 * Polls at the given interval (default: 5s).
 */
export function useDepth(pollIntervalMs = 5000): {
  depth: OrderbookDepth | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [depth, setDepth] = useState<OrderbookDepth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchDepth = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE}/depth`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as OrderbookDepth;
      if (mountedRef.current) {
        setDepth(data);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch depth");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchDepth();

    const interval = setInterval(() => {
      void fetchDepth();
    }, pollIntervalMs);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchDepth, pollIntervalMs]);

  return { depth, loading, error, refetch: fetchDepth };
}
