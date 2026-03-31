/// View functions module for the Cash Orderbook.
/// Provides #[view] functions for querying on-chain state:
///   - get_orderbook(pair_id) — returns bids (descending) and asks (ascending)
///   - get_user_balances(user_addr) — returns available and locked per asset
///   - get_user_orders(user_addr, pair_id) — returns all open orders for a user
module cash_orderbook::views {
    use std::vector;
    use cash_orderbook::types;
    use cash_orderbook::accounts;
    use cash_orderbook::market;

    // ========== View Functions ==========

    #[view]
    /// Get the full orderbook for a market pair.
    /// Returns (bids, asks) where:
    ///   - bids: vector<Order> sorted descending by price (highest first)
    ///   - asks: vector<Order> sorted ascending by price (lowest first)
    ///
    /// Note: Uses the market module's get_all_bids/get_all_asks which iterate
    /// the BigOrderedMap in key order. Bids use inverted price keys so the
    /// natural iteration order gives descending real prices.
    public fun get_orderbook(pair_id: u64): (vector<types::Order>, vector<types::Order>) {
        // Verify market exists
        assert!(market::market_exists(pair_id), types::e_market_not_listed());

        let bids = market::get_all_bids(pair_id);
        let asks = market::get_all_asks(pair_id);

        (bids, asks)
    }

    #[view]
    /// Get a user's balances for specific base and quote assets.
    /// Returns (base_available, base_locked, quote_available, quote_locked).
    public fun get_user_balances(
        user_addr: address,
        base_asset_addr: address,
        quote_asset_addr: address,
    ): (u64, u64, u64, u64) {
        let base_available = accounts::get_available_balance(user_addr, base_asset_addr);
        let base_locked = accounts::get_locked_balance(user_addr, base_asset_addr);
        let quote_available = accounts::get_available_balance(user_addr, quote_asset_addr);
        let quote_locked = accounts::get_locked_balance(user_addr, quote_asset_addr);

        (base_available, base_locked, quote_available, quote_locked)
    }

    #[view]
    /// Get all open orders for a user on a specific market.
    /// Searches both bids and asks sides of the orderbook.
    /// Returns a vector of Orders belonging to the user.
    public fun get_user_orders(
        user_addr: address,
        pair_id: u64,
    ): vector<types::Order> {
        assert!(market::market_exists(pair_id), types::e_market_not_listed());

        let result = vector::empty<types::Order>();

        // Search bids
        let bids = market::get_all_bids(pair_id);
        let i = 0;
        let bid_len = vector::length(&bids);
        while (i < bid_len) {
            let order = vector::borrow(&bids, i);
            if (types::order_owner(order) == user_addr) {
                vector::push_back(&mut result, *order);
            };
            i = i + 1;
        };

        // Search asks
        let asks = market::get_all_asks(pair_id);
        let j = 0;
        let ask_len = vector::length(&asks);
        while (j < ask_len) {
            let order = vector::borrow(&asks, j);
            if (types::order_owner(order) == user_addr) {
                vector::push_back(&mut result, *order);
            };
            j = j + 1;
        };

        result
    }

    // ========== Tests ==========

