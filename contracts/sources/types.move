/// Core type definitions, error codes, and constants for the Cash Orderbook.
/// This module defines all shared structs, resources, and error constants used
/// across the orderbook protocol.
module cash_orderbook::types {
    use std::signer;
    use aptos_framework::account::{Self, SignerCapability};
    // ========== Error Codes ==========
    const E_UNAUTHORIZED: u64 = 1;
    const E_INSUFFICIENT_BALANCE: u64 = 2;
    const E_PAUSED: u64 = 3;
    const E_INVALID_AMOUNT: u64 = 4;
    const E_INVALID_PRICE: u64 = 5;
    const E_MARKET_NOT_LISTED: u64 = 6;
    const E_ORDER_NOT_FOUND: u64 = 7;
    const E_SELF_TRADE: u64 = 8;
    const E_FOK_NOT_FILLED: u64 = 9;
    const E_POST_ONLY_WOULD_MATCH: u64 = 10;
    const E_ALREADY_EXISTS: u64 = 11;
    const E_INVALID_ORDER_TYPE: u64 = 12;

    // ========== Constants ==========
    /// Price scale factor: all prices are expressed as fixed-point with 6 decimal places.
    /// e.g., a price of 1.500000 USDC per CASH is represented as 1_500_000.
    const PRICE_SCALE: u64 = 1_000_000;

    // ========== Order Types (for future use by order_placement module) ==========
    const ORDER_TYPE_GTC: u8 = 0;
    const ORDER_TYPE_IOC: u8 = 1;
    const ORDER_TYPE_FOK: u8 = 2;
    const ORDER_TYPE_POST_ONLY: u8 = 3;

    // ========== Market Status ==========
    const MARKET_STATUS_ACTIVE: u8 = 0;
    const MARKET_STATUS_PAUSED: u8 = 1;

    // ========== Structs ==========

    /// Represents a single order in the orderbook.
    struct Order has copy, drop, store {
        /// Unique order ID (auto-incrementing)
        order_id: u64,
        /// Owner address of the order
        owner: address,
        /// Price in PRICE_SCALE units
        price: u64,
        /// Original quantity (base asset units)
        original_quantity: u64,
        /// Remaining unfilled quantity
        remaining_quantity: u64,
        /// true = bid (buy), false = ask (sell)
        is_bid: bool,
        /// Order type: GTC(0), IOC(1), FOK(2), PostOnly(3)
        order_type: u8,
        /// Timestamp when order was placed (microseconds)
        timestamp: u64,
        /// Market pair ID
        pair_id: u64,
        /// Total locked quote amount at placement time (principal + fee_reserve).
        /// For sell orders this is 0 (they lock base, not quote).
        /// For buy orders this is the exact amount locked from the user's balance.
        /// Used by cancel to deterministically return the correct amount regardless
        /// of fee config changes between placement and cancellation.
        locked_quote: u64,
    }

    /// Composite key for ordering in BigOrderedMap.
    /// For bids: ordered descending by price, ascending by timestamp, ascending by order_id.
    /// For asks: ordered ascending by price, ascending by timestamp, ascending by order_id.
    struct OrderKey has copy, drop, store {
        /// Price level
        price: u64,
        /// Timestamp for time priority
        timestamp: u64,
        /// Order ID for uniqueness
        order_id: u64,
    }

    /// Represents a trading market (pair).
    struct Market has drop, store {
        /// Unique pair ID
        pair_id: u64,
        /// Base asset metadata address (e.g., CASH)
        base_asset: address,
        /// Quote asset metadata address (e.g., USDC)
        quote_asset: address,
        /// Minimum order size in base asset units
        lot_size: u64,
        /// Minimum price increment
        tick_size: u64,
        /// Minimum order size
        min_size: u64,
        /// Market status: 0 = active, 1 = paused
        status: u8,
    }

    /// The global protocol state resource, stored at the resource account address.
    struct ProtocolState has key {
        /// Admin address (deployer) who can manage markets and protocol config
        admin: address,
        /// Signer capability for the resource account
        signer_cap: SignerCapability,
        /// Next market pair ID (auto-incrementing counter)
        next_pair_id: u64,
        /// Next order ID (auto-incrementing counter)
        next_order_id: u64,
    }

    // ========== Resource Account Seed ==========
    const RESOURCE_ACCOUNT_SEED: vector<u8> = b"cash_orderbook_resource";

