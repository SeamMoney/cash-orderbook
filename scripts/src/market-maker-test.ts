/**
 * market-maker-test.ts — Market maker simulation: bid/ask ladders, taker fills, rebalance.
 *
 * Steps:
 *   1. Connect to testnet via SDK
 *   2. Query initial balances (inventory state "before")
 *   3. Place 10 bid + 10 ask limit orders with configurable spread
 *   4. Simulate a taker fill (market order against the placed orders)
 *   5. After fill, cancel remaining orders
 *   6. Recalculate midpoint, place new ladder
 *   7. Report: inventory state before/after, PnL, rebalance latency
 *
 * Environment variables:
 *   APTOS_PRIVATE_KEY     — Hex-encoded ed25519 private key of the market maker
 *   CONTRACT_ADDRESS       — Address where cash_orderbook is deployed
 *   APTOS_NETWORK          — Network: testnet (default: testnet)
 *   BASE_ASSET_ADDRESS     — TestCASH metadata address (optional, queried if not set)
 *   QUOTE_ASSET_ADDRESS    — USD1 metadata address (default: testnet USD1)
 *   REFERENCE_PRICE        — Mid price in USD1 (default: 0.0001)
 *   SPREAD_BPS             — Half-spread in basis points (default: 100 = 1%)
 *   DEPTH_PER_LEVEL        — CASH quantity per price level (default: 50)
 *   NUM_LEVELS             — Number of levels per side (default: 10)
 *   PAIR_ID                — Market pair ID (default: 0)
 *   TAKER_QUANTITY         — CASH quantity for taker fill (default: 25)
 *   TAKER_SIDE             — Taker side: "buy" or "sell" (default: "buy")
 *
 * Usage:
 *   APTOS_PRIVATE_KEY=<key> CONTRACT_ADDRESS=<addr> npx tsx scripts/src/market-maker-test.ts
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Ed25519PrivateKey,
  Account,
  type InputViewFunctionData,
  type UserTransactionResponse,
} from "@aptos-labs/ts-sdk";

import { CashOrderbook } from "@cash/orderbook-sdk";
import {
  USD1_TESTNET_TOKEN_ADDRESS,
  PRICE_SCALE,
} from "@cash/shared";

// ============================================================
// Types
// ============================================================

interface InventoryState {
  cashAvailable: number;
  cashLocked: number;
  quoteAvailable: number;
  quoteLocked: number;
  /** Total CASH value = available + locked */
  totalCash: number;
  /** Total quote value = available + locked */
  totalQuote: number;
  /** Notional portfolio value in USD1 (using reference price) */
  notionalValue: number;
}

interface PlacedOrder {
  txHash: string;
  side: "buy" | "sell";
  price: number;
  quantity: number;
}

interface LadderResult {
  bidsPlaced: number;
  asksPlaced: number;
  orders: PlacedOrder[];
  latencyMs: number;
}

interface RebalanceReport {
  /** Inventory before market making started */
  inventoryBefore: InventoryState;
  /** Inventory after taker fill */
  inventoryAfterFill: InventoryState;
  /** Inventory after rebalance */
  inventoryAfterRebalance: InventoryState;
  /** PnL in quote units (USD1) */
  pnlQuote: number;
  /** PnL as percentage of starting notional */
  pnlPercent: number;
  /** Latency for initial ladder placement (ms) */
  ladderLatencyMs: number;
  /** Latency for taker fill (ms) */
  fillLatencyMs: number;
  /** Latency for cancel + re-ladder (ms) */
  rebalanceLatencyMs: number;
  /** Taker fill transaction hash */
  fillTxHash: string;
  /** Whether the fill succeeded */
  fillSuccess: boolean;
}

// ============================================================
// Configuration
// ============================================================

interface MakerConfig {
  referencePrice: number;
  spreadBps: number;
  depthPerLevel: number;
  numLevels: number;
  pairId: number;
  takerQuantity: number;
  takerSide: "buy" | "sell";
}

function loadConfig(): MakerConfig {
  const takerSide = process.env.TAKER_SIDE ?? "buy";
  if (takerSide !== "buy" && takerSide !== "sell") {
    console.error("ERROR: TAKER_SIDE must be 'buy' or 'sell'");
    process.exit(1);
  }
  return {
    referencePrice: parseFloat(process.env.REFERENCE_PRICE ?? "0.0001"),
    spreadBps: parseInt(process.env.SPREAD_BPS ?? "100", 10),
    depthPerLevel: parseFloat(process.env.DEPTH_PER_LEVEL ?? "50"),
    numLevels: parseInt(process.env.NUM_LEVELS ?? "10", 10),
    pairId: parseInt(process.env.PAIR_ID ?? "0", 10),
    takerQuantity: parseFloat(process.env.TAKER_QUANTITY ?? "25"),
    takerSide: takerSide as "buy" | "sell",
  };
}

