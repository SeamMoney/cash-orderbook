# Architecture — CASH Orderbook with Uniswap Fork

## Overview

The CASH orderbook is being extended with a forked Uniswap web frontend. The fork provides the exact Uniswap Token Detail Page UI while our existing API/WebSocket backend provides the data.

## Components

### Backend (existing, unchanged)
- **api/** — Hono REST API on port 3100. Endpoints: /health, /depth, /trades, /candles, /market, /balances, /orders
- **api/ws.js** — WebSocket server on port 3101. Channels: orderbook, trades
- **sdk/** — TypeScript SDK for Aptos contract interaction
- **shared/** — Shared types and constants

### Frontend (new fork)
- **apps/trading/** — Forked Uniswap web app (Vite SPA on port 3200)
  - Uses React Router v7, Tamagui, Apollo Client
  - TDP (Token Detail Page) is the primary view
  - Data layer being replaced: GraphQL → our REST/WS API

### Uniswap Packages (new, copied from Uniswap monorepo)
- **packages/uni-ui/** — Tamagui component library (Flex, Text, icons, theme)
- **packages/uni-uniswap/** — Shared logic (chains, tokens, data hooks)
- **packages/uni-api/** — GraphQL types and client
- **packages/uni-utilities/** — Formatters, env detection
- **packages/uni-gating/** — Feature flags (stubbed)
- **packages/uni-sessions/** — Session management
- **packages/uni-notifications/** — Notifications
- **packages/uni-prices/** — Price context
- **packages/uni-websocket/** — WebSocket abstraction

### Legacy Frontend (existing, will be deprecated)
- **web/** — Next.js app on port 3102 (current Tamagui-based implementation)

## Data Flow

```
User Browser → apps/trading (Vite SPA, port 3200)
                  ↓ REST calls
              api/ (Hono, port 3100) → Aptos blockchain
                  ↓ WebSocket
              api/ws.js (port 3101) → Real-time orderbook/trades
```

## CASH-Specific Code in apps/trading/

Most CASH-specific code lives in `apps/trading/src/cash/`:
- `lib/` — Pure logic: swap-quote.ts, panora.ts, sdk.ts, config.ts, utils.ts
- `hooks/` — 14 React hooks for REST/WS data (balances, depth, trades, candles, etc.)
- `providers/` — AptosWalletProvider, CashSwapProvider
- `data/` — historical-candles.json

Additional CASH integration touchpoints exist outside `src/cash/`, including:
- `apps/trading/src/pages/CashTDP/CashTDPProvider.tsx`
- `apps/trading/src/data/hooks.ts` (CASH token market data mapping)

The CashTDPProvider maps REST API data into the Uniswap TDP Zustand store shape.

## Key Paths
- Uniswap source reference: /Users/maxmohammadi/uniswap-frontend/
- Legacy CASH frontend (to port FROM): /Users/maxmohammadi/cash-orderbook/web/
- CASH API with dev seed: APTOS_NETWORK=testnet node api/dist/index.js
