/// Market registration module for the Cash Orderbook.
/// Handles creation of new trading markets (pairs) and the OrderBook resource.
/// Markets are stored in a MarketRegistry resource at the resource account address.
module cash_orderbook::market {
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::object::{Self, Object};
    use aptos_framework::fungible_asset::Metadata;
    use aptos_std::table::{Self, Table};
    use aptos_std::big_ordered_map::{Self, BigOrderedMap};
    use cash_orderbook::types::{Self, Market, Order, OrderKey};

    // ========== Error Codes ==========
    const E_UNAUTHORIZED: u64 = 1;
    const E_PAUSED: u64 = 3;
    const E_INVALID_AMOUNT: u64 = 4;
    const E_MARKET_NOT_LISTED: u64 = 6;
    const E_ALREADY_EXISTS: u64 = 11;
    const E_INVALID_DECIMALS: u64 = 13;

    // ========== Resources ==========

    /// Registry of all markets, stored at the resource account address.
    /// Maps pair_id to Market struct.
    struct MarketRegistry has key {
        /// Mapping: pair_id -> Market
        markets: Table<u64, Market>,
    }

    /// The orderbook for a specific market.
    /// Contains separate BigOrderedMaps for bids and asks.
    /// Stored inside OrderBookRegistry (not as a standalone resource).
    struct OrderBook has store {
        /// The pair_id this orderbook belongs to
        pair_id: u64,
        /// Bid orders (buy side), keyed by OrderKey.
        /// For bids, we want descending price order — achieved by inverting the price
        /// in the key so BigOrderedMap's ascending order gives us descending prices.
        bids: BigOrderedMap<OrderKey, Order>,
        /// Ask orders (sell side), keyed by OrderKey.
        /// Ascending price order (natural BigOrderedMap ordering).
        asks: BigOrderedMap<OrderKey, Order>,
    }

    /// Registry of all orderbooks, stored at the resource account address.
    /// Maps pair_id to its dedicated OrderBook.
    struct OrderBookRegistry has key {
        /// Mapping: pair_id -> OrderBook
        books: Table<u64, OrderBook>,
    }

    // ========== Events ==========

    #[event]
    struct MarketCreated has drop, store {
        /// The assigned pair ID
        pair_id: u64,
        /// Base asset metadata address
        base_asset: address,
        /// Quote asset metadata address
        quote_asset: address,
        /// Lot size (minimum order size increment)
        lot_size: u64,
        /// Tick size (minimum price increment)
        tick_size: u64,
        /// Minimum order size
        min_size: u64,
        /// Quote asset decimal precision
        quote_decimals: u8,
    }

    // ========== Entry Functions ==========

    /// Register a new trading market. Only the protocol admin can call this.
    ///
    /// Creates a Market entry in the MarketRegistry and an empty OrderBook.
    /// Assigns an auto-incrementing pair_id.
    ///
    /// Aborts with E_UNAUTHORIZED if caller is not admin.
    /// Aborts with E_INVALID_AMOUNT if lot_size, tick_size, or min_size is 0.
    public entry fun register_market(
        admin: &signer,
        base_asset: Object<Metadata>,
        quote_asset: Object<Metadata>,
        lot_size: u64,
        tick_size: u64,
        min_size: u64,
        quote_decimals: u8,
    ) acquires MarketRegistry, OrderBookRegistry {
        // Verify admin
        types::assert_admin(admin);

        // Validate parameters
        assert!(lot_size > 0, E_INVALID_AMOUNT);
        assert!(tick_size > 0, E_INVALID_AMOUNT);
        assert!(min_size > 0, E_INVALID_AMOUNT);
        // quote_decimals must be between 1 and 18 (inclusive)
        assert!(quote_decimals >= 1 && quote_decimals <= 18, E_INVALID_DECIMALS);

        let base_asset_addr = object::object_address(&base_asset);
        let quote_asset_addr = object::object_address(&quote_asset);

        // Get next pair ID
        let pair_id = types::next_pair_id();

        // Create Market struct
        let market = types::new_market(
            pair_id,
            base_asset_addr,
            quote_asset_addr,
            lot_size,
            tick_size,
            min_size,
            quote_decimals,
        );

        // Get or initialize the MarketRegistry and OrderBookRegistry
        let resource_addr = types::get_resource_account_address();
        if (!exists<MarketRegistry>(resource_addr)) {
            let resource_signer = types::get_resource_signer();
            move_to(&resource_signer, MarketRegistry {
                markets: table::new(),
            });
        };
        if (!exists<OrderBookRegistry>(resource_addr)) {
            let resource_signer = types::get_resource_signer();
            move_to(&resource_signer, OrderBookRegistry {
                books: table::new(),
            });
        };

        // Add market to registry
        let registry = borrow_global_mut<MarketRegistry>(resource_addr);
        table::add(&mut registry.markets, pair_id, market);

        // Create a NEW empty OrderBook for this market and add to the book registry
        let ob_registry = borrow_global_mut<OrderBookRegistry>(resource_addr);
        table::add(&mut ob_registry.books, pair_id, OrderBook {
            pair_id,
            bids: big_ordered_map::new(),
            asks: big_ordered_map::new(),
        });

        // Emit MarketCreated event
        event::emit(MarketCreated {
            pair_id,
            base_asset: base_asset_addr,
            quote_asset: quote_asset_addr,
            lot_size,
            tick_size,
            min_size,
            quote_decimals,
        });
    }

