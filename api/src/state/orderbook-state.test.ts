/**
 * Tests for OrderbookState — in-memory orderbook state management.
 *
 * Tests event processing for all contract events and state queries.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { OrderbookState } from "./orderbook-state.js";
import { PRICE_SCALE, CASH_DECIMALS, USD1_DECIMALS } from "@cash/shared";

describe("OrderbookState", () => {
  let state: OrderbookState;

  beforeEach(() => {
    state = new OrderbookState();
  });

  // ============================================================
  // Initial State
  // ============================================================

  describe("initial state", () => {
    it("returns empty depth", () => {
      const depth = state.getDepth();
      expect(depth.bids).toEqual([]);
      expect(depth.asks).toEqual([]);
    });

    it("returns empty trades", () => {
      expect(state.getTrades()).toEqual([]);
    });

    it("returns zeroed balances for unknown address", () => {
      const balances = state.getBalances("0x1234");
      expect(balances.cash.available).toBe(0);
      expect(balances.cash.locked).toBe(0);
      expect(balances.usdc.available).toBe(0);
      expect(balances.usdc.locked).toBe(0);
    });

    it("returns empty candles", () => {
      expect(state.getCandles("1m")).toEqual([]);
      expect(state.getCandles("1h")).toEqual([]);
    });

    it("returns default market info", () => {
      const info = state.getMarketInfo();
      expect(info.pair).toBe("CASH/USDC");
      expect(info.lastPrice).toBe(0);
      expect(info.volume24h).toBe(0);
    });

    it("returns 0 for lastIndexedVersion", () => {
      expect(state.getLastIndexedVersion()).toBe(0);
    });
  });

  // ============================================================
  // OrderPlaced Processing
  // ============================================================

  describe("processOrderPlaced", () => {
    it("adds a bid to depth", () => {
      state.processOrderPlaced({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        price: 1_500_000, // 1.5 USDC
        quantity: 100_000_000, // 100 CASH
        is_bid: true,
        order_type: 0, // GTC
        timestamp: 1000,
      });

      const depth = state.getDepth();
      expect(depth.bids).toHaveLength(1);
      expect(depth.bids[0].price).toBe(1.5);
      expect(depth.bids[0].quantity).toBe(100);
      expect(depth.bids[0].total).toBe(100);
    });

    it("adds an ask to depth", () => {
      state.processOrderPlaced({
        order_id: "2",
        owner: "0xDEAD",
        pair_id: 0,
        price: 2_000_000, // 2.0 USDC
        quantity: 50_000_000, // 50 CASH
        is_bid: false,
        order_type: 0, // GTC
        timestamp: 1001,
      });

      const depth = state.getDepth();
      expect(depth.asks).toHaveLength(1);
      expect(depth.asks[0].price).toBe(2.0);
      expect(depth.asks[0].quantity).toBe(50);
    });

    it("aggregates quantity at same price level", () => {
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

      const depth = state.getDepth();
      expect(depth.bids).toHaveLength(1);
      expect(depth.bids[0].quantity).toBe(150);
    });

    it("sorts bids descending by price", () => {
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

      state.processOrderPlaced({
        order_id: "3",
        owner: "0xBEEF",
        pair_id: 0,
        price: 1_500_000,
        quantity: 15_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 1002,
      });

      const depth = state.getDepth();
      expect(depth.bids).toHaveLength(3);
      expect(depth.bids[0].price).toBe(2.0);
      expect(depth.bids[1].price).toBe(1.5);
      expect(depth.bids[2].price).toBe(1.0);
    });

    it("sorts asks ascending by price", () => {
      state.processOrderPlaced({
        order_id: "1",
        owner: "0xDEAD",
        pair_id: 0,
        price: 3_000_000,
        quantity: 30_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 1000,
      });

      state.processOrderPlaced({
        order_id: "2",
        owner: "0xDEAD",
        pair_id: 0,
        price: 2_000_000,
        quantity: 20_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 1001,
      });

      const depth = state.getDepth();
      expect(depth.asks).toHaveLength(2);
      expect(depth.asks[0].price).toBe(2.0);
      expect(depth.asks[1].price).toBe(3.0);
    });

    it("computes cumulative total for bids", () => {
      state.processOrderPlaced({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        price: 2_000_000,
        quantity: 20_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 1000,
      });

      state.processOrderPlaced({
        order_id: "2",
        owner: "0xBEEF",
        pair_id: 0,
        price: 1_000_000,
        quantity: 10_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 1001,
      });

      const depth = state.getDepth();
      expect(depth.bids[0].total).toBe(20); // first level
      expect(depth.bids[1].total).toBe(30); // cumulative
    });

    it("adds order to open orders", () => {
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

      const orders = state.getOrdersForAddress("0xBEEF");
      expect(orders).toHaveLength(1);
      expect(orders[0].orderId).toBe("42");
      expect(orders[0].side).toBe("buy");
      expect(orders[0].type).toBe("GTC");
      expect(orders[0].price).toBe(1.5);
      expect(orders[0].quantity).toBe(100);
      expect(orders[0].remaining).toBe(100);
      expect(orders[0].status).toBe("open");
    });

    it("does not add IOC orders to depth (they don't rest on book)", () => {
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

      const depth = state.getDepth();
      expect(depth.bids).toHaveLength(0);
    });

    it("does not add FOK orders to depth", () => {
      state.processOrderPlaced({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        price: 1_500_000,
        quantity: 100_000_000,
        is_bid: true,
        order_type: 2, // FOK
        timestamp: 1000,
      });

      const depth = state.getDepth();
      expect(depth.bids).toHaveLength(0);
    });
  });

  // ============================================================
  // OrderCancelled Processing
  // ============================================================

  describe("processOrderCancelled", () => {
    it("removes order from depth", () => {
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

      state.processOrderCancelled({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        remaining_quantity: 100_000_000,
        is_bid: true,
        price: 1_500_000,
      });

      const depth = state.getDepth();
      expect(depth.bids).toHaveLength(0);
    });

    it("reduces quantity at price level when partial cancel", () => {
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

      // Cancel one
      state.processOrderCancelled({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        remaining_quantity: 100_000_000,
        is_bid: true,
        price: 1_500_000,
      });

      const depth = state.getDepth();
      expect(depth.bids).toHaveLength(1);
      expect(depth.bids[0].quantity).toBe(50);
    });

    it("removes order from open orders", () => {
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

      state.processOrderCancelled({
        order_id: "1",
        owner: "0xBEEF",
        pair_id: 0,
        remaining_quantity: 100_000_000,
        is_bid: true,
        price: 1_500_000,
      });

      const orders = state.getOrdersForAddress("0xBEEF");
      expect(orders).toHaveLength(0);
    });
  });

  // ============================================================
  // Trade Processing
  // ============================================================

  describe("processTrade", () => {
    it("adds trade to recent trades", () => {
      // First place a maker order so the depth map gets populated
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

      const trades = state.getTrades();
      expect(trades).toHaveLength(1);
      expect(trades[0].price).toBe(1.5);
      expect(trades[0].quantity).toBe(50);
      expect(trades[0].side).toBe("buy");
    });

    it("trades are newest first", () => {
      state.processTrade({
        taker_order_id: "1",
        maker_order_id: "2",
        price: 1_000_000,
        quantity: 10_000_000,
        quote_amount: 10_000_000,
        buyer: "0xA",
        seller: "0xB",
        pair_id: 0,
        taker_is_bid: true,
      });

      state.processTrade({
        taker_order_id: "3",
        maker_order_id: "4",
        price: 2_000_000,
        quantity: 20_000_000,
        quote_amount: 40_000_000,
        buyer: "0xC",
        seller: "0xD",
        pair_id: 0,
        taker_is_bid: true,
      });

      const trades = state.getTrades();
      expect(trades).toHaveLength(2);
      // Second trade is newest → first in list
      expect(trades[0].price).toBe(2.0);
      expect(trades[1].price).toBe(1.0);
    });

    it("respects trade limit", () => {
      for (let i = 0; i < 10; i++) {
        state.processTrade({
          taker_order_id: String(i),
          maker_order_id: String(i + 100),
          price: 1_000_000 * (i + 1),
          quantity: 1_000_000,
          quote_amount: 1_000_000,
          buyer: "0xA",
          seller: "0xB",
          pair_id: 0,
          taker_is_bid: true,
        });
      }

      expect(state.getTrades(5)).toHaveLength(5);
      expect(state.getTrades(100)).toHaveLength(10);
    });

    it("updates last price in market info", () => {
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

      expect(state.getMarketInfo().lastPrice).toBe(1.5);
    });

    it("updates 24h volume", () => {
      state.processTrade({
        taker_order_id: "1",
        maker_order_id: "2",
        price: 1_000_000,
        quantity: 100_000_000,
        quote_amount: 100_000_000,
        buyer: "0xA",
        seller: "0xB",
        pair_id: 0,
        taker_is_bid: true,
      });

      expect(state.getMarketInfo().volume24h).toBe(100);
    });

    it("removes maker quantity from depth", () => {
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

      const depth = state.getDepth();
      expect(depth.asks).toHaveLength(0);
    });
  });

  // ============================================================
  // OrderFilled Processing
  // ============================================================

  describe("processOrderFilled", () => {
    it("updates order remaining quantity", () => {
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

      state.processOrderFilled({
        order_id: "1",
        fill_quantity: 40_000_000,
        fill_price: 1_500_000,
        owner: "0xBEEF",
        pair_id: 0,
      });

      const orders = state.getOrdersForAddress("0xBEEF");
      expect(orders).toHaveLength(1);
      expect(orders[0].remaining).toBe(60);
      expect(orders[0].status).toBe("partially_filled");
    });

    it("removes fully filled order", () => {
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

      state.processOrderFilled({
        order_id: "1",
        fill_quantity: 100_000_000,
        fill_price: 1_500_000,
        owner: "0xBEEF",
        pair_id: 0,
      });

      const orders = state.getOrdersForAddress("0xBEEF");
      expect(orders).toHaveLength(0);
    });
  });

  // ============================================================
  // Deposit / Withdraw
  // ============================================================

  describe("processDeposit", () => {
    it("increases available balance for USD1 (quote)", () => {
      state.processDeposit({
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 100_000_000_000, // 1000 USD1 (8 decimals)
      });

      const balances = state.getBalances("0xBEEF");
      expect(balances.usdc.available).toBe(1000);
    });

    it("increases available balance for CASH", () => {
      state.processDeposit({
        user: "0xBEEF",
        asset: "0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67::CASH::CASH",
        amount: 500_000_000, // 500 CASH (6 decimals)
      });

      const balances = state.getBalances("0xBEEF");
      expect(balances.cash.available).toBe(500);
    });
  });

  describe("processWithdraw", () => {
    it("decreases available balance", () => {
      state.processDeposit({
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 100_000_000_000, // 1000 USD1 (8 decimals)
      });

      state.processWithdraw({
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 30_000_000_000, // 300 USD1 (8 decimals)
      });

      const balances = state.getBalances("0xBEEF");
      expect(balances.usdc.available).toBe(700);
    });

    it("does not go below zero", () => {
      state.processWithdraw({
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 100_000_000_000, // 1000 USD1 (8 decimals)
      });

      const balances = state.getBalances("0xBEEF");
      expect(balances.usdc.available).toBe(0);
    });
  });

  // ============================================================
  // Candle Aggregation
  // ============================================================

  describe("candle aggregation", () => {
    it("creates a candle on first trade", () => {
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

      const candles = state.getCandles("1m");
      expect(candles).toHaveLength(1);
      expect(candles[0].open).toBe(1.5);
      expect(candles[0].high).toBe(1.5);
      expect(candles[0].low).toBe(1.5);
      expect(candles[0].close).toBe(1.5);
      expect(candles[0].volume).toBe(10);
    });

    it("updates existing candle on subsequent trade in same interval", () => {
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

      state.processTrade({
        taker_order_id: "3",
        maker_order_id: "4",
        price: 2_000_000,
        quantity: 5_000_000,
        quote_amount: 10_000_000,
        buyer: "0xC",
        seller: "0xD",
        pair_id: 0,
        taker_is_bid: true,
      });

      const candles = state.getCandles("1m");
      expect(candles).toHaveLength(1);
      expect(candles[0].open).toBe(1.5);
      expect(candles[0].high).toBe(2.0);
      expect(candles[0].low).toBe(1.5);
      expect(candles[0].close).toBe(2.0);
      expect(candles[0].volume).toBe(15);
    });

    it("creates candles for all intervals", () => {
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

      expect(state.getCandles("1m")).toHaveLength(1);
      expect(state.getCandles("5m")).toHaveLength(1);
      expect(state.getCandles("15m")).toHaveLength(1);
      expect(state.getCandles("1h")).toHaveLength(1);
      expect(state.getCandles("1d")).toHaveLength(1);
    });
  });

  // ============================================================
  // Market Info
  // ============================================================

  describe("updateMarketInfo", () => {
    it("updates market info fields", () => {
      state.updateMarketInfo({
        lotSize: 1000,
        tickSize: 100,
        minSize: 10000,
        status: "active",
      });

      const info = state.getMarketInfo();
      expect(info.lotSize).toBe(1000);
      expect(info.tickSize).toBe(100);
      expect(info.minSize).toBe(10000);
    });
  });

  // ============================================================
  // Last Indexed Version
  // ============================================================

  describe("lastIndexedVersion", () => {
    it("can be set and retrieved", () => {
      state.setLastIndexedVersion(12345);
      expect(state.getLastIndexedVersion()).toBe(12345);
    });
  });
});
