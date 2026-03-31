/**
 * register-market.ts — Register the CASH/USDC market on the orderbook.
 *
 * Calls the on-chain `market::register_market` entry function with:
 *   - base_asset: CASH metadata address
 *   - quote_asset: USDC metadata address
 *   - lot_size, tick_size, min_size for 6-decimal tokens
 *
 * Environment variables:
 *   APTOS_PRIVATE_KEY  — Hex-encoded ed25519 private key of the admin/deployer
 *   CONTRACT_ADDRESS   — Address where cash_orderbook is deployed
 *   APTOS_NETWORK      — Network: mainnet | testnet | devnet | local (default: mainnet)
 *
 * Usage:
 *   APTOS_PRIVATE_KEY=<key> CONTRACT_ADDRESS=<addr> npx tsx scripts/src/register-market.ts
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Ed25519PrivateKey,
  Account,
  type InputEntryFunctionData,
} from "@aptos-labs/ts-sdk";

import {
  CASH_TOKEN_ADDRESS,
  USDC_TOKEN_ADDRESS,
  CASH_DECIMALS,
} from "@cash/shared";

// ============================================================
// Configuration
// ============================================================

/** Lot size: minimum order quantity increment (0.001 CASH = 1000 units at 6 decimals) */
const DEFAULT_LOT_SIZE = 1_000;

/** Tick size: minimum price increment (0.001 USDC = 1000 units at 6 decimals) */
const DEFAULT_TICK_SIZE = 1_000;

/** Min size: minimum order size (0.01 CASH = 10_000 units at 6 decimals) */
const DEFAULT_MIN_SIZE = 10_000;

// ============================================================
// Main
// ============================================================

function getNetworkEnum(network: string): Network {
  switch (network) {
    case "mainnet":
      return Network.MAINNET;
    case "testnet":
      return Network.TESTNET;
    case "devnet":
      return Network.DEVNET;
    case "local":
      return Network.LOCAL;
    default:
      return Network.MAINNET;
  }
}

async function main(): Promise<void> {
  // Read env vars
  const privateKeyHex = process.env.APTOS_PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const networkStr = process.env.APTOS_NETWORK ?? "mainnet";

  if (!privateKeyHex) {
    console.error("ERROR: APTOS_PRIVATE_KEY environment variable is required.");
    console.error("  export APTOS_PRIVATE_KEY=<hex_ed25519_private_key>");
    process.exit(1);
  }

  if (!contractAddress) {
    console.error("ERROR: CONTRACT_ADDRESS environment variable is required.");
    console.error("  export CONTRACT_ADDRESS=<deployed_contract_address>");
    process.exit(1);
  }

  // Parse overrides from CLI args
  const lotSize = parseInt(process.env.LOT_SIZE ?? String(DEFAULT_LOT_SIZE), 10);
  const tickSize = parseInt(process.env.TICK_SIZE ?? String(DEFAULT_TICK_SIZE), 10);
  const minSize = parseInt(process.env.MIN_SIZE ?? String(DEFAULT_MIN_SIZE), 10);

  console.log("=============================================");
  console.log("  CASH Orderbook — Register Market");
  console.log("=============================================");
  console.log("");
  console.log(`Network:          ${networkStr}`);
  console.log(`Contract:         ${contractAddress}`);
  console.log(`Base asset:       CASH (${CASH_DECIMALS} decimals)`);
  console.log(`Quote asset:      USDC (${CASH_DECIMALS} decimals)`);
  console.log(`Lot size:         ${lotSize} (${lotSize / 10 ** CASH_DECIMALS} CASH)`);
  console.log(`Tick size:        ${tickSize} (${tickSize / 10 ** CASH_DECIMALS} USDC)`);
  console.log(`Min size:         ${minSize} (${minSize / 10 ** CASH_DECIMALS} CASH)`);
  console.log("");

  // Initialize Aptos client
  const config = new AptosConfig({ network: getNetworkEnum(networkStr) });
  const aptos = new Aptos(config);

  // Create account from private key
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  const account = Account.fromPrivateKey({ privateKey });

  console.log(`Admin address:    ${account.accountAddress.toString()}`);
  console.log("");

  // Build the register_market transaction
  const data: InputEntryFunctionData = {
    function: `${contractAddress}::market::register_market`,
    functionArguments: [
      CASH_TOKEN_ADDRESS,   // base_asset: Object<Metadata>
      USDC_TOKEN_ADDRESS,   // quote_asset: Object<Metadata>
      lotSize,              // lot_size: u64
      tickSize,             // tick_size: u64
      minSize,              // min_size: u64
    ],
  };

  console.log("→ Building register_market transaction...");

  const txn = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data,
  });

  console.log("→ Signing and submitting...");

  const pendingTxn = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction: txn,
  });

  console.log(`→ Transaction submitted: ${pendingTxn.hash}`);
  console.log("→ Waiting for confirmation...");

  const committed = await aptos.waitForTransaction({
    transactionHash: pendingTxn.hash,
  });

  console.log("");
  console.log("=============================================");
  console.log("  ✓ Market Registered Successfully!");
  console.log("=============================================");
  console.log("");
  console.log(`  Tx hash:  ${committed.hash}`);
  console.log(`  Pair:     CASH/USDC (pair_id: 0)`);
  console.log(`  Lot size: ${lotSize / 10 ** CASH_DECIMALS} CASH`);
  console.log(`  Tick:     ${tickSize / 10 ** CASH_DECIMALS} USDC`);
  console.log(`  Min size: ${minSize / 10 ** CASH_DECIMALS} CASH`);
  console.log("");
  console.log("  Next: Run seed-orderbook.ts to populate the book with orders");
  console.log("");
}

main().catch((err: unknown) => {
  console.error("Failed to register market:", err);
  process.exit(1);
});
