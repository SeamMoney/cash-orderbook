/**
 * Tests for balance cache updates on Trade events and
 * depth reconciliation on partial fills.
 *
 * Verifies:
 *   - Buyer receives CASH, pays USDC on trade
 *   - Seller receives USDC, pays CASH on trade
 *   - Locked amounts are decremented on trade
 *   - Partial fills decrement depth (not remove)
 *   - Full fills remove depth level entirely
 *   - Bids remain sorted desc and asks asc after mutations
 */

import { describe, it, expect, beforeEach } from "vitest";
import { OrderbookState } from "./orderbook-state.js";

describe("Balance cache on Trade events", () => {
  let state: OrderbookState;

  beforeEach(() => {
    state = new OrderbookState();
  });

  it("buyer receives CASH and seller receives USD1 on trade", () => {
    // Deposit initial balances
    state.processDeposit({
      user: "0xBUYER",
      asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b", // USD1 (quote)
      amount: 50_000_000_000, // 500 USD1 (8 decimals)
    });
    state.processDeposit({
      user: "0xSELLER",
      asset: "0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67::CASH::CASH",
      amount: 100_000_000, // 100 CASH (6 decimals)
    });

    // Place buy order → locks USD1
    state.processOrderPlaced({
      order_id: "1",
      owner: "0xBUYER",
      pair_id: 0,
      price: 2_000_000, // 2.0 USD1 per CASH
      quantity: 50_000_000, // 50 CASH
      is_bid: true,
      order_type: 0,
      timestamp: 1000,
    });

    // Place sell order → locks CASH
    state.processOrderPlaced({
      order_id: "2",
      owner: "0xSELLER",
      pair_id: 0,
      price: 2_000_000,
      quantity: 50_000_000,
      is_bid: false,
      order_type: 0,
      timestamp: 1001,
    });

    // Trade: 50 CASH at 2.0 USD1 = 100 USD1 quote
    state.processTrade({
      taker_order_id: "1",
      maker_order_id: "2",
      price: 2_000_000,
      quantity: 50_000_000,
      quote_amount: 10_000_000_000, // 100 USD1 (8 decimals)
      buyer: "0xBUYER",
      seller: "0xSELLER",
      pair_id: 0,
      taker_is_bid: true,
    });

    // Buyer: receives 50 CASH, USD1 locked decreases by 100
    const buyerBal = state.getBalances("0xBUYER");
    expect(buyerBal.cash.available).toBe(50);
    expect(buyerBal.usdc.locked).toBe(0); // 100 was locked, 100 settled

    // Seller: receives 100 USD1, CASH locked decreases by 50
    const sellerBal = state.getBalances("0xSELLER");
    expect(sellerBal.usdc.available).toBe(100);
    expect(sellerBal.cash.locked).toBe(0); // 50 was locked, 50 settled
  });

  it("updates both maker and taker balances on sell-taker trade", () => {
    // Seller has CASH, buyer has USD1
    state.processDeposit({
      user: "0xMAKER",
      asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
      amount: 20_000_000_000, // 200 USD1 (8 decimals)
    });
    state.processDeposit({
      user: "0xTAKER",
      asset: "0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67::CASH::CASH",
      amount: 100_000_000, // 100 CASH (6 decimals)
    });

    // Maker places bid (buys CASH at 1.5)
    state.processOrderPlaced({
      order_id: "10",
      owner: "0xMAKER",
      pair_id: 0,
      price: 1_500_000,
      quantity: 50_000_000,
      is_bid: true,
      order_type: 0,
      timestamp: 2000,
    });

    // Taker sells CASH
    state.processOrderPlaced({
      order_id: "20",
      owner: "0xTAKER",
      pair_id: 0,
      price: 1_500_000,
      quantity: 50_000_000,
      is_bid: false,
      order_type: 0,
      timestamp: 2001,
    });

    // Trade: 50 CASH at 1.5 USD1 = 75 USD1 quote
    state.processTrade({
      taker_order_id: "20",
      maker_order_id: "10",
      price: 1_500_000,
      quantity: 50_000_000,
      quote_amount: 7_500_000_000, // 75 USD1 (8 decimals)
      buyer: "0xMAKER",
      seller: "0xTAKER",
      pair_id: 0,
      taker_is_bid: false,
    });

    // Maker (buyer): gets 50 CASH, locked USD1 decreases
    const makerBal = state.getBalances("0xMAKER");
    expect(makerBal.cash.available).toBe(50);

    // Taker (seller): gets 75 USD1, locked CASH decreases
    const takerBal = state.getBalances("0xTAKER");
    expect(takerBal.usdc.available).toBe(75);
  });

  it("handles deposit → trade → withdraw cycle correctly", () => {
    // Deposit
    state.processDeposit({
      user: "0xALICE",
      asset: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
      amount: 100_000_000_000, // 1000 USD1 (8 decimals)
    });

    // Place buy order → locks 300 USD1 (100 CASH at 3.0)
    state.processOrderPlaced({
      order_id: "5",
      owner: "0xALICE",
      pair_id: 0,
      price: 3_000_000,
      quantity: 100_000_000,
      is_bid: true,
      order_type: 0,
      timestamp: 3000,
    });

    let aliceBal = state.getBalances("0xALICE");
    expect(aliceBal.usdc.locked).toBe(300);
    expect(aliceBal.usdc.available).toBe(700);

    // Trade fills → buyer gets 100 CASH, pays 300 USD1
    state.processTrade({
      taker_order_id: "6",
      maker_order_id: "5",
      price: 3_000_000,
      quantity: 100_000_000,
      quote_amount: 30_000_000_000, // 300 USD1 (8 decimals)
      buyer: "0xALICE",
      seller: "0xBOB",
      pair_id: 0,
      taker_is_bid: false,
    });

    aliceBal = state.getBalances("0xALICE");
    expect(aliceBal.cash.available).toBe(100);
    expect(aliceBal.usdc.locked).toBe(0);

    // Withdraw
    state.processWithdraw({
      user: "0xALICE",
      asset: "0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67::CASH::CASH",
      amount: 50_000_000, // withdraw 50 CASH (6 decimals)
    });

    aliceBal = state.getBalances("0xALICE");
    expect(aliceBal.cash.available).toBe(50);
  });
});

