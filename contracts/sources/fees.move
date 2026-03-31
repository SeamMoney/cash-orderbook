/// Fee infrastructure module for the Cash Orderbook.
/// Manages maker/taker fee configuration and fee collection.
///
/// FeeConfig: maker_fee_bps and taker_fee_bps (both 0 at launch).
/// FeeVault: collects fees per asset.
/// Admin can update fee config via update_fee_config().
/// On trade, calculate_and_collect_fees() deducts fees and credits vault.
module cash_orderbook::fees {
    use std::signer;
    use aptos_framework::event;
    use aptos_std::smart_table::{Self, SmartTable};
    use cash_orderbook::types;

    // ========== Error Codes ==========
    const E_UNAUTHORIZED: u64 = 1;
    const E_INVALID_AMOUNT: u64 = 4;
    const E_ALREADY_EXISTS: u64 = 11;
    const E_FEE_TOO_HIGH: u64 = 12;

    // ========== Constants ==========
    /// Maximum allowed fee in basis points (10% = 1000 bps)
    const MAX_FEE_BPS: u64 = 1000;
    /// Basis points denominator
    const BPS_DENOMINATOR: u64 = 10_000;

    // ========== Resources ==========

    /// Global fee configuration, stored at the resource account address.
    struct FeeConfig has key {
        /// Maker fee in basis points (0 at init)
        maker_fee_bps: u64,
        /// Taker fee in basis points (0 at init)
        taker_fee_bps: u64,
    }

    /// Fee vault that accumulates collected fees per asset.
    /// Stored at the resource account address.
    struct FeeVault has key {
        /// Mapping: asset metadata address -> accumulated fee amount
        collected_fees: SmartTable<address, u64>,
    }

    // ========== Events ==========

    #[event]
    struct FeeConfigUpdated has drop, store {
        /// Admin who made the change
        admin: address,
        /// New maker fee in bps
        maker_fee_bps: u64,
        /// New taker fee in bps
        taker_fee_bps: u64,
    }

    #[event]
    struct FeeCollected has drop, store {
        /// Asset the fee was collected in
        asset: address,
        /// Fee amount collected
        amount: u64,
        /// Whether this is a maker or taker fee
        is_maker_fee: bool,
        /// The trader who paid the fee
        trader: address,
    }

    // ========== Init ==========

    /// Initialize fee infrastructure. Called by types::init_module indirectly,
    /// or separately. Idempotent.
    public(friend) fun init_fees() {
        let resource_addr = types::get_resource_account_address();
        if (!exists<FeeConfig>(resource_addr)) {
            let resource_signer = types::get_resource_signer();
            move_to(&resource_signer, FeeConfig {
                maker_fee_bps: 0,
                taker_fee_bps: 0,
            });
            move_to(&resource_signer, FeeVault {
                collected_fees: smart_table::new(),
            });
        };
    }

    // ========== Entry Functions ==========

    /// Update fee configuration. Only admin can call this.
    /// Both maker_fee_bps and taker_fee_bps must be <= MAX_FEE_BPS (1000 = 10%).
    ///
    /// Aborts with E_UNAUTHORIZED if caller is not admin.
    /// Aborts with E_FEE_TOO_HIGH if either fee exceeds MAX_FEE_BPS.
    public entry fun update_fee_config(
        admin: &signer,
        maker_fee_bps: u64,
        taker_fee_bps: u64,
    ) acquires FeeConfig {
        // Verify admin
        types::assert_admin(admin);

        // Validate fee bounds
        assert!(maker_fee_bps <= MAX_FEE_BPS, E_FEE_TOO_HIGH);
        assert!(taker_fee_bps <= MAX_FEE_BPS, E_FEE_TOO_HIGH);

        let resource_addr = types::get_resource_account_address();

        // Initialize if not yet initialized
        if (!exists<FeeConfig>(resource_addr)) {
            init_fees();
        };

        // Update config
        let config = borrow_global_mut<FeeConfig>(resource_addr);
        config.maker_fee_bps = maker_fee_bps;
        config.taker_fee_bps = taker_fee_bps;

        // Emit event
        event::emit(FeeConfigUpdated {
            admin: signer::address_of(admin),
            maker_fee_bps,
            taker_fee_bps,
        });
    }

    // ========== Fee Calculation ==========

