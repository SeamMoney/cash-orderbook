/**
 * seed-orderbook.ts — Seed the CASH/USDC orderbook with a ladder of limit orders.
 *
 * Places configurable buy/sell limit orders around a reference price:
 *   - 10 buy levels below current price (bids)
 *   - 10 sell levels above current price (asks)
 *
 * Environment variables:
 *   APTOS_PRIVATE_KEY  — Hex-encoded ed25519 private key of the trading account
 *   CONTRACT_ADDRESS   — Address where cash_orderbook is deployed
 *   APTOS_NETWORK      — Network: mainnet | testnet | devnet | local (default: mainnet)
 *
 * Optional configuration (env vars):
 *   REFERENCE_PRICE    — Mid price in USDC (default: 1.0)
 *   SPREAD_BPS         — Half-spread in basis points (default: 50 = 0.5%)
 *   DEPTH_PER_LEVEL    — CASH quantity per price level (default: 100)
 *   NUM_LEVELS         — Number of levels per side (default: 10)
 *   PAIR_ID            — Market pair ID (default: 0)
 *
 * Prerequisites:
 *   - Market must be registered (run register-market.ts first)
 *   - Account must have deposited sufficient CASH and USDC into the orderbook
 *     (use SDK deposit() or on-chain deposit function)
 *
 * Usage:
 *   APTOS_PRIVATE_KEY=<key> CONTRACT_ADDRESS=<addr> npx tsx scripts/src/seed-orderbook.ts
 */

import {
  Ed25519PrivateKey,
  Account,
} from "@aptos-labs/ts-sdk";

import { CashOrderbook } from "@cash/orderbook-sdk";
import {
  CASH_TOKEN_ADDRESS,
  USDC_TOKEN_ADDRESS,
  CASH_DECIMALS,
  USDC_DECIMALS,
  PRICE_SCALE,
  STABLECOINS,
  quoteDecimalsFor,
} from "@cash/shared";

// ============================================================
// Configuration
// ============================================================

interface SeedConfig {
  referencePrice: number;
  spreadBps: number;
  depthPerLevel: number;
  numLevels: number;
  pairId: number;
}

function loadConfig(): SeedConfig {
  return {
    referencePrice: parseFloat(process.env.REFERENCE_PRICE ?? "1.0"),
    spreadBps: parseInt(process.env.SPREAD_BPS ?? "50", 10),
    depthPerLevel: parseFloat(process.env.DEPTH_PER_LEVEL ?? "100"),
    numLevels: parseInt(process.env.NUM_LEVELS ?? "10", 10),
    pairId: parseInt(process.env.PAIR_ID ?? "0", 10),
  };
}

function getNetworkType(network: string): "mainnet" | "testnet" | "devnet" | "local" {
  if (network === "testnet" || network === "devnet" || network === "local") {
    return network;
  }
  return "mainnet";
}

/**
 * Generate bid and ask price levels around a reference price.
 *
 * Bids: referencePrice * (1 - spreadBps/10000) down by tickStep each level
 * Asks: referencePrice * (1 + spreadBps/10000) up by tickStep each level
 */
function generatePriceLevels(
  config: SeedConfig,
): { bidPrices: number[]; askPrices: number[] } {
  const { referencePrice, spreadBps, numLevels } = config;

  const halfSpread = referencePrice * (spreadBps / 10_000);
  const bestBid = referencePrice - halfSpread;
  const bestAsk = referencePrice + halfSpread;

  // Each subsequent level is further from mid by the tick step
  // Use a ~0.1% step between levels for reasonable spacing
  const levelStepBps = Math.max(10, spreadBps / 5);
  const levelStep = referencePrice * (levelStepBps / 10_000);

  const bidPrices: number[] = [];
  const askPrices: number[] = [];

  for (let i = 0; i < numLevels; i++) {
    const bidPrice = Math.max(0.000001, bestBid - i * levelStep);
    const askPrice = bestAsk + i * levelStep;

    // Round to 6 decimal places (PRICE_SCALE precision)
    bidPrices.push(Math.round(bidPrice * PRICE_SCALE) / PRICE_SCALE);
    askPrices.push(Math.round(askPrice * PRICE_SCALE) / PRICE_SCALE);
  }

  return { bidPrices, askPrices };
}

// ============================================================
// Main
// ============================================================

/**
 * Resolve the quote asset metadata address for the given symbol and network.
 * Uses the STABLECOINS registry from @cash/shared for address lookup.
 */
function resolveQuoteAsset(symbol: string, network: string): { address: string; decimals: number } {
  const quoteAssetOverride = process.env.QUOTE_ASSET_ADDRESS;
  if (quoteAssetOverride) {
    return { address: quoteAssetOverride, decimals: quoteDecimalsFor(symbol) };
  }

  const coin = STABLECOINS.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
  if (!coin) {
    return { address: USDC_TOKEN_ADDRESS, decimals: USDC_DECIMALS };
  }

  const isTest = network === "testnet";
  // Use the network-specific address from the stablecoin registry
  const altAddr = coin["testnetAddress" as keyof typeof coin] as string | undefined;
  const addr = isTest && altAddr ? altAddr : coin.address;
  return { address: addr, decimals: coin.decimals };
}

