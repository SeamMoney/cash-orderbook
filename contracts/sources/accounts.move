/// Balance management module for the Cash Orderbook.
/// Handles user deposits and withdrawals of FungibleAssets (CASH, USDC).
/// Maintains internal balance tracking per user per asset with available and locked amounts.
module cash_orderbook::accounts {
    use std::signer;
    use aptos_framework::event;
    use aptos_framework::object::{Self, Object};
    use aptos_framework::fungible_asset::Metadata;
    use aptos_framework::primary_fungible_store;
    use aptos_std::smart_table::{Self, SmartTable};
    use cash_orderbook::types;

    // ========== Error Codes (re-exported from types for convenience) ==========
    const E_INSUFFICIENT_BALANCE: u64 = 2;
    const E_INVALID_AMOUNT: u64 = 4;

    // ========== Resources ==========

    /// Stores a user's balances for all assets they have deposited.
    /// `available` tracks withdrawable funds.
    /// `locked` tracks funds committed to open orders.
    struct UserBalance has key {
        /// Mapping: asset metadata address -> available balance
        available: SmartTable<address, u64>,
        /// Mapping: asset metadata address -> locked balance (in open orders)
        locked: SmartTable<address, u64>,
    }

    // ========== Events ==========

    #[event]
    struct DepositEvent has drop, store {
        /// Address of the user who deposited
        user: address,
        /// Asset metadata address
        asset: address,
        /// Amount deposited
        amount: u64,
    }

    #[event]
    struct WithdrawEvent has drop, store {
        /// Address of the user who withdrew
        user: address,
        /// Asset metadata address
        asset: address,
        /// Amount withdrawn
        amount: u64,
    }

    // ========== Entry Functions ==========

    /// Deposit FungibleAsset from user's primary store into the protocol.
    /// Credits the user's internal available balance.
    ///
    /// Aborts with E_INVALID_AMOUNT if amount is 0.
    public entry fun deposit(
        user: &signer,
        asset_metadata: Object<Metadata>,
        amount: u64,
    ) acquires UserBalance {
        // Validate amount
        assert!(amount > 0, E_INVALID_AMOUNT);

        let user_addr = signer::address_of(user);
        let asset_addr = object::object_address(&asset_metadata);

        // Transfer FA from user's primary store to protocol's resource account store
        let resource_signer = types::get_resource_signer();
        let resource_addr = signer::address_of(&resource_signer);

        // Ensure the resource account has a store for this asset
        primary_fungible_store::transfer(user, asset_metadata, resource_addr, amount);

        // Credit user's internal available balance
        ensure_user_balance_exists(user);
        let user_balance = borrow_global_mut<UserBalance>(user_addr);
        let current = get_or_default(&user_balance.available, asset_addr);
        smart_table::upsert(&mut user_balance.available, asset_addr, current + amount);

        // Emit deposit event
        event::emit(DepositEvent {
            user: user_addr,
            asset: asset_addr,
            amount,
        });
    }

    /// Withdraw FungibleAsset from protocol to user's primary store.
    /// Debits from user's internal available balance.
    ///
    /// Aborts with E_INVALID_AMOUNT if amount is 0.
    /// Aborts with E_INSUFFICIENT_BALANCE if amount > available balance.
    public entry fun withdraw(
        user: &signer,
        asset_metadata: Object<Metadata>,
        amount: u64,
    ) acquires UserBalance {
        // Validate amount
        assert!(amount > 0, E_INVALID_AMOUNT);

        let user_addr = signer::address_of(user);
        let asset_addr = object::object_address(&asset_metadata);

        // Check and debit available balance
        assert!(exists<UserBalance>(user_addr), E_INSUFFICIENT_BALANCE);
        let user_balance = borrow_global_mut<UserBalance>(user_addr);
        let current = get_or_default(&user_balance.available, asset_addr);
        assert!(current >= amount, E_INSUFFICIENT_BALANCE);
        smart_table::upsert(&mut user_balance.available, asset_addr, current - amount);

        // Transfer FA from protocol's resource account store to user
        let resource_signer = types::get_resource_signer();
        primary_fungible_store::transfer(&resource_signer, asset_metadata, user_addr, amount);

        // Emit withdraw event
        event::emit(WithdrawEvent {
            user: user_addr,
            asset: asset_addr,
            amount,
        });
    }

    // ========== Internal / Friend Functions ==========

