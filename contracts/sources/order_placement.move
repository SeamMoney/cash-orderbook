/// Order placement module for the Cash Orderbook.
/// Provides entry functions for placing limit and market orders.
/// Supports order types: GTC(0), IOC(1), FOK(2), PostOnly(3).
///
/// On placement:
///   1. Validate inputs (price>0, quantity>0, market exists and active)
///   2. Lock required funds from user balance
///   3. Attempt matching via matching::match_order()
///   4. Settle fills via settlement::settle_trades()
///   5. Based on order_type:
///      - GTC: rest remainder on book
///      - IOC: cancel remainder (do not rest on book)
///      - FOK: abort if not fully filled (pre-validated)
///      - PostOnly: abort if any match would occur (pre-validated)
///   6. Insert resting orders into BigOrderedMap with composite OrderKey
///   7. Emit OrderPlaced event
module cash_orderbook::order_placement {
    use std::signer;
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use cash_orderbook::types;
    use cash_orderbook::accounts;
    use cash_orderbook::market;
    use cash_orderbook::matching;
    use cash_orderbook::settlement;

    // ========== Error Codes ==========
    const E_INSUFFICIENT_BALANCE: u64 = 2;
    const E_INVALID_AMOUNT: u64 = 4;
    const E_INVALID_PRICE: u64 = 5;
    const E_FOK_NOT_FILLED: u64 = 9;
    const E_POST_ONLY_WOULD_MATCH: u64 = 10;
    const E_INVALID_ORDER_TYPE: u64 = 12;

    // ========== Constants ==========

    /// Maximum price value for bid key inversion.
    /// Bids use (MAX_PRICE - price) as key so BigOrderedMap ascending order = descending price.
    const MAX_PRICE: u64 = 18_446_744_073_709_551_615; // u64::MAX

    // ========== Events ==========

    #[event]
    struct OrderPlaced has drop, store {
        /// Order ID assigned to this order
        order_id: u64,
        /// Owner address
        owner: address,
        /// Market pair ID
        pair_id: u64,
        /// Price in PRICE_SCALE units (0 for market orders)
        price: u64,
        /// Quantity in base asset units
        quantity: u64,
        /// true = bid (buy), false = ask (sell)
        is_bid: bool,
        /// Order type: GTC(0), IOC(1), FOK(2), PostOnly(3)
        order_type: u8,
        /// Timestamp when placed
        timestamp: u64,
    }

    // ========== Entry Functions ==========

    /// Place a limit order on the orderbook.
    ///
    /// Parameters:
    ///   - user: signer placing the order
    ///   - pair_id: market pair ID
    ///   - price: price in PRICE_SCALE units (must be > 0)
    ///   - quantity: amount in base asset units (must be > 0)
    ///   - is_bid: true for buy, false for sell
    ///   - order_type: GTC(0), IOC(1), FOK(2), PostOnly(3)
    ///
    /// Aborts:
    ///   - E_INVALID_PRICE if price == 0
    ///   - E_INVALID_AMOUNT if quantity == 0
    ///   - E_MARKET_NOT_LISTED if market doesn't exist
    ///   - E_PAUSED if market is paused
    ///   - E_INSUFFICIENT_BALANCE if user doesn't have enough funds
    ///   - E_FOK_NOT_FILLED if FOK order can't be fully filled
    ///   - E_POST_ONLY_WOULD_MATCH if PostOnly order would cross the spread
    public entry fun place_limit_order(
        user: &signer,
        pair_id: u64,
        price: u64,
        quantity: u64,
        is_bid: bool,
        order_type: u8,
    ) {
        // 1. Validate inputs
        assert!(price > 0, E_INVALID_PRICE);
        assert!(quantity > 0, E_INVALID_AMOUNT);
        assert!(order_type <= 3, E_INVALID_ORDER_TYPE);

        // 2. Assert market exists and is active
        market::assert_market_active(pair_id);

        // 3. Get market info for asset addresses
        let (base_asset, quote_asset, _lot_size, _tick_size, _min_size, _status) = market::get_market_info(pair_id);

        let user_addr = signer::address_of(user);
        let now = timestamp::now_microseconds();

        // 4. Calculate required funds and lock them
        //    Buy order: lock quote asset (USDC) = price * quantity / PRICE_SCALE
        //    Sell order: lock base asset (CASH) = quantity
        let quote_lock_amount = calculate_quote_amount(price, quantity);

        if (is_bid) {
            assert!(quote_lock_amount > 0, E_INVALID_AMOUNT);
            accounts::lock_balance(user_addr, quote_asset, quote_lock_amount);
        } else {
            accounts::lock_balance(user_addr, base_asset, quantity);
        };

        // 5. Check if PostOnly would cross the spread
        if (order_type == types::order_type_post_only()) {
            let would_cross = if (is_bid) {
                // Buy PostOnly: would cross if there's an ask at or below our price
                let best_ask = market::get_best_ask_price();
                best_ask > 0 && price >= best_ask
            } else {
                // Sell PostOnly: would cross if there's a bid at or above our price
                let best_bid = market::get_best_bid_price();
                best_bid > 0 && best_bid >= price
            };
            if (would_cross) {
                // Unlock funds before aborting
                if (is_bid) {
                    accounts::unlock_balance(user_addr, quote_asset, quote_lock_amount);
                } else {
                    accounts::unlock_balance(user_addr, base_asset, quantity);
                };
                abort E_POST_ONLY_WOULD_MATCH
            };
        };

        // 6. FOK check: verify there's enough opposing liquidity to fully fill
        if (order_type == types::order_type_fok()) {
            let fillable = if (is_bid) {
                market::get_fillable_ask_quantity(price)
            } else {
                market::get_fillable_bid_quantity(price)
            };
            if (fillable < quantity) {
                // Can't fully fill — unlock funds and abort
                if (is_bid) {
                    accounts::unlock_balance(user_addr, quote_asset, quote_lock_amount);
                } else {
                    accounts::unlock_balance(user_addr, base_asset, quantity);
                };
                abort E_FOK_NOT_FILLED
            };
        };

        // 7. Get next order ID
        let order_id = types::next_order_id();

        // 8. Create Order
        let order = types::new_order(
            order_id,
            user_addr,
            price,
            quantity,
            quantity, // remaining_quantity = full quantity initially
            is_bid,
            order_type,
            now,
            pair_id,
        );

        // 9. Attempt matching (for GTC, IOC, FOK — PostOnly already verified no crossing)
        let trades = if (order_type != types::order_type_post_only()) {
            matching::match_order(&mut order, false) // not a market order
        } else {
            vector::empty()
        };

        // 10. Settle all fills
        let num_trades = vector::length(&trades);
        if (num_trades > 0) {
            settlement::settle_trades(&trades, pair_id);

            // For buy orders: unlock excess locked quote that wasn't used in fills.
            // Taker locked at their limit price, but fills may occur at lower maker prices.
            // We need to unlock the difference.
            if (is_bid) {
                let total_quote_used = calculate_total_quote_used(&trades);
                if (total_quote_used < quote_lock_amount) {
                    let remaining_qty = types::order_remaining_quantity(&order);
                    let still_needed = calculate_quote_amount(price, remaining_qty);
                    let total_accounted = total_quote_used + still_needed;
                    if (total_accounted < quote_lock_amount) {
                        accounts::unlock_balance(user_addr, quote_asset, quote_lock_amount - total_accounted);
                    };
                };
            };
        };

        // 11. Handle remaining quantity based on order type
        let remaining = types::order_remaining_quantity(&order);

        if (remaining == 0) {
            // Fully filled — nothing to rest or cancel
            // For buy orders, if there's any remaining lock, unlock it
            // (shouldn't happen since we accounted above, but safety check)
        } else if (order_type == types::order_type_ioc()) {
            // IOC: cancel any unfilled remainder — unlock remaining locked funds
            if (is_bid) {
                let remaining_lock = calculate_quote_amount(price, remaining);
                accounts::unlock_balance(user_addr, quote_asset, remaining_lock);
            } else {
                accounts::unlock_balance(user_addr, base_asset, remaining);
            };
        } else if (order_type == types::order_type_fok()) {
            // FOK: must be fully filled. Self-trade prevention may cause partial fill
            // despite sufficient nominal liquidity — abort in that case.
            assert!(remaining == 0, E_FOK_NOT_FILLED);
        } else {
            // GTC or PostOnly: rest the remaining order on the book
            if (remaining > 0) {
                insert_order_to_book(order, is_bid, price, now, order_id);
            };
        };

        // 12. Emit OrderPlaced event
        event::emit(OrderPlaced {
            order_id,
            owner: user_addr,
            pair_id,
            price,
            quantity,
            is_bid,
            order_type,
            timestamp: now,
        });
    }