    /// Calculate maker fee for a given quote amount.
    /// Returns the fee amount in quote asset units.
    public fun calculate_maker_fee(quote_amount: u64): u64 acquires FeeConfig {
        let resource_addr = types::get_resource_account_address();
        if (!exists<FeeConfig>(resource_addr)) {
            return 0
        };
        let config = borrow_global<FeeConfig>(resource_addr);
        if (config.maker_fee_bps == 0) {
            return 0
        };
        // fee = quote_amount * fee_bps / BPS_DENOMINATOR
        // Use u128 to prevent overflow
        (((quote_amount as u128) * (config.maker_fee_bps as u128) / (BPS_DENOMINATOR as u128)) as u64)
    }

    /// Calculate taker fee for a given quote amount.
    /// Returns the fee amount in quote asset units.
    public fun calculate_taker_fee(quote_amount: u64): u64 acquires FeeConfig {
        let resource_addr = types::get_resource_account_address();
        if (!exists<FeeConfig>(resource_addr)) {
            return 0
        };
        let config = borrow_global<FeeConfig>(resource_addr);
        if (config.taker_fee_bps == 0) {
            return 0
        };
        (((quote_amount as u128) * (config.taker_fee_bps as u128) / (BPS_DENOMINATOR as u128)) as u64)
    }

    /// Calculate the maximum possible fee for a given quote amount.
    /// Returns max(taker_fee, maker_fee) so callers can lock sufficient funds
    /// regardless of whether the order ends up as taker or maker.
    public fun calculate_max_fee(quote_amount: u64): u64 acquires FeeConfig {
        let resource_addr = types::get_resource_account_address();
        if (!exists<FeeConfig>(resource_addr)) {
            return 0
        };
        let config = borrow_global<FeeConfig>(resource_addr);
        let max_bps = if (config.taker_fee_bps > config.maker_fee_bps) {
            config.taker_fee_bps
        } else {
            config.maker_fee_bps
        };
        if (max_bps == 0) {
            return 0
        };
        (((quote_amount as u128) * (max_bps as u128) / (BPS_DENOMINATOR as u128)) as u64)
    }

    /// Collect a fee into the vault. Called by settlement.
    /// Deducts fee from trader's available balance and credits fee vault.
    public(friend) fun collect_fee(
        asset_addr: address,
        amount: u64,
        is_maker_fee: bool,
        trader: address,
    ) acquires FeeVault {
        if (amount == 0) return;

        let resource_addr = types::get_resource_account_address();
        if (!exists<FeeVault>(resource_addr)) {
            init_fees();
        };

        let vault = borrow_global_mut<FeeVault>(resource_addr);
        let current = if (smart_table::contains(&vault.collected_fees, asset_addr)) {
            *smart_table::borrow(&vault.collected_fees, asset_addr)
        } else {
            0
        };
        smart_table::upsert(&mut vault.collected_fees, asset_addr, current + amount);

        // Emit event
        event::emit(FeeCollected {
            asset: asset_addr,
            amount,
            is_maker_fee,
            trader,
        });
    }

    // ========== View Functions ==========

    #[view]
    /// Get the current fee configuration.
    /// Returns (maker_fee_bps, taker_fee_bps).
    public fun get_fee_config(): (u64, u64) acquires FeeConfig {
        let resource_addr = types::get_resource_account_address();
        if (!exists<FeeConfig>(resource_addr)) {
            return (0, 0)
        };
        let config = borrow_global<FeeConfig>(resource_addr);
        (config.maker_fee_bps, config.taker_fee_bps)
    }

    #[view]
    /// Get collected fees for a specific asset.
    public fun get_collected_fees(asset_addr: address): u64 acquires FeeVault {
        let resource_addr = types::get_resource_account_address();
        if (!exists<FeeVault>(resource_addr)) {
            return 0
        };
        let vault = borrow_global<FeeVault>(resource_addr);
        if (smart_table::contains(&vault.collected_fees, asset_addr)) {
            *smart_table::borrow(&vault.collected_fees, asset_addr)
        } else {
            0
        }
    }

    // ========== Friend Declarations ==========
    friend cash_orderbook::settlement;

    // ========== Tests ==========

    #[test_only]
    public fun init_fees_for_test() {
        init_fees();
    }

    #[test_only]
    use aptos_framework::account as test_account;

