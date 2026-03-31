/**
 * WebSocket server for real-time orderbook data streaming.
 *
 * Port 3101 (separate from REST API on 3100).
 *
 * Channels:
 *   - 'orderbook' — initial snapshot on subscribe, then delta updates
 *   - 'trades' — new trade events as they happen
 *   - 'account:{address}' — balance updates for specific address
 *
 * Client messages:
 *   { subscribe: 'channel' }
 *   { unsubscribe: 'channel' }
 *
 * Server messages:
 *   { channel, data, timestamp }
 *
 * Connection lifecycle:
 *   - connect → subscribe → heartbeat (30s ping) → disconnect
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { OrderbookState } from "../state/orderbook-state.js";
import type { Trade, UserBalances } from "@cash/shared";

// ============================================================
// Types
// ============================================================

/** A connected WebSocket client with subscription tracking */
export interface WsClient {
  ws: WebSocket;
  /** Set of channel names this client is subscribed to */
  subscriptions: Set<string>;
  /** Whether the client is alive (for heartbeat) */
  isAlive: boolean;
}

/** Client-to-server message format */
interface ClientMessage {
  subscribe?: string;
  unsubscribe?: string;
}

/** Server-to-client message format */
export interface ServerMessage {
  channel: string;
  data: unknown;
  timestamp: number;
}

/** Options for creating the WebSocket server */
export interface WsServerOptions {
  /** Port to listen on (default: 3101) */
  port?: number;
  /** Shared orderbook state */
  state: OrderbookState;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatIntervalMs?: number;
}

// ============================================================
// WsServer class
// ============================================================

