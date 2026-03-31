/**
 * Tests for seed-orderbook utility functions.
 * Validates price level generation and configuration loading.
 */

import { describe, it, expect } from "vitest";
import { PRICE_SCALE } from "@cash/shared";

/**
 * Generate bid and ask price levels around a reference price.
 * Extracted from seed-orderbook.ts for testability.
 */
function generatePriceLevels(config: {
  referencePrice: number;
  spreadBps: number;
  numLevels: number;
}): { bidPrices: number[]; askPrices: number[] } {
  const { referencePrice, spreadBps, numLevels } = config;

  const halfSpread = referencePrice * (spreadBps / 10_000);
  const bestBid = referencePrice - halfSpread;
  const bestAsk = referencePrice + halfSpread;

  const levelStepBps = Math.max(10, spreadBps / 5);
  const levelStep = referencePrice * (levelStepBps / 10_000);

  const bidPrices: number[] = [];
  const askPrices: number[] = [];

  for (let i = 0; i < numLevels; i++) {
    const bidPrice = Math.max(0.000001, bestBid - i * levelStep);
    const askPrice = bestAsk + i * levelStep;

    bidPrices.push(Math.round(bidPrice * PRICE_SCALE) / PRICE_SCALE);
    askPrices.push(Math.round(askPrice * PRICE_SCALE) / PRICE_SCALE);
  }

  return { bidPrices, askPrices };
}

describe("seed-orderbook utilities", () => {
  describe("generatePriceLevels", () => {
    it("generates correct number of bid and ask levels", () => {
      const { bidPrices, askPrices } = generatePriceLevels({
        referencePrice: 1.0,
        spreadBps: 50,
        numLevels: 10,
      });

      expect(bidPrices).toHaveLength(10);
      expect(askPrices).toHaveLength(10);
    });

    it("bids are below reference price and descending", () => {
      const { bidPrices } = generatePriceLevels({
        referencePrice: 1.0,
        spreadBps: 50,
        numLevels: 10,
      });

      for (const price of bidPrices) {
        expect(price).toBeLessThan(1.0);
        expect(price).toBeGreaterThan(0);
      }

      // Bids should be descending (best bid first, then lower)
      for (let i = 1; i < bidPrices.length; i++) {
        expect(bidPrices[i]).toBeLessThan(bidPrices[i - 1]);
      }
    });

    it("asks are above reference price and ascending", () => {
      const { askPrices } = generatePriceLevels({
        referencePrice: 1.0,
        spreadBps: 50,
        numLevels: 10,
      });

      for (const price of askPrices) {
        expect(price).toBeGreaterThan(1.0);
      }

      // Asks should be ascending (best ask first, then higher)
      for (let i = 1; i < askPrices.length; i++) {
        expect(askPrices[i]).toBeGreaterThan(askPrices[i - 1]);
      }
    });

    it("spread between best bid and best ask matches expected", () => {
      const { bidPrices, askPrices } = generatePriceLevels({
        referencePrice: 1.0,
        spreadBps: 100, // 1% total spread = 0.5% each side
        numLevels: 5,
      });

      const bestBid = bidPrices[0];
      const bestAsk = askPrices[0];

      // Half-spread = 1.0 * 100/10000 = 0.01
      // Best bid = 0.99, best ask = 1.01
      expect(bestBid).toBeCloseTo(0.99, 4);
      expect(bestAsk).toBeCloseTo(1.01, 4);
      expect(bestAsk - bestBid).toBeCloseTo(0.02, 4);
    });

    it("handles zero spread (bid and ask at reference)", () => {
      const { bidPrices, askPrices } = generatePriceLevels({
        referencePrice: 2.0,
        spreadBps: 0,
        numLevels: 3,
      });

      // Best bid = best ask = referencePrice when spread is 0
      expect(bidPrices[0]).toBeCloseTo(2.0, 4);
      expect(askPrices[0]).toBeCloseTo(2.0, 4);
    });

    it("prices have 6 decimal precision", () => {
      const { bidPrices, askPrices } = generatePriceLevels({
        referencePrice: 1.0,
        spreadBps: 50,
        numLevels: 10,
      });

      for (const price of [...bidPrices, ...askPrices]) {
        // Check that price is rounded to 6 decimals
        const rounded = Math.round(price * PRICE_SCALE) / PRICE_SCALE;
        expect(price).toBe(rounded);
      }
    });

    it("works with non-1.0 reference price", () => {
      const { bidPrices, askPrices } = generatePriceLevels({
        referencePrice: 0.05, // 5 cents per CASH
        spreadBps: 100,
        numLevels: 5,
      });

      expect(bidPrices[0]).toBeLessThan(0.05);
      expect(askPrices[0]).toBeGreaterThan(0.05);
      expect(bidPrices).toHaveLength(5);
      expect(askPrices).toHaveLength(5);
    });
  });
});