    /// Lock funds for an open order (move from available to locked).
    /// Called by order placement module.
    public(friend) fun lock_balance(
        user_addr: address,
        asset_addr: address,
        amount: u64,
    ) acquires UserBalance {
        assert!(exists<UserBalance>(user_addr), E_INSUFFICIENT_BALANCE);
        let user_balance = borrow_global_mut<UserBalance>(user_addr);

        // Debit available
        let available = get_or_default(&user_balance.available, asset_addr);
        assert!(available >= amount, E_INSUFFICIENT_BALANCE);
        smart_table::upsert(&mut user_balance.available, asset_addr, available - amount);

        // Credit locked
        let locked = get_or_default(&user_balance.locked, asset_addr);
        smart_table::upsert(&mut user_balance.locked, asset_addr, locked + amount);
    }

    /// Unlock funds when an order is cancelled (move from locked to available).
    /// Called by order cancellation module.
    public(friend) fun unlock_balance(
        user_addr: address,
        asset_addr: address,
        amount: u64,
    ) acquires UserBalance {
        assert!(exists<UserBalance>(user_addr), E_INSUFFICIENT_BALANCE);
        let user_balance = borrow_global_mut<UserBalance>(user_addr);

        // Debit locked
        let locked = get_or_default(&user_balance.locked, asset_addr);
        assert!(locked >= amount, E_INSUFFICIENT_BALANCE);
        smart_table::upsert(&mut user_balance.locked, asset_addr, locked - amount);

        // Credit available
        let available = get_or_default(&user_balance.available, asset_addr);
        smart_table::upsert(&mut user_balance.available, asset_addr, available + amount);
    }

    /// Debit locked funds on fill (already locked, now consumed by trade).
    /// Called by settlement module.
    public(friend) fun debit_locked(
        user_addr: address,
        asset_addr: address,
        amount: u64,
    ) acquires UserBalance {
        assert!(exists<UserBalance>(user_addr), E_INSUFFICIENT_BALANCE);
        let user_balance = borrow_global_mut<UserBalance>(user_addr);

        let locked = get_or_default(&user_balance.locked, asset_addr);
        assert!(locked >= amount, E_INSUFFICIENT_BALANCE);
        smart_table::upsert(&mut user_balance.locked, asset_addr, locked - amount);
    }

    /// Credit available balance on fill (receiving assets from trade).
    /// Called by settlement module.
    public(friend) fun credit_available(
        user_addr: address,
        asset_addr: address,
        amount: u64,
    ) acquires UserBalance {
        // Ensure user balance exists (may receive funds even if not deposited before)
        if (!exists<UserBalance>(user_addr)) {
            // We can't move_to without a signer — but in practice the user
            // must have deposited to have an order. If not, this will abort.
            abort E_INSUFFICIENT_BALANCE
        };
        let user_balance = borrow_global_mut<UserBalance>(user_addr);
        let available = get_or_default(&user_balance.available, asset_addr);
        smart_table::upsert(&mut user_balance.available, asset_addr, available + amount);
    }

    // ========== View Functions ==========

    // Get available balance for a user and asset
    #[view]
    public fun get_available_balance(user_addr: address, asset_addr: address): u64 acquires UserBalance {
        if (!exists<UserBalance>(user_addr)) return 0;
        let user_balance = borrow_global<UserBalance>(user_addr);
        get_or_default(&user_balance.available, asset_addr)
    }

    // Get locked balance for a user and asset
    #[view]
    public fun get_locked_balance(user_addr: address, asset_addr: address): u64 acquires UserBalance {
        if (!exists<UserBalance>(user_addr)) return 0;
        let user_balance = borrow_global<UserBalance>(user_addr);
        get_or_default(&user_balance.locked, asset_addr)
    }

    // Check if a user has a balance resource
    #[view]
    public fun has_balance(user_addr: address): bool {
        exists<UserBalance>(user_addr)
    }

    // ========== Private Helpers ==========

    /// Ensure UserBalance resource exists for the user
    fun ensure_user_balance_exists(user: &signer) {
        let user_addr = signer::address_of(user);
        if (!exists<UserBalance>(user_addr)) {
            move_to(user, UserBalance {
                available: smart_table::new(),
                locked: smart_table::new(),
            });
        };
    }

    /// Get value from SmartTable or return 0 if key doesn't exist
    fun get_or_default(table: &SmartTable<address, u64>, key: address): u64 {
        if (smart_table::contains(table, key)) {
            *smart_table::borrow(table, key)
        } else {
            0
        }
    }

