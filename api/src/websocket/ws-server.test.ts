/**
 * Tests for the WebSocket server.
 *
 * Tests subscription flow, message format, broadcasting, heartbeat,
 * error handling, and connection lifecycle.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";
import { WsServer } from "./ws-server.js";
import { OrderbookState } from "../state/orderbook-state.js";
import type { ServerMessage } from "./ws-server.js";

// Use a random port range to avoid conflicts
let portCounter = 13100;
function getPort(): number {
  return portCounter++;
}

/**
 * Helper to create a connected WebSocket client.
 */
function connectClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

/**
 * Helper to wait for the next message from a WebSocket client.
 */
function waitForMessage(ws: WebSocket, timeoutMs: number = 2000): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout waiting for message")), timeoutMs);
    ws.once("message", (raw) => {
      clearTimeout(timer);
      resolve(JSON.parse(raw.toString()) as ServerMessage);
    });
  });
}

/**
 * Helper to collect N messages from a WebSocket client.
 */
function collectMessages(ws: WebSocket, count: number, timeoutMs: number = 3000): Promise<ServerMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: ServerMessage[] = [];
    const timer = setTimeout(() => reject(new Error(`Timeout: received ${messages.length}/${count} messages`)), timeoutMs);
    const handler = (raw: Buffer | string): void => {
      messages.push(JSON.parse(raw.toString()) as ServerMessage);
      if (messages.length >= count) {
        clearTimeout(timer);
        ws.removeListener("message", handler);
        resolve(messages);
      }
    };
    ws.on("message", handler);
  });
}

