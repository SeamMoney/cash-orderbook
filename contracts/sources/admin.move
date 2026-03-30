/// Admin module for the Cash Orderbook.
/// Handles administrative operations: pause/unpause markets, admin permission checks.
module cash_orderbook::admin {
    use aptos_framework::event;
    use cash_orderbook::types;
    use cash_orderbook::market;

    // ========== Error Codes ==========
    const E_UNAUTHORIZED: u64 = 1;
    const E_PAUSED: u64 = 3;
    const E_MARKET_NOT_LISTED: u64 = 6;

    // ========== Events ==========

    #[event]
    struct MarketStatusChanged has drop, store {
        /// The pair ID of the market
        pair_id: u64,
        /// New status: 0 = active, 1 = paused
        new_status: u8,
        /// Admin who made the change
        admin: address,
    }

    // ========== Entry Functions ==========

    /// Pause a market. Only admin can call this.
    /// When paused, order placement will abort with E_PAUSED, but cancellation still works.
    ///
    /// Aborts with E_UNAUTHORIZED if caller is not admin.
    /// Aborts with E_MARKET_NOT_LISTED if market doesn't exist.
    public entry fun pause_market(
        admin: &signer,
        pair_id: u64,
    ) {
        // Verify admin
        types::assert_admin(admin);

        // Set market status to paused (also asserts market exists)
        market::set_market_status_by_pair_id(pair_id, types::market_status_paused());

        // Emit event
        event::emit(MarketStatusChanged {
            pair_id,
            new_status: types::market_status_paused(),
            admin: std::signer::address_of(admin),
        });
    }

    /// Unpause a market. Only admin can call this.
    /// Restores the market to active status.
    ///
    /// Aborts with E_UNAUTHORIZED if caller is not admin.
    /// Aborts with E_MARKET_NOT_LISTED if market doesn't exist.
    public entry fun unpause_market(
        admin: &signer,
        pair_id: u64,
    ) {
        // Verify admin
        types::assert_admin(admin);

        // Set market status to active (also asserts market exists)
        market::set_market_status_by_pair_id(pair_id, types::market_status_active());

        // Emit event
        event::emit(MarketStatusChanged {
            pair_id,
            new_status: types::market_status_active(),
            admin: std::signer::address_of(admin),
        });
    }

    // ========== Tests ==========

    #[test_only]
    use aptos_framework::account as test_account;
    #[test_only]
    use aptos_framework::fungible_asset::Metadata;
    #[test_only]
    use aptos_framework::object::{Self, Object};
    #[test_only]
    use aptos_framework::primary_fungible_store;
    #[test_only]
    use std::string;
    #[test_only]
    use std::signer;

    #[test_only]
    /// Helper: Set up the environment for admin tests.
    /// Creates deployer account, initializes protocol, creates test FA metadata objects,
    /// and registers a market.
    fun setup_admin_test_env(
        deployer: &signer,
    ): (Object<Metadata>, Object<Metadata>) {
        let deployer_addr = signer::address_of(deployer);
        test_account::create_account_for_test(deployer_addr);

        // Initialize protocol
        types::init_module_for_test(deployer);

        // Create resource account
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
    /// Test full pause/unpause cycle
    fun test_pause_unpause_cycle(deployer: &signer) {
        let (base_metadata, quote_metadata) = setup_admin_test_env(deployer);

        // Register a market
        market::register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000);

        // Verify initially active
        assert!(market::is_market_active(0), 100);

        // Pause
        pause_market(deployer, 0);
        assert!(!market::is_market_active(0), 101);

        // Unpause
        unpause_market(deployer, 0);
        assert!(market::is_market_active(0), 102);
    }

    #[test(deployer = @cash_orderbook)]
    /// Test that pausing updates market status correctly
    fun test_pause_market_status(deployer: &signer) {
        let (base_metadata, quote_metadata) = setup_admin_test_env(deployer);

        // Register market
        market::register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000);

        // Pause
        pause_market(deployer, 0);

