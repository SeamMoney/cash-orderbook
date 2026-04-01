/**
 * reseed-testnet.ts — Heavy reseed of the testnet orderbook with deep liquidity.
 *
 * Performs a full reseed suitable for a $1000 buy demo:
 *   1. Fund the deployer with APT via faucet (need 2+ APT)
 *   2. Cancel ALL existing orders on pair_id=0
 *   3. Mint 10,000,000 TestCASH and 2,000,000 USD1
 *   4. Deposit both into the orderbook contract
 *   5. Place 20 ask levels (100,000 CASH each) at 0.1001–0.1020
 *   6. Place 20 bid levels (equivalent USD1) at 0.0999–0.0980
 *   7. Verify the orderbook has 20+ levels per side
 *
 * The private key is read from .aptos/config.yaml (cash-testnet profile).
 *
 * Usage:
 *   pnpm --filter @cash/scripts reseed-testnet
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Ed25519PrivateKey,
  Account,
  type InputEntryFunctionData,
  type InputViewFunctionData,
} from "@aptos-labs/ts-sdk";

import { CashOrderbook } from "@cash/orderbook-sdk";
import {
  USD1_TESTNET_TOKEN_ADDRESS,
  USD1_DECIMALS,
  CASH_DECIMALS,
  PRICE_SCALE,
} from "@cash/shared";

import { readFileSync } from "fs";
import { resolve } from "path";

// ============================================================
// Constants
// ============================================================

/** Testnet contract address */
const CONTRACT_ADDRESS =
  "0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1";

/** USD1 contract on testnet */
const USD1_CONTRACT =
  "0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea";

/** Market pair ID */
const PAIR_ID = 0;

/** Reference price: 0.10 USD1 per CASH */
const REFERENCE_PRICE = 0.10;

/** Number of levels per side */
const NUM_LEVELS = 20;

/** CASH per level (human-readable) */
const CASH_PER_LEVEL = 100_000;

/** Total CASH to mint (human-readable) */
const CASH_MINT_AMOUNT = 10_000_000;

/** Total USD1 to mint (human-readable) */
const USD1_MINT_AMOUNT = 2_000_000;

/** All recorded transaction hashes */
const txHashes: Record<string, string> = {};

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

