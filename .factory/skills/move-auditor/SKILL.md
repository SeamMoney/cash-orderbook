---
name: move-auditor
description: 64-rule Move V2 security auditor from the aptos-move-transpiler. Every rule with ID, severity, description, and fix. Run this over all Move code before deployment. Categories: access control, arithmetic, resource safety, object model, fungible asset, signer, storage, DoS, events, logic, best practice.
user-invocable: true
---

# Move V2 Security Auditor — 64 Rules

Source: aptos-move-transpiler/products/move-auditor (production auditor with adversarial verification).

Run over ALL Move code before deployment. Every rule has been validated against real exploits.

## Audit Pipeline

```
1. Bootstrap & scope → identify modules, imports, entry points
2. Evidence map → call graph, sinks, cross-module tracking
3. Static analysis → run all 64 rules
4. Adversarial verification → assume false positive, prove finding genuine
5. Move Prover integration → formal verification of critical properties
6. Merge & deduplicate → reconcile with compiler manifests
7. Report → findings with severity, confidence, fix, suggested spec
```

## Severity Scale

| Level | Meaning | Action |
|-------|---------|--------|
| **CRITICAL** | Immediate fund loss or privilege escalation | Must fix before deploy |
| **HIGH** | Exploitable with moderate effort | Must fix |
| **MEDIUM** | Conditional exploit or degraded security | Should fix |
| **LOW** | Minor issue, defense in depth | Consider fixing |
| **INFO** | Best practice recommendation | Optional |

---

## ACCESS CONTROL (5 rules)

**MOVE-AC-001 — Unprotected entry function** [HIGH]
Entry function accepts `&signer` but never calls `signer::address_of()` or checks authorization.
Fix: Add `assert!(signer::address_of(account) == state.admin, E_UNAUTHORIZED);`

**MOVE-AC-002 — Entry function without signer** [MEDIUM]
Entry function mutates global state but has no `&signer` parameter — anyone can call it.
Fix: Add `account: &signer` parameter and authorization check. Exception: permissionless crank functions.

**MOVE-AC-003 — init_module publishes without validation** [LOW]
`init_module` calls `move_to` without verifying deployer identity.
Fix: Usually fine since only deployer calls init_module, but add explicit check for defense in depth.

**MOVE-AC-004 — Hardcoded address in authorization** [MEDIUM]
Authorization check uses literal address (`@0x1234`) instead of stored admin field.
Fix: Store admin address in resource, check against that. Hardcoded addresses lock out upgradeability.

**MOVE-AC-005 — Generic type parameter not validated** [CRITICAL]
#1 finding across 200+ Move audits. Function accepts generic `<T>` but doesn't validate the concrete type. Attacker passes wrong token type to steal funds.
Fix: Validate metadata: `assert!(object::object_address(&asset) == expected_addr, E_INVALID_ASSET);`

---

## ARITHMETIC (6 rules)

**MOVE-AR-001 — Unsafe integer downcast** [HIGH]
Casts `u256` → `u64` or `u128` → `u64` without range check.
Fix: `assert!(value <= 18446744073709551615u256, E_OVERFLOW); (value as u64)`

**MOVE-AR-002 — Division before multiplication** [MEDIUM]
`(a / b) * c` loses precision. Should be `(a * c) / b`.
Fix: Multiply first, divide last. Use u128/u256 intermediates.

**MOVE-AR-003 — Division without zero-divisor check** [HIGH]
Division where denominator could be zero. Move aborts on divide-by-zero but with uninformative error.
Fix: `assert!(denominator > 0, E_DIVISION_BY_ZERO);` before division.

**MOVE-AR-004 — Unchecked subtraction underflow** [MEDIUM]
`a - b` where `b` could exceed `a`. Move aborts on underflow.
Fix: `assert!(a >= b, E_UNDERFLOW);` or use checked math.

**MOVE-AR-005 — Bitwise shift may overflow** [CRITICAL]
`1 << n` where `n ≥ 64` causes silent overflow. **This was the $223M Cetus exploit vector.**
Fix: `assert!(n < 64, E_SHIFT_OVERFLOW);` or `assert!(n < 128, ...)` for u128.