    // ========== Tests ==========

    #[test_only]
    use aptos_framework::account as test_account;
    #[test_only]
    use aptos_framework::fungible_asset;
    #[test_only]
    use std::string;

    #[test_only]
    // Helper: creates accounts, initializes protocol, creates test FA, mints to user.
    fun setup_test_env(
        deployer: &signer,
        user: &signer,
    ): Object<Metadata> {
        // Create accounts
        let deployer_addr = signer::address_of(deployer);
        let user_addr = signer::address_of(user);
        test_account::create_account_for_test(deployer_addr);
        test_account::create_account_for_test(user_addr);

        // Initialize protocol (types::init_module creates resource account)
        types::init_module_for_test(deployer);

        // Create a test FungibleAsset
        let resource_signer = types::get_resource_signer();
        let resource_addr = signer::address_of(&resource_signer);
        test_account::create_account_for_test(resource_addr);

        // Use the aptos_framework::fungible_asset test utilities
        let constructor_ref = object::create_named_object(deployer, b"TEST_ASSET");
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &constructor_ref,
            std::option::none(),        // max_supply
            string::utf8(b"Test USDC"), // name
            string::utf8(b"USDC"),      // symbol
            6,                          // decimals
            string::utf8(b""),          // icon_uri
            string::utf8(b""),          // project_uri
        );
        let metadata = object::object_from_constructor_ref<Metadata>(&constructor_ref);

        // Mint tokens to the user
        let mint_ref = fungible_asset::generate_mint_ref(&constructor_ref);
        let fa = fungible_asset::mint(&mint_ref, 1_000_000_000); // 1000 USDC (6 decimals)
        primary_fungible_store::deposit(user_addr, fa);

