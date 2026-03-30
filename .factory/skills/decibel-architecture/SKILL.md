---
name: decibel-architecture
description: Complete architecture reference for the Decibel/Econia perpetual DEX protocol we are forking. Covers all 51 Move modules, matching engine, liquidation, positions, fees, oracle, vaults, and admin system.
user-invocable: true
---

# Decibel Protocol Architecture (Fork Reference)

We are forking the Decibel perpetual DEX. This is the complete architecture reference from the decibrrr codebase (51 Move modules).

## Module Map

```
Core Engine
├── perp_engine.move              Main coordinator (register market, place order, deposit/withdraw)
├── perp_market.move              Wrapper around order book, limit order interface
├── perp_engine_types.move        Order metadata, TP/SL, TWAP, action types
├── clearinghouse_perp.move       Trade settlement, reduce-only, OI caps
└── perp_market_config.move       Market parameters validation

Matching Engine
├── async_matching_engine.move    FIFO queue, TWAP scheduler, liquidation priority queue
├── order_placement_utils.move    Places orders, executes callback actions
├── order_margin.move             Margin tracking for pending orders
└── pending_order_tracker.move    TP/SL tracking, child order lifecycle

Position Management
├── perp_positions.move           Position storage (BigOrderedMap), funding checkpoints
├── position_update.move          Two-phase validate→commit, cross vs isolated margin
├── position_tp_sl.move           Take-profit / stop-loss management
├── position_tp_sl_tracker.move   TP/SL tracking per position
└── tp_sl_utils.move              TP/SL validation and child order creation

Liquidation (3-tier)
├── liquidation.move              Margin call → Backstop → ADL cascade
├── liquidation_config.move       Thresholds and parameters
├── adl_tracker.move              Auto-deleveraging tracking
└── backstop_liquidator_profit_tracker.move

Account System
├── dex_accounts.move             Subaccounts with delegated permissions
├── dex_accounts_vault_extension.move
├── accounts_collateral.move      Collateral balance sheet
└── collateral_balance_sheet.move Core balance tracking

Fee System
├── trading_fees_manager.move     7-tier volume-based fees
├── volume_tracker.move           Volume aggregation
├── fee_treasury.move             Collection and distribution
├── fee_distribution.move         Split calculations
├── builder_code_registry.move    Frontend integrator fees (max 10bps)
├── referral_registry.move        Referral program
└── open_interest_tracker.move    OI caps per market

Oracle & Pricing
├── oracle.move                   Multi-source (Internal, Pyth, Chainlink)
├── price_management.move         Mark price = median of 3 EMAs, funding rate
├── spread_ema.move               EMA calculations
├── chainlink_state.move          Chainlink state
└── internal_oracle_state.move    Internal price feeds

Vault System
├── vault.move                    Managed investment vaults with share tokens
├── vault_api.move                Public interface
├── vault_share_asset.move        Share token definitions
├── async_vault_work.move         Async position closing for redemptions
└── vault_global_config.move      Global config

Math & Utilities
├── math.move                     General math
├── i64_math.move                 Signed 64-bit math
├── i64_aggregator.move           Concurrent i64 updates
├── slippage_math.move            Slippage calculations
└── decibel_time.move             Time tracking

Admin
├── admin_apis.move               Permission hierarchy (Deployer > ElevatedAdmin > Admin > Oracle)
└── public_apis.move              Public entry functions
```

## Matching Engine (async_matching_engine.move)

### Queue Priority
```
PendingRequestKey ordering:
├── Liquidation (priority)
│   time=1 → liquidation orders
│   time=2 → checkADL
│   time=3 → refreshMarkPrice
└── RegularTransaction
    time=microsecond_timestamp
    tie_breaker=monotonic_counter
```

Max 100 requests drained per call.

### Order Types
- **Limit**: GTC, IOC (Immediate or Cancel), FOK (Fill or Kill)
- **Market**: Immediate execution with slippage tolerance
- **TWAP**: Equal slices at intervals (min 60s freq, min 120s duration, max 24h)
- **Trigger**: Stop-loss / take-profit with price triggers
- **Reduce-Only**: Can only decrease position
- **Bulk**: Simplified for market makers (no TP/SL, no reduce-only)

### Order Metadata
```move
// Retail orders (full features)
V1_RETAIL {
    is_reduce_only: bool,
    use_backstop_liquidation_margin: bool,
    is_margin_call: bool,
    twap: Option<TwapMetadata>,
    tp_sl: TpSlMetadata,
    builder_code: Option<BuilderCode>,
}

// Market maker orders (minimal overhead)
V1_BULK {
    builder_code: Option<BuilderCode>,
}
```

## Settlement Flow (clearinghouse_perp.move)

