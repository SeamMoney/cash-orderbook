/**
 * buy-simulation.ts — Simulate a $1000 USD1 market buy of CASH on testnet.
 *
 * Steps:
 *   1. Connect to testnet via SDK
 *   2. Query current orderbook depth
 *   3. Calculate expected fill: how much CASH for 1000 USD1, effective price, slippage vs midpoint
 *   4. Execute the market buy order on-chain
 *   5. Measure latency (submission to confirmation)
 *   6. Report: fill amount, effective price, slippage %, gas cost in APT, total cost, execution latency
 *
 * Environment variables:
 *   APTOS_PRIVATE_KEY   — Hex-encoded ed25519 private key of the trading account
 *   CONTRACT_ADDRESS     — Address where cash_orderbook is deployed
 *   APTOS_NETWORK        — Network: testnet (default: testnet)
 *   BASE_ASSET_ADDRESS   — TestCASH metadata address (optional, queried if not set)
 *   QUOTE_ASSET_ADDRESS  — USD1 metadata address (default: testnet USD1)
 *   BUY_AMOUNT_USD1      — Amount of USD1 to spend (default: 1000)
 *   PAIR_ID              — Market pair ID (default: 0)
 *
 * Usage:
 *   APTOS_PRIVATE_KEY=<key> CONTRACT_ADDRESS=<addr> npx tsx scripts/src/buy-simulation.ts
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Ed25519PrivateKey,
  Account,
  type InputEntryFunctionData,
  type InputViewFunctionData,
  type UserTransactionResponse,
} from "@aptos-labs/ts-sdk";

import { CashOrderbook } from "@cash/orderbook-sdk";
import {
  USD1_TESTNET_TOKEN_ADDRESS,
  USD1_DECIMALS,
  CASH_DECIMALS,
  PRICE_SCALE,
} from "@cash/shared";

/** Default USD1 contract address on testnet (for minting) */
const DEFAULT_USD1_CONTRACT = "0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea";

// ============================================================
// Types
// ============================================================

interface FillEstimate {
  /** Total CASH that would be received */
  cashAmount: number;
  /** Total USD1 spent */
  usd1Spent: number;
  /** Weighted average fill price (USD1 per CASH) */
  effectivePrice: number;
  /** Midpoint price (average of best bid and best ask) */
  midpointPrice: number;
  /** Slippage vs midpoint in percent */
  slippagePercent: number;
  /** Number of price levels consumed */
  levelsConsumed: number;
  /** Whether the full amount can be filled */
  fullFill: boolean;
}

interface FillVerification {
  /** Whether the fill was verified (trade events or balance delta confirm quantity > 0) */
  verified: boolean;
  /** Actual filled CASH quantity */
  filledQuantity: number;
  /** Actual fill price (weighted average) */
  fillPrice: number;
  /** Method used: "trade_events" or "balance_delta" */
  method: "trade_events" | "balance_delta";
}

interface ExecutionReport {
  /** Fill estimate (pre-trade) */
  estimate: FillEstimate;
  /** Transaction hash */
  txHash: string;
  /** Latency from submission to confirmation in milliseconds */
  latencyMs: number;
  /** Gas used in the transaction (in gas units) */
  gasUsed: number;
  /** Gas unit price in octas */
  gasUnitPrice: number;
  /** Gas cost in APT */
  gasCostApt: number;
  /** Whether the transaction succeeded */
  success: boolean;
  /** Fill verification details (trade events / balance comparison) */
  fillVerification: FillVerification;
}

// ============================================================
// Configuration
// ============================================================

function getEnvOrExit(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`ERROR: ${name} environment variable is required.`);
    process.exit(1);
  }
  return value;
}

// ============================================================
// Fill Estimation
// ============================================================

/**
 * Walk the ask side of the orderbook to estimate how much CASH
 * can be bought for a given USD1 amount.
 *
 * Asks are sorted ascending by price.
 * For each ask level: cost = askPrice * askQuantity (in USD1).
 * Walk levels until we exhaust the budget.
 */