describe("Depth reconciliation on fills", () => {
  let state: OrderbookState;

  beforeEach(() => {
    state = new OrderbookState();
  });

  it("partial fill decrements depth at the price level (does not remove)", () => {
    // Place a large ask (100 CASH)
    state.processOrderPlaced({
      order_id: "100",
      owner: "0xSELLER",
      pair_id: 0,
      price: 2_000_000,
      quantity: 100_000_000, // 100 CASH
      is_bid: false,
      order_type: 0,
      timestamp: 1000,
    });

    // Trade fills only 30 CASH of the 100
    state.processTrade({
      taker_order_id: "200",
      maker_order_id: "100",
      price: 2_000_000,
      quantity: 30_000_000, // 30 CASH partial fill
      quote_amount: 60_000_000,
      buyer: "0xBUYER",
      seller: "0xSELLER",
      pair_id: 0,
      taker_is_bid: true,
    });

    const depth = state.getDepth();
    // Ask should still exist with 70 remaining
    expect(depth.asks).toHaveLength(1);
    expect(depth.asks[0].price).toBe(2.0);
    expect(depth.asks[0].quantity).toBe(70);
  });

  it("full fill removes depth level entirely", () => {
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

  it("partial fill on bid side decrements correctly", () => {
    state.processOrderPlaced({
      order_id: "100",
      owner: "0xBUYER",
      pair_id: 0,
      price: 1_500_000,
      quantity: 100_000_000,
      is_bid: true,
      order_type: 0,
      timestamp: 1000,
    });

    // Trade fills 40 of 100
    state.processTrade({
      taker_order_id: "200",
      maker_order_id: "100",
      price: 1_500_000,
      quantity: 40_000_000,
      quote_amount: 60_000_000,
      buyer: "0xBUYER",
      seller: "0xSELLER",
      pair_id: 0,
      taker_is_bid: false,
    });

    const depth = state.getDepth();
    expect(depth.bids).toHaveLength(1);
    expect(depth.bids[0].price).toBe(1.5);
    expect(depth.bids[0].quantity).toBe(60); // 100 - 40
  });

  it("multiple partial fills correctly decrement depth", () => {
    state.processOrderPlaced({
      order_id: "100",
      owner: "0xSELLER",
      pair_id: 0,
      price: 3_000_000,
      quantity: 100_000_000,
      is_bid: false,
      order_type: 0,
      timestamp: 1000,
    });

    // First fill: 20
    state.processTrade({
      taker_order_id: "201",
      maker_order_id: "100",
      price: 3_000_000,
      quantity: 20_000_000,
      quote_amount: 60_000_000,
      buyer: "0xB1",
      seller: "0xSELLER",
      pair_id: 0,
      taker_is_bid: true,
    });

    let depth = state.getDepth();
    expect(depth.asks[0].quantity).toBe(80);

    // Second fill: 30
    state.processTrade({
      taker_order_id: "202",
      maker_order_id: "100",
      price: 3_000_000,
      quantity: 30_000_000,
      quote_amount: 90_000_000,
      buyer: "0xB2",
      seller: "0xSELLER",
      pair_id: 0,
      taker_is_bid: true,
    });

    depth = state.getDepth();
    expect(depth.asks[0].quantity).toBe(50);

    // Third fill: 50 (completes)
    state.processTrade({
      taker_order_id: "203",
      maker_order_id: "100",
      price: 3_000_000,
      quantity: 50_000_000,
      quote_amount: 150_000_000,
      buyer: "0xB3",
      seller: "0xSELLER",
      pair_id: 0,
      taker_is_bid: true,
    });

    depth = state.getDepth();
    expect(depth.asks).toHaveLength(0);
  });

  it("bids remain sorted descending after multiple mutations", () => {
    // Place 5 bids at different prices
    const prices = [1_000_000, 3_000_000, 2_000_000, 4_000_000, 1_500_000];
    prices.forEach((price, i) => {
      state.processOrderPlaced({
        order_id: String(i + 1),
        owner: `0xBIDDER${i}`,
        pair_id: 0,
        price,
        quantity: 10_000_000,
        is_bid: true,
        order_type: 0,
        timestamp: 1000 + i,
      });
    });

    // Cancel the middle one (price 2.0)
    state.processOrderCancelled({
      order_id: "3",
      owner: "0xBIDDER2",
      pair_id: 0,
      remaining_quantity: 10_000_000,
      is_bid: true,
      price: 2_000_000,
    });

    const depth = state.getDepth();
    expect(depth.bids).toHaveLength(4);
    // Verify descending order
    for (let i = 1; i < depth.bids.length; i++) {
      expect(depth.bids[i - 1].price).toBeGreaterThan(depth.bids[i].price);
    }
  });

  it("asks remain sorted ascending after multiple mutations", () => {
    const prices = [5_000_000, 2_000_000, 4_000_000, 1_000_000, 3_000_000];
    prices.forEach((price, i) => {
      state.processOrderPlaced({
        order_id: String(i + 1),
        owner: `0xASKER${i}`,
        pair_id: 0,
        price,
        quantity: 10_000_000,
        is_bid: false,
        order_type: 0,
        timestamp: 1000 + i,
      });
    });

    // Cancel lowest ask (price 1.0)
    state.processOrderCancelled({
      order_id: "4",
      owner: "0xASKER3",
      pair_id: 0,
      remaining_quantity: 10_000_000,
      is_bid: false,
      price: 1_000_000,
    });

    const depth = state.getDepth();
    expect(depth.asks).toHaveLength(4);
    // Verify ascending order
    for (let i = 1; i < depth.asks.length; i++) {
      expect(depth.asks[i - 1].price).toBeLessThan(depth.asks[i].price);
    }
  });

  it("partial fill at price level with multiple orders correctly decrements total", () => {
    // Two orders at same price
    state.processOrderPlaced({
      order_id: "10",
      owner: "0xS1",
      pair_id: 0,
      price: 2_500_000,
      quantity: 60_000_000,
      is_bid: false,
      order_type: 0,
      timestamp: 1000,
    });
    state.processOrderPlaced({
      order_id: "11",
      owner: "0xS2",
      pair_id: 0,
      price: 2_500_000,
      quantity: 40_000_000,
      is_bid: false,
      order_type: 0,
      timestamp: 1001,
    });

    // Total at 2.5 is 100
    let depth = state.getDepth();
    expect(depth.asks[0].quantity).toBe(100);

    // Fill 60 from first order
    state.processTrade({
      taker_order_id: "300",
      maker_order_id: "10",
      price: 2_500_000,
      quantity: 60_000_000,
      quote_amount: 150_000_000,
      buyer: "0xBUYER",
      seller: "0xS1",
      pair_id: 0,
      taker_is_bid: true,
    });

    depth = state.getDepth();
    expect(depth.asks).toHaveLength(1);
    expect(depth.asks[0].quantity).toBe(40); // Only order #11 remaining
  });
});