```
1. Order Book Match (taker meets maker)
2. Reduce-Only Validation — cap size if needed
3. Open Interest Check — verify within OI cap
4. Position Update Validation (both sides)
   → Check margin, leverage, no liquidation trigger
5. Fee Calculation
   → Maker fee (rebate if qualified)
   → Taker fee (tiered by volume)
   → Builder fee (if code provided)
6. Trade Commitment
   → Update positions, balances
   → Emit TradeEvent
7. Cleanup
   → Cancel reduce-only orders on position close
   → Create child TP/SL orders
   → Track volume for fee tiers
```

## Liquidation (3-Tier Cascade)

**Tier 1: Margin Call (Soft)**
- Trigger: equity < maintenance margin
- Action: Market orders with progressive slippage
- Only liquidates enough to restore solvency

**Tier 2: Backstop**
- Trigger: margin call fails OR equity < backstop margin
- Action: Backstop liquidator takes entire position at mark price
- Backstop absorbs any loss

**Tier 3: ADL (Auto-Deleveraging)**
- Trigger: backstop losses exceed threshold
- Action: Force-close profitable opposing positions
- Priority: highest leverage positions first

## Position Structure

```move
enum PerpPosition {
    V1 {
        size: u64,
        entry_px_times_size_sum: u128,        // For VWAP calculation
        avg_acquire_entry_px: u64,
        user_leverage: u8,                     // 1-100x
        is_long: bool,
        is_isolated: bool,                     // Cross vs isolated margin
        funding_index_at_last_update: AccumulativeIndex,
        unrealized_funding_amount_before_last_update: i64,
    }
}
```

### Position Update Results
```
Success { margin_delta, fee_distribution, realized_pnl, realized_funding_cost, ... }
Liquidatable
InsufficientMargin
InvalidLeverage
BecomesLiquidatable
```

## Fee Tiers (trading_fees_manager.move)

| Tier | 30d Volume | Maker Fee | Taker Fee |
|------|-----------|-----------|-----------|
| 0 | < $10M | 1.1 bps | 3.4 bps |
| 1 | < $50M | 0.9 bps | 3.0 bps |
| 2 | < $200M | 0.6 bps | 2.5 bps |
| 3 | < $1B | 0.3 bps | 2.2 bps |
| 4 | < $4B | 0 bps | 2.1 bps |
| 5 | < $15B | 0 bps | 1.9 bps |
| 6 | ≥ $15B | 0 bps | 1.8 bps |

Market maker rebates: negative fees for passive liquidity.

## Oracle & Mark Price

```
Mark Price = median(
    150s oracle spread EMA,
    30s oracle spread EMA,
    30s basis spread EMA
)

Funding Rate: clamped [-0.4%, +0.4%] per hour
Interest Rate: 12 bps annually (default)
```

Oracle sources: Internal, Pyth, Chainlink with deviation circuit breaker.

## Account System (dex_accounts.move)

Subaccount model with delegated permissions:
- Primary subaccount: deterministic seed `"decibel_dex_primary_v2"`
- Secondary: on-demand with custom seeds
- Permissions: TradePerpsAllMarkets, TradePerpsOnMarket, SubaccountFundsMovement, SubDelegate

## Event System (for indexer)

Key events to index:
- `TradeEvent` — size, price, pnl, funding, fee, action (OpenLong/CloseLong/OpenShort/CloseShort)
- `PositionUpdateEvent` — size, entry_price, leverage, funding_index
- `OrderEvent` — standard order lifecycle
- `TwapEvent` — Open/Triggered/Cancelled
- `LiquidationEvent` — type (MarginCall/Backstop/ADL), user, market
- `PriceUpdateEvent` — oracle_px, mark_px, funding_rate_bps
- `SubaccountCreatedEvent`, `DelegationChangedEvent`

## REST API Endpoints (off-chain)

```
GET /account_overviews?user={addr}&volume_window={7d|30d}
GET /trade_history?user={addr}&limit={n}
GET /open_orders?user={addr}
GET /positions?user={addr}
GET /active_twaps?user={addr}
GET /markets
GET /market_prices
GET /orderbook?market={symbol}
GET /candles?market={symbol}&interval={1m|5m|15m|1h|1d}
```

## Testnet Markets

```
BTC/USD:  0x274b...d557
ETH/USD:  0x3f20...d0bd
SOL/USD:  0x563b...9981
APT/USD:  0x4fd3...79ac
```

Config: lot_size=10, min_size=100000, price_decimals=6.

## Key Dependency: Econia Order Book

Decibel wraps Econia for:
- Generic order book data structures
- Price-time priority matching
- Event emission framework
- Order/TimeInForce types

Our fork should either keep Econia as a dependency or inline the critical matching logic.