function estimateFill(
  asks: Array<{ price: number; quantity: number }>,
  bids: Array<{ price: number; quantity: number }>,
  usd1Budget: number,
): FillEstimate {
  let remainingBudget = usd1Budget;
  let totalCash = 0;
  let totalUsd1Spent = 0;
  let levelsConsumed = 0;

  // Calculate midpoint
  const bestBid = bids.length > 0 ? bids[0].price : 0;
  const bestAsk = asks.length > 0 ? asks[0].price : 0;
  const midpointPrice =
    bestBid > 0 && bestAsk > 0
      ? (bestBid + bestAsk) / 2
      : bestAsk > 0
        ? bestAsk
        : bestBid > 0
          ? bestBid
          : 0;

  for (const ask of asks) {
    if (remainingBudget <= 0) break;

    const levelCost = ask.price * ask.quantity;

    if (levelCost <= remainingBudget) {
      // Consume entire level
      totalCash += ask.quantity;
      totalUsd1Spent += levelCost;
      remainingBudget -= levelCost;
      levelsConsumed++;
    } else {
      // Partial fill at this level
      const partialCash = remainingBudget / ask.price;
      totalCash += partialCash;
      totalUsd1Spent += remainingBudget;
      remainingBudget = 0;
      levelsConsumed++;
    }
  }

  const effectivePrice = totalCash > 0 ? totalUsd1Spent / totalCash : 0;
  const slippagePercent =
    midpointPrice > 0
      ? ((effectivePrice - midpointPrice) / midpointPrice) * 100
      : 0;

  return {
    cashAmount: totalCash,
    usd1Spent: totalUsd1Spent,
    effectivePrice,
    midpointPrice,
    slippagePercent,
    levelsConsumed,
    fullFill: remainingBudget <= 0.000001, // floating point tolerance
  };
}

// ============================================================
// Buyer Account Setup
// ============================================================

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a separate buyer account, fund it, mint USD1, and deposit
 * into the orderbook. This avoids self-trade prevention (the seed account placed
 * the asks, so it cannot buy against its own orders).
 *
 * Funding strategy: tries the faucet first; if that fails (testnet faucet is now
 * web-only), falls back to a direct APT transfer from the deployer account.
 */
