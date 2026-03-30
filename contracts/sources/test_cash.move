/// TestCASH FungibleAsset module for testnet integration testing.
/// Deploys a TestCASH token with 6 decimals, mints 1B supply to deployer.
/// Includes a faucet function for seeding test accounts.
module cash_orderbook::test_cash {
    use std::signer;
    use std::string;
    use std::option;
    use aptos_framework::object::{Self, Object};
    use aptos_framework::fungible_asset::{Self, Metadata, MintRef, BurnRef, TransferRef};
    use aptos_framework::primary_fungible_store;

    // ========== Error Codes ==========
    const E_UNAUTHORIZED: u64 = 1;
    const E_INVALID_AMOUNT: u64 = 4;
    const E_NOT_INITIALIZED: u64 = 12;

    // ========== Constants ==========
    /// 1 billion tokens with 6 decimals = 1_000_000_000 * 1_000_000 = 1_000_000_000_000_000
    const INITIAL_SUPPLY: u64 = 1_000_000_000_000_000;
    const DECIMALS: u8 = 6;
    const NAME: vector<u8> = b"Test CASH";
    const SYMBOL: vector<u8> = b"tCASH";
    const ICON_URI: vector<u8> = b"";
    const PROJECT_URI: vector<u8> = b"https://cash.exchange";

    // ========== Seed for named object ==========
    const ASSET_SEED: vector<u8> = b"TestCASH";

    // ========== Resources ==========

    /// Stores the mint/burn/transfer refs for the TestCASH token.
    /// Only the admin (deployer) can access these capabilities.
    struct TestCashRefs has key {
        mint_ref: MintRef,
        burn_ref: BurnRef,
        transfer_ref: TransferRef,
        admin: address,
    }

    // ========== Init Module ==========

    /// Called once on module publish. Creates the TestCASH FungibleAsset,
    /// mints 1B supply to the deployer, and stores capability refs.
    fun init_module(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);

        // Create a named object to hold the FA metadata
        let constructor_ref = object::create_named_object(deployer, ASSET_SEED);

