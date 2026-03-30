---
name: move-contracts
description: Move smart contract development patterns for the Aptos orderbook. Covers module structure, resource safety, event emission, testing, and gas optimization.
user-invocable: true
---

# Move Contract Patterns for Cash Orderbook

## Module Structure
Every orderbook module follows this layout:
```move
module cash_orderbook::module_name {
    use aptos_framework::event;
    use aptos_framework::fungible_asset::{Self, FungibleAsset, Metadata};
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;

    /// Error codes — named constants, sequential
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INSUFFICIENT_BALANCE: u64 = 2;
    const E_INVALID_PAIR: u64 = 3;
    const E_ORDER_NOT_FOUND: u64 = 4;

    /// Resources stored on-chain
    struct OrderBook has key {
        bids: vector<Order>,
        asks: vector<Order>,
        next_order_id: u64,
        pair_id: u64,
    }

    struct Order has store, drop, copy {
        id: u64,
        owner: address,
        price: u64,         // Fixed-point: actual_price * 10^8
        quantity: u64,       // Fixed-point: actual_qty * 10^8
        timestamp: u64,
        is_bid: bool,
    }

    /// Events for indexer consumption
    #[event]
    struct OrderPlaced has drop, store {
        order_id: u64,
        owner: address,
        pair_id: u64,
        price: u64,
        quantity: u64,
        is_bid: bool,
    }

    #[event]
    struct Trade has drop, store {
        pair_id: u64,
        maker_order_id: u64,
        taker_order_id: u64,
        price: u64,
        quantity: u64,
    }
}
```

## Matching Engine Pattern
- Price-time priority: sort bids descending, asks ascending by price, then by timestamp
- Match in a loop: pop best opposing order, fill partially or fully
- Emit `Trade` event for each fill
- Refund unmatched remainder to taker

## Testing
```move
#[test_only]
module cash_orderbook::orderbook_tests {
    use cash_orderbook::orderbook;

    #[test(admin = @cash_orderbook)]
    fun test_place_and_match(admin: &signer) {
        // setup, place orders, verify state
    }
}
```
Run: `aptos move test --coverage`

## Gas Optimization
- Use `vector` operations carefully — prefer `swap_remove` over `remove` (O(1) vs O(n))
- Minimize `borrow_global_mut` calls — batch mutations
- Use `inline` for small hot-path functions
- Fixed-point arithmetic: u64 with 8 decimal places (multiply by 10^8)