async function setupBuyerAccount(
  aptos: Aptos,
  contractAddress: string,
  quoteAssetAddress: string,
  usd1Budget: number,
  deployerAccount?: Account,
): Promise<{ buyerAccount: Account; buyerSdk: CashOrderbook; baseAssetAddress: string }> {
  const buyerKeyHex = process.env.BUYER_PRIVATE_KEY;
  let buyerAccount: Account;

  if (buyerKeyHex) {
    const buyerKey = new Ed25519PrivateKey(buyerKeyHex);
    buyerAccount = Account.fromPrivateKey({ privateKey: buyerKey });
    console.log(`  Using provided buyer account: ${buyerAccount.accountAddress.toString()}`);
  } else {
    buyerAccount = Account.generate();
    console.log(`  Generated new buyer account: ${buyerAccount.accountAddress.toString()}`);
  }

  // Fund buyer: try faucet first, fall back to deployer APT transfer
  let funded = false;
  console.log("  → Funding buyer via faucet...");
  try {
    await aptos.fundAccount({
      accountAddress: buyerAccount.accountAddress,
      amount: 200_000_000, // 2 APT for gas
    });
    console.log("    ✓ Buyer funded with 2 APT via faucet");
    funded = true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`    ✗ Faucet unavailable: ${message}`);
  }

  if (!funded && deployerAccount) {
    console.log("  → Funding buyer via APT transfer from deployer...");
    const fundAmount = 20_000_000; // 0.2 APT — covers gas for mint, deposit, and order
    try {
      const fundTxn = await aptos.transferCoinTransaction({
        sender: deployerAccount.accountAddress,
        recipient: buyerAccount.accountAddress,
        amount: fundAmount,
      });
      const fundPending = await aptos.signAndSubmitTransaction({
        signer: deployerAccount,
        transaction: fundTxn,
      });
      await aptos.waitForTransaction({ transactionHash: fundPending.hash });
      console.log(`    ✓ Buyer funded with 0.2 APT from deployer: ${fundPending.hash.slice(0, 16)}...`);
      funded = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ Deployer APT transfer failed: ${message}`);
    }
  }

  if (!funded) {
    console.log("    Continuing anyway (account may already be funded)...");
  }
  await sleep(2000);

  // Mint USD1 for the buyer
  const usd1Contract = process.env.USD1_CONTRACT_ADDRESS ?? DEFAULT_USD1_CONTRACT;
  const mintBuffer = usd1Budget * 1.1; // 10% buffer
  const onChainAmount = Math.round(mintBuffer * 10 ** USD1_DECIMALS);
  console.log(`  → Minting ${mintBuffer.toFixed(8)} USD1 for buyer...`);

  const mintData: InputEntryFunctionData = {
    function: `${usd1Contract}::usd1::mint`,
    functionArguments: [buyerAccount.accountAddress.toString(), onChainAmount],
  };

  // Use explicit maxGasAmount to avoid INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE
  // when the buyer has limited APT (funded via deployer transfer, not faucet)
  const txnOptions = { maxGasAmount: 50000 };

  const mintTxn = await aptos.transaction.build.simple({
    sender: buyerAccount.accountAddress,
    data: mintData,
    options: txnOptions,
  });
  const mintPending = await aptos.signAndSubmitTransaction({ signer: buyerAccount, transaction: mintTxn });
  await aptos.waitForTransaction({ transactionHash: mintPending.hash });
  console.log(`    ✓ USD1 minted: ${mintPending.hash.slice(0, 16)}...`);
  await sleep(1000);

  // Query base asset address
  let baseAssetAddress = process.env.BASE_ASSET_ADDRESS ?? "";
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

  // Deposit USD1 into orderbook for the buyer
  console.log(`  → Depositing ${mintBuffer.toFixed(8)} USD1 into orderbook for buyer...`);
  const depositData: InputEntryFunctionData = {
    function: `${contractAddress}::accounts::deposit`,
    functionArguments: [quoteAssetAddress, Math.round(mintBuffer * 10 ** USD1_DECIMALS)],
  };
  const depositTxn = await aptos.transaction.build.simple({
    sender: buyerAccount.accountAddress,
    data: depositData,
    options: txnOptions,
  });
  const depositPending = await aptos.signAndSubmitTransaction({
    signer: buyerAccount,
    transaction: depositTxn,
  });
  await aptos.waitForTransaction({ transactionHash: depositPending.hash });
  console.log(`    ✓ USD1 deposited: ${depositPending.hash.slice(0, 16)}...`);
  await sleep(1000);

  // Create buyer SDK instance
  const buyerSdk = new CashOrderbook({
    network: "testnet",
    contractAddress,
    baseAsset: baseAssetAddress,
    quoteAsset: quoteAssetAddress,
  });

  return { buyerAccount, buyerSdk, baseAssetAddress };
}

// ============================================================
// Fill Verification
// ============================================================

/**
 * Verify that a fill actually occurred by checking trade events in the transaction
 * and comparing pre/post balances. Reports actual filled amount instead of just
 * inferring success from transaction status.
 */
async function verifyBuyFill(
  aptos: Aptos,
  contractAddress: string,
  txHash: string,
  preCashAvailable: number,
  preQuoteAvailable: number,
  postCashAvailable: number,
  postQuoteAvailable: number,
): Promise<FillVerification> {
  // Method 1: Check trade events in the transaction
  try {
    const txnDetails = (await aptos.getTransactionByHash({
      transactionHash: txHash,
    })) as UserTransactionResponse;

    if (txnDetails.events) {
      const tradeEventType = `${contractAddress}::settlement::TradeEvent`;
      const tradeEvents = txnDetails.events.filter(
        (e: { type: string }) => e.type === tradeEventType,
      );

      if (tradeEvents.length > 0) {
        let totalFilledQuantity = 0;
        let weightedPriceSum = 0;

        for (const event of tradeEvents) {
          const data = event.data as Record<string, string>;
          const quantity = Number(data.quantity) / 10 ** CASH_DECIMALS;
          const price = Number(data.price) / PRICE_SCALE;
          totalFilledQuantity += quantity;
          weightedPriceSum += price * quantity;
        }

        const avgFillPrice = totalFilledQuantity > 0
          ? weightedPriceSum / totalFilledQuantity
          : 0;

        return {
          verified: totalFilledQuantity > 0,
          filledQuantity: totalFilledQuantity,
          fillPrice: avgFillPrice,
          method: "trade_events",
        };
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`    (Could not check trade events: ${message})`);
  }

  // Method 2: Compare balances before and after
  const cashDelta = postCashAvailable - preCashAvailable;
  const quoteDelta = preQuoteAvailable - postQuoteAvailable;

  if (cashDelta > 0) {
    return {
      verified: true,
      filledQuantity: cashDelta,
      fillPrice: quoteDelta > 0 ? quoteDelta / cashDelta : 0,
      method: "balance_delta",
    };
  }

  return {
    verified: false,
    filledQuantity: 0,
    fillPrice: 0,
    method: "trade_events",
  };
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const privateKeyHex = getEnvOrExit("APTOS_PRIVATE_KEY");
  const contractAddress = getEnvOrExit("CONTRACT_ADDRESS");
  const networkStr = process.env.APTOS_NETWORK ?? "testnet";
  const buyAmountUsd1 = parseFloat(process.env.BUY_AMOUNT_USD1 ?? "1000");
  const pairId = parseInt(process.env.PAIR_ID ?? "0", 10);

  // Resolve asset addresses
  const quoteAssetAddress = process.env.QUOTE_ASSET_ADDRESS ?? USD1_TESTNET_TOKEN_ADDRESS;

  console.log("═══════════════════════════════════════════════════");
  console.log("  CASH Orderbook — $1000 USD1 Market Buy Simulation");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log(`  Network:          ${networkStr}`);
  console.log(`  Contract:         ${contractAddress}`);
  console.log(`  Buy amount:       ${buyAmountUsd1} USD1`);
  console.log(`  Pair ID:          ${pairId}`);

  // Initialize Aptos client
  const aptosConfig = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(aptosConfig);

  // The seed account (placed the asks) — used only for reading the orderbook
  const seedKey = new Ed25519PrivateKey(privateKeyHex);
  const seedAccount = Account.fromPrivateKey({ privateKey: seedKey });
  const seedAddress = seedAccount.accountAddress.toString();
  console.log(`  Seed account:     ${seedAddress}`);

  // ── Setup: Create separate buyer account ──
  // The matching engine has self-trade prevention, so the buyer must be
  // a different account than the one that placed the seed ask orders.
  console.log("");
  console.log("── Setup: Buyer Account ──");
  const { buyerAccount, buyerSdk: sdk, baseAssetAddress } = await setupBuyerAccount(
    aptos,
    contractAddress,
    quoteAssetAddress,
    buyAmountUsd1,
    seedAccount,
  );
  const traderAddress = buyerAccount.accountAddress.toString();

  console.log(`  Buyer address:    ${traderAddress} (separate from seed)`);
  console.log(`  Base asset:       ${baseAssetAddress}`);
  console.log(`  Quote asset:      ${quoteAssetAddress}`);
  console.log("");

  // ── Step 1: Query balances ──
  console.log("── Step 1: Query Balances ──");
  let preCashAvailable = 0;
  let preQuoteAvailable = 0;
  try {
    const balances = await sdk.getBalances(traderAddress);
    preCashAvailable = balances.cash.available;
    preQuoteAvailable = balances.usdc.available;
    console.log(`  CASH available: ${balances.cash.available}`);
    console.log(`  CASH locked:    ${balances.cash.locked}`);
    console.log(`  Quote available: ${balances.usdc.available}`);
    console.log(`  Quote locked:    ${balances.usdc.locked}`);
  } catch (err: unknown) {
    console.log(`  (Could not fetch balances: ${err instanceof Error ? err.message : String(err)})`);
  }
  console.log("");

  // ── Step 2: Query orderbook depth ──
  console.log("── Step 2: Query Orderbook Depth ──");
  const depth = await sdk.getOrderbook(pairId);

  console.log(`  Bids: ${depth.bids.length} levels`);
  for (const bid of depth.bids.slice(0, 5)) {
    console.log(`    ${bid.price.toFixed(8)} USD1  ×  ${bid.quantity.toFixed(4)} CASH  (cumul: ${bid.total.toFixed(4)})`);
  }
  if (depth.bids.length > 5) console.log(`    ... and ${depth.bids.length - 5} more levels`);

  console.log(`  Asks: ${depth.asks.length} levels`);
  for (const ask of depth.asks.slice(0, 5)) {
    console.log(`    ${ask.price.toFixed(8)} USD1  ×  ${ask.quantity.toFixed(4)} CASH  (cumul: ${ask.total.toFixed(4)})`);
  }
  if (depth.asks.length > 5) console.log(`    ... and ${depth.asks.length - 5} more levels`);
  console.log("");

  if (depth.asks.length === 0) {
    console.error("ERROR: No asks in the orderbook. Cannot simulate a buy.");
    console.log("Ensure the orderbook is seeded with ask orders.");
    process.exit(1);
  }

  // ── Step 3: Calculate expected fill ──
  console.log("── Step 3: Calculate Expected Fill ──");
  const estimate = estimateFill(depth.asks, depth.bids, buyAmountUsd1);

  console.log(`  Expected CASH received: ${estimate.cashAmount.toFixed(6)} CASH`);
  console.log(`  USD1 to spend:          ${estimate.usd1Spent.toFixed(8)} USD1`);
  console.log(`  Effective price:        ${estimate.effectivePrice.toFixed(8)} USD1/CASH`);
  console.log(`  Midpoint price:         ${estimate.midpointPrice.toFixed(8)} USD1/CASH`);
  console.log(`  Slippage vs midpoint:   ${estimate.slippagePercent.toFixed(4)}%`);
  console.log(`  Levels consumed:        ${estimate.levelsConsumed}`);
  console.log(`  Full fill:              ${estimate.fullFill ? "Yes" : "No — insufficient liquidity"}`);
  console.log("");

  // ── Step 4: Execute market buy ──
  console.log("── Step 4: Execute Market Buy Order ──");

  // For a market buy, we need to specify quantity in CASH terms.
  // Use the estimated fill amount (capped by available liquidity).
  const orderQuantity = Math.max(
    estimate.cashAmount,
    0.01, // Minimum viable quantity
  );

  console.log(`  Order quantity: ${orderQuantity.toFixed(6)} CASH (market buy)`);
  console.log(`  Submitting transaction...`);

  const startTime = performance.now();
  let report: ExecutionReport;

  try {
    // Build market order transaction manually with explicit maxGasAmount
    // to avoid INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE on low-balance accounts
    const onChainQuantity = Math.round(orderQuantity * 10 ** CASH_DECIMALS);
    const marketOrderData: InputEntryFunctionData = {
      function: `${contractAddress}::order_placement::place_market_order`,
      functionArguments: [pairId, onChainQuantity, true], // true = buy
    };
    const orderTxn = await aptos.transaction.build.simple({
      sender: buyerAccount.accountAddress,
      data: marketOrderData,
      options: { maxGasAmount: 50000 },
    });
    const orderPending = await aptos.signAndSubmitTransaction({
      signer: buyerAccount,
      transaction: orderTxn,
    });
    const committed = await aptos.waitForTransaction({ transactionHash: orderPending.hash });
    const result = { txHash: (committed as UserTransactionResponse).hash };

    const endTime = performance.now();
    const latencyMs = endTime - startTime;

    console.log(`  ✓ Transaction submitted: ${result.txHash}`);
    console.log(`  Latency (submit to confirm): ${latencyMs.toFixed(0)} ms`);

    // Fetch transaction details for gas info
    const txnDetails = (await aptos.getTransactionByHash({
      transactionHash: result.txHash,
    })) as UserTransactionResponse;

    const gasUsed = parseInt(String(txnDetails.gas_used), 10);
    const gasUnitPrice = parseInt(String(txnDetails.gas_unit_price), 10);
    const gasCostOctas = gasUsed * gasUnitPrice;
    const gasCostApt = gasCostOctas / 1e8; // 1 APT = 10^8 octas
    const txSuccess = txnDetails.success;

    report = {
      estimate,
      txHash: result.txHash,
      latencyMs,
      gasUsed,
      gasUnitPrice,
      gasCostApt,
      success: txSuccess,
      fillVerification: { verified: false, filledQuantity: 0, fillPrice: 0, method: "trade_events" },
    };

    console.log(`  Gas used:      ${gasUsed} units`);
    console.log(`  Gas unit price: ${gasUnitPrice} octas`);
    console.log(`  Gas cost:      ${gasCostApt.toFixed(8)} APT`);
    console.log(`  Success:       ${txSuccess}`);
  } catch (err: unknown) {
    const endTime = performance.now();
    const latencyMs = endTime - startTime;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Transaction failed: ${message}`);
    console.log(`  Latency (to failure): ${latencyMs.toFixed(0)} ms`);

    report = {
      estimate,
      txHash: "FAILED",
      latencyMs,
      gasUsed: 0,
      gasUnitPrice: 0,
      gasCostApt: 0,
      success: false,
      fillVerification: { verified: false, filledQuantity: 0, fillPrice: 0, method: "trade_events" },
    };
  }
  console.log("");

  // ── Step 5: Post-trade balances & fill verification ──
  console.log("── Step 5: Post-Trade Balances & Fill Verification ──");
  let postCashAvailable = preCashAvailable;
  let postQuoteAvailable = preQuoteAvailable;
  try {
    const postBalances = await sdk.getBalances(traderAddress);
    postCashAvailable = postBalances.cash.available;
    postQuoteAvailable = postBalances.usdc.available;
    console.log(`  CASH available: ${postBalances.cash.available}`);
    console.log(`  CASH locked:    ${postBalances.cash.locked}`);
    console.log(`  Quote available: ${postBalances.usdc.available}`);
    console.log(`  Quote locked:    ${postBalances.usdc.locked}`);
  } catch (err: unknown) {
    console.log(`  (Could not fetch post-trade balances: ${err instanceof Error ? err.message : String(err)})`);
  }
  console.log("");

  // Verify actual fill via trade events or balance delta
  if (report.txHash !== "FAILED" && report.success) {
    console.log("  → Verifying fill via trade events / balance delta...");
    const verification = await verifyBuyFill(
      aptos, contractAddress, report.txHash,
      preCashAvailable, preQuoteAvailable,
      postCashAvailable, postQuoteAvailable,
    );
    report.fillVerification = verification;

    if (verification.verified) {
      console.log(`    ✓ Fill VERIFIED (method: ${verification.method})`);
      console.log(`      Actual filled quantity: ${verification.filledQuantity.toFixed(6)} CASH`);
      console.log(`      Actual fill price:      ${verification.fillPrice.toFixed(8)} USD1/CASH`);
    } else {
      console.log("    ⚠ Fill NOT verified — no trade events found and no balance change detected");
    }
    console.log("");
  }

  // ── Step 6: Final Report ──
  console.log("═══════════════════════════════════════════════════");
  console.log("  Buy Simulation Report");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log(`  Buy amount:          ${buyAmountUsd1} USD1`);
  console.log(`  CASH received (est): ${report.estimate.cashAmount.toFixed(6)} CASH`);
  console.log(`  Effective price:     ${report.estimate.effectivePrice.toFixed(8)} USD1/CASH`);
  console.log(`  Midpoint price:      ${report.estimate.midpointPrice.toFixed(8)} USD1/CASH`);
  console.log(`  Slippage:            ${report.estimate.slippagePercent.toFixed(4)}%`);
  console.log(`  Levels consumed:     ${report.estimate.levelsConsumed}`);
  console.log(`  Full fill:           ${report.estimate.fullFill ? "Yes" : "No"}`);
  console.log("");
  console.log(`  Transaction:         ${report.txHash}`);
  console.log(`  Success:             ${report.success}`);
  console.log(`  Execution latency:   ${report.latencyMs.toFixed(0)} ms`);
  console.log(`  Gas cost:            ${report.gasCostApt.toFixed(8)} APT`);
  console.log(`  Gas used:            ${report.gasUsed} units @ ${report.gasUnitPrice} octas/unit`);
  console.log("");
  console.log("  Fill Verification:");
  console.log(`    Verified:          ${report.fillVerification.verified}`);
  console.log(`    Method:            ${report.fillVerification.method}`);
  console.log(`    Actual filled qty: ${report.fillVerification.filledQuantity.toFixed(6)} CASH`);
  console.log(`    Actual fill price: ${report.fillVerification.fillPrice.toFixed(8)} USD1/CASH`);
  console.log("");

  if (report.success) {
    const actualCash = report.fillVerification.verified
      ? report.fillVerification.filledQuantity.toFixed(6)
      : report.estimate.cashAmount.toFixed(6) + " (estimated)";
    console.log(`  Total cost: ${buyAmountUsd1} USD1 + ${report.gasCostApt.toFixed(8)} APT gas`);
    console.log(`  CASH received: ${actualCash}`);
  } else {
    console.log("  ⚠ Transaction failed — no on-chain cost (gas may still have been charged).");
  }
  console.log("");

  if (report.txHash !== "FAILED") {
    console.log(`  Explorer: https://explorer.aptoslabs.com/txn/${report.txHash}?network=testnet`);
  }
  console.log("");

  if (!report.success) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("Buy simulation failed:", err);
  process.exit(1);
});
