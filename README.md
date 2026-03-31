# CASH Orderbook

> The Fastest CASH Swap Ever. True Zero-Slippage Atomic On-Chain Orderbook.

A full-stack Central Limit Order Book (CLOB) on Aptos blockchain. Move smart contracts handle order matching and settlement on-chain, while a TypeScript backend and Next.js frontend deliver a real-time trading experience with a Uniswap-style token detail interface and Cash App design language.

## Architecture

```
contracts/   Move smart contracts — orderbook core, matching engine, settlement
sdk/         TypeScript SDK (@cash/orderbook-sdk) for contract interaction
api/         REST API (Hono, port 3100) + WebSocket server (port 3101)
web/         Next.js 16 trading dashboard (port 3102)
shared/      Shared types, constants, ABIs across packages
scripts/     Deployment, migration, and utility scripts
```

## Tech Stack

| Layer            | Stack                                                    |
| ---------------- | -------------------------------------------------------- |
| Smart Contracts  | Move on Aptos (FungibleAsset standard)                   |
| SDK              | TypeScript, @aptos-labs/ts-sdk                           |
| API              | Hono, WebSocket (ws), Zod                                |
| Frontend         | Next.js 16, React 19, Tailwind CSS 4, Framer Motion     |
| Monorepo         | Turborepo + pnpm workspaces                              |

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

## Testing

```bash
pnpm -r test        # Run all tests
pnpm -r typecheck   # Type check all packages
pnpm -r lint        # Lint all packages
```

## Design

- **Layout**: Uniswap-style token detail page — price chart, swap panel, transaction history
- **Theme**: Cash App green (`#00D54B`) on black, dark-mode first
- **Typography**: Geist Sans for UI, Geist Mono for prices and amounts
- **Motion**: Framer Motion transitions, CSS keyframe animations for live data
- **Components**: shadcn/ui base, Radix primitives, Lucide icons

## License

MIT
