# User Testing

## Validation Surfaces

### Surface 1: CLI (Move contracts)
- **Tool**: `aptos move test --coverage`
- **What**: Contract unit tests covering all order types, matching, settlement, admin, errors
- **Setup**: `cd contracts && aptos move test --named-addresses cash_orderbook=0xCAFE`
- **When**: After contracts milestone

### Surface 2: HTTP (Backend API)
- **Tool**: curl, vitest
- **What**: REST API endpoints, SDK functions, WebSocket connections
- **Setup**: Start API service on port 3100, WS on 3101
- **When**: After backend milestone

### Surface 3: Browser (Frontend)
- **Tool**: agent-browser (Playwright 1.58.2)
- **What**: Full trading UI — swap interface, orderbook view, wallet connection, order flow
- **Setup**: Start all services (API 3100, WS 3101, Web 3102)
- **When**: After frontend milestone

## Validation Concurrency

### agent-browser
- Machine: 32GB RAM, 10 CPU cores, ~19GB available
- Each browser instance: ~300-500MB RAM
- Dev server (Next.js): ~200-400MB
- API + WS: ~100-200MB
- **Max concurrent validators: 4** (conservative, leaves headroom for services + compilation)

### curl/CLI
- Lightweight, no concurrency limit needed
- **Max concurrent: 5**

### vitest
- Test execution is CPU-heavy and reads shared workspace dependencies/cache.
- Safe to run alongside one live API/WS flow, but avoid multiple vitest suites concurrently to reduce nondeterminism.
- **Max concurrent: 1**

### aptos-cli (Move validation)
- `aptos move test` is CPU/memory intensive and writes shared build artifacts under `contracts/build/`
- Run serially to avoid cache contention and flaky output interleaving
- **Max concurrent: 1**

## Testing Notes

- Frontend tests require all 3 services running (API, WS, Web)
- Contract tests are self-contained (no services needed)
- Backend tests need API service running but not frontend
- WebSocket tests may need timing tolerance (100ms for event propagation)
- Testnet deploy validation requires a local Aptos profile in repo workspace (`.aptos/config.yaml`) or deployment assertions will be blocked at profile resolution.

## Flow Validator Guidance: aptos-cli

- Isolation boundary: use only this repo at `/Users/maxmohammadi/cash-orderbook`, no extra workspaces.
- Do not start API/WS/Web services for contracts milestone validation.
- Run contract assertions via:
  - `cd contracts && aptos move test --named-addresses cash_orderbook=0xCAFE --coverage`
- For `VAL-CONTRACT-001`, attempt testnet deployment evidence via:
  - `bash scripts/deploy-testnet.sh --profile default`
  - If Aptos profile/funds are missing, mark assertion `blocked` with the exact CLI error.
- Save command transcripts/screenshots as evidence and report assertion-by-assertion outcomes.

## Flow Validator Guidance: vitest

- Isolation boundary: run tests from this repo only (`/Users/maxmohammadi/cash-orderbook`).
- Run SDK/backend tests directly from package directories; do not modify source code while validating.
- Prefer targeted test commands and include raw assertion-specific output in the flow report evidence list.
- Do not rely on network flakiness for pass/fail; if an assertion requires live chain confirmation and fixtures are unavailable, mark it blocked with exact error/output.

## Flow Validator Guidance: curl-ws

- Isolation boundary: use only local services on ports `3100` (REST) and `3101` (WS).
- Do not start additional app instances on other ports; mission port boundary is 3100-3102 only.
- Keep state-mutating checks (rate-limit bursts, synthetic event triggers) serialized within this flow to avoid cross-flow interference.
- Capture exact request/response payloads and status codes for each assertion.
- If required trade/depth data cannot be produced from available local surfaces, mark affected assertions blocked and include precise prerequisite gap.

## Backend Validation Findings (2026-03-31)

- REST/WS surface currently exposes read endpoints only; POST attempts to create orders/trades/deposits returned `404`, so dynamic data assertions require an external state-driving mechanism (SDK/contract integration harness) to be testable.
- For ad-hoc WS scripts in repo root, import `ws` from `api/node_modules/ws` if root resolution fails.
- With default runtime settings (`CONTRACT_ADDRESS=0xCAFE`), indexer polling can remain at `lastIndexedVersion=0`; validate event-driven assertions only after wiring a contract address/network that emits events through the supported indexer path.
