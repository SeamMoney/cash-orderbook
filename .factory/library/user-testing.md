# User Testing

## Validation Surface

- **Primary surface:** Web browser at localhost:3102 (production build via `next start`)
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
- Transaction table may be empty if no recent trades — functional assertions should account for empty state
- Wallet connection requires browser extension or Aptos Connect — headless testing may show "Connect Wallet" state only
