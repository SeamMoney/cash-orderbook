# Architecture — CASH Orderbook Frontend

## System Overview

The CASH Orderbook is a full-stack DeFi trading application on Aptos. This mission focuses exclusively on the **frontend** (`web/` package), replacing the current UI with a Uniswap-style token detail page.

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

## Key Invariants

- wallet-provider.tsx is the single source of wallet state — never duplicate
- All data hooks in `hooks/` use consistent fetch/subscribe patterns
- SDK uses `buildPayload` + `signAndSubmitTransaction` (wallet adapter pattern, NOT direct submission)
- Theme colors are defined in globals.css via CSS custom properties — components reference semantic tokens
- No server-side data fetching (all client-side via REST API + WebSocket)
