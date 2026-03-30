---
name: aptos-sdk
description: TypeScript SDK patterns for Aptos interaction from aptos-polymarket and decibrrr. Covers client setup, transaction building, view functions, event parsing, wallet integration, and mainnet RPC configuration.
user-invocable: true
---

# Aptos TypeScript SDK Patterns

From aptos-polymarket contract utilities and decibrrr SDK wrapper.

## Client Setup

```typescript
import { Aptos, AptosConfig, Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

// Mainnet with custom RPC
const config = new AptosConfig({
  network: Network.MAINNET,
  fullnode: process.env.APTOS_RPC_URL || 'https://fullnode.mainnet.aptoslabs.com/v1',
});
const aptos = new Aptos(config);

// Testnet
const testConfig = new AptosConfig({ network: Network.TESTNET });
const aptosTest = new Aptos(testConfig);

// With API key header (bypasses rate limits)
const configWithKey = new AptosConfig({
  network: Network.MAINNET,
  fullnode: process.env.APTOS_RPC_URL,
  clientConfig: {
    HEADERS: { 'x-api-key': process.env.APTOS_API_KEY },
  },
});
```

## Contract Constants

```typescript
const MODULE_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
const ORDERBOOK_MODULE = `${MODULE_ADDRESS}::orderbook`;
const PRICE_SCALE = 100_000_000n; // 10^8 for fixed-point
const QTY_SCALE = 100_000_000n;
```

## Transaction Building (from aptos-polymarket)

```typescript
// Place a limit order
async function placeLimitOrder(params: {
  account: Account;
  pairId: number;
  price: bigint;
  quantity: bigint;
  isBid: boolean;
}) {
  const tx = await aptos.transaction.build.simple({
    sender: params.account.accountAddress,
    data: {
      function: `${ORDERBOOK_MODULE}::place_limit_order`,
      functionArguments: [
        params.pairId,
        params.price.toString(),
        params.quantity.toString(),
        params.isBid,
      ],
    },
  });
  const signed = await aptos.transaction.sign({
    signer: params.account,
    transaction: tx,
  });
  const result = await aptos.transaction.submit.simple({
    transaction: tx,
    senderAuthenticator: signed,
  });
  // Wait for confirmation
  return aptos.waitForTransaction({ transactionHash: result.hash });
}

// Cancel an order
async function cancelOrder(account: Account, orderId: bigint) {
  const tx = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: {
      function: `${ORDERBOOK_MODULE}::cancel_order`,
      functionArguments: [orderId.toString()],
    },
  });
  // sign + submit same pattern...
}
```

## View Functions (from aptos-polymarket contracts.ts)

```typescript
// Read orderbook state (no transaction needed)
async function getOrderbook(pairId: number): Promise<{
  bids: PriceLevel[];
  asks: PriceLevel[];
}> {
  const [result] = await aptos.view({
    payload: {
      function: `${ORDERBOOK_MODULE}::get_orderbook`,
      functionArguments: [pairId],
    },
  });
  return parseOrderbook(result);
}

// Get user positions
async function getUserPositions(userAddr: string): Promise<Position[]> {
  const [result] = await aptos.view({
    payload: {
      function: `${ORDERBOOK_MODULE}::get_user_orders`,
      functionArguments: [userAddr],
    },
  });
  return parsePositions(result);
}

// Quote a trade (preview without executing)
async function quoteBuy(pairId: number, amountIn: bigint, isBid: boolean): Promise<bigint> {
  const [result] = await aptos.view({
    payload: {
      function: `${ORDERBOOK_MODULE}::quote_buy`,
      functionArguments: [pairId, amountIn.toString(), isBid],
    },
  });
  return BigInt(result as string);
}
```

## Event Fetching (from aptos-polymarket geomiClient.ts)

```typescript
// Direct from Aptos Events API (fallback when no indexer)
async function getTradeEvents(limit: number = 100): Promise<TradeEvent[]> {
  const events = await aptos.getEvents({
    options: {
      where: {
        indexed_type: { _eq: `${MODULE_ADDRESS}::orderbook::Trade` },
      },
      orderBy: [{ transaction_block_height: 'desc' }],
      limit,
    },
  });

  return events.map(e => ({
    txHash: e.transaction_version.toString(),
    eventIndex: e.event_index,
    price: BigInt(e.data.price),
    quantity: BigInt(e.data.quantity),
    makerOrderId: BigInt(e.data.maker_order_id),
    takerOrderId: BigInt(e.data.taker_order_id),
    timestamp: Number(e.data.timestamp || 0),
  }));
}

// From account transactions (simpler but noisier)
async function getAccountEvents(accountAddr: string) {
  const txns = await aptos.getAccountTransactions({
    accountAddress: accountAddr,
    options: { limit: 25 },
  });
  return txns.flatMap(tx =>
    (tx.events || []).filter(e =>
      e.type.startsWith(`${MODULE_ADDRESS}::orderbook::`)
    )
  );
}
```