    // ========== View Functions ==========

    #[view]
    /// Check if a market exists for a given pair_id
    public fun market_exists(pair_id: u64): bool acquires MarketRegistry {
        let resource_addr = types::get_resource_account_address();
        if (!exists<MarketRegistry>(resource_addr)) return false;
        let registry = borrow_global<MarketRegistry>(resource_addr);
        table::contains(&registry.markets, pair_id)
    }

    #[view]
    /// Get market info for a given pair_id.
    /// Returns (base_asset, quote_asset, lot_size, tick_size, min_size, status, quote_decimals)
    public fun get_market_info(pair_id: u64): (address, address, u64, u64, u64, u8, u8) acquires MarketRegistry {
        let resource_addr = types::get_resource_account_address();
        assert!(exists<MarketRegistry>(resource_addr), E_MARKET_NOT_LISTED);
        let registry = borrow_global<MarketRegistry>(resource_addr);
        assert!(table::contains(&registry.markets, pair_id), E_MARKET_NOT_LISTED);
        let market = table::borrow(&registry.markets, pair_id);
        (
            types::market_base_asset(market),
            types::market_quote_asset(market),
            types::market_lot_size(market),
            types::market_tick_size(market),
            types::market_min_size(market),
            types::market_status(market),
            types::market_quote_decimals(market),
        )
    }

    #[view]
    /// Check if a market is active
    public fun is_market_active(pair_id: u64): bool acquires MarketRegistry {
        let resource_addr = types::get_resource_account_address();
        if (!exists<MarketRegistry>(resource_addr)) return false;
        let registry = borrow_global<MarketRegistry>(resource_addr);
        if (!table::contains(&registry.markets, pair_id)) return false;
        let market = table::borrow(&registry.markets, pair_id);
        types::market_is_active(market)
    }

    // ========== Friend Functions ==========

    /// Assert that a market exists and is active.
    /// Used by order placement module to validate market state.
    public(friend) fun assert_market_active(pair_id: u64) acquires MarketRegistry {
        let resource_addr = types::get_resource_account_address();
        assert!(exists<MarketRegistry>(resource_addr), E_MARKET_NOT_LISTED);
        let registry = borrow_global<MarketRegistry>(resource_addr);
        assert!(table::contains(&registry.markets, pair_id), E_MARKET_NOT_LISTED);
        let market = table::borrow(&registry.markets, pair_id);
        assert!(types::market_is_active(market), E_PAUSED);
    }

