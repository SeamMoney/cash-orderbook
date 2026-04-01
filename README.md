# CASH Orderbook

> The Fastest CASH Swap Ever. True Zero-Slippage Atomic On-Chain Orderbook.

A full-stack Central Limit Order Book (CLOB) on Aptos blockchain. Move smart contracts handle order matching and settlement on-chain, while a TypeScript backend and Next.js frontend deliver a real-time trading experience with a Uniswap-style token detail interface and Cash App design language.

CASH/USD1 is the primary trading pair, using World Liberty Financial's USD1 stablecoin (8 decimals) as the default quote asset. Multi-stablecoin swap support lets users trade CASH against USDC, USDT, USDe, and GHO via Panora aggregator routing, while CASH/USD1 settles directly through the on-chain orderbook.

## Architecture

```
contracts/   Move smart contracts — orderbook core, matching engine, settlement
sdk/         TypeScript SDK (@cash/orderbook-sdk) for contract interaction
api/         REST API (Hono, port 3100) + WebSocket server (port 3101)
web/         Next.js 16 trading dashboard (port 3102)
shared/      Shared types, constants, ABIs across packages
scripts/     Deployment, integration tests, and utility scripts
```

## Tech Stack

| Layer            | Stack                                                    |
| ---------------- | -------------------------------------------------------- |
| Smart Contracts  | Move on Aptos (FungibleAsset standard)                   |
| SDK              | TypeScript, @aptos-labs/ts-sdk                           |
| API              | Hono, WebSocket (ws), Zod                                |
| Frontend         | Next.js 16, React 19, Tailwind CSS 4, Framer Motion     |
| Charting         | lightweight-charts v5 (CandlestickSeries, Line toggle)  |
| Swap Routing     | Panora API (non-USD1 pairs), direct orderbook (USD1)     |
| Price Data       | GeckoTerminal API via LiquidSwap (181 daily candles)     |
| Monorepo         | Turborepo + pnpm workspaces                              |

## Supported Tokens

| Token | Type         | Decimals | Role          |
| ----- | ------------ | -------- | ------------- |
| CASH  | Legacy Coin  | 6        | Base asset    |
| USD1  | FungibleAsset| 8        | Default quote |
| USDC  | FungibleAsset| 6        | Quote (via Panora) |
| USDT  | FungibleAsset| 6        | Quote (via Panora) |
| USDe  | FungibleAsset| 6        | Quote (via Panora) |
| GHO   | FungibleAsset| 6        | Quote (via Panora) |

The contract's `Market.quote_decimals` field supports both 6-decimal and 8-decimal quote assets, allowing flexible pair configuration.

## Testnet Deployment

Contracts are published to Aptos testnet:

- **Contract address**: `0xe66fef668...d1`
- **Market**: CASH/USD1 (pair ID 0), seeded with liquidity
- **USD1 testnet**: `prediction_market::usd1` module with open minting for testing

Key mainnet addresses:

- **USD1**: `0x14b0ef0ec...`
- **CASH**: `0x61ed8b3c2...::CASH::CASH`

## Quick Start

```bash
# Install dependencies
pnpm install

# Move contracts
cd contracts && aptos move compile && aptos move test

# Backend — REST API + WebSocket
cd api && PORT=3100 pnpm dev     # API on :3100, WS on :3101

# Frontend
cd web && pnpm dev               # http://localhost:3102

# Full dev (all services)
pnpm dev
```

## Environment Variables

### Frontend (`web/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3100       # REST API base URL
NEXT_PUBLIC_WS_URL=ws://localhost:3101          # WebSocket server URL
NEXT_PUBLIC_APTOS_NETWORK=testnet               # mainnet | testnet
NEXT_PUBLIC_CONTRACT_ADDRESS=0xe66fef668...d1   # Deployed contract address
```

### API (`api/.env`)

```bash
APTOS_NETWORK=testnet           # mainnet | testnet | devnet | local
CONTRACT_ADDRESS=0xe66fef668... # Auto-resolved on testnet if not set
```

### Integration Test Scripts (`scripts/.env`)

```bash
APTOS_PRIVATE_KEY=...           # Hex-encoded ed25519 private key
CONTRACT_ADDRESS=...            # Deployed contract address
APTOS_NETWORK=testnet           # Target network
```

## Testing

```bash
pnpm -r test        # Run all tests (211 Move + 199 TypeScript)
pnpm -r typecheck   # Type check all packages
pnpm -r lint        # Lint all packages
```

211 Move tests and 199 TypeScript tests, with 27/27 validation assertions passing.

### Integration Tests

Scripts in `scripts/src/` for testnet validation:

```bash
# Simulate a $1000 USD1 market buy of CASH on testnet
npx tsx scripts/src/buy-simulation.ts

# Run market maker seeding and order lifecycle test
npx tsx scripts/src/market-maker-test.ts

# Generate CLOB vs AMM performance comparison report
npx tsx scripts/src/performance-report.ts
```

Performance benchmark: the CLOB achieves 0.5% slippage on a $1000 fill vs 4-37% slippage on comparable AMM pools.

## Design

- **Layout**: Uniswap-style token detail page — candlestick chart, swap panel, transaction history
- **Chart**: Professional candlestick with Candle/Line toggle, 181 days of historical data from LiquidSwap via GeckoTerminal API, "New Venue" transition marker
- **Swap**: Multi-stablecoin swap panel with 6 tokens, Panora routing for non-USD1 pairs
- **Theme**: Cash App green (`#00D54B`) on black, dark-mode first
- **Typography**: Geist Sans for UI, Geist Mono for prices and amounts
- **Motion**: Framer Motion transitions, CSS keyframe animations for live data
- **Components**: shadcn/ui base, Radix primitives, Lucide icons

## License

MIT