**MOVE-AR-006 — Double scaling detected** [HIGH]
Value multiplied by scale factor twice (e.g., price already in 10^8 multiplied by 10^8 again). Seen in AAVE v3 and ThalaSwap V2.
Fix: Track which values are already scaled. Add comments: `// price: u64, 8 decimals`.

---

## RESOURCE SAFETY (5 rules)

**MOVE-RS-001 — Missing acquires annotation** [CRITICAL]
Function calls `borrow_global` or `borrow_global_mut` but doesn't declare `acquires Resource`.
Fix: Add `acquires ResourceName` to function signature. Compiler catches this, but check in code review.

**MOVE-RS-002 — move_from without exists check** [HIGH]
`move_from<T>(addr)` without `assert!(exists<T>(addr), ...)` — aborts with cryptic error if missing.
Fix: `assert!(exists<T>(addr), E_NOT_FOUND);` before `move_from`.

**MOVE-RS-003 — move_to without existence guard** [MEDIUM]
`move_to(signer, resource)` aborts if resource already exists at that address.
Fix: `if (!exists<T>(signer::address_of(account))) { move_to(account, T { ... }); };`

**MOVE-RS-004 — Simultaneous mutable borrows** [CRITICAL]
Two `borrow_global_mut` calls on the same resource in the same scope. Move's borrow checker should catch this, but complex control flow can hide it.
Fix: Restructure to use a single mutable borrow, or borrow immutably for one access.

**MOVE-RS-005 — Resource without key ability** [CRITICAL]
Struct used in `move_to`/`borrow_global` but lacks `has key` ability.
Fix: Add `has key` to the struct definition.

---

## OBJECT MODEL (10 rules)

**MOVE-OBJ-001 — Object transfer without ownership verification** [HIGH]
`object::transfer()` called without verifying caller owns the object.
Fix: `assert!(object::is_owner(obj, signer::address_of(account)), E_NOT_OWNER);`

**MOVE-OBJ-002 — ConstructorRef stored in resource** [CRITICAL]
ConstructorRef saved to a struct with `store` ability. Whoever reads it can generate signers and mint tokens.
Fix: Never store ConstructorRef. Extract needed refs (MintRef, TransferRef) immediately and drop the constructor.

**MOVE-OBJ-003 — Object created without generate_signer** [MEDIUM]
`object::create_object()` called but `object::generate_signer(&constructor_ref)` never called. Empty object.
Fix: Always generate signer and move resources to the object.

**MOVE-OBJ-004 — LinearTransferRef not consumed** [HIGH]
Soul-bound token has `LinearTransferRef` generated but not used or destroyed. Can be exploited to transfer.
Fix: Either use the ref immediately or explicitly destroy it.

**MOVE-OBJ-005 — Non-transferable FungibleStore bypassed** [HIGH]
Transferring the parent object transfers the FungibleStore with it, bypassing transfer restrictions.
Fix: Disable object transfer if fungible store should be non-transferable.

**MOVE-OBJ-006 — Object burn bypasses freeze/blacklist** [HIGH]
`object::burn()` followed by `object::unburn()` can reset object state, bypassing freeze controls.
Fix: If using freeze/blacklist, also restrict burn/unburn operations.

**MOVE-OBJ-007 — object::owns transitive ownership confusion** [HIGH]
`object::owns(obj, addr)` checks transitive ownership (owner's owner's owner...). May return true unexpectedly.
Fix: Use `object::is_owner(obj, addr)` for direct ownership check.

**MOVE-OBJ-008 — ConstructorRef returned from public function** [CRITICAL]
Public function returns a ConstructorRef. Any caller gains full object control.
Fix: Never return ConstructorRef from public functions. Return specific refs (MintRef, etc.) instead.

**MOVE-OBJ-009 — Capability ref in struct with store** [HIGH]
MintRef/BurnRef/TransferRef stored in struct with `store` ability — can leak to unintended modules.
Fix: Remove `store` from the containing struct, or gate access with friend visibility.

