/// Subaccount and delegation module for the Cash Orderbook.
/// Enables bot trading: a user can delegate trading authority to another address.
///
/// create_subaccount(signer) — marks the user as having subaccount support.
/// delegate_trading(signer, delegate_addr, expiration) — grants trading rights.
/// revoke_delegation(signer, delegate_addr) — removes trading rights.
///
/// Delegated addresses can place/cancel orders on behalf of the owner.
module cash_orderbook::subaccounts {
    use std::signer;
    use aptos_framework::event;
    use aptos_framework::timestamp;
    use aptos_std::smart_table::{Self, SmartTable};
    // ========== Error Codes ==========
    const E_UNAUTHORIZED: u64 = 1;
    const E_ALREADY_EXISTS: u64 = 11;
    const E_DELEGATION_NOT_FOUND: u64 = 13;
    const E_DELEGATION_EXPIRED: u64 = 14;
    const E_SUBACCOUNT_NOT_FOUND: u64 = 15;

    // ========== Resources ==========

    /// Stored at the user's address. Tracks all delegates authorized to trade.
    struct SubAccount has key {
        /// Mapping: delegate address -> delegation expiration timestamp (0 = never expires)
        delegates: SmartTable<address, u64>,
    }

    // ========== Events ==========

    #[event]
    struct SubAccountCreated has drop, store {
        owner: address,
    }

    #[event]
    struct DelegationGranted has drop, store {
        owner: address,
        delegate: address,
        expiration: u64,
    }

    #[event]
    struct DelegationRevoked has drop, store {
        owner: address,
        delegate: address,
    }

    // ========== Entry Functions ==========

    /// Create a subaccount for the signer. This is required before delegating.
    /// Idempotent — does nothing if already created.
    public entry fun create_subaccount(user: &signer) {
        let user_addr = signer::address_of(user);
        if (!exists<SubAccount>(user_addr)) {
            move_to(user, SubAccount {
                delegates: smart_table::new(),
            });
            event::emit(SubAccountCreated { owner: user_addr });
        };
    }

    /// Delegate trading authority to another address.
    /// The delegate can place and cancel orders on behalf of the owner.
    ///
    /// Parameters:
    ///   - user: the account owner
    ///   - delegate_addr: the address to grant trading rights
    ///   - expiration: timestamp in microseconds when delegation expires (0 = never)
    ///
    /// Aborts with E_SUBACCOUNT_NOT_FOUND if create_subaccount wasn't called first.
    public entry fun delegate_trading(
        user: &signer,
        delegate_addr: address,
        expiration: u64,
    ) acquires SubAccount {
        let user_addr = signer::address_of(user);
        assert!(exists<SubAccount>(user_addr), E_SUBACCOUNT_NOT_FOUND);

        let sub = borrow_global_mut<SubAccount>(user_addr);
        smart_table::upsert(&mut sub.delegates, delegate_addr, expiration);

        event::emit(DelegationGranted {
            owner: user_addr,
            delegate: delegate_addr,
            expiration,
        });
    }

    /// Revoke trading delegation from an address.
    ///
    /// Aborts with E_SUBACCOUNT_NOT_FOUND if no subaccount exists.
    /// Aborts with E_DELEGATION_NOT_FOUND if the delegate is not in the list.
    public entry fun revoke_delegation(
        user: &signer,
        delegate_addr: address,
    ) acquires SubAccount {
        let user_addr = signer::address_of(user);
        assert!(exists<SubAccount>(user_addr), E_SUBACCOUNT_NOT_FOUND);

        let sub = borrow_global_mut<SubAccount>(user_addr);
        assert!(smart_table::contains(&sub.delegates, delegate_addr), E_DELEGATION_NOT_FOUND);
        smart_table::remove(&mut sub.delegates, delegate_addr);

        event::emit(DelegationRevoked {
            owner: user_addr,
            delegate: delegate_addr,
        });
    }

    // ========== Query Functions ==========

    /// Check if a delegate is authorized to trade on behalf of an owner.
    /// Returns true if delegation exists and has not expired.
    public fun is_authorized_delegate(
        owner_addr: address,
        delegate_addr: address,
    ): bool acquires SubAccount {
        if (!exists<SubAccount>(owner_addr)) {
            return false
        };
        let sub = borrow_global<SubAccount>(owner_addr);
        if (!smart_table::contains(&sub.delegates, delegate_addr)) {
            return false
        };
        let expiration = *smart_table::borrow(&sub.delegates, delegate_addr);
        // 0 means never expires
        if (expiration == 0) {
            return true
        };
        // Check if not expired
        let now = timestamp::now_microseconds();
        now < expiration
    }

    /// Assert that the caller is either the owner or an authorized delegate.
    /// Used by order placement and cancellation.
    ///
    /// Returns the actual owner address (for balance operations).
    public fun assert_authorized_trader(
        caller_addr: address,
        owner_addr: address,
    ): address acquires SubAccount {
        if (caller_addr == owner_addr) {
            return owner_addr
        };
        assert!(is_authorized_delegate(owner_addr, caller_addr), E_UNAUTHORIZED);
        owner_addr
    }

    #[view]
    /// Check if a user has a subaccount.
    public fun has_subaccount(user_addr: address): bool {
        exists<SubAccount>(user_addr)
    }

    // ========== Friend Declarations ==========
    friend cash_orderbook::order_placement;

    // ========== Tests ==========

    #[test_only]
    use aptos_framework::account as test_account;
    #[test_only]
    use cash_orderbook::types;

