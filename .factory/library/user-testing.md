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
- **Surface:** `curl`
- **Configured max concurrent validators:** **1**
- **Reasoning:** `pnpm -r typecheck` and workspace-wide source inspection are CPU/memory intensive and operate on shared build caches; serialize to avoid flaky overlap with browser validators.

## Flow Validator Guidance: agent-browser

- Use isolated browser sessions only; do not reuse shared/default sessions.
- Stay on assigned assertion set and avoid modifying global app config/state.
- Use the same app URL (`http://localhost:3102`) and keep network/service processes untouched.
- If an assertion depends on API/WS behavior, verify fallback behavior before marking blocked/fail.
- Capture screenshots/console observations for each assertion outcome in your flow report.

## Flow Validator Guidance: curl

- Restrict actions to read-only validation commands (`pnpm -r typecheck`, `rg`/`grep` constants checks, health probes).
- Do not start/stop shared services from curl validators; use existing running services only.
- Run from repository root with absolute paths when reading artifacts.
- Report exact command output snippets proving constant exports and successful type checking.

## Setup Requirements

1. Start frontend: `cd /Users/maxmohammadi/cash-orderbook/web && PORT=3102 npx next dev --turbopack`
2. (Optional) Start API: `cd /Users/maxmohammadi/cash-orderbook && node api/dist/index.js` on port 3100
3. (Optional) Start WS: WebSocket server on port 3101

## Testing Notes

- **No wallet private keys needed** for most visual validations
- Wallet connect/disconnect tests use the wallet selector modal (no real signing needed for visual checks)
- For swap execution tests (VAL-SWAP-008), a funded wallet on Aptos testnet/mainnet would be needed — mark as blocked if not available
- `pnpm --filter @cash/scripts seed-orderbook` currently requires `APTOS_PRIVATE_KEY`; without this env var, local candle/trade seeding is unavailable.
- Mobile responsive tests: set viewport to 375x812 (iPhone SE) and 768x1024 (iPad)
- Chart tests may show empty state if API is not running — VAL-ERROR-001 validates this is handled
- In development mode, the frontend now falls back to deterministic mock candles when `/candles` is empty, so line-render/crosshair assertions are testable without seeding; in non-development builds, seed candle data if the API returns empty arrays.
- Observed valid candle intervals from API: `1m`, `5m`, `15m`, `1h`, `1d`; `4h` returned HTTP 400 in this environment.
- For API-unavailable assertions, prefer browser-level request blocking (`http://localhost:3100/**`) instead of stopping shared services, so parallel validators remain isolated.

- During this milestone validation, local API endpoints (`/market`, `/trades`, `/candles`) repeatedly returned `HTTP 429 RATE_LIMITED`; assertions requiring populated trade data, quotes, or realtime deltas should be marked blocked if retries/backoff do not recover.
- During candlestick-chart validation, API/WS logs repeatedly showed Aptos indexer `events` v1 deprecation errors from `https://api.mainnet.aptoslabs.com/v1/graphql`; this can leave realtime trade streams empty even when services are healthy.
- If validating realtime candle mutation (e.g., `VAL-CANDLE-006`), require observable live trades (or an approved deterministic trade generator) before deciding pass/fail.
- Wallet-dependent assertions (connect, swap execution, limit submission, disconnect-after-connect) require a provisioned connectable wallet (extension or test credentials). If unavailable, mark these as blocked with explicit prerequisite notes.
- On this machine, `next dev` for `web` can hit `EMFILE: too many open files, watch` and serve only `/_not-found` (HTTP 404 at `/`). If this occurs, use production mode for UI validation: `cd /Users/maxmohammadi/cash-orderbook/web && pnpm build && pnpm exec next start --port 3102`.
- For transaction scripts (`buy-simulation`, `market-maker-test`), root `.env` may contain placeholder/comment values; do not assume it is executable. Prefer deriving credentials from `.aptos/config.yaml` profile `cash-testnet` and export `APTOS_PRIVATE_KEY`, `CONTRACT_ADDRESS`, `APTOS_NETWORK=testnet` explicitly at command runtime.
- Aptos testnet faucet currently does not support programmatic minting for new taker accounts in this environment. `market-maker-test` can block at taker setup with `INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE` unless `TAKER_PRIVATE_KEY` is pre-provisioned and already funded.
- Reliable fallback for `buy-simulation`/`market-maker-test`: pre-provision separate buyer/taker accounts, transfer APT from `cash-testnet` maker (e.g., `aptos account transfer --profile cash-testnet --account <addr> --amount <octas>`), then pass `BUYER_PRIVATE_KEY` / `TAKER_PRIVATE_KEY` at runtime. This avoids faucet dependency and allows fill verification to complete.
- Integration assertions that require live chart/trade continuity should verify that `/trades` and `/candles` are non-empty before browser checks. If both remain empty after rate-limit recovery, mark these assertions blocked due to missing live-data prerequisite.
- During testnet-live validation, `/depth` repeatedly included an anomalous low ask (`0.000101`) ahead of seeded asks, which can fail spread assertions even when depth is otherwise deep; verify and clear dust/outlier asks before spread-sensitive checks.
- `setup-demo-wallet` requires an authorized deployer for `test_cash::mint_test_cash`; if `.aptos/config.yaml` lacks `cash-testnet` and only `default` is available, export a known-authorized `APTOS_PRIVATE_KEY` or mark wallet-setup assertions blocked.