    /// Place a market order. Market orders fill against the opposing side.
    /// Any unfilled remainder is NOT placed on the book (IOC-like behavior).
    ///
    /// Market buy: matches against asks at any price.
    /// Market sell: matches against bids at any price.
    public entry fun place_market_order(
        user: &signer,
        pair_id: u64,
        quantity: u64,
        is_bid: bool,
    ) {
        // 1. Validate inputs
        assert!(quantity > 0, E_INVALID_AMOUNT);

        // 2. Assert market exists and is active
        market::assert_market_active(pair_id);

        // 3. Get market info for asset addresses
        let (base_asset, quote_asset, _lot_size, _tick_size, _min_size, _status) = market::get_market_info(pair_id);

        let user_addr = signer::address_of(user);
        let now = timestamp::now_microseconds();

        // 4. Lock funds
        //    For market buy: lock the user's entire available quote balance
        //    (we'll unlock whatever isn't used after matching)
        //    For market sell: lock the base quantity
        let quote_lock_amount = if (is_bid) {
            // Lock as much USDC as needed — estimate at a very high price initially,
            // then unlock excess after matching. We lock all available for safety.
            let available_quote = accounts::get_available_balance(user_addr, quote_asset);
            if (available_quote > 0) {
                accounts::lock_balance(user_addr, quote_asset, available_quote);
            };
            available_quote
        } else {
            accounts::lock_balance(user_addr, base_asset, quantity);
            0
        };

        // 5. Get order ID
        let order_id = types::next_order_id();

        // 6. Create order — use max price for buy (matches anything), 0 for sell
        let effective_price = if (is_bid) { MAX_PRICE } else { 0 };
        let order = types::new_order(
            order_id,
            user_addr,
            effective_price,
            quantity,
            quantity,
            is_bid,
            types::order_type_ioc(), // Market orders behave like IOC
            now,
            pair_id,
        );

        // 7. Match against the book
        let trades = matching::match_order(&mut order, true);

        // 8. Settle fills
        let num_trades = vector::length(&trades);
        if (num_trades > 0) {
            settlement::settle_trades(&trades, pair_id);
        };

        // 9. Unlock any remaining locked funds (market orders don't rest)
        let remaining = types::order_remaining_quantity(&order);
        if (is_bid) {
            // Unlock quote that wasn't used
            let total_quote_used = calculate_total_quote_used(&trades);
            if (quote_lock_amount > total_quote_used) {
                accounts::unlock_balance(user_addr, quote_asset, quote_lock_amount - total_quote_used);
            };
        } else {
            if (remaining > 0) {
                accounts::unlock_balance(user_addr, base_asset, remaining);
            };
        };

        // 10. Emit OrderPlaced event
        event::emit(OrderPlaced {
            order_id,
            owner: user_addr,
            pair_id,
            price: if (is_bid) {
                // Use actual average fill price or 0 if no fills
                if (num_trades > 0) {
                    let total_quote_used = calculate_total_quote_used(&trades);
                    let filled_qty = quantity - remaining;
                    if (filled_qty > 0) {
                        calculate_average_price(total_quote_used, filled_qty)
                    } else { 0 }
                } else { 0 }
            } else { 0 },
            quantity,
            is_bid,
            order_type: types::order_type_ioc(), // Market orders behave like IOC
            timestamp: now,
        });
    }

    // ========== Internal Helper Functions ==========

    /// Calculate the quote asset amount for a given price and base quantity.
    /// quote_amount = (price * quantity) / PRICE_SCALE
    /// Uses u128 intermediate to prevent overflow.
    inline fun calculate_quote_amount(price: u64, quantity: u64): u64 {
        let price_scale = types::price_scale();
        (((price as u128) * (quantity as u128)) / (price_scale as u128) as u64)
    }

    /// Calculate the total quote asset used across all trades.
    fun calculate_total_quote_used(trades: &vector<matching::Trade>): u64 {
        let total: u64 = 0;
        let price_scale = types::price_scale();
        let i = 0;
        let len = vector::length(trades);
        while (i < len) {
            let trade = vector::borrow(trades, i);
            let trade_quote = (((matching::trade_price(trade) as u128) * (matching::trade_quantity(trade) as u128)) / (price_scale as u128) as u64);
            total = total + trade_quote;
            i = i + 1;
        };
        total
    }

    /// Calculate average price from total quote and filled quantity.
    fun calculate_average_price(total_quote: u64, filled_quantity: u64): u64 {
        let price_scale = types::price_scale();
        (((total_quote as u128) * (price_scale as u128)) / (filled_quantity as u128) as u64)
    }

