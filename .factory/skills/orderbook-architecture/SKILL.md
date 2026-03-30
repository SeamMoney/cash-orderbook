---
name: orderbook-architecture
description: Econia vs Decibel architectural analysis, data structure comparison (BigOrderedMap vs AVL queue vs Table), and the recommended architecture for CASH orderbook. Based on deep analysis from decibel-security-research and decibrrr repos.
user-invocable: true
---

# Orderbook Architecture — Econia Lineage & Data Structures

From decibel-security-research/DECIBEL-EVOLUTION.md and decibrrr/decompiled_contracts analysis.

## Econia → Decibel Lineage

```
Econia (archived, Apache 2.0)
│
├── Testnet (Dec 2025): Decibel imports Econia as external dependency
│   Aptos Labs redeploys Econia at 0x1b3fa27b... for Decibel
│   Architecture: Econia order book → 8 callbacks → Decibel clearinghouse
│
├── Mainnet (Feb 2026): Decibel absorbs Econia code
│   Zero references to Econia address
│   Same module names but rewritten internals
│   AVL queue → BigOrderedMap (fundamental data structure swap)
│   Added: async matching, bulk orders, TWAP, conditional orders
│
└── Current (Mar 2026): 78 modules, 363KB, 11 upgrades
    12 modules (47KB) = orderbook layer (Econia-derived)
    66 modules (316KB) = perp engine (Decibel-original)
```

## Aptos Data Structures for Orderbooks

| Structure | Ordered? | Parallelism | Capacity | Gas/Op | Best For |
|-----------|----------|-------------|----------|--------|----------|
| **BigOrderedMap** | Yes | Partial (per leaf) | Unbounded | ~2-3 slot reads | **Orderbook (recommended)** |
| **OrderedMap** | Yes | Zero (one slot) | ~few K | 1 slot read | Small configs, shallow books |
| **Table** | No | Maximum (per entry) | Unbounded | 1 slot read | Lookup-only (balances, positions) |
| **TableWithLength** | No | Mostly serial | Unbounded | 1 slot + counter | Counted collections |
| **SmartTable** | No | Zero (deprecated) | Unbounded | 2+ slots | **Don't use (deprecated)** |
| **SimpleMap** | No | Zero | Small only | O(N) scan | **Don't use (deprecated)** |

### Why BigOrderedMap Wins

You need sorted iteration (best bid/ask, price walking) — eliminates Table, SmartTable, SimpleMap.

Between OrderedMap and BigOrderedMap:
- **OrderedMap**: single storage slot → every order placement conflicts with every other → zero parallelism
- **BigOrderedMap**: B+ tree across leaf nodes → orders at different prices can be modified concurrently under Block-STM

### BigOrderedMap Configuration

```move
// For orderbook: moderate leaf size, slot reuse for frequent place/cancel
let bids = big_ordered_map::new_with_config<PriceDescTimeKey, Order>(
    32,    // inner_max_degree (branching factor)
    32,    // leaf_max_degree (entries per leaf)
    true,  // reuse_slots (critical for MM place/cancel churn)
);
```

Tuning:
- `leaf_max_degree = 32-64`: Balance between parallelism and per-op cost
- `reuse_slots = true`: Avoid storage fee spikes from constant place/cancel
- Higher degree = fewer nodes, less parallelism but cheaper traversal

### Econia's AVL Queue (for reference — don't use)

```
Custom AVL tree + doubly-linked list
11,295 bytes of hand-rolled code
16,383 order HARD CAP per side
Evicts lowest-priority when full
Hand-tuned bit-packing in u128
```

Decibel replaced this with BigOrderedMap — zero custom code, unbounded capacity, framework-optimized.

## Recommended Architecture for CASH

### Data Structure Layout

```move
/// Main orderbook resource
struct OrderBook has key {
    pair_id: u64,
    base_asset: Object<Metadata>,
    quote_asset: Object<Metadata>,

    // Bids: descending price, ascending time (best bid = front)
    bids: BigOrderedMap<PriceDescTimeKey, Order>,
    // Asks: ascending price, ascending time (best ask = front)
    asks: BigOrderedMap<PriceAscTimeKey, Order>,

    // Quick lookup by order ID
    order_index: Table<u64, OrderRef>,

    next_order_id: u64,
    lot_size: u64,
    tick_size: u64,
    min_size: u64,
    status: u8,
}

/// Composite key for bid ordering (high price first, then early time)
struct PriceDescTimeKey has copy, drop, store {
    // Inverted price for descending sort: MAX_U64 - price
    inv_price: u64,
    timestamp: u64,
    order_id: u64,
}

/// Composite key for ask ordering (low price first, then early time)
struct PriceAscTimeKey has copy, drop, store {
    price: u64,
    timestamp: u64,
    order_id: u64,
}

/// Thin reference for order_index lookup
struct OrderRef has copy, drop, store {
    is_bid: bool,
    price: u64,
    timestamp: u64,
    order_id: u64,
}
```

### Why Composite Keys

BigOrderedMap sorts by key comparison. To get price-time priority:

**Asks** (best = lowest price, earliest time):
```
Key: (price, timestamp, order_id)
Natural ascending sort gives: cheapest asks first, FIFO within price
```

**Bids** (best = highest price, earliest time):
```
Key: (MAX_U64 - price, timestamp, order_id)
Natural ascending sort gives: most expensive bids first, FIFO within price
```

