---
name: fork-worker
description: Worker for forking the Uniswap web app into the CASH orderbook monorepo. Handles copying files, updating configs, wiring packages, and replacing data layers.
---

# Fork Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for any feature involving:
- Copying Uniswap source files into the CASH monorepo
- Updating package.json, tsconfig, vite.config for the forked app
- Stripping/stubbing Uniswap-specific providers and services
- Replacing GraphQL data calls with REST/WS API calls
- Branding and route cleanup

## Required Skills

- **agent-browser**: For visual verification of the forked app

## Key References

- Uniswap source: /Users/maxmohammadi/uniswap-frontend/
- CASH monorepo: /Users/maxmohammadi/cash-orderbook/
- New app location: apps/trading/
- New packages: packages/uni-*/
- CASH API: localhost:3100 (REST) + localhost:3101 (WebSocket)
- Forked app: localhost:3200 (Vite dev server)

## Work Procedure

### 1. Read Context
- Read the feature description thoroughly
- Read AGENTS.md for boundaries
- Read .factory/library/architecture.md if it exists
- When working with Uniswap source, read the original files first

### 2. Implement
- Follow the feature description step by step
- When copying files, use rsync with --exclude for node_modules, dist, build
- When modifying package.json, preserve the structure and only change what's needed
- When stubbing providers, keep the component interface but remove the implementation
- Test each step before moving to the next

### 3. Verify
- Run `pnpm install` after any package.json changes
- For dev server features: start with `cd apps/trading && npx vite --port 3200` and verify it boots
- For data layer features: use agent-browser to navigate and verify rendering
- Always use the scoped validation commands from `.factory/services.yaml` (NOT `pnpm -r test` or `pnpm -r typecheck` which hit broken Uniswap/legacy suites):
  - Test: `pnpm --filter @cash/api --filter @cash/orderbook-sdk --filter @cash/shared --filter @cash/scripts test`
  - Typecheck: `pnpm --filter @cash/api --filter @cash/orderbook-sdk --filter @cash/shared --filter @cash/scripts typecheck`
- Note: apps/trading has 277 pre-existing test failures (Uniswap's @universe/gating) and ~6578 TS errors. web/ has pre-existing React type issues. Both are excluded from validation.
- For Aptos addresses: Uniswap's shortenAddress only handles EVM/SVM. Use custom address formatting for Aptos surfaces.

### 4. Commit
- Commit with conventional commit messages
- Large file copies can be one commit; config changes should be separate
