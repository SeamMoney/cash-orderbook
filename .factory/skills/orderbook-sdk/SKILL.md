---
name: orderbook-sdk
description: TypeScript SDK patterns for interacting with the on-chain orderbook. Covers client setup, transaction building, event parsing, and type safety.
user-invocable: true
---

# Orderbook TypeScript SDK

## Client Setup
```typescript
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

const config = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(config);
```

## Transaction Patterns
```typescript
// Place a limit order
async function placeLimitOrder(params: {
  account: Account;
  pairId: number;
  price: bigint;      // fixed-point u64
  quantity: bigint;    // fixed-point u64
  isBid: boolean;
}) {
  const tx = await aptos.transaction.build.simple({
    sender: params.account.accountAddress,
    data: {
      function: `${MODULE_ADDRESS}::orderbook::place_limit_order`,
      functionArguments: [params.pairId, params.price, params.quantity, params.isBid],
    },
  });
  const signed = await aptos.transaction.sign({ signer: params.account, transaction: tx });
  return aptos.transaction.submit.simple({ transaction: tx, senderAuthenticator: signed });
}
```

## Event Parsing
```typescript
// Listen for trade events
const trades = await aptos.getEvents({
  eventType: `${MODULE_ADDRESS}::orderbook::Trade`,
});

// Parse into typed objects
interface TradeEvent {
  pair_id: string;
  maker_order_id: string;
  taker_order_id: string;
  price: string;
  quantity: string;
}
```

## View Functions
```typescript
// Read orderbook state without a transaction
const orderbook = await aptos.view({
  payload: {
    function: `${MODULE_ADDRESS}::orderbook::get_orderbook`,
    functionArguments: [pairId],
  },
});
```

## Fixed-Point Math
All prices and quantities use u64 with 8 decimal places:
- To convert: `actualValue * 10^8`
- Display: `(rawValue / 10n ** 8n).toFixed(8)`
- Use `bigint` throughout to avoid floating point errors
