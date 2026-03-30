/// Order cancellation module for the Cash Orderbook.
/// Allows users to cancel their own resting orders.
///
/// cancel_order(signer, pair_id, order_id) removes the order from the book,
/// unlocks the user's funds, and emits an OrderCancelled event.
/// Only the order owner can cancel their order.
module cash_orderbook::cancel {
    use std::signer;
    use std::vector;
    use aptos_framework::event;
    use cash_orderbook::types;
    use cash_orderbook::accounts;
    use cash_orderbook::market;

    // ========== Error Codes ==========
    const E_UNAUTHORIZED: u64 = 1;
    const E_ORDER_NOT_FOUND: u64 = 7;

    // ========== Constants ==========
    const MAX_PRICE: u64 = 18_446_744_073_709_551_615; // u64::MAX

    // ========== Events ==========

    #[event]
    struct OrderCancelled has drop, store {
        /// Order ID that was cancelled
        order_id: u64,
        /// Owner of the cancelled order
        owner: address,
        /// Market pair ID
        pair_id: u64,
        /// Remaining quantity that was unlocked
        remaining_quantity: u64,
        /// Whether it was a bid (buy) order
        is_bid: bool,
        /// Price of the cancelled order
        price: u64,
    }

    // ========== Entry Functions ==========

    /// Cancel a resting order on the orderbook.
    ///
    /// The order is identified by searching the book for the given order_id.
    /// Only the order owner can cancel their order.
    ///
    /// On cancel:
    ///   1. Remove order from the book (bids or asks)
    ///   2. Unlock the remaining locked funds
    ///   3. Emit OrderCancelled event
    ///
    /// Aborts with E_UNAUTHORIZED if caller is not the order owner.
    /// Aborts with E_ORDER_NOT_FOUND if order is not on the book.
    ///
    /// Note: Cancellation works even when the market is paused.
    public entry fun cancel_order(
        user: &signer,
        pair_id: u64,
        order_id: u64,
    ) {
        let user_addr = signer::address_of(user);

        // Market must exist (but doesn't need to be active — cancel works when paused)
        market::assert_market_exists(pair_id);

        // Get market assets for balance unlocking
        let (base_asset, quote_asset) = market::get_market_assets(pair_id);

        // Search for the order in bids and asks
        // First try bids
        let bids = market::get_all_bids();
        let found = false;
        let i = 0;
        let len = vector::length(&bids);
        while (i < len) {
            let order = vector::borrow(&bids, i);
            if (types::order_id(order) == order_id) {
                // Found the order — verify ownership
                let owner = types::order_owner(order);
                assert!(owner == user_addr, E_UNAUTHORIZED);

                let price = types::order_price(order);
                let remaining_qty = types::order_remaining_quantity(order);
                let timestamp = types::order_timestamp(order);

                // Remove from bids (inverted price key)
                let inverted_price = MAX_PRICE - price;
                let key = types::new_order_key(inverted_price, timestamp, order_id);
                market::remove_bid(key);

                // Unlock quote funds: (price * remaining) / PRICE_SCALE
                let price_scale = types::price_scale();
                let quote_unlock = (((price as u128) * (remaining_qty as u128)) / (price_scale as u128) as u64);
                if (quote_unlock > 0) {
                    accounts::unlock_balance(user_addr, quote_asset, quote_unlock);
                };

                // Emit event
                event::emit(OrderCancelled {
                    order_id,
                    owner: user_addr,
                    pair_id,
                    remaining_quantity: remaining_qty,
                    is_bid: true,
                    price,
                });

                found = true;
                break
            };
            i = i + 1;
        };

        if (!found) {
            // Try asks
            let asks = market::get_all_asks();
            let j = 0;
            let ask_len = vector::length(&asks);
            while (j < ask_len) {
                let order = vector::borrow(&asks, j);
                if (types::order_id(order) == order_id) {
                    // Found the order — verify ownership
                    let owner = types::order_owner(order);
                    assert!(owner == user_addr, E_UNAUTHORIZED);

                    let price = types::order_price(order);
                    let remaining_qty = types::order_remaining_quantity(order);
                    let timestamp = types::order_timestamp(order);

                    // Remove from asks (natural price key)
                    let key = types::new_order_key(price, timestamp, order_id);
                    market::remove_ask(key);

                    // Unlock base funds
                    if (remaining_qty > 0) {
                        accounts::unlock_balance(user_addr, base_asset, remaining_qty);
                    };

                    // Emit event
                    event::emit(OrderCancelled {
                        order_id,
                        owner: user_addr,
                        pair_id,
                        remaining_quantity: remaining_qty,
                        is_bid: false,
                        price,
                    });

                    found = true;
                    break
                };
                j = j + 1;
            };
        };

        assert!(found, E_ORDER_NOT_FOUND);
    }

