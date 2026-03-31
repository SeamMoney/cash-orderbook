/**
 * Panora DEX Aggregator API client.
 *
 * Used for swap routing when the trading pair is NOT CASH/USD1 (the native
 * orderbook pair). For CASH/USD1 swaps, the orderbook depth walk is used
 * instead. Panora aggregates liquidity from multiple Aptos DEXs and returns
 * an optimal route + a ready-to-sign transaction payload.
 *
 * API docs: https://docs.panora.exchange/developer/swap/api
 */

import {
  STABLECOINS,
  CASH_TOKEN_ADDRESS,
  type StablecoinInfo,
} from "@cash/shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANORA_BASE_URL = "https://api.panora.exchange";

/** Public Panora API key — sufficient for normal usage. */
const PANORA_API_KEY =
  "a4^KV_EaTf4MW#ZdvgGKX#HUD^3IFEAOV_kzpIE^3BQGA8pDnrkT7JcIy#HNlLGi";

/** Request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed quote returned by `getPanoraQuote`. */
export interface PanoraQuote {
  /** Amount the user will receive (human-readable, without decimals). */
  outputAmount: number;
  /** Price impact as a fraction (0.01 = 1%). `null` when unavailable. */
  priceImpact: number | null;
  /** Minimum amount after slippage (human-readable). */
  minReceived: number;
  /** Routing path description, e.g. "USDT → USDC → CASH via Panora". */
  routeDescription: string;
  /** Raw txData from Panora (used for swap execution). */
  txData: unknown;
}

/** Error class for Panora-specific failures. */
export class PanoraError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "PanoraError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a token symbol to its mainnet on-chain address. */
function resolveTokenAddress(symbol: string): string {
  if (symbol === "CASH") return CASH_TOKEN_ADDRESS;
  const stablecoin: StablecoinInfo | undefined = STABLECOINS.find(
    (s) => s.symbol.toLowerCase() === symbol.toLowerCase(),
  );
  if (!stablecoin) {
    throw new PanoraError(`Unknown token symbol: ${symbol}`);
  }
  return stablecoin.address;
}

/** Build a human-readable route description. */
function buildRouteDescription(
  fromSymbol: string,
  toSymbol: string,
): string {
  // Panora handles multi-hop routing internally — we don't get the exact
  // intermediate steps from the API. Show a simple label instead.
  return `${fromSymbol} → ${toSymbol} via Panora`;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Fetch a swap quote from Panora.
 *
 * @param fromToken - Symbol of the token being swapped from (e.g. "USDT").
 * @param toToken   - Symbol of the token being swapped to (e.g. "CASH").
 * @param amount    - Human-readable amount (without decimals, e.g. 100.5).
 * @param slippage  - Slippage tolerance in percentage (e.g. 0.5 for 0.5%).
 *                    Defaults to "auto" if omitted.
 */
export async function getPanoraQuote(
  fromToken: string,
  toToken: string,
  amount: number,
  slippage?: number,
): Promise<PanoraQuote> {
  const fromAddress = resolveTokenAddress(fromToken);
  const toAddress = resolveTokenAddress(toToken);

  const params = new URLSearchParams({
    fromTokenAddress: fromAddress,
    toTokenAddress: toAddress,
    fromTokenAmount: String(amount),
    // toWalletAddress is required by Panora — use a dummy for quote-only.
    // The actual sender address is set in getPanoraSwapPayload.
    toWalletAddress:
      "0x0000000000000000000000000000000000000000000000000000000000000001",
  });

  if (slippage !== undefined) {
    params.set("slippagePercentage", String(slippage));
  }

  const url = `${PANORA_BASE_URL}/swap?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "x-api-key": PANORA_API_KEY },
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new PanoraError("Rate limited — please try again shortly", 429);
    }
    if (!response.ok) {
      throw new PanoraError(
        `Panora API error (${response.status})`,
        response.status,
      );
    }

    const data: PanoraSwapResponse = await response.json();

    if (!data.quotes || data.quotes.length === 0) {
      throw new PanoraError("No routes available for this swap");
    }

    const bestQuote = data.quotes[0];

    const outputAmount = parseFloat(bestQuote.toTokenAmount ?? "0");
    const minReceived = parseFloat(bestQuote.minToTokenAmount ?? "0");
    const rawImpact = bestQuote.priceImpact;
    const priceImpact =
      rawImpact !== null && rawImpact !== undefined
        ? Math.abs(parseFloat(String(rawImpact))) / 100
        : null;

    return {
      outputAmount,
      priceImpact,
      minReceived,
      routeDescription: buildRouteDescription(fromToken, toToken),
      txData: bestQuote.txData,
    };
  } catch (err) {
    if (err instanceof PanoraError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new PanoraError("Request timed out (5s)");
    }
    throw new PanoraError(
      (err as Error).message || "Network error contacting Panora",
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch a swap transaction payload from Panora, ready for
 * `signAndSubmitTransaction`.
 *
 * @param fromToken     - Symbol of the token being swapped from.
 * @param toToken       - Symbol of the token being swapped to.
 * @param amount        - Human-readable amount (without decimals).
 * @param slippage      - Slippage tolerance in percentage.
 * @param senderAddress - The user's wallet address (hex, 0x-prefixed).
 */
export async function getPanoraSwapPayload(
  fromToken: string,
  toToken: string,
  amount: number,
  slippage: number | undefined,
  senderAddress: string,
): Promise<unknown> {
  const fromAddress = resolveTokenAddress(fromToken);
  const toAddress = resolveTokenAddress(toToken);

  const params = new URLSearchParams({
    fromTokenAddress: fromAddress,
    toTokenAddress: toAddress,
    fromTokenAmount: String(amount),
    toWalletAddress: senderAddress,
  });

  if (slippage !== undefined) {
    params.set("slippagePercentage", String(slippage));
  }

  const url = `${PANORA_BASE_URL}/swap?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "x-api-key": PANORA_API_KEY },
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new PanoraError("Rate limited — please try again shortly", 429);
    }
    if (!response.ok) {
      throw new PanoraError(
        `Panora API error (${response.status})`,
        response.status,
      );
    }

    const data: PanoraSwapResponse = await response.json();

    if (!data.quotes || data.quotes.length === 0) {
      throw new PanoraError("No routes available for this swap");
    }

    return data.quotes[0].txData;
  } catch (err) {
    if (err instanceof PanoraError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new PanoraError("Request timed out (5s)");
    }
    throw new PanoraError(
      (err as Error).message || "Network error contacting Panora",
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Internal response types
// ---------------------------------------------------------------------------

/** Shape of the Panora /swap response (ExactIn scenario). */
interface PanoraSwapResponse {
  fromToken?: { address: string; decimals: number; current_price: number };
  toToken?: { address: string; decimals: number; current_price: number };
  fromTokenAmount?: string;
  quotes: PanoraQuoteEntry[];
}

interface PanoraQuoteEntry {
  toTokenAmount: string;
  priceImpact: string | null;
  slippagePercentage: string;
  feeTokenAmount: string;
  minToTokenAmount: string;
  txData: unknown;
  toTokenAmountUSD: string | null;
}
