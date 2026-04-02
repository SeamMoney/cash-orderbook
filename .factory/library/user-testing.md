# User Testing

## Validation Surface

- **Primary surface:** Web browser at localhost:3102 (production build via `next start`)
- **Fork setup surface:** Vite trading app at localhost:3200 (`apps/trading`)
- **Reference surface:** Uniswap TDP at localhost:3000 (for visual comparison)
- **Tool:** agent-browser for all visual/interactive assertions
- **Build before testing:** Must run `cd web && pnpm build` then `PORT=3102 npx next start -p 3102`

## Required Testing Skills/Tools

- **agent-browser:** Required for all visual assertions. Supports screenshots, DOM inspection, computed style extraction, viewport resizing.

## Validation Concurrency

- **Machine:** 32GB RAM, 10 CPU cores, ~13GB headroom
- **Max concurrent agent-browser instances:** 4
  - Each instance: ~300MB RAM for browser + ~200MB shared dev server
  - 4 instances = ~1.4GB + ~200MB server = ~1.6GB (well within 9.1GB budget at 70%)
- **Services needed:** web production build on 3102 (shared across validators)
  - API on 3100 and WS on 3101 for functional assertions only

## Testing Notes

- Use production build (`next start`) not dev server for visual testing — dev server has CSS rendering issues in headless mode
- API returns 429 under heavy polling — space out requests or use single-request checks
- `GET /health` can also be rate-limited during validation; prefer a port-listener healthcheck for API readiness (`lsof -iTCP:3100 -sTCP:LISTEN`)
- WebSocket service startup command is `APTOS_NETWORK=testnet node api/dist/ws.js` (not `api/dist/ws-server.js`)
- API service should be started with `APTOS_NETWORK=testnet` for stable testnet behavior
- Transaction table may be empty if no recent trades — functional assertions should account for empty state
- Wallet connection requires browser extension or Aptos Connect — headless testing may show "Connect Wallet" state only
- When validating nav hover states, use exact-text targeting for `Explore` to avoid collisions with `Explorer`.

## Flow Validator Guidance: web

- Surface URL: `http://localhost:3102`.
- Validation scope for `component-migration` includes visual/layout/theme assertions and functional-read checks (`FUNC-*`) such as quote rendering, wallet modal visibility, WebSocket connectivity, chart render/update, and balance visibility when available.
- Do not execute irreversible on-chain actions in headless validation. It is sufficient to verify pre-submit UX states (quote output, CTA state, wallet modal open, WS stream presence).
- Each flow validator must use its own browser session name and must not reuse another validator's session.
- Allowed interactions: navigation, viewport resizing, scrolling, opening menus/modals, computed-style reads, screenshots.
- Avoid actions that can cause cross-validator interference (for example repeatedly triggering heavy refresh loops that can cause API 429 noise).
- Keep evidence isolated per group under `{missionDir}/evidence/component-migration/<group-id>/`.

## Flow Validator Guidance: cli

- Surface: repository shell at `/Users/maxmohammadi/cash-orderbook`.
- Scope: CLI/curl assertions only, including `FORK-001` (`curl http://localhost:3200`) and `CROSS-004` command assertions (`pnpm -r typecheck`, `pnpm -r test`, `pnpm -r lint`, `pnpm -r build`).
- Run commands sequentially in one validator to avoid workspace cache contention and noisy duplicate installs.
- Preserve command output in the flow report with exit codes and key summary lines (errors, pass counts, build success).

## Flow Validator Guidance: trading-web

- Surface URL: `http://localhost:3200`.
- Scope: fork setup browser assertions for Uniswap-fork UI rendering (currently `FORK-002`).
- Use a dedicated browser session and avoid reusing any session from other validators.
- Allowed interactions: navigate directly to the token route, wait for render completion, capture screenshot evidence, inspect visible chart/stats sections.
- Keep testing read-only; do not mutate app or repository state from browser tools.
- Save evidence under `{missionDir}/evidence/fork-setup/<group-id>/`.
