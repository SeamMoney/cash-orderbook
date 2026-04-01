/**
 * setup-demo-wallet.ts — Prepare a wallet for importing into Petra for the live demo.
 *
 * Steps:
 *   1. Generate a new Ed25519 keypair (or reuse DEMO_PRIVATE_KEY env var)
 *   2. Fund the account with testnet APT via faucet (at least 1 APT)
 *   3. Mint 2,000 USD1 to the account via prediction_market::usd1::mint_to_self
 *   4. Mint TestCASH to the account via deployer (test_cash::mint_test_cash is admin-only)
 *   5. Deposit 1,500 USD1 into the orderbook for the demo wallet
 *   6. Print wallet details, balances, and Petra import instructions
 *
 * Environment variables:
 *   DEMO_PRIVATE_KEY      — (Optional) Hex-encoded ed25519 private key to reuse an existing wallet
 *   APTOS_PRIVATE_KEY     — Hex-encoded ed25519 deployer private key (for TestCASH minting)
 *                            Falls back to reading from .aptos/config.yaml cash-testnet profile
 *   CONTRACT_ADDRESS      — (Optional) Contract address override
 *   USD1_MINT_AMOUNT      — (Optional) USD1 amount to mint (default: 2000)
 *   CASH_MINT_AMOUNT      — (Optional) TestCASH amount to mint (default: 5000)
 *   USD1_DEPOSIT_AMOUNT   — (Optional) USD1 amount to deposit into orderbook (default: 1500)
 *
 * Usage:
 *   pnpm --filter @cash/scripts setup-demo-wallet
 */

import {
  Aptos,
  AptosConfig,
  Network,
  Ed25519PrivateKey,
  Account,
  Ed25519Account,
  type InputEntryFunctionData,
  type InputViewFunctionData,
} from "@aptos-labs/ts-sdk";

import { CashOrderbook } from "@cash/orderbook-sdk";
import {
  USD1_TESTNET_TOKEN_ADDRESS,
  USD1_DECIMALS,
  CASH_DECIMALS,
} from "@cash/shared";

import { readFileSync } from "fs";
import { resolve } from "path";

// ============================================================
// Constants
// ============================================================

/** Testnet contract address */
const DEFAULT_CONTRACT_ADDRESS =
  "0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1";

/** USD1 contract on testnet */
const USD1_CONTRACT =
  "0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea";

/** Default deployer private key from .aptos/config.yaml cash-testnet profile */
const DEFAULT_DEPLOYER_KEY =
  "0x39acaec09e85fdc2200e1312136dc08f4d131ffbe939c1bb23c74dce7d458b0b";

// ============================================================
// Helpers
// ============================================================

function toOnChainAmount(amount: number, decimals: number): number {
  return Math.round(amount * 10 ** decimals);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read the deployer private key from APTOS_PRIVATE_KEY env var,
 * or fall back to .aptos/config.yaml cash-testnet profile.
 */
function loadDeployerKey(): string {
  const envKey = process.env.APTOS_PRIVATE_KEY;
  if (envKey) return envKey;

  // Try reading from .aptos/config.yaml using simple regex
  // (avoids requiring a yaml parser dependency)
  try {
    const configPath = resolve(process.cwd(), ".aptos", "config.yaml");
    const raw = readFileSync(configPath, "utf8");
    // Find the cash-testnet profile section and extract its private_key
    const profileMatch = raw.match(/cash-testnet:[\s\S]*?private_key:\s*"?([^\s"]+)"?/);
    if (profileMatch?.[1]) {
      return profileMatch[1];
    }
  } catch {
    // Ignore — will use default
  }

  return DEFAULT_DEPLOYER_KEY;
}

/**
 * Get the APT balance for an address in human-readable APT.
 */
async function getAptBalance(aptos: Aptos, address: string): Promise<number> {
  try {
    const resources = await aptos.getAccountResource({
      accountAddress: address,
      resourceType: "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
    });
    return Number((resources as { coin: { value: string } }).coin.value) / 1e8;
  } catch {
    return 0;
  }
}

/**
 * Get the USD1 wallet balance for an address (not in the orderbook).
 */
async function getUsd1WalletBalance(aptos: Aptos, address: string): Promise<number> {
  try {
    const balance = await aptos.getAccountCoinAmount({
      accountAddress: address,
      coinType: undefined,
      faMetadataAddress: USD1_TESTNET_TOKEN_ADDRESS,
    });
    return balance / 10 ** USD1_DECIMALS;
  } catch {
    return 0;
  }
}