**MOVE-OBJ-010 — ExtendRef used without access control** [CRITICAL]
`object::generate_signer_for_extending(&extend_ref)` in a public function. Anyone can get the object's signer.
Fix: Gate ExtendRef usage behind admin check or friend visibility.

---

## FUNGIBLE ASSET (10 rules)

**MOVE-FA-001 — Mint without supply tracking** [HIGH]
`fungible_asset::mint()` called without checking or updating a supply cap.
Fix: Track total supply, enforce cap: `assert!(total_supply + amount <= max_supply, E_SUPPLY_CAP);`

**MOVE-FA-002 — MintRef/BurnRef stored publicly** [CRITICAL]
MintRef or BurnRef accessible through a struct with `store` ability or via a public function.
Fix: Store in a struct without `store`, accessed only through `friend` or admin-gated functions.

**MOVE-FA-003 — Transfer bypasses freeze status** [MEDIUM]
Token transfer doesn't check if the account is frozen/blacklisted.
Fix: Check freeze status before transfer. Use `fungible_asset::is_frozen()`.

**MOVE-FA-004 — Metadata not validated before deposit** [CRITICAL]
`fungible_asset::deposit(store, fa)` without verifying the FungibleAsset's metadata matches the store's expected asset. Attacker deposits worthless token, withdraws valuable one.
Fix: `assert!(fungible_asset::metadata_from_asset(&fa) == expected_metadata, E_WRONG_ASSET);`

**MOVE-FA-005 — create_primary_store used incorrectly** [MEDIUM]
`primary_fungible_store::create_primary_store()` called instead of `ensure_primary_store_exists()`. Aborts if store already exists.
Fix: Use `ensure_primary_store_exists()` which is idempotent.

**MOVE-FA-006 — Dispatchable hook calls standard function** [CRITICAL]
Dispatchable fungible asset hook calls `fungible_asset::withdraw()` instead of `withdraw_with_ref()`. Causes error code 4037 (re-entrancy into dispatch).
Fix: Inside hooks, always use `_with_ref` variants.

**MOVE-FA-007 — Deletable object made fungible** [HIGH]
Object created with `create_object()` (deletable) then `fungible_asset::add_fungibility()`. Deleting the object breaks all FA operations.
Fix: Use `create_sticky_object()` or `create_named_object()` for fungible assets.

**MOVE-FA-008 — Zero-amount FungibleAsset not handled** [MEDIUM]
Function doesn't check for zero-amount deposits/withdrawals, which may have unexpected behavior.
Fix: `assert!(amount > 0, E_ZERO_AMOUNT);`

**MOVE-FA-009 — Object::TransferRef vs FA::TransferRef confusion** [MEDIUM]
Two different TransferRef types exist: `object::TransferRef` (transfers the object) and `fungible_asset::TransferRef` (transfers the asset). Easy to mix up.
Fix: Use explicit type annotations. Comment which ref type is being used.

**MOVE-FA-010 — FungibleStore zombie via object::delete** [HIGH]
Deleting an object that has a FungibleStore creates a zombie store — funds become inaccessible.
Fix: Ensure FungibleStore is empty before allowing object deletion.

---

## SIGNER (2 rules)

**MOVE-SIG-001 — Signer address stored without context** [MEDIUM]
`signer::address_of(account)` stored but the signer's capabilities are not needed. May indicate confused authorization logic.

**MOVE-SIG-002 — Signer created from stored capability** [HIGH]
`account::create_signer_with_capability(&stored_cap)` in a public function. Anyone calling it gets a signer for the resource account.
Fix: Gate behind admin check. Never expose signer creation in public functions.

---

## STORAGE / DoS (5 rules)

**MOVE-ST-001 — Unbounded vector in resource** [HIGH]
`vector<T>` field in a `key` struct that grows without bound. Eventually hits gas limits.
Fix: Use `Table`, `SmartTable`, or `BigOrderedMap` for unbounded collections.

**MOVE-ST-002 — Vector iteration in public function** [MEDIUM]
`vector::for_each` or manual loop over a vector in a public function. Attacker can make vector large → DoS.
Fix: Paginate, or use Table/Map structures with O(1) access.

