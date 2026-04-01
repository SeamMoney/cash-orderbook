/**
 * Tests for OrderbookState EventEmitter integration.
 *
 * Verifies that state mutations emit the correct events for
 * the WebSocket server to broadcast.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OrderbookState } from "./orderbook-state.js";
import type { Trade, UserBalances } from "@cash/shared";

describe("OrderbookState EventEmitter", () => {
  let state: OrderbookState;

  beforeEach(() => {
    state = new OrderbookState();
  });

  // ============================================================
  // orderbookUpdate events
  // ============================================================

  describe("orderbookUpdate events", () => {
    it("emits orderbookUpdate when a GTC bid is placed", () => {
      const handler = vi.fn();
      state.on("orderbookUpdate", handler);

      state.processOrderPlaced({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        price: 1_500_000,
        quantity: 100_000_000,
        is_bid: true,
        order_type: 0, // GTC
        timestamp: 1000,
      });

      expect(handler).toHaveBeenCalledTimes(1);
      const delta = handler.mock.calls[0][0];
      expect(delta.bids).toHaveLength(1);
      expect(delta.bids[0].price).toBe(1.5);
      expect(delta.bids[0].quantity).toBe(100);
      expect(delta.asks).toHaveLength(0);
    });

    it("emits orderbookUpdate when a GTC ask is placed", () => {
      const handler = vi.fn();
      state.on("orderbookUpdate", handler);

      state.processOrderPlaced({
        order_id: "1",
        owner: "0xDEAD",
        pair_id: 0,
        price: 2_000_000,
        quantity: 50_000_000,
        is_bid: false,
        order_type: 0, // GTC
        timestamp: 1000,
      });

      expect(handler).toHaveBeenCalledTimes(1);
      const delta = handler.mock.calls[0][0];
      expect(delta.asks).toHaveLength(1);
      expect(delta.asks[0].price).toBe(2.0);
      expect(delta.asks[0].quantity).toBe(50);
      expect(delta.bids).toHaveLength(0);
    });

    it("does not emit orderbookUpdate for IOC orders (they don't rest)", () => {
      const handler = vi.fn();
      state.on("orderbookUpdate", handler);

      state.processOrderPlaced({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        price: 1_500_000,
        quantity: 100_000_000,
        is_bid: true,
        order_type: 1, // IOC
        timestamp: 1000,
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it("emits orderbookUpdate when an order is cancelled", () => {
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

      const handler = vi.fn();
      state.on("orderbookUpdate", handler);

      state.processOrderCancelled({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        remaining_quantity: 100_000_000,
        is_bid: true,
        price: 1_500_000,
      });

      expect(handler).toHaveBeenCalledTimes(1);
      const delta = handler.mock.calls[0][0];
      expect(delta.bids).toHaveLength(1);
      expect(delta.bids[0].price).toBe(1.5);
      expect(delta.bids[0].quantity).toBe(0); // fully removed
    });

    it("emits orderbookUpdate with remaining quantity when partial cancel at price level", () => {
      // Place two orders at same price
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
        owner: "0xCAFE",
        pair_id: 0,
        price: 1_500_000,
        quantity: 50_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 1001,
      });

      const handler = vi.fn();
      state.on("orderbookUpdate", handler);

      // Cancel just one
      state.processOrderCancelled({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        remaining_quantity: 100_000_000,
        is_bid: true,
        price: 1_500_000,
      });

      expect(handler).toHaveBeenCalledTimes(1);
      const delta = handler.mock.calls[0][0];
      expect(delta.bids[0].quantity).toBe(50); // 50 remaining from order #2
    });

    it("emits orderbookUpdate on trade (maker depth removed)", () => {
      // Place a maker ask
      state.processOrderPlaced({
        order_id: "100",
        owner: "0xSELLER",
        pair_id: 0,
        price: 2_000_000,
        quantity: 50_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 1000,
      });

      const handler = vi.fn();
      state.on("orderbookUpdate", handler);

      // Trade fully fills the ask
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

      expect(handler).toHaveBeenCalledTimes(1);
      const delta = handler.mock.calls[0][0];
      expect(delta.asks).toHaveLength(1);
      expect(delta.asks[0].price).toBe(2.0);
      expect(delta.asks[0].quantity).toBe(0); // fully removed
    });
  });

  // ============================================================
  // trade events
  // ============================================================

  describe("trade events", () => {
    it("emits trade event on processTrade", () => {
      const handler = vi.fn();
      state.on("trade", handler);

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

      expect(handler).toHaveBeenCalledTimes(1);
      const trade: Trade = handler.mock.calls[0][0];
      expect(trade.price).toBe(1.5);
      expect(trade.quantity).toBe(50);
      expect(trade.side).toBe("buy");
      expect(trade.tradeId).toBeTruthy();
    });
  });

  // ============================================================
  // balanceUpdate events
  // ============================================================

  describe("balanceUpdate events", () => {
    it("emits balanceUpdate on deposit", () => {
      const handler = vi.fn();
      state.on("balanceUpdate", handler);

      state.processDeposit({
        user: "0xBEEF",
        asset: "0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67::CASH::CASH",
        amount: 500_000_000,
      });

      expect(handler).toHaveBeenCalledTimes(1);
      const [address, balances] = handler.mock.calls[0];
      expect(address).toBe("0xBEEF");
      expect(balances.cash.available).toBe(500);
    });

    it("emits balanceUpdate on withdraw", () => {
      state.processDeposit({
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 100_000_000_000, // 1000 USD1 (8 decimals)
      });

      const handler = vi.fn();
      state.on("balanceUpdate", handler);

      state.processWithdraw({
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 30_000_000_000, // 300 USD1 (8 decimals)
      });

      expect(handler).toHaveBeenCalledTimes(1);
      const [address, balances] = handler.mock.calls[0];
      expect(address).toBe("0xBEEF");
      expect(balances.usdc.available).toBe(700);
    });

    it("emits balanceUpdate for buyer and seller on trade", () => {
      const handler = vi.fn();
      state.on("balanceUpdate", handler);

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

      // Both buyer and seller should receive balance updates
      expect(handler).toHaveBeenCalledTimes(2);
      const addresses = handler.mock.calls.map((c: unknown[]) => c[0]);
      expect(addresses).toContain("0xBUYER");
      expect(addresses).toContain("0xSELLER");
    });

    it("emits balanceUpdate on order placement (locked changes)", () => {
      const handler = vi.fn();
      state.on("balanceUpdate", handler);

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

      // At least 1 balanceUpdate for the order placer
      const calls = handler.mock.calls.filter((c: unknown[]) => c[0] === "0xBEEF");
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });

    it("emits balanceUpdate on order cancel (unlocked)", () => {
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

      const handler = vi.fn();
      state.on("balanceUpdate", handler);

      state.processOrderCancelled({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        remaining_quantity: 100_000_000,
        is_bid: true,
        price: 1_500_000,
      });

      const calls = handler.mock.calls.filter((c: unknown[]) => c[0] === "0xBEEF");
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
  });
});