    #[test_only]
    fun setup_fee_test_env(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);
        test_account::create_account_for_test(deployer_addr);
        types::init_module_for_test(deployer);
        let resource_signer = types::get_resource_signer();
        let resource_addr = signer::address_of(&resource_signer);
        test_account::create_account_for_test(resource_addr);
        init_fees();
    }

    #[test(deployer = @cash_orderbook)]
    /// VAL-CONTRACT-024: FeeConfig starts at 0/0
    fun test_fee_config_starts_at_zero(deployer: &signer) acquires FeeConfig {
        setup_fee_test_env(deployer);
        let (maker, taker) = get_fee_config();
        assert!(maker == 0, 100);
        assert!(taker == 0, 101);
    }

    #[test(deployer = @cash_orderbook)]
    /// VAL-CONTRACT-024: update_fee_config changes fees
    fun test_update_fee_config(deployer: &signer) acquires FeeConfig {
        setup_fee_test_env(deployer);

        // Update fees to 10 bps maker, 30 bps taker
        update_fee_config(deployer, 10, 30);

        let (maker, taker) = get_fee_config();
        assert!(maker == 10, 200);
        assert!(taker == 30, 201);
    }

    #[test(deployer = @cash_orderbook, non_admin = @0xBEEF)]
    #[expected_failure(abort_code = 1, location = cash_orderbook::types)]
    /// update_fee_config unauthorized
    fun test_update_fee_config_unauthorized(deployer: &signer, non_admin: &signer) acquires FeeConfig {
        setup_fee_test_env(deployer);
        update_fee_config(non_admin, 10, 30);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 12, location = cash_orderbook::fees)]
    /// update_fee_config rejects fees too high
    fun test_update_fee_config_too_high(deployer: &signer) acquires FeeConfig {
        setup_fee_test_env(deployer);
        update_fee_config(deployer, 1001, 30); // 1001 > MAX_FEE_BPS
    }

    #[test(deployer = @cash_orderbook)]
    /// Zero fee calculates to zero
    fun test_zero_fee_calculation(deployer: &signer) acquires FeeConfig {
        setup_fee_test_env(deployer);
        let maker_fee = calculate_maker_fee(1_000_000_000);
        let taker_fee = calculate_taker_fee(1_000_000_000);
        assert!(maker_fee == 0, 300);
        assert!(taker_fee == 0, 301);
    }

    #[test(deployer = @cash_orderbook)]
    /// Non-zero fee calculation is correct
    fun test_nonzero_fee_calculation(deployer: &signer) acquires FeeConfig {
        setup_fee_test_env(deployer);
        update_fee_config(deployer, 10, 30); // 0.1% maker, 0.3% taker

        // 100 USDC = 100_000_000 units
        let maker_fee = calculate_maker_fee(100_000_000);
        // 100_000_000 * 10 / 10_000 = 100_000 (0.1 USDC)
        assert!(maker_fee == 100_000, 400);

        let taker_fee = calculate_taker_fee(100_000_000);
        // 100_000_000 * 30 / 10_000 = 300_000 (0.3 USDC)
        assert!(taker_fee == 300_000, 401);
    }

    #[test(deployer = @cash_orderbook)]
    /// Collect fee accumulates in vault
    fun test_collect_fee(deployer: &signer) acquires FeeVault {
        setup_fee_test_env(deployer);

        let asset = @0x1234;
        collect_fee(asset, 100_000, false, @0xBEEF);
        assert!(get_collected_fees(asset) == 100_000, 500);

        collect_fee(asset, 200_000, true, @0xCAFE1);
        assert!(get_collected_fees(asset) == 300_000, 501);
    }

    #[test(deployer = @cash_orderbook)]
    /// Collect zero fee is a no-op
    fun test_collect_zero_fee(deployer: &signer) acquires FeeVault {
        setup_fee_test_env(deployer);
        let asset = @0x1234;
        collect_fee(asset, 0, false, @0xBEEF);
        assert!(get_collected_fees(asset) == 0, 600);
    }

    #[test(deployer = @cash_orderbook)]
    /// Update fees back to zero
    fun test_update_fee_back_to_zero(deployer: &signer) acquires FeeConfig {
        setup_fee_test_env(deployer);

        update_fee_config(deployer, 10, 30);
        let (maker, taker) = get_fee_config();
        assert!(maker == 10 && taker == 30, 700);

        update_fee_config(deployer, 0, 0);
        let (maker2, taker2) = get_fee_config();
        assert!(maker2 == 0 && taker2 == 0, 701);

        // Fees should now calculate to zero
        assert!(calculate_maker_fee(100_000_000) == 0, 702);
        assert!(calculate_taker_fee(100_000_000) == 0, 703);
    }
}
