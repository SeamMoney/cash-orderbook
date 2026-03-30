---
name: orderbook-protocol
description: CLOB orderbook protocol design derived from Decibel/Econia. Covers matching engine, order types, settlement, position management, fee tiers, liquidation, and the full trade lifecycle.
user-invocable: true
---

# CLOB Orderbook Protocol Design

Derived from the Decibel perpetual DEX (our fork target). Adapted from perpetuals to spot CLOB.

## Order Lifecycle

```
User submits order
    ↓
Async Matching Queue (FIFO with priority)
    ↓
Price-Time Priority Matching
    ├── Full fill → emit Trade event, update balances
    ├── Partial fill → emit Trade, remainder stays on book
    └── No match → order rests on book
    ↓
Settlement (clearinghouse)
    ├── Fee calculation (maker rebate / taker fee)
    ├── Balance updates (both sides)
    └── Event emission (Trade, OrderFilled, PositionUpdate)
```

## Core Data Structures

### OrderBook (on-chain resource)
```move
struct OrderBook has key {
    pair_id: u64,
    base_asset: Object<Metadata>,
    quote_asset: Object<Metadata>,
    // Sorted order storage — BigOrderedMap for efficiency
    bids: BigOrderedMap<OrderKey, Order>,  // Descending by price, then ascending by time
    asks: BigOrderedMap<OrderKey, Order>,  // Ascending by price, then ascending by time
    next_order_id: u64,
    lot_size: u64,         // Minimum quantity increment
    tick_size: u64,        // Minimum price increment
    min_size: u64,         // Minimum order size
    status: u8,            // 0=active, 1=paused, 2=delisted
}

// OrderKey for sorted storage (from Decibel PendingRequestKey pattern)
struct OrderKey has copy, drop, store {
    price: u64,            // Primary sort
    timestamp: u64,        // Secondary sort (time priority)
    order_id: u64,         // Tie-breaker
}
```

### Order
```move
struct Order has copy, drop, store {
    id: u64,
    owner: address,
    pair_id: u64,
    price: u64,               // Fixed-point (8 decimals)
    original_quantity: u64,    // Fixed-point (8 decimals)
    remaining_quantity: u64,
    is_bid: bool,
    order_type: u8,           // 0=GTC, 1=IOC, 2=FOK, 3=PostOnly
    timestamp: u64,
    // Optional (from Decibel TP/SL pattern)
    take_profit_price: u64,   // 0 = not set
    stop_loss_price: u64,     // 0 = not set
}
```

## Matching Engine

### Price-Time Priority (from Decibel/Econia)

```move
// Match a taker order against the book
fun match_order(
    book: &mut OrderBook,
    taker_order: &mut Order,
): vector<Trade> {
    let trades = vector::empty<Trade>();
    let opposing_side = if (taker_order.is_bid) { &mut book.asks } else { &mut book.bids };

    while (taker_order.remaining_quantity > 0) {
        // Get best opposing order
        let best_key = if (taker_order.is_bid) {
            big_ordered_map::min_key(opposing_side)  // Lowest ask
        } else {
            big_ordered_map::max_key(opposing_side)  // Highest bid
        };

        let maker = big_ordered_map::borrow_mut(opposing_side, &best_key);

        // Price check: bid must >= ask
        if (taker_order.is_bid && taker_order.price < maker.price) break;
        if (!taker_order.is_bid && taker_order.price > maker.price) break;

        // Fill quantity = min(taker remaining, maker remaining)
        let fill_qty = math::min(taker_order.remaining_quantity, maker.remaining_quantity);
        let fill_price = maker.price;  // Maker's price (price improvement for taker)

        // Update quantities
        taker_order.remaining_quantity = taker_order.remaining_quantity - fill_qty;
        maker.remaining_quantity = maker.remaining_quantity - fill_qty;

        // Emit trade
        vector::push_back(&mut trades, Trade {
            pair_id: book.pair_id,
            maker_order_id: maker.id,
            taker_order_id: taker_order.id,
            price: fill_price,
            quantity: fill_qty,
            maker: maker.owner,
            taker: taker_order.owner,
            // ... fees calculated separately
        });

        // Remove fully filled maker
        if (maker.remaining_quantity == 0) {
            big_ordered_map::remove(opposing_side, &best_key);
        };
    };

    trades
}
```

