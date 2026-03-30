# Architecture — CASH Orderbook

## System Overview

A dedicated CASH/USDC spot CLOB (Central Limit Order Book) on Aptos. Single market. Three layers: on-chain contracts, off-chain backend, and web frontend.

## Components

### 1. Move Smart Contracts (`contracts/`)

The on-chain orderbook. All state lives on the Aptos blockchain.

**Core modules:**
- `orderbook` — BigOrderedMap-based order storage. Composite keys (price + timestamp + order_id) for price-time priority. Separate maps for bids (descending) and asks (ascending).
- `matching` — Taker orders match against resting book atomically in one transaction. Supports GTC, IOC, FOK, PostOnly.
- `settlement` — On fill: CASH FA transfers seller→buyer, USDC FA transfers buyer→seller. Uses `fungible_asset` + `primary_fungible_store` APIs.
- `accounts` — Deposit/withdraw FungibleAssets. Per-user per-asset balance tracking (available + locked). Subaccount system with delegation for bot trading.
- `market` — Market registration (admin-only), lot_size/tick_size/min_size config, pause/unpause/delist.
- `fees` — Configurable maker/taker fee in bps. Zero at launch. Fee vault collects fees. Admin can update fee config.
- `admin` — Permission hierarchy. Admin functions gated by signer checks.

**Key design decisions:**
- Move v2: enums, receiver syntax, BigOrderedMap (not Econia's AVL queue)
- FungibleAsset standard (not legacy coin)
- Atomic matching: place + match + settle in one transaction
- CASH: 6 decimals. USDC: 6 decimals. Prices: 6 decimal precision.
- Price scale: 1_000_000 (10^6)

**Token addresses:**
- CASH: `0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67::CASH::CASH`
- USDC: `0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b`

### 2. TypeScript SDK (`sdk/`)

`@cash/orderbook-sdk` wrapping `@aptos-labs/ts-sdk`.

- Order placement/cancellation (builds + submits transactions)
- Deposit/withdraw
- View functions (orderbook state, balances, orders)
- TypeScript strict mode, full type exports

### 3. Event Indexer + API + WebSocket (`api/`)

Single TypeScript service (Hono) that:

1. **Indexes events**: Listens to contract events via Aptos RPC polling (or gRPC if available). Processes: OrderPlaced, OrderCancelled, OrderFilled, Trade, Deposit, Withdraw.
2. **Maintains in-memory state**: Full orderbook (bids/asks), recent trades, candle aggregation (1m/5m/15m/1h/1d).
3. **REST API** (port 3100): /health, /depth, /trades, /orders/:address, /candles, /market, /balances/:address.
4. **WebSocket server** (port 3101): Channels: `orderbook` (deltas), `trades` (new fills), `account:{address}` (balance changes). Pushes updates sub-50ms after indexing.

### 4. Frontend (`web/`)

Next.js 16 + React + Tailwind v4 + shadcn/ui.

**Two views:**
- **Swap interface** (primary): Simple amount input, instant quote from book, one-click market order.
- **Advanced orderbook view**: Bid/ask ladder with depth bars, canvas depth chart, trade ticker, limit/market order form.

**Wallet connection:**
- `@aptos-labs/wallet-adapter-react` with cross-chain support
- Social login (Google/Apple via Aptos Connect)
- Ethereum wallets (MetaMask, Rainbow via AIP-113 derivation)
- Solana wallets (Phantom, Backpack via derivation)
- Native Aptos (Petra, Nightly)

## Data Flow

```
User → Frontend → SDK → Aptos RPC → Contract (on-chain)
                                          ↓
                                     Events emitted
                                          ↓
                               Indexer (polls/streams)
                                          ↓
                              In-memory state updated
                                          ↓
                         REST API responds / WS pushes delta
                                          ↓
                                    Frontend updates
```

## Invariants

1. On-chain orderbook is the source of truth. Backend state is a derived cache.
2. Every trade settles atomically: both asset transfers succeed or both fail.
3. User balances: available + locked = total deposited - total withdrawn + total received - total sent.
4. Book integrity: bids sorted descending by price, asks sorted ascending. No gaps in BigOrderedMap.
5. Price-time priority: at same price, earlier order fills first.
6. Zero fees at launch: no fee deduction on any trade until admin activates fees.
