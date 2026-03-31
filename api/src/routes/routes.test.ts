/**
 * Tests for all REST API routes.
 *
 * Uses Hono's built-in test client to test each endpoint.
 * Validates response shapes, status codes, and error handling.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../server.js";
import { OrderbookState } from "../state/orderbook-state.js";
import type { Hono } from "hono";

describe("REST API Routes", () => {
  let app: Hono;
  let state: OrderbookState;

  beforeEach(() => {
    const result = createApp({ startTime: Date.now() - 5000, rateLimitOptions: false });
    app = result.app;
    state = result.state;
  });

  // Helper to make requests
  async function request(
    path: string,
    method: string = "GET",
  ): Promise<Response> {
    return app.request(path, { method });
  }

  // ============================================================
  // GET /health
  // ============================================================

  describe("GET /health", () => {
    it("returns 200 with status ok", async () => {
      const res = await request("/health");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(typeof body.uptime).toBe("number");
      expect(body.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof body.lastIndexedVersion).toBe("number");
    });

    it("reports correct uptime", async () => {
      const res = await request("/health");
      const body = await res.json();
      // Start time was 5 seconds ago
      expect(body.uptime).toBeGreaterThanOrEqual(4);
      expect(body.uptime).toBeLessThanOrEqual(10);
    });
  });

  // ============================================================
  // GET /depth
  // ============================================================

  describe("GET /depth", () => {
    it("returns empty depth for empty book", async () => {
      const res = await request("/depth");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.bids).toEqual([]);
      expect(body.asks).toEqual([]);
    });

    it("returns sorted bids (desc) and asks (asc) with cumulative total", async () => {
      // Add some bids
      state.processOrderPlaced({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        price: 1_000_000,
        quantity: 10_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 1000,
      });

      state.processOrderPlaced({
        order_id: "2",
        owner: "0xBEEF",
        pair_id: 0,
        price: 2_000_000,
        quantity: 20_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 1001,
      });

      // Add some asks
      state.processOrderPlaced({
        order_id: "3",
        owner: "0xDEAD",
        pair_id: 0,
        price: 3_000_000,
        quantity: 30_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 1002,
      });

      state.processOrderPlaced({
        order_id: "4",
        owner: "0xDEAD",
        pair_id: 0,
        price: 2_500_000,
        quantity: 25_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 1003,
      });

      const res = await request("/depth");
      expect(res.status).toBe(200);

      const body = await res.json();

      // Bids: descending by price
      expect(body.bids).toHaveLength(2);
      expect(body.bids[0].price).toBe(2.0);
      expect(body.bids[0].quantity).toBe(20);
      expect(body.bids[0].total).toBe(20);
      expect(body.bids[1].price).toBe(1.0);
      expect(body.bids[1].quantity).toBe(10);
      expect(body.bids[1].total).toBe(30);

      // Asks: ascending by price
      expect(body.asks).toHaveLength(2);
      expect(body.asks[0].price).toBe(2.5);
      expect(body.asks[0].quantity).toBe(25);
      expect(body.asks[0].total).toBe(25);
      expect(body.asks[1].price).toBe(3.0);
      expect(body.asks[1].quantity).toBe(30);
      expect(body.asks[1].total).toBe(55);
    });
  });

  // ============================================================
  // GET /trades
  // ============================================================

  describe("GET /trades", () => {
    it("returns empty array for no trades", async () => {
      const res = await request("/trades");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual([]);
    });

    it("returns trades in correct format", async () => {
      state.processTrade({
        taker_order_id: "1",
        maker_order_id: "2",
        price: 1_500_000,
        quantity: 50_000_000,
        quote_amount: 75_000_000,
        buyer: "0xA",
        seller: "0xB",
        pair_id: 0,
        taker_is_bid: true,
      });

      const res = await request("/trades");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0]).toHaveProperty("id");
      expect(body[0]).toHaveProperty("price", 1.5);
      expect(body[0]).toHaveProperty("quantity", 50);
      expect(body[0]).toHaveProperty("side", "buy");
      expect(body[0]).toHaveProperty("timestamp");
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 10; i++) {
        state.processTrade({
          taker_order_id: String(i),
          maker_order_id: String(i + 100),
          price: 1_000_000,
          quantity: 1_000_000,
          quote_amount: 1_000_000,
          buyer: "0xA",
          seller: "0xB",
          pair_id: 0,
          taker_is_bid: true,
        });
      }

      const res = await request("/trades?limit=5");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveLength(5);
    });

    it("returns 400 for invalid limit", async () => {
      const res = await request("/trades?limit=abc");
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("message");
    });

    it("returns 400 for limit=0", async () => {
      const res = await request("/trades?limit=0");
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("INVALID_PARAMS");
    });

    it("returns 400 for limit > 1000", async () => {
      const res = await request("/trades?limit=1001");
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // GET /orders/:address
  // ============================================================

  describe("GET /orders/:address", () => {
    it("returns empty array for address with no orders", async () => {
      const res = await request("/orders/0x1234abcd");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual([]);
    });

    it("returns orders for address in correct format", async () => {
      state.processOrderPlaced({
        order_id: "42",
        owner: "0xBEEF",
        pair_id: 0,
        price: 1_500_000,
        quantity: 100_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 1000,
      });

      const res = await request("/orders/0xBEEF");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0]).toHaveProperty("orderId", "42");
      expect(body[0]).toHaveProperty("price", 1.5);
      expect(body[0]).toHaveProperty("quantity", 100);
      expect(body[0]).toHaveProperty("remaining", 100);
      expect(body[0]).toHaveProperty("side", "buy");
      expect(body[0]).toHaveProperty("type", "GTC");
    });

    it("returns 400 for invalid address", async () => {
      const res = await request("/orders/not-an-address");
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("INVALID_ADDRESS");
      expect(body).toHaveProperty("message");
    });

    it("returns 400 for address without 0x prefix", async () => {
      const res = await request("/orders/1234abcd");
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("INVALID_ADDRESS");
    });

    it("returns 400 for empty address after 0x", async () => {
      const res = await request("/orders/0x");
      expect(res.status).toBe(400);
    });

    it("accepts valid long hex address", async () => {
      const longAddr = "0x" + "a".repeat(64);
      const res = await request(`/orders/${longAddr}`);
      expect(res.status).toBe(200);
    });
  });

  // ============================================================
  // GET /candles
  // ============================================================

  describe("GET /candles", () => {
    it("returns empty array when no candles", async () => {
      const res = await request("/candles");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual([]);
    });

    it("returns candles in OHLCV format", async () => {
      state.processTrade({
        taker_order_id: "1",
        maker_order_id: "2",
        price: 1_500_000,
        quantity: 10_000_000,
        quote_amount: 15_000_000,
        buyer: "0xA",
        seller: "0xB",
        pair_id: 0,
        taker_is_bid: true,
      });

      const res = await request("/candles?interval=1m");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0]).toHaveProperty("open");
      expect(body[0]).toHaveProperty("high");
      expect(body[0]).toHaveProperty("low");
      expect(body[0]).toHaveProperty("close");
      expect(body[0]).toHaveProperty("volume");
      expect(body[0]).toHaveProperty("timestamp");
    });

    it("defaults to 1m interval", async () => {
      state.processTrade({
        taker_order_id: "1",
        maker_order_id: "2",
        price: 1_000_000,
        quantity: 1_000_000,
        quote_amount: 1_000_000,
        buyer: "0xA",
        seller: "0xB",
        pair_id: 0,
        taker_is_bid: true,
      });

      const res = await request("/candles");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveLength(1);
    });

    it("accepts valid intervals", async () => {
      for (const interval of ["1m", "5m", "15m", "1h", "1d"]) {
        const res = await request(`/candles?interval=${interval}`);
        expect(res.status).toBe(200);
      }
    });

    it("returns 400 for invalid interval", async () => {
      const res = await request("/candles?interval=3m");
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("INVALID_PARAMS");
    });
  });

  // ============================================================
  // GET /market
  // ============================================================

  describe("GET /market", () => {
    it("returns market info", async () => {
      const res = await request("/market");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty("pair", "CASH/USDC");
      expect(body).toHaveProperty("baseAsset", "CASH");
      expect(body).toHaveProperty("quoteAsset", "USDC");
      expect(body).toHaveProperty("lotSize");
      expect(body).toHaveProperty("tickSize");
      expect(body).toHaveProperty("lastPrice");
      expect(body).toHaveProperty("volume24h");
    });

    it("reflects last trade price", async () => {
      state.processTrade({
        taker_order_id: "1",
        maker_order_id: "2",
        price: 1_500_000,
        quantity: 10_000_000,
        quote_amount: 15_000_000,
        buyer: "0xA",
        seller: "0xB",
        pair_id: 0,
        taker_is_bid: true,
      });

      const res = await request("/market");
      const body = await res.json();
      expect(body.lastPrice).toBe(1.5);
      expect(body.volume24h).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // GET /balances/:address
  // ============================================================

  describe("GET /balances/:address", () => {
    it("returns zeroed balances for unknown address", async () => {
      const res = await request("/balances/0x1234abcd");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.cash).toEqual({ available: 0, locked: 0 });
      expect(body.usdc).toEqual({ available: 0, locked: 0 });
    });

    it("returns correct balances after deposit", async () => {
      state.processDeposit({
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 1000_000_000,
      });

      const res = await request("/balances/0xBEEF");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.usdc.available).toBe(1000);
      expect(body.usdc.locked).toBe(0);
    });

    it("returns 400 for invalid address", async () => {
      const res = await request("/balances/invalid");
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("INVALID_ADDRESS");
      expect(body).toHaveProperty("message");
    });
  });

  // ============================================================
  // 404 Not Found
  // ============================================================

  describe("404 handling", () => {
    it("returns 404 for unknown route", async () => {
      const res = await request("/nonexistent");
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe("NOT_FOUND");
      expect(body).toHaveProperty("message");
    });
  });

  // ============================================================
  // Error Response Shape
  // ============================================================

  describe("error response shape", () => {
    it("all error responses have { error, message } shape", async () => {
      // 400 - invalid address
      const res400 = await request("/orders/not-valid");
      const body400 = await res400.json();
      expect(body400).toHaveProperty("error");
      expect(body400).toHaveProperty("message");
      expect(typeof body400.error).toBe("string");
      expect(typeof body400.message).toBe("string");

      // 404 - not found
      const res404 = await request("/nonexistent");
      const body404 = await res404.json();
      expect(body404).toHaveProperty("error");
      expect(body404).toHaveProperty("message");
    });
  });
});
