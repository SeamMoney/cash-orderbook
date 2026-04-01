/**
 * Tests for WebSocket broadcasting from live state updates.
 *
 * When OrderbookState processes an event, the WS server should
 * automatically broadcast to subscribed clients via the event bus.
 *
 * These tests validate the end-to-end wiring:
 *   State mutation → EventEmitter → WsServer → Client WebSocket
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";
import { WsServer } from "./ws-server.js";
import { OrderbookState } from "../state/orderbook-state.js";
import type { ServerMessage } from "./ws-server.js";

// Port range for these tests to avoid conflicts with other test files
let portCounter = 14100;
function getPort(): number {
  return portCounter++;
}

function connectClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitForMessage(ws: WebSocket, timeoutMs: number = 2000): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout waiting for message")), timeoutMs);
    ws.once("message", (raw) => {
      clearTimeout(timer);
      resolve(JSON.parse(raw.toString()) as ServerMessage);
    });
  });
}

function collectMessages(ws: WebSocket, count: number, timeoutMs: number = 3000): Promise<ServerMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: ServerMessage[] = [];
    const timer = setTimeout(() => reject(new Error(`Timeout: got ${messages.length}/${count}`)), timeoutMs);
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

describe("WS broadcasting from live state updates", () => {
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
  // Orderbook channel: auto-broadcast on depth changes
  // ============================================================

  describe("orderbook channel auto-broadcast", () => {
    it("broadcasts delta when an order is placed via state", async () => {
      const ws = await connect();

      // Subscribe to orderbook
      ws.send(JSON.stringify({ subscribe: "orderbook" }));
      // Receive snapshot + confirmation
      await collectMessages(ws, 2);

      // Now place an order through the state — should trigger auto-broadcast
      const msgPromise = waitForMessage(ws);

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

      const msg = await msgPromise;
      expect(msg.channel).toBe("orderbook");
      expect(msg.data).toHaveProperty("type", "delta");
      const data = msg.data as { type: string; bids: Array<{ price: number; quantity: number }>; asks: unknown[] };
      expect(data.bids).toHaveLength(1);
      expect(data.bids[0].price).toBe(1.5);
      expect(data.bids[0].quantity).toBe(100);
    });

    it("broadcasts delta when an order is cancelled via state", async () => {
      // Pre-place an order
      state.processOrderPlaced({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        price: 2_000_000,
        quantity: 50_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 1000,
      });

      const ws = await connect();
      ws.send(JSON.stringify({ subscribe: "orderbook" }));
      await collectMessages(ws, 2);

      const msgPromise = waitForMessage(ws);

      state.processOrderCancelled({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        remaining_quantity: 50_000_000,
        is_bid: false,
        price: 2_000_000,
      });

      const msg = await msgPromise;
      expect(msg.channel).toBe("orderbook");
      const data = msg.data as { type: string; asks: Array<{ price: number; quantity: number }> };
      expect(data.type).toBe("delta");
      expect(data.asks).toHaveLength(1);
      expect(data.asks[0].quantity).toBe(0); // removed
    });

    it("broadcasts delta when a trade reduces depth", async () => {
      // Place a resting ask
      state.processOrderPlaced({
        order_id: "100",
        owner: "0xSELLER",
        pair_id: 0,
        price: 2_000_000,
        quantity: 80_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 1000,
      });

      const ws = await connect();
      ws.send(JSON.stringify({ subscribe: "orderbook" }));
      await collectMessages(ws, 2);

      const msgPromise = waitForMessage(ws);

      // Partial fill: 30 of 80
      state.processTrade({
        taker_order_id: "200",
        maker_order_id: "100",
        price: 2_000_000,
        quantity: 30_000_000,
        quote_amount: 60_000_000,
        buyer: "0xBUYER",
        seller: "0xSELLER",
        pair_id: 0,
        taker_is_bid: true,
      });

      const msg = await msgPromise;
      expect(msg.channel).toBe("orderbook");
      const data = msg.data as { type: string; asks: Array<{ price: number; quantity: number }> };
      expect(data.type).toBe("delta");
      expect(data.asks[0].quantity).toBe(50); // 80 - 30
    });
  });

  // ============================================================
  // Trades channel: auto-broadcast on fills
  // ============================================================

  describe("trades channel auto-broadcast", () => {
    it("broadcasts new trade when processTrade is called on state", async () => {
      const ws = await connect();

      ws.send(JSON.stringify({ subscribe: "trades" }));
      await waitForMessage(ws); // confirmation

      const msgPromise = waitForMessage(ws);

      state.processTrade({
        taker_order_id: "200",
        maker_order_id: "100",
        price: 1_500_000,
        quantity: 50_000_000,
        quote_amount: 75_000_000,
        buyer: "0xBUYER",
        seller: "0xSELLER",
        pair_id: 0,
        taker_is_bid: true,
      });

      const msg = await msgPromise;
      expect(msg.channel).toBe("trades");
      const trade = msg.data as { tradeId: string; price: number; quantity: number; side: string };
      expect(trade.price).toBe(1.5);
      expect(trade.quantity).toBe(50);
      expect(trade.side).toBe("buy");
    });

    it("multiple trades are all broadcast", async () => {
      const ws = await connect();

      ws.send(JSON.stringify({ subscribe: "trades" }));
      await waitForMessage(ws); // confirmation

      const messages: ServerMessage[] = [];
      const collectP = collectMessages(ws, 3);

      // Process 3 trades
      for (let i = 0; i < 3; i++) {
        state.processTrade({
          taker_order_id: `T${i}`,
          maker_order_id: `M${i}`,
          price: (1 + i) * 1_000_000,
          quantity: 10_000_000,
          quote_amount: 10_000_000,
          buyer: "0xA",
          seller: "0xB",
          pair_id: 0,
          taker_is_bid: true,
        });
      }

      const msgs = await collectP;
      expect(msgs).toHaveLength(3);
      for (const m of msgs) {
        expect(m.channel).toBe("trades");
      }
    });
  });

  // ============================================================
  // Account channel: auto-broadcast on balance changes
  // ============================================================

  describe("account channel auto-broadcast", () => {
    it("broadcasts balance update on deposit", async () => {
      const ws = await connect();

      ws.send(JSON.stringify({ subscribe: "account:0xBEEF" }));
      await waitForMessage(ws); // confirmation

      const msgPromise = waitForMessage(ws);

      state.processDeposit({
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 50_000_000_000, // 500 USD1 (8 decimals)
      });

      const msg = await msgPromise;
      expect(msg.channel).toBe("account:0xBEEF");
      const balances = msg.data as { usdc: { available: number } };
      expect(balances.usdc.available).toBe(500);
    });

    it("broadcasts balance update on withdraw", async () => {
      state.processDeposit({
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 100_000_000_000, // 1000 USD1 (8 decimals)
      });

      const ws = await connect();
      ws.send(JSON.stringify({ subscribe: "account:0xBEEF" }));
      await waitForMessage(ws); // confirmation

      const msgPromise = waitForMessage(ws);

      state.processWithdraw({
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 30_000_000_000, // 300 USD1 (8 decimals)
      });

      const msg = await msgPromise;
      expect(msg.channel).toBe("account:0xBEEF");
      const balances = msg.data as { usdc: { available: number } };
      expect(balances.usdc.available).toBe(700);
    });

    it("broadcasts balance update for buyer on trade", async () => {
      const ws = await connect();
      ws.send(JSON.stringify({ subscribe: "account:0xBUYER" }));
      await waitForMessage(ws); // confirmation

      const msgPromise = waitForMessage(ws);

      state.processTrade({
        taker_order_id: "200",
        maker_order_id: "100",
        price: 2_000_000,
        quantity: 50_000_000,
        quote_amount: 100_000_000,
        buyer: "0xBUYER",
        seller: "0xSELLER",
        pair_id: 0,
        taker_is_bid: true,
      });

      const msg = await msgPromise;
      expect(msg.channel).toBe("account:0xBUYER");
      const balances = msg.data as { cash: { available: number } };
      expect(balances.cash.available).toBe(50);
    });

    it("does not broadcast to wrong account channel", async () => {
      const ws = await connect();
      ws.send(JSON.stringify({ subscribe: "account:0xOTHER" }));
      await waitForMessage(ws); // confirmation

      // Deposit for a different user
      state.processDeposit({
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 500_000_000,
      });

      // Should not receive anything
      const timeoutMsg = await waitForMessage(ws, 200).catch(() => null);
      expect(timeoutMsg).toBeNull();
    });
  });

  // ============================================================
  // End-to-end: full order lifecycle via state triggers WS
  // ============================================================

  describe("end-to-end: state mutations drive WS broadcasts", () => {
    it("full lifecycle: place → trade → fill triggers orderbook + trade + account broadcasts", async () => {
      const orderbookClient = await connect();
      const tradesClient = await connect();
      const accountClient = await connect();

      // Subscribe each to their channel
      orderbookClient.send(JSON.stringify({ subscribe: "orderbook" }));
      tradesClient.send(JSON.stringify({ subscribe: "trades" }));
      accountClient.send(JSON.stringify({ subscribe: "account:0xBUYER" }));

      // Wait for initial subscription messages
      await collectMessages(orderbookClient, 2); // snapshot + confirmation
      await waitForMessage(tradesClient);
      await waitForMessage(accountClient);

      // Collect messages from all three channels
      const orderbookP = collectMessages(orderbookClient, 2); // place + trade deltas
      const tradeP = waitForMessage(tradesClient);
      const accountP = waitForMessage(accountClient);

      // Place a maker ask
      state.processOrderPlaced({
        order_id: "100",
        owner: "0xSELLER",
        pair_id: 0,
        price: 1_500_000,
        quantity: 50_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 1000,
      });

      // Trade fills the ask
      state.processTrade({
        taker_order_id: "200",
        maker_order_id: "100",
        price: 1_500_000,
        quantity: 50_000_000,
        quote_amount: 75_000_000,
        buyer: "0xBUYER",
        seller: "0xSELLER",
        pair_id: 0,
        taker_is_bid: true,
      });

      // Verify all broadcasts happened
      const orderbookMsgs = await orderbookP;
      expect(orderbookMsgs[0].channel).toBe("orderbook");
      expect(orderbookMsgs[1].channel).toBe("orderbook");

      const tradeMsg = await tradeP;
      expect(tradeMsg.channel).toBe("trades");
      const tradeData = tradeMsg.data as { price: number; quantity: number };
      expect(tradeData.price).toBe(1.5);
      expect(tradeData.quantity).toBe(50);

      const accountMsg = await accountP;
      expect(accountMsg.channel).toBe("account:0xBUYER");
    });
  });
});
