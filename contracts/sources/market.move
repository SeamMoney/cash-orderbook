/// Market registration module for the Cash Orderbook.
/// Handles creation of new trading markets (pairs) and the OrderBook resource.
/// Markets are stored in a MarketRegistry resource at the resource account address.
module cash_orderbook::market {
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

    // ========== Resources ==========

    /// Registry of all markets, stored at the resource account address.
    /// Maps pair_id to Market struct.
    struct MarketRegistry has key {
        /// Mapping: pair_id -> Market
        markets: Table<u64, Market>,
    }

    /// The orderbook for a specific market, stored at the resource account address.
    /// Contains separate BigOrderedMaps for bids and asks.
    struct OrderBook has key {
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
    ) acquires MarketRegistry {
        // Verify admin
        types::assert_admin(admin);

        // Validate parameters
        assert!(lot_size > 0, E_INVALID_AMOUNT);
        assert!(tick_size > 0, E_INVALID_AMOUNT);
        assert!(min_size > 0, E_INVALID_AMOUNT);

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
        );

        // Get or initialize the MarketRegistry
        let resource_addr = types::get_resource_account_address();
        if (!exists<MarketRegistry>(resource_addr)) {
            let resource_signer = types::get_resource_signer();
            move_to(&resource_signer, MarketRegistry {
                markets: table::new(),
            });
        };

        // Add market to registry
        let registry = borrow_global_mut<MarketRegistry>(resource_addr);
        table::add(&mut registry.markets, pair_id, market);

        // Create empty OrderBook at the resource account
        if (!exists<OrderBook>(resource_addr)) {
            let resource_signer = types::get_resource_signer();
            move_to(&resource_signer, OrderBook {
                pair_id,
                bids: big_ordered_map::new(),
                asks: big_ordered_map::new(),
            });
        };

        // Emit MarketCreated event
        event::emit(MarketCreated {
            pair_id,
            base_asset: base_asset_addr,
            quote_asset: quote_asset_addr,
            lot_size,
            tick_size,
            min_size,
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
    /// Returns (base_asset, quote_asset, lot_size, tick_size, min_size, status)
    public fun get_market_info(pair_id: u64): (address, address, u64, u64, u64, u8) acquires MarketRegistry {
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

    // ========== Friend Declarations ==========
    friend cash_orderbook::admin;

    // ========== Test Helpers ==========

    #[test_only]
    /// Initialize market registry for tests (public entry for other modules' tests)
    public fun init_market_registry_for_test() {
        let resource_addr = types::get_resource_account_address();
        if (!exists<MarketRegistry>(resource_addr)) {
            let resource_signer = types::get_resource_signer();
            move_to(&resource_signer, MarketRegistry {
                markets: table::new(),
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
    fun test_register_market_success(deployer: &signer) acquires MarketRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);

        // Register a market
        register_market(
            deployer,
            base_metadata,
            quote_metadata,
            1_000,    // lot_size
            1_000,    // tick_size
            10_000,   // min_size
        );

        // Verify market exists
        assert!(market_exists(0), 100);

        // Verify market info
        let (base, quote, lot, tick, min, status) = get_market_info(0);
        assert!(base == object::object_address(&base_metadata), 101);
        assert!(quote == object::object_address(&quote_metadata), 102);
        assert!(lot == 1_000, 103);
        assert!(tick == 1_000, 104);
        assert!(min == 10_000, 105);
        assert!(status == types::market_status_active(), 106);

        // Verify market is active
        assert!(is_market_active(0), 107);

        // Verify OrderBook exists
        let resource_addr = types::get_resource_account_address();
        assert!(exists<OrderBook>(resource_addr), 108);
    }

    #[test(deployer = @cash_orderbook)]
    /// Test that registering multiple markets assigns incrementing pair_ids
    fun test_register_multiple_markets(deployer: &signer) acquires MarketRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);

        // Register first market
        register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000);

        // Register second market (same assets for simplicity — real scenario would be different pairs)
        register_market(deployer, base_metadata, quote_metadata, 2_000, 2_000, 20_000);

        // Verify both markets exist with correct pair_ids
        assert!(market_exists(0), 200);
        assert!(market_exists(1), 201);

        // Verify first market params
        let (_base, _quote, lot1, _tick1, _min1, _status1) = get_market_info(0);
        assert!(lot1 == 1_000, 202);

        // Verify second market params
        let (_base2, _quote2, lot2, _tick2, _min2, _status2) = get_market_info(1);
        assert!(lot2 == 2_000, 203);
    }

    #[test(deployer = @cash_orderbook, non_admin = @0xBEEF)]
    #[expected_failure(abort_code = 1, location = cash_orderbook::types)] // E_UNAUTHORIZED
    /// Test that non-admin cannot register a market
    fun test_register_market_unauthorized(
        deployer: &signer,
        non_admin: &signer,
    ) acquires MarketRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);

        // Non-admin tries to register — should fail
        register_market(non_admin, base_metadata, quote_metadata, 1_000, 1_000, 10_000);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 4, location = cash_orderbook::market)] // E_INVALID_AMOUNT
    /// Test that zero lot_size is rejected
    fun test_register_market_zero_lot_size(deployer: &signer) acquires MarketRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);
        register_market(deployer, base_metadata, quote_metadata, 0, 1_000, 10_000);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 4, location = cash_orderbook::market)] // E_INVALID_AMOUNT
    /// Test that zero tick_size is rejected
    fun test_register_market_zero_tick_size(deployer: &signer) acquires MarketRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);
        register_market(deployer, base_metadata, quote_metadata, 1_000, 0, 10_000);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 4, location = cash_orderbook::market)] // E_INVALID_AMOUNT
    /// Test that zero min_size is rejected
    fun test_register_market_zero_min_size(deployer: &signer) acquires MarketRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);
        register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 0);
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
    fun test_assert_market_active_success(deployer: &signer) acquires MarketRegistry {
        let (base_metadata, quote_metadata) = setup_market_test_env(deployer);
        register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000);

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

    #[test_only]
    use aptos_framework::primary_fungible_store;
}