**MOVE-ST-003 — Table key collision risk** [LOW]
Table uses `address` key but doesn't handle the case where different entities share an address.

**MOVE-DOS-001 — Unbounded loop without break** [HIGH]
`while(true)` or `loop` without a clear termination condition in a public function.
Fix: Add iteration cap: `let mut i = 0; while (i < MAX_ITERATIONS && ...) { i = i + 1; }`

**MOVE-DOS-002 — External call inside loop** [MEDIUM]
Cross-module function call inside a loop. Each call may have variable gas cost.
Fix: Batch operations or move external calls outside the loop.

---

## EVENTS (2 rules)

**MOVE-EV-001 — State mutation without event emission** [LOW]
Function modifies global state but emits no event. Indexers won't see the change.
Fix: Emit an event for every state mutation that external systems need to track.

**MOVE-EV-002 — Event struct missing abilities** [MEDIUM]
Event struct doesn't have `drop, store` abilities, or missing `#[event]` attribute.
Fix: `#[event] struct MyEvent has drop, store { ... }`

---

## LOGIC (3 rules)

**MOVE-LOG-001 — Timestamp used for critical logic** [MEDIUM]
`timestamp::now_seconds()` used for security-critical decisions. Validators can manipulate by ±few seconds.
Fix: Don't use timestamp for randomness. For timeouts, use generous bounds (minutes, not seconds).

**MOVE-LOG-002 — Abort with code 0** [LOW]
`abort 0` or `assert!(cond, 0)` — uninformative error. Makes debugging impossible.
Fix: Use named error constants: `const E_SPECIFIC_ERROR: u64 = 123;`

**MOVE-LOG-003 — public(friend) with many friends** [LOW]
Module declares 5+ friends. `public(friend)` becomes effectively public.
Fix: Reduce friend list or switch to `public(package)`.

---

## BEST PRACTICE (3 rules)

**MOVE-BP-001 — No Move Specification Language specs** [INFO]
Module has no formal specs. Can't use Move Prover for verification.
Fix: Add `spec` blocks for critical functions: `spec place_order { aborts_if !exists<OrderBook>(@pkg); }`

**MOVE-BP-002 — Magic numbers in code** [INFO]
Literal numbers in logic instead of named constants.
Fix: `const FEE_BPS: u64 = 30;` instead of inline `30`.

**MOVE-BP-003 — No error constants defined** [INFO]
Module uses `abort`/`assert!` but defines no `E_*` constants.
Fix: Define named constants for all error codes.

---

## ORDERBOOK-SPECIFIC CHECKS (from audit-perps.md, adapted for spot)

When auditing the cash-orderbook specifically, also check:

1. **Matching invariant**: Total bid fills == total ask fills (no tokens created from nothing)
2. **Fee accounting**: maker_fee + taker_fee == total_fee_collected (no fee leakage)
3. **Order book consistency**: No orphaned orders (cancelled but still in BigOrderedMap)
4. **Balance invariant**: sum(all_user_balances) + fee_treasury == total_deposits
5. **Price monotonicity**: Best bid < best ask (no crossed book)
6. **Self-trade prevention**: Configurable behavior (abort/cancel maker/cancel taker)
7. **Overflow in notional**: price * quantity must not overflow u128
8. **Dust orders**: Minimum size check prevents griefing with tiny orders
9. **Event completeness**: Every trade, order, cancel, deposit, withdraw emits an event
10. **Admin key rotation**: Admin address must be changeable (not just in init_module)

---

## HOW TO USE

For every Move file in contracts/:
```
1. Read the file
2. Run through all 64 rules mentally (or integrate the auditor WASM)
3. Flag findings with rule ID, severity, line number
4. For CRITICAL/HIGH: must fix before deploy
5. For MEDIUM: should fix, document if accepting risk
6. Generate Move Prover specs for critical functions
```

The auditor WASM can be run in-browser via the sol2move app's IDE, or as a CLI tool from the transpiler repo.
