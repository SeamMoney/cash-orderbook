/**
 * cleanup-stale-orders.ts — Cancel stale/anomalous orders on the testnet orderbook.
 *
 * Finds and cancels orders at prices far below the current reference price (0.10 USD1/CASH).
 * These stale orders were left over from old seeds (before the reseed at 0.10) and cause
 * an unrealistically wide spread.
 *
 * Steps:
 *   1. Read APTOS_PRIVATE_KEY from env var or parse .aptos/config.yaml for cash-testnet profile
 *   2. Connect to testnet with the SDK (CashOrderbook)
 *   3. Call getOrderbook to find stale orders at price far below 0.09
 *   4. Cancel those specific orders using cancelOrder
 *   5. Verify the orderbook now has best ask around 0.1001 and best bid around 0.0999
 *   6. Print the cancellation transaction hashes
 *
 * Usage:
 *   pnpm --filter @cash/scripts cleanup-stale-orders
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Ed25519PrivateKey,
  Account,
  type InputViewFunctionData,
} from "@aptos-labs/ts-sdk";

import { CashOrderbook } from "@cash/orderbook-sdk";
import {
  USD1_TESTNET_TOKEN_ADDRESS,
  USD1_DECIMALS,
} from "@cash/shared";

import { readFileSync } from "fs";
import { resolve } from "path";

// ============================================================
// Constants
// ============================================================

/** Testnet contract address */
const CONTRACT_ADDRESS =
  "0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1";

/** Market pair ID */
const PAIR_ID = 0;

/** Any ask order below this price is considered stale and should be cancelled */
const STALE_PRICE_THRESHOLD = 0.09;

/** All recorded cancellation transaction hashes */
const cancelTxHashes: string[] = [];

// ============================================================
// Private Key Loading
// ============================================================

/**
 * Load the deployer private key from APTOS_PRIVATE_KEY env var,
 * or fall back to parsing .aptos/config.yaml for the cash-testnet profile.
 * Fails fast with a clear error if neither is available.
 */
function loadPrivateKey(): string {
  // 1. Check env var
  const envKey = process.env.APTOS_PRIVATE_KEY;
  if (envKey) {
    console.log("  → Using private key from APTOS_PRIVATE_KEY env var");
    return envKey;
  }

  // 2. Try .aptos/config.yaml
  const configPaths = [
    resolve(process.env.HOME ?? "~", ".aptos", "config.yaml"),
    resolve(process.cwd(), ".aptos", "config.yaml"),
  ];

  for (const configPath of configPaths) {
    try {
      const raw = readFileSync(configPath, "utf8");
      const profileMatch = raw.match(
        /cash-testnet:[\s\S]*?private_key:\s*"?([^\s"]+)"?/,
      );
      if (profileMatch?.[1]) {
        console.log(`  → Using private key from ${configPath} (cash-testnet profile)`);
        return profileMatch[1];
      }
    } catch {
      // File not found or not readable — try next path
    }
  }

  // 3. Fail fast
  console.error("\n  ✗ ERROR: No private key available.");
  console.error("    Set APTOS_PRIVATE_KEY env var, or ensure .aptos/config.yaml");
  console.error("    has a cash-testnet profile with a private_key field.");
  process.exit(1);
}