### Order Type Handling

```move
// After matching attempt
match order_type {
    GTC => {
        // If partially filled or unfilled, rest on book
        if (order.remaining_quantity > 0) {
            add_to_book(book, order);
        }
    },
    IOC => {
        // Cancel any unfilled portion (don't add to book)
        // Already matched what we could
    },
    FOK => {
        // All or nothing — if not fully filled, revert everything
        assert!(order.remaining_quantity == 0, E_FOK_NOT_FILLED);
    },
    POST_ONLY => {
        // Must not match — if it would, cancel instead
        assert!(trades_count == 0, E_POST_ONLY_WOULD_MATCH);
        add_to_book(book, order);
    },
}
```

## Fee Structure (from Decibel trading_fees_manager.move)

### Tiered Fees
```move
// 7-tier volume-based system
struct FeeTier has copy, drop, store {
    volume_threshold: u64,    // 30-day volume in USD
    maker_fee_bps: i64,       // Can be negative (rebate)
    taker_fee_bps: u64,
}

const DEFAULT_TIERS: vector<FeeTier> = [
    { volume_threshold: 0,           maker_fee_bps: 11,  taker_fee_bps: 34 },  // < $10M
    { volume_threshold: 10_000_000,  maker_fee_bps: 9,   taker_fee_bps: 30 },  // < $50M
    { volume_threshold: 50_000_000,  maker_fee_bps: 6,   taker_fee_bps: 25 },  // < $200M
    { volume_threshold: 200_000_000, maker_fee_bps: 3,   taker_fee_bps: 22 },  // < $1B
    { volume_threshold: 1_000_000_000, maker_fee_bps: 0, taker_fee_bps: 21 },  // < $4B
];

// Fee calculation
fun calculate_fees(notional: u64, maker_bps: i64, taker_bps: u64): (i64, u64) {
    let maker_fee = (notional as i128) * (maker_bps as i128) / 10_000;
    let taker_fee = (notional as u128) * (taker_bps as u128) / 10_000;
    ((maker_fee as i64), (taker_fee as u64))
}
```

### Builder Fees (frontend integrator rebates)
```move
// Max 10 bps, paid from taker fee
struct BuilderCode has copy, drop, store {
    builder_addr: address,
    fee_bps: u64,  // Max 10
}
```

## Settlement (from clearinghouse_perp.move, adapted for spot)

```move
fun settle_trade(
    trade: &Trade,
    maker_fee: i64,      // Can be negative (rebate)
    taker_fee: u64,
) {
    // 1. Transfer base asset: seller → buyer
    let base_amount = trade.quantity;
    if (trade.is_taker_bid) {
        // Taker buys base, maker sells base
        transfer_asset(trade.maker, trade.taker, base_asset, base_amount);
    } else {
        transfer_asset(trade.taker, trade.maker, base_asset, base_amount);
    };

    // 2. Transfer quote asset: buyer → seller
    let quote_amount = (trade.price * trade.quantity) / PRICE_SCALE;
    if (trade.is_taker_bid) {
        transfer_asset(trade.taker, trade.maker, quote_asset, quote_amount);
    } else {
        transfer_asset(trade.maker, trade.taker, quote_asset, quote_amount);
    };

    // 3. Collect fees
    if (maker_fee > 0) {
        debit_fee(trade.maker, (maker_fee as u64));
    } else if (maker_fee < 0) {
        credit_rebate(trade.maker, ((-maker_fee) as u64));
    };
    debit_fee(trade.taker, taker_fee);

    // 4. Emit events
    event::emit(Trade { ... });
}
```

