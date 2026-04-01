/**
 * deploy-testnet-full.ts — Full testnet deployment: register market, mint tokens,
 * deposit into orderbook, and seed with bid/ask levels.
 *
 * This script performs all steps needed to set up a working CASH/USD1 orderbook on testnet:
 *   1. Register CASH/USD1 market with 8-decimal quote
 *   2. Mint TestCASH to the deployer account
 *   3. Mint USD1 to the deployer account (via external USD1 contract)
 *   4. Deposit both TestCASH and USD1 into the orderbook
 *   5. Seed the orderbook with 10 bid + 10 ask levels
 *
 * Environment variables:
 *   APTOS_PRIVATE_KEY       — Hex-encoded ed25519 private key of the admin/deployer
 *   CONTRACT_ADDRESS         — Address where cash_orderbook is deployed
 *   USD1_CONTRACT_ADDRESS    — Address where USD1 module is deployed (default: testnet USD1)
 *   BASE_ASSET_ADDRESS       — TestCASH metadata address (queried from contract if not set)
 *   QUOTE_ASSET_ADDRESS      — USD1 metadata address (queried from contract if not set)
 *   REFERENCE_PRICE          — Mid price in USD1 (default: 0.0001)
 *   SPREAD_BPS               — Half-spread in basis points (default: 50)
 *   DEPTH_PER_LEVEL          — CASH quantity per price level (default: 100)
 *   NUM_LEVELS               — Number of levels per side (default: 10)
 *
 * Usage:
 *   APTOS_PRIVATE_KEY=<key> CONTRACT_ADDRESS=<addr> npx tsx scripts/src/deploy-testnet-full.ts
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

// ============================================================
// Configuration
// ============================================================

/** Default USD1 contract address on testnet */
const DEFAULT_USD1_CONTRACT = "0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea";

interface DeployConfig {
  referencePrice: number;
  spreadBps: number;
  depthPerLevel: number;
  numLevels: number;
  /** Amount of TestCASH to mint (human-readable) */
  cashMintAmount: number;
  /** Amount of USD1 to mint (human-readable) */
  usd1MintAmount: number;
}

function loadConfig(): DeployConfig {
  return {
    referencePrice: parseFloat(process.env.REFERENCE_PRICE ?? "0.0001"),
    spreadBps: parseInt(process.env.SPREAD_BPS ?? "50", 10),
    depthPerLevel: parseFloat(process.env.DEPTH_PER_LEVEL ?? "100"),
    numLevels: parseInt(process.env.NUM_LEVELS ?? "10", 10),
    cashMintAmount: parseFloat(process.env.CASH_MINT_AMOUNT ?? "100000"),
    usd1MintAmount: parseFloat(process.env.USD1_MINT_AMOUNT ?? "10000"),
  };
}

/** All recorded transaction hashes */
const txHashes: Record<string, string> = {};

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
// Steps
// ============================================================

async function registerMarket(
  aptos: Aptos,
  account: Account,
  contractAddress: string,
  baseAssetAddress: string,
  quoteAssetAddress: string,
): Promise<void> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 1: Register CASH/USD1 Market");
  console.log("═══════════════════════════════════════════\n");

  // Lot size: 0.001 CASH = 1000 subunits at 6 decimals
  const lotSize = 1_000;
  // Tick size: 0.00001 USD1 = 1000 subunits at 8 decimals
  const tickSize = 1_000;
  // Min size: 0.01 CASH = 10_000 subunits at 6 decimals
  const minSize = 10_000;
  const quoteDecimals = USD1_DECIMALS; // 8

  console.log(`  Base asset:     ${baseAssetAddress}`);
  console.log(`  Quote asset:    ${quoteAssetAddress}`);
  console.log(`  Lot size:       ${lotSize} (${lotSize / 10 ** CASH_DECIMALS} CASH)`);
  console.log(`  Tick size:      ${tickSize} (${tickSize / 10 ** quoteDecimals} USD1)`);
  console.log(`  Min size:       ${minSize} (${minSize / 10 ** CASH_DECIMALS} CASH)`);
  console.log(`  Quote decimals: ${quoteDecimals}`);

  const data: InputEntryFunctionData = {
    function: `${contractAddress}::market::register_market`,
    functionArguments: [
      baseAssetAddress,
      quoteAssetAddress,
      lotSize,
      tickSize,
      minSize,
      quoteDecimals,
    ],
  };

  const txn = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data,
  });

  const pendingTxn = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: txn,
  });

  const committed = await aptos.waitForTransaction({
    transactionHash: pendingTxn.hash,
  });

  txHashes["register_market"] = committed.hash;
  console.log(`  ✓ Market registered: ${committed.hash}`);
}

