---
name: indexer-service
description: Indexer patterns for processing on-chain orderbook events into queryable state — order tracking, trade history, and real-time book snapshots.
user-invocable: true
---

# Orderbook Indexer Service

## Architecture
The indexer watches on-chain events and builds a real-time view of the orderbook state:

```
Aptos Node → Event Stream → Processor → Database → API/WebSocket
```

## Event Processing
1. Poll or stream events from the Aptos Indexer API
2. Parse `OrderPlaced`, `OrderCancelled`, `OrderFilled`, `Trade` events
3. Update in-memory orderbook state
4. Persist to database (Postgres or SQLite for dev)
5. Push updates to WebSocket subscribers

## Key Data Models
```typescript
interface OrderBookSnapshot {
  pairId: number;
  bids: PriceLevel[];    // sorted descending by price
  asks: PriceLevel[];    // sorted ascending by price
  lastTradePrice: bigint;
  timestamp: number;
}

interface PriceLevel {
  price: bigint;
  quantity: bigint;      // aggregate quantity at this price
  orderCount: number;
}

interface TradeRecord {
  id: string;
  pairId: number;
  price: bigint;
  quantity: bigint;
  makerOrderId: number;
  takerOrderId: number;
  timestamp: number;
}
```

## WebSocket Protocol
```typescript
// Client subscribes to a pair
{ "type": "subscribe", "channel": "orderbook", "pair_id": 1 }

// Server pushes updates
{ "type": "snapshot", "data": { bids: [...], asks: [...] } }
{ "type": "delta", "data": { side: "bid", price: "1000000", qty: "5000000" } }
{ "type": "trade", "data": { price: "1000000", qty: "200000", side: "buy" } }
```

## Reliability
- Track last processed event sequence number for resumption
- Periodic full-state snapshots for fast recovery
- Health check endpoint for monitoring