    /// Assert that a market exists (regardless of status).
    /// Used by order cancellation (cancellation works even when paused).
    public(friend) fun assert_market_exists(pair_id: u64) acquires MarketRegistry {
        let resource_addr = types::get_resource_account_address();
        assert!(exists<MarketRegistry>(resource_addr), E_MARKET_NOT_LISTED);
        let registry = borrow_global<MarketRegistry>(resource_addr);
        assert!(table::contains(&registry.markets, pair_id), E_MARKET_NOT_LISTED);
    }

    /// Set the status of a market (for admin module).
    /// Aborts with E_MARKET_NOT_LISTED if market doesn't exist.
    public(friend) fun set_market_status_by_pair_id(
        pair_id: u64,
        status: u8,
    ) acquires MarketRegistry {
        let resource_addr = types::get_resource_account_address();
        assert!(exists<MarketRegistry>(resource_addr), E_MARKET_NOT_LISTED);
        let registry = borrow_global_mut<MarketRegistry>(resource_addr);
        assert!(table::contains(&registry.markets, pair_id), E_MARKET_NOT_LISTED);
        let market = table::borrow_mut(&mut registry.markets, pair_id);
        types::set_market_status(market, status);
    }

    /// Add an order to the bids side of the order book for a specific market.
    public(friend) fun add_bid(pair_id: u64, key: OrderKey, order: Order) acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global_mut<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow_mut(&mut ob_registry.books, pair_id);
        big_ordered_map::add(&mut order_book.bids, key, order);
    }

    /// Add an order to the asks side of the order book for a specific market.
    public(friend) fun add_ask(pair_id: u64, key: OrderKey, order: Order) acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global_mut<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow_mut(&mut ob_registry.books, pair_id);
        big_ordered_map::add(&mut order_book.asks, key, order);
    }

    /// Check if the bids side is empty for a specific market.
    public(friend) fun bids_is_empty(pair_id: u64): bool acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow(&ob_registry.books, pair_id);
        big_ordered_map::is_empty(&order_book.bids)
    }

    /// Check if the asks side is empty for a specific market.
    public(friend) fun asks_is_empty(pair_id: u64): bool acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow(&ob_registry.books, pair_id);
        big_ordered_map::is_empty(&order_book.asks)
    }

    /// Get the best (highest) bid price for a specific market. Returns 0 if no bids.
    /// Bids use inverted price keys, so the begin iterator (lowest key) = highest price.
    public(friend) fun get_best_bid_price(pair_id: u64): u64 acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow(&ob_registry.books, pair_id);
        if (big_ordered_map::is_empty(&order_book.bids)) {
            return 0
        };
        let iter = big_ordered_map::internal_new_begin_iter(&order_book.bids);
        let best_bid = big_ordered_map::iter_borrow(iter, &order_book.bids);
        types::order_price(best_bid)
    }

    /// Get the best (lowest) ask price for a specific market. Returns 0 if no asks.
    public(friend) fun get_best_ask_price(pair_id: u64): u64 acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow(&ob_registry.books, pair_id);
        if (big_ordered_map::is_empty(&order_book.asks)) {
            return 0
        };
        let iter = big_ordered_map::internal_new_begin_iter(&order_book.asks);
        let best_ask = big_ordered_map::iter_borrow(iter, &order_book.asks);
        types::order_price(best_ask)
    }

    /// Calculate the total fillable quantity on the asks side at or below the given price.
    /// Used for FOK buy order validation.
    public(friend) fun get_fillable_ask_quantity(pair_id: u64, max_price: u64): u64 acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow(&ob_registry.books, pair_id);
        if (big_ordered_map::is_empty(&order_book.asks)) {
            return 0
        };
        let fillable: u64 = 0;
        let iter = big_ordered_map::internal_new_begin_iter(&order_book.asks);
        while (!big_ordered_map::iter_is_end(&iter, &order_book.asks)) {
            let ask_order = big_ordered_map::iter_borrow(iter, &order_book.asks);
            let ask_price = types::order_price(ask_order);
            if (ask_price > max_price) {
                break
            };
            fillable = fillable + types::order_remaining_quantity(ask_order);
            iter = big_ordered_map::iter_next(iter, &order_book.asks);
        };
        fillable
    }

    /// Calculate the total fillable quantity on the bids side at or above the given price.
    /// Used for FOK sell order validation.
    public(friend) fun get_fillable_bid_quantity(pair_id: u64, min_price: u64): u64 acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow(&ob_registry.books, pair_id);
        if (big_ordered_map::is_empty(&order_book.bids)) {
            return 0
        };
        let fillable: u64 = 0;
        // Bids use inverted price keys: begin iterator = highest price
        let iter = big_ordered_map::internal_new_begin_iter(&order_book.bids);
        while (!big_ordered_map::iter_is_end(&iter, &order_book.bids)) {
            let bid_order = big_ordered_map::iter_borrow(iter, &order_book.bids);
            let bid_price = types::order_price(bid_order);
            if (bid_price < min_price) {
                break
            };
            fillable = fillable + types::order_remaining_quantity(bid_order);
            iter = big_ordered_map::iter_next(iter, &order_book.bids);
        };
        fillable
    }

    // ========== Friend Declarations ==========
    friend cash_orderbook::admin;
    friend cash_orderbook::order_placement;
    friend cash_orderbook::matching;
    friend cash_orderbook::settlement;
    friend cash_orderbook::views;
    friend cash_orderbook::cancel;

    /// Get market base and quote asset addresses (friend access).
    public(friend) fun get_market_assets(pair_id: u64): (address, address) acquires MarketRegistry {
        let resource_addr = types::get_resource_account_address();
        let registry = borrow_global<MarketRegistry>(resource_addr);
        let market = table::borrow(&registry.markets, pair_id);
        (types::market_base_asset(market), types::market_quote_asset(market))
    }

    /// Remove the front (best) ask from the book for a specific market. Returns (key, order).
    /// The best ask is the one with the lowest price (begin of asks BigOrderedMap).
    public(friend) fun pop_front_ask(pair_id: u64): (OrderKey, Order) acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global_mut<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow_mut(&mut ob_registry.books, pair_id);
        big_ordered_map::pop_front(&mut order_book.asks)
    }

    /// Remove the front (best) bid from the book for a specific market. Returns (key, order).
    /// The best bid uses inverted price, so begin = highest real price.
    public(friend) fun pop_front_bid(pair_id: u64): (OrderKey, Order) acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global_mut<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow_mut(&mut ob_registry.books, pair_id);
        big_ordered_map::pop_front(&mut order_book.bids)
    }

    /// Peek at the best ask (lowest price) for a specific market without removing.
    /// Returns (price, remaining_quantity, owner) or aborts if empty.
    public(friend) fun peek_best_ask(pair_id: u64): (u64, u64, address) acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow(&ob_registry.books, pair_id);
        let iter = big_ordered_map::internal_new_begin_iter(&order_book.asks);
        let order = big_ordered_map::iter_borrow(iter, &order_book.asks);
        (types::order_price(order), types::order_remaining_quantity(order), types::order_owner(order))
    }

    /// Peek at the best bid (highest price) for a specific market without removing.
    /// Returns (price, remaining_quantity, owner) or aborts if empty.
    public(friend) fun peek_best_bid(pair_id: u64): (u64, u64, address) acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow(&ob_registry.books, pair_id);
        let iter = big_ordered_map::internal_new_begin_iter(&order_book.bids);
        let order = big_ordered_map::iter_borrow(iter, &order_book.bids);
        (types::order_price(order), types::order_remaining_quantity(order), types::order_owner(order))
    }

    /// Re-insert a partially filled ask order back to the book for a specific market.
    public(friend) fun reinsert_ask(pair_id: u64, key: OrderKey, order: Order) acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global_mut<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow_mut(&mut ob_registry.books, pair_id);
        big_ordered_map::add(&mut order_book.asks, key, order);
    }

    /// Re-insert a partially filled bid order back to the book for a specific market.
    public(friend) fun reinsert_bid(pair_id: u64, key: OrderKey, order: Order) acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global_mut<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow_mut(&mut ob_registry.books, pair_id);
        big_ordered_map::add(&mut order_book.bids, key, order);
    }

    /// Remove a specific bid from the book by key for a specific market. Returns the Order.
    public(friend) fun remove_bid(pair_id: u64, key: OrderKey): Order acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global_mut<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow_mut(&mut ob_registry.books, pair_id);
        big_ordered_map::remove(&mut order_book.bids, &key)
    }

    /// Remove a specific ask from the book by key for a specific market. Returns the Order.
    public(friend) fun remove_ask(pair_id: u64, key: OrderKey): Order acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global_mut<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow_mut(&mut ob_registry.books, pair_id);
        big_ordered_map::remove(&mut order_book.asks, &key)
    }

    /// Check if a bid exists at the given key for a specific market.
    public(friend) fun contains_bid(pair_id: u64, key: &OrderKey): bool acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow(&ob_registry.books, pair_id);
        big_ordered_map::contains(&order_book.bids, key)
    }

    /// Check if an ask exists at the given key for a specific market.
    public(friend) fun contains_ask(pair_id: u64, key: &OrderKey): bool acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow(&ob_registry.books, pair_id);
        big_ordered_map::contains(&order_book.asks, key)
    }

    /// Get all bid orders as a vector for a specific market (bids are stored with inverted price keys).
    /// Returns orders in descending price order (highest price first).
    public(friend) fun get_all_bids(pair_id: u64): vector<Order> acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow(&ob_registry.books, pair_id);
        let result = vector::empty<Order>();
        if (big_ordered_map::is_empty(&order_book.bids)) {
            return result
        };
        let iter = big_ordered_map::internal_new_begin_iter(&order_book.bids);
        while (!big_ordered_map::iter_is_end(&iter, &order_book.bids)) {
            let order = big_ordered_map::iter_borrow(iter, &order_book.bids);
            vector::push_back(&mut result, *order);
            iter = big_ordered_map::iter_next(iter, &order_book.bids);
        };
        result
    }

    /// Get all ask orders as a vector for a specific market.
    /// Returns orders in ascending price order (lowest price first).
    public(friend) fun get_all_asks(pair_id: u64): vector<Order> acquires OrderBookRegistry {
        let resource_addr = types::get_resource_account_address();
        let ob_registry = borrow_global<OrderBookRegistry>(resource_addr);
        let order_book = table::borrow(&ob_registry.books, pair_id);
        let result = vector::empty<Order>();
        if (big_ordered_map::is_empty(&order_book.asks)) {
            return result
        };
        let iter = big_ordered_map::internal_new_begin_iter(&order_book.asks);
        while (!big_ordered_map::iter_is_end(&iter, &order_book.asks)) {
            let order = big_ordered_map::iter_borrow(iter, &order_book.asks);
            vector::push_back(&mut result, *order);
            iter = big_ordered_map::iter_next(iter, &order_book.asks);
        };
        result
    }

    // ========== Test Helpers ==========

    #[test_only]
    /// Initialize market registry and orderbook registry for tests (public entry for other modules' tests)
    public fun init_market_registry_for_test() {
        let resource_addr = types::get_resource_account_address();
        if (!exists<MarketRegistry>(resource_addr)) {
            let resource_signer = types::get_resource_signer();
            move_to(&resource_signer, MarketRegistry {
                markets: table::new(),
            });
        };
        if (!exists<OrderBookRegistry>(resource_addr)) {
            let resource_signer = types::get_resource_signer();
            move_to(&resource_signer, OrderBookRegistry {
                books: table::new(),
            });
        };
    }

    // ========== Tests ==========

    #[test_only]
    use std::signer;
    #[test_only]
    use aptos_framework::account as test_account;
    #[test_only]
    use std::string;

    #[test_only]
    /// Helper: Set up the environment for market tests.
    /// Creates deployer account, initializes protocol, creates test FA metadata objects.
    /// Returns (base_metadata, quote_metadata)
    fun setup_market_test_env(
        deployer: &signer,
    ): (Object<Metadata>, Object<Metadata>) {
        let deployer_addr = signer::address_of(deployer);
        test_account::create_account_for_test(deployer_addr);

        // Initialize protocol
        types::init_module_for_test(deployer);

        // Create resource account (needed for test)
        let resource_signer = types::get_resource_signer();
        let resource_addr = signer::address_of(&resource_signer);
        test_account::create_account_for_test(resource_addr);

        // Create test base asset (CASH)
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

        // Create test quote asset (USDC)
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

        (base_metadata, quote_metadata)
    }

    #[test(deployer = @cash_orderbook)]
    /// Test successful market registration by admin
    fun test_register_market_success(deployer: &signer) acquires MarketRegistry, OrderBookRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);

        // Register a market
        register_market(
            deployer,
            base_metadata,
            quote_metadata,
            1_000,    // lot_size
            1_000,    // tick_size
            10_000,   // min_size
            6,        // quote_decimals
        );

        // Verify market exists
        assert!(market_exists(0), 100);

        // Verify market info
        let (base, quote, lot, tick, min, status, qd) = get_market_info(0);
        assert!(base == object::object_address(&base_metadata), 101);
        assert!(quote == object::object_address(&quote_metadata), 102);
        assert!(lot == 1_000, 103);
        assert!(tick == 1_000, 104);
        assert!(min == 10_000, 105);
        assert!(status == types::market_status_active(), 106);
        assert!(qd == 6, 109);

        // Verify market is active
        assert!(is_market_active(0), 107);

        // Verify OrderBookRegistry exists with this market's book
        let resource_addr = types::get_resource_account_address();
        assert!(exists<OrderBookRegistry>(resource_addr), 108);
    }

    #[test(deployer = @cash_orderbook)]
    /// Test that registering multiple markets assigns incrementing pair_ids
    fun test_register_multiple_markets(deployer: &signer) acquires MarketRegistry, OrderBookRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);

        // Register first market
        register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000, 6);

        // Register second market (same assets for simplicity — real scenario would be different pairs)
        register_market(deployer, base_metadata, quote_metadata, 2_000, 2_000, 20_000, 6);

        // Verify both markets exist with correct pair_ids
        assert!(market_exists(0), 200);
        assert!(market_exists(1), 201);

        // Verify first market params
        let (_base, _quote, lot1, _tick1, _min1, _status1, _qd1) = get_market_info(0);
        assert!(lot1 == 1_000, 202);

        // Verify second market params
        let (_base2, _quote2, lot2, _tick2, _min2, _status2, _qd2) = get_market_info(1);
        assert!(lot2 == 2_000, 203);
    }

    #[test(deployer = @cash_orderbook, non_admin = @0xBEEF)]
    #[expected_failure(abort_code = 1, location = cash_orderbook::types)] // E_UNAUTHORIZED
    /// Test that non-admin cannot register a market
    fun test_register_market_unauthorized(
        deployer: &signer,
        non_admin: &signer,
    ) acquires MarketRegistry, OrderBookRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);

        // Non-admin tries to register — should fail
        register_market(non_admin, base_metadata, quote_metadata, 1_000, 1_000, 10_000, 6);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 4, location = cash_orderbook::market)] // E_INVALID_AMOUNT
    /// Test that zero lot_size is rejected
    fun test_register_market_zero_lot_size(deployer: &signer) acquires MarketRegistry, OrderBookRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);
        register_market(deployer, base_metadata, quote_metadata, 0, 1_000, 10_000, 6);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 4, location = cash_orderbook::market)] // E_INVALID_AMOUNT
    /// Test that zero tick_size is rejected
    fun test_register_market_zero_tick_size(deployer: &signer) acquires MarketRegistry, OrderBookRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);
        register_market(deployer, base_metadata, quote_metadata, 1_000, 0, 10_000, 6);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 4, location = cash_orderbook::market)] // E_INVALID_AMOUNT
    /// Test that zero min_size is rejected
    fun test_register_market_zero_min_size(deployer: &signer) acquires MarketRegistry, OrderBookRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);
        register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 0, 6);
    }

    #[test(deployer = @cash_orderbook)]
    /// Test that non-existent market returns false for market_exists
    fun test_market_not_exists(deployer: &signer) acquires MarketRegistry {
        let (_base_metadata, _quote_metadata) = setup_market_test_env(deployer);

        // No markets registered yet
        assert!(!market_exists(0), 300);
        assert!(!is_market_active(0), 301);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 6, location = cash_orderbook::market)] // E_MARKET_NOT_LISTED
    /// Test that getting info for non-existent market aborts
    fun test_get_market_info_not_exists(deployer: &signer) acquires MarketRegistry {
        let (_base_metadata, _quote_metadata) = setup_market_test_env(deployer);
        // This should abort
        get_market_info(99);
    }

    #[test(deployer = @cash_orderbook)]
    /// Test assert_market_active with an active market
    fun test_assert_market_active_success(deployer: &signer) acquires MarketRegistry, OrderBookRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);
        register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000, 6);

        // Should not abort
        assert_market_active(0);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 6, location = cash_orderbook::market)] // E_MARKET_NOT_LISTED
    /// Test assert_market_active with non-existent market
    fun test_assert_market_active_not_listed(deployer: &signer) acquires MarketRegistry {
        let (_base_metadata, _quote_metadata) = setup_market_test_env(deployer);
        assert_market_active(99);
    }

    #[test(deployer = @cash_orderbook)]
    /// Test registering a market with 8-decimal quote asset (USD1)
    fun test_register_market_8_decimals(deployer: &signer) acquires MarketRegistry, OrderBookRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);

        register_market(
            deployer,
            base_metadata,
            quote_metadata,
            100_000,    // lot_size (larger for 8 decimals)
            100_000,    // tick_size
            1_000_000,  // min_size
            8,          // quote_decimals (USD1)
        );

        assert!(market_exists(0), 800);
        let (_base, _quote, _lot, _tick, _min, _status, qd) = get_market_info(0);
        assert!(qd == 8, 801);
    }

    #[test(deployer = @cash_orderbook)]
    /// Test registering markets with different quote decimals
    fun test_register_markets_different_decimals(deployer: &signer) acquires MarketRegistry, OrderBookRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);

        // 6-decimal market (USDC)
        register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000, 6);
        // 8-decimal market (USD1)
        register_market(deployer, base_metadata, quote_metadata, 100_000, 100_000, 1_000_000, 8);
        // 18-decimal market (edge case)
        register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000, 18);

        let (_b0, _q0, _l0, _t0, _m0, _s0, qd0) = get_market_info(0);
        let (_b1, _q1, _l1, _t1, _m1, _s1, qd1) = get_market_info(1);
        let (_b2, _q2, _l2, _t2, _m2, _s2, qd2) = get_market_info(2);

        assert!(qd0 == 6, 810);
        assert!(qd1 == 8, 811);
        assert!(qd2 == 18, 812);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 13, location = cash_orderbook::market)] // E_INVALID_DECIMALS
    /// Test that 0 decimals is rejected
    fun test_register_market_zero_decimals(deployer: &signer) acquires MarketRegistry, OrderBookRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);
        register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000, 0);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 13, location = cash_orderbook::market)] // E_INVALID_DECIMALS
    /// Test that 19 decimals is rejected (max is 18)
    fun test_register_market_19_decimals(deployer: &signer) acquires MarketRegistry, OrderBookRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);
        register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000, 19);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 13, location = cash_orderbook::market)] // E_INVALID_DECIMALS
    /// Test that 255 decimals is rejected (max u8 value)
    fun test_register_market_max_u8_decimals(deployer: &signer) acquires MarketRegistry, OrderBookRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);
        register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000, 255);
    }

    #[test(deployer = @cash_orderbook)]
    /// Test that 1 decimal is accepted (minimum valid)
    fun test_register_market_1_decimal(deployer: &signer) acquires MarketRegistry, OrderBookRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);
        register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000, 1);
        assert!(market_exists(0), 830);
        let (_b, _q, _l, _t, _m, _s, qd) = get_market_info(0);
        assert!(qd == 1, 831);
    }

    #[test_only]
    use aptos_framework::primary_fungible_store;
}
