/**
 * Tests for EventIndexer — event processing and state updates.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventIndexer } from "./event-indexer.js";
import { OrderbookState } from "../state/orderbook-state.js";

describe("EventIndexer", () => {
  let indexer: EventIndexer;
  let state: OrderbookState;

  beforeEach(() => {
    state = new OrderbookState();
    indexer = new EventIndexer(
      { contractAddress: "0xCAFE", network: "testnet" },
      state,
    );
  });

  describe("processEvent", () => {
    it("processes OrderPlaced event", () => {
      indexer.processEvent("OrderPlaced", {
        order_id: 1,
        owner: "0xBEEF",
        pair_id: 0,
        price: 1_500_000,
        quantity: 100_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 1000,
      });

      const depth = state.getDepth();
      expect(depth.bids).toHaveLength(1);
      expect(depth.bids[0].price).toBe(1.5);

      const orders = state.getOrdersForAddress("0xBEEF");
      expect(orders).toHaveLength(1);
    });

    it("processes OrderCancelled event", () => {
      indexer.processEvent("OrderPlaced", {
        order_id: 1,
        owner: "0xBEEF",
        pair_id: 0,
        price: 1_500_000,
        quantity: 100_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 1000,
      });

      indexer.processEvent("OrderCancelled", {
        order_id: 1,
        owner: "0xBEEF",
        pair_id: 0,
        remaining_quantity: 100_000_000,
        is_bid: true,
        price: 1_500_000,
      });

      const depth = state.getDepth();
      expect(depth.bids).toHaveLength(0);

      const orders = state.getOrdersForAddress("0xBEEF");
      expect(orders).toHaveLength(0);
    });

    it("processes TradeEvent", () => {
      indexer.processEvent("OrderPlaced", {
        order_id: 100,
        owner: "0xSELLER",
        pair_id: 0,
        price: 1_500_000,
        quantity: 50_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 1000,
      });

      indexer.processEvent("TradeEvent", {
        taker_order_id: 200,
        maker_order_id: 100,
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
      expect(trades[0].side).toBe("buy");
    });

    it("processes OrderFilled event", () => {
      indexer.processEvent("OrderPlaced", {
        order_id: 1,
        owner: "0xBEEF",
        pair_id: 0,
        price: 1_500_000,
        quantity: 100_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 1000,
      });

      indexer.processEvent("OrderFilled", {
        order_id: 1,
        fill_quantity: 100_000_000,
        fill_price: 1_500_000,
        owner: "0xBEEF",
        pair_id: 0,
      });

      const orders = state.getOrdersForAddress("0xBEEF");
      expect(orders).toHaveLength(0);
    });

    it("processes DepositEvent", () => {
      indexer.processEvent("DepositEvent", {
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 1000_000_000,
      });

      const balances = state.getBalances("0xBEEF");
      expect(balances.usdc.available).toBe(1000);
    });

    it("processes WithdrawEvent", () => {
      indexer.processEvent("DepositEvent", {
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 1000_000_000,
      });

      indexer.processEvent("WithdrawEvent", {
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 300_000_000,
      });

      const balances = state.getBalances("0xBEEF");
      expect(balances.usdc.available).toBe(700);
    });

    it("handles full order lifecycle: place -> trade -> fill", () => {
      // Seller places ask
      indexer.processEvent("OrderPlaced", {
        order_id: 100,
        owner: "0xSELLER",
        pair_id: 0,
        price: 2_000_000,
        quantity: 50_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 1000,
      });

      // Buyer places bid that matches
      indexer.processEvent("OrderPlaced", {
        order_id: 200,
        owner: "0xBUYER",
        pair_id: 0,
        price: 2_000_000,
        quantity: 50_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 1001,
      });

      // Trade occurs
      indexer.processEvent("TradeEvent", {
        taker_order_id: 200,
        maker_order_id: 100,
        price: 2_000_000,
        quantity: 50_000_000,
        quote_amount: 100_000_000,
        buyer: "0xBUYER",
        seller: "0xSELLER",
        pair_id: 0,
        taker_is_bid: true,
      });

      // Both orders filled
      indexer.processEvent("OrderFilled", {
        order_id: 100,
        fill_quantity: 50_000_000,
        fill_price: 2_000_000,
        owner: "0xSELLER",
        pair_id: 0,
      });

      indexer.processEvent("OrderFilled", {
        order_id: 200,
        fill_quantity: 50_000_000,
        fill_price: 2_000_000,
        owner: "0xBUYER",
        pair_id: 0,
      });

      // Verify state
      const depth = state.getDepth();
      expect(depth.asks).toHaveLength(0);

      const trades = state.getTrades();
      expect(trades).toHaveLength(1);
      expect(trades[0].price).toBe(2.0);

      const sellerOrders = state.getOrdersForAddress("0xSELLER");
      expect(sellerOrders).toHaveLength(0);

      const buyerOrders = state.getOrdersForAddress("0xBUYER");
      expect(buyerOrders).toHaveLength(0);

      expect(state.getMarketInfo().lastPrice).toBe(2.0);
    });

    it("processes multiple event types in a full lifecycle and emits events", () => {
      const orderbookHandler = vi.fn();
      const tradeHandler = vi.fn();
      const balanceHandler = vi.fn();

      state.on("orderbookUpdate", orderbookHandler);
      state.on("trade", tradeHandler);
      state.on("balanceUpdate", balanceHandler);

      // Deposit
      indexer.processEvent("DepositEvent", {
        user: "0xBUYER",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 1000_000_000,
      });
      expect(balanceHandler).toHaveBeenCalled();

      // Place ask
      indexer.processEvent("OrderPlaced", {
        order_id: 100,
        owner: "0xSELLER",
        pair_id: 0,
        price: 2_000_000,
        quantity: 50_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 1000,
      });
      expect(orderbookHandler).toHaveBeenCalled();

      // Trade
      indexer.processEvent("TradeEvent", {
        taker_order_id: 200,
        maker_order_id: 100,
        price: 2_000_000,
        quantity: 50_000_000,
        quote_amount: 100_000_000,
        buyer: "0xBUYER",
        seller: "0xSELLER",
        pair_id: 0,
        taker_is_bid: true,
      });
      expect(tradeHandler).toHaveBeenCalled();

      // Verify buyer got CASH
      const buyerBal = state.getBalances("0xBUYER");
      expect(buyerBal.cash.available).toBe(50);
    });

    it("processes events with balance updates for both parties", () => {
      // Deposit for buyer
      indexer.processEvent("DepositEvent", {
        user: "0xBUYER",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 500_000_000,
      });

      // Deposit CASH for seller
      indexer.processEvent("DepositEvent", {
        user: "0xSELLER",
        asset: "0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67::CASH::CASH",
        amount: 100_000_000,
      });

      // Place bid
      indexer.processEvent("OrderPlaced", {
        order_id: 1,
        owner: "0xBUYER",
        pair_id: 0,
        price: 2_000_000,
        quantity: 50_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 1000,
      });

      // Place ask
      indexer.processEvent("OrderPlaced", {
        order_id: 2,
        owner: "0xSELLER",
        pair_id: 0,
        price: 2_000_000,
        quantity: 50_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 1001,
      });

      // Trade
      indexer.processEvent("TradeEvent", {
        taker_order_id: 1,
        maker_order_id: 2,
        price: 2_000_000,
        quantity: 50_000_000,
        quote_amount: 100_000_000,
        buyer: "0xBUYER",
        seller: "0xSELLER",
        pair_id: 0,
        taker_is_bid: true,
      });

      // Verify balances
      const buyerBal = state.getBalances("0xBUYER");
      expect(buyerBal.cash.available).toBe(50); // received 50 CASH
      expect(buyerBal.usdc.locked).toBe(0);     // locked USDC settled

      const sellerBal = state.getBalances("0xSELLER");
      expect(sellerBal.usdc.available).toBe(100); // received 100 USDC
      expect(sellerBal.cash.locked).toBe(0);      // locked CASH settled
    });
  });

  describe("start/stop", () => {
    it("can start and stop without error", () => {
      indexer.start();
      expect(() => indexer.stop()).not.toThrow();
    });

    it("start is idempotent", () => {
      indexer.start();
      indexer.start();
      expect(() => indexer.stop()).not.toThrow();
    });
  });

  describe("cursor tracking", () => {
    it("getCursor returns undefined for unpolled event type", () => {
      expect(indexer.getCursor("0xCAFE::order_placement::OrderPlaced")).toBeUndefined();
    });
  });
});
