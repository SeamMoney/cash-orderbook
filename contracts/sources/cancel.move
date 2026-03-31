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
    use cash_orderbook::subaccounts;

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
        cancel_order_internal(user_addr, pair_id, order_id);
    }

    /// Cancel a resting order on behalf of another user (delegation).
    /// The signer must be an authorized delegate of the owner.
    ///
    /// Aborts with E_UNAUTHORIZED if the signer is not authorized for the owner.
    /// Aborts with E_ORDER_NOT_FOUND if order is not on the book.
    public entry fun cancel_order_delegated(
        delegate: &signer,
        owner_addr: address,
        pair_id: u64,
        order_id: u64,
    ) {
        let delegate_addr = signer::address_of(delegate);
        subaccounts::assert_authorized_trader(delegate_addr, owner_addr);
        cancel_order_internal(owner_addr, pair_id, order_id);
    }

    /// Internal implementation for cancelling an order.
    /// Used by both direct and delegated entry functions.
    fun cancel_order_internal(
        user_addr: address,
        pair_id: u64,
        order_id: u64,
    ) {

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

                // Unlock quote funds using the stored locked_quote amount.
                // This is deterministic regardless of fee config changes since
                // placement — the exact amount locked at order creation is stored
                // on the order, and reduced proportionally on each partial fill.
                let quote_unlock = types::order_locked_quote(order);
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
    use cash_orderbook::fees;

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

    // ========== Delegation Cancel Tests ==========

    #[test_only]
    use cash_orderbook::subaccounts as test_subaccounts;

    #[test_only]
    /// Setup for delegation cancel tests.
    fun setup_delegation_cancel_env(
        deployer: &signer,
        owner: &signer,
        delegate: &signer,
    ): (Object<Metadata>, Object<Metadata>, u64) {
        let deployer_addr = signer::address_of(deployer);
        let owner_addr = signer::address_of(owner);
        let delegate_addr = signer::address_of(delegate);
        test_account::create_account_for_test(deployer_addr);
        test_account::create_account_for_test(owner_addr);
        test_account::create_account_for_test(delegate_addr);

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

        // Mint and deposit for owner
        let base_fa = fungible_asset::mint(&base_mint_ref, 10_000_000_000);
        primary_fungible_store::deposit(owner_addr, base_fa);
        let quote_fa = fungible_asset::mint(&quote_mint_ref, 10_000_000_000);
        primary_fungible_store::deposit(owner_addr, quote_fa);
        accounts::deposit(owner, base_metadata, 5_000_000_000);
        accounts::deposit(owner, quote_metadata, 5_000_000_000);

        // Register market
        market::register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000);

        // Owner sets up subaccount and delegates
        test_subaccounts::create_subaccount(owner);
        test_subaccounts::delegate_trading(owner, delegate_addr, 0); // never expires

        (base_metadata, quote_metadata, 0)
    }

    #[test(deployer = @cash_orderbook, owner = @0xBEEF, delegate = @0xDEAD)]
    /// Delegated cancel_order succeeds when delegate is authorized.
    fun test_delegated_cancel_authorized(deployer: &signer, owner: &signer, delegate: &signer) {
        let (_base_metadata, quote_metadata, pair_id) = setup_delegation_cancel_env(deployer, owner, delegate);
        let owner_addr = signer::address_of(owner);
        let quote_addr = object::object_address(&quote_metadata);

        // Owner places a limit buy (directly)
        cash_orderbook::order_placement::place_limit_order(
            owner, pair_id, 1_500_000, 100_000_000, true, types::order_type_gtc()
        );
        assert!(!market::bids_is_empty(), 500);
        assert!(accounts::get_locked_balance(owner_addr, quote_addr) == 150_000_000, 501);

        // Delegate cancels the order on owner's behalf
        cancel_order_delegated(delegate, owner_addr, pair_id, 0);

        // Order removed, funds unlocked
        assert!(market::bids_is_empty(), 502);
        assert!(accounts::get_locked_balance(owner_addr, quote_addr) == 0, 503);
        assert!(accounts::get_available_balance(owner_addr, quote_addr) == 5_000_000_000, 504);
    }

    #[test(deployer = @cash_orderbook, owner = @0xBEEF, delegate = @0xDEAD)]
    #[expected_failure(abort_code = 1, location = cash_orderbook::subaccounts)]
    /// Delegated cancel_order fails when signer is not authorized for the owner.
    fun test_delegated_cancel_unauthorized(deployer: &signer, owner: &signer, delegate: &signer) {
        let (_base_metadata, _quote_metadata, pair_id) = setup_delegation_cancel_env(deployer, owner, delegate);

        // Owner places an order
        cash_orderbook::order_placement::place_limit_order(
            owner, pair_id, 1_500_000, 100_000_000, true, types::order_type_gtc()
        );

        // Delegate tries to cancel on behalf of a random address where they are NOT authorized
        let random_addr = @0xAAAA;
        cancel_order_delegated(delegate, random_addr, pair_id, 0);
    }

    #[test(deployer = @cash_orderbook, owner = @0xBEEF, delegate = @0xDEAD)]
    /// Delegated cancel of sell order succeeds.
    fun test_delegated_cancel_sell_order(deployer: &signer, owner: &signer, delegate: &signer) {
        let (base_metadata, _quote_metadata, pair_id) = setup_delegation_cancel_env(deployer, owner, delegate);
        let owner_addr = signer::address_of(owner);
        let base_addr = object::object_address(&base_metadata);

        // Owner places a sell order
        cash_orderbook::order_placement::place_limit_order(
            owner, pair_id, 2_000_000, 50_000_000, false, types::order_type_gtc()
        );
        assert!(!market::asks_is_empty(), 600);
        assert!(accounts::get_locked_balance(owner_addr, base_addr) == 50_000_000, 601);

        // Delegate cancels
        cancel_order_delegated(delegate, owner_addr, pair_id, 0);

        assert!(market::asks_is_empty(), 602);
        assert!(accounts::get_locked_balance(owner_addr, base_addr) == 0, 603);
    }

    // ========== Fee Reserve Cancel Regression Tests ==========

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// REGRESSION: Cancel bid order with non-zero fees unlocks full amount (principal + fee reserve).
    /// Previously, cancel only unlocked quote_principal, leaving fee reserve stranded.
    ///
    /// Setup: 30 bps taker, 10 bps maker. Bid: 100 CASH at 2.0 USDC.
    /// quote_principal = 200 USDC = 200_000_000
    /// max_fee = max(30,10) bps of 200 = 200 * 30/10000 = 0.6 USDC = 600_000
    /// Total locked at placement = 200_600_000
    /// On cancel, must unlock exactly 200_600_000 (not just 200_000_000).
    fun test_cancel_bid_with_nonzero_fees_full_unlock(deployer: &signer, user: &signer) {
        let (_base_metadata, quote_metadata, pair_id) = setup_cancel_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let quote_addr = object::object_address(&quote_metadata);

        // Set fees: 10 bps maker, 30 bps taker
        fees::update_fee_config(deployer, 10, 30);

        let available_before = accounts::get_available_balance(user_addr, quote_addr);
        assert!(available_before == 5_000_000_000, 800);

        // Place a buy order: 100 CASH at 2.0 USDC
        // quote_principal = (2_000_000 * 100_000_000) / 1_000_000 = 200_000_000
        // max_fee = 200_000_000 * 30 / 10_000 = 600_000
        // Total locked = 200_600_000
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 2_000_000, 100_000_000, true, types::order_type_gtc()
        );

        // Verify locked includes fee reserve
        let locked_after_place = accounts::get_locked_balance(user_addr, quote_addr);
        assert!(locked_after_place == 200_600_000, 801); // 200_000_000 + 600_000

        let available_after_place = accounts::get_available_balance(user_addr, quote_addr);
        assert!(available_after_place == 5_000_000_000 - 200_600_000, 802);

        // Cancel the order
        cancel_order(user, pair_id, 0);

        // Verify: book is empty
        assert!(market::bids_is_empty(), 803);

        // Verify: ALL locked funds unlocked (including fee reserve)
        let locked_after_cancel = accounts::get_locked_balance(user_addr, quote_addr);
        assert!(locked_after_cancel == 0, 804);

        // Verify: full available balance restored (no stranded funds)
        let available_after_cancel = accounts::get_available_balance(user_addr, quote_addr);
        assert!(available_after_cancel == 5_000_000_000, 805);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// REGRESSION: Cancel bid with high fees — verify no stranded funds.
    /// Uses 500 bps (5%) taker fee to make the fee reserve very visible.
    ///
    /// Bid: 50 CASH at 1.0 USDC. quote_principal = 50 USDC.
    /// max_fee = 50 * 500/10000 = 2.5 USDC = 2_500_000.
    /// Total locked = 52_500_000.
    /// After cancel: locked = 0, available = initial.
    fun test_cancel_bid_with_high_fees_no_stranded_funds(deployer: &signer, user: &signer) {
        let (_base_metadata, quote_metadata, pair_id) = setup_cancel_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let quote_addr = object::object_address(&quote_metadata);

        // Set high fees: 100 bps maker, 500 bps taker
        fees::update_fee_config(deployer, 100, 500);

        let initial_available = accounts::get_available_balance(user_addr, quote_addr);

        // Place bid: 50 CASH at 1.0 USDC
        // quote_principal = 50_000_000
        // max_fee = 50_000_000 * 500 / 10_000 = 2_500_000
        // Total locked = 52_500_000
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 1_000_000, 50_000_000, true, types::order_type_gtc()
        );

        assert!(accounts::get_locked_balance(user_addr, quote_addr) == 52_500_000, 900);

        // Cancel
        cancel_order(user, pair_id, 0);

        // All funds restored
        assert!(accounts::get_locked_balance(user_addr, quote_addr) == 0, 901);
        assert!(accounts::get_available_balance(user_addr, quote_addr) == initial_available, 902);
    }

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// REGRESSION: Cancel after partial fill with non-zero fees.
    /// Verify remaining locked includes proportional fee reserve.
    ///
    /// Setup: 30 bps taker, 10 bps maker.
    /// Buyer places bid: 100 CASH at 2.0 USDC (GTC).
    ///   quote_principal = 200 USDC, max_fee = 600_000, total locked = 200_600_000.
    /// Seller fills 40 CASH at 2.0.
    ///   Fill: quote = 80 USDC, taker_fee = 80*30/10000 = 24_000
    ///   Settlement debits: 80_000_000 + 24_000 = 80_024_000 from locked.
    ///   Remaining on book: 60 CASH at 2.0.
    ///   Remaining locked includes proportional fee reserve for 60 CASH.
    /// Cancel remaining 60 CASH.
    ///   quote_principal_remaining = 120 USDC, fee_reserve_remaining = 120*30/10000 = 360_000
    ///   Unlock: 120_360_000
    /// After cancel: locked = 0, no stranded funds.
    fun test_cancel_after_partial_fill_with_fees(deployer: &signer, maker: &signer, taker: &signer) {
        let (_base_metadata, quote_metadata, pair_id) = setup_cancel_test_env_two_users(deployer, maker, taker);
        let maker_addr = signer::address_of(maker);
        let quote_addr = object::object_address(&quote_metadata);

        // Set fees: 10 bps maker, 30 bps taker
        fees::update_fee_config(deployer, 10, 30);

        // Maker (buyer) places bid: 100 CASH at 2.0 USDC
        // quote_principal = 200_000_000, max_fee = 600_000, total locked = 200_600_000
        cash_orderbook::order_placement::place_limit_order(
            maker, pair_id, 2_000_000, 100_000_000, true, types::order_type_gtc()
        );

        let locked_after_place = accounts::get_locked_balance(maker_addr, quote_addr);
        assert!(locked_after_place == 200_600_000, 1000);

        // Taker (seller) sells 40 CASH at 2.0 — partial fill of maker's bid
        cash_orderbook::order_placement::place_limit_order(
            taker, pair_id, 2_000_000, 40_000_000, false, types::order_type_gtc()
        );

        // After partial fill: 60 CASH remaining on book for maker.
        // Settlement debited quote_amount + taker_fee from maker's locked:
        //   quote_amount = 80_000_000, taker_fee(maker is NOT taker here; maker is the resting bid)
        //   Actually, the taker is the SELLER here, so the BUYER (maker) is the resting order.
        //   In settlement with taker_is_bid=false: buyer(maker) pays quote_amount + maker_fee from locked.
        //   maker_fee = 80_000_000 * 10 / 10_000 = 80_000
        //   Settlement also unlocks excess fee reserve: max_fee - maker_fee = 240_000 - 80_000 = 160_000
        //   So net: debit_locked(80_000_000 + 80_000), unlock_balance(160_000)
        //   locked before: 200_600_000
        //   after debit: 200_600_000 - 80_080_000 = 120_520_000
        //   after unlock excess: 120_520_000 - 160_000 = 120_360_000
        let locked_after_fill = accounts::get_locked_balance(maker_addr, quote_addr);
        assert!(locked_after_fill == 120_360_000, 1001); // 120 USDC principal + 360_000 fee reserve

        // Cancel remaining 60 CASH order (order_id = 0)
        cancel_order(maker, pair_id, 0);

        // Verify: book is empty
        assert!(market::bids_is_empty(), 1002);

        // Verify: ALL locked funds unlocked
        assert!(accounts::get_locked_balance(maker_addr, quote_addr) == 0, 1003);

        // Verify: available balance = initial - quote_spent - fees_paid
        // Initial: 5_000_000_000
        // Spent on fill: 80_000_000 (quote) + 80_000 (maker_fee) = 80_080_000
        // Available: 5_000_000_000 - 80_080_000 = 4_919_920_000
        // BUT: the excess fee that was unlocked during settlement goes back to available.
        // Wait: let me recalculate from scratch.
        //
        // Initial available: 5_000_000_000
        // After placing bid: available = 5_000_000_000 - 200_600_000 = 4_799_400_000
        // After fill (settlement credits seller's USDC as available, not buyer's — buyer's
        // quote is debited from locked). But the excess unlock adds to available:
        //   unlock_balance(160_000) -> available += 160_000 = 4_799_560_000
        // After cancel: unlock_balance(120_360_000) -> available += 120_360_000 = 4_919_920_000
        let available_after = accounts::get_available_balance(maker_addr, quote_addr);
        assert!(available_after == 4_919_920_000, 1004);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// REGRESSION: Cancel multiple bid orders with non-zero fees — all balances recoverable.
    /// Place 3 bids at different prices with fees, cancel all, verify no stranded funds.
    fun test_cancel_multiple_bids_with_fees_all_recoverable(deployer: &signer, user: &signer) {
        let (_base_metadata, quote_metadata, pair_id) = setup_cancel_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let quote_addr = object::object_address(&quote_metadata);

        // Set fees: 10 bps maker, 30 bps taker
        fees::update_fee_config(deployer, 10, 30);

        let initial_available = accounts::get_available_balance(user_addr, quote_addr);
        assert!(initial_available == 5_000_000_000, 1100);

        // Place 3 bids at different prices:
        // Order 0: 10 CASH at 1.0 -> principal=10_000_000, fee=30_000, total=10_030_000
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 1_000_000, 10_000_000, true, types::order_type_gtc()
        );
        // Order 1: 20 CASH at 2.0 -> principal=40_000_000, fee=120_000, total=40_120_000
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 2_000_000, 20_000_000, true, types::order_type_gtc()
        );
        // Order 2: 30 CASH at 3.0 -> principal=90_000_000, fee=270_000, total=90_270_000
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 3_000_000, 30_000_000, true, types::order_type_gtc()
        );

        // Total locked = 10_030_000 + 40_120_000 + 90_270_000 = 140_420_000
        let total_locked = accounts::get_locked_balance(user_addr, quote_addr);
        assert!(total_locked == 140_420_000, 1101);

        // Cancel all orders
        cancel_order(user, pair_id, 0);
        cancel_order(user, pair_id, 1);
        cancel_order(user, pair_id, 2);

        // Verify: all locked funds released
        assert!(accounts::get_locked_balance(user_addr, quote_addr) == 0, 1102);

        // Verify: full available balance restored
        assert!(accounts::get_available_balance(user_addr, quote_addr) == initial_available, 1103);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// Verify sell order cancellation is unaffected by fee changes
    /// (sell orders lock base, not quote, so fee reserve doesn't apply).
    fun test_cancel_sell_order_unaffected_by_fees(deployer: &signer, user: &signer) {
        let (base_metadata, _quote_metadata, pair_id) = setup_cancel_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let base_addr = object::object_address(&base_metadata);

        // Set fees: 100 bps maker, 500 bps taker
        fees::update_fee_config(deployer, 100, 500);

        let initial_available = accounts::get_available_balance(user_addr, base_addr);

        // Place sell order: 50 CASH at 2.0 USDC — locks 50 CASH (no fee reserve for sells)
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 2_000_000, 50_000_000, false, types::order_type_gtc()
        );

        assert!(accounts::get_locked_balance(user_addr, base_addr) == 50_000_000, 1200);

        // Cancel
        cancel_order(user, pair_id, 0);

        // Full balance restored
        assert!(accounts::get_locked_balance(user_addr, base_addr) == 0, 1201);
        assert!(accounts::get_available_balance(user_addr, base_addr) == initial_available, 1202);
    }

    // ========== Fee Config Change Regression Tests ==========

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// REGRESSION: Place bid with fees, admin changes fees, cancel bid.
    /// The stored locked_quote ensures the exact original lock is returned,
    /// regardless of fee config changes between placement and cancellation.
    ///
    /// Scenario:
    ///   1. Fees at 10 bps maker, 30 bps taker
    ///   2. User places bid: 100 CASH at 2.0 USDC
    ///      → locked = 200 + max_fee(200) = 200 + 0.6 = 200.6 USDC = 200_600_000
    ///   3. Admin changes fees to 500 bps taker, 200 bps maker
    ///   4. User cancels bid
    ///      → must unlock exactly 200_600_000 (the ORIGINAL lock), not recalculated
    ///   5. Verify: locked = 0, available = original
    fun test_cancel_bid_after_fee_config_change(deployer: &signer, user: &signer) {
        let (_base_metadata, quote_metadata, pair_id) = setup_cancel_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let quote_addr = object::object_address(&quote_metadata);

        // Step 1: Set initial fees: 10 bps maker, 30 bps taker
        fees::update_fee_config(deployer, 10, 30);

        let initial_available = accounts::get_available_balance(user_addr, quote_addr);
        assert!(initial_available == 5_000_000_000, 1300);

        // Step 2: Place bid: 100 CASH at 2.0 USDC
        // quote_principal = 200_000_000
        // max_fee = max(30, 10) bps of 200 = 200 * 30/10000 = 600_000
        // Total locked = 200_600_000
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 2_000_000, 100_000_000, true, types::order_type_gtc()
        );

        let locked_after_place = accounts::get_locked_balance(user_addr, quote_addr);
        assert!(locked_after_place == 200_600_000, 1301);

        // Step 3: Admin changes fees drastically (5x increase)
        fees::update_fee_config(deployer, 200, 500);

        // Step 4: Cancel the bid — must use stored locked_quote, not recalculated fees
        cancel_order(user, pair_id, 0);

        // Step 5: Verify: book empty, all funds returned
        assert!(market::bids_is_empty(), 1302);
        assert!(accounts::get_locked_balance(user_addr, quote_addr) == 0, 1303);
        assert!(accounts::get_available_balance(user_addr, quote_addr) == initial_available, 1304);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// REGRESSION: Place bid with fees, admin LOWERS fees to zero, cancel bid.
    /// Even when fees go to zero, the original lock (which included a fee reserve)
    /// must be fully returned.
    ///
    /// Without locked_quote: cancel would calculate max_fee=0 and only unlock
    /// the principal, stranding the original fee reserve forever.
    fun test_cancel_bid_after_fee_reduced_to_zero(deployer: &signer, user: &signer) {
        let (_base_metadata, quote_metadata, pair_id) = setup_cancel_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let quote_addr = object::object_address(&quote_metadata);

        // Set initial fees: 100 bps (1%)
        fees::update_fee_config(deployer, 100, 100);

        let initial_available = accounts::get_available_balance(user_addr, quote_addr);

        // Place bid: 50 CASH at 1.0 USDC
        // quote_principal = 50_000_000
        // max_fee = 50_000_000 * 100 / 10000 = 500_000
        // Total locked = 50_500_000
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 1_000_000, 50_000_000, true, types::order_type_gtc()
        );

        assert!(accounts::get_locked_balance(user_addr, quote_addr) == 50_500_000, 1400);

        // Admin removes all fees
        fees::update_fee_config(deployer, 0, 0);

        // Cancel — must still unlock the full 50_500_000
        cancel_order(user, pair_id, 0);

        assert!(accounts::get_locked_balance(user_addr, quote_addr) == 0, 1401);
        assert!(accounts::get_available_balance(user_addr, quote_addr) == initial_available, 1402);
    }

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// REGRESSION: Partial fill with fees, then admin changes fees, then cancel remainder.
    /// The stored locked_quote is reduced proportionally during matching,
    /// so cancel uses the correct remaining lock regardless of fee changes.
    ///
    /// Scenario:
    ///   1. Fees at 10 bps maker, 30 bps taker
    ///   2. Buyer places bid: 100 CASH at 2.0 USDC
    ///      → locked = 200_600_000
    ///   3. Seller fills 40 CASH (partial fill)
    ///      → matching reduces locked_quote proportionally: 200_600_000 * 60/100 = 120_360_000
    ///   4. Admin changes fees to 0
    ///   5. Buyer cancels remaining 60 CASH bid
    ///      → must unlock exactly 120_360_000 (stored proportional lock)
    fun test_cancel_after_partial_fill_then_fee_change(deployer: &signer, maker: &signer, taker: &signer) {
        let (_base_metadata, quote_metadata, pair_id) = setup_cancel_test_env_two_users(deployer, maker, taker);
        let maker_addr = signer::address_of(maker);
        let quote_addr = object::object_address(&quote_metadata);

        // Step 1: Set fees: 10 bps maker, 30 bps taker
        fees::update_fee_config(deployer, 10, 30);

        // Step 2: Buyer places bid: 100 CASH at 2.0 USDC
        cash_orderbook::order_placement::place_limit_order(
            maker, pair_id, 2_000_000, 100_000_000, true, types::order_type_gtc()
        );
        let locked_after_place = accounts::get_locked_balance(maker_addr, quote_addr);
        assert!(locked_after_place == 200_600_000, 1500);

        // Step 3: Seller fills 40 CASH at 2.0
        cash_orderbook::order_placement::place_limit_order(
            taker, pair_id, 2_000_000, 40_000_000, false, types::order_type_gtc()
        );

        // After partial fill, locked_quote on the order = 200_600_000 * 60 / 100 = 120_360_000
        let locked_after_fill = accounts::get_locked_balance(maker_addr, quote_addr);
        assert!(locked_after_fill == 120_360_000, 1501);

        // Step 4: Admin changes fees to 0
        fees::update_fee_config(deployer, 0, 0);

        // Step 5: Cancel remaining bid — must unlock stored 120_360_000
        cancel_order(maker, pair_id, 0);

        assert!(market::bids_is_empty(), 1502);
        assert!(accounts::get_locked_balance(maker_addr, quote_addr) == 0, 1503);
    }

    // ========== Two-User Cancel Test Helper ==========

    #[test_only]
    /// Setup two users for cancel tests involving partial fills.
    fun setup_cancel_test_env_two_users(
        deployer: &signer,
        maker: &signer,
        taker: &signer,
    ): (Object<Metadata>, Object<Metadata>, u64) {
        let deployer_addr = signer::address_of(deployer);
        let maker_addr = signer::address_of(maker);
        let taker_addr = signer::address_of(taker);
        test_account::create_account_for_test(deployer_addr);
        test_account::create_account_for_test(maker_addr);
        test_account::create_account_for_test(taker_addr);

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

        // Mint and deposit for maker
        let base_fa = fungible_asset::mint(&base_mint_ref, 10_000_000_000);
        primary_fungible_store::deposit(maker_addr, base_fa);
        let quote_fa = fungible_asset::mint(&quote_mint_ref, 10_000_000_000);
        primary_fungible_store::deposit(maker_addr, quote_fa);
        accounts::deposit(maker, base_metadata, 5_000_000_000);
        accounts::deposit(maker, quote_metadata, 5_000_000_000);

        // Mint and deposit for taker
        let base_fa2 = fungible_asset::mint(&base_mint_ref, 10_000_000_000);
        primary_fungible_store::deposit(taker_addr, base_fa2);
        let quote_fa2 = fungible_asset::mint(&quote_mint_ref, 10_000_000_000);
        primary_fungible_store::deposit(taker_addr, quote_fa2);
        accounts::deposit(taker, base_metadata, 5_000_000_000);
        accounts::deposit(taker, quote_metadata, 5_000_000_000);

        // Register market
        market::register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000);

        (base_metadata, quote_metadata, 0)
    }
}