    // ========== Tests ==========

    #[test_only]
    use aptos_framework::account as test_account;
    #[test_only]
    use aptos_framework::fungible_asset::{Self, Metadata};
    #[test_only]
    use aptos_framework::object::{Self, Object};
    #[test_only]
    use aptos_framework::primary_fungible_store;
    #[test_only]
    use aptos_framework::timestamp;
    #[test_only]
    use std::string;

    #[test_only]
    /// Setup two users for cancel tests.
    fun setup_cancel_test_env(
        deployer: &signer,
        user: &signer,
    ): (Object<Metadata>, Object<Metadata>, u64) {
        let deployer_addr = signer::address_of(deployer);
        let user_addr = signer::address_of(user);
        test_account::create_account_for_test(deployer_addr);
        test_account::create_account_for_test(user_addr);

        types::init_module_for_test(deployer);
        let resource_signer = types::get_resource_signer();
        let resource_addr = signer::address_of(&resource_signer);
        test_account::create_account_for_test(resource_addr);

        let aptos_framework = test_account::create_signer_for_test(@0x1);
        timestamp::set_time_has_started_for_testing(&aptos_framework);

        // Create base asset
        let base_constructor_ref = object::create_named_object(deployer, b"TEST_CASH");
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &base_constructor_ref,
            std::option::none(),
            string::utf8(b"Test CASH"),
            string::utf8(b"CASH"),
            6,
            string::utf8(b""),
            string::utf8(b""),
        );
        let base_metadata = object::object_from_constructor_ref<Metadata>(&base_constructor_ref);
        let base_mint_ref = fungible_asset::generate_mint_ref(&base_constructor_ref);