/**
 * Get the TestCASH wallet balance for an address.
 */
async function getCashWalletBalance(
  aptos: Aptos,
  address: string,
  cashMetadataAddress: string,
): Promise<number> {
  try {
    const balance = await aptos.getAccountCoinAmount({
      accountAddress: address,
      coinType: undefined,
      faMetadataAddress: cashMetadataAddress,
    });
    return balance / 10 ** CASH_DECIMALS;
  } catch {
    return 0;
  }
}

// ============================================================
// Steps
// ============================================================

async function fundWithApt(aptos: Aptos, account: Account): Promise<void> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 1: Fund Demo Wallet with APT");
  console.log("═══════════════════════════════════════════\n");

  const address = account.accountAddress.toString();
  const currentBalance = await getAptBalance(aptos, address);
  console.log(`  Current APT balance: ${currentBalance.toFixed(4)} APT`);

  if (currentBalance >= 1.0) {
    console.log("  ✓ Already has sufficient APT (1+), skipping faucet.");
    return;
  }

  console.log("  → Requesting APT from faucet...");
  try {
    await aptos.fundAccount({
      accountAddress: account.accountAddress,
      amount: 200_000_000, // 2 APT
    });
    console.log("  ✓ Funded with 2 APT from faucet");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠ Faucet request failed: ${message}`);
    console.log("  Retrying with 1 APT...");
    try {
      await aptos.fundAccount({
        accountAddress: account.accountAddress,
        amount: 100_000_000, // 1 APT
      });
      console.log("  ✓ Funded with 1 APT from faucet (retry)");
    } catch (err2: unknown) {
      const message2 = err2 instanceof Error ? err2.message : String(err2);
      console.error(`  ✗ Faucet retry also failed: ${message2}`);
      console.log("  Continuing with existing balance...");
    }
  }

  await sleep(2000);

  const updatedBalance = await getAptBalance(aptos, address);
  console.log(`  Updated APT balance: ${updatedBalance.toFixed(4)} APT`);

  if (updatedBalance < 1.0) {
    console.warn("  ⚠ APT balance is below 1 APT — some transactions may fail");
  }
}

async function mintUsd1(aptos: Aptos, account: Account, amount: number): Promise<string> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 2: Mint USD1 to Demo Wallet");
  console.log("═══════════════════════════════════════════\n");

  const onChainAmount = toOnChainAmount(amount, USD1_DECIMALS);
  console.log(`  Minting ${amount.toLocaleString()} USD1 (${onChainAmount} subunits)...`);

  const data: InputEntryFunctionData = {
    function: `${USD1_CONTRACT}::usd1::mint_to_self`,
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

  console.log(`  ✓ USD1 minted: ${committed.hash}`);
  return committed.hash;
}

async function mintTestCash(
  aptos: Aptos,
  deployerAccount: Account,
  recipientAddress: string,
  contractAddress: string,
  amount: number,
): Promise<string> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 3: Mint TestCASH to Demo Wallet");
  console.log("═══════════════════════════════════════════\n");

  const onChainAmount = toOnChainAmount(amount, CASH_DECIMALS);
  console.log(`  Deployer: ${deployerAccount.accountAddress.toString()}`);
  console.log(`  Recipient: ${recipientAddress}`);
  console.log(`  Amount: ${amount.toLocaleString()} CASH (${onChainAmount} subunits)`);

  const data: InputEntryFunctionData = {
    function: `${contractAddress}::test_cash::mint_test_cash`,
    functionArguments: [recipientAddress, onChainAmount],
  };

  const txn = await aptos.transaction.build.simple({
    sender: deployerAccount.accountAddress,
    data,
  });

  const pendingTxn = await aptos.signAndSubmitTransaction({
    signer: deployerAccount,
    transaction: txn,
  });

  const committed = await aptos.waitForTransaction({
    transactionHash: pendingTxn.hash,
  });

  console.log(`  ✓ TestCASH minted: ${committed.hash}`);
  return committed.hash;
}

async function depositUsd1(
  sdk: CashOrderbook,
  account: Account,
  amount: number,
): Promise<string> {
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 4: Deposit USD1 into Orderbook");
  console.log("═══════════════════════════════════════════\n");

  console.log(`  Depositing ${amount.toLocaleString()} USD1 into orderbook...`);

  const result = await sdk.deposit(
    account,
    USD1_TESTNET_TOKEN_ADDRESS,
    amount,
    USD1_DECIMALS,
  );

  console.log(`  ✓ USD1 deposited: ${result.txHash}`);
  return result.txHash;
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const contractAddress = process.env.CONTRACT_ADDRESS ?? DEFAULT_CONTRACT_ADDRESS;
  const usd1MintAmount = parseFloat(process.env.USD1_MINT_AMOUNT ?? "2000");
  const cashMintAmount = parseFloat(process.env.CASH_MINT_AMOUNT ?? "5000");
  const usd1DepositAmount = parseFloat(process.env.USD1_DEPOSIT_AMOUNT ?? "1500");

  console.log("═══════════════════════════════════════════════════════");
  console.log("  CASH Orderbook — Demo Wallet Setup");
  console.log("═══════════════════════════════════════════════════════");
  console.log("");
  console.log(`  Contract:        ${contractAddress}`);
  console.log(`  Network:         testnet`);
  console.log(`  USD1 to mint:    ${usd1MintAmount.toLocaleString()}`);
  console.log(`  CASH to mint:    ${cashMintAmount.toLocaleString()}`);
  console.log(`  USD1 to deposit: ${usd1DepositAmount.toLocaleString()}`);

  // Initialize Aptos client
  const aptosConfig = new AptosConfig({ network: Network.TESTNET });
  const aptos = new Aptos(aptosConfig);

  // ── Create or load demo wallet ──
  let demoPrivateKeyHex: string;
  let demoAccount: Account;
  let isNewWallet: boolean;

  if (process.env.DEMO_PRIVATE_KEY) {
    console.log("\n  → Loading existing demo wallet from DEMO_PRIVATE_KEY...");
    demoPrivateKeyHex = process.env.DEMO_PRIVATE_KEY;
    const demoKey = new Ed25519PrivateKey(demoPrivateKeyHex);
    demoAccount = Account.fromPrivateKey({ privateKey: demoKey });
    isNewWallet = false;
  } else {
    console.log("\n  → Generating new demo wallet...");
    // Generate a fresh Ed25519 account for the demo user
    const freshAccount = Ed25519Account.generate();
    demoAccount = freshAccount;
    demoPrivateKeyHex = `0x${Buffer.from(freshAccount.privateKey.toUint8Array()).toString("hex")}`;
    isNewWallet = true;
  }

  const demoAddress = demoAccount.accountAddress.toString();

  console.log(`  Demo address: ${demoAddress}`);
  console.log(`  New wallet:   ${isNewWallet ? "Yes" : "No (reusing existing)"}`);

  // ── Load deployer account (for TestCASH minting) ──
  const deployerKeyHex = loadDeployerKey();
  const deployerKey = new Ed25519PrivateKey(deployerKeyHex);
  const deployerAccount = Account.fromPrivateKey({ privateKey: deployerKey });
  const deployerAddress = deployerAccount.accountAddress.toString();
  console.log(`  Deployer:     ${deployerAddress}`);

  // ── Query TestCASH metadata address ──
  console.log("\n  → Querying TestCASH metadata address...");
  const viewPayload: InputViewFunctionData = {
    function: `${contractAddress}::test_cash::get_metadata_address`,
    functionArguments: [],
  };
  const viewResult = await aptos.view({ payload: viewPayload });
  const cashMetadataAddress = viewResult[0] as string;
  console.log(`    TestCASH metadata: ${cashMetadataAddress}`);

  // ── Initialize SDK ──
  const sdk = new CashOrderbook({
    network: "testnet",
    contractAddress,
    baseAsset: cashMetadataAddress,
    quoteAsset: USD1_TESTNET_TOKEN_ADDRESS,
  });

  // ── Transaction hashes ──
  const txHashes: Record<string, string> = {};

  // Step 1: Fund with APT
  await fundWithApt(aptos, demoAccount);
  await sleep(1000);

  // Step 2: Mint USD1 to demo wallet (anyone can call mint_to_self)
  const usd1TxHash = await mintUsd1(aptos, demoAccount, usd1MintAmount);
  txHashes["mint_usd1"] = usd1TxHash;
  await sleep(1000);

  // Step 3: Mint TestCASH to demo wallet (requires deployer)
  const cashTxHash = await mintTestCash(
    aptos,
    deployerAccount,
    demoAddress,
    contractAddress,
    cashMintAmount,
  );
  txHashes["mint_test_cash"] = cashTxHash;
  await sleep(1000);

  // Step 4: Deposit USD1 into orderbook
  const depositTxHash = await depositUsd1(sdk, demoAccount, usd1DepositAmount);
  txHashes["deposit_usd1"] = depositTxHash;
  await sleep(1000);

  // ── Query final balances ──
  console.log("\n═══════════════════════════════════════════");
  console.log("  Step 5: Query Final Balances");
  console.log("═══════════════════════════════════════════\n");

  const aptBalance = await getAptBalance(aptos, demoAddress);
  const usd1WalletBalance = await getUsd1WalletBalance(aptos, demoAddress);
  const cashWalletBalance = await getCashWalletBalance(aptos, demoAddress, cashMetadataAddress);

  let usd1OrderbookBalance = 0;
  let cashOrderbookBalance = 0;
  try {
    const balances = await sdk.getBalances(demoAddress);
    usd1OrderbookBalance = balances.usdc.available;
    cashOrderbookBalance = balances.cash.available;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  (Could not query orderbook balances: ${message})`);
  }

  console.log(`  APT balance:            ${aptBalance.toFixed(4)} APT`);
  console.log(`  USD1 (wallet):          ${usd1WalletBalance.toFixed(2)} USD1`);
  console.log(`  USD1 (orderbook):       ${usd1OrderbookBalance.toFixed(2)} USD1`);
  console.log(`  USD1 (total):           ${(usd1WalletBalance + usd1OrderbookBalance).toFixed(2)} USD1`);
  console.log(`  TestCASH (wallet):      ${cashWalletBalance.toFixed(2)} CASH`);
  console.log(`  TestCASH (orderbook):   ${cashOrderbookBalance.toFixed(2)} CASH`);
  console.log(`  TestCASH (total):       ${(cashWalletBalance + cashOrderbookBalance).toFixed(2)} CASH`);

  // ── Final output ──
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✓ Demo Wallet Ready!");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("  ┌─────────────────────────────────────────────────┐");
  console.log(`  │  Address:     ${demoAddress}`);
  console.log(`  │  Private Key: ${demoPrivateKeyHex}`);
  console.log("  └─────────────────────────────────────────────────┘\n");

  console.log("  Balances:");
  console.log(`    APT:      ${aptBalance.toFixed(4)} APT`);
  console.log(`    USD1:     ${usd1WalletBalance.toFixed(2)} (wallet) + ${usd1OrderbookBalance.toFixed(2)} (orderbook) = ${(usd1WalletBalance + usd1OrderbookBalance).toFixed(2)} USD1`);
  console.log(`    TestCASH: ${cashWalletBalance.toFixed(2)} (wallet) + ${cashOrderbookBalance.toFixed(2)} (orderbook) = ${(cashWalletBalance + cashOrderbookBalance).toFixed(2)} CASH`);
  console.log("");

  console.log("  Transaction Hashes:");
  for (const [label, hash] of Object.entries(txHashes)) {
    console.log(`    ${label}: ${hash}`);
  }
  console.log("");

  console.log("  Explorer Links:");
  for (const [label, hash] of Object.entries(txHashes)) {
    console.log(`    ${label}: https://explorer.aptoslabs.com/txn/${hash}?network=testnet`);
  }
  console.log("");

  console.log("  ╔═══════════════════════════════════════════════════╗");
  console.log("  ║                   INSTRUCTIONS                    ║");
  console.log("  ╠═══════════════════════════════════════════════════╣");
  console.log("  ║                                                   ║");
  console.log("  ║  1. Open Petra Wallet browser extension           ║");
  console.log("  ║  2. Click 'Import Private Key'                    ║");
  console.log("  ║  3. Paste the private key shown above             ║");
  console.log("  ║  4. Switch to Testnet network in Petra settings   ║");
  console.log("  ║  5. Open http://localhost:3102                    ║");
  console.log("  ║                                                   ║");
  console.log("  ╚═══════════════════════════════════════════════════╝");
  console.log("");

  console.log("  Import this private key into Petra wallet, switch to Testnet network, then open http://localhost:3102");
  console.log("");
}

main().catch((err: unknown) => {
  console.error("\nDemo wallet setup failed:", err);
  process.exit(1);
});