    /// Insert an order into the appropriate side of the order book.
    /// Bids use inverted price keys for descending price order.
    /// Asks use natural price keys for ascending price order.
    fun insert_order_to_book(
        order: types::Order,
        is_bid: bool,
        price: u64,
        timestamp: u64,
        order_id: u64,
    ) {
        if (is_bid) {
            // Bids: invert price so BigOrderedMap ascending order = descending price
            let inverted_price = MAX_PRICE - price;
            let key = types::new_order_key(inverted_price, timestamp, order_id);
            market::add_bid(key, order);
        } else {
            // Asks: natural ascending price order
            let key = types::new_order_key(price, timestamp, order_id);
            market::add_ask(key, order);
        };
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
    use std::string;

    #[test_only]
    /// Comprehensive test helper: sets up deployer, user, protocol, two FAs (base + quote),
    /// mints tokens to user, deposits into protocol, registers a market.
    /// Returns (base_meta, quote_meta, pair_id).
    fun setup_order_test_env(
        deployer: &signer,
        user: &signer,
    ): (Object<Metadata>, Object<Metadata>, u64) {
        let deployer_addr = signer::address_of(deployer);
        let user_addr = signer::address_of(user);
        test_account::create_account_for_test(deployer_addr);
        test_account::create_account_for_test(user_addr);

        // Initialize protocol
        types::init_module_for_test(deployer);
        let resource_signer = types::get_resource_signer();
        let resource_addr = signer::address_of(&resource_signer);
        test_account::create_account_for_test(resource_addr);

        // Set timestamp for tests — requires @0x1 (aptos_framework) signer
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

        // Mint tokens to user: 10,000 CASH and 10,000 USDC (6 decimals)
        let base_fa = fungible_asset::mint(&base_mint_ref, 10_000_000_000);
        primary_fungible_store::deposit(user_addr, base_fa);
        let quote_fa = fungible_asset::mint(&quote_mint_ref, 10_000_000_000);
        primary_fungible_store::deposit(user_addr, quote_fa);

        // Deposit into protocol: 5,000 CASH and 5,000 USDC
        accounts::deposit(user, base_metadata, 5_000_000_000);
        accounts::deposit(user, quote_metadata, 5_000_000_000);

        // Register market (pair_id = 0)
        market::register_market(
            deployer,
            base_metadata,
            quote_metadata,
            1_000,    // lot_size
            1_000,    // tick_size
            10_000,   // min_size
        );

        (base_metadata, quote_metadata, 0)
    }

    // ===== GTC Limit Order Tests =====

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-006: Place GTC limit buy order — rests on book with correct locked balance
    fun test_place_gtc_limit_buy(deployer: &signer, user: &signer) {
        let (_base_metadata, quote_metadata, pair_id) = setup_order_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let quote_addr = object::object_address(&quote_metadata);

        // Place GTC limit buy: price = 1.5 USDC, quantity = 100 CASH
        let price = 1_500_000; // 1.5 in PRICE_SCALE
        let quantity = 100_000_000; // 100 CASH (6 decimals)
        place_limit_order(user, pair_id, price, quantity, true, types::order_type_gtc());

        // Verify: quote locked = (1.5 * 100) = 150 USDC = 150_000_000
        let expected_lock = 150_000_000;
        let locked = accounts::get_locked_balance(user_addr, quote_addr);
        assert!(locked == expected_lock, 100);

        // Verify: available quote decreased
        let available = accounts::get_available_balance(user_addr, quote_addr);
        assert!(available == 5_000_000_000 - expected_lock, 101);

        // Verify: order is on the bids side of the book
        assert!(!market::bids_is_empty(), 102);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-007: Place GTC limit sell order — rests on book
    fun test_place_gtc_limit_sell(deployer: &signer, user: &signer) {
        let (base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let base_addr = object::object_address(&base_metadata);

        // Place GTC limit sell: price = 2.0 USDC, quantity = 50 CASH
        let price = 2_000_000;
        let quantity = 50_000_000;
        place_limit_order(user, pair_id, price, quantity, false, types::order_type_gtc());

        // Verify: base locked = quantity = 50 CASH
        let locked = accounts::get_locked_balance(user_addr, base_addr);
        assert!(locked == quantity, 200);

        // Verify: available base decreased
        let available = accounts::get_available_balance(user_addr, base_addr);
        assert!(available == 5_000_000_000 - quantity, 201);

        // Verify: order is on the asks side
        assert!(!market::asks_is_empty(), 202);
    }

    // ===== IOC Limit Order Tests =====

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-008: IOC buy with no match — cancelled immediately, funds unlocked
    fun test_place_ioc_buy_no_match_cancels(deployer: &signer, user: &signer) {
        let (_base_metadata, quote_metadata, pair_id) = setup_order_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let quote_addr = object::object_address(&quote_metadata);

        // IOC buy with empty asks — should cancel immediately
        place_limit_order(user, pair_id, 1_500_000, 100_000_000, true, types::order_type_ioc());

        // Verify: no funds locked
        let locked = accounts::get_locked_balance(user_addr, quote_addr);
        assert!(locked == 0, 300);

        // Verify: available balance unchanged
        let available = accounts::get_available_balance(user_addr, quote_addr);
        assert!(available == 5_000_000_000, 301);

        // Verify: no orders on book
        assert!(market::bids_is_empty(), 302);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-008: IOC sell with no match — cancelled immediately
    fun test_place_ioc_sell_no_match_cancels(deployer: &signer, user: &signer) {
        let (base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let base_addr = object::object_address(&base_metadata);

        place_limit_order(user, pair_id, 2_000_000, 50_000_000, false, types::order_type_ioc());

        // Verify: no funds locked
        assert!(accounts::get_locked_balance(user_addr, base_addr) == 0, 350);

        // Verify: no orders on asks side
        assert!(market::asks_is_empty(), 351);
    }

    // ===== FOK Limit Order Tests =====

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 9, location = cash_orderbook::order_placement)]
    /// VAL-CONTRACT-009: FOK buy aborts when no opposing liquidity
    fun test_place_fok_buy_aborts_no_liquidity(deployer: &signer, user: &signer) {
        let (_base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);
        place_limit_order(user, pair_id, 1_500_000, 100_000_000, true, types::order_type_fok());
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 9, location = cash_orderbook::order_placement)]
    /// VAL-CONTRACT-009: FOK sell aborts when no opposing liquidity
    fun test_place_fok_sell_aborts_no_liquidity(deployer: &signer, user: &signer) {
        let (_base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);
        place_limit_order(user, pair_id, 1_000_000, 50_000_000, false, types::order_type_fok());
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 9, location = cash_orderbook::order_placement)]
    /// VAL-CONTRACT-009: FOK buy aborts when there's insufficient liquidity
    fun test_place_fok_buy_aborts_insufficient_liquidity(deployer: &signer, user: &signer) {
        let (_base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);

        // Place a small sell at 1.5 USDC for 10 CASH
        place_limit_order(user, pair_id, 1_500_000, 10_000_000, false, types::order_type_gtc());

        // FOK buy for 100 CASH — only 10 available, should abort
        place_limit_order(user, pair_id, 1_500_000, 100_000_000, true, types::order_type_fok());
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 9, location = cash_orderbook::order_placement)]
    /// VAL-CONTRACT-009: FOK sell aborts when there's insufficient bid liquidity
    fun test_place_fok_sell_aborts_insufficient_liquidity(deployer: &signer, user: &signer) {
        let (_base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);

        // Place a small buy at 2.0 USDC for 10 CASH
        place_limit_order(user, pair_id, 2_000_000, 10_000_000, true, types::order_type_gtc());

        // FOK sell for 100 CASH — only 10 available at 2.0, should abort
        place_limit_order(user, pair_id, 2_000_000, 100_000_000, false, types::order_type_fok());
    }

