"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useWebSocket, type WsMessage } from "@/hooks/use-websocket";

/** Price flash direction for green/red animation */
export type PriceFlashDirection = "up" | "down" | null;

/**
 * Hook that subscribes to the WebSocket 'trades' channel and tracks
 * real-time price changes for the token header.
 *
 * Returns the latest price from trades and a flash direction that
 * resets after 400ms — used to trigger green (up) or red (down) flash
 * animations in the token header.
 */
export function useRealtimePrice(): {
  /** Latest price from WebSocket trades (null if no trades received yet) */
  realtimePrice: number | null;
  /** Flash direction: "up" (green), "down" (red), or null (no flash) */
  flashDirection: PriceFlashDirection;
} {
  const [realtimePrice, setRealtimePrice] = useState<number | null>(null);
  const [flashDirection, setFlashDirection] = useState<PriceFlashDirection>(null);
  const prevPriceRef = useRef<number | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const channels = useMemo(() => ["trades"], []);

  const handleMessage = useCallback((msg: WsMessage): void => {
    if (msg.channel !== "trades") return;

    const data = msg.data as { price?: number };
    if (!data || typeof data.price !== "number") return;

    const newPrice = data.price;
    const prevPrice = prevPriceRef.current;

    setRealtimePrice(newPrice);
    prevPriceRef.current = newPrice;

    // Determine flash direction
    if (prevPrice !== null && newPrice !== prevPrice) {
      const direction: PriceFlashDirection = newPrice > prevPrice ? "up" : "down";
      setFlashDirection(direction);

      // Clear any existing flash timer
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }

      // Reset flash after 400ms
      flashTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setFlashDirection(null);
        }
      }, 400);
    }
  }, []);

  useWebSocket({
    channels,
    onMessage: handleMessage,
  });

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  return { realtimePrice, flashDirection };
}
