# Architecture

## System Overview

CASH Orderbook is a Central Limit Order Book on Aptos blockchain with a full-stack trading infrastructure.

```
contracts/    Move smart contracts (orderbook core, matching engine)
sdk/          TypeScript SDK for contract interaction (@cash/orderbook-sdk)
api/          REST API (port 3100) + WebSocket server (port 3101) — Hono
web/          Trading dashboard — Next.js 16, React 19, Tailwind CSS + Tamagui
shared/       Shared types, constants, ABIs (@cash/shared)
scripts/      Deployment and utility scripts
```

## Frontend Architecture (web/)

### Current State (migrating to Tamagui)
- **Framework:** Next.js 16 with app router and Turbopack
- **Styling:** Tailwind CSS v4 + Tamagui (coexisting during migration)
- **Fonts:** Geist Sans (maps to Uniswap's Basel Grotesk weight 485/535)
- **State:** React hooks + context (no Redux/Zustand)
- **Wallet:** @aptos-labs/wallet-adapter-react with Aptos Connect, cross-chain support

### Target State (Uniswap TDP exact match)
- All UI components use Tamagui primitives (Flex, Text, styled)
- Theme uses Uniswap's Spore design system tokens
- Layout matches Uniswap Token Detail Page exactly
- All existing trading functionality preserved

### Data Flow
```
Aptos Blockchain → API indexer → REST API (3100) → Frontend hooks
                                → WebSocket (3101) → Real-time hooks
Frontend → Wallet adapter → signAndSubmitTransaction → Aptos
```

### Key Frontend Hooks (web/hooks/)
- `use-websocket`: Core WS connection to port 3101 with auto-reconnect
- `use-realtime-orderbook`: Real-time depth via WS + REST fallback
- `use-realtime-trades`: Live trade feed via WS + REST fallback
- `use-realtime-price`: Latest price from WS trades channel
- `use-depth`: REST polling depth for swap quote calculation
- `use-market`: Market data (pair info, lastPrice, volume24h)
- `use-balances`: Wallet balance polling + WS push updates
- `use-candles`: OHLCV candle data for charts
- `use-account-subscription`: Per-account WS balance updates

### Key Frontend Libs (web/lib/)
- `config.ts`: API_BASE, WS_URL, CONTRACT_ADDRESS from env
- `sdk.ts`: buildPlaceOrderPayload for on-chain orders
- `swap-quote.ts`: Orderbook depth walk for swap pricing
- `panora.ts`: Panora DEX aggregator for non-CASH/USD1 pairs

## API Architecture (api/)
- Hono HTTP framework on port 3100
- Endpoints: /depth, /market, /trades, /candles, /balances/:address, /orders/:address
- Event indexer: polls Aptos for on-chain events, updates state

## WebSocket Architecture (api/)
- ws library on port 3101
- Channels: orderbook (depth), trades, account:{address}
- Subscribe protocol: `{ subscribe: "channelName" }`