describe("WsServer", () => {
  let server: WsServer;
  let state: OrderbookState;
  let port: number;
  let clients: WebSocket[] = [];

  beforeEach(() => {
    port = getPort();
    state = new OrderbookState();
    server = new WsServer({ port, state, heartbeatIntervalMs: 60_000 });
    server.start();
    clients = [];
  });

  afterEach(() => {
    // Close all test clients
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        client.close();
      }
    }
    server.stop();
  });

  async function connect(): Promise<WebSocket> {
    const ws = await connectClient(port);
    clients.push(ws);
    return ws;
  }

  // ============================================================
  // Connection lifecycle
  // ============================================================

  describe("connection lifecycle", () => {
    it("accepts a WebSocket connection", async () => {
      const ws = await connect();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      expect(server.getClientCount()).toBe(1);
    });

    it("tracks multiple connected clients", async () => {
      await connect();
      await connect();
      await connect();
      expect(server.getClientCount()).toBe(3);
    });

    it("removes client on disconnect", async () => {
      const ws = await connect();
      expect(server.getClientCount()).toBe(1);

      ws.close();
      // Wait a bit for the close event to propagate
      await new Promise((r) => setTimeout(r, 100));
      expect(server.getClientCount()).toBe(0);
    });
  });

  // ============================================================
  // Subscribe / Unsubscribe
  // ============================================================

  describe("subscription flow", () => {
    it("subscribes to 'orderbook' channel and receives snapshot + confirmation", async () => {
      // Add some depth first
      state.processOrderPlaced({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        price: 1_500_000,
        quantity: 100_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 1000,
      });

      const ws = await connect();
      const messagesPromise = collectMessages(ws, 2);

      ws.send(JSON.stringify({ subscribe: "orderbook" }));

      const messages = await messagesPromise;

      // First message should be the orderbook snapshot
      const snapshot = messages[0];
      expect(snapshot.channel).toBe("orderbook");
      expect(snapshot.data).toHaveProperty("type", "snapshot");
      expect(snapshot.data).toHaveProperty("bids");
      expect(snapshot.data).toHaveProperty("asks");
      expect(typeof snapshot.timestamp).toBe("number");

      // Second message should be the subscription confirmation
      const confirmation = messages[1];
      expect(confirmation.channel).toBe("system");
      expect(confirmation.data).toHaveProperty("type", "subscribed");
      expect(confirmation.data).toHaveProperty("channel", "orderbook");
    });

    it("subscribes to 'trades' channel", async () => {
      const ws = await connect();
      const msgPromise = waitForMessage(ws);

      ws.send(JSON.stringify({ subscribe: "trades" }));

      const msg = await msgPromise;
      expect(msg.channel).toBe("system");
      expect(msg.data).toHaveProperty("type", "subscribed");
      expect(msg.data).toHaveProperty("channel", "trades");
    });

    it("subscribes to 'account:{address}' channel", async () => {
      const ws = await connect();
      const msgPromise = waitForMessage(ws);

      ws.send(JSON.stringify({ subscribe: "account:0xBEEF" }));

      const msg = await msgPromise;
      expect(msg.channel).toBe("system");
      expect(msg.data).toHaveProperty("type", "subscribed");
      expect(msg.data).toHaveProperty("channel", "account:0xBEEF");
    });

    it("unsubscribes from a channel", async () => {
      const ws = await connect();

      // Subscribe first
      ws.send(JSON.stringify({ subscribe: "trades" }));
      await waitForMessage(ws); // subscription confirmation

      // Unsubscribe
      const msgPromise = waitForMessage(ws);
      ws.send(JSON.stringify({ unsubscribe: "trades" }));

      const msg = await msgPromise;
      expect(msg.channel).toBe("system");
      expect(msg.data).toHaveProperty("type", "unsubscribed");
      expect(msg.data).toHaveProperty("channel", "trades");
    });

    it("rejects invalid channel name", async () => {
      const ws = await connect();
      const msgPromise = waitForMessage(ws);

      ws.send(JSON.stringify({ subscribe: "invalid_channel" }));

      const msg = await msgPromise;
      expect(msg.channel).toBe("system");
      expect(msg.data).toHaveProperty("type", "error");
    });

    it("rejects invalid JSON", async () => {
      const ws = await connect();
      const msgPromise = waitForMessage(ws);

      ws.send("not json at all");

      const msg = await msgPromise;
      expect(msg.channel).toBe("system");
      expect(msg.data).toHaveProperty("type", "error");
      expect(msg.data).toHaveProperty("message", "Invalid JSON");
    });

    it("rejects empty subscribe/unsubscribe message", async () => {
      const ws = await connect();
      const msgPromise = waitForMessage(ws);

      ws.send(JSON.stringify({ foo: "bar" }));

      const msg = await msgPromise;
      expect(msg.channel).toBe("system");
      expect(msg.data).toHaveProperty("type", "error");
    });
  });

  // ============================================================
  // Server message format
  // ============================================================

  describe("server message format", () => {
    it("all messages have { channel, data, timestamp } shape", async () => {
      const ws = await connect();
      const msgPromise = waitForMessage(ws);

      ws.send(JSON.stringify({ subscribe: "trades" }));

      const msg = await msgPromise;
      expect(msg).toHaveProperty("channel");
      expect(msg).toHaveProperty("data");
      expect(msg).toHaveProperty("timestamp");
      expect(typeof msg.channel).toBe("string");
      expect(typeof msg.timestamp).toBe("number");
    });
  });

  // ============================================================
  // Broadcasting
  // ============================================================

  describe("broadcasting", () => {
    it("broadcasts orderbook delta to subscribed clients", async () => {
      const ws = await connect();

      // Subscribe
      ws.send(JSON.stringify({ subscribe: "orderbook" }));
      // Wait for snapshot + confirmation
      await collectMessages(ws, 2);

      // Broadcast a delta
      const msgPromise = waitForMessage(ws);
      server.broadcastOrderbookDelta({
        bids: [{ price: 1.5, quantity: 100 }],
        asks: [],
      });

      const msg = await msgPromise;
      expect(msg.channel).toBe("orderbook");
      expect(msg.data).toHaveProperty("type", "delta");
      expect(msg.data).toHaveProperty("bids");
      expect(msg.data).toHaveProperty("asks");
    });

    it("broadcasts trade to subscribed clients", async () => {
      const ws = await connect();

      ws.send(JSON.stringify({ subscribe: "trades" }));
      await waitForMessage(ws); // confirmation

      const msgPromise = waitForMessage(ws);
      server.broadcastTrade({
        tradeId: "1",
        price: 1.5,
        quantity: 50,
        side: "buy",
        timestamp: Date.now(),
      });

      const msg = await msgPromise;
      expect(msg.channel).toBe("trades");
      expect(msg.data).toHaveProperty("tradeId", "1");
      expect(msg.data).toHaveProperty("price", 1.5);
      expect(msg.data).toHaveProperty("quantity", 50);
      expect(msg.data).toHaveProperty("side", "buy");
    });

    it("broadcasts account update to specific account channel", async () => {
      const ws = await connect();

      ws.send(JSON.stringify({ subscribe: "account:0xBEEF" }));
      await waitForMessage(ws); // confirmation

      const msgPromise = waitForMessage(ws);
      server.broadcastAccountUpdate("0xBEEF", {
        cash: { available: 100, locked: 10 },
        usdc: { available: 500, locked: 50 },
      });

      const msg = await msgPromise;
      expect(msg.channel).toBe("account:0xBEEF");
      expect(msg.data).toHaveProperty("cash");
      expect(msg.data).toHaveProperty("usdc");
    });

    it("does not send messages to unsubscribed clients", async () => {
      const ws1 = await connect();
      const ws2 = await connect();

      // Only ws1 subscribes to trades
      ws1.send(JSON.stringify({ subscribe: "trades" }));
      await waitForMessage(ws1); // confirmation

      // Broadcast a trade
      const msgPromise = waitForMessage(ws1);
      server.broadcastTrade({
        tradeId: "1",
        price: 1.5,
        quantity: 50,
        side: "buy",
        timestamp: Date.now(),
      });

      const msg = await msgPromise;
      expect(msg.channel).toBe("trades");

      // ws2 should not have received anything
      const ws2MsgPromise = waitForMessage(ws2, 200).catch(() => null);
      const ws2Msg = await ws2MsgPromise;
      expect(ws2Msg).toBeNull();
    });

    it("does not send messages after unsubscribe", async () => {
      const ws = await connect();

      // Subscribe
      ws.send(JSON.stringify({ subscribe: "trades" }));
      await waitForMessage(ws); // confirmation

      // Unsubscribe
      ws.send(JSON.stringify({ unsubscribe: "trades" }));
      await waitForMessage(ws); // unsubscribe confirmation

      // Broadcast — should not reach client
      server.broadcastTrade({
        tradeId: "1",
        price: 1.5,
        quantity: 50,
        side: "buy",
        timestamp: Date.now(),
      });

      const msgPromise = waitForMessage(ws, 200).catch(() => null);
      const msg = await msgPromise;
      expect(msg).toBeNull();
    });

    it("sends to multiple subscribers on same channel", async () => {
      const ws1 = await connect();
      const ws2 = await connect();

      ws1.send(JSON.stringify({ subscribe: "trades" }));
      ws2.send(JSON.stringify({ subscribe: "trades" }));
      await waitForMessage(ws1);
      await waitForMessage(ws2);

      const p1 = waitForMessage(ws1);
      const p2 = waitForMessage(ws2);

      server.broadcastTrade({
        tradeId: "1",
        price: 1.5,
        quantity: 50,
        side: "buy",
        timestamp: Date.now(),
      });

      const [m1, m2] = await Promise.all([p1, p2]);
      expect(m1.channel).toBe("trades");
      expect(m2.channel).toBe("trades");
    });

    it("account updates only go to the correct address channel", async () => {
      const ws1 = await connect();
      const ws2 = await connect();

      ws1.send(JSON.stringify({ subscribe: "account:0xBEEF" }));
      ws2.send(JSON.stringify({ subscribe: "account:0xDEAD" }));
      await waitForMessage(ws1);
      await waitForMessage(ws2);

      // Update for 0xBEEF only
      const p1 = waitForMessage(ws1);
      server.broadcastAccountUpdate("0xBEEF", {
        cash: { available: 100, locked: 0 },
        usdc: { available: 200, locked: 0 },
      });

      const m1 = await p1;
      expect(m1.channel).toBe("account:0xBEEF");

      // ws2 should not have received
      const p2 = waitForMessage(ws2, 200).catch(() => null);
      expect(await p2).toBeNull();
    });
  });

  // ============================================================
  // Channel subscriber count
  // ============================================================

  describe("channel subscriber count", () => {
    it("tracks subscribers per channel", async () => {
      const ws1 = await connect();
      const ws2 = await connect();

      ws1.send(JSON.stringify({ subscribe: "orderbook" }));
      ws2.send(JSON.stringify({ subscribe: "orderbook" }));
      // Wait for both subscriptions to be processed
      await collectMessages(ws1, 2); // snapshot + confirmation
      await collectMessages(ws2, 2);

      expect(server.getChannelSubscriberCount("orderbook")).toBe(2);
      expect(server.getChannelSubscriberCount("trades")).toBe(0);
    });
  });

  // ============================================================
  // Initial orderbook snapshot
  // ============================================================

  describe("orderbook snapshot on subscribe", () => {
    it("sends empty snapshot for empty book", async () => {
      const ws = await connect();
      const messagesPromise = collectMessages(ws, 2);

      ws.send(JSON.stringify({ subscribe: "orderbook" }));

      const messages = await messagesPromise;
      const snapshot = messages[0];
      expect(snapshot.channel).toBe("orderbook");

      const data = snapshot.data as { type: string; bids: unknown[]; asks: unknown[] };
      expect(data.type).toBe("snapshot");
      expect(data.bids).toEqual([]);
      expect(data.asks).toEqual([]);
    });

    it("sends populated snapshot with existing orders", async () => {
      // Place some orders
      state.processOrderPlaced({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        price: 1_500_000,
        quantity: 100_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 1000,
      });

      state.processOrderPlaced({
        order_id: "2",
        owner: "0xDEAD",
        pair_id: 0,
        price: 2_000_000,
        quantity: 50_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 1001,
      });

      const ws = await connect();
      const messagesPromise = collectMessages(ws, 2);

      ws.send(JSON.stringify({ subscribe: "orderbook" }));

      const messages = await messagesPromise;
      const snapshot = messages[0];
      const data = snapshot.data as { type: string; bids: unknown[]; asks: unknown[] };

      expect(data.type).toBe("snapshot");
      expect(data.bids).toHaveLength(1);
      expect(data.asks).toHaveLength(1);
    });
  });
});