## Balance Management

```move
// User balance tracking (deposit/withdraw)
struct UserBalance has key {
    balances: SmartTable<address, u64>,  // asset_metadata_addr → amount
}

public entry fun deposit(
    account: &signer,
    asset: Object<Metadata>,
    amount: u64,
) acquires UserBalance {
    // Transfer FA from user to protocol
    let fa = primary_fungible_store::withdraw(account, asset, amount);
    fungible_asset::deposit(protocol_store, fa);
    // Credit internal balance
    let balances = borrow_global_mut<UserBalance>(signer::address_of(account));
    let current = *smart_table::borrow_with_default(&balances.balances, object::object_address(&asset), &0u64);
    smart_table::upsert(&mut balances.balances, object::object_address(&asset), current + amount);
}
```

## Market Admin (from Decibel admin_apis.move)

```move
// Permission hierarchy
// Deployer > ElevatedAdmin > Admin > OracleUpdate

public entry fun register_market(
    admin: &signer,
    base_asset: Object<Metadata>,
    quote_asset: Object<Metadata>,
    lot_size: u64,
    tick_size: u64,
    min_size: u64,
) acquires ProtocolState {
    let state = borrow_global_mut<ProtocolState>(@cash_orderbook);
    assert!(signer::address_of(admin) == state.admin, E_UNAUTHORIZED);

    let pair_id = state.next_pair_id;
    state.next_pair_id = pair_id + 1;

    move_to(&resource_signer, OrderBook {
        pair_id,
        base_asset,
        quote_asset,
        bids: big_ordered_map::new(),
        asks: big_ordered_map::new(),
        next_order_id: 0,
        lot_size,
        tick_size,
        min_size,
        status: 0, // active
    });

    event::emit(MarketCreated { pair_id, base_asset: object::object_address(&base_asset), quote_asset: object::object_address(&quote_asset) });
}

public entry fun pause_market(admin: &signer, pair_id: u64) acquires OrderBook, ProtocolState { ... }
public entry fun delist_market(admin: &signer, pair_id: u64) acquires OrderBook, ProtocolState { ... }
```

## Events (for indexer consumption)

```move
#[event] struct MarketCreated has drop, store { pair_id: u64, base_asset: address, quote_asset: address }
#[event] struct OrderPlaced has drop, store { order_id: u64, owner: address, pair_id: u64, price: u64, quantity: u64, is_bid: bool, order_type: u8 }
#[event] struct OrderCancelled has drop, store { order_id: u64, owner: address, pair_id: u64, remaining_quantity: u64 }
#[event] struct OrderFilled has drop, store { order_id: u64, filled_quantity: u64, remaining_quantity: u64 }
#[event] struct Trade has drop, store { pair_id: u64, maker_order_id: u64, taker_order_id: u64, price: u64, quantity: u64, maker: address, taker: address, maker_fee: u64, taker_fee: u64, is_taker_bid: bool, timestamp: u64 }
#[event] struct DepositEvent has drop, store { user: address, asset: address, amount: u64 }
#[event] struct WithdrawEvent has drop, store { user: address, asset: address, amount: u64 }
```

## Key Differences from Decibel (Spot vs Perps)

| Decibel (Perps) | Cash (Spot) |
|-----------------|-------------|
| Positions with leverage | Direct asset ownership |
| Funding rate | Not needed |
| Liquidation (3-tier) | Not needed for spot |
| Mark price + oracle | Order book mid price |
| Isolated/cross margin | Simple balance model |
| TWAP scheduling | Optional (nice to have) |
| Subaccount system | Simpler single-account |

We keep: matching engine, fee tiers, order types (GTC/IOC/FOK/PostOnly), builder codes, admin system, event structure.
We drop: liquidation, funding, margin, oracle, vaults.