    #[test_only]
    fun setup_subaccount_test_env(deployer: &signer, user: &signer) {
        let deployer_addr = signer::address_of(deployer);
        let user_addr = signer::address_of(user);
        test_account::create_account_for_test(deployer_addr);
        test_account::create_account_for_test(user_addr);
        types::init_module_for_test(deployer);
        let resource_addr = types::get_resource_account_address();
        test_account::create_account_for_test(resource_addr);

        // Set timestamp
        let aptos_framework = test_account::create_signer_for_test(@0x1);
        timestamp::set_time_has_started_for_testing(&aptos_framework);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-028: Create subaccount
    fun test_create_subaccount(deployer: &signer, user: &signer) {
        setup_subaccount_test_env(deployer, user);
        let user_addr = signer::address_of(user);

        assert!(!has_subaccount(user_addr), 100);
        create_subaccount(user);
        assert!(has_subaccount(user_addr), 101);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// Create subaccount is idempotent
    fun test_create_subaccount_idempotent(deployer: &signer, user: &signer) {
        setup_subaccount_test_env(deployer, user);
        create_subaccount(user);
        create_subaccount(user); // Should not abort
        assert!(has_subaccount(signer::address_of(user)), 200);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-028: Delegate trading and verify authorization
    fun test_delegate_trading(deployer: &signer, user: &signer) acquires SubAccount {
        setup_subaccount_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let delegate = @0xDEAD;

        create_subaccount(user);
        delegate_trading(user, delegate, 0); // Never expires

        assert!(is_authorized_delegate(user_addr, delegate), 300);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// VAL-CONTRACT-028: Revoke delegation removes permission
    fun test_revoke_delegation(deployer: &signer, user: &signer) acquires SubAccount {
        setup_subaccount_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let delegate = @0xDEAD;

        create_subaccount(user);
        delegate_trading(user, delegate, 0);
        assert!(is_authorized_delegate(user_addr, delegate), 400);

        revoke_delegation(user, delegate);
        assert!(!is_authorized_delegate(user_addr, delegate), 401);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 13, location = cash_orderbook::subaccounts)]
    /// Revoke non-existent delegation aborts
    fun test_revoke_nonexistent_delegation(deployer: &signer, user: &signer) acquires SubAccount {
        setup_subaccount_test_env(deployer, user);
        create_subaccount(user);
        revoke_delegation(user, @0xDEAD);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 15, location = cash_orderbook::subaccounts)]
    /// Delegate without subaccount aborts
    fun test_delegate_without_subaccount(deployer: &signer, user: &signer) acquires SubAccount {
        setup_subaccount_test_env(deployer, user);
        delegate_trading(user, @0xDEAD, 0);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// Non-authorized delegate returns false
    fun test_unauthorized_delegate(deployer: &signer, user: &signer) acquires SubAccount {
        setup_subaccount_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let delegate = @0xDEAD;

        // No subaccount
        assert!(!is_authorized_delegate(user_addr, delegate), 500);

        // With subaccount but no delegation
        create_subaccount(user);
        assert!(!is_authorized_delegate(user_addr, delegate), 501);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// assert_authorized_trader passes for owner
    fun test_assert_authorized_owner(deployer: &signer, user: &signer) acquires SubAccount {
        setup_subaccount_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let owner = assert_authorized_trader(user_addr, user_addr);
        assert!(owner == user_addr, 600);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// assert_authorized_trader passes for valid delegate
    fun test_assert_authorized_delegate(deployer: &signer, user: &signer) acquires SubAccount {
        setup_subaccount_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let delegate = @0xDEAD;

        create_subaccount(user);
        delegate_trading(user, delegate, 0);

        let owner = assert_authorized_trader(delegate, user_addr);
        assert!(owner == user_addr, 700);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    #[expected_failure(abort_code = 1, location = cash_orderbook::subaccounts)]
    /// assert_authorized_trader aborts for unauthorized
    fun test_assert_authorized_unauthorized(deployer: &signer, user: &signer) acquires SubAccount {
        setup_subaccount_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let _owner = assert_authorized_trader(@0xDEAD, user_addr);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// Delegation with expiration
    fun test_delegation_with_expiration(deployer: &signer, user: &signer) acquires SubAccount {
        setup_subaccount_test_env(deployer, user);
        let user_addr = signer::address_of(user);
        let delegate = @0xDEAD;

        create_subaccount(user);
        // Expires at timestamp 1_000_000 (1 second from epoch)
        delegate_trading(user, delegate, 1_000_000);

        // At timestamp 0 (before expiration), should be authorized
        assert!(is_authorized_delegate(user_addr, delegate), 800);
    }

    #[test(deployer = @cash_orderbook, user = @0xBEEF)]
    /// Multiple delegates
    fun test_multiple_delegates(deployer: &signer, user: &signer) acquires SubAccount {
        setup_subaccount_test_env(deployer, user);
        let user_addr = signer::address_of(user);

        create_subaccount(user);
        delegate_trading(user, @0xDEAD, 0);
        delegate_trading(user, @0xBEAD, 0);
        delegate_trading(user, @0xFEED, 0);

        assert!(is_authorized_delegate(user_addr, @0xDEAD), 900);
        assert!(is_authorized_delegate(user_addr, @0xBEAD), 901);
        assert!(is_authorized_delegate(user_addr, @0xFEED), 902);

        // Revoke one
        revoke_delegation(user, @0xBEAD);
        assert!(is_authorized_delegate(user_addr, @0xDEAD), 903);
        assert!(!is_authorized_delegate(user_addr, @0xBEAD), 904);
        assert!(is_authorized_delegate(user_addr, @0xFEED), 905);
    }
}
