---
name: backend-worker
description: Backend/infrastructure engineer. Builds the TypeScript SDK, indexer, REST API, and WebSocket server with production reliability.
---

# Backend Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Features involving: TypeScript SDK (@cash/orderbook-sdk), event indexer, REST API (Hono), WebSocket server, in-memory orderbook state, rate limiting, candle aggregation, deployment scripts.

## Required Skills

- Reference `.factory/skills/aptos-sdk/SKILL.md` for Aptos TypeScript SDK patterns
- Reference `.factory/skills/indexer-service/SKILL.md` for indexer patterns
- Reference `/Users/maxmohammadi/decibrrr/lib/decibel-sdk.ts` for SDK singleton pattern
- Reference `/Users/maxmohammadi/decibrrr/lib/decibel-api.ts` for API client patterns
- Reference `/Users/maxmohammadi/decibel-indexer-example/` for Rust indexer architecture (we build TypeScript equivalent)

## Work Procedure

1. **Read the feature description** carefully. Understand what endpoints/modules to create, what assertions this feature fulfills.

2. **Read existing code** in the relevant package (`sdk/`, `api/`, `shared/`) to understand current state.

3. **Write tests FIRST** (TDD):
   - Create test files with `.test.ts` extension
   - Use vitest for unit and integration tests
   - For SDK: mock Aptos RPC responses
   - For API: test endpoints with supertest or direct fetch
   - For WebSocket: test message format and subscription flow
   - Run tests — they should FAIL (red)

4. **Implement the code**:
   - TypeScript strict mode, no `any`, explicit return types
   - Hono for REST API (lightweight, fast)
   - `ws` library for WebSocket
   - `@aptos-labs/ts-sdk` for chain interaction
   - Zod for request validation
   - Port 3100 for REST API, port 3101 for WebSocket
   - All responses must have consistent JSON shape

5. **Run tests** (green):
   - `cd <package> && pnpm test`
   - ALL tests must pass

6. **Manual verification**:
   - Start the service: `cd api && PORT=3100 pnpm dev`
   - Test with curl: `curl http://localhost:3100/health`
   - Verify JSON response format is correct
   - Stop the service after verification

7. **Run typecheck**:
   - `cd <package> && pnpm typecheck`
   - Must pass with zero errors

## Example Handoff

```json
{
  "salientSummary": "Built REST API with Hono on port 3100: /health, /depth, /trades, /orders/:address, /candles, /market, /balances/:address endpoints. All return consistent JSON. Ran vitest — 18 tests passing. Manual curl verification of each endpoint confirmed correct response shapes.",
  "whatWasImplemented": "api/src/routes/: health.ts, depth.ts, trades.ts, orders.ts, candles.ts, market.ts, balances.ts. Zod validation on all params. Error middleware returns {error, message} shape. In-memory orderbook state module (api/src/state/orderbook.ts) with bid/ask management.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "cd api && pnpm test", "exitCode": 0, "observation": "18 tests passed" },
      { "command": "cd api && pnpm typecheck", "exitCode": 0, "observation": "No errors" }
    ],
    "interactiveChecks": [
      { "action": "curl http://localhost:3100/health", "observed": "200 OK, {status: 'ok', uptime: 5}" },
      { "action": "curl http://localhost:3100/depth", "observed": "200 OK, {bids: [...], asks: [...]}" },
      { "action": "curl http://localhost:3100/orders/0xinvalid", "observed": "400 Bad Request, {error: 'INVALID_ADDRESS'}" }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "api/src/routes/__tests__/depth.test.ts",
        "cases": [
          { "name": "returns sorted bids and asks", "verifies": "GET /depth returns correct order" },
          { "name": "returns empty arrays for empty book", "verifies": "GET /depth handles no orders" }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Contract ABI/events don't match expected format (contracts milestone not complete)
- Aptos RPC endpoint unreachable or rate-limited
- Port 3100 or 3101 already in use by another process
- SDK depends on contract functions that don't exist yet
