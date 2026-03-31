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

## Validation Concurrency

- **Surface:** `agent-browser`
- **Configured max concurrent validators:** **3**
- **Reasoning:** Browser validators are lightweight on this machine, but limiting to 3 reduces contention with local Next.js/API/WebSocket dev services and avoids flaky timing issues in hover/viewport assertions.

## Flow Validator Guidance: agent-browser

- Use isolated browser sessions only; do not reuse shared/default sessions.
- Stay on assigned assertion set and avoid modifying global app config/state.
- Use the same app URL (`http://localhost:3102`) and keep network/service processes untouched.
- If an assertion depends on API/WS behavior, verify fallback behavior before marking blocked/fail.
- Capture screenshots/console observations for each assertion outcome in your flow report.

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
- In local runs, `/candles` may return empty arrays even when API is healthy; treat line-render/crosshair assertions as **blocked** unless candle data is seeded.
- For API-unavailable assertions, prefer browser-level request blocking (`http://localhost:3100/**`) instead of stopping shared services, so parallel validators remain isolated.