export class WsServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WsClient> = new Set();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly state: OrderbookState;
  private readonly port: number;
  private readonly heartbeatIntervalMs: number;

  /** Bound event handlers for cleanup */
  private onOrderbookUpdate: ((delta: { bids: Array<{ price: number; quantity: number }>; asks: Array<{ price: number; quantity: number }> }) => void) | null = null;
  private onTrade: ((trade: Trade) => void) | null = null;
  private onBalanceUpdate: ((address: string, balances: UserBalances) => void) | null = null;

  constructor(options: WsServerOptions) {
    this.state = options.state;
    this.port = options.port ?? 3101;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30_000;
  }

  /**
   * Start the WebSocket server.
   */
  start(): void {
    if (this.wss) return;

    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
      this.handleConnection(ws);
    });

    // Start heartbeat interval
    this.heartbeatTimer = setInterval(() => {
      this.heartbeat();
    }, this.heartbeatIntervalMs);

    // Wire up OrderbookState event bus → WS broadcasting
    this.wireStateEvents();

    console.log(`[WS] WebSocket server listening on port ${this.port}`);
  }

  /**
   * Stop the WebSocket server.
   */
  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Remove OrderbookState event listeners
    this.unwireStateEvents();

    // Close all client connections
    for (const client of this.clients) {
      client.ws.close(1001, "Server shutting down");
    }
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  /**
   * Get the number of connected clients.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get the number of subscribers for a specific channel.
   */
  getChannelSubscriberCount(channel: string): number {
    let count = 0;
    for (const client of this.clients) {
      if (client.subscriptions.has(channel)) {
        count++;
      }
    }
    return count;
  }

  // ============================================================
  // Broadcasting
  // ============================================================

  /**
   * Broadcast an orderbook delta update to all 'orderbook' subscribers.
   */
  broadcastOrderbookDelta(delta: {
    bids: Array<{ price: number; quantity: number }>;
    asks: Array<{ price: number; quantity: number }>;
  }): void {
    this.broadcast("orderbook", { type: "delta", ...delta });
  }

  /**
   * Broadcast a new trade to all 'trades' subscribers.
   */
  broadcastTrade(trade: {
    tradeId: string;
    price: number;
    quantity: number;
    side: string;
    timestamp: number;
  }): void {
    this.broadcast("trades", trade);
  }

  /**
   * Broadcast a balance update to a specific account channel.
   */
  broadcastAccountUpdate(
    address: string,
    balances: {
      cash: { available: number; locked: number };
      usdc: { available: number; locked: number };
    },
  ): void {
    this.broadcast(`account:${address}`, balances);
  }

  /**
   * Broadcast a message to all clients subscribed to a channel.
   */
  broadcast(channel: string, data: unknown): void {
    const message: ServerMessage = {
      channel,
      data,
      timestamp: Date.now(),
    };

    const payload = JSON.stringify(message);

    for (const client of this.clients) {
      if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  // ============================================================
  // State event bus wiring
  // ============================================================

  /**
   * Wire OrderbookState events to WebSocket broadcasting.
   * When state processes an event, the appropriate WS channel is notified.
   */
  private wireStateEvents(): void {
    // Orderbook depth changes → 'orderbook' channel delta
    this.onOrderbookUpdate = (delta) => {
      this.broadcastOrderbookDelta(delta);
    };
    this.state.on("orderbookUpdate", this.onOrderbookUpdate);

    // New trades → 'trades' channel
    this.onTrade = (trade) => {
      this.broadcastTrade({
        tradeId: trade.tradeId,
        price: trade.price,
        quantity: trade.quantity,
        side: trade.side,
        timestamp: trade.timestamp,
      });
    };
    this.state.on("trade", this.onTrade);

    // Balance changes → 'account:{address}' channel
    this.onBalanceUpdate = (address, balances) => {
      this.broadcastAccountUpdate(address, balances);
    };
    this.state.on("balanceUpdate", this.onBalanceUpdate);
  }

  /**
   * Remove event listeners from OrderbookState (for clean shutdown).
   */
  private unwireStateEvents(): void {
    if (this.onOrderbookUpdate) {
      this.state.removeListener("orderbookUpdate", this.onOrderbookUpdate);
      this.onOrderbookUpdate = null;
    }
    if (this.onTrade) {
      this.state.removeListener("trade", this.onTrade);
      this.onTrade = null;
    }
    if (this.onBalanceUpdate) {
      this.state.removeListener("balanceUpdate", this.onBalanceUpdate);
      this.onBalanceUpdate = null;
    }
  }

  // ============================================================
  // Connection handling
  // ============================================================

  private handleConnection(ws: WebSocket): void {
    const client: WsClient = {
      ws,
      subscriptions: new Set(),
      isAlive: true,
    };

    this.clients.add(client);

    // Pong handler for heartbeat
    ws.on("pong", () => {
      client.isAlive = true;
    });

    // Message handler
    ws.on("message", (raw: Buffer | string) => {
      this.handleMessage(client, raw);
    });

    // Close handler
    ws.on("close", () => {
      this.clients.delete(client);
    });

    // Error handler
    ws.on("error", (err: Error) => {
      console.error("[WS] Client error:", err.message);
      this.clients.delete(client);
    });
  }

  private handleMessage(client: WsClient, raw: Buffer | string): void {
    try {
      const data = JSON.parse(typeof raw === "string" ? raw : raw.toString()) as ClientMessage;

      if (data.subscribe) {
        this.handleSubscribe(client, data.subscribe);
      } else if (data.unsubscribe) {
        this.handleUnsubscribe(client, data.unsubscribe);
      } else {
        this.sendError(client.ws, "Invalid message format. Use {subscribe: 'channel'} or {unsubscribe: 'channel'}");
      }
    } catch {
      this.sendError(client.ws, "Invalid JSON");
    }
  }

  private handleSubscribe(client: WsClient, channel: string): void {
    // Validate channel name
    if (!this.isValidChannel(channel)) {
      this.sendError(client.ws, `Invalid channel: ${channel}. Valid channels: 'orderbook', 'trades', 'account:{address}'`);
      return;
    }

    client.subscriptions.add(channel);

    // Send initial snapshot for the orderbook channel
    if (channel === "orderbook") {
      const depth = this.state.getDepth();
      const snapshot: ServerMessage = {
        channel: "orderbook",
        data: { type: "snapshot", ...depth },
        timestamp: Date.now(),
      };
      client.ws.send(JSON.stringify(snapshot));
    }

    // Send confirmation
    const confirmation: ServerMessage = {
      channel: "system",
      data: { type: "subscribed", channel },
      timestamp: Date.now(),
    };
    client.ws.send(JSON.stringify(confirmation));
  }

  private handleUnsubscribe(client: WsClient, channel: string): void {
    client.subscriptions.delete(channel);

    const confirmation: ServerMessage = {
      channel: "system",
      data: { type: "unsubscribed", channel },
      timestamp: Date.now(),
    };
    client.ws.send(JSON.stringify(confirmation));
  }

  private isValidChannel(channel: string): boolean {
    if (channel === "orderbook" || channel === "trades") {
      return true;
    }
    // account:{address} — validate the address format loosely
    if (channel.startsWith("account:")) {
      const address = channel.slice(8);
      return address.length > 0;
    }
    return false;
  }

  private sendError(ws: WebSocket, message: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      const errorMsg: ServerMessage = {
        channel: "system",
        data: { type: "error", message },
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(errorMsg));
    }
  }

  /**
   * Heartbeat: ping all clients, terminate unresponsive ones.
   */
  private heartbeat(): void {
    for (const client of this.clients) {
      if (!client.isAlive) {
        // Client didn't respond to last ping — terminate
        client.ws.terminate();
        this.clients.delete(client);
        continue;
      }

      client.isAlive = false;
      client.ws.ping();
    }
  }
}