    #[test_only]
    use std::signer;
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
    /// Setup environment for view tests. Returns (base_meta, quote_meta, pair_id).
    fun setup_view_test_env(
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
    /// VAL-CONTRACT-019: get_orderbook returns bids descending and asks ascending
    fun test_get_orderbook_sorted(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_view_test_env(deployer, user);

        // Place bids at different prices: 1.0, 3.0, 2.0
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 1_000_000, 10_000_000, true, types::order_type_gtc()
        );
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 3_000_000, 10_000_000, true, types::order_type_gtc()
        );
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 2_000_000, 10_000_000, true, types::order_type_gtc()
        );

        // Place asks at different prices: 5.0, 4.0, 6.0
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 5_000_000, 10_000_000, false, types::order_type_gtc()
        );
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 4_000_000, 10_000_000, false, types::order_type_gtc()
        );
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 6_000_000, 10_000_000, false, types::order_type_gtc()
        );

        let (bids, asks) = get_orderbook(pair_id);

        // Bids should be descending: 3.0, 2.0, 1.0
        assert!(vector::length(&bids) == 3, 100);
        assert!(types::order_price(vector::borrow(&bids, 0)) == 3_000_000, 101);
        assert!(types::order_price(vector::borrow(&bids, 1)) == 2_000_000, 102);
        assert!(types::order_price(vector::borrow(&bids, 2)) == 1_000_000, 103);

        // Asks should be ascending: 4.0, 5.0, 6.0
        assert!(vector::length(&asks) == 3, 104);
        assert!(types::order_price(vector::borrow(&asks, 0)) == 4_000_000, 105);
        assert!(types::order_price(vector::borrow(&asks, 1)) == 5_000_000, 106);
        assert!(types::order_price(vector::borrow(&asks, 2)) == 6_000_000, 107);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-019: get_orderbook returns empty vectors when book is empty
    fun test_get_orderbook_empty(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_view_test_env(deployer, user);

        let (bids, asks) = get_orderbook(pair_id);
        assert!(vector::length(&bids) == 0, 200);
        assert!(vector::length(&asks) == 0, 201);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-020: get_user_balances returns correct available and locked amounts
    fun test_get_user_balances(deployer: &signer, user: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_view_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // Initially: 5000 available, 0 locked for both
        let (ba, bl, qa, ql) = get_user_balances(user_addr, base_addr, quote_addr);
        assert!(ba == 5_000_000_000, 300);
        assert!(bl == 0, 301);
        assert!(qa == 5_000_000_000, 302);
        assert!(ql == 0, 303);

        // Place a buy order: locks quote
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 2_000_000, 100_000_000, true, types::order_type_gtc()
        );

        // Place a sell order: locks base
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 5_000_000, 50_000_000, false, types::order_type_gtc()
        );

        let (ba2, bl2, qa2, ql2) = get_user_balances(user_addr, base_addr, quote_addr);
        assert!(ba2 == 4_950_000_000, 304); // 5000 - 50
        assert!(bl2 == 50_000_000, 305); // 50 CASH locked
        assert!(qa2 == 4_800_000_000, 306); // 5000 - 200
        assert!(ql2 == 200_000_000, 307); // 200 USDC locked (100 * 2.0)
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-020: get_user_balances for non-existent user returns zeros
    fun test_get_user_balances_nonexistent(deployer: &signer, user: &signer) {
        let (_bm, _qm, _pair_id) = setup_view_test_env(deployer, user);

        let (ba, bl, qa, ql) = get_user_balances(@0xDEAD, @0x1234, @0x5678);
        assert!(ba == 0 && bl == 0 && qa == 0 && ql == 0, 350);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-021: get_user_orders returns all open orders for a user
    fun test_get_user_orders(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_view_test_env(deployer, user);
        let user_addr = signer::address_of(user);

        // Place 2 buy orders and 1 sell order
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 1_000_000, 10_000_000, true, types::order_type_gtc()
        );
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 2_000_000, 20_000_000, true, types::order_type_gtc()
        );
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 5_000_000, 30_000_000, false, types::order_type_gtc()
        );

        let orders = get_user_orders(user_addr, pair_id);
        assert!(vector::length(&orders) == 3, 400);

        // Verify all orders belong to user
        let i = 0;
        while (i < 3) {
            let order = vector::borrow(&orders, i);
            assert!(types::order_owner(order) == user_addr, 401 + i);
            i = i + 1;
        };
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-021: get_user_orders returns empty for user with no orders
    fun test_get_user_orders_empty(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_view_test_env(deployer, user);

        let orders = get_user_orders(@0xDEAD, pair_id);
        assert!(vector::length(&orders) == 0, 500);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-021: get_user_orders only returns orders for the specified user
    fun test_get_user_orders_filters_by_user(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_view_test_env(deployer, user);
        let user_addr = signer::address_of(user);

        // Place orders
        cash_orderbook::order_placement::place_limit_order(
            user, pair_id, 1_000_000, 10_000_000, true, types::order_type_gtc()
        );

        // Other user's address — should find nothing
        let other_orders = get_user_orders(@0xCAFE1, pair_id);
        assert!(vector::length(&other_orders) == 0, 600);

        // User's orders — should find 1
        let user_orders = get_user_orders(user_addr, pair_id);
        assert!(vector::length(&user_orders) == 1, 601);
    }
}
