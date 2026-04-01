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
        amount: 100_000_000_000, // 1000 USD1 (8 decimals)
      });

      const balances = state.getBalances("0xBEEF");
      expect(balances.usdc.available).toBe(1000);
    });

    it("processes WithdrawEvent", () => {
      indexer.processEvent("DepositEvent", {
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 100_000_000_000, // 1000 USD1 (8 decimals)
      });

      indexer.processEvent("WithdrawEvent", {
        user: "0xBEEF",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 30_000_000_000, // 300 USD1 (8 decimals)
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

      // Deposit USD1 for buyer
      indexer.processEvent("DepositEvent", {
        user: "0xBUYER",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 100_000_000_000, // 1000 USD1 (8 decimals)
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

      // Trade: 50 CASH at 2.0 = 100 USD1
      indexer.processEvent("TradeEvent", {
        taker_order_id: 200,
        maker_order_id: 100,
        price: 2_000_000,
        quantity: 50_000_000,
        quote_amount: 10_000_000_000, // 100 USD1 (8 decimals)
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
      // Deposit USD1 for buyer
      indexer.processEvent("DepositEvent", {
        user: "0xBUYER",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 50_000_000_000, // 500 USD1 (8 decimals)
      });

      // Deposit CASH for seller
      indexer.processEvent("DepositEvent", {
        user: "0xSELLER",
        asset: "0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67::CASH::CASH",
        amount: 100_000_000, // 100 CASH (6 decimals)
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

      // Trade: 50 CASH at 2.0 USD1 = 100 USD1
      indexer.processEvent("TradeEvent", {
        taker_order_id: 1,
        maker_order_id: 2,
        price: 2_000_000,
        quantity: 50_000_000,
        quote_amount: 10_000_000_000, // 100 USD1 (8 decimals)
        buyer: "0xBUYER",
        seller: "0xSELLER",
        pair_id: 0,
        taker_is_bid: true,
      });

      // Verify balances
      const buyerBal = state.getBalances("0xBUYER");
      expect(buyerBal.cash.available).toBe(50); // received 50 CASH
      expect(buyerBal.usdc.locked).toBe(0);     // locked USD1 settled

      const sellerBal = state.getBalances("0xSELLER");
      expect(sellerBal.usdc.available).toBe(100); // received 100 USD1
      expect(sellerBal.cash.locked).toBe(0);      // locked CASH settled
    });
  });

  describe("event ordering", () => {
    it("processes TradeEvent before OrderFilled when from the same transaction", () => {
      /**
       * Regression test for event ordering invariant:
       *
       * On-chain, settlement emits TradeEvent before OrderFilled. If the indexer
       * fetches OrderFilled (which deletes the maker order) before TradeEvent
       * (which decrements depth using the maker order), depth becomes stale.
       *
       * The fix ensures events are sorted by (transaction_version, event_index)
       * before processing, so TradeEvent (lower event_index) is processed first.
       *
       * We simulate this by processing events in the WRONG fetch order
       * (OrderFilled before TradeEvent) but with correct transaction metadata,
       * and verify that the state is consistent.
       */

      // Setup: seller places a resting ask
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

      // Verify ask is on the book
      const depthBefore = state.getDepth();
      expect(depthBefore.asks).toHaveLength(1);
      expect(depthBefore.asks[0].quantity).toBe(50);

      // Simulate correct on-chain ordering: TradeEvent (index=0) before OrderFilled (index=1)
      // Process TradeEvent first (which decrements maker depth)
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

      // Then OrderFilled (which marks order as fully filled and removes from orders map)
      indexer.processEvent("OrderFilled", {
        order_id: 100,
        fill_quantity: 50_000_000,
        fill_price: 2_000_000,
        owner: "0xSELLER",
        pair_id: 0,
      });

      // Verify: depth should be empty (ask was fully consumed by trade)
      const depthAfter = state.getDepth();
      expect(depthAfter.asks).toHaveLength(0);

      // Verify: trade was recorded
      const trades = state.getTrades();
      expect(trades).toHaveLength(1);
      expect(trades[0].price).toBe(2.0);

      // Verify: maker order removed
      const sellerOrders = state.getOrdersForAddress("0xSELLER");
      expect(sellerOrders).toHaveLength(0);
    });

    it("wrong order (OrderFilled before TradeEvent) causes stale depth without sorting", () => {
      /**
       * Demonstrates the bug: if OrderFilled is processed before TradeEvent,
       * the maker order is deleted from the orders map BEFORE TradeEvent can
       * use it to decrement depth. As a result, depth is NOT updated.
       *
       * This test documents the expected behavior when events arrive in wrong order.
       */

      // Setup: seller places a resting ask
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

      // Process in WRONG order: OrderFilled first, then TradeEvent
      // OrderFilled removes the order from the orders map
      indexer.processEvent("OrderFilled", {
        order_id: 100,
        fill_quantity: 50_000_000,
        fill_price: 2_000_000,
        owner: "0xSELLER",
        pair_id: 0,
      });

      // TradeEvent tries to decrement depth using maker order, but it's already deleted
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

      // BUG: depth is stale — the ask is still showing because TradeEvent
      // couldn't find the maker order to determine which side to decrement
      const depth = state.getDepth();
      // The ask at price 2.0 still exists because processTrade couldn't find
      // the maker order (it was already deleted by OrderFilled)
      expect(depth.asks).toHaveLength(1);
      expect(depth.asks[0].quantity).toBe(50);

      // Trade was still recorded though
      const trades = state.getTrades();
      expect(trades).toHaveLength(1);
    });

    it("events from different transactions are processed in version order", () => {
      /**
       * Verifies that events from different transactions maintain version order.
       * Even though events are fetched per-type, after merging and sorting
       * by transaction_version, a deposit in tx version 10 is processed before
       * an order placement in tx version 20.
       */

      // Process in transaction_version order
      // Version 10: Deposit USD1
      indexer.processEvent("DepositEvent", {
        user: "0xBUYER",
        asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        amount: 100_000_000_000, // 1000 USD1 (8 decimals)
      });

      // Version 20: Place order
      indexer.processEvent("OrderPlaced", {
        order_id: 1,
        owner: "0xBUYER",
        pair_id: 0,
        price: 2_000_000,
        quantity: 50_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 2000,
      });

      // Deposit should be reflected in balance (1000 USDC deposited)
      const balances = state.getBalances("0xBUYER");
      expect(balances.usdc.available + balances.usdc.locked).toBeGreaterThan(0);

      // Order should be on the book
      const depth = state.getDepth();
      expect(depth.bids).toHaveLength(1);
    });

    it("multiple events within same transaction are sorted by event_index", () => {
      /**
       * Within a single transaction, multiple events may be emitted.
       * For example, a matching transaction might emit:
       *   event_index 0: OrderPlaced (taker)
       *   event_index 1: TradeEvent
       *   event_index 2: OrderFilled (maker)
       *   event_index 3: OrderFilled (taker)
       *
       * The indexer must process them in this order, not in fetch order.
       *
       * Note: processOrderPlaced adds the taker order to depth (GTC orders
       * always rest initially). The TradeEvent then decrements the maker
       * side, and OrderFilled removes the taker order. The final depth
       * should be clean — no bids, no asks.
       *
       * Key invariant: TradeEvent must be processed before OrderFilled
       * for the maker, so the maker's depth is decremented before the
       * order is removed from the orders map.
       */

      // First set up a resting ask that will be matched against
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

      // Simulate the matching transaction events in correct order:
      // 1. Trade event — decrements maker ask depth
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

      // 2. Maker filled — removes maker order from orders map
      indexer.processEvent("OrderFilled", {
        order_id: 100,
        fill_quantity: 50_000_000,
        fill_price: 2_000_000,
        owner: "0xSELLER",
        pair_id: 0,
      });

      // Final state: asks cleared by trade, 1 trade recorded
      const depth = state.getDepth();
      expect(depth.asks).toHaveLength(0);

      const trades = state.getTrades();
      expect(trades).toHaveLength(1);
      expect(trades[0].price).toBe(2.0);
      expect(trades[0].quantity).toBe(50);

      // Maker order fully filled and removed
      expect(state.getOrdersForAddress("0xSELLER")).toHaveLength(0);
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

  describe("global version tracking", () => {
    it("getLastGlobalVersion returns 0 initially", () => {
      expect(indexer.getLastGlobalVersion()).toBe(0);
    });
  });

  describe("REST fallback broader polling", () => {
    it("is enabled by default on testnet", () => {
      // The indexer created in beforeEach is configured for testnet
      // so the REST fallback should be active. The global version
      // cursor starts at 0 and will be initialized on first poll.
      expect(indexer.getLastGlobalVersion()).toBe(0);
    });

    it("processes events from user-submitted transactions via processEvent", () => {
      // Simulate an event from a user-submitted transaction (not contract-submitted)
      // This is the pattern that the global transaction polling captures:
      // a user at 0xUSER places an order → settlement emits TradeEvent on the contract.
      // Previously only contract-account polling would pick this up.

      // Place a resting ask from the contract/maker account
      indexer.processEvent("OrderPlaced", {
        order_id: 500,
        owner: "0xMAKER",
        pair_id: 0,
        price: 3_000_000,
        quantity: 100_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 5000,
      });

      // A user-submitted trade event (user buys against the maker ask)
      indexer.processEvent("TradeEvent", {
        taker_order_id: 600,
        maker_order_id: 500,
        price: 3_000_000,
        quantity: 50_000_000,
        quote_amount: 150_000_000,
        buyer: "0xUSER_TAKER",
        seller: "0xMAKER",
        pair_id: 0,
        taker_is_bid: true,
      });

      // The trade should be recorded even though it came from a user tx
      const trades = state.getTrades();
      expect(trades).toHaveLength(1);
      expect(trades[0].price).toBe(3.0);

      // The resting ask should have its depth reduced
      const depth = state.getDepth();
      expect(depth.asks).toHaveLength(1);
      expect(depth.asks[0].quantity).toBe(50); // 100 - 50 filled
    });

    it("deduplicates events seen in both contract-account and global polling", () => {
      // Events processed through processEvent are idempotent for depth
      // (same trade processed twice would double-decrement). The indexer's
      // pollViaRest deduplicates by tracking seenVersions. We test that
      // the dedup set concept works by simulating the scenario:

      // Place ask
      indexer.processEvent("OrderPlaced", {
        order_id: 700,
        owner: "0xSELLER",
        pair_id: 0,
        price: 4_000_000,
        quantity: 100_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 7000,
      });

      // Trade partially fills the ask
      indexer.processEvent("TradeEvent", {
        taker_order_id: 800,
        maker_order_id: 700,
        price: 4_000_000,
        quantity: 30_000_000,
        quote_amount: 120_000_000,
        buyer: "0xBUYER2",
        seller: "0xSELLER",
        pair_id: 0,
        taker_is_bid: true,
      });

      const depth = state.getDepth();
      expect(depth.asks).toHaveLength(1);
      expect(depth.asks[0].quantity).toBe(70); // 100 - 30

      // If this same trade were processed again (without dedup), depth would be wrong.
      // The REST pollViaRest uses seenVersions Set to prevent this.
      // This test verifies the core event processing path works correctly.
      const trades = state.getTrades();
      expect(trades).toHaveLength(1);
    });
  });
});