        metadata
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    fun test_deposit_success(deployer: &signer, user: &signer) acquires UserBalance {
        let metadata = setup_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let asset_addr = object::object_address(&metadata);

        // Deposit 100 USDC (100_000_000 units)
        deposit(user, metadata, 100_000_000);

        // Verify internal balance
        assert!(get_available_balance(user_addr, asset_addr) == 100_000_000, 1000);
        assert!(get_locked_balance(user_addr, asset_addr) == 0, 1001);
        assert!(has_balance(user_addr), 1002);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    fun test_deposit_multiple_times(deployer: &signer, user: &signer) acquires UserBalance {
        let metadata = setup_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let asset_addr = object::object_address(&metadata);

        // Deposit twice
        deposit(user, metadata, 50_000_000);
        deposit(user, metadata, 30_000_000);

        // Verify cumulative balance
        assert!(get_available_balance(user_addr, asset_addr) == 80_000_000, 1100);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 4, location = cash_orderbook::accounts)] // E_INVALID_AMOUNT
    fun test_deposit_zero_amount(deployer: &signer, user: &signer) acquires UserBalance {
        let metadata = setup_test_env(deployer, user);
        deposit(user, metadata, 0);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    fun test_withdraw_success(deployer: &signer, user: &signer) acquires UserBalance {
        let metadata = setup_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let asset_addr = object::object_address(&metadata);

        // Deposit then withdraw
        deposit(user, metadata, 100_000_000);
        withdraw(user, metadata, 40_000_000);

        // Verify remaining balance
        assert!(get_available_balance(user_addr, asset_addr) == 60_000_000, 1200);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    fun test_withdraw_full_balance(deployer: &signer, user: &signer) acquires UserBalance {
        let metadata = setup_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let asset_addr = object::object_address(&metadata);

        // Deposit then withdraw everything
        deposit(user, metadata, 100_000_000);
        withdraw(user, metadata, 100_000_000);

        // Balance should be zero
        assert!(get_available_balance(user_addr, asset_addr) == 0, 1300);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 2, location = cash_orderbook::accounts)] // E_INSUFFICIENT_BALANCE
    fun test_withdraw_insufficient_balance(deployer: &signer, user: &signer) acquires UserBalance {
        let metadata = setup_test_env(deployer, user);

        // Deposit 100, try to withdraw 200
        deposit(user, metadata, 100_000_000);
        withdraw(user, metadata, 200_000_000);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 4, location = cash_orderbook::accounts)] // E_INVALID_AMOUNT
    fun test_withdraw_zero_amount(deployer: &signer, user: &signer) acquires UserBalance {
        let metadata = setup_test_env(deployer, user);
        deposit(user, metadata, 100_000_000);
        withdraw(user, metadata, 0);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 2, location = cash_orderbook::accounts)] // E_INSUFFICIENT_BALANCE
    fun test_withdraw_no_deposit(deployer: &signer, user: &signer) acquires UserBalance {
        let metadata = setup_test_env(deployer, user);
        // Try to withdraw without any deposit
        withdraw(user, metadata, 100_000_000);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    fun test_lock_and_unlock_balance(deployer: &signer, user: &signer) acquires UserBalance {
        let metadata = setup_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let asset_addr = object::object_address(&metadata);

        // Deposit
        deposit(user, metadata, 100_000_000);

        // Lock some balance
        lock_balance(user_addr, asset_addr, 40_000_000);
        assert!(get_available_balance(user_addr, asset_addr) == 60_000_000, 1400);
        assert!(get_locked_balance(user_addr, asset_addr) == 40_000_000, 1401);

        // Unlock
        unlock_balance(user_addr, asset_addr, 40_000_000);
        assert!(get_available_balance(user_addr, asset_addr) == 100_000_000, 1402);
        assert!(get_locked_balance(user_addr, asset_addr) == 0, 1403);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 2, location = cash_orderbook::accounts)] // E_INSUFFICIENT_BALANCE
    fun test_lock_insufficient_available(deployer: &signer, user: &signer) acquires UserBalance {
        let metadata = setup_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let asset_addr = object::object_address(&metadata);

        deposit(user, metadata, 100_000_000);
        // Try to lock more than available
        lock_balance(user_addr, asset_addr, 200_000_000);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    fun test_debit_locked_and_credit_available(deployer: &signer, user: &signer) acquires UserBalance {
        let metadata = setup_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let asset_addr = object::object_address(&metadata);

        // Deposit and lock
        deposit(user, metadata, 100_000_000);
        lock_balance(user_addr, asset_addr, 50_000_000);

        // Simulate a fill: debit locked (seller's base asset consumed)
        debit_locked(user_addr, asset_addr, 50_000_000);
        assert!(get_locked_balance(user_addr, asset_addr) == 0, 1500);
        assert!(get_available_balance(user_addr, asset_addr) == 50_000_000, 1501);

        // Credit available (buyer receives base asset)
        credit_available(user_addr, asset_addr, 25_000_000);
        assert!(get_available_balance(user_addr, asset_addr) == 75_000_000, 1502);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    fun test_balance_not_exists_returns_zero(deployer: &signer, user: &signer) acquires UserBalance {
        // Don't deposit anything, just set up env
        let _metadata = setup_test_env(deployer, user);
        let non_existent_addr = @0xDEAD;
        let asset_addr = @0x1234;

        // Should return 0 for non-existent user
        assert!(get_available_balance(non_existent_addr, asset_addr) == 0, 1600);
        assert!(get_locked_balance(non_existent_addr, asset_addr) == 0, 1601);
        assert!(!has_balance(non_existent_addr), 1602);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    fun test_deposit_and_withdraw_preserves_fa_balance(deployer: &signer, user: &signer) acquires UserBalance {
        let metadata = setup_test_env(deployer, user);
        let user_addr = signer::address_of(user);

        // Initial FA balance: 1_000_000_000 (from setup)
        let initial_fa_balance = primary_fungible_store::balance(user_addr, metadata);
        assert!(initial_fa_balance == 1_000_000_000, 1700);

        // Deposit 500
        deposit(user, metadata, 500_000_000);
        let after_deposit = primary_fungible_store::balance(user_addr, metadata);
        assert!(after_deposit == 500_000_000, 1701);

        // Withdraw 200
        withdraw(user, metadata, 200_000_000);
        let after_withdraw = primary_fungible_store::balance(user_addr, metadata);
        assert!(after_withdraw == 700_000_000, 1702);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 2, location = cash_orderbook::accounts)] // E_INSUFFICIENT_BALANCE
    fun test_withdraw_locked_funds_not_available(deployer: &signer, user: &signer) acquires UserBalance {
        let metadata = setup_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let asset_addr = object::object_address(&metadata);

        // Deposit 100, lock 60
        deposit(user, metadata, 100_000_000);
        lock_balance(user_addr, asset_addr, 60_000_000);

        // Try to withdraw 50 — only 40 available
        withdraw(user, metadata, 50_000_000);
    }
}