// ============================================================
// Helpers
// ============================================================

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════");
  console.log("  CASH Orderbook — Cleanup Stale Orders (Testnet)");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log(`  Contract:         ${CONTRACT_ADDRESS}`);
  console.log(`  Pair ID:          ${PAIR_ID}`);
  console.log(`  Stale threshold:  < ${STALE_PRICE_THRESHOLD} USD1/CASH`);

  // Initialize Aptos client
  const aptosConfig = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(aptosConfig);

  // Create account from private key
  const privateKeyHex = loadPrivateKey();
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  const account = Account.fromPrivateKey({ privateKey });
  const deployerAddress = account.accountAddress.toString();
  console.log(`  Deployer:         ${deployerAddress}`);

  // Query TestCASH metadata address
  console.log("\n  → Querying TestCASH metadata address...");
  const viewPayload: InputViewFunctionData = {
    function: `${CONTRACT_ADDRESS}::test_cash::get_metadata_address`,
    functionArguments: [],
  };
  const viewResult = await aptos.view({ payload: viewPayload });
  const baseAssetAddress = viewResult[0] as string;
  console.log(`    TestCASH metadata: ${baseAssetAddress}`);

  const quoteAssetAddress = USD1_TESTNET_TOKEN_ADDRESS;
  console.log(`    USD1 metadata:     ${quoteAssetAddress}`);

  // Initialize SDK (USD1 has 8 decimals on testnet)
  const sdk = new CashOrderbook({
    network: "testnet",
    contractAddress: CONTRACT_ADDRESS,
    baseAsset: baseAssetAddress,
    quoteAsset: quoteAssetAddress,
    quoteDecimals: USD1_DECIMALS,
  });

  // ========================================================
  // Step 1: Get current orderbook and identify stale orders
  // ========================================================

  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 1: Inspect Current Orderbook");
  console.log("═══════════════════════════════════════════\n");

  const depth = await sdk.getOrderbook(PAIR_ID);

  console.log(`  Bid levels: ${depth.bids.length}`);
  if (depth.bids.length > 0) {
    console.log(`    Best bid: ${depth.bids[0].price.toFixed(6)} USD1/CASH`);
  }

  console.log(`  Ask levels: ${depth.asks.length}`);
  for (const ask of depth.asks) {
    const isStale = ask.price < STALE_PRICE_THRESHOLD;
    console.log(
      `    ${ask.price.toFixed(6)} USD1  ×  ${ask.quantity.toLocaleString()} CASH` +
      (isStale ? "  ← STALE (will be cancelled)" : ""),
    );
  }

  // Identify stale ask levels (price below threshold)
  const staleAskPrices = depth.asks
    .filter((ask) => ask.price < STALE_PRICE_THRESHOLD)
    .map((ask) => ask.price);

  if (staleAskPrices.length === 0) {
    console.log("\n  ✓ No stale ask orders found. Orderbook is clean.");

    // Print current spread info
    if (depth.bids.length > 0 && depth.asks.length > 0) {
      const bestBid = depth.bids[0].price;
      const bestAsk = depth.asks[0].price;
      const spread = ((bestAsk - bestBid) / ((bestAsk + bestBid) / 2)) * 100;
      console.log(`\n    Best bid:  ${bestBid.toFixed(6)} USD1`);
      console.log(`    Best ask:  ${bestAsk.toFixed(6)} USD1`);
      console.log(`    Spread:    ${spread.toFixed(4)}%`);
    }
    return;
  }

  console.log(`\n  Found ${staleAskPrices.length} stale ask price level(s): ${staleAskPrices.map((p) => p.toFixed(6)).join(", ")}`);

  // ========================================================
  // Step 2: Get deployer's open orders and match stale prices
  // ========================================================

  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 2: Find Stale Orders by Deployer");
  console.log("═══════════════════════════════════════════\n");

  const orders = await sdk.getOrders(deployerAddress, PAIR_ID);
  console.log(`  Total open orders for deployer: ${orders.length}`);

  const staleOrders = orders.filter(
    (order) => order.side === "sell" && order.price < STALE_PRICE_THRESHOLD,
  );

  console.log(`  Stale sell orders (price < ${STALE_PRICE_THRESHOLD}): ${staleOrders.length}`);

  for (const order of staleOrders) {
    console.log(
      `    Order #${order.orderId}: ${order.side} ${order.remaining.toFixed(2)} CASH @ ${order.price.toFixed(6)} USD1`,
    );
  }

  if (staleOrders.length === 0) {
    console.log("\n  ⚠ No stale orders found for deployer. They may belong to another account.");
    console.log("  The stale orders in the orderbook may need to be cancelled by their owner.");
    return;
  }

  // ========================================================
  // Step 3: Cancel stale orders
  // ========================================================

  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 3: Cancel Stale Orders");
  console.log("═══════════════════════════════════════════\n");

  let cancelCount = 0;
  for (const order of staleOrders) {
    try {
      const result = await sdk.cancelOrder(account, {
        pairId: PAIR_ID,
        orderId: order.orderId,
      });
      cancelCount++;
      cancelTxHashes.push(result.txHash);
      console.log(
        `  ✓ Cancelled ${cancelCount}/${staleOrders.length}: ` +
        `order #${order.orderId} (${order.side} ${order.remaining.toFixed(2)} CASH @ ${order.price.toFixed(6)}) → ${result.txHash}`,
      );
      await sleep(500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Failed to cancel order #${order.orderId}: ${message}`);
    }
  }

  console.log(`\n  Cancelled ${cancelCount}/${staleOrders.length} stale orders`);

  // ========================================================
  // Step 4: Verify orderbook after cleanup
  // ========================================================

  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 4: Verify Orderbook After Cleanup");
  console.log("═══════════════════════════════════════════\n");

  await sleep(2000); // Wait for chain state to settle

  const updatedDepth = await sdk.getOrderbook(PAIR_ID);

  console.log(`  Bid levels: ${updatedDepth.bids.length}`);
  for (const bid of updatedDepth.bids.slice(0, 5)) {
    console.log(`    ${bid.price.toFixed(6)} USD1  ×  ${bid.quantity.toLocaleString()} CASH`);
  }
  if (updatedDepth.bids.length > 5) {
    console.log(`    ... and ${updatedDepth.bids.length - 5} more levels`);
  }

  console.log(`  Ask levels: ${updatedDepth.asks.length}`);
  for (const ask of updatedDepth.asks.slice(0, 5)) {
    console.log(`    ${ask.price.toFixed(6)} USD1  ×  ${ask.quantity.toLocaleString()} CASH`);
  }
  if (updatedDepth.asks.length > 5) {
    console.log(`    ... and ${updatedDepth.asks.length - 5} more levels`);
  }

  // Check remaining stale orders
  const remainingStale = updatedDepth.asks.filter((ask) => ask.price < STALE_PRICE_THRESHOLD);
  if (remainingStale.length > 0) {
    console.log(`\n  ⚠ ${remainingStale.length} stale ask level(s) remain (may belong to other accounts)`);
  }

  // Print spread
  if (updatedDepth.bids.length > 0 && updatedDepth.asks.length > 0) {
    const bestBid = updatedDepth.bids[0].price;
    const bestAsk = updatedDepth.asks[0].price;
    const spread = ((bestAsk - bestBid) / ((bestAsk + bestBid) / 2)) * 100;

    console.log("");
    console.log(`  Best bid:  ${bestBid.toFixed(6)} USD1`);
    console.log(`  Best ask:  ${bestAsk.toFixed(6)} USD1`);
    console.log(`  Spread:    ${spread.toFixed(4)}%`);

    const bidOk = bestBid >= 0.0990 && bestBid <= 0.1000;
    const askOk = bestAsk >= 0.1000 && bestAsk <= 0.1010;
    const spreadOk = spread < 0.5;

    if (bidOk && askOk && spreadOk) {
      console.log("\n  ✓ Orderbook looks healthy! Best bid ~0.0999, best ask ~0.1001, spread < 0.5%");
    } else {
      if (!bidOk) console.log(`  ⚠ Best bid (${bestBid.toFixed(6)}) is outside expected range [0.0990, 0.1000]`);
      if (!askOk) console.log(`  ⚠ Best ask (${bestAsk.toFixed(6)}) is outside expected range [0.1000, 0.1010]`);
      if (!spreadOk) console.log(`  ⚠ Spread (${spread.toFixed(4)}%) is wider than 0.5%`);
    }
  }

  // ========================================================
  // Summary
  // ========================================================

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  ✓ Cleanup Complete!");
  console.log("═══════════════════════════════════════════════════\n");

  console.log("  Cancellation Transaction Hashes:");
  for (let i = 0; i < cancelTxHashes.length; i++) {
    console.log(`    ${i + 1}. ${cancelTxHashes[i]}`);
    console.log(`       https://explorer.aptoslabs.com/txn/${cancelTxHashes[i]}?network=testnet`);
  }

  console.log("");
}

main().catch((err: unknown) => {
  console.error("\nCleanup failed:", err);
  process.exit(1);
});