    // ========== Init Module ==========

    /// Called once on module publish. Creates the resource account and
    /// stores ProtocolState with the deployer as admin.
    fun init_module(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);

        // Create resource account for the protocol
        let (resource_signer, signer_cap) = account::create_resource_account(
            deployer,
            RESOURCE_ACCOUNT_SEED,
        );

        // Store ProtocolState at the resource account
        move_to(&resource_signer, ProtocolState {
            admin: deployer_addr,
            signer_cap,
            next_pair_id: 0,
            next_order_id: 0,
        });
    }

    // ========== Public Accessors ==========

    /// Get the resource account address
    public fun get_resource_account_address(): address {
        account::create_resource_address(&@cash_orderbook, RESOURCE_ACCOUNT_SEED)
    }

    /// Get the resource account signer (for internal use by friend modules)
    public(friend) fun get_resource_signer(): signer acquires ProtocolState {
        let resource_addr = get_resource_account_address();
        let state = borrow_global<ProtocolState>(resource_addr);
        account::create_signer_with_capability(&state.signer_cap)
    }

    /// Get the admin address
    public fun get_admin(): address acquires ProtocolState {
        let resource_addr = get_resource_account_address();
        let state = borrow_global<ProtocolState>(resource_addr);
        state.admin
    }

    /// Assert the caller is the admin
    public fun assert_admin(caller: &signer) acquires ProtocolState {
        let caller_addr = signer::address_of(caller);
        assert!(caller_addr == get_admin(), E_UNAUTHORIZED);
    }

    /// Check if ProtocolState is initialized
    public fun is_initialized(): bool {
        let resource_addr = get_resource_account_address();
        exists<ProtocolState>(resource_addr)
    }

    /// Get and increment the next order ID
    public(friend) fun next_order_id(): u64 acquires ProtocolState {
        let resource_addr = get_resource_account_address();
        let state = borrow_global_mut<ProtocolState>(resource_addr);
        let id = state.next_order_id;
        state.next_order_id = id + 1;
        id
    }

    /// Get and increment the next pair ID
    public(friend) fun next_pair_id(): u64 acquires ProtocolState {
        let resource_addr = get_resource_account_address();
        let state = borrow_global_mut<ProtocolState>(resource_addr);
        let id = state.next_pair_id;
        state.next_pair_id = id + 1;
        id
    }

    // ========== Struct Constructors ==========

    /// Create a new Order
    public fun new_order(
        order_id: u64,
        owner: address,
        price: u64,
        original_quantity: u64,
        remaining_quantity: u64,
        is_bid: bool,
        order_type: u8,
        timestamp: u64,
        pair_id: u64,
        locked_quote: u64,
    ): Order {
        Order {
            order_id,
            owner,
            price,
            original_quantity,
            remaining_quantity,
            is_bid,
            order_type,
            timestamp,
            pair_id,
            locked_quote,
        }
    }

    /// Create a new OrderKey
    public fun new_order_key(price: u64, timestamp: u64, order_id: u64): OrderKey {
        OrderKey { price, timestamp, order_id }
    }

    /// Create a new Market
    public fun new_market(
        pair_id: u64,
        base_asset: address,
        quote_asset: address,
        lot_size: u64,
        tick_size: u64,
        min_size: u64,
    ): Market {
        Market {
            pair_id,
            base_asset,
            quote_asset,
            lot_size,
            tick_size,
            min_size,
            status: MARKET_STATUS_ACTIVE,
        }
    }

    // ========== Order Accessors ==========

    public fun order_id(order: &Order): u64 { order.order_id }
    public fun order_owner(order: &Order): address { order.owner }
    public fun order_price(order: &Order): u64 { order.price }
    public fun order_original_quantity(order: &Order): u64 { order.original_quantity }
    public fun order_remaining_quantity(order: &Order): u64 { order.remaining_quantity }
    public fun order_is_bid(order: &Order): bool { order.is_bid }
    public fun order_type(order: &Order): u8 { order.order_type }
    public fun order_timestamp(order: &Order): u64 { order.timestamp }
    public fun order_pair_id(order: &Order): u64 { order.pair_id }
    public fun order_locked_quote(order: &Order): u64 { order.locked_quote }

    /// Set remaining quantity (friend access for matching engine)
    public(friend) fun set_remaining_quantity(order: &mut Order, qty: u64) {
        order.remaining_quantity = qty;
    }

    /// Set locked_quote amount (friend access for settlement on partial fills)
    public(friend) fun set_locked_quote(order: &mut Order, amount: u64) {
        order.locked_quote = amount;
    }

    // ========== OrderKey Accessors ==========

    public fun order_key_price(key: &OrderKey): u64 { key.price }
    public fun order_key_timestamp(key: &OrderKey): u64 { key.timestamp }
    public fun order_key_order_id(key: &OrderKey): u64 { key.order_id }

    // ========== Market Accessors ==========

    public fun market_pair_id(market: &Market): u64 { market.pair_id }
    public fun market_base_asset(market: &Market): address { market.base_asset }
    public fun market_quote_asset(market: &Market): address { market.quote_asset }
    public fun market_lot_size(market: &Market): u64 { market.lot_size }
    public fun market_tick_size(market: &Market): u64 { market.tick_size }
    public fun market_min_size(market: &Market): u64 { market.min_size }
    public fun market_status(market: &Market): u8 { market.status }
    public fun market_is_active(market: &Market): bool { market.status == MARKET_STATUS_ACTIVE }

    /// Set market status (friend access for admin module)
    public(friend) fun set_market_status(market: &mut Market, status: u8) {
        market.status = status;
    }

    // ========== Constant Accessors ==========

    public fun price_scale(): u64 { PRICE_SCALE }
    public fun order_type_gtc(): u8 { ORDER_TYPE_GTC }
    public fun order_type_ioc(): u8 { ORDER_TYPE_IOC }
    public fun order_type_fok(): u8 { ORDER_TYPE_FOK }
    public fun order_type_post_only(): u8 { ORDER_TYPE_POST_ONLY }
    public fun market_status_active(): u8 { MARKET_STATUS_ACTIVE }
    public fun market_status_paused(): u8 { MARKET_STATUS_PAUSED }

    public fun e_unauthorized(): u64 { E_UNAUTHORIZED }
    public fun e_insufficient_balance(): u64 { E_INSUFFICIENT_BALANCE }
    public fun e_paused(): u64 { E_PAUSED }
    public fun e_invalid_amount(): u64 { E_INVALID_AMOUNT }
    public fun e_invalid_price(): u64 { E_INVALID_PRICE }
    public fun e_market_not_listed(): u64 { E_MARKET_NOT_LISTED }
    public fun e_order_not_found(): u64 { E_ORDER_NOT_FOUND }
    public fun e_self_trade(): u64 { E_SELF_TRADE }
    public fun e_fok_not_filled(): u64 { E_FOK_NOT_FILLED }
    public fun e_post_only_would_match(): u64 { E_POST_ONLY_WOULD_MATCH }
    public fun e_already_exists(): u64 { E_ALREADY_EXISTS }
    public fun e_invalid_order_type(): u64 { E_INVALID_ORDER_TYPE }

    // ========== Friend Declarations ==========
    friend cash_orderbook::accounts;
    friend cash_orderbook::market;
    friend cash_orderbook::admin;
    friend cash_orderbook::order_placement;
    friend cash_orderbook::matching;
    friend cash_orderbook::settlement;
    friend cash_orderbook::fees;
    friend cash_orderbook::views;
    friend cash_orderbook::cancel;

    // ========== Test-Only Helpers ==========

    #[test_only]
    /// Public entry point for tests in other modules to initialize the protocol.
    public fun init_module_for_test(deployer: &signer) {
        init_module(deployer);
    }

    // ========== Tests ==========

    #[test_only]
    use aptos_framework::account as test_account;

    #[test(deployer = @cash_orderbook)]
    fun test_init_module(deployer: &signer) {
        // Set up the account for the deployer
        test_account::create_account_for_test(signer::address_of(deployer));

        // Call init_module
        init_module(deployer);

        // Verify ProtocolState exists at the resource account
        assert!(is_initialized(), 100);

        // Verify admin is the deployer
        let admin = get_admin();
        assert!(admin == signer::address_of(deployer), 101);
    }

    #[test]
    fun test_order_creation_and_accessors() {
        let order = new_order(
            42,          // order_id
            @0x1234,     // owner
            1_500_000,   // price (1.5 USDC)
            100_000_000, // original_quantity (100 CASH)
            50_000_000,  // remaining_quantity (50 CASH)
            true,        // is_bid (buy)
            ORDER_TYPE_GTC, // order_type
            1000000,     // timestamp
            0,           // pair_id
            150_000_000, // locked_quote (1.5 * 100 = 150 USDC)
        );

        assert!(order_id(&order) == 42, 200);
        assert!(order_owner(&order) == @0x1234, 201);
        assert!(order_price(&order) == 1_500_000, 202);
        assert!(order_original_quantity(&order) == 100_000_000, 203);
        assert!(order_remaining_quantity(&order) == 50_000_000, 204);
        assert!(order_is_bid(&order) == true, 205);
        assert!(order_type(&order) == ORDER_TYPE_GTC, 206);
        assert!(order_timestamp(&order) == 1000000, 207);
        assert!(order_pair_id(&order) == 0, 208);
        assert!(order_locked_quote(&order) == 150_000_000, 209);
    }

    #[test]
    fun test_order_key_creation_and_accessors() {
        let key = new_order_key(1_500_000, 1000000, 42);

        assert!(order_key_price(&key) == 1_500_000, 300);
        assert!(order_key_timestamp(&key) == 1000000, 301);
        assert!(order_key_order_id(&key) == 42, 302);
    }

    #[test]
    fun test_market_creation_and_accessors() {
        let market = new_market(
            0,       // pair_id
            @0xBA5E, // base_asset
            @0x0C07E, // quote_asset
            1_000,   // lot_size
            1_000,   // tick_size
            10_000,  // min_size
        );

        assert!(market_pair_id(&market) == 0, 400);
        assert!(market_base_asset(&market) == @0xBA5E, 401);
        assert!(market_quote_asset(&market) == @0x0C07E, 402);
        assert!(market_lot_size(&market) == 1_000, 403);
        assert!(market_tick_size(&market) == 1_000, 404);
        assert!(market_min_size(&market) == 10_000, 405);
        assert!(market_status(&market) == MARKET_STATUS_ACTIVE, 406);
        assert!(market_is_active(&market) == true, 407);
    }

    #[test]
    fun test_market_status_change() {
        let market = new_market(0, @0xBA5E, @0x0C07E, 1_000, 1_000, 10_000);

        // Initially active
        assert!(market_is_active(&market), 500);

        // Pause
        set_market_status(&mut market, MARKET_STATUS_PAUSED);
        assert!(market_status(&market) == MARKET_STATUS_PAUSED, 501);
        assert!(!market_is_active(&market), 502);

        // Unpause
        set_market_status(&mut market, MARKET_STATUS_ACTIVE);
        assert!(market_is_active(&market), 503);
    }

    #[test]
    fun test_constants() {
        assert!(price_scale() == 1_000_000, 600);
        assert!(order_type_gtc() == 0, 601);
        assert!(order_type_ioc() == 1, 602);
        assert!(order_type_fok() == 2, 603);
        assert!(order_type_post_only() == 3, 604);
        assert!(market_status_active() == 0, 605);
        assert!(market_status_paused() == 1, 606);
    }

    #[test]
    fun test_error_codes() {
        assert!(e_unauthorized() == 1, 700);
        assert!(e_insufficient_balance() == 2, 701);
        assert!(e_paused() == 3, 702);
        assert!(e_invalid_amount() == 4, 703);
        assert!(e_invalid_price() == 5, 704);
        assert!(e_market_not_listed() == 6, 705);
        assert!(e_order_not_found() == 7, 706);
        assert!(e_self_trade() == 8, 707);
        assert!(e_fok_not_filled() == 9, 708);
        assert!(e_post_only_would_match() == 10, 709);
        assert!(e_already_exists() == 11, 710);
        assert!(e_invalid_order_type() == 12, 711);
    }

    #[test(deployer = @cash_orderbook)]
    fun test_next_order_id_increments(deployer: &signer) {
        test_account::create_account_for_test(signer::address_of(deployer));
        init_module(deployer);

        let id1 = next_order_id();
        let id2 = next_order_id();
        let id3 = next_order_id();

        assert!(id1 == 0, 800);
        assert!(id2 == 1, 801);
        assert!(id3 == 2, 802);
    }

    #[test(deployer = @cash_orderbook)]
    fun test_next_pair_id_increments(deployer: &signer) {
        test_account::create_account_for_test(signer::address_of(deployer));
        init_module(deployer);

        let id1 = next_pair_id();
        let id2 = next_pair_id();

        assert!(id1 == 0, 900);
        assert!(id2 == 1, 901);
    }
}
