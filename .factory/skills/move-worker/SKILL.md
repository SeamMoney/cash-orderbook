---
name: move-worker
description: Move smart contract developer for the CASH orderbook. Writes production-grade spot CLOB contracts with resource safety, gas optimization, and comprehensive testing.
---

# Move Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Features involving Move smart contract development: core orderbook data structures, matching engine, settlement, balance management, market admin, fees, events, and Move tests.

## Required Skills

- Reference `.factory/skills/move-contracts/SKILL.md` for Move patterns (module structure, abilities, events, testing)
- Reference `.factory/skills/orderbook-protocol/SKILL.md` for matching engine, order types, settlement, fee design
- Reference Decibel decompiled contracts at `/Users/maxmohammadi/decibel-security-research/decompiled/` for architecture inspiration (READ ONLY — do not copy verbatim, these are decompiled and may have artifacts)

## Work Procedure

1. **Read the feature description** carefully. Understand what modules/functions to create, what assertions this feature fulfills.

2. **Read existing contract code** in `contracts/sources/` to understand current state. Check `Move.toml` for dependencies and addresses.

3. **Write tests FIRST** (TDD):
   - Create or update test functions with `#[test]` attribute in the same module
   - Cover: happy path, error conditions (expected_failure), edge cases
   - Run `cd contracts && aptos move test --named-addresses cash_orderbook=0xCAFE` — tests should FAIL (red)

4. **Implement the contract code**:
   - Follow Move v2 patterns: enums, BigOrderedMap, FungibleAsset standard
   - Use `snake_case` for functions, `PascalCase` for structs, `UPPER_CASE` for constants
   - Named error codes: `const E_INSUFFICIENT_BALANCE: u64 = N;`
   - Validate ALL inputs at function boundary (amounts > 0, valid markets, authorized signers)
   - Emit events for every state change the indexer needs
   - CASH and USDC both have 6 decimals. PRICE_SCALE = 1_000_000.

5. **Run tests** (green):
   - `cd contracts && aptos move test --named-addresses cash_orderbook=0xCAFE`
   - ALL tests must pass
   - Run with `--coverage` to check coverage

6. **Compile check**:
   - `cd contracts && aptos move compile --named-addresses cash_orderbook=0xCAFE`
   - Must compile without errors or warnings

7. **Review your code** for:
   - Missing abort conditions (every function must handle all error cases)
   - Overflow risks (use u128/u256 intermediates for multiplication)
   - Missing events (every user-facing state change needs an event)
   - Gas optimization (minimize borrow_global_mut calls, use inline for hot-path helpers)

## Example Handoff

```json
{
  "salientSummary": "Implemented order placement module with GTC, IOC, FOK, PostOnly order types. BigOrderedMap insertion with composite OrderKey (price, timestamp, order_id). Ran `aptos move test` — 12 tests passing, including edge cases for zero price, insufficient balance, and PostOnly crossing spread.",
  "whatWasImplemented": "contracts/sources/order_placement.move: place_limit_order(), place_market_order() entry functions. OrderKey composite struct for price-time priority. Validation for all order types. OrderPlaced event emission. Tests covering all 4 order type behaviors + error cases.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "cd contracts && aptos move compile --named-addresses cash_orderbook=0xCAFE", "exitCode": 0, "observation": "Compiled successfully, 3 modules" },
      { "command": "cd contracts && aptos move test --named-addresses cash_orderbook=0xCAFE --coverage", "exitCode": 0, "observation": "12 tests passed. Coverage: 89% for order_placement module" }
    ],
    "interactiveChecks": []
  },
  "tests": {
    "added": [
      {
        "file": "contracts/sources/order_placement.move",
        "cases": [
          { "name": "test_place_gtc_limit_buy", "verifies": "GTC buy order added to bids" },
          { "name": "test_place_ioc_partial_fill", "verifies": "IOC fills available and cancels rest" },
          { "name": "test_place_fok_insufficient_liquidity", "verifies": "FOK aborts when book too thin" },
          { "name": "test_place_post_only_crosses_spread", "verifies": "PostOnly rejected when it would match" }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Move compilation fails due to missing dependency modules that should exist
- Feature requires changes to modules from a different feature
- Unsure about decimal precision or price scaling (CASH=6 decimals, USDC=6 decimals, PRICE_SCALE=1_000_000)
- BigOrderedMap API behaves unexpectedly (framework version mismatch)
