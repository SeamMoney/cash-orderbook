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

## Key Paths
- Uniswap source reference: /Users/maxmohammadi/uniswap-frontend/
- CASH API with dev seed: APTOS_NETWORK=testnet node api/dist/index.js