async function mintTestCash(
  aptos: Aptos,
  account: Account,
  contractAddress: string,
  amount: number,
): Promise<void> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 2: Mint TestCASH");
  console.log("═══════════════════════════════════════════\n");

  const onChainAmount = toOnChainAmount(amount, CASH_DECIMALS);
  const recipientAddress = account.accountAddress.toString();

  console.log(`  Recipient:  ${recipientAddress}`);
  console.log(`  Amount:     ${amount} CASH (${onChainAmount} subunits)`);

  const data: InputEntryFunctionData = {
    function: `${contractAddress}::test_cash::mint_test_cash`,
    functionArguments: [recipientAddress, onChainAmount],
  };

  const txn = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data,
  });

  const pendingTxn = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: txn,
  });

  const committed = await aptos.waitForTransaction({
    transactionHash: pendingTxn.hash,
  });

  txHashes["mint_test_cash"] = committed.hash;
  console.log(`  ✓ TestCASH minted: ${committed.hash}`);
}

async function mintUsd1(
  aptos: Aptos,
  account: Account,
  usd1Contract: string,
  amount: number,
): Promise<void> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 3: Mint USD1");
  console.log("═══════════════════════════════════════════\n");

  const onChainAmount = toOnChainAmount(amount, USD1_DECIMALS);

  console.log(`  USD1 contract: ${usd1Contract}`);
  console.log(`  Amount:        ${amount} USD1 (${onChainAmount} subunits)`);

  // Use mint_to_self (convenience function from the USD1 module)
  const data: InputEntryFunctionData = {
    function: `${usd1Contract}::usd1::mint_to_self`,
    functionArguments: [onChainAmount],
  };

  const txn = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data,
  });

  const pendingTxn = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: txn,
  });

  const committed = await aptos.waitForTransaction({
    transactionHash: pendingTxn.hash,
  });

  txHashes["mint_usd1"] = committed.hash;
  console.log(`  ✓ USD1 minted: ${committed.hash}`);
}

async function depositTokens(
  sdk: CashOrderbook,
  account: Account,
  baseAssetAddress: string,
  quoteAssetAddress: string,
  cashAmount: number,
  usd1Amount: number,
): Promise<void> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 4: Deposit Tokens into Orderbook");
  console.log("═══════════════════════════════════════════\n");

  // Deposit TestCASH
  console.log(`  Depositing ${cashAmount} CASH...`);
  const cashResult = await sdk.deposit(account, baseAssetAddress, cashAmount, CASH_DECIMALS);
  txHashes["deposit_cash"] = cashResult.txHash;
  console.log(`  ✓ CASH deposited: ${cashResult.txHash}`);

  await sleep(1000); // Small delay between transactions

  // Deposit USD1
  console.log(`  Depositing ${usd1Amount} USD1...`);
  const usd1Result = await sdk.deposit(account, quoteAssetAddress, usd1Amount, USD1_DECIMALS);
  txHashes["deposit_usd1"] = usd1Result.txHash;
  console.log(`  ✓ USD1 deposited: ${usd1Result.txHash}`);
}