        // Create the FungibleAsset with primary store enabled
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            &constructor_ref,
            option::none(),                    // max_supply (unlimited for testnet)
            string::utf8(NAME),                // name
            string::utf8(SYMBOL),              // symbol
            DECIMALS,                          // decimals
            string::utf8(ICON_URI),            // icon_uri
            string::utf8(PROJECT_URI),         // project_uri
        );

        // Generate capability refs
        let mint_ref = fungible_asset::generate_mint_ref(&constructor_ref);
        let burn_ref = fungible_asset::generate_burn_ref(&constructor_ref);
        let transfer_ref = fungible_asset::generate_transfer_ref(&constructor_ref);

        // Mint initial supply (1B tokens) to the deployer BEFORE moving refs
        let fa = fungible_asset::mint(&mint_ref, INITIAL_SUPPLY);
        primary_fungible_store::deposit(deployer_addr, fa);

        // Store refs in the metadata object
        let metadata_signer = object::generate_signer(&constructor_ref);
        move_to(&metadata_signer, TestCashRefs {
            mint_ref,
            burn_ref,
            transfer_ref,
            admin: deployer_addr,
        });

        // Verify the minted amount (sanity check)
        let metadata = object::object_from_constructor_ref<Metadata>(&constructor_ref);
        let balance = primary_fungible_store::balance(deployer_addr, metadata);
        assert!(balance == INITIAL_SUPPLY, 999);
    }

    // ========== Entry Functions ==========

    /// Faucet function: admin mints TestCASH to any recipient address.
    /// Used for seeding test accounts on testnet.
    ///
    /// Aborts with E_UNAUTHORIZED if caller is not the admin.
    /// Aborts with E_INVALID_AMOUNT if amount is 0.
    public entry fun mint_test_cash(
        admin: &signer,
        recipient: address,
        amount: u64,
    ) acquires TestCashRefs {
        assert!(amount > 0, E_INVALID_AMOUNT);

        let metadata_addr = get_metadata_address();
        assert!(exists<TestCashRefs>(metadata_addr), E_NOT_INITIALIZED);

        let refs = borrow_global<TestCashRefs>(metadata_addr);
        assert!(signer::address_of(admin) == refs.admin, E_UNAUTHORIZED);

        let fa = fungible_asset::mint(&refs.mint_ref, amount);
        primary_fungible_store::deposit(recipient, fa);
    }

    // ========== View Functions ==========

    // Returns the metadata object address for TestCASH.
    #[view]
    public fun get_metadata_address(): address {
        object::create_object_address(&@cash_orderbook, ASSET_SEED)
    }

    // Returns the metadata object for TestCASH.
    #[view]
    public fun get_metadata(): Object<Metadata> {
        let addr = get_metadata_address();
        object::address_to_object<Metadata>(addr)
    }

    // Returns the balance of TestCASH for a given address.
    #[view]
    public fun balance(account: address): u64 {
        let metadata = get_metadata();
        primary_fungible_store::balance(account, metadata)
    }

    // Returns the total supply of TestCASH (current minted, not a cap).
    #[view]
    public fun total_supply(): u128 {
        let metadata = get_metadata();
        let supply_opt = fungible_asset::supply(metadata);
        if (option::is_some(&supply_opt)) {
            option::extract(&mut supply_opt)
        } else {
            0
        }
    }

    // Returns the decimals of TestCASH.
    #[view]
    public fun decimals(): u8 {
        let metadata = get_metadata();
        fungible_asset::decimals(metadata)
    }

    // Returns the name of TestCASH.
    #[view]
    public fun name(): string::String {
        let metadata = get_metadata();
        fungible_asset::name(metadata)
    }

    // Returns the symbol of TestCASH.
    #[view]
    public fun symbol(): string::String {
        let metadata = get_metadata();
        fungible_asset::symbol(metadata)
    }

    // ========== Tests ==========

    #[test_only]
    use aptos_framework::account as test_account;

    #[test_only]
    /// Public entry point for tests in other modules to initialize TestCASH.
    public fun init_module_for_test(deployer: &signer) {
        init_module(deployer);
    }

    #[test(deployer = @cash_orderbook)]
    fun test_init_metadata_decimals(deployer: &signer) {
        test_account::create_account_for_test(signer::address_of(deployer));
        init_module(deployer);

        // Verify decimals
        let metadata = get_metadata();
        assert!(fungible_asset::decimals(metadata) == 6, 100);
    }

    #[test(deployer = @cash_orderbook)]
    fun test_init_metadata_name(deployer: &signer) {
        test_account::create_account_for_test(signer::address_of(deployer));
        init_module(deployer);

        // Verify name
        let metadata = get_metadata();
        assert!(fungible_asset::name(metadata) == string::utf8(b"Test CASH"), 200);
    }

    #[test(deployer = @cash_orderbook)]
    fun test_init_metadata_symbol(deployer: &signer) {
        test_account::create_account_for_test(signer::address_of(deployer));
        init_module(deployer);

        // Verify symbol
        let metadata = get_metadata();
        assert!(fungible_asset::symbol(metadata) == string::utf8(b"tCASH"), 300);
    }

    #[test(deployer = @cash_orderbook)]
    fun test_init_supply_minted_to_deployer(deployer: &signer) {
        let deployer_addr = signer::address_of(deployer);
        test_account::create_account_for_test(deployer_addr);
        init_module(deployer);

        // Verify 1B supply minted to deployer
        let deployer_balance = balance(deployer_addr);
        assert!(deployer_balance == INITIAL_SUPPLY, 400);
        // 1B * 10^6 = 1_000_000_000_000_000
        assert!(deployer_balance == 1_000_000_000_000_000, 401);
    }

    #[test(deployer = @cash_orderbook)]
    fun test_total_supply_after_init(deployer: &signer) {
        test_account::create_account_for_test(signer::address_of(deployer));
        init_module(deployer);

        // Verify total supply matches initial mint
        let supply = total_supply();
        assert!(supply == (INITIAL_SUPPLY as u128), 500);
    }

    #[test(deployer = @cash_orderbook)]
    fun test_view_functions(deployer: &signer) {
        test_account::create_account_for_test(signer::address_of(deployer));
        init_module(deployer);

        // Verify all view functions work
        assert!(decimals() == 6, 600);
        assert!(name() == string::utf8(b"Test CASH"), 601);
        assert!(symbol() == string::utf8(b"tCASH"), 602);
    }

    #[test(deployer = @cash_orderbook, recipient = @0xBEEF)]
    fun test_mint_test_cash_success(deployer: &signer, recipient: &signer) acquires TestCashRefs {
        let deployer_addr = signer::address_of(deployer);
        let recipient_addr = signer::address_of(recipient);
        test_account::create_account_for_test(deployer_addr);
        test_account::create_account_for_test(recipient_addr);
        init_module(deployer);

        // Admin mints 1000 tokens (1000 * 10^6) to recipient
        let mint_amount = 1_000_000_000; // 1000 tokens
        mint_test_cash(deployer, recipient_addr, mint_amount);

        // Verify recipient balance
        let recipient_balance = balance(recipient_addr);
        assert!(recipient_balance == mint_amount, 700);

        // Verify total supply increased
        let supply = total_supply();
        assert!(supply == ((INITIAL_SUPPLY as u128) + (mint_amount as u128)), 701);
    }

    #[test(deployer = @cash_orderbook, recipient = @0xBEEF)]
    fun test_mint_test_cash_multiple(deployer: &signer, recipient: &signer) acquires TestCashRefs {
        let deployer_addr = signer::address_of(deployer);
        let recipient_addr = signer::address_of(recipient);
        test_account::create_account_for_test(deployer_addr);
        test_account::create_account_for_test(recipient_addr);
        init_module(deployer);

        // Mint twice to same recipient
        mint_test_cash(deployer, recipient_addr, 500_000_000);
        mint_test_cash(deployer, recipient_addr, 300_000_000);

        // Verify cumulative balance
        assert!(balance(recipient_addr) == 800_000_000, 800);
    }

    #[test(deployer = @cash_orderbook, non_admin = @0xDEAD)]
    #[expected_failure(abort_code = 1, location = cash_orderbook::test_cash)] // E_UNAUTHORIZED
    fun test_mint_test_cash_unauthorized(deployer: &signer, non_admin: &signer) acquires TestCashRefs {
        let deployer_addr = signer::address_of(deployer);
        let non_admin_addr = signer::address_of(non_admin);
        test_account::create_account_for_test(deployer_addr);
        test_account::create_account_for_test(non_admin_addr);
        init_module(deployer);

        // Non-admin tries to mint — should abort
        mint_test_cash(non_admin, @0xBEEF, 1_000_000);
    }

    #[test(deployer = @cash_orderbook)]
    #[expected_failure(abort_code = 4, location = cash_orderbook::test_cash)] // E_INVALID_AMOUNT
    fun test_mint_test_cash_zero_amount(deployer: &signer) acquires TestCashRefs {
        test_account::create_account_for_test(signer::address_of(deployer));
        init_module(deployer);

        // Minting zero should abort
        mint_test_cash(deployer, @0xBEEF, 0);
    }
}
