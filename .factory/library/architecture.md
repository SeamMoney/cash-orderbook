# Architecture — CASH Orderbook

## System Overview

The CASH Orderbook is a full-stack DeFi trading application on Aptos for trading the CASH memecoin. Primary trading pair: CASH/USD1 (World Liberty Financial stablecoin). Multi-stablecoin support via Panora DEX aggregator.

## Frontend Architecture

```
web/
├── app/
│   ├── layout.tsx          # Root layout (WalletProvider, fonts, globals.css)
│   ├── page.tsx            # Main page (will become Uniswap-style layout)
│   └── globals.css         # Tailwind v4 theme (CSS custom properties)
├── components/
│   ├── nav.tsx             # Navbar (will be redesigned)
│   ├── connection-status.tsx
│   ├── swap/
│   │   ├── swap-widget.tsx # Swap card (will be redesigned)
│   │   ├── swap-button.tsx
│   │   └── price-quote.tsx
│   ├── wallet/
│   │   ├── wallet-provider.tsx  # DO NOT MODIFY
│   │   ├── wallet-selector.tsx
│   │   └── connect-button.tsx
│   ├── orderbook/          # Old orderbook view (will be removed/replaced)
│   │   ├── orderbook-view.tsx
│   │   ├── orderbook-ladder.tsx
│   │   ├── depth-chart.tsx
│   │   ├── trade-ticker.tsx
│   │   ├── order-form.tsx
│   │   └── my-orders.tsx
│   └── ui/                 # shadcn/ui primitives
│       ├── button.tsx
│       ├── dialog.tsx
│       └── skeleton.tsx
├── hooks/
│   ├── use-websocket.ts
│   ├── use-realtime-orderbook.ts
│   ├── use-realtime-trades.ts
│   ├── use-account-subscription.ts
│   ├── use-balances.ts
│   ├── use-depth.ts
│   └── use-trades.ts
└── lib/
    ├── sdk.ts              # SDK client wrapper
    └── swap-quote.ts       # Swap quote calculation
```

## Data Flow

1. **REST API (port 3100)** → Initial data load (market stats, candles, trades, depth)
2. **WebSocket (port 3101)** → Real-time updates (orderbook deltas, new trades, account balances)
3. **SDK (@cash/orderbook-sdk)** → Transaction building (place order, cancel, deposit, withdraw)
4. **Wallet Adapter** → Transaction signing (signAndSubmitTransaction pattern)
5. **Panora API** → Swap quotes and transaction payloads for non-USD1 stablecoin swaps
6. **GeckoTerminal API** → Historical OHLCV data from LiquidSwap CASH/APT pool

## Quote Asset: USD1

- **Primary pair**: CASH/USD1 (World Liberty Financial stablecoin)
- **USD1 decimals**: 8 (vs 6 for USDC/USDT)
- **Mainnet USD1 FA**: `0x05fabd1b12e39967a3c24e91b7b8f67719a6dacee74f3c8b9fb7d93e855437d2`
- **Testnet USD1 FA**: `0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3`
- **Testnet USD1 contract**: `0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea`
- **Minting (testnet)**: `prediction_market::usd1::mint_to_self(signer, amount)` — open, no auth

## Multi-Stablecoin Routing

- **CASH/USD1**: Direct orderbook execution (our CLOB)
- **CASH/USDC, CASH/USDT, etc.**: Routed via Panora aggregator API
- Panora takes fromToken/toToken/amount, returns a ready-to-sign transaction payload
- Frontend shows "Direct" for USD1 swaps, "via Panora" for others

## Key Invariants

- wallet-provider.tsx is the single source of wallet state — never duplicate
- All data hooks in `hooks/` use consistent fetch/subscribe patterns
- SDK uses `buildPayload` + `signAndSubmitTransaction` (wallet adapter pattern, NOT direct submission)
- Theme colors are defined in globals.css via CSS custom properties — components reference semantic tokens
- No server-side data fetching (all client-side via REST API + WebSocket)
- Contracts support both 6-decimal and 8-decimal quote assets via configurable quote_decimals