        // Verify via market info
        let (_base, _quote, _lot, _tick, _min, status) = market::get_market_info(0);
        assert!(status == types::market_status_paused(), 200);
    }

    #[test(deployer = @cash_orderbook)]
    /// Test that unpausing restores active status
    fun test_unpause_market_status(deployer: &signer) {
        let (base_metadata, quote_metadata) = setup_admin_test_env(deployer);

        // Register market, pause, then unpause
        market::register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000);
        pause_market(deployer, 0);
        unpause_market(deployer, 0);

        // Verify via market info
        let (_base, _quote, _lot, _tick, _min, status) = market::get_market_info(0);
        assert!(status == types::market_status_active(), 300);
    }

    #[test(deployer = @cash_orderbook, non_admin = @0xBEEF)]
    #[expected_failure(abort_code = 1, location = cash_orderbook::types)] // E_UNAUTHORIZED
    /// Test that non-admin cannot pause a market
    fun test_pause_market_unauthorized(
        deployer: &signer,
        non_admin: &signer,
    ) {
        let (base_metadata, quote_metadata) = setup_admin_test_env(deployer);
        market::register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000);

        // Non-admin tries to pause — should fail
        pause_market(non_admin, 0);
    }

    #[test(deployer = @cash_orderbook, non_admin = @0xBEEF)]
    #[expected_failure(abort_code = 1, location = cash_orderbook::types)] // E_UNAUTHORIZED
    /// Test that non-admin cannot unpause a market
    fun test_unpause_market_unauthorized(
        deployer: &signer,
        non_admin: &signer,
    ) {
        let (base_metadata, quote_metadata) = setup_admin_test_env(deployer);
        market::register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000);
        pause_market(deployer, 0);

        // Non-admin tries to unpause — should fail
        unpause_market(non_admin, 0);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 6, location = cash_orderbook::market)] // E_MARKET_NOT_LISTED
    /// Test that pausing a non-existent market aborts
    fun test_pause_nonexistent_market(deployer: &signer) {
        let (_base_metadata, _quote_metadata) = setup_admin_test_env(deployer);
        pause_market(deployer, 99);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 6, location = cash_orderbook::market)] // E_MARKET_NOT_LISTED
    /// Test that unpausing a non-existent market aborts
    fun test_unpause_nonexistent_market(deployer: &signer) {
        let (_base_metadata, _quote_metadata) = setup_admin_test_env(deployer);
        unpause_market(deployer, 99);
    }

    #[test(deployer = @cash_orderbook)]
    /// Test that assert_market_active aborts on paused market
    fun test_assert_market_active_when_paused(deployer: &signer) {
        let (base_metadata, quote_metadata) = setup_admin_test_env(deployer);
        market::register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000);

        // Pause market
        pause_market(deployer, 0);

        // assert_market_active should now abort with E_PAUSED
        // We can't directly test expected_failure in a non-expected_failure test,
        // so we just verify the market is not active through the view function
        assert!(!market::is_market_active(0), 400);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 3, location = cash_orderbook::market)] // E_PAUSED
    /// Test that order placement on paused market aborts (simulated via assert_market_active)
    fun test_order_placement_on_paused_market_aborts(deployer: &signer) {
        let (base_metadata, quote_metadata) = setup_admin_test_env(deployer);
        market::register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000);

        // Pause market
        pause_market(deployer, 0);

        // Simulate what order placement would do — assert_market_active should abort E_PAUSED
        market::assert_market_active(0);
    }

    #[test(deployer = @cash_orderbook)]
    /// Test that cancellation on paused market still works (assert_market_exists doesn't abort)
    fun test_cancellation_on_paused_market_works(deployer: &signer) {
        let (base_metadata, quote_metadata) = setup_admin_test_env(deployer);
        market::register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000);

        // Pause market
        pause_market(deployer, 0);

        // assert_market_exists should NOT abort (cancellation still works when paused)
        market::assert_market_exists(0);
    }

    #[test(deployer = @cash_orderbook)]
    /// Test double pause is idempotent (doesn't abort)
    fun test_double_pause(deployer: &signer) {
        let (base_metadata, quote_metadata) = setup_admin_test_env(deployer);
        market::register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000);

        // Pause twice
        pause_market(deployer, 0);
        pause_market(deployer, 0);

        // Still paused
        assert!(!market::is_market_active(0), 500);
    }

    #[test(deployer = @cash_orderbook)]
    /// Test double unpause is idempotent
    fun test_double_unpause(deployer: &signer) {
        let (base_metadata, quote_metadata) = setup_admin_test_env(deployer);
        market::register_market(deployer, base_metadata, quote_metadata, 1_000, 1_000, 10_000);

        // Already active, unpause again
        unpause_market(deployer, 0);

        // Still active
        assert!(market::is_market_active(0), 600);
    }
}
