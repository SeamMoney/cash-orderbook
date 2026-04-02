/**
 * Calculate swap output from orderbook depth.
 *
 * For selling CASH (direction: CASH → USDC):
 *   Walk through bids (buyers) from highest to lowest.
 *   Input = CASH amount, Output = USDC received.
 *
 * For buying CASH (direction: USDC → CASH):
 *   Walk through asks (sellers) from lowest to highest.
 *   Input = USDC amount, Output = CASH received.
 */

import type { DepthLevel } from "../hooks/use-depth";

export interface SwapQuote {
  /** The output amount the user would receive */
  outputAmount: number;
  /** Effective price (output / input) */
  effectivePrice: number;
  /** Mid-market price (best bid + best ask) / 2 */
  midPrice: number;
  /** Price impact as a fraction (0.01 = 1%) */
  priceImpact: number;
  /** Minimum received (with 0.5% slippage tolerance) */
  minimumReceived: number;
  /** Whether the book has sufficient liquidity */
  sufficientLiquidity: boolean;
}

/**
 * Direction of swap:
 *   "sell" = selling CASH for USDC (taker sells → matches bids)
 *   "buy"  = buying CASH with USDC (taker buys → matches asks)
 */
export type SwapDirection = "sell" | "buy";

const SLIPPAGE_TOLERANCE = 0.005; // 0.5%

/**
 * Calculate swap quote by walking the orderbook.
 */
export function calculateSwapQuote(
  inputAmount: number,
  direction: SwapDirection,
  bids: DepthLevel[],
  asks: DepthLevel[],
): SwapQuote | null {
  if (inputAmount <= 0) return null;

  const bestBid = bids.length > 0 ? bids[0].price : 0;
  const bestAsk = asks.length > 0 ? asks[0].price : 0;

  // If no liquidity on either side, can't quote
  if (bestBid === 0 && bestAsk === 0) return null;

  const midPrice =
    bestBid > 0 && bestAsk > 0
      ? (bestBid + bestAsk) / 2
      : bestBid > 0
        ? bestBid
        : bestAsk;

  if (direction === "sell") {
    // Selling CASH → get USDC. Walk bids (highest first).
    return walkBids(inputAmount, bids, midPrice);
  } else {
    // Buying CASH with USDC → walk asks (lowest first).
    return walkAsks(inputAmount, asks, midPrice);
  }
}

/**
 * Walk bids to calculate USDC output for a given CASH input.
 * Bids are already sorted descending by price.
 */
function walkBids(
  cashInput: number,
  bids: DepthLevel[],
  midPrice: number,
): SwapQuote | null {
  if (bids.length === 0) return null;

  let remaining = cashInput;
  let usdcOutput = 0;
  let sufficientLiquidity = true;

  for (const level of bids) {
    if (remaining <= 0) break;

    const fillQty = Math.min(remaining, level.quantity);
    usdcOutput += fillQty * level.price;
    remaining -= fillQty;
  }

  if (remaining > 0) {
    sufficientLiquidity = false;
    // Still return partial quote
  }

  const filledAmount = cashInput - remaining;
  const effectivePrice = filledAmount > 0 ? usdcOutput / filledAmount : 0;
  const priceImpact =
    midPrice > 0 ? Math.abs(effectivePrice - midPrice) / midPrice : 0;
  const minimumReceived = usdcOutput * (1 - SLIPPAGE_TOLERANCE);

  return {
    outputAmount: usdcOutput,
    effectivePrice,
    midPrice,
    priceImpact,
    minimumReceived,
    sufficientLiquidity,
  };
}

/**
 * Walk asks to calculate CASH output for a given USDC input.
 * Asks are already sorted ascending by price.
 */
function walkAsks(
  usdcInput: number,
  asks: DepthLevel[],
  midPrice: number,
): SwapQuote | null {
  if (asks.length === 0) return null;

  let remaining = usdcInput;
  let cashOutput = 0;
  let sufficientLiquidity = true;

  for (const level of asks) {
    if (remaining <= 0) break;

    // How much USDC to fill this level entirely
    const levelCost = level.quantity * level.price;

    if (remaining >= levelCost) {
      cashOutput += level.quantity;
      remaining -= levelCost;
    } else {
      // Partial fill at this level
      const partialQty = remaining / level.price;
      cashOutput += partialQty;
      remaining = 0;
    }
  }

  if (remaining > 0) {
    sufficientLiquidity = false;
  }

  const usdcSpent = usdcInput - remaining;
  const effectivePrice = cashOutput > 0 ? usdcSpent / cashOutput : 0;
  const priceImpact =
    midPrice > 0 ? Math.abs(effectivePrice - midPrice) / midPrice : 0;
  const minimumReceived = cashOutput * (1 - SLIPPAGE_TOLERANCE);

  return {
    outputAmount: cashOutput,
    effectivePrice,
    midPrice,
    priceImpact,
    minimumReceived,
    sufficientLiquidity,
  };
}
