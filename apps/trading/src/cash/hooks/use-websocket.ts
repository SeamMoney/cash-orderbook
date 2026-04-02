import { useState, useEffect, useRef, useCallback } from "react";
import { WS_URL as DEFAULT_WS_URL } from "../lib/config";

/** WebSocket connection status */
export type WsStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

/** Message received from WebSocket */
export interface WsMessage<T = unknown> {
  channel: string;
  data: T;
  timestamp: number;
}

/** Configuration for the WebSocket hook */
interface UseWebSocketOptions {
  /** WebSocket server URL (default: from env or ws://localhost:3101) */
  url?: string;
  /** Channels to subscribe to */
  channels: string[];
  /** Whether the WebSocket should be enabled (default: true) */
  enabled?: boolean;
  /** Callback when a message is received */
  onMessage?: (message: WsMessage) => void;
}

const WS_URL = DEFAULT_WS_URL;
const MIN_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

/**
 * Hook for WebSocket connection with automatic reconnection (exponential backoff).
 *
 * Connects to ws://localhost:3101, subscribes to given channels.
 * On disconnect, reconnects with exponential backoff (1s, 2s, 4s, ... max 30s).
 * Exposes connection status and last message.
 */
export function useWebSocket({
  url = WS_URL,
  channels,
  enabled = true,
  onMessage,
}: UseWebSocketOptions): {
  status: WsStatus;
  lastMessage: WsMessage | null;
  send: (data: unknown) => void;
} {
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(MIN_RECONNECT_DELAY);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const channelsRef = useRef(channels);
  const onMessageRef = useRef(onMessage);

  // Keep refs up to date
  channelsRef.current = channels;
  onMessageRef.current = onMessage;

  const clearReconnectTimer = useCallback((): void => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const subscribe = useCallback((ws: WebSocket, chans: string[]): void => {
    for (const channel of chans) {
      ws.send(JSON.stringify({ subscribe: channel }));
    }
  }, []);

  const connect = useCallback((): void => {
    if (!mountedRef.current || !enabled) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    setStatus("connecting");

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = (): void => {
        if (!mountedRef.current) return;
        setStatus("connected");
        reconnectDelayRef.current = MIN_RECONNECT_DELAY;
        // Subscribe to all channels
        subscribe(ws, channelsRef.current);
      };

      ws.onmessage = (event: MessageEvent): void => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(String(event.data)) as WsMessage;
          setLastMessage(msg);
          onMessageRef.current?.(msg);
        } catch {
          // Ignore non-JSON messages (e.g., pong frames)
        }
      };

      ws.onclose = (): void => {
        if (!mountedRef.current) return;
        wsRef.current = null;
        setStatus("reconnecting");

        // Schedule reconnection with exponential backoff
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(
          delay * 2,
          MAX_RECONNECT_DELAY,
        );

        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, delay);
      };

      ws.onerror = (): void => {
        // onclose will fire after onerror, so reconnection is handled there
      };
    } catch {
      // Connection failed, schedule retry
      if (mountedRef.current) {
        setStatus("reconnecting");
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(
          delay * 2,
          MAX_RECONNECT_DELAY,
        );
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, delay);
      }
    }
  }, [url, enabled, subscribe, clearReconnectTimer]);

  // Connect on mount / reconnect when channels change
  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      clearReconnectTimer();

      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled, clearReconnectTimer]);

  // Re-subscribe when channels change while connected
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      subscribe(wsRef.current, channels);
    }
  }, [channels, subscribe]);

  const send = useCallback((data: unknown): void => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { status, lastMessage, send };
}
