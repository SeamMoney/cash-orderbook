# User Testing — CASH Orderbook Frontend

## Testing Surface

**Primary surface**: Browser (agent-browser with Playwright 1.58.2)
**URL**: http://localhost:3102
**Backend API**: http://localhost:3100 (optional — UI should handle gracefully when down)
**WebSocket**: ws://localhost:3101 (optional — real-time features degrade gracefully)

## Resource Classification

| Surface | Cost | Concurrent | Notes |
|---------|------|------------|-------|
| agent-browser | Low | 4 max | 32GB RAM, 10 cores. Each browser ~200MB. |

## Setup Requirements

1. Start frontend: `cd /Users/maxmohammadi/cash-orderbook/web && PORT=3102 npx next dev --turbopack`
2. (Optional) Start API: `cd /Users/maxmohammadi/cash-orderbook && node api/dist/index.js` on port 3100
3. (Optional) Start WS: WebSocket server on port 3101

## Testing Notes

- **No wallet private keys needed** for most visual validations
- Wallet connect/disconnect tests use the wallet selector modal (no real signing needed for visual checks)
- For swap execution tests (VAL-SWAP-008), a funded wallet on Aptos testnet/mainnet would be needed — mark as blocked if not available
- Mobile responsive tests: set viewport to 375x812 (iPhone SE) and 768x1024 (iPad)
- Chart tests may show empty state if API is not running — VAL-ERROR-001 validates this is handled
