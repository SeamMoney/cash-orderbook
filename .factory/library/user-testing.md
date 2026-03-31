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