## Fixed-Point Conversions

```typescript
// All on-chain values use 8 decimal places (10^8)
const SCALE = 100_000_000n;

function toOnChain(humanReadable: number): bigint {
  return BigInt(Math.round(humanReadable * Number(SCALE)));
}

function fromOnChain(raw: bigint | string): number {
  return Number(BigInt(raw)) / Number(SCALE);
}

// Display formatting
function formatPrice(raw: bigint): string {
  return fromOnChain(raw).toFixed(2);
}

function formatQty(raw: bigint): string {
  return fromOnChain(raw).toFixed(4);
}
```

## RPC Failover (from aptos-polymarket)

```typescript
const RPC_ENDPOINTS = [
  process.env.QUICKNODE_URL,                        // Paid, fast
  'https://aptos.cash.trading/v1',                  // Custom fullnode
  'https://fullnode.mainnet.aptoslabs.com/v1',      // Official
  'https://api.mainnet.aptoslabs.com/v1',           // Official API
].filter(Boolean) as string[];

class AptosMultiClient {
  private clients: Aptos[];

  constructor(endpoints: string[]) {
    this.clients = endpoints.map(url =>
      new Aptos(new AptosConfig({ fullnode: url }))
    );
  }

  async call<T>(fn: (client: Aptos) => Promise<T>): Promise<T> {
    for (const client of this.clients) {
      try {
        return await fn(client);
      } catch (e) {
        continue;
      }
    }
    throw new Error('All RPC endpoints failed');
  }
}

// Rate limiter (from aptos-polymarket rateLimiter.ts)
class RateLimiter {
  private queue: Array<() => void> = [];
  private lastCall = 0;

  constructor(private minIntervalMs: number = 500) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    const wait = Math.max(0, this.lastCall + this.minIntervalMs - now);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    this.lastCall = Date.now();
  }
}
```

## Wallet Integration (from sol2move providers.tsx)

```typescript
// Coinbase CDP (used in sol2move)
import { CDPReactProvider } from "@coinbase/cdp-react";

const cdpConfig = {
  projectId: process.env.NEXT_PUBLIC_CDP_PROJECT_ID,
  appName: 'Cash Orderbook',
  authMethods: ['email', 'oauth:x', 'oauth:google'],
};

// Aptos Wallet Adapter (standard approach)
import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react";
import { PetraWallet } from "petra-plugin-wallet-adapter";
import { PontemWallet } from "@pontem/wallet-adapter-plugin";

const wallets = [new PetraWallet(), new PontemWallet()];

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AptosWalletAdapterProvider plugins={wallets} autoConnect>
      {children}
    </AptosWalletAdapterProvider>
  );
}
```

## Type Definitions

```typescript
interface PriceLevel {
  price: bigint;
  quantity: bigint;
  orderCount: number;
}

interface Order {
  id: bigint;
  owner: string;
  pairId: number;
  price: bigint;
  quantity: bigint;
  remainingQty: bigint;
  isBid: boolean;
  timestamp: number;
}

interface Trade {
  txHash: string;
  eventIndex: number;
  pairId: number;
  price: bigint;
  quantity: bigint;
  makerOrderId: bigint;
  takerOrderId: bigint;
  maker: string;
  taker: string;
  isTakerBid: boolean;
  makerFee: bigint;
  takerFee: bigint;
  timestamp: number;
}

interface Market {
  pairId: number;
  baseAsset: string;
  quoteAsset: string;
  lotSize: bigint;
  tickSize: bigint;
  minSize: bigint;
  status: 'active' | 'paused' | 'delisted';
}
```

## Decibel SDK Pattern (from decibrrr)

```typescript
// Singleton SDK instance (from decibel-sdk.ts)
import { DecibelSDK } from '@decibeltrade/sdk';

let sdkInstance: DecibelSDK | null = null;

export function getSDK(): DecibelSDK {
  if (!sdkInstance) {
    sdkInstance = new DecibelSDK({
      network: process.env.NEXT_PUBLIC_NETWORK as 'testnet' | 'mainnet',
      rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
    });
  }
  return sdkInstance;
}
```
