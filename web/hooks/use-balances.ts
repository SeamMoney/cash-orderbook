"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { UserBalances } from "@cash/shared";

const API_BASE = "http://localhost:3100";

/**
 * Hook to fetch CASH and USDC balances for a connected wallet address.
 *
 * Fetches from REST API GET /balances/:address on mount and at a configurable
 * polling interval. Also supports manual refetch and external updates from
 * WebSocket account subscription.
 */
export function useBalances(
  address: string | undefined,
  pollIntervalMs = 15000,
): {
  balances: UserBalances | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateBalances: (balances: UserBalances) => void;
} {
  const [balances, setBalances] = useState<UserBalances | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchBalances = useCallback(async (): Promise<void> => {
    if (!address) {
      setBalances(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/balances/${address}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as UserBalances;
      if (mountedRef.current) {
        setBalances(data);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch balances");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [address]);

  /** Allow external callers (e.g., WS account subscription) to push balance updates */
  const updateBalances = useCallback((newBalances: UserBalances): void => {
    if (mountedRef.current) {
      setBalances(newBalances);
      setError(null);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!address) {
      setBalances(null);
      setLoading(false);
      return;
    }

    void fetchBalances();
    const interval = setInterval(() => void fetchBalances(), pollIntervalMs);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [address, fetchBalances, pollIntervalMs]);

  return { balances, loading, error, refetch: fetchBalances, updateBalances };
}