        // Create quote asset
        let quote_constructor_ref = object::create_named_object(deployer, b"TEST_USDC");
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &quote_constructor_ref,
            std::option::none(),
            string::utf8(b"Test USDC"),
            string::utf8(b"USDC"),
            6,
            string::utf8(b""),
            string::utf8(b""),
        );
        let quote_metadata = object::object_from_constructor_ref<Metadata>(&quote_constructor_ref);
        let quote_mint_ref = fungible_asset::generate_mint_ref(&quote_constructor_ref);

        // Mint and deposit for user
        let base_fa = fungible_asset::mint(&base_mint_ref, 10_000_000_000);
        primary_fungible_store::deposit(user_addr, base_fa);
        let quote_fa = fungible_asset::mint(&quote_mint_ref, 10_000_000_000);
        primary_fungible_store::deposit(user_addr, quote_fa);
        accounts::deposit(user, base_metadata, 5_000_000_000);
        accounts::deposit(user, quote_metadata, 5_000_000_000);

        // Register market
        market::register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000);

        (base_metadata, quote_metadata, 0)
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-013: Cancel buy order — removes from book, unlocks funds, emits event
    fun test_cancel_buy_order(deployer: &signer, user: &signer) {
        let (_base_metadata, quote_metadata, pair_id) = setup_cancel_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let quote_addr = object::object_address(&quote_metadata);

        // Place a buy order: 100 CASH at 2.0 USDC
        // order_id = 0 (first order)
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 2_000_000, 100_000_000, true, types::order_type_gtc()
        );

        // Verify locked
        let locked_before = accounts::get_locked_balance(user_addr, quote_addr);
        assert!(locked_before == 200_000_000, 100); // 100 * 2.0 = 200 USDC

        // Cancel the order (order_id = 0)
        cancel_order(user, pair_id, 0);

        // Verify: book is empty
        assert!(market::bids_is_empty(), 101);

        // Verify: funds unlocked
        let locked_after = accounts::get_locked_balance(user_addr, quote_addr);
        assert!(locked_after == 0, 102);

        // Verify: available balance restored
        let available = accounts::get_available_balance(user_addr, quote_addr);
        assert!(available == 5_000_000_000, 103);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-013: Cancel sell order — removes from book, unlocks base funds
    fun test_cancel_sell_order(deployer: &signer, user: &signer) {
        let (base_metadata, _quote_metadata, pair_id) = setup_cancel_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let base_addr = object::object_address(&base_metadata);

        // Place a sell order: 50 CASH at 3.0 USDC
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 3_000_000, 50_000_000, false, types::order_type_gtc()
        );

        // Verify locked base
        assert!(accounts::get_locked_balance(user_addr, base_addr) == 50_000_000, 200);

        // Cancel
        cancel_order(user, pair_id, 0);

        // Verify: asks empty
        assert!(market::asks_is_empty(), 201);

        // Verify: funds unlocked
        assert!(accounts::get_locked_balance(user_addr, base_addr) == 0, 202);
        assert!(accounts::get_available_balance(user_addr, base_addr) == 5_000_000_000, 203);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF, other = @0xCAFE1)]
    #[expected_failure(abort_code = 1, location = cash_orderbook::cancel)]
    /// VAL-CONTRACT-013: Cancelling another user's order aborts E_UNAUTHORIZED
    fun test_cancel_other_users_order(deployer: &signer, user: &signer, other: &signer) {
        let (_bm, _qm, pair_id) = setup_cancel_test_env(deployer, user);
        test_account::create_account_for_test(signer::address_of(other));

        // User places order
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 2_000_000, 100_000_000, true, types::order_type_gtc()
        );

        // Other user tries to cancel — should abort
        cancel_order(other, pair_id, 0);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 7, location = cash_orderbook::cancel)]
    /// Cancelling non-existent order aborts
    fun test_cancel_nonexistent_order(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_cancel_test_env(deployer, user);
        cancel_order(user, pair_id, 99);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// Cancel works on paused market
    fun test_cancel_on_paused_market(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_cancel_test_env(deployer, user);

        // Place order
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 2_000_000, 100_000_000, true, types::order_type_gtc()
        );

        // Pause market
        cash_orderbook::admin::pause_market(deployer, pair_id);

        // Cancel should still work
        cancel_order(user, pair_id, 0);
        assert!(market::bids_is_empty(), 300);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// Cancel middle order doesn't corrupt book (3 orders, cancel the middle one)
    fun test_cancel_middle_order(deployer: &signer, user: &signer) {
        let (_bm, quote_metadata, pair_id) = setup_cancel_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let quote_addr = object::object_address(&quote_metadata);

        // Place 3 buy orders at different prices
        // order_id 0: buy at 1.0
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 1_000_000, 10_000_000, true, types::order_type_gtc()
        );
        // order_id 1: buy at 2.0
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 2_000_000, 10_000_000, true, types::order_type_gtc()
        );
        // order_id 2: buy at 3.0
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 3_000_000, 10_000_000, true, types::order_type_gtc()
        );

        // Total locked: (1.0 * 10) + (2.0 * 10) + (3.0 * 10) = 10 + 20 + 30 = 60 USDC
        assert!(accounts::get_locked_balance(user_addr, quote_addr) == 60_000_000, 400);

        // Cancel the middle order (order_id=1, price=2.0)
        cancel_order(user, pair_id, 1);

        // Locked should be: 10 + 30 = 40 USDC (middle order unlocked 20)
        assert!(accounts::get_locked_balance(user_addr, quote_addr) == 40_000_000, 401);

        // Book should still have 2 orders
        assert!(!market::bids_is_empty(), 402);

        // Best bid should be at 3.0 (order_id=2)
        let best_bid_price = market::get_best_bid_price();
        assert!(best_bid_price == 3_000_000, 403);
    }
}
