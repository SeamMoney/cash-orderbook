"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import type { DepthLevel, OrderbookDepth } from "@/hooks/use-depth";
import { useWebSocket, type WsMessage, type WsStatus } from "@/hooks/use-websocket";

/** Delta update from WebSocket */
interface OrderbookDelta {
  type: "snapshot" | "delta";
  bids: DepthLevel[];
  asks: DepthLevel[];
}

const API_BASE = "http://localhost:3100";

/**
 * Hook for real-time orderbook data via WebSocket with REST fallback.
 *
 * - Subscribes to 'orderbook' channel via WS
 * - On snapshot: replaces full book state
 * - On delta: merges changed levels
 * - Falls back to REST polling when WS disconnected
 * - Tracks previous prices for flash animations
 */
export function useRealtimeOrderbook(): {
  depth: OrderbookDepth | null;
  loading: boolean;
  error: string | null;
  wsStatus: WsStatus;
  /** Map of price → "up" | "down" for recently changed prices */
  priceFlashes: Map<number, "up" | "down">;
} {
  const [depth, setDepth] = useState<OrderbookDepth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceFlashes, setPriceFlashes] = useState<Map<number, "up" | "down">>(
    new Map(),
  );

  const prevDepthRef = useRef<OrderbookDepth | null>(null);
  const mountedRef = useRef(true);
  const flashTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const channels = useMemo(() => ["orderbook"], []);

  // Flash a price for 400ms
  const flashPrice = useCallback((price: number, direction: "up" | "down"): void => {
    setPriceFlashes((prev) => {
      const next = new Map(prev);
      next.set(price, direction);
      return next;
    });

    // Clear existing timer for this price
    const existing = flashTimersRef.current.get(price);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      if (mountedRef.current) {
        setPriceFlashes((prev) => {
          const next = new Map(prev);
          next.delete(price);
          return next;
        });
        flashTimersRef.current.delete(price);
      }
    }, 400);

    flashTimersRef.current.set(price, timer);
  }, []);

  // Detect price changes and trigger flashes
  const detectFlashes = useCallback(
    (newDepth: OrderbookDepth): void => {
      const prev = prevDepthRef.current;
      if (!prev) return;

      const prevPrices = new Map<number, number>();
      for (const level of [...prev.bids, ...prev.asks]) {
        prevPrices.set(level.price, level.quantity);
      }

      for (const level of [...newDepth.bids, ...newDepth.asks]) {
        const prevQty = prevPrices.get(level.price);
        if (prevQty !== undefined && prevQty !== level.quantity) {
          // Quantity changed — flash based on direction
          flashPrice(
            level.price,
            level.quantity > prevQty ? "up" : "down",
          );
        } else if (prevQty === undefined) {
          // New price level
          flashPrice(level.price, "up");
        }
      }
    },
    [flashPrice],
  );

  const handleWsMessage = useCallback(
    (msg: WsMessage): void => {
      if (msg.channel !== "orderbook") return;

      const data = msg.data as OrderbookDelta;

      if (data.type === "snapshot") {
        const newDepth: OrderbookDepth = {
          bids: data.bids,
          asks: data.asks,
        };
        detectFlashes(newDepth);
        prevDepthRef.current = newDepth;
        setDepth(newDepth);
        setLoading(false);
        setError(null);
      } else if (data.type === "delta") {
        setDepth((prev) => {
          if (!prev) return prev;

          const mergeLevel = (
            existing: DepthLevel[],
            changes: DepthLevel[],
            descending: boolean,
          ): DepthLevel[] => {
            const map = new Map<number, DepthLevel>();
            for (const lvl of existing) {
              map.set(lvl.price, lvl);
            }
            for (const lvl of changes) {
              if (lvl.quantity === 0) {
                map.delete(lvl.price);
              } else {
                map.set(lvl.price, lvl);
              }
            }

            const sorted = Array.from(map.values()).sort((a, b) =>
              descending ? b.price - a.price : a.price - b.price,
            );

            // Recalculate cumulative totals
            let cumTotal = 0;
            return sorted.map((lvl) => {
              cumTotal += lvl.quantity;
              return { ...lvl, total: cumTotal };
            });
          };

          const newDepth: OrderbookDepth = {
            bids: mergeLevel(prev.bids, data.bids, true),
            asks: mergeLevel(prev.asks, data.asks, false),
          };

          detectFlashes(newDepth);
          prevDepthRef.current = newDepth;
          return newDepth;
        });
      }
    },
    [detectFlashes],
  );

  const { status: wsStatus } = useWebSocket({
    channels,
    onMessage: handleWsMessage,
  });

  // Track whether we've shown the error toast to avoid spamming
  const errorToastShownRef = useRef(false);

  // REST fallback when WebSocket is not connected
  useEffect(() => {
    if (wsStatus === "connected") {
      errorToastShownRef.current = false;
      return;
    }

    const fetchDepth = async (): Promise<void> => {
      try {
        const res = await fetch(`${API_BASE}/depth`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as OrderbookDepth;
        if (mountedRef.current) {
          detectFlashes(data);
          prevDepthRef.current = data;
          setDepth(data);
          setError(null);
          setLoading(false);
          errorToastShownRef.current = false;
        }
      } catch (err) {
        if (mountedRef.current) {
          const message =
            err instanceof Error ? err.message : "Failed to fetch depth";
          setError(message);
          setLoading(false);

          // Show error toast with retry action (only once to avoid spam)
          if (!errorToastShownRef.current) {
            errorToastShownRef.current = true;
            toast.error("Network error", {
              description: `Failed to load orderbook: ${message}`,
              duration: 10000,
              action: {
                label: "Retry",
                onClick: () => {
                  errorToastShownRef.current = false;
                  void fetchDepth();
                },
              },
            });
          }
        }
      }
    };

    void fetchDepth();
    const interval = setInterval(() => void fetchDepth(), 5000);

    return () => clearInterval(interval);
  }, [wsStatus, detectFlashes]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    const timers = flashTimersRef.current;
    return () => {
      mountedRef.current = false;
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  return { depth, loading, error, wsStatus, priceFlashes };
}