async function seedOrderbook(
  sdk: CashOrderbook,
  account: Account,
  config: DeployConfig,
): Promise<void> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 5: Seed Orderbook");
  console.log("═══════════════════════════════════════════\n");

  const { referencePrice, spreadBps, depthPerLevel, numLevels } = config;

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

  console.log(`  Reference price: ${referencePrice} USD1/CASH`);
  console.log(`  Spread:          ${spreadBps} bps`);
  console.log(`  Levels per side: ${numLevels}`);
  console.log(`  Depth per level: ${depthPerLevel} CASH`);
  console.log("");

  // Print ladder
  console.log("  Price Ladder:");
  console.log("    Asks:");
  for (let i = askPrices.length - 1; i >= 0; i--) {
    console.log(`      ${askPrices[i].toFixed(6)} USD1  ×  ${depthPerLevel} CASH`);
  }
  console.log("    ── spread ──");
  console.log("    Bids:");
  for (const price of bidPrices) {
    console.log(`      ${price.toFixed(6)} USD1  ×  ${depthPerLevel} CASH`);
  }
  console.log("");

  // Place bid orders
  console.log("  → Placing bid orders...");
  let bidCount = 0;
  for (const price of bidPrices) {
    try {
      const result = await sdk.placeOrder(account, {
        pairId: 0,
        price,
        quantity: depthPerLevel,
        side: "buy",
        orderType: "GTC",
      });
      bidCount++;
      txHashes[`bid_${bidCount}`] = result.txHash;
      console.log(`    ✓ Bid ${bidCount}/${numLevels}: ${price.toFixed(6)} × ${depthPerLevel} CASH → ${result.txHash.slice(0, 16)}...`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ Bid at ${price.toFixed(6)}: ${message}`);
    }
    await sleep(500); // Avoid sequence number issues
  }

  console.log("");

  // Place ask orders
  console.log("  → Placing ask orders...");
  let askCount = 0;
  for (const price of askPrices) {
    try {
      const result = await sdk.placeOrder(account, {
        pairId: 0,
        price,
        quantity: depthPerLevel,
        side: "sell",
        orderType: "GTC",
      });
      askCount++;
      txHashes[`ask_${askCount}`] = result.txHash;
      console.log(`    ✓ Ask ${askCount}/${numLevels}: ${price.toFixed(6)} × ${depthPerLevel} CASH → ${result.txHash.slice(0, 16)}...`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`    ✗ Ask at ${price.toFixed(6)}: ${message}`);
    }
    await sleep(500);
  }

  console.log("");
  console.log(`  Bids placed: ${bidCount}/${numLevels}`);
  console.log(`  Asks placed: ${askCount}/${numLevels}`);
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const privateKeyHex = process.env.APTOS_PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const usd1Contract = process.env.USD1_CONTRACT_ADDRESS ?? DEFAULT_USD1_CONTRACT;

  if (!privateKeyHex) {
    console.error("ERROR: APTOS_PRIVATE_KEY environment variable is required.");
    process.exit(1);
  }
  if (!contractAddress) {
    console.error("ERROR: CONTRACT_ADDRESS environment variable is required.");
    process.exit(1);
  }

  const config = loadConfig();

  console.log("═══════════════════════════════════════════════");
  console.log("  CASH Orderbook — Full Testnet Deployment");
  console.log("═══════════════════════════════════════════════");
  console.log("");
  console.log(`  Contract:     ${contractAddress}`);
  console.log(`  USD1 contract: ${usd1Contract}`);
  console.log(`  Network:      testnet`);

  // Initialize Aptos client
  const aptosConfig = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(aptosConfig);

  // Create account from private key
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  const account = Account.fromPrivateKey({ privateKey });
  const deployerAddress = account.accountAddress.toString();

  console.log(`  Deployer:     ${deployerAddress}`);

  // Query TestCASH metadata address from the contract
  let baseAssetAddress = process.env.BASE_ASSET_ADDRESS;
  if (!baseAssetAddress) {
    console.log("\n  → Querying TestCASH metadata address...");
    const viewPayload: InputViewFunctionData = {
      function: `${contractAddress}::test_cash::get_metadata_address`,
      functionArguments: [],
    };
    const result = await aptos.view({ payload: viewPayload });
    baseAssetAddress = result[0] as string;
    console.log(`    TestCASH metadata: ${baseAssetAddress}`);
  }

  // USD1 metadata address
  const quoteAssetAddress = process.env.QUOTE_ASSET_ADDRESS ?? USD1_TESTNET_TOKEN_ADDRESS;
  console.log(`    USD1 metadata:     ${quoteAssetAddress}`);

  // Step 1: Register market
  await registerMarket(aptos, account, contractAddress, baseAssetAddress, quoteAssetAddress);
  await sleep(2000);

  // Step 2: Mint TestCASH
  await mintTestCash(aptos, account, contractAddress, config.cashMintAmount);
  await sleep(2000);

  // Step 3: Mint USD1
  await mintUsd1(aptos, account, usd1Contract, config.usd1MintAmount);
  await sleep(2000);

  // Step 4: Deposit tokens
  const sdk = new CashOrderbook({
    network: "testnet",
    contractAddress,
    baseAsset: baseAssetAddress,
    quoteAsset: quoteAssetAddress,
  });

  await depositTokens(sdk, account, baseAssetAddress, quoteAssetAddress, config.cashMintAmount, config.usd1MintAmount);
  await sleep(2000);

  // Step 5: Seed orderbook
  await seedOrderbook(sdk, account, config);

  // Final summary
  console.log("\n═══════════════════════════════════════════════");
  console.log("  ✓ Full Testnet Deployment Complete!");
  console.log("═══════════════════════════════════════════════\n");

  console.log("  Transaction Hashes:");
  for (const [label, hash] of Object.entries(txHashes)) {
    console.log(`    ${label}: ${hash}`);
  }

  console.log("");
  console.log("  Explorer links:");
  for (const [label, hash] of Object.entries(txHashes)) {
    if (["register_market", "mint_test_cash", "mint_usd1", "deposit_cash", "deposit_usd1"].includes(label)) {
      console.log(`    ${label}: https://explorer.aptoslabs.com/txn/${hash}?network=testnet`);
    }
  }

  // Query final orderbook state
  console.log("\n  → Querying final orderbook state...");
  try {
    const depth = await sdk.getOrderbook(0);
    console.log(`    Bids: ${depth.bids.length} levels`);
    if (depth.bids.length > 0) {
      console.log(`      Best bid: ${depth.bids[0].price.toFixed(6)} × ${depth.bids[0].quantity.toFixed(2)} CASH`);
    }
    console.log(`    Asks: ${depth.asks.length} levels`);
    if (depth.asks.length > 0) {
      console.log(`      Best ask: ${depth.asks[0].price.toFixed(6)} × ${depth.asks[0].quantity.toFixed(2)} CASH`);
    }
  } catch (err: unknown) {
    console.log(`    (Could not query orderbook: ${err instanceof Error ? err.message : String(err)})`);
  }

  console.log("");
}

main().catch((err: unknown) => {
  console.error("\nDeployment failed:", err);
  console.error("\nTransaction hashes recorded so far:");
  for (const [label, hash] of Object.entries(txHashes)) {
    console.error(`  ${label}: ${hash}`);
  }
  process.exit(1);
});