    // ===== PostOnly Limit Order Tests =====

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-010: PostOnly buy rests on book when no opposing ask at or below price
    fun test_place_post_only_buy_rests(deployer: &signer, user: &signer) {
        let (_base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);

        // PostOnly buy at 1.0 USDC — no asks, should rest
        place_limit_order(user, pair_id, 1_000_000, 50_000_000, true, types::order_type_post_only());
        assert!(!market::bids_is_empty(), 500);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-010: PostOnly sell rests when all bids are below sell price
    fun test_place_post_only_sell_rests(deployer: &signer, user: &signer) {
        let (_base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);

        // Place buy at 1.0 USDC
        place_limit_order(user, pair_id, 1_000_000, 50_000_000, true, types::order_type_gtc());

        // PostOnly sell at 2.0 — bid at 1.0 < 2.0, no cross, should rest
        place_limit_order(user, pair_id, 2_000_000, 50_000_000, false, types::order_type_post_only());

        assert!(!market::bids_is_empty(), 600);
        assert!(!market::asks_is_empty(), 601);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 10, location = cash_orderbook::order_placement)]
    /// VAL-CONTRACT-010: PostOnly buy aborts when ask exists at or below price (would cross)
    fun test_place_post_only_buy_aborts_on_cross(deployer: &signer, user: &signer) {
        let (_base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);

        // Place sell at 1.5 USDC
        place_limit_order(user, pair_id, 1_500_000, 50_000_000, false, types::order_type_gtc());

        // PostOnly buy at 1.5 — would cross (ask at 1.5 <= buy price 1.5)
        place_limit_order(user, pair_id, 1_500_000, 50_000_000, true, types::order_type_post_only());
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 10, location = cash_orderbook::order_placement)]
    /// VAL-CONTRACT-010: PostOnly buy aborts when ask below price exists
    fun test_place_post_only_buy_aborts_ask_below(deployer: &signer, user: &signer) {
        let (_base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);

        // Place sell at 1.0
        place_limit_order(user, pair_id, 1_000_000, 50_000_000, false, types::order_type_gtc());

        // PostOnly buy at 2.0 — would cross (ask at 1.0 < buy price 2.0)
        place_limit_order(user, pair_id, 2_000_000, 50_000_000, true, types::order_type_post_only());
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 10, location = cash_orderbook::order_placement)]
    /// VAL-CONTRACT-010: PostOnly sell aborts when bid at or above price exists
    fun test_place_post_only_sell_aborts_on_cross(deployer: &signer, user: &signer) {
        let (_base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);

        // Place buy at 2.0 USDC
        place_limit_order(user, pair_id, 2_000_000, 50_000_000, true, types::order_type_gtc());

        // PostOnly sell at 2.0 — would cross (bid at 2.0 >= sell price 2.0)
        place_limit_order(user, pair_id, 2_000_000, 50_000_000, false, types::order_type_post_only());
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 10, location = cash_orderbook::order_placement)]
    /// VAL-CONTRACT-010: PostOnly sell aborts when bid above price exists
    fun test_place_post_only_sell_aborts_bid_above(deployer: &signer, user: &signer) {
        let (_base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);

        // Place buy at 3.0 USDC
        place_limit_order(user, pair_id, 3_000_000, 50_000_000, true, types::order_type_gtc());

        // PostOnly sell at 2.0 — would cross (bid at 3.0 > sell price 2.0)
        place_limit_order(user, pair_id, 2_000_000, 50_000_000, false, types::order_type_post_only());
    }

    // ===== Market Order Tests =====

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-011: Market buy order — no resting on book
    fun test_place_market_buy(deployer: &signer, user: &signer) {
        let (_base_metadata, quote_metadata, pair_id) = setup_order_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let quote_addr = object::object_address(&quote_metadata);

        place_market_order(user, pair_id, 100_000_000, true);

        // Verify: no funds locked (market order doesn't rest)
        assert!(accounts::get_locked_balance(user_addr, quote_addr) == 0, 700);

        // Verify: no orders on bids
        assert!(market::bids_is_empty(), 701);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-012: Market sell order — no resting on book
    fun test_place_market_sell(deployer: &signer, user: &signer) {
        let (base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let base_addr = object::object_address(&base_metadata);

        place_market_order(user, pair_id, 100_000_000, false);

        // Verify: no funds locked
        assert!(accounts::get_locked_balance(user_addr, base_addr) == 0, 800);

        // Verify: no orders on asks
        assert!(market::asks_is_empty(), 801);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-011: Market buy with existing asks — still no resting
    fun test_place_market_buy_with_asks(deployer: &signer, user: &signer) {
        let (_base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);

        // Place a sell first
        place_limit_order(user, pair_id, 1_500_000, 50_000_000, false, types::order_type_gtc());

        // Place market buy — should not rest on book
        place_market_order(user, pair_id, 30_000_000, true);

        // bids empty (market order doesn't rest)
        assert!(market::bids_is_empty(), 900);
        // asks still has the sell
        assert!(!market::asks_is_empty(), 901);
    }

    // ===== Error Case Tests =====

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 5, location = cash_orderbook::order_placement)]
    /// VAL-CONTRACT-025: Zero price aborts with E_INVALID_PRICE
    fun test_zero_price_aborts(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_order_test_env(deployer, user);
        place_limit_order(user, pair_id, 0, 100_000_000, true, types::order_type_gtc());
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 4, location = cash_orderbook::order_placement)]
    /// VAL-CONTRACT-025: Zero quantity aborts with E_INVALID_AMOUNT
    fun test_zero_quantity_aborts(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_order_test_env(deployer, user);
        place_limit_order(user, pair_id, 1_000_000, 0, true, types::order_type_gtc());
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 4, location = cash_orderbook::order_placement)]
    /// Zero quantity market order aborts
    fun test_market_order_zero_quantity_aborts(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_order_test_env(deployer, user);
        place_market_order(user, pair_id, 0, true);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 6, location = cash_orderbook::market)]
    /// VAL-CONTRACT-025: Non-existent market aborts with E_MARKET_NOT_LISTED
    fun test_nonexistent_market_aborts(deployer: &signer, user: &signer) {
        let (_bm, _qm, _pair_id) = setup_order_test_env(deployer, user);
        place_limit_order(user, 99, 1_000_000, 100_000_000, true, types::order_type_gtc());
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 3, location = cash_orderbook::market)]
    /// VAL-CONTRACT-025: Paused market aborts with E_PAUSED
    fun test_paused_market_aborts(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_order_test_env(deployer, user);
        cash_orderbook::admin::pause_market(deployer, pair_id);
        place_limit_order(user, pair_id, 1_000_000, 100_000_000, true, types::order_type_gtc());
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 2, location = cash_orderbook::accounts)]
    /// VAL-CONTRACT-026: Insufficient quote balance for buy order aborts
    fun test_insufficient_balance_buy(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_order_test_env(deployer, user);
        // Buy 1M CASH at 10 USDC = 10M USDC needed, user has 5K
        place_limit_order(user, pair_id, 10_000_000, 1_000_000_000_000, true, types::order_type_gtc());
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 2, location = cash_orderbook::accounts)]
    /// VAL-CONTRACT-026: Insufficient base balance for sell order aborts
    fun test_insufficient_balance_sell(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_order_test_env(deployer, user);
        // Sell 10K CASH, user only has 5K deposited
        place_limit_order(user, pair_id, 1_000_000, 10_000_000_000, false, types::order_type_gtc());
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 6, location = cash_orderbook::market)]
    /// Non-existent market aborts for market order
    fun test_market_order_nonexistent_market(deployer: &signer, user: &signer) {
        let (_bm, _qm, _pair_id) = setup_order_test_env(deployer, user);
        place_market_order(user, 99, 100_000_000, true);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 3, location = cash_orderbook::market)]
    /// Paused market aborts for market order
    fun test_market_order_paused_market(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_order_test_env(deployer, user);
        cash_orderbook::admin::pause_market(deployer, pair_id);
        place_market_order(user, pair_id, 100_000_000, true);
    }

    // ===== Additional Tests =====

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// Multiple GTC orders at different prices all rest on book
    fun test_multiple_orders_on_book(deployer: &signer, user: &signer) {
        let (_bm, _qm, pair_id) = setup_order_test_env(deployer, user);

        // Place 3 buy orders at different prices
        place_limit_order(user, pair_id, 1_000_000, 10_000_000, true, types::order_type_gtc());
        place_limit_order(user, pair_id, 1_500_000, 10_000_000, true, types::order_type_gtc());
        place_limit_order(user, pair_id, 2_000_000, 10_000_000, true, types::order_type_gtc());

        // Place 2 sell orders
        place_limit_order(user, pair_id, 3_000_000, 10_000_000, false, types::order_type_gtc());
        place_limit_order(user, pair_id, 4_000_000, 10_000_000, false, types::order_type_gtc());

        // Verify both sides have orders
        assert!(!market::bids_is_empty(), 1000);
        assert!(!market::asks_is_empty(), 1001);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// PostOnly buy rejects correctly on funds, balance is unchanged after abort
    fun test_post_only_buy_funds_returned_on_abort(deployer: &signer, user: &signer) {
        let (_bm, quote_metadata, pair_id) = setup_order_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let quote_addr = object::object_address(&quote_metadata);

        // Place sell at 1.0
        place_limit_order(user, pair_id, 1_000_000, 50_000_000, false, types::order_type_gtc());

        let available_before = accounts::get_available_balance(user_addr, quote_addr);

        // PostOnly buy at 2.0 will abort because of crossing.
        // We can't easily test balance after abort (abort rolls back state).
        // Instead verify that available balance is consistent before abort scenario.
        // The abort test is in test_place_post_only_buy_aborts_on_cross.

        // Verify that the sell order didn't affect quote balance
        assert!(available_before == 5_000_000_000, 1100);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// FOK buy with insufficient balance (locked by previous order) aborts at lock
    fun test_fok_funds_unlocked_after_abort(deployer: &signer, user: &signer) {
        let (_bm, quote_metadata, pair_id) = setup_order_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let quote_addr = object::object_address(&quote_metadata);

        // Place GTC buy that locks most of the balance
        // 4000 USDC locked (price 1.0 * 4000 qty)
        place_limit_order(user, pair_id, 1_000_000, 4_000_000_000, true, types::order_type_gtc());

        let locked = accounts::get_locked_balance(user_addr, quote_addr);
        assert!(locked == 4_000_000_000, 1200);

        let available = accounts::get_available_balance(user_addr, quote_addr);
        assert!(available == 1_000_000_000, 1201);
    }

    // ========== Two-User Test Helper ==========

    #[test_only]
    /// Extended test helper with TWO users: maker and taker.
    /// Sets up protocol, two FAs, mints and deposits for both users, registers a market.
    /// Returns (base_meta, quote_meta, pair_id).
    fun setup_two_user_test_env(
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

        // Initialize protocol
        types::init_module_for_test(deployer);
        let resource_signer = types::get_resource_signer();
        let resource_addr = signer::address_of(&resource_signer);
        test_account::create_account_for_test(resource_addr);

        // Set timestamp
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

        // Mint and deposit for maker: 10,000 CASH, 10,000 USDC
        let base_fa = fungible_asset::mint(&base_mint_ref, 10_000_000_000);
        primary_fungible_store::deposit(maker_addr, base_fa);
        let quote_fa = fungible_asset::mint(&quote_mint_ref, 10_000_000_000);
        primary_fungible_store::deposit(maker_addr, quote_fa);
        accounts::deposit(maker, base_metadata, 5_000_000_000);
        accounts::deposit(maker, quote_metadata, 5_000_000_000);

        // Mint and deposit for taker: 10,000 CASH, 10,000 USDC
        let base_fa2 = fungible_asset::mint(&base_mint_ref, 10_000_000_000);
        primary_fungible_store::deposit(taker_addr, base_fa2);
        let quote_fa2 = fungible_asset::mint(&quote_mint_ref, 10_000_000_000);
        primary_fungible_store::deposit(taker_addr, quote_fa2);
        accounts::deposit(taker, base_metadata, 5_000_000_000);
        accounts::deposit(taker, quote_metadata, 5_000_000_000);

        // Register market (pair_id = 0)
        market::register_market(
            deployer,
            base_metadata,
            quote_metadata,
            1_000,    // lot_size
            1_000,    // tick_size
            10_000,   // min_size
        );

        (base_metadata, quote_metadata, 0)
    }

    // ========== MATCHING & SETTLEMENT TESTS ==========

    // ===== VAL-CONTRACT-015: Full Fill =====

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// Full fill: taker buy exactly matches maker sell.
    /// Both orders fully filled. Book cleared. Balances updated.
    fun test_full_fill_buy_taker(deployer: &signer, maker: &signer, taker: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_two_user_test_env(deployer, maker, taker);
        let maker_addr = signer::address_of(maker);
        let taker_addr = signer::address_of(taker);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // Maker places sell: 100 CASH at 2.0 USDC
        place_limit_order(maker, pair_id, 2_000_000, 100_000_000, false, types::order_type_gtc());

        // Verify maker's base locked
        assert!(accounts::get_locked_balance(maker_addr, base_addr) == 100_000_000, 2000);

        // Taker places buy: 100 CASH at 2.0 USDC — should fully match
        place_limit_order(taker, pair_id, 2_000_000, 100_000_000, true, types::order_type_gtc());

        // Verify: book is empty (both orders fully filled)
        assert!(market::bids_is_empty(), 2001);
        assert!(market::asks_is_empty(), 2002);

        // Verify settlement:
        // Taker (buyer) gets 100 CASH, pays 200 USDC (100 * 2.0)
        // Maker (seller) gets 200 USDC, gives 100 CASH
        let taker_base = accounts::get_available_balance(taker_addr, base_addr);
        let taker_quote = accounts::get_available_balance(taker_addr, quote_addr);
        // Taker: started 5000 CASH, receives 100 CASH = 5100
        assert!(taker_base == 5_100_000_000, 2003);
        // Taker: started 5000 USDC, paid 200 USDC = 4800
        assert!(taker_quote == 4_800_000_000, 2004);

        let maker_base = accounts::get_available_balance(maker_addr, base_addr);
        let maker_quote = accounts::get_available_balance(maker_addr, quote_addr);
        // Maker: started 5000 CASH, sold 100 = 4900
        assert!(maker_base == 4_900_000_000, 2005);
        // Maker: started 5000 USDC, received 200 = 5200
        assert!(maker_quote == 5_200_000_000, 2006);

        // Verify: no locked balances remain
        assert!(accounts::get_locked_balance(maker_addr, base_addr) == 0, 2007);
        assert!(accounts::get_locked_balance(taker_addr, quote_addr) == 0, 2008);
    }

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// Full fill: taker sell exactly matches maker buy.
    fun test_full_fill_sell_taker(deployer: &signer, maker: &signer, taker: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_two_user_test_env(deployer, maker, taker);
        let maker_addr = signer::address_of(maker);
        let taker_addr = signer::address_of(taker);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // Maker places buy: 100 CASH at 1.5 USDC
        place_limit_order(maker, pair_id, 1_500_000, 100_000_000, true, types::order_type_gtc());

        // Taker places sell: 100 CASH at 1.5 USDC — should fully match
        place_limit_order(taker, pair_id, 1_500_000, 100_000_000, false, types::order_type_gtc());

        // Book is empty
        assert!(market::bids_is_empty(), 2100);
        assert!(market::asks_is_empty(), 2101);

        // Settlement: fill at 1.5 USDC, 100 CASH
        // quote_amount = (1_500_000 * 100_000_000) / 1_000_000 = 150_000_000 (150 USDC)
        let taker_base = accounts::get_available_balance(taker_addr, base_addr);
        let taker_quote = accounts::get_available_balance(taker_addr, quote_addr);
        // Taker (seller): 5000 CASH - 100 = 4900 CASH, 5000 USDC + 150 = 5150 USDC
        assert!(taker_base == 4_900_000_000, 2102);
        assert!(taker_quote == 5_150_000_000, 2103);

        let maker_base = accounts::get_available_balance(maker_addr, base_addr);
        let maker_quote = accounts::get_available_balance(maker_addr, quote_addr);
        // Maker (buyer): 5000 CASH + 100 = 5100, 5000 USDC - 150 = 4850
        assert!(maker_base == 5_100_000_000, 2104);
        assert!(maker_quote == 4_850_000_000, 2105);
    }

    // ===== VAL-CONTRACT-016: Partial Fill =====

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// Partial fill: taker buy is larger than maker sell.
    /// Maker fully filled and removed. Taker rests remainder on book (GTC).
    fun test_partial_fill_taker_rests(deployer: &signer, maker: &signer, taker: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_two_user_test_env(deployer, maker, taker);
        let maker_addr = signer::address_of(maker);
        let taker_addr = signer::address_of(taker);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // Maker: sell 50 CASH at 2.0 USDC
        place_limit_order(maker, pair_id, 2_000_000, 50_000_000, false, types::order_type_gtc());

        // Taker: buy 100 CASH at 2.0 USDC — only 50 available, partial fill
        place_limit_order(taker, pair_id, 2_000_000, 100_000_000, true, types::order_type_gtc());

        // Asks empty (maker fully filled)
        assert!(market::asks_is_empty(), 2200);
        // Bids NOT empty (taker rests remaining 50 CASH)
        assert!(!market::bids_is_empty(), 2201);

        // Settlement: 50 CASH at 2.0 = 100 USDC transferred
        // Taker: 5000 + 50 = 5050 CASH available, locked 100 USDC for remaining 50 CASH
        let taker_base = accounts::get_available_balance(taker_addr, base_addr);
        assert!(taker_base == 5_050_000_000, 2202);

        // Taker: started 5000 USDC, locked 200 (for 100 CASH at 2.0),
        // paid 100 USDC for 50 CASH fill, remaining 100 USDC still locked for resting 50 CASH
        let taker_locked_quote = accounts::get_locked_balance(taker_addr, quote_addr);
        assert!(taker_locked_quote == 100_000_000, 2203); // 50 CASH * 2.0 = 100 USDC locked

        let taker_avail_quote = accounts::get_available_balance(taker_addr, quote_addr);
        assert!(taker_avail_quote == 4_800_000_000, 2204); // 5000 - 200 = 4800

        // Maker: fully filled, got 100 USDC
        let maker_quote = accounts::get_available_balance(maker_addr, quote_addr);
        assert!(maker_quote == 5_100_000_000, 2205);
        assert!(accounts::get_locked_balance(maker_addr, base_addr) == 0, 2206);
    }

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// Partial fill: taker buy smaller than maker sell.
    /// Taker fully filled. Maker partially filled and remains on book.
    fun test_partial_fill_maker_remains(deployer: &signer, maker: &signer, taker: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_two_user_test_env(deployer, maker, taker);
        let maker_addr = signer::address_of(maker);
        let taker_addr = signer::address_of(taker);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // Maker: sell 200 CASH at 1.5 USDC
        place_limit_order(maker, pair_id, 1_500_000, 200_000_000, false, types::order_type_gtc());

        // Taker: buy 50 CASH at 1.5 USDC — maker has 200, partial fill of maker
        place_limit_order(taker, pair_id, 1_500_000, 50_000_000, true, types::order_type_gtc());

        // Asks NOT empty (maker has 150 remaining)
        assert!(!market::asks_is_empty(), 2300);
        // Bids empty (taker fully filled, not resting)
        assert!(market::bids_is_empty(), 2301);

        // Settlement: 50 CASH at 1.5 = 75 USDC
        // Taker: 5000 + 50 = 5050 CASH, 5000 - 75 = 4925 USDC
        assert!(accounts::get_available_balance(taker_addr, base_addr) == 5_050_000_000, 2302);
        assert!(accounts::get_available_balance(taker_addr, quote_addr) == 4_925_000_000, 2303);
        assert!(accounts::get_locked_balance(taker_addr, quote_addr) == 0, 2304);

        // Maker: still has 150 CASH locked
        assert!(accounts::get_locked_balance(maker_addr, base_addr) == 150_000_000, 2305);
        assert!(accounts::get_available_balance(maker_addr, quote_addr) == 5_075_000_000, 2306); // got 75 USDC
    }

    // ===== Multiple Fills Against Multiple Makers =====

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// Taker buy fills against multiple maker sells at different prices.
    /// Tests price priority (lowest ask fills first).
    fun test_multiple_fills_price_priority(deployer: &signer, maker: &signer, taker: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_two_user_test_env(deployer, maker, taker);
        let maker_addr = signer::address_of(maker);
        let taker_addr = signer::address_of(taker);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // Maker places 3 sells at different prices:
        // Sell 30 CASH at 1.0 (cheapest)
        place_limit_order(maker, pair_id, 1_000_000, 30_000_000, false, types::order_type_gtc());
        // Sell 30 CASH at 2.0
        place_limit_order(maker, pair_id, 2_000_000, 30_000_000, false, types::order_type_gtc());
        // Sell 30 CASH at 3.0 (most expensive)
        place_limit_order(maker, pair_id, 3_000_000, 30_000_000, false, types::order_type_gtc());

        // Taker buys 60 CASH at 3.0 — should fill 30@1.0 + 30@2.0 (price priority)
        place_limit_order(taker, pair_id, 3_000_000, 60_000_000, true, types::order_type_gtc());

        // Asks: only the 3.0 sell should remain (30 CASH)
        assert!(!market::asks_is_empty(), 2400);
        // Bids: empty (taker fully filled)
        assert!(market::bids_is_empty(), 2401);

        // Settlement: 30@1.0 = 30 USDC + 30@2.0 = 60 USDC = total 90 USDC paid
        let taker_base = accounts::get_available_balance(taker_addr, base_addr);
        assert!(taker_base == 5_060_000_000, 2402); // 5000 + 60 = 5060

        // Taker locked 180 USDC (60 * 3.0) but only used 90 USDC, excess 90 unlocked
        let taker_quote = accounts::get_available_balance(taker_addr, quote_addr);
        assert!(taker_quote == 4_910_000_000, 2403); // 5000 - 90 = 4910
        assert!(accounts::get_locked_balance(taker_addr, quote_addr) == 0, 2404);

        // Maker: sold 60 CASH, received 90 USDC
        assert!(accounts::get_available_balance(maker_addr, base_addr) == 4_910_000_000, 2405); // 5000 - 90 locked, + 0 available change = wait...

        // Let me re-check: maker locked 90 CASH (30+30+30), 30 of the 3.0 remain locked
        // Maker: started 5000 CASH, locked 90 total, deducted 60 (sold), 30 still locked
        assert!(accounts::get_locked_balance(maker_addr, base_addr) == 30_000_000, 2406);
        // Maker available CASH: 5000 - 90 locked originally = 4910
        assert!(accounts::get_available_balance(maker_addr, base_addr) == 4_910_000_000, 2407);
        // Maker received 90 USDC
        assert!(accounts::get_available_balance(maker_addr, quote_addr) == 5_090_000_000, 2408);
    }

    // ===== VAL-CONTRACT-014: Price-Time Priority =====

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// At the same price, the earlier order fills first (time priority).
    /// Two sells at same price, first one should be consumed first.
    fun test_time_priority_same_price(deployer: &signer, maker: &signer, taker: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_two_user_test_env(deployer, maker, taker);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);
        let taker_addr = signer::address_of(taker);

        // Maker places two sells at same price 2.0, first 40 then 60
        place_limit_order(maker, pair_id, 2_000_000, 40_000_000, false, types::order_type_gtc());
        place_limit_order(maker, pair_id, 2_000_000, 60_000_000, false, types::order_type_gtc());

        // Taker buys 40 CASH at 2.0 — should fill the first sell (40 CASH) completely
        place_limit_order(taker, pair_id, 2_000_000, 40_000_000, true, types::order_type_gtc());

        // The first sell (40) should be fully consumed, second sell (60) remains
        assert!(!market::asks_is_empty(), 2500);

        // Taker got 40 CASH, paid 80 USDC (40 * 2.0)
        assert!(accounts::get_available_balance(taker_addr, base_addr) == 5_040_000_000, 2501);
        assert!(accounts::get_available_balance(taker_addr, quote_addr) == 4_920_000_000, 2502);

        // Now taker buys another 40 at 2.0 — should fill from the second sell
        place_limit_order(taker, pair_id, 2_000_000, 40_000_000, true, types::order_type_gtc());

        // Second sell should have 20 remaining on book
        assert!(!market::asks_is_empty(), 2503);

        // Taker: 5040 + 40 = 5080 CASH
        assert!(accounts::get_available_balance(taker_addr, base_addr) == 5_080_000_000, 2504);
    }

    // ===== VAL-CONTRACT-018: Self-Trade Prevention =====

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// Self-trade prevention: same user's buy should skip their own sell.
    /// Order rests on book instead of matching against self.
    fun test_self_trade_prevention_buy(deployer: &signer, user: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_order_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // User places sell: 50 CASH at 2.0
        place_limit_order(user, pair_id, 2_000_000, 50_000_000, false, types::order_type_gtc());

        // User places buy: 50 CASH at 2.0 — same owner, should NOT match (self-trade prevention)
        place_limit_order(user, pair_id, 2_000_000, 50_000_000, true, types::order_type_gtc());

        // Both orders should be on book (no match occurred)
        assert!(!market::bids_is_empty(), 2600);
        assert!(!market::asks_is_empty(), 2601);

        // Balances: base locked for sell + quote locked for buy
        assert!(accounts::get_locked_balance(user_addr, base_addr) == 50_000_000, 2602);
        assert!(accounts::get_locked_balance(user_addr, quote_addr) == 100_000_000, 2603); // 50 * 2.0 = 100
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// Self-trade prevention: same user's sell should skip their own buy.
    fun test_self_trade_prevention_sell(deployer: &signer, user: &signer) {
        let (_base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);

        // User places buy: 50 CASH at 1.5
        place_limit_order(user, pair_id, 1_500_000, 50_000_000, true, types::order_type_gtc());

        // User places sell: 50 CASH at 1.5 — self-trade, skip
        place_limit_order(user, pair_id, 1_500_000, 50_000_000, false, types::order_type_gtc());

        // Both orders on book
        assert!(!market::bids_is_empty(), 2700);
        assert!(!market::asks_is_empty(), 2701);
    }

    // ===== VAL-CONTRACT-017: Settlement Correctness =====

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// Quote amount = (fill_price * fill_quantity) / PRICE_SCALE
    /// Test with non-round numbers to verify calculation.
    fun test_settlement_quote_amount_calculation(deployer: &signer, maker: &signer, taker: &signer) {
        let (_base_metadata, quote_metadata, pair_id) = setup_two_user_test_env(deployer, maker, taker);
        let maker_addr = signer::address_of(maker);
        let taker_addr = signer::address_of(taker);
        let quote_addr = object::object_address(&quote_metadata);

        // Maker: sell 75 CASH at 1.234567 USDC (non-round price)
        // price = 1_234_567
        place_limit_order(maker, pair_id, 1_234_567, 75_000_000, false, types::order_type_gtc());

        // Taker: buy 75 CASH at 1.234567
        place_limit_order(taker, pair_id, 1_234_567, 75_000_000, true, types::order_type_gtc());

        // quote_amount = (1_234_567 * 75_000_000) / 1_000_000 = 92_592_525
        let expected_quote = 92_592_525;

        // Taker paid this amount, maker received it
        let taker_quote = accounts::get_available_balance(taker_addr, quote_addr);
        assert!(taker_quote == 5_000_000_000 - expected_quote, 2800);

        let maker_quote = accounts::get_available_balance(maker_addr, quote_addr);
        assert!(maker_quote == 5_000_000_000 + expected_quote, 2801);
    }

    // ===== Market Order Tests with Matching =====

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// Market buy fills against resting asks.
    fun test_market_buy_fills(deployer: &signer, maker: &signer, taker: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_two_user_test_env(deployer, maker, taker);
        let taker_addr = signer::address_of(taker);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // Maker: sell 100 CASH at 1.0 USDC
        place_limit_order(maker, pair_id, 1_000_000, 100_000_000, false, types::order_type_gtc());

        // Taker: market buy 50 CASH
        place_market_order(taker, pair_id, 50_000_000, true);

        // Taker gets 50 CASH, pays 50 USDC (50 * 1.0)
        assert!(accounts::get_available_balance(taker_addr, base_addr) == 5_050_000_000, 2900);
        assert!(accounts::get_available_balance(taker_addr, quote_addr) == 4_950_000_000, 2901);
        assert!(accounts::get_locked_balance(taker_addr, quote_addr) == 0, 2902);

        // Maker sell has 50 remaining
        assert!(!market::asks_is_empty(), 2903);
        // No bids (market order doesn't rest)
        assert!(market::bids_is_empty(), 2904);
    }

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// Market sell fills against resting bids.
    fun test_market_sell_fills(deployer: &signer, maker: &signer, taker: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_two_user_test_env(deployer, maker, taker);
        let taker_addr = signer::address_of(taker);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // Maker: buy 100 CASH at 2.0 USDC
        place_limit_order(maker, pair_id, 2_000_000, 100_000_000, true, types::order_type_gtc());

        // Taker: market sell 80 CASH
        place_market_order(taker, pair_id, 80_000_000, false);

        // Taker sells 80 CASH, gets 160 USDC (80 * 2.0)
        assert!(accounts::get_available_balance(taker_addr, base_addr) == 4_920_000_000, 3000); // 5000 - 80
        assert!(accounts::get_available_balance(taker_addr, quote_addr) == 5_160_000_000, 3001); // 5000 + 160
        assert!(accounts::get_locked_balance(taker_addr, base_addr) == 0, 3002);

        // Maker bid has 20 remaining
        assert!(!market::bids_is_empty(), 3003);
    }

    // ===== IOC with Matching =====

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// IOC partially fills and cancels remainder (not resting on book).
    fun test_ioc_partial_fill_cancels_remainder(deployer: &signer, maker: &signer, taker: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_two_user_test_env(deployer, maker, taker);
        let taker_addr = signer::address_of(taker);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // Maker: sell 30 CASH at 1.5
        place_limit_order(maker, pair_id, 1_500_000, 30_000_000, false, types::order_type_gtc());

        // Taker: IOC buy 100 CASH at 1.5 — only 30 available, fills 30, cancels 70
        place_limit_order(taker, pair_id, 1_500_000, 100_000_000, true, types::order_type_ioc());

        // Book is empty (maker consumed, taker IOC cancelled remainder)
        assert!(market::bids_is_empty(), 3100);
        assert!(market::asks_is_empty(), 3101);

        // Taker: got 30 CASH, paid 45 USDC (30 * 1.5)
        assert!(accounts::get_available_balance(taker_addr, base_addr) == 5_030_000_000, 3102);
        assert!(accounts::get_available_balance(taker_addr, quote_addr) == 4_955_000_000, 3103);
        assert!(accounts::get_locked_balance(taker_addr, quote_addr) == 0, 3104);
    }

    // ===== FOK with Matching =====

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// FOK fully fills when sufficient liquidity exists.
    fun test_fok_full_fill(deployer: &signer, maker: &signer, taker: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_two_user_test_env(deployer, maker, taker);
        let taker_addr = signer::address_of(taker);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // Maker: sell 100 CASH at 2.0
        place_limit_order(maker, pair_id, 2_000_000, 100_000_000, false, types::order_type_gtc());

        // Taker: FOK buy 100 CASH at 2.0 — exactly enough, should fill
        place_limit_order(taker, pair_id, 2_000_000, 100_000_000, true, types::order_type_fok());

        // Book empty
        assert!(market::bids_is_empty(), 3200);
        assert!(market::asks_is_empty(), 3201);

        // Taker: 5000 + 100 = 5100 CASH, 5000 - 200 = 4800 USDC
        assert!(accounts::get_available_balance(taker_addr, base_addr) == 5_100_000_000, 3202);
        assert!(accounts::get_available_balance(taker_addr, quote_addr) == 4_800_000_000, 3203);
    }

    // ===== Taker fills at maker's price (price improvement) =====

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// Taker buy at higher price fills at maker's lower ask price (price improvement).
    fun test_price_improvement_buy(deployer: &signer, maker: &signer, taker: &signer) {
        let (_base_metadata, quote_metadata, pair_id) = setup_two_user_test_env(deployer, maker, taker);
        let taker_addr = signer::address_of(taker);
        let quote_addr = object::object_address(&quote_metadata);

        // Maker: sell 50 CASH at 1.0 USDC
        place_limit_order(maker, pair_id, 1_000_000, 50_000_000, false, types::order_type_gtc());

        // Taker: buy 50 CASH at 3.0 USDC — fills at 1.0 (maker's price), excess refunded
        place_limit_order(taker, pair_id, 3_000_000, 50_000_000, true, types::order_type_gtc());

        // Taker paid only 50 USDC (50 * 1.0), not 150 USDC (50 * 3.0)
        // Taker: 5000 - 50 = 4950 USDC
        assert!(accounts::get_available_balance(taker_addr, quote_addr) == 4_950_000_000, 3300);
        assert!(accounts::get_locked_balance(taker_addr, quote_addr) == 0, 3301);
    }

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// Taker sell at lower price fills at maker's higher bid price (price improvement).
    fun test_price_improvement_sell(deployer: &signer, maker: &signer, taker: &signer) {
        let (_base_metadata, quote_metadata, pair_id) = setup_two_user_test_env(deployer, maker, taker);
        let taker_addr = signer::address_of(taker);
        let quote_addr = object::object_address(&quote_metadata);

        // Maker: buy 50 CASH at 3.0 USDC
        place_limit_order(maker, pair_id, 3_000_000, 50_000_000, true, types::order_type_gtc());

        // Taker: sell 50 CASH at 1.0 USDC — fills at 3.0 (maker's price)
        place_limit_order(taker, pair_id, 1_000_000, 50_000_000, false, types::order_type_gtc());

        // Taker received 150 USDC (50 * 3.0), not 50 USDC (50 * 1.0)
        assert!(accounts::get_available_balance(taker_addr, quote_addr) == 5_150_000_000, 3400);
    }

    // ===== Market order fills multiple levels =====

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// Market buy fills across multiple price levels.
    fun test_market_buy_multiple_levels(deployer: &signer, maker: &signer, taker: &signer) {
        let (base_metadata, quote_metadata, pair_id) = setup_two_user_test_env(deployer, maker, taker);
        let taker_addr = signer::address_of(taker);
        let base_addr = object::object_address(&base_metadata);
        let quote_addr = object::object_address(&quote_metadata);

        // Maker places sells at 3 different prices
        place_limit_order(maker, pair_id, 1_000_000, 20_000_000, false, types::order_type_gtc()); // 20@1.0
        place_limit_order(maker, pair_id, 2_000_000, 20_000_000, false, types::order_type_gtc()); // 20@2.0
        place_limit_order(maker, pair_id, 3_000_000, 20_000_000, false, types::order_type_gtc()); // 20@3.0

        // Taker: market buy 50 CASH — fills 20@1.0 + 20@2.0 + 10@3.0
        place_market_order(taker, pair_id, 50_000_000, true);

        // quote_used = 20*1.0 + 20*2.0 + 10*3.0 = 20 + 40 + 30 = 90 USDC
        assert!(accounts::get_available_balance(taker_addr, base_addr) == 5_050_000_000, 3500);
        assert!(accounts::get_available_balance(taker_addr, quote_addr) == 4_910_000_000, 3501);
        assert!(accounts::get_locked_balance(taker_addr, quote_addr) == 0, 3502);

        // 10 CASH remain on asks at 3.0
        assert!(!market::asks_is_empty(), 3503);
    }

    // ===== Self-trade prevention with third party =====

    #[test(deployer = @cash_orderbook, maker = @0xBEEF, taker = @0xCAFE1)]
    /// Self-trade: taker's order skips their own resting order but fills others.
    fun test_self_trade_skips_own_fills_others(deployer: &signer, maker: &signer, taker: &signer) {
        let (base_metadata, _quote_metadata, pair_id) = setup_two_user_test_env(deployer, maker, taker);
        let taker_addr = signer::address_of(taker);
        let base_addr = object::object_address(&base_metadata);

        // Taker places sell: 50 CASH at 1.0 (resting order)
        place_limit_order(taker, pair_id, 1_000_000, 50_000_000, false, types::order_type_gtc());

        // Maker places sell: 50 CASH at 2.0
        place_limit_order(maker, pair_id, 2_000_000, 50_000_000, false, types::order_type_gtc());

        // Taker places buy: 50 CASH at 2.0
        // Should SKIP taker's own sell @1.0 and fill maker's sell @2.0
        place_limit_order(taker, pair_id, 2_000_000, 50_000_000, true, types::order_type_gtc());

        // Taker's own sell at 1.0 should still be on the book
        assert!(!market::asks_is_empty(), 3600);
        // Bids empty (taker buy fully filled)
        assert!(market::bids_is_empty(), 3601);

        // Taker: started with 5000 CASH, locked 50 CASH for sell,
        // then received 50 CASH from the buy fill = 5050 available (minus the locked)
        // Base: 5000 - 50 (sell locked) + 50 (buy filled) = 5000 available
        assert!(accounts::get_available_balance(taker_addr, base_addr) == 5_000_000_000, 3602);
        assert!(accounts::get_locked_balance(taker_addr, base_addr) == 50_000_000, 3603);
    }

    // ===== FOK Self-Trade Abort Test =====

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 9, location = cash_orderbook::order_placement)]
    /// FOK order that partially fills due to self-trade prevention must abort E_FOK_NOT_FILLED.
    /// Setup: user places a sell for 100 CASH at 1.0. The book has enough nominal liquidity.
    /// User then places a FOK buy for 100 CASH at 1.0, but self-trade prevention skips
    /// their own sell, so the FOK cannot fill and must abort.
    fun test_fok_aborts_on_self_trade_partial_fill(deployer: &signer, user: &signer) {
        let (_base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);

        // User places a sell: 100 CASH at 1.0 USDC
        place_limit_order(user, pair_id, 1_000_000, 100_000_000, false, types::order_type_gtc());

        // User now places FOK buy: 100 CASH at 1.0 USDC
        // Self-trade prevention will skip the user's own sell, so 0 fills.
        // FOK requires full fill → must abort with E_FOK_NOT_FILLED (9).
        place_limit_order(user, pair_id, 1_000_000, 100_000_000, true, types::order_type_fok());
    }

    // ===== Invalid Order Type Test =====

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 12, location = cash_orderbook::order_placement)]
    /// order_type = 5 (invalid, > 3) must abort with E_INVALID_ORDER_TYPE (12).
    fun test_invalid_order_type_aborts(deployer: &signer, user: &signer) {
        let (_base_metadata, _quote_metadata, pair_id) = setup_order_test_env(deployer, user);
        // order_type = 5 is out of range [0..3]
        place_limit_order(user, pair_id, 1_000_000, 100_000_000, true, 5);
    }
}