function toOnChainAmount(amount: number, decimals: number): number {
  return Math.round(amount * 10 ** decimals);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Step 1: Fund Deployer
// ============================================================

async function fundDeployer(aptos: Aptos, account: Account): Promise<void> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 1: Fund Deployer with APT");
  console.log("═══════════════════════════════════════════\n");

  const address = account.accountAddress.toString();
  console.log(`  Address: ${address}`);

  // Check current APT balance
  try {
    const resources = await aptos.getAccountResource({
      accountAddress: account.accountAddress,
      resourceType: "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
    });
    const balance = Number((resources as { coin: { value: string } }).coin.value) / 1e8;
    console.log(`  Current APT balance: ${balance.toFixed(4)} APT`);
  } catch {
    console.log("  (Could not query APT balance)");
  }

  // Fund via faucet — request 2 APT (200_000_000 octas)
  console.log("  → Requesting 2 APT from faucet...");
  try {
    await aptos.fundAccount({
      accountAddress: account.accountAddress,
      amount: 200_000_000,
    });
    console.log("  ✓ Funded with 2 APT from faucet");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠ Faucet request failed: ${message}`);
    console.log("  Retrying with smaller amount (1 APT)...");
    try {
      await aptos.fundAccount({
        accountAddress: account.accountAddress,
        amount: 100_000_000,
      });
      console.log("  ✓ Funded with 1 APT from faucet (retry)");
    } catch (err2: unknown) {
      const message2 = err2 instanceof Error ? err2.message : String(err2);
      console.warn(`  ⚠ Faucet retry also failed: ${message2}`);
      console.log("  Continuing with existing balance...");
    }
  }

  await sleep(2000);

  // Verify updated balance
  try {
    const resources = await aptos.getAccountResource({
      accountAddress: account.accountAddress,
      resourceType: "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
    });
    const balance = Number((resources as { coin: { value: string } }).coin.value) / 1e8;
    console.log(`  Updated APT balance: ${balance.toFixed(4)} APT`);
    if (balance < 2.0) {
      console.warn(`  ⚠ Balance is below 2 APT — some transactions may fail`);
    }
  } catch {
    console.log("  (Could not verify updated balance)");
  }
}

// ============================================================
// Step 2: Cancel All Existing Orders
// ============================================================

async function cancelAllOrders(
  sdk: CashOrderbook,
  _aptos: Aptos,
  account: Account,
): Promise<void> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 2: Cancel All Existing Orders");
  console.log("═══════════════════════════════════════════\n");

  const address = account.accountAddress.toString();

  // Get all open orders for the deployer
  let orders: Array<{ orderId: string; price: number; remaining: number; side: string }>;
  try {
    orders = await sdk.getOrders(address, PAIR_ID);
    console.log(`  Found ${orders.length} existing orders`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  Could not query orders: ${message}`);
    console.log("  Skipping cancellation step.");
    return;
  }

  if (orders.length === 0) {
    console.log("  No existing orders to cancel.");
    return;
  }

  // Cancel each order individually
  let cancelCount = 0;
  for (const order of orders) {
    try {
      const result = await sdk.cancelOrder(account, {
        pairId: PAIR_ID,
        orderId: order.orderId,
      });
      cancelCount++;
      txHashes[`cancel_${cancelCount}`] = result.txHash;
      console.log(
        `  ✓ Cancelled order ${cancelCount}/${orders.length}: ` +
        `${order.side} ${order.remaining.toFixed(2)} CASH @ ${order.price.toFixed(6)} → ${result.txHash.slice(0, 16)}...`,
      );
      await sleep(500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Failed to cancel order ${order.orderId}: ${message}`);
    }
  }

  console.log(`\n  Cancelled ${cancelCount}/${orders.length} orders`);
  await sleep(2000);
}

// ============================================================
// Step 3: Mint Tokens
// ============================================================

async function mintTokens(
  aptos: Aptos,
  account: Account,
): Promise<void> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 3: Mint Tokens");
  console.log("═══════════════════════════════════════════\n");

  // 3a: Mint TestCASH (admin-only, deployer is admin)
  const cashOnChain = toOnChainAmount(CASH_MINT_AMOUNT, CASH_DECIMALS);
  const recipientAddress = account.accountAddress.toString();

  console.log(`  → Minting ${CASH_MINT_AMOUNT.toLocaleString()} TestCASH (${cashOnChain} subunits)...`);

  const mintCashData: InputEntryFunctionData = {
    function: `${CONTRACT_ADDRESS}::test_cash::mint_test_cash`,
    functionArguments: [recipientAddress, cashOnChain],
  };

  const cashTxn = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: mintCashData,
  });

  const cashPending = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: cashTxn,
  });

  const cashCommitted = await aptos.waitForTransaction({
    transactionHash: cashPending.hash,
  });

  txHashes["mint_test_cash"] = cashCommitted.hash;
  console.log(`  ✓ TestCASH minted: ${cashCommitted.hash}`);

  await sleep(2000);

  // 3b: Mint USD1 (open, anyone can call mint_to_self)
  const usd1OnChain = toOnChainAmount(USD1_MINT_AMOUNT, USD1_DECIMALS);

  console.log(`  → Minting ${USD1_MINT_AMOUNT.toLocaleString()} USD1 (${usd1OnChain} subunits)...`);

  const mintUsd1Data: InputEntryFunctionData = {
    function: `${USD1_CONTRACT}::usd1::mint_to_self`,
    functionArguments: [usd1OnChain],
  };

  const usd1Txn = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: mintUsd1Data,
  });

  const usd1Pending = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: usd1Txn,
  });

  const usd1Committed = await aptos.waitForTransaction({
    transactionHash: usd1Pending.hash,
  });

  txHashes["mint_usd1"] = usd1Committed.hash;
  console.log(`  ✓ USD1 minted: ${usd1Committed.hash}`);

  await sleep(2000);
}

// ============================================================
// Step 4: Deposit Tokens
// ============================================================

async function depositTokens(
  sdk: CashOrderbook,
  account: Account,
  baseAssetAddress: string,
  quoteAssetAddress: string,
): Promise<void> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 4: Deposit Tokens into Orderbook");
  console.log("═══════════════════════════════════════════\n");

  // Deposit TestCASH
  console.log(`  → Depositing ${CASH_MINT_AMOUNT.toLocaleString()} CASH...`);
  const cashResult = await sdk.deposit(account, baseAssetAddress, CASH_MINT_AMOUNT, CASH_DECIMALS);
  txHashes["deposit_cash"] = cashResult.txHash;
  console.log(`  ✓ CASH deposited: ${cashResult.txHash}`);

  await sleep(2000);

  // Deposit USD1
  console.log(`  → Depositing ${USD1_MINT_AMOUNT.toLocaleString()} USD1...`);
  const usd1Result = await sdk.deposit(account, quoteAssetAddress, USD1_MINT_AMOUNT, USD1_DECIMALS);
  txHashes["deposit_usd1"] = usd1Result.txHash;
  console.log(`  ✓ USD1 deposited: ${usd1Result.txHash}`);

  await sleep(2000);
}

// ============================================================
// Step 5: Place Orders
// ============================================================

/**
 * Generate ask prices from 0.1001 to 0.1020 (20 levels, 0.0001 step).
 * Generate bid prices from 0.0999 to 0.0980 (20 levels, 0.0001 step).
 */
function generatePriceLadder(): { askPrices: number[]; bidPrices: number[] } {
  const askPrices: number[] = [];
  const bidPrices: number[] = [];

  for (let i = 0; i < NUM_LEVELS; i++) {
    // Ask: 0.1001, 0.1002, ..., 0.1020
    const askPrice = REFERENCE_PRICE + 0.0001 * (i + 1);
    askPrices.push(Math.round(askPrice * PRICE_SCALE) / PRICE_SCALE);

    // Bid: 0.0999, 0.0998, ..., 0.0980
    const bidPrice = REFERENCE_PRICE - 0.0001 * (i + 1);
    bidPrices.push(Math.round(bidPrice * PRICE_SCALE) / PRICE_SCALE);
  }

  return { askPrices, bidPrices };
}

async function placeOrders(
  sdk: CashOrderbook,
  account: Account,
): Promise<void> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 5: Place Orders");
  console.log("═══════════════════════════════════════════\n");

  const { askPrices, bidPrices } = generatePriceLadder();

  // Print ladder
  console.log("  Price Ladder (reference = 0.10 USD1/CASH):");
  console.log("    Asks (sell):");
  for (let i = askPrices.length - 1; i >= 0; i--) {
    console.log(`      ${askPrices[i].toFixed(4)} USD1  ×  ${CASH_PER_LEVEL.toLocaleString()} CASH`);
  }
  console.log("    ── spread (0.02%) ──");
  console.log("    Bids (buy):");
  for (const price of bidPrices) {
    console.log(`      ${price.toFixed(4)} USD1  ×  ${CASH_PER_LEVEL.toLocaleString()} CASH`);
  }

  const totalAskCash = NUM_LEVELS * CASH_PER_LEVEL;
  const totalBidUsd1 = bidPrices.reduce((sum, p) => sum + p * CASH_PER_LEVEL, 0);
  console.log("");
  console.log(`  Total ask liquidity: ${totalAskCash.toLocaleString()} CASH (~$${(totalAskCash * REFERENCE_PRICE).toLocaleString()} USD1)`);
  console.log(`  Total bid liquidity: ${totalBidUsd1.toLocaleString()} USD1`);
  console.log("");

  // Place ask orders (sell side)
  console.log("  → Placing ask orders...");
  let askCount = 0;
  for (const price of askPrices) {
    try {
      const result = await sdk.placeOrder(account, {
        pairId: PAIR_ID,
        price,
        quantity: CASH_PER_LEVEL,
        side: "sell",
        orderType: "GTC",
      });
      askCount++;
      txHashes[`ask_${askCount}`] = result.txHash;
      console.log(
        `    ✓ Ask ${askCount}/${NUM_LEVELS}: ${price.toFixed(4)} × ${CASH_PER_LEVEL.toLocaleString()} CASH → ${result.txHash.slice(0, 16)}...`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ Ask at ${price.toFixed(4)}: ${message}`);
    }
    await sleep(500);
  }

  console.log("");

  // Place bid orders (buy side)
  console.log("  → Placing bid orders...");
  let bidCount = 0;
  for (const price of bidPrices) {
    try {
      const result = await sdk.placeOrder(account, {
        pairId: PAIR_ID,
        price,
        quantity: CASH_PER_LEVEL,
        side: "buy",
        orderType: "GTC",
      });
      bidCount++;
      txHashes[`bid_${bidCount}`] = result.txHash;
      console.log(
        `    ✓ Bid ${bidCount}/${NUM_LEVELS}: ${price.toFixed(4)} × ${CASH_PER_LEVEL.toLocaleString()} CASH → ${result.txHash.slice(0, 16)}...`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ Bid at ${price.toFixed(4)}: ${message}`);
    }
    await sleep(500);
  }

  console.log("");
  console.log(`  Asks placed: ${askCount}/${NUM_LEVELS}`);
  console.log(`  Bids placed: ${bidCount}/${NUM_LEVELS}`);
}

// ============================================================
// Step 6: Verify Orderbook
// ============================================================

async function verifyOrderbook(sdk: CashOrderbook): Promise<boolean> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 6: Verify Orderbook");
  console.log("═══════════════════════════════════════════\n");

  try {
    const depth = await sdk.getOrderbook(PAIR_ID);

    console.log(`  Bid levels: ${depth.bids.length}`);
    for (const bid of depth.bids.slice(0, 5)) {
      console.log(`    ${bid.price.toFixed(4)} USD1  ×  ${bid.quantity.toLocaleString()} CASH  (cumul: ${bid.total.toLocaleString()})`);
    }
    if (depth.bids.length > 5) {
      console.log(`    ... and ${depth.bids.length - 5} more levels`);
    }

    console.log(`  Ask levels: ${depth.asks.length}`);
    for (const ask of depth.asks.slice(0, 5)) {
      console.log(`    ${ask.price.toFixed(4)} USD1  ×  ${ask.quantity.toLocaleString()} CASH  (cumul: ${ask.total.toLocaleString()})`);
    }
    if (depth.asks.length > 5) {
      console.log(`    ... and ${depth.asks.length - 5} more levels`);
    }

    const success = depth.bids.length >= 20 && depth.asks.length >= 20;

    if (success) {
      const bestBid = depth.bids[0]?.price ?? 0;
      const bestAsk = depth.asks[0]?.price ?? 0;
      const spread = bestAsk > 0 && bestBid > 0
        ? ((bestAsk - bestBid) / ((bestAsk + bestBid) / 2)) * 100
        : 0;

      console.log("");
      console.log(`  ✓ Orderbook verified!`);
      console.log(`    Best bid:  ${bestBid.toFixed(4)} USD1`);
      console.log(`    Best ask:  ${bestAsk.toFixed(4)} USD1`);
      console.log(`    Spread:    ${spread.toFixed(4)}%`);
      console.log(`    Bid depth: ${depth.bids.length} levels`);
      console.log(`    Ask depth: ${depth.asks.length} levels`);
    } else {
      console.log("");
      console.log(`  ⚠ Orderbook has fewer than 20 levels per side`);
    }

    return success;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Could not verify orderbook: ${message}`);
    return false;
  }
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════════");
  console.log("  CASH Orderbook — Heavy Reseed (Testnet)");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log(`  Contract:       ${CONTRACT_ADDRESS}`);
  console.log(`  USD1 contract:  ${USD1_CONTRACT}`);
  console.log(`  Reference price: ${REFERENCE_PRICE} USD1/CASH`);
  console.log(`  Levels per side: ${NUM_LEVELS}`);
  console.log(`  CASH per level:  ${CASH_PER_LEVEL.toLocaleString()}`);
  console.log(`  CASH to mint:    ${CASH_MINT_AMOUNT.toLocaleString()}`);
  console.log(`  USD1 to mint:    ${USD1_MINT_AMOUNT.toLocaleString()}`);

  // Initialize Aptos client
  const aptosConfig = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(aptosConfig);

  // Create account from private key (env var or .aptos/config.yaml)
  const privateKeyHex = loadPrivateKey();
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  const account = Account.fromPrivateKey({ privateKey });
  const deployerAddress = account.accountAddress.toString();
  console.log(`  Deployer:       ${deployerAddress}`);

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

  // Execute all steps
  await fundDeployer(aptos, account);
  await cancelAllOrders(sdk, aptos, account);
  await mintTokens(aptos, account);
  await depositTokens(sdk, account, baseAssetAddress, quoteAssetAddress);
  await placeOrders(sdk, account);
  const verified = await verifyOrderbook(sdk);

  // Final summary
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  ✓ Heavy Reseed Complete!");
  console.log("═══════════════════════════════════════════════════\n");

  console.log("  Transaction Hashes:");
  for (const [label, hash] of Object.entries(txHashes)) {
    console.log(`    ${label}: ${hash}`);
  }

  console.log("");
  console.log("  Explorer Links:");
  const keyTxns = ["mint_test_cash", "mint_usd1", "deposit_cash", "deposit_usd1"];
  for (const label of keyTxns) {
    if (txHashes[label]) {
      console.log(`    ${label}: https://explorer.aptoslabs.com/txn/${txHashes[label]}?network=testnet`);
    }
  }

  // Print first/last ask and bid explorer links
  if (txHashes["ask_1"]) {
    console.log(`    first_ask: https://explorer.aptoslabs.com/txn/${txHashes["ask_1"]}?network=testnet`);
  }
  if (txHashes[`ask_${NUM_LEVELS}`]) {
    console.log(`    last_ask: https://explorer.aptoslabs.com/txn/${txHashes[`ask_${NUM_LEVELS}`]}?network=testnet`);
  }
  if (txHashes["bid_1"]) {
    console.log(`    first_bid: https://explorer.aptoslabs.com/txn/${txHashes["bid_1"]}?network=testnet`);
  }
  if (txHashes[`bid_${NUM_LEVELS}`]) {
    console.log(`    last_bid: https://explorer.aptoslabs.com/txn/${txHashes[`bid_${NUM_LEVELS}`]}?network=testnet`);
  }

  console.log("");

  if (verified) {
    console.log("  ✓ Orderbook verified: 20+ levels on each side");
    console.log("  ✓ Ready for $1000 buy demo");
  } else {
    console.log("  ⚠ Orderbook verification incomplete — check logs above");
    process.exit(1);
  }

  console.log("");
}

main().catch((err: unknown) => {
  console.error("\nReseed failed:", err);
  console.error("\nTransaction hashes recorded so far:");
  for (const [label, hash] of Object.entries(txHashes)) {
    console.error(`  ${label}: ${hash}`);
  }
  process.exit(1);
});
