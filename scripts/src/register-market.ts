/**
 * register-market.ts — Register a CASH market on the orderbook.
 *
 * Calls the on-chain `market::register_market` entry function with:
 *   - base_asset: CASH (TestCASH) metadata address
 *   - quote_asset: configurable — USD1 (8 decimals) or USDC (6 decimals)
 *   - lot_size, tick_size, min_size scaled to the quote asset decimals
 *   - quote_decimals: decimal precision of the quote asset
 *
 * Environment variables:
 *   APTOS_PRIVATE_KEY  — Hex-encoded ed25519 private key of the admin/deployer
 *   CONTRACT_ADDRESS   — Address where cash_orderbook is deployed
 *   APTOS_NETWORK      — Network: mainnet | testnet | devnet | local (default: mainnet)
 *   QUOTE_ASSET        — Quote asset symbol: "USD1" | "USDC" (default: "USD1")
 *   BASE_ASSET_ADDRESS — Override base asset metadata address (for testnet TestCASH)
 *   QUOTE_ASSET_ADDRESS — Override quote asset metadata address (for testnet USD1)
 *
 * Usage:
 *   APTOS_PRIVATE_KEY=<key> CONTRACT_ADDRESS=<addr> APTOS_NETWORK=testnet QUOTE_ASSET=USD1 \
 *     npx tsx scripts/src/register-market.ts
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
  USDC_DECIMALS,
  STABLECOINS,
  quoteDecimalsFor,
} from "@cash/shared";

// ============================================================
// Configuration
// ============================================================

/**
 * Compute default lot/tick/min sizes based on quote asset decimals.
 * - lot_size: 0.001 base = 10^(base_decimals - 3) subunits
 * - tick_size: 0.001 quote = 10^(quote_decimals - 3) subunits
 * - min_size: 0.01 base = 10^(base_decimals - 2) subunits
 */
function defaultSizes(quoteDecimals: number): {
  lotSize: number;
  tickSize: number;
  minSize: number;
} {
  return {
    lotSize: 10 ** Math.max(0, CASH_DECIMALS - 3),    // 1000 for 6-dec CASH
    tickSize: 10 ** Math.max(0, quoteDecimals - 3),    // 100_000 for 8-dec, 1000 for 6-dec
    minSize: 10 ** Math.max(0, CASH_DECIMALS - 2),     // 10_000 for 6-dec CASH
  };
}

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

/**
 * Resolve the base asset metadata address. Supports override via env var.
 */
function resolveBaseAsset(): string {
  return process.env.BASE_ASSET_ADDRESS ?? CASH_TOKEN_ADDRESS;
}

async function main(): Promise<void> {
  // Read env vars
  const privateKeyHex = process.env.APTOS_PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const networkStr = process.env.APTOS_NETWORK ?? "mainnet";
  const quoteSymbol = process.env.QUOTE_ASSET ?? "USD1";

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

  // Resolve asset addresses and decimals
  const baseAssetAddress = resolveBaseAsset();
  const { address: quoteAssetAddress, decimals: quoteDecimals } = resolveQuoteAsset(quoteSymbol, networkStr);

  // Compute default sizes scaled to the quote decimals
  const defaults = defaultSizes(quoteDecimals);
  const lotSize = parseInt(process.env.LOT_SIZE ?? String(defaults.lotSize), 10);
  const tickSize = parseInt(process.env.TICK_SIZE ?? String(defaults.tickSize), 10);
  const minSize = parseInt(process.env.MIN_SIZE ?? String(defaults.minSize), 10);

  console.log("=============================================");
  console.log("  CASH Orderbook — Register Market");
  console.log("=============================================");
  console.log("");
  console.log(`Network:          ${networkStr}`);
  console.log(`Contract:         ${contractAddress}`);
  console.log(`Base asset:       CASH (${CASH_DECIMALS} decimals)`);
  console.log(`Quote asset:      ${quoteSymbol} (${quoteDecimals} decimals)`);
  console.log(`Base address:     ${baseAssetAddress}`);
  console.log(`Quote address:    ${quoteAssetAddress}`);
  console.log(`Lot size:         ${lotSize} (${lotSize / 10 ** CASH_DECIMALS} CASH)`);
  console.log(`Tick size:        ${tickSize} (${tickSize / 10 ** quoteDecimals} ${quoteSymbol})`);
  console.log(`Min size:         ${minSize} (${minSize / 10 ** CASH_DECIMALS} CASH)`);
  console.log(`Quote decimals:   ${quoteDecimals}`);
  console.log("");

  // Initialize Aptos client
  const config = new AptosConfig({ network: getNetworkEnum(networkStr) });
  const aptos = new Aptos(config);

  // Create account from private key
  const privateKey = new Ed25519PrivateKey(privateKeyHex);
  const account = Account.fromPrivateKey({ privateKey });

  console.log(`Admin address:    ${account.accountAddress.toString()}`);
  console.log("");

  // Build the register_market transaction (now includes quote_decimals)
  const data: InputEntryFunctionData = {
    function: `${contractAddress}::market::register_market`,
    functionArguments: [
      baseAssetAddress,     // base_asset: Object<Metadata>
      quoteAssetAddress,    // quote_asset: Object<Metadata>
      lotSize,              // lot_size: u64
      tickSize,             // tick_size: u64
      minSize,              // min_size: u64
      quoteDecimals,        // quote_decimals: u8
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
  console.log(`  Pair:     CASH/${quoteSymbol} (pair_id: 0)`);
  console.log(`  Lot size: ${lotSize / 10 ** CASH_DECIMALS} CASH`);
  console.log(`  Tick:     ${tickSize / 10 ** quoteDecimals} ${quoteSymbol}`);
  console.log(`  Min size: ${minSize / 10 ** CASH_DECIMALS} CASH`);
  console.log(`  Decimals: ${quoteDecimals}`);
  console.log("");
  console.log("  Next: Run seed-orderbook.ts to populate the book with orders");
  console.log("");
}

main().catch((err: unknown) => {
  console.error("Failed to register market:", err);
  process.exit(1);
});
