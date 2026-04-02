import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { TradeEntry } from "./use-trades";
import { useWebSocket, type WsMessage, type WsStatus } from "./use-websocket";
import { API_BASE } from "../lib/config";
const MAX_TRADES = 100;

/**
 * Hook for real-time trades via WebSocket with REST fallback.
 *
 * - Subscribes to 'trades' channel via WS
 * - New trades are prepended to the list with animation
 * - Falls back to REST polling when WS disconnected
 */
export function useRealtimeTrades(limit = 50): {
  trades: TradeEntry[];
  loading: boolean;
  error: string | null;
  wsStatus: WsStatus;
} {
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const channels = useMemo(() => ["trades"], []);

  const handleWsMessage = useCallback(
    (msg: WsMessage): void => {
      if (msg.channel !== "trades") return;

      const data = msg.data as {
        id?: string;
        price: number;
        quantity: number;
        side: "buy" | "sell";
        timestamp: number;
      };

      const entry: TradeEntry = {
        id: data.id ?? `ws-trade-${data.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
        price: data.price,
        quantity: data.quantity,
        side: data.side,
        timestamp: data.timestamp,
      };

      setTrades((prev) => {
        const next = [entry, ...prev].slice(0, MAX_TRADES);
        return next;
      });
      setLoading(false);
      setError(null);
    },
    [],
  );

  const { status: wsStatus } = useWebSocket({
    channels,
    onMessage: handleWsMessage,
  });

  // REST fallback when WebSocket is not connected
  useEffect(() => {
    if (wsStatus === "connected") return;

    const fetchTrades = async (): Promise<void> => {
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
          setLoading(false);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch trades",
          );
          setLoading(false);
        }
      }
    };

    void fetchTrades();
    const interval = setInterval(() => void fetchTrades(), 3000);

    return () => clearInterval(interval);
  }, [wsStatus, limit]);

  // Initial REST fetch for trades list (WS only gives new trades)
  useEffect(() => {
    mountedRef.current = true;

    const fetchInitial = async (): Promise<void> => {
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
          setLoading(false);
        }
      } catch {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    void fetchInitial();

    return () => {
      mountedRef.current = false;
    };
  }, [limit]);

  return { trades, loading, error, wsStatus };
}
