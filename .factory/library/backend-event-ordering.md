# Backend Event Ordering Invariant

## Context

`api/src/indexer/event-indexer.ts` currently polls Aptos events by type (`OrderPlaced`, `OrderCancelled`, `OrderFilled`, `TradeEvent`, `DepositEvent`, `WithdrawEvent`) in separate loops using `getModuleEventsByEventType`.

## Invariant

When event streams are processed per-type, state reducers must be order-independent across event types **or** events must be merged/sorted by transaction version before applying.

## Why this matters here

`OrderbookState.processTrade()` decrements depth only if the maker order still exists in `orders`. `OrderbookState.processOrderFilled()` can delete that maker order on full fill. If `OrderFilled` is applied before `TradeEvent`, depth can remain stale and expected orderbook deltas may be missed.
