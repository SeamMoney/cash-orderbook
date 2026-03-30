---
name: move-contracts
description: Move smart contract patterns derived from aptos-move-transpiler output and Decibel protocol. Covers module structure, resource definitions, abilities, entry functions, events, error handling, fixed-point math, gas optimization, and testing.
user-invocable: true
---

# Move Smart Contract Patterns

Patterns derived from actual transpiled output (aptos-move-transpiler) and the Decibel perpetual DEX protocol.

## Module Structure

Every module follows this layout (from transpiler output):

```move
module cash_orderbook::orderbook {
    use std::signer;
    use std::vector;
    use aptos_std::table::{Self, Table};
    use aptos_std::smart_table::{Self, SmartTable};
    use aptos_std::big_ordered_map::{Self, BigOrderedMap};
    use aptos_framework::account;
    use aptos_framework::event;
    use aptos_framework::fungible_asset::{Self, FungibleAsset, Metadata};
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;

    // ── Error codes (u64, named constants) ──────────────────
    // Standard: 0-15, Reserved: 16-255, Contract-specific: 256+
    const E_REVERT: u64 = 0;
    const E_UNAUTHORIZED: u64 = 2;
    const E_INSUFFICIENT_BALANCE: u64 = 4;
    const E_PAUSED: u64 = 6;
    const E_ALREADY_EXISTS: u64 = 8;
    const E_NOT_FOUND: u64 = 9;
    const E_INVALID_AMOUNT: u64 = 13;
    const E_OVERFLOW: u64 = 17;
    // Contract-specific
    const E_INVALID_PAIR: u64 = 256;
    const E_ORDER_NOT_FOUND: u64 = 257;
    const E_INVALID_PRICE: u64 = 258;
    const E_INSUFFICIENT_COLLATERAL: u64 = 259;
    const E_MARKET_NOT_LISTED: u64 = 260;

    // ── Configuration constants ─────────────────────────────
    const PRICE_DECIMALS: u8 = 8;
    const PRICE_SCALE: u64 = 100_000_000; // 10^8

    // ── Resources (has key = global storage) ────────────────
    struct OrderBook has key { ... }

    // ── Value structs (has copy, drop, store = nested data) ──
    struct Order has copy, drop, store { ... }

    // ── Events (has drop, store + #[event] attribute) ───────
    #[event]
    struct OrderPlaced has drop, store { ... }

    // ── Init (runs once at deploy) ──────────────────────────
    fun init_module(deployer: &signer) {
        let (_resource_signer, _signer_cap) = account::create_resource_account(deployer, b"cash_orderbook");
        move_to(deployer, OrderBook { ... });
    }

    // ── Entry functions (external tx entry points) ──────────
    public entry fun place_limit_order(account: &signer, ...) acquires OrderBook { ... }

    // ── View functions (read-only, no signer) ───────────────
    #[view]
    public fun get_orderbook(pair_id: u64): (vector<Order>, vector<Order>) acquires OrderBook { ... }

    // ── Internal helpers ────────────────────────────────────
    fun match_orders(state: &mut OrderBook, ...) { ... }
}
```

## Ability System

From transpiler type-mapper and Decibel contracts:

| Abilities | Use | Example |
|-----------|-----|---------|
| `has key` | Global state, one per address | `struct OrderBook has key { ... }` |
| `has copy, drop, store` | Value types in tables/vectors | `struct Order has copy, drop, store { ... }` |
| `has drop, store` | Events (auto-cleanup) | `#[event] struct Trade has drop, store { ... }` |
| `has store` | Table values that can't be copied | `struct Position has store { ... }` |

## Resource Account Pattern

From transpiler init_module output:

```move
struct ProtocolState has key {
    admin: address,
    signer_cap: account::SignerCapability,
    // ... state fields
}

fun init_module(deployer: &signer) {
    let (_resource_signer, _signer_cap) = account::create_resource_account(deployer, b"cash_orderbook");
    move_to(deployer, ProtocolState {
        admin: signer::address_of(deployer),
        signer_cap: _signer_cap,
        // ...
    });
}
```

## State Access Patterns

From transpiler acquires-clause generation:

```move
// Mutable access — for writes
public entry fun deposit(account: &signer, amount: u64) acquires OrderBook {
    let state = borrow_global_mut<OrderBook>(@cash_orderbook);
    assert!(signer::address_of(account) == state.admin, E_UNAUTHORIZED);
    // mutate state
}

// Immutable access — for reads
#[view]
public fun get_price(pair_id: u64): u64 acquires OrderBook {
    let state = borrow_global<OrderBook>(@cash_orderbook);
    // read state
}
```

## Table Operations

From transpiler state-transformer (Solidity mapping → Move Table):

```move
// Check + add pattern (idempotent)
if (!table::contains(&state.markets, pair_id)) {
    table::add(&mut state.markets, pair_id, Market { ... });
};

// Borrow with default (safe read)
let position = *table::borrow_with_default(
    table::borrow(&state.user_positions, user_addr),
    pair_id,
    &Position { size: 0, entry_price: 0 }
);

// Upsert (add or update)
table::upsert(&mut state.balances, user_addr, new_balance);

// Nested tables (from DLMM factory pattern)
// mapping(addr => mapping(addr => mapping(u256 => Info)))
struct State has key {
    pairs: Table<address, Table<address, Table<u64, PairInfo>>>,
}
```