async function main(): Promise<void> {
  // Read env vars
  const privateKeyHex = process.env.APTOS_PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const networkStr = process.env.APTOS_NETWORK ?? "mainnet";
  const quoteSymbol = process.env.QUOTE_ASSET ?? "USD1";

  if (!privateKeyHex) {
    console.error("ERROR: APTOS_PRIVATE_KEY environment variable is required.");
    process.exit(1);
  }

  if (!contractAddress) {
    console.error("ERROR: CONTRACT_ADDRESS environment variable is required.");
    process.exit(1);
  }

  const config = loadConfig();
  const { bidPrices, askPrices } = generatePriceLevels(config);

  // Resolve quote asset
  const baseAssetAddress = process.env.BASE_ASSET_ADDRESS ?? CASH_TOKEN_ADDRESS;
  const { address: quoteAssetAddress, decimals: quoteDecimals } = resolveQuoteAsset(quoteSymbol, networkStr);

  // Calculate capital requirements
  const totalAskQuantity = config.depthPerLevel * config.numLevels;
  const totalBidCost = bidPrices.reduce(
    (sum, price) => sum + price * config.depthPerLevel,
    0,
  );

  console.log("=============================================");
  console.log("  CASH Orderbook — Seed Orderbook");
  console.log("=============================================");
  console.log("");
  console.log(`Network:          ${networkStr}`);
  console.log(`Contract:         ${contractAddress}`);
  console.log(`Quote asset:      ${quoteSymbol} (${quoteDecimals} decimals)`);
  console.log(`Base address:     ${baseAssetAddress}`);
  console.log(`Quote address:    ${quoteAssetAddress}`);
  console.log(`Pair ID:          ${config.pairId}`);
  console.log(`Reference price:  ${config.referencePrice} ${quoteSymbol}/CASH`);
  console.log(`Spread:           ${config.spreadBps} bps (${config.spreadBps / 100}%)`);
  console.log(`Levels per side:  ${config.numLevels}`);
  console.log(`Depth per level:  ${config.depthPerLevel} CASH`);
  console.log("");
  console.log(`Capital required:`);
  console.log(`  CASH (for asks): ${totalAskQuantity.toFixed(CASH_DECIMALS)} CASH`);
  console.log(`  ${quoteSymbol} (for bids): ${totalBidCost.toFixed(quoteDecimals)} ${quoteSymbol}`);
  console.log("");

  // Print price ladder
  console.log("Price Ladder:");
  console.log("  Asks (sell levels):");
  for (let i = askPrices.length - 1; i >= 0; i--) {
    console.log(`    ${askPrices[i].toFixed(6)} ${quoteSymbol}  ×  ${config.depthPerLevel} CASH`);
  }
  console.log("  ── spread ──");
  console.log("  Bids (buy levels):");
  for (const price of bidPrices) {
    console.log(`    ${price.toFixed(6)} ${quoteSymbol}  ×  ${config.depthPerLevel} CASH`);
  }
  console.log("");

  // Initialize SDK client
  const sdk = new CashOrderbook({
    network: getNetworkType(networkStr),
    contractAddress,
    baseAsset: baseAssetAddress,
    quoteAsset: quoteAssetAddress,
  });

  // Create account from private key
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  const account = Account.fromPrivateKey({ privateKey });

  console.log(`Trader address:   ${account.accountAddress.toString()}`);
  console.log("");

  // Check current balances
  try {
    const balances = await sdk.getBalances(account.accountAddress.toString());
    console.log(`Current balances:`);
    console.log(`  CASH: ${balances.cash.available} available, ${balances.cash.locked} locked`);
    console.log(`  USDC: ${balances.usdc.available} available, ${balances.usdc.locked} locked`);
    console.log("");

    if (balances.cash.available < totalAskQuantity) {
      console.warn(`WARNING: Insufficient CASH. Need ${totalAskQuantity}, have ${balances.cash.available}`);
    }
    if (balances.usdc.available < totalBidCost) {
      console.warn(`WARNING: Insufficient USDC. Need ${totalBidCost.toFixed(2)}, have ${balances.usdc.available}`);
    }
  } catch {
    console.log("(Could not fetch balances — continuing with order placement)");
    console.log("");
  }

  // Place bid orders (buy side)
  console.log("→ Placing bid orders...");
  let bidCount = 0;
  for (const price of bidPrices) {
    try {
      const result = await sdk.placeOrder(account, {
        pairId: config.pairId,
        price,
        quantity: config.depthPerLevel,
        side: "buy",
        orderType: "GTC",
      });
      bidCount++;
      console.log(`  ✓ Bid ${bidCount}/${config.numLevels}: ${price.toFixed(6)} × ${config.depthPerLevel} CASH → ${result.txHash}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Bid at ${price.toFixed(6)}: ${message}`);
    }
  }

  console.log("");

  // Place ask orders (sell side)
  console.log("→ Placing ask orders...");
  let askCount = 0;
  for (const price of askPrices) {
    try {
      const result = await sdk.placeOrder(account, {
        pairId: config.pairId,
        price,
        quantity: config.depthPerLevel,
        side: "sell",
        orderType: "GTC",
      });
      askCount++;
      console.log(`  ✓ Ask ${askCount}/${config.numLevels}: ${price.toFixed(6)} × ${config.depthPerLevel} CASH → ${result.txHash}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Ask at ${price.toFixed(6)}: ${message}`);
    }
  }

  console.log("");
  console.log("=============================================");
  console.log(`  ✓ Seeding Complete!`);
  console.log("=============================================");
  console.log("");
  console.log(`  Bids placed: ${bidCount}/${config.numLevels}`);
  console.log(`  Asks placed: ${askCount}/${config.numLevels}`);
  console.log("");

  if (bidCount === config.numLevels && askCount === config.numLevels) {
    console.log("  All orders placed successfully.");
    console.log("  The orderbook should now show visible depth in the frontend.");
  } else {
    console.log("  Some orders failed. Check errors above.");
    console.log("  Ensure sufficient deposited CASH and USDC balances.");
  }
  console.log("");
}

main().catch((err: unknown) => {
  console.error("Failed to seed orderbook:", err);
  process.exit(1);
});
