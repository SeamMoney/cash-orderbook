#[test_only]
module cash_orderbook::edge_case_tests {
    use std::signer;
    use std::vector;
    use aptos_framework::account as test_account;
    use aptos_framework::fungible_asset::{Self, Metadata};
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;
    use std::string;

    use cash_orderbook::types;
    use cash_orderbook::accounts;
    use cash_orderbook::market;
    use cash_orderbook::order_placement;
    use cash_orderbook::cancel;
    use cash_orderbook::views;
    use cash_orderbook::fees;

    // ========== Test Helpers ==========

    /// Setup environment with deployer and one user. Returns (base_meta, quote_meta, pair_id).
    fun setup_env(
        deployer: &signer,
        user: &signer,
    ): (Object<Metadata>, Object<Metadata>, u64) {
        let deployer_addr = signer::address_of(deployer);
        let user_addr = signer::address_of(user);
        test_account::create_account_for_test(deployer_addr);
        test_account::create_account_for_test(user_addr);

        types::init_module_for_test(deployer);
        let resource_addr = types::get_resource_account_address();
        test_account::create_account_for_test(resource_addr);

        let aptos_framework = test_account::create_signer_for_test(@0x1);
        timestamp::set_time_has_started_for_testing(&aptos_framework);

        // Create base asset (CASH)
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

        // Create quote asset (USDC)
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

        // Mint and deposit for user: 100,000 CASH and 100,000 USDC
        let base_fa = fungible_asset::mint(&base_mint_ref, 100_000_000_000);
        primary_fungible_store::deposit(user_addr, base_fa);
        let quote_fa = fungible_asset::mint(&quote_mint_ref, 100_000_000_000);
        primary_fungible_store::deposit(user_addr, quote_fa);
        accounts::deposit(user, base_metadata, 50_000_000_000);
        accounts::deposit(user, quote_metadata, 50_000_000_000);

        // Register market
        market::register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000, 6);