This is exactly what Decibel does with `PriceAscTime` / `PriceDescTime`.

### Balance Storage

```move
/// User balances — use Table for maximum parallelism
/// Different users' deposits don't conflict under Block-STM
struct UserBalances has key {
    balances: Table<address, u64>,  // asset_metadata_addr → amount
}
```

Table (not BigOrderedMap) because we don't need ordering — just O(1) lookup per user.

### Async Matching (from Decibel)

For high throughput, decouple order submission from matching:

```move
/// Pending match queue — FIFO with priority for liquidations
struct MatchQueue has key {
    pending: BigOrderedMap<MatchQueueKey, PendingRequest>,
    work_budget: u64,  // Gas units per crank call
}

struct MatchQueueKey has copy, drop, store {
    priority: u8,      // 0 = liquidation, 1 = regular
    timestamp: u64,
    counter: u64,       // Monotonic tie-breaker
}

/// Permissionless crank — anyone can trigger matching
public entry fun crank(pair_id: u64) acquires OrderBook, MatchQueue {
    let queue = borrow_global_mut<MatchQueue>(@cash_orderbook);
    let book = borrow_global_mut<OrderBook>(@cash_orderbook);
    let budget = queue.work_budget;
    let mut used = 0;

    while (used < budget && !big_ordered_map::is_empty(&queue.pending)) {
        let (key, request) = big_ordered_map::pop_front(&mut queue.pending);
        process_request(book, request);
        used = used + 1;
    };
}
```

### For CASH Specifically (Single MM Prop Book)

Your profile: one market (CASH token), one market maker (you), retail takers.

**Simplifications you can make:**
1. **Skip async matching** — with one MM, your transactions are naturally sequential. Sync matching is fine.
2. **OrderedMap might suffice** — if your book has < 100 price levels (likely for a memecoin), single-slot OrderedMap is simpler and cheaper per operation.
3. **Skip bulk orders initially** — you can place/cancel individual orders; add bulk later if needed.
4. **Skip conditional orders** — TP/SL not needed for a spot orderbook initially.

**What you still need:**
1. **BigOrderedMap for the book** — even if parallel isn't needed now, it scales if you add more MMs later. No capacity limit.
2. **Table for balances** — per-user parallelism means taker deposits don't block each other.
3. **Full event emission** — indexer needs OrderPlaced, OrderCancelled, Trade, Deposit, Withdraw events.
4. **Fee system** — even simple maker/taker split. Can add tiers later.
5. **Admin controls** — pause, delist, fee updates.

## What to Copy from Each

### From Econia (concepts only, not code)
- Price-time priority CLOB design
- Callback architecture (settlement separated from matching)
- Self-trade prevention (4 configurable behaviors)
- Generic `Market<T>` parameterization

### From Decibel (patterns, adapted to spot)
- BigOrderedMap with composite price-time keys
- Async matching with work budgets (for future scaling)
- Bulk order operations (for MM efficiency)
- Builder code system (frontend integrator rebates)
- Permissionless crank functions
- Client order IDs (string-based human-readable tracking)

### Build Fresh (not in either)
- Spot settlement (coin transfer, not margin-based)
- Simple balance model (deposit/withdraw, not cross/isolated margin)
- Lightweight fee system (2-3 tiers, not 7)
- No liquidation, funding, oracle needed for spot

## Bytecode Budget

Target: **~80-120KB total** (vs Econia's 63KB or Decibel's 363KB).

| Module | Est. Size | Purpose |
|--------|-----------|---------|
| orderbook.move | 15-20KB | Core book, matching, order types |
| settlement.move | 5-8KB | Trade execution, balance updates |
| balances.move | 5-8KB | Deposit/withdraw, balance tracking |
| fees.move | 5-8KB | Maker/taker fees, builder codes |
| admin.move | 3-5KB | Market registration, pause, config |
| types.move | 2-3KB | Shared types, error codes |
| events.move | 2-3KB | Event definitions |
| **Total** | **~40-55KB** | Lean spot CLOB |

This is smaller than Econia (63KB) because we use BigOrderedMap (zero custom data structure code) and don't need Econia's registry, incentives, custodian, or tablist modules.

## Key Vulnerabilities to Avoid (from Decibel security research)

1. **Permissionless crank without validation** — If matching is permissionless, validate that the crank call produces correct results. Decibel's permissionless functions lacked `&signer` for critical operations.
2. **Hardcoded parameters** — Decibel hardcoded 2% slippage. Make ALL parameters configurable.
3. **Crossed book state** — Assert `best_bid < best_ask` after every operation. A crossed book means free money for arbitrageurs.
4. **Overflow in notional calculation** — `price * quantity` can overflow u64. Use u128 intermediate.
5. **Self-trade on crank** — If your MM has resting orders and someone cranks, ensure self-trade prevention works.
6. **Event completeness** — Missing events = blind indexer = broken dashboard.
7. **Order dust** — Enforce minimum order size. Tiny orders can grief the book.
8. **Cancel authorization** — Only order owner can cancel. Check `order.owner == signer::address_of(account)`.
9. **Balance underflow on withdraw** — Check balance before debit. Don't rely on abort for user feedback.
10. **Fee extraction** — Fee treasury withdrawal must be admin-only and auditable via events.