function getEnvOrExit(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`ERROR: ${name} environment variable is required.`);
    process.exit(1);
  }
  return value;
}

// ============================================================
// Helpers
// ============================================================

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate bid and ask price levels around a reference price.
 */
function generatePriceLevels(
  referencePrice: number,
  spreadBps: number,
  numLevels: number,
): { bidPrices: number[]; askPrices: number[] } {
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

/**
 * Get inventory state from SDK balances.
 */
async function getInventory(
  sdk: CashOrderbook,
  address: string,
  refPrice: number,
): Promise<InventoryState> {
  const balances = await sdk.getBalances(address);
  const totalCash = balances.cash.available + balances.cash.locked;
  const totalQuote = balances.usdc.available + balances.usdc.locked;
  // Notional = quote value + (cash value * reference price)
  const notionalValue = totalQuote + totalCash * refPrice;

  return {
    cashAvailable: balances.cash.available,
    cashLocked: balances.cash.locked,
    quoteAvailable: balances.usdc.available,
    quoteLocked: balances.usdc.locked,
    totalCash,
    totalQuote,
    notionalValue,
  };
}

function printInventory(label: string, inv: InventoryState): void {
  console.log(`  ${label}:`);
  console.log(`    CASH available: ${inv.cashAvailable.toFixed(6)}`);
  console.log(`    CASH locked:    ${inv.cashLocked.toFixed(6)}`);
  console.log(`    CASH total:     ${inv.totalCash.toFixed(6)}`);
  console.log(`    Quote available: ${inv.quoteAvailable.toFixed(8)}`);
  console.log(`    Quote locked:    ${inv.quoteLocked.toFixed(8)}`);
  console.log(`    Quote total:     ${inv.totalQuote.toFixed(8)}`);
  console.log(`    Notional value:  ${inv.notionalValue.toFixed(8)} USD1`);
}

// ============================================================
// Core Operations
// ============================================================

/**
 * Place a ladder of bid and ask orders.
 */
async function placeLadder(
  sdk: CashOrderbook,
  account: Account,
  config: MakerConfig,
  bidPrices: number[],
  askPrices: number[],
): Promise<LadderResult> {
  const orders: PlacedOrder[] = [];
  let bidsPlaced = 0;
  let asksPlaced = 0;

  const startTime = performance.now();

  // Place bid orders
  for (const price of bidPrices) {
    try {
      const result = await sdk.placeOrder(account, {
        pairId: config.pairId,
        price,
        quantity: config.depthPerLevel,
        side: "buy",
        orderType: "GTC",
      });
      bidsPlaced++;
      orders.push({ txHash: result.txHash, side: "buy", price, quantity: config.depthPerLevel });
      console.log(`    ✓ Bid ${bidsPlaced}/${config.numLevels}: ${price.toFixed(6)} × ${config.depthPerLevel} CASH`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ Bid at ${price.toFixed(6)}: ${message}`);
    }
    await sleep(300); // Avoid sequence number conflicts
  }

  // Place ask orders
  for (const price of askPrices) {
    try {
      const result = await sdk.placeOrder(account, {
        pairId: config.pairId,
        price,
        quantity: config.depthPerLevel,
        side: "sell",
        orderType: "GTC",
      });
      asksPlaced++;
      orders.push({ txHash: result.txHash, side: "sell", price, quantity: config.depthPerLevel });
      console.log(`    ✓ Ask ${asksPlaced}/${config.numLevels}: ${price.toFixed(6)} × ${config.depthPerLevel} CASH`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ Ask at ${price.toFixed(6)}: ${message}`);
    }
    await sleep(300);
  }

  const endTime = performance.now();

  return {
    bidsPlaced,
    asksPlaced,
    orders,
    latencyMs: endTime - startTime,
  };
}

/**
 * Cancel all open orders for the account on a market.
 */
async function cancelAllOrders(
  sdk: CashOrderbook,
  account: Account,
  pairId: number,
): Promise<{ cancelled: number; latencyMs: number }> {
  const startTime = performance.now();
  let cancelled = 0;

  try {
    const openOrders = await sdk.getOrders(account.accountAddress.toString(), pairId);
    console.log(`    Found ${openOrders.length} open orders to cancel`);

    for (const order of openOrders) {
      try {
        await sdk.cancelOrder(account, { pairId, orderId: order.orderId });
        cancelled++;
        console.log(`    ✓ Cancelled order ${order.orderId} (${order.side} @ ${order.price.toFixed(6)})`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`    ✗ Cancel order ${order.orderId}: ${message}`);
      }
      await sleep(300);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`    ✗ Could not fetch orders: ${message}`);
  }

  const endTime = performance.now();

  return { cancelled, latencyMs: endTime - startTime };
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const privateKeyHex = getEnvOrExit("APTOS_PRIVATE_KEY");
  const contractAddress = getEnvOrExit("CONTRACT_ADDRESS");
  const networkStr = process.env.APTOS_NETWORK ?? "testnet";

  const config = loadConfig();

  // Resolve asset addresses
  const quoteAssetAddress = process.env.QUOTE_ASSET_ADDRESS ?? USD1_TESTNET_TOKEN_ADDRESS;
  let baseAssetAddress = process.env.BASE_ASSET_ADDRESS;

  console.log("═══════════════════════════════════════════════════");
  console.log("  CASH Orderbook — Market Maker Test");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log(`  Network:         ${networkStr}`);
  console.log(`  Contract:        ${contractAddress}`);
  console.log(`  Reference price: ${config.referencePrice} USD1/CASH`);
  console.log(`  Spread:          ${config.spreadBps} bps (${config.spreadBps / 100}%)`);
  console.log(`  Levels per side: ${config.numLevels}`);
  console.log(`  Depth per level: ${config.depthPerLevel} CASH`);
  console.log(`  Taker quantity:  ${config.takerQuantity} CASH`);
  console.log(`  Taker side:      ${config.takerSide}`);

  // Initialize Aptos client
  const aptosConfig = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(aptosConfig);

  // Create account from private key
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  const account = Account.fromPrivateKey({ privateKey });
  const makerAddress = account.accountAddress.toString();

  console.log(`  Maker address:   ${makerAddress}`);

  // Query base asset if not provided
  if (!baseAssetAddress) {
    try {
      const viewPayload: InputViewFunctionData = {
        function: `${contractAddress}::test_cash::get_metadata_address`,
        functionArguments: [],
      };
      const result = await aptos.view({ payload: viewPayload });
      baseAssetAddress = result[0] as string;
    } catch {
      console.error("ERROR: Could not query TestCASH address. Set BASE_ASSET_ADDRESS env var.");
      process.exit(1);
    }
  }

  console.log(`  Base asset:      ${baseAssetAddress}`);
  console.log(`  Quote asset:     ${quoteAssetAddress}`);
  console.log("");

  // Initialize SDK
  const sdk = new CashOrderbook({
    network: networkStr === "testnet" ? "testnet" : "mainnet",
    contractAddress,
    baseAsset: baseAssetAddress,
    quoteAsset: quoteAssetAddress,
  });

  // ── Step 1: Capture initial inventory ──
  console.log("── Step 1: Initial Inventory ──");
  let inventoryBefore: InventoryState;
  try {
    inventoryBefore = await getInventory(sdk, makerAddress, config.referencePrice);
    printInventory("Before", inventoryBefore);
  } catch (err: unknown) {
    console.error(`  Could not fetch initial balances: ${err instanceof Error ? err.message : String(err)}`);
    inventoryBefore = {
      cashAvailable: 0, cashLocked: 0, quoteAvailable: 0, quoteLocked: 0,
      totalCash: 0, totalQuote: 0, notionalValue: 0,
    };
  }
  console.log("");

  // ── Step 2: Place initial ladder ──
  console.log("── Step 2: Place Bid/Ask Ladder ──");
  const { bidPrices, askPrices } = generatePriceLevels(
    config.referencePrice,
    config.spreadBps,
    config.numLevels,
  );

  console.log("  Placing orders...");
  const ladderResult = await placeLadder(sdk, account, config, bidPrices, askPrices);

  console.log("");
  console.log(`  Bids placed:  ${ladderResult.bidsPlaced}/${config.numLevels}`);
  console.log(`  Asks placed:  ${ladderResult.asksPlaced}/${config.numLevels}`);
  console.log(`  Ladder time:  ${ladderResult.latencyMs.toFixed(0)} ms`);
  console.log("");

  await sleep(2000); // Wait for on-chain settlement

  // ── Step 3: Simulate taker fill ──
  console.log("── Step 3: Simulate Taker Fill ──");
  console.log(`  Placing ${config.takerSide} market order for ${config.takerQuantity} CASH...`);

  const fillStartTime = performance.now();
  let fillTxHash = "FAILED";
  let fillSuccess = false;

  try {
    const fillResult = await sdk.placeOrder(account, {
      pairId: config.pairId,
      price: 0,
      quantity: config.takerQuantity,
      side: config.takerSide,
      orderType: "Market",
    });

    fillTxHash = fillResult.txHash;

    // Fetch tx details
    const txnDetails = (await aptos.getTransactionByHash({
      transactionHash: fillResult.txHash,
    })) as UserTransactionResponse;

    fillSuccess = txnDetails.success;
    const gasUsed = parseInt(String(txnDetails.gas_used), 10);
    const gasUnitPrice = parseInt(String(txnDetails.gas_unit_price), 10);
    const gasCostApt = (gasUsed * gasUnitPrice) / 1e8;

    console.log(`  ✓ Fill submitted: ${fillResult.txHash}`);
    console.log(`  Success:          ${fillSuccess}`);
    console.log(`  Gas cost:         ${gasCostApt.toFixed(8)} APT`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Fill failed: ${message}`);
  }

  const fillEndTime = performance.now();
  const fillLatencyMs = fillEndTime - fillStartTime;
  console.log(`  Fill latency:     ${fillLatencyMs.toFixed(0)} ms`);
  console.log("");

  await sleep(2000); // Wait for settlement

  // ── Step 4: Post-fill inventory ──
  console.log("── Step 4: Post-Fill Inventory ──");
  let inventoryAfterFill: InventoryState;
  try {
    inventoryAfterFill = await getInventory(sdk, makerAddress, config.referencePrice);
    printInventory("After fill", inventoryAfterFill);
  } catch (err: unknown) {
    console.error(`  Could not fetch post-fill balances: ${err instanceof Error ? err.message : String(err)}`);
    inventoryAfterFill = inventoryBefore;
  }
  console.log("");

  // ── Step 5: Rebalance — cancel remaining, recalculate midpoint, place new ladder ──
  console.log("── Step 5: Rebalance ──");
  const rebalanceStartTime = performance.now();

  // 5a: Cancel all remaining orders
  console.log("  → Cancelling remaining orders...");
  const cancelResult = await cancelAllOrders(sdk, account, config.pairId);
  console.log(`    Cancelled: ${cancelResult.cancelled} orders (${cancelResult.latencyMs.toFixed(0)} ms)`);
  console.log("");

  await sleep(2000);

  // 5b: Recalculate midpoint from current orderbook
  console.log("  → Querying updated orderbook for new midpoint...");
  const newDepth = await sdk.getOrderbook(config.pairId);
  let newMidpoint = config.referencePrice; // fallback

  if (newDepth.bids.length > 0 && newDepth.asks.length > 0) {
    newMidpoint = (newDepth.bids[0].price + newDepth.asks[0].price) / 2;
    console.log(`    New midpoint from book: ${newMidpoint.toFixed(8)} USD1/CASH`);
  } else if (newDepth.bids.length > 0) {
    newMidpoint = newDepth.bids[0].price;
    console.log(`    Using best bid as reference: ${newMidpoint.toFixed(8)} USD1/CASH`);
  } else if (newDepth.asks.length > 0) {
    newMidpoint = newDepth.asks[0].price;
    console.log(`    Using best ask as reference: ${newMidpoint.toFixed(8)} USD1/CASH`);
  } else {
    console.log(`    No orders in book, using default reference: ${newMidpoint.toFixed(8)} USD1/CASH`);
  }
  console.log("");

  // 5c: Place new ladder
  console.log("  → Placing new ladder...");
  const { bidPrices: newBids, askPrices: newAsks } = generatePriceLevels(
    newMidpoint,
    config.spreadBps,
    config.numLevels,
  );

  const newLadderResult = await placeLadder(sdk, account, config, newBids, newAsks);

  const rebalanceEndTime = performance.now();
  const rebalanceLatencyMs = rebalanceEndTime - rebalanceStartTime;

  console.log("");
  console.log(`  New bids placed: ${newLadderResult.bidsPlaced}/${config.numLevels}`);
  console.log(`  New asks placed: ${newLadderResult.asksPlaced}/${config.numLevels}`);
  console.log(`  Rebalance time:  ${rebalanceLatencyMs.toFixed(0)} ms`);
  console.log("");

  await sleep(2000);

  // ── Step 6: Final inventory ──
  console.log("── Step 6: Final Inventory ──");
  let inventoryAfterRebalance: InventoryState;
  try {
    inventoryAfterRebalance = await getInventory(sdk, makerAddress, config.referencePrice);
    printInventory("After rebalance", inventoryAfterRebalance);
  } catch (err: unknown) {
    console.error(`  Could not fetch final balances: ${err instanceof Error ? err.message : String(err)}`);
    inventoryAfterRebalance = inventoryAfterFill;
  }
  console.log("");

  // ── Step 7: Report ──
  const pnlQuote = inventoryAfterRebalance.notionalValue - inventoryBefore.notionalValue;
  const pnlPercent =
    inventoryBefore.notionalValue > 0
      ? (pnlQuote / inventoryBefore.notionalValue) * 100
      : 0;

  const report: RebalanceReport = {
    inventoryBefore,
    inventoryAfterFill,
    inventoryAfterRebalance,
    pnlQuote,
    pnlPercent,
    ladderLatencyMs: ladderResult.latencyMs,
    fillLatencyMs,
    rebalanceLatencyMs,
    fillTxHash,
    fillSuccess,
  };

  console.log("═══════════════════════════════════════════════════");
  console.log("  Market Maker Report");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log("  ┌─────────────────────────────────────────────┐");
  console.log("  │ Inventory                                   │");
  console.log("  ├─────────────────────────────────────────────┤");
  console.log(`  │ Before:     ${report.inventoryBefore.notionalValue.toFixed(8).padStart(18)} USD1 │`);
  console.log(`  │ After fill: ${report.inventoryAfterFill.notionalValue.toFixed(8).padStart(18)} USD1 │`);
  console.log(`  │ After rebal:${report.inventoryAfterRebalance.notionalValue.toFixed(8).padStart(18)} USD1 │`);
  console.log("  ├─────────────────────────────────────────────┤");
  console.log("  │ PnL                                         │");
  console.log("  ├─────────────────────────────────────────────┤");
  console.log(`  │ PnL (USD1):  ${report.pnlQuote >= 0 ? "+" : ""}${report.pnlQuote.toFixed(8).padStart(17)} USD1 │`);
  console.log(`  │ PnL (%):     ${report.pnlPercent >= 0 ? "+" : ""}${report.pnlPercent.toFixed(4).padStart(17)}%    │`);
  console.log("  ├─────────────────────────────────────────────┤");
  console.log("  │ Latency                                     │");
  console.log("  ├─────────────────────────────────────────────┤");
  console.log(`  │ Ladder:     ${report.ladderLatencyMs.toFixed(0).padStart(18)} ms   │`);
  console.log(`  │ Fill:       ${report.fillLatencyMs.toFixed(0).padStart(18)} ms   │`);
  console.log(`  │ Rebalance:  ${report.rebalanceLatencyMs.toFixed(0).padStart(18)} ms   │`);
  console.log("  ├─────────────────────────────────────────────┤");
  console.log("  │ Fill                                        │");
  console.log("  ├─────────────────────────────────────────────┤");
  console.log(`  │ Tx hash:    ${report.fillTxHash.slice(0, 30).padEnd(30)}  │`);
  console.log(`  │ Success:    ${String(report.fillSuccess).padEnd(30)}  │`);
  console.log("  └─────────────────────────────────────────────┘");
  console.log("");

  if (report.fillTxHash !== "FAILED") {
    console.log(`  Explorer: https://explorer.aptoslabs.com/txn/${report.fillTxHash}?network=testnet`);
    console.log("");
  }

  // Cash position delta
  const cashDelta = inventoryAfterRebalance.totalCash - inventoryBefore.totalCash;
  const quoteDelta = inventoryAfterRebalance.totalQuote - inventoryBefore.totalQuote;
  console.log("  Position Changes:");
  console.log(`    CASH: ${cashDelta >= 0 ? "+" : ""}${cashDelta.toFixed(6)}`);
  console.log(`    USD1: ${quoteDelta >= 0 ? "+" : ""}${quoteDelta.toFixed(8)}`);
  console.log("");

  if (!report.fillSuccess) {
    console.log("  ⚠ Taker fill did not succeed on-chain.");
    process.exit(1);
  }

  console.log("  ✓ Market maker test complete.");
  console.log("");
}

main().catch((err: unknown) => {
  console.error("Market maker test failed:", err);
  process.exit(1);
});