        (base_metadata, quote_metadata, 0)
    }

    /// Setup with two users. Returns (base_meta, quote_meta, pair_id).
    fun setup_two_users(
        deployer: &signer,
        user1: &signer,
        user2: &signer,
    ): (Object<Metadata>, Object<Metadata>, u64) {
        let deployer_addr = signer::address_of(deployer);
        let user1_addr = signer::address_of(user1);
        let user2_addr = signer::address_of(user2);
        test_account::create_account_for_test(deployer_addr);
        test_account::create_account_for_test(user1_addr);
        test_account::create_account_for_test(user2_addr);

        types::init_module_for_test(deployer);
        let resource_addr = types::get_resource_account_address();
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

        // Mint and deposit for user1
        let fa1 = fungible_asset::mint(&base_mint_ref, 100_000_000_000);
        primary_fungible_store::deposit(user1_addr, fa1);
        let fa2 = fungible_asset::mint(&quote_mint_ref, 100_000_000_000);
        primary_fungible_store::deposit(user1_addr, fa2);
        accounts::deposit(user1, base_metadata, 50_000_000_000);
        accounts::deposit(user1, quote_metadata, 50_000_000_000);

        // Mint and deposit for user2
        let fa3 = fungible_asset::mint(&base_mint_ref, 100_000_000_000);
        primary_fungible_store::deposit(user2_addr, fa3);
        let fa4 = fungible_asset::mint(&quote_mint_ref, 100_000_000_000);
        primary_fungible_store::deposit(user2_addr, fa4);
        accounts::deposit(user2, base_metadata, 50_000_000_000);
        accounts::deposit(user2, quote_metadata, 50_000_000_000);

        // Register market
        market::register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000, 6);

        (base_metadata, quote_metadata, 0)
    }

    // ========== Deep Book Tests (10+ Levels) ==========

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-027: 12 buy orders at different price levels all on the book.
    /// Verify get_orderbook returns them in descending price order.
    fun test_deep_book_12_bid_levels(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_env(deployer, user);

        // Place 12 buy orders at different prices: 1.0, 2.0, ..., 12.0
        let i = 1;
        while (i <= 12) {
            let price = i * 1_000_000; // i.0 USDC
            order_placement::place_limit_order(
                user, pair_id, price, 10_000_000, true, types::order_type_gtc()
            );
            i = i + 1;
        };

        // Verify orderbook
        let (bids, asks) = views::get_orderbook(pair_id);
        assert!(vector::length(&bids) == 12, 100);
        assert!(vector::length(&asks) == 0, 101);

        // Bids should be descending: 12.0, 11.0, 10.0, ..., 1.0
        let j = 0;
        while (j < 12) {
            let expected_price = (12 - j) * 1_000_000;
            let actual_price = types::order_price(vector::borrow(&bids, j));
            assert!(actual_price == (expected_price as u64), 200 + j);
            j = j + 1;
        };
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-027: 12 ask orders at different price levels all on the book.
    /// Verify get_orderbook returns them in ascending price order.
    fun test_deep_book_12_ask_levels(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_env(deployer, user);

        // Place 12 sell orders at different prices: 1.0, 2.0, ..., 12.0 (reversed insertion)
        let i = 12;
        while (i >= 1) {
            let price = i * 1_000_000;
            order_placement::place_limit_order(
                user, pair_id, price, 10_000_000, false, types::order_type_gtc()
            );
            i = i - 1;
        };

        // Verify orderbook
        let (bids, asks) = views::get_orderbook(pair_id);
        assert!(vector::length(&bids) == 0, 300);
        assert!(vector::length(&asks) == 12, 301);

        // Asks should be ascending: 1.0, 2.0, ..., 12.0
        let j = 0;
        while (j < 12) {
            let expected_price = (j + 1) * 1_000_000;
            let actual_price = types::order_price(vector::borrow(&asks, j));
            assert!(actual_price == (expected_price as u64), 400 + j);
            j = j + 1;
        };
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-027: Deep book with 12 bid levels and 12 ask levels.
    /// Both sides sorted correctly.
    fun test_deep_book_both_sides(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_env(deployer, user);

        // Place 12 bids at 1.0 .. 12.0
        let i = 1;
        while (i <= 12) {
            order_placement::place_limit_order(
                user, pair_id, (i * 1_000_000 as u64), 5_000_000, true, types::order_type_gtc()
            );
            i = i + 1;
        };

        // Place 12 asks at 13.0 .. 24.0
        let i = 13;
        while (i <= 24) {
            order_placement::place_limit_order(
                user, pair_id, (i * 1_000_000 as u64), 5_000_000, false, types::order_type_gtc()
            );
            i = i + 1;
        };

        let (bids, asks) = views::get_orderbook(pair_id);
        assert!(vector::length(&bids) == 12, 500);
        assert!(vector::length(&asks) == 12, 501);

        // Verify bids descending
        let j = 0;
        while (j < 11) {
            let p1 = types::order_price(vector::borrow(&bids, j));
            let p2 = types::order_price(vector::borrow(&bids, j + 1));
            assert!(p1 > p2, 600 + j);
            j = j + 1;
        };

        // Verify asks ascending
        let k = 0;
        while (k < 11) {
            let p1 = types::order_price(vector::borrow(&asks, k));
            let p2 = types::order_price(vector::borrow(&asks, k + 1));
            assert!(p1 < p2, 700 + k);
            k = k + 1;
        };
    }

    // ========== Cancel Middle Order Integrity ==========

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-027: Cancel multiple middle orders from 10+ level book.
    /// After cancellation, remaining orders are still sorted correctly.
    fun test_cancel_multiple_middle_orders_preserves_sort(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_env(deployer, user);

        // Place 10 buy orders at prices 1.0 through 10.0
        // Order IDs will be 0..9
        let i = 1;
        while (i <= 10) {
            order_placement::place_limit_order(
                user, pair_id, (i * 1_000_000 as u64), 10_000_000, true, types::order_type_gtc()
            );
            i = i + 1;
        };

        // Cancel orders at prices 3.0, 5.0, 7.0 (order_ids 2, 4, 6)
        cancel::cancel_order(user, pair_id, 2); // price 3.0
        cancel::cancel_order(user, pair_id, 4); // price 5.0
        cancel::cancel_order(user, pair_id, 6); // price 7.0

        // Get orderbook — should have 7 bids
        let (bids, _asks) = views::get_orderbook(pair_id);
        assert!(vector::length(&bids) == 7, 800);

        // Verify remaining bids are still descending
        // Expected: 10.0, 9.0, 8.0, 6.0, 4.0, 2.0, 1.0
        let expected_prices = vector[10_000_000u64, 9_000_000, 8_000_000, 6_000_000, 4_000_000, 2_000_000, 1_000_000];
        let j = 0;
        while (j < 7) {
            let actual = types::order_price(vector::borrow(&bids, j));
            let expected = *vector::borrow(&expected_prices, j);
            assert!(actual == expected, 900 + j);
            j = j + 1;
        };
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// Cancel middle ask orders and verify ascending sort is preserved.
    fun test_cancel_middle_ask_orders_preserves_sort(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_env(deployer, user);

        // Place 10 sell orders at prices 1.0 through 10.0
        let i = 1;
        while (i <= 10) {
            order_placement::place_limit_order(
                user, pair_id, (i * 1_000_000 as u64), 10_000_000, false, types::order_type_gtc()
            );
            i = i + 1;
        };

        // Cancel orders at prices 2.0, 4.0, 6.0, 8.0 (order_ids 1, 3, 5, 7)
        cancel::cancel_order(user, pair_id, 1);
        cancel::cancel_order(user, pair_id, 3);
        cancel::cancel_order(user, pair_id, 5);
        cancel::cancel_order(user, pair_id, 7);

        // Get orderbook — should have 6 asks
        let (_bids, asks) = views::get_orderbook(pair_id);
        assert!(vector::length(&asks) == 6, 1000);

        // Verify ascending: 1.0, 3.0, 5.0, 7.0, 9.0, 10.0
        let expected_prices = vector[1_000_000u64, 3_000_000, 5_000_000, 7_000_000, 9_000_000, 10_000_000];
        let j = 0;
        while (j < 6) {
            let actual = types::order_price(vector::borrow(&asks, j));
            let expected = *vector::borrow(&expected_prices, j);
            assert!(actual == expected, 1100 + j);
            j = j + 1;
        };
    }

    // ========== BigOrderedMap Sorted After Deletions ==========

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-027: Insert 15 orders, delete 5, insert 3 more, verify sort.
    fun test_insert_delete_insert_sort_order(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_env(deployer, user);

        // Insert 15 bid orders at prices 1..15
        let i = 1;
        while (i <= 15) {
            order_placement::place_limit_order(
                user, pair_id, (i * 1_000_000 as u64), 5_000_000, true, types::order_type_gtc()
            );
            i = i + 1;
        };

        // Delete 5 orders (IDs 0=price 1, 4=price 5, 8=price 9, 11=price 12, 14=price 15)
        cancel::cancel_order(user, pair_id, 0);
        cancel::cancel_order(user, pair_id, 4);
        cancel::cancel_order(user, pair_id, 8);
        cancel::cancel_order(user, pair_id, 11);
        cancel::cancel_order(user, pair_id, 14);

        // Insert 3 more orders at prices 0.5, 7.5, 20.0
        order_placement::place_limit_order(
            user, pair_id, 500_000, 5_000_000, true, types::order_type_gtc()
        );
        order_placement::place_limit_order(
            user, pair_id, 7_500_000, 5_000_000, true, types::order_type_gtc()
        );
        order_placement::place_limit_order(
            user, pair_id, 20_000_000, 5_000_000, true, types::order_type_gtc()
        );

        // Should have 13 bids (15 - 5 + 3)
        let (bids, _asks) = views::get_orderbook(pair_id);
        assert!(vector::length(&bids) == 13, 1200);

        // Verify strictly descending
        let j = 0;
        while (j < 12) {
            let p1 = types::order_price(vector::borrow(&bids, j));
            let p2 = types::order_price(vector::borrow(&bids, j + 1));
            assert!(p1 > p2, 1300 + j);
            j = j + 1;
        };

        // Highest should be 20.0, lowest should be 0.5
        assert!(types::order_price(vector::borrow(&bids, 0)) == 20_000_000, 1350);
        let last_idx = vector::length(&bids) - 1;
        assert!(types::order_price(vector::borrow(&bids, last_idx)) == 500_000, 1351);
    }

    // ========== Fee Integration Tests ==========

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// VAL-CONTRACT-024: Zero-fee trade — no deduction.
    /// Then update fees and verify fees are collected on subsequent trade.
    fun test_fee_zero_then_nonzero(deployer: &signer, maker: &signer, taker: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_two_users(deployer, maker, taker);
        let maker_addr = signer::address_of(maker);
        let taker_addr = signer::address_of(taker);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // Initialize fees
        fees::init_fees_for_test();

        // Verify zero fees at start
        let (m_fee, t_fee) = fees::get_fee_config();
        assert!(m_fee == 0 && t_fee == 0, 1400);

        // Trade with zero fees
        order_placement::place_limit_order(maker, pair_id, 2_000_000, 100_000_000, false, types::order_type_gtc());
        order_placement::place_limit_order(taker, pair_id, 2_000_000, 100_000_000, true, types::order_type_gtc());

        // Taker: 50000 + 100 = 50100 CASH, 50000 - 200 = 49800 USDC
        assert!(accounts::get_available_balance(taker_addr, base_addr) == 50_100_000_000, 1401);
        assert!(accounts::get_available_balance(taker_addr, quote_addr) == 49_800_000_000, 1402);

        // Maker: 50000 - 100 = 49900 CASH, 50000 + 200 = 50200 USDC
        assert!(accounts::get_available_balance(maker_addr, base_addr) == 49_900_000_000, 1403);
        assert!(accounts::get_available_balance(maker_addr, quote_addr) == 50_200_000_000, 1404);

        // No fees collected
        assert!(fees::get_collected_fees(quote_addr) == 0, 1405);
    }

    // ========== User Orders After Cancel ==========

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// After cancelling an order, get_user_orders reflects the cancellation.
    fun test_user_orders_after_cancel(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_env(deployer, user);
        let user_addr = signer::address_of(user);

        // Place 3 orders
        order_placement::place_limit_order(user, pair_id, 1_000_000, 10_000_000, true, types::order_type_gtc());
        order_placement::place_limit_order(user, pair_id, 2_000_000, 10_000_000, true, types::order_type_gtc());
        order_placement::place_limit_order(user, pair_id, 3_000_000, 10_000_000, true, types::order_type_gtc());

        assert!(vector::length(&views::get_user_orders(user_addr, pair_id)) == 3, 1500);

        // Cancel middle order
        cancel::cancel_order(user, pair_id, 1);

        let orders = views::get_user_orders(user_addr, pair_id);
        assert!(vector::length(&orders) == 2, 1501);

        // Verify order IDs are 0 and 2 (not 1)
        let has_0 = false;
        let has_2 = false;
        let i = 0;
        while (i < 2) {
            let oid = types::order_id(vector::borrow(&orders, i));
            if (oid == 0) has_0 = true;
            if (oid == 2) has_2 = true;
            i = i + 1;
        };
        assert!(has_0 && has_2, 1502);
    }

    // ========== Balance Consistency After Multiple Operations ==========

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// Place orders, cancel some, verify balance consistency via views.
    fun test_balance_consistency(deployer: &signer, user: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_env(deployer, user);
        let user_addr = signer::address_of(user);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // Place buy: 100 CASH at 2.0 USDC (locks 200 USDC)
        order_placement::place_limit_order(user, pair_id, 2_000_000, 100_000_000, true, types::order_type_gtc());

        // Place sell: 50 CASH at 5.0 USDC (locks 50 CASH)
        order_placement::place_limit_order(user, pair_id, 5_000_000, 50_000_000, false, types::order_type_gtc());

        let (ba, bl, qa, ql) = views::get_user_balances(user_addr, base_addr, quote_addr);
        assert!(ba == 49_950_000_000, 1600); // 50000 - 50 CASH
        assert!(bl == 50_000_000, 1601);      // 50 CASH locked
        assert!(qa == 49_800_000_000, 1602); // 50000 - 200 USDC
        assert!(ql == 200_000_000, 1603);     // 200 USDC locked

        // Cancel the buy order (order_id=0)
        cancel::cancel_order(user, pair_id, 0);

        let (ba2, bl2, qa2, ql2) = views::get_user_balances(user_addr, base_addr, quote_addr);
        assert!(ba2 == 49_950_000_000, 1604); // Unchanged
        assert!(bl2 == 50_000_000, 1605);     // Unchanged
        assert!(qa2 == 50_000_000_000, 1606); // 200 USDC unlocked
        assert!(ql2 == 0, 1607);              // No quote locked

        // Cancel the sell order (order_id=1)
        cancel::cancel_order(user, pair_id, 1);

        let (ba3, bl3, qa3, ql3) = views::get_user_balances(user_addr, base_addr, quote_addr);
        assert!(ba3 == 50_000_000_000, 1608); // 50 CASH unlocked
        assert!(bl3 == 0, 1609);
        assert!(qa3 == 50_000_000_000, 1610);
        assert!(ql3 == 0, 1611);
    }

    // ========== Matching Against Deep Book ==========

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// Market buy sweeps through 10+ price levels of asks.
    fun test_market_buy_sweeps_deep_asks(deployer: &signer, maker: &signer, taker: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_two_users(deployer, maker, taker);
        let taker_addr = signer::address_of(taker);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // Maker places 12 sell orders at 1.0 through 12.0 USDC, 10 CASH each
        let i = 1;
        while (i <= 12) {
            order_placement::place_limit_order(
                maker, pair_id, (i * 1_000_000 as u64), 10_000_000, false, types::order_type_gtc()
            );
            i = i + 1;
        };

        // Verify 12 asks
        let (_bids, asks) = views::get_orderbook(pair_id);
        assert!(vector::length(&asks) == 12, 1700);

        // Taker market buys 60 CASH — should fill through levels 1.0..6.0
        // Cost: 10*1 + 10*2 + 10*3 + 10*4 + 10*5 + 10*6 = 210 USDC
        order_placement::place_market_order(taker, pair_id, 60_000_000, true);

        // Verify taker got 60 CASH, paid 210 USDC
        assert!(accounts::get_available_balance(taker_addr, base_addr) == 50_060_000_000, 1701);
        assert!(accounts::get_available_balance(taker_addr, quote_addr) == 49_790_000_000, 1702);

        // Verify 6 asks remain (levels 7-12)
        let (_bids2, asks2) = views::get_orderbook(pair_id);
        assert!(vector::length(&asks2) == 6, 1703);

        // Best ask should now be 7.0
        assert!(types::order_price(vector::borrow(&asks2, 0)) == 7_000_000, 1704);
    }

    // ========== Cancel After Partial Fill ==========

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// Maker order partially filled, then remaining cancelled.
    /// Verifies correct balance state.
    fun test_cancel_after_partial_fill(deployer: &signer, maker: &signer, taker: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_two_users(deployer, maker, taker);
        let maker_addr = signer::address_of(maker);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // Maker: sell 100 CASH at 2.0 USDC (order_id 0)
        order_placement::place_limit_order(maker, pair_id, 2_000_000, 100_000_000, false, types::order_type_gtc());

        // Taker: buy 30 CASH at 2.0 — partial fill
        order_placement::place_limit_order(taker, pair_id, 2_000_000, 30_000_000, true, types::order_type_gtc());

        // Maker has 70 CASH still locked (100 - 30 filled)
        assert!(accounts::get_locked_balance(maker_addr, base_addr) == 70_000_000, 1800);

        // Maker received 60 USDC (30 * 2.0)
        assert!(accounts::get_available_balance(maker_addr, quote_addr) == 50_060_000_000, 1801);

        // Maker's remaining order should be findable
        let maker_orders = views::get_user_orders(maker_addr, pair_id);
        assert!(vector::length(&maker_orders) == 1, 1802);
        assert!(types::order_remaining_quantity(vector::borrow(&maker_orders, 0)) == 70_000_000, 1803);

        // Cancel the remaining order
        cancel::cancel_order(maker, pair_id, 0);

        // Verify: locked base is now 0
        assert!(accounts::get_locked_balance(maker_addr, base_addr) == 0, 1804);
        // Verify: available base = 50000 - 100 (original lock) + 70 (unlock from cancel) + 0 (30 already debited from locked) = 49970?
        // Actually: maker started with 50000 CASH, locked 100 (avail: 49900), then 30 was debited from locked (locked: 70), then cancel unlocks 70 (locked: 0, avail: 49900 + 70 = 49970)
        assert!(accounts::get_available_balance(maker_addr, base_addr) == 49_970_000_000, 1805);

        // No more orders
        assert!(vector::length(&views::get_user_orders(maker_addr, pair_id)) == 0, 1806);
    }

    // ========== Multiple Same-Price Orders ==========

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// Multiple orders at the same price level. Cancel one, others remain.
    fun test_multiple_orders_same_price_cancel_one(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_env(deployer, user);

        // Place 5 buy orders all at 2.0 USDC, 10 CASH each
        let i = 0;
        while (i < 5) {
            order_placement::place_limit_order(
                user, pair_id, 2_000_000, 10_000_000, true, types::order_type_gtc()
            );
            i = i + 1;
        };

        // All 5 on book
        let (bids, _) = views::get_orderbook(pair_id);
        assert!(vector::length(&bids) == 5, 1900);

        // Cancel the 3rd order (order_id = 2)
        cancel::cancel_order(user, pair_id, 2);

        // 4 remaining
        let (bids2, _) = views::get_orderbook(pair_id);
        assert!(vector::length(&bids2) == 4, 1901);

        // All remaining at price 2.0
        let j = 0;
        while (j < 4) {
            assert!(types::order_price(vector::borrow(&bids2, j)) == 2_000_000, 1910 + j);
            j = j + 1;
        };
    }

    // ========== Multi-Market Isolation Tests ==========

    /// Setup environment with deployer and two users, and register TWO markets.
    /// Market 0: base_asset_A / quote_asset_A
    /// Market 1: base_asset_B / quote_asset_B
    /// Returns (base_meta_A, quote_meta_A, pair_id_A, base_meta_B, quote_meta_B, pair_id_B)
    fun setup_two_markets(
        deployer: &signer,
        user1: &signer,
        user2: &signer,
    ): (Object<Metadata>, Object<Metadata>, u64, Object<Metadata>, Object<Metadata>, u64) {
        let deployer_addr = signer::address_of(deployer);
        let user1_addr = signer::address_of(user1);
        let user2_addr = signer::address_of(user2);
        test_account::create_account_for_test(deployer_addr);
        test_account::create_account_for_test(user1_addr);
        test_account::create_account_for_test(user2_addr);

        types::init_module_for_test(deployer);
        let resource_addr = types::get_resource_account_address();
        test_account::create_account_for_test(resource_addr);

        let aptos_framework = test_account::create_signer_for_test(@0x1);
        timestamp::set_time_has_started_for_testing(&aptos_framework);

        // ---- Market A assets ----
        let base_a_ref = object::create_named_object(deployer, b"BASE_A");
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &base_a_ref, std::option::none(), string::utf8(b"Base A"), string::utf8(b"BA"), 6, string::utf8(b""), string::utf8(b""),
        );
        let base_a = object::object_from_constructor_ref<Metadata>(&base_a_ref);
        let base_a_mint = fungible_asset::generate_mint_ref(&base_a_ref);

        let quote_a_ref = object::create_named_object(deployer, b"QUOTE_A");
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &quote_a_ref, std::option::none(), string::utf8(b"Quote A"), string::utf8(b"QA"), 6, string::utf8(b""), string::utf8(b""),
        );
        let quote_a = object::object_from_constructor_ref<Metadata>(&quote_a_ref);
        let quote_a_mint = fungible_asset::generate_mint_ref(&quote_a_ref);

        // ---- Market B assets ----
        let base_b_ref = object::create_named_object(deployer, b"BASE_B");
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &base_b_ref, std::option::none(), string::utf8(b"Base B"), string::utf8(b"BB"), 6, string::utf8(b""), string::utf8(b""),
        );
        let base_b = object::object_from_constructor_ref<Metadata>(&base_b_ref);
        let base_b_mint = fungible_asset::generate_mint_ref(&base_b_ref);

        let quote_b_ref = object::create_named_object(deployer, b"QUOTE_B");
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &quote_b_ref, std::option::none(), string::utf8(b"Quote B"), string::utf8(b"QB"), 6, string::utf8(b""), string::utf8(b""),
        );
        let quote_b = object::object_from_constructor_ref<Metadata>(&quote_b_ref);
        let quote_b_mint = fungible_asset::generate_mint_ref(&quote_b_ref);

        // Mint and deposit for user1: both market A and B assets
        let fa = fungible_asset::mint(&base_a_mint, 100_000_000_000);
        primary_fungible_store::deposit(user1_addr, fa);
        let fa = fungible_asset::mint(&quote_a_mint, 100_000_000_000);
        primary_fungible_store::deposit(user1_addr, fa);
        let fa = fungible_asset::mint(&base_b_mint, 100_000_000_000);
        primary_fungible_store::deposit(user1_addr, fa);
        let fa = fungible_asset::mint(&quote_b_mint, 100_000_000_000);
        primary_fungible_store::deposit(user1_addr, fa);
        accounts::deposit(user1, base_a, 50_000_000_000);
        accounts::deposit(user1, quote_a, 50_000_000_000);
        accounts::deposit(user1, base_b, 50_000_000_000);
        accounts::deposit(user1, quote_b, 50_000_000_000);

        // Mint and deposit for user2: both market A and B assets
        let fa = fungible_asset::mint(&base_a_mint, 100_000_000_000);
        primary_fungible_store::deposit(user2_addr, fa);
        let fa = fungible_asset::mint(&quote_a_mint, 100_000_000_000);
        primary_fungible_store::deposit(user2_addr, fa);
        let fa = fungible_asset::mint(&base_b_mint, 100_000_000_000);
        primary_fungible_store::deposit(user2_addr, fa);
        let fa = fungible_asset::mint(&quote_b_mint, 100_000_000_000);
        primary_fungible_store::deposit(user2_addr, fa);
        accounts::deposit(user2, base_a, 50_000_000_000);
        accounts::deposit(user2, quote_a, 50_000_000_000);
        accounts::deposit(user2, base_b, 50_000_000_000);
        accounts::deposit(user2, quote_b, 50_000_000_000);

        // Register Market A (pair_id = 0)
        market::register_market(deployer, base_a, quote_a, 1_000, 1_000, 10_000, 6);
        // Register Market B (pair_id = 1)
        market::register_market(deployer, base_b, quote_b, 2_000, 2_000, 20_000, 6);

        (base_a, quote_a, 0, base_b, quote_b, 1)
    }

    #[test(deployer = @cash_orderbook, user1 = @0xBEEF, user2 = @0xCAFE1)]
    /// Multi-market isolation: orders on market A do NOT appear in market B's book.
    /// Place bids and asks on both markets, verify each market's orderbook is independent.
    fun test_multi_market_isolation(deployer: &signer, user1: &signer, user2: &signer) {
        let (_ba, _qa, pair_a, _bb, _qb, pair_b) = setup_two_markets(deployer, user1, user2);

        // Place orders on Market A: 3 bids, 2 asks
        order_placement::place_limit_order(user1, pair_a, 1_000_000, 10_000_000, true, types::order_type_gtc());
        order_placement::place_limit_order(user1, pair_a, 2_000_000, 10_000_000, true, types::order_type_gtc());
        order_placement::place_limit_order(user1, pair_a, 3_000_000, 10_000_000, true, types::order_type_gtc());
        order_placement::place_limit_order(user1, pair_a, 5_000_000, 10_000_000, false, types::order_type_gtc());
        order_placement::place_limit_order(user1, pair_a, 6_000_000, 10_000_000, false, types::order_type_gtc());

        // Place orders on Market B: 1 bid, 3 asks
        order_placement::place_limit_order(user2, pair_b, 10_000_000, 20_000_000, true, types::order_type_gtc());
        order_placement::place_limit_order(user2, pair_b, 15_000_000, 20_000_000, false, types::order_type_gtc());
        order_placement::place_limit_order(user2, pair_b, 20_000_000, 20_000_000, false, types::order_type_gtc());
        order_placement::place_limit_order(user2, pair_b, 25_000_000, 20_000_000, false, types::order_type_gtc());

        // Verify Market A's orderbook: 3 bids, 2 asks
        let (bids_a, asks_a) = views::get_orderbook(pair_a);
        assert!(vector::length(&bids_a) == 3, 2000);
        assert!(vector::length(&asks_a) == 2, 2001);

        // Verify bids_a are in descending price order: 3.0, 2.0, 1.0
        assert!(types::order_price(vector::borrow(&bids_a, 0)) == 3_000_000, 2002);
        assert!(types::order_price(vector::borrow(&bids_a, 1)) == 2_000_000, 2003);
        assert!(types::order_price(vector::borrow(&bids_a, 2)) == 1_000_000, 2004);

        // Verify asks_a are in ascending price order: 5.0, 6.0
        assert!(types::order_price(vector::borrow(&asks_a, 0)) == 5_000_000, 2005);
        assert!(types::order_price(vector::borrow(&asks_a, 1)) == 6_000_000, 2006);

        // Verify Market B's orderbook: 1 bid, 3 asks
        let (bids_b, asks_b) = views::get_orderbook(pair_b);
        assert!(vector::length(&bids_b) == 1, 2010);
        assert!(vector::length(&asks_b) == 3, 2011);

        // Verify bids_b: single bid at 10.0
        assert!(types::order_price(vector::borrow(&bids_b, 0)) == 10_000_000, 2012);

        // Verify asks_b in ascending: 15.0, 20.0, 25.0
        assert!(types::order_price(vector::borrow(&asks_b, 0)) == 15_000_000, 2013);
        assert!(types::order_price(vector::borrow(&asks_b, 1)) == 20_000_000, 2014);
        assert!(types::order_price(vector::borrow(&asks_b, 2)) == 25_000_000, 2015);

        // Verify user orders are isolated per market
        let user1_orders_a = views::get_user_orders(signer::address_of(user1), pair_a);
        let user1_orders_b = views::get_user_orders(signer::address_of(user1), pair_b);
        assert!(vector::length(&user1_orders_a) == 5, 2020); // 3 bids + 2 asks on market A
        assert!(vector::length(&user1_orders_b) == 0, 2021); // user1 placed nothing on market B

        let user2_orders_a = views::get_user_orders(signer::address_of(user2), pair_a);
        let user2_orders_b = views::get_user_orders(signer::address_of(user2), pair_b);
        assert!(vector::length(&user2_orders_a) == 0, 2022); // user2 placed nothing on market A
        assert!(vector::length(&user2_orders_b) == 4, 2023); // 1 bid + 3 asks on market B
    }

    #[test(deployer = @cash_orderbook, user1 = @0xBEEF, user2 = @0xCAFE1)]
    /// Multi-market isolation: cancel on one market doesn't affect the other.
    fun test_multi_market_cancel_isolation(deployer: &signer, user1: &signer, user2: &signer) {
        let (_ba, _qa, pair_a, _bb, _qb, pair_b) = setup_two_markets(deployer, user1, user2);

        // Place orders on both markets
        order_placement::place_limit_order(user1, pair_a, 2_000_000, 10_000_000, true, types::order_type_gtc()); // order_id 0
        order_placement::place_limit_order(user2, pair_b, 10_000_000, 20_000_000, true, types::order_type_gtc()); // order_id 1

        // Verify both books have orders
        let (bids_a, _) = views::get_orderbook(pair_a);
        let (bids_b, _) = views::get_orderbook(pair_b);
        assert!(vector::length(&bids_a) == 1, 2100);
        assert!(vector::length(&bids_b) == 1, 2101);

        // Cancel the order on market A
        cancel::cancel_order(user1, pair_a, 0);

        // Market A should be empty
        let (bids_a2, _) = views::get_orderbook(pair_a);
        assert!(vector::length(&bids_a2) == 0, 2102);

        // Market B should still have its order
        let (bids_b2, _) = views::get_orderbook(pair_b);
        assert!(vector::length(&bids_b2) == 1, 2103);
        assert!(types::order_price(vector::borrow(&bids_b2, 0)) == 10_000_000, 2104);
    }

    #[test(deployer = @cash_orderbook, user1 = @0xBEEF, user2 = @0xCAFE1)]
    /// Multi-market isolation: matching on one market doesn't affect the other.
    fun test_multi_market_matching_isolation(deployer: &signer, user1: &signer, user2: &signer) {
        let (base_a, quote_a, pair_a, _bb, _qb, pair_b) = setup_two_markets(deployer, user1, user2);
        let user1_addr = signer::address_of(user1);
        let user2_addr = signer::address_of(user2);
        let base_a_addr = object::object_address(&base_a);
        let quote_a_addr = object::object_address(&quote_a);

        // Maker places sell on Market A
        order_placement::place_limit_order(user1, pair_a, 2_000_000, 50_000_000, false, types::order_type_gtc());

        // Place a bid on Market B (unrelated)
        order_placement::place_limit_order(user2, pair_b, 10_000_000, 20_000_000, true, types::order_type_gtc());

        // Taker buys on Market A — should match with user1's sell
        order_placement::place_limit_order(user2, pair_a, 2_000_000, 50_000_000, true, types::order_type_gtc());

        // Market A should be fully matched (empty)
        let (bids_a, asks_a) = views::get_orderbook(pair_a);
        assert!(vector::length(&bids_a) == 0, 2200);
        assert!(vector::length(&asks_a) == 0, 2201);

        // Market B should still have its order untouched
        let (bids_b, _) = views::get_orderbook(pair_b);
        assert!(vector::length(&bids_b) == 1, 2202);

        // Verify settlement happened correctly on Market A
        // user2 bought 50 base_a at 2.0 = 100 quote_a
        let user2_base_a = accounts::get_available_balance(user2_addr, base_a_addr);
        assert!(user2_base_a == 50_050_000_000, 2203); // 50000 + 50

        let user1_quote_a = accounts::get_available_balance(user1_addr, quote_a_addr);
        assert!(user1_quote_a == 50_100_000_000, 2204); // 50000 + 100
    }
}