## Event Emission

From transpiler event-transformer:

```move
#[event]
struct OrderPlaced has drop, store {
    order_id: u64,
    owner: address,
    pair_id: u64,
    price: u64,
    quantity: u64,
    is_bid: bool,
    timestamp: u64,
}

#[event]
struct Trade has drop, store {
    pair_id: u64,
    maker_order_id: u64,
    taker_order_id: u64,
    price: u64,
    quantity: u64,
    maker: address,
    taker: address,
    maker_fee: u64,
    taker_fee: u64,
}

// Emit in function body
event::emit(OrderPlaced {
    order_id: new_id,
    owner: signer::address_of(account),
    pair_id,
    price,
    quantity,
    is_bid,
    timestamp: timestamp::now_microseconds(),
});
```

## Fixed-Point Arithmetic

From transpiler output (lending protocol, AMM):

```move
// All prices/quantities: u64 with 8 decimal places (10^8 scale)
const PRICE_SCALE: u64 = 100_000_000;

// Multiply before divide to maintain precision
let notional: u128 = ((price as u128) * (quantity as u128)) / (PRICE_SCALE as u128);

// Use u128/u256 intermediates to prevent overflow
let fee: u64 = (((notional as u256) * (fee_bps as u256)) / (10_000u256)) as u64;

// Safe cast pattern (from transpiler)
fun safe_u64_cast(value: u256): u64 {
    assert!(value <= 18446744073709551615u256, E_OVERFLOW);
    (value as u64)
}

// AMM fee pattern (from simple_amm.move)
const FEE_NUMERATOR: u64 = 3;      // 0.3%
const FEE_DENOMINATOR: u64 = 1000;
let adjusted = (balance * FEE_DENOMINATOR) - (amount_in * FEE_NUMERATOR);
```

## Gas Optimization

From transpiler inline-function generation and Decibel patterns:

```move
// 1. Use swap_remove for O(1) vector deletion (order doesn't matter for cancel)
let last_idx = vector::length(&state.orders) - 1;
vector::swap(&mut state.orders, idx, last_idx);
vector::pop_back(&mut state.orders);

// 2. BigOrderedMap for large sorted collections (Decibel uses this for positions)
struct State has key {
    orders: BigOrderedMap<OrderKey, Order>,
}

// 3. SmartTable for high-contention maps (better parallelism than Table)
struct State has key {
    balances: SmartTable<address, u64>,
}

// 4. Inline small hot-path functions
inline fun is_bid(order: &Order): bool { order.is_bid }

// 5. Minimize borrow_global_mut calls — do all mutations in one borrow
let state = borrow_global_mut<OrderBook>(@cash_orderbook);
// ... do ALL mutations here before dropping the reference

// 6. Aggregator for parallel counters (Decibel uses i64_aggregator)
// Allows concurrent updates without sequential bottleneck
```

## Testing

From transpiler test output and Decibel patterns:

```move
#[test_only]
module cash_orderbook::orderbook_tests {
    use cash_orderbook::orderbook;
    use aptos_framework::account;
    use aptos_framework::timestamp;

    #[test(admin = @cash_orderbook, user = @0x123)]
    fun test_place_and_match(admin: &signer, user: &signer) {
        // Setup
        account::create_account_for_test(signer::address_of(admin));
        timestamp::set_time_has_started_for_testing(admin);

        // Initialize
        orderbook::init_module(admin);

        // Place orders
        orderbook::place_limit_order(user, /*pair_id*/ 1, /*price*/ 100_000_000, /*qty*/ 10_000_000, /*is_bid*/ true);

        // Verify state
        let (bids, asks) = orderbook::get_orderbook(1);
        assert!(vector::length(&bids) == 1, 0);
    }

    #[test]
    #[expected_failure(abort_code = 258)] // E_INVALID_PRICE
    fun test_zero_price_fails() {
        // ...
    }
}
```

Run: `aptos move test --coverage`

## Move.toml

```toml
[package]
name = "cash_orderbook"
version = "1.0.0"

[addresses]
cash_orderbook = "_"

[dependencies]
AptosFramework = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-framework", rev = "main" }
AptosStdlib = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-stdlib", rev = "main" }
MoveStdlib = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/move-stdlib", rev = "main" }

[dev-addresses]
cash_orderbook = "0xCAFE"
```

## Visibility Cheatsheet

| Modifier | Who can call | When to use |
|----------|-------------|-------------|
| `public entry fun f(&signer)` | External transactions | User-facing actions |
| `#[view] public fun f(): T` | Anyone, read-only | Queries (no signer needed) |
| `public fun f()` | Other modules | Shared library functions |
| `public(friend) fun f()` | Declared friend modules | Cross-module internal APIs |
| `public(package) fun f()` | Same package modules | Package-internal APIs |
| `fun f()` | Same module only | Private helpers |
