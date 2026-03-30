# Cash Orderbook — Aptos CLOB

Central Limit Order Book on Aptos blockchain. Production DeFi trading infrastructure.

## Architecture

```
contracts/          Move smart contracts (orderbook core, matching engine, settlement)
sdk/                TypeScript SDK (@cash/orderbook-sdk) for contract interaction
indexer/            Event indexer — tracks order state, trade history, book snapshots
api/                REST API + WebSocket server for frontend and external consumers
web/                Trading dashboard — Next.js, React, Tailwind, real-time UI
shared/             Shared types, constants, ABIs across packages
scripts/            Deployment, migration, and utility scripts
```

## Tech Stack

- **Smart Contracts**: Move language on Aptos (aptos-framework, FungibleAsset standard)
- **SDK**: TypeScript, @aptos-labs/ts-sdk
- **Indexer**: TypeScript, Aptos Indexer API / custom event processor
- **API**: TypeScript, Hono or Express, WebSocket (ws)
- **Frontend**: Next.js 16, React, Tailwind CSS, Framer Motion
- **Monorepo**: Turborepo with pnpm workspaces

## Build & Test

```bash
# Install dependencies
pnpm install

# Move contracts
cd contracts && aptos move compile && aptos move test

# TypeScript packages
pnpm -r build
pnpm -r test

# Frontend dev server
cd web && pnpm dev

# Full type check
pnpm -r typecheck
```

## Aptos / Move Context

- Aptos uses the **Move** language — resource-oriented, linear types, no reentrancy
- Coin standard: `fungible_asset` module (not legacy `coin` module)
- High throughput (~100k TPS), sub-second finality, parallel execution via Block-STM
- Smart contracts are **modules** published to accounts, not standalone contracts
- Resources are stored in accounts, accessed via `borrow_global`, `move_to`, `move_from`
- Events emitted via `event::emit()` — the indexer processes these
- Use `#[view]` functions for read-only on-chain queries
- Gas optimization: minimize storage operations, use inline functions, avoid unnecessary copies
- Testing: `#[test]` attribute, `aptos move test --coverage`

## Orderbook Design

- **Price-time priority**: orders matched by best price first, then earliest timestamp
- **Order types**: limit, market, cancel, amend
- **On-chain**: order placement, matching, settlement, balance management
- **Off-chain**: orderbook aggregation, depth snapshots, trade history, WebSocket streaming
- **Trading pairs**: support multiple base/quote asset pairs
- **Fees**: maker/taker fee structure, configurable per pair
- **Admin**: pair listing, fee updates, emergency pause

## Conventions

- TypeScript: strict mode, no `any`, explicit return types on exports
- Move: snake_case for functions/variables, PascalCase for structs, UPPER_CASE for constants
- Error codes: named constants (e.g., `const E_INSUFFICIENT_BALANCE: u64 = 1;`)
- Git: conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)
- Tests: colocated with source (`*.test.ts`, Move `#[test]` in same module)
- Frontend components: one component per file, PascalCase filenames

## Security

- No hardcoded private keys or mnemonics — use env vars for deployment
- Move contracts must handle all abort conditions explicitly
- Validate all inputs at contract boundary (amounts > 0, valid pairs, etc.)
- Orderbook manipulation resistance: minimum order sizes, rate limiting in API
- Admin functions gated by signer authority checks
- WebSocket connections authenticated via JWT

## Frontend Design

- Dark mode first — zinc/slate tokens, green accent for bids, red for asks
- Geist Sans for UI, Geist Mono for prices/amounts/IDs
- Real-time: animated orderbook ladder, depth chart, trade ticker
- Responsive but desktop-primary (trading UI)
- Framer Motion for transitions, CSS @keyframes for continuous animations
- shadcn/ui components as the base design system
