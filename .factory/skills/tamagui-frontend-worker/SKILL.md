---
name: tamagui-frontend-worker
description: Frontend engineer for migrating CASH orderbook UI to Tamagui, matching the exact Uniswap Token Detail Page design.
---

# Tamagui Frontend Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for any feature that involves:
- Setting up or configuring Tamagui in the Next.js project
- Creating or migrating UI components to use Tamagui primitives (Flex, Text, styled)
- Matching Uniswap's exact visual design using Spore design tokens
- Building layout structures (TDP layout, navbar, responsive behavior)
- Wiring Tamagui components to existing data hooks

## Required Skills

- **agent-browser**: MUST be invoked for visual verification. After building/changing components, use agent-browser to screenshot at 1440x900 and verify computed styles match Uniswap's exact values. Compare against the reference at localhost:3000 when available.

## Work Procedure

### 1. Read Reference Material
- Read the feature description thoroughly
- Read `AGENTS.md` for mission boundaries and conventions
- Read `.factory/library/architecture.md` for system architecture
- Read `.factory/library/uniswap-reference.md` for exact Uniswap values
- When building a specific component, read the corresponding Uniswap source file at `/Users/maxmohammadi/uniswap-frontend/` to understand their exact implementation

### 2. Write Tests First (TDD)
- Write failing tests for the component's expected behavior
- For Tamagui components: test rendering, correct props, responsive behavior
- For theme setup: test that config exports correct token values
- Run `pnpm -r typecheck` to verify TypeScript correctness

### 3. Implement
- Create/modify the component using Tamagui primitives
- Use theme tokens exclusively — NEVER hardcode hex colors
- Match Uniswap's exact component structure by reading their source files
- Preserve all existing hook connections and data flow
- Ensure "use client" directive on all Tamagui components

### 4. Verify Automated
- Run `pnpm -r typecheck` (zero errors)
- Run `pnpm -r test` (all tests pass)
- Run `pnpm -r build` (production build succeeds)
- Run `pnpm -r lint` (no new errors)

### 5. Verify Visual (REQUIRED)
- Build the production frontend: `cd web && pnpm build`
- Start it: `PORT=3102 npx next start -p 3102 &`
- Use `agent-browser` to open localhost:3102 at 1440x900
- Take screenshots and measure computed styles
- Compare key measurements against expected values from the feature description
- For each visual assertion in the feature's `fulfills`, verify the computed style matches
- Document each check in `interactiveChecks`

### 6. Clean Up
- Stop any services you started: `lsof -ti :3102 | xargs kill 2>/dev/null`
- Ensure no orphaned processes

## Example Handoff

```json
{
  "salientSummary": "Migrated StatsSection to Tamagui with heading3 titles (25px), body3 labels (15px/neutral2), heading3 values (25px/neutral1), 2-column flex-wrap layout, and surface3 bottom borders. All 5 STATS assertions verified via agent-browser computed styles.",
  "whatWasImplemented": "Rewrote web/components/token-stats-grid.tsx using Tamagui Flex and Text components. Stats container uses Flex row with flexWrap='wrap' and gap=$spacing20. Each stat uses Flex with width='50%'. Labels use Text variant body3 with color=$neutral2. Values use Text variant heading3 with color=$neutral1. Bottom borders use borderBottomColor=$surface3 with borderBottomWidth=0.5. Section heading uses Text variant heading3.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "pnpm -r typecheck", "exitCode": 0, "observation": "Zero type errors across all workspaces" },
      { "command": "pnpm -r test", "exitCode": 0, "observation": "200 tests pass, including 3 new stats component tests" },
      { "command": "pnpm -r build", "exitCode": 0, "observation": "Production build succeeds in 4.2s" },
      { "command": "pnpm -r lint", "exitCode": 0, "observation": "No new lint errors, 3 pre-existing img warnings" }
    ],
    "interactiveChecks": [
      { "action": "Opened localhost:3102 at 1440x900, inspected Stats section heading", "observed": "Computed font-size: 25px, line-height: 30px, color: rgb(255,255,255) — matches heading3" },
      { "action": "Inspected stat label 'Market cap'", "observed": "Computed font-size: 15px, color: rgba(255,255,255,0.65) — matches body3/neutral2" },
      { "action": "Inspected stat value", "observed": "Computed font-size: 25px, color: rgb(255,255,255) — matches heading3/neutral1" },
      { "action": "Inspected stat row border", "observed": "Computed border-bottom: 0.5px solid rgba(255,255,255,0.12) — matches surface3" },
      { "action": "Inspected stats container layout", "observed": "display: flex, flex-wrap: wrap, each item width ~50% — matches 2-column layout" }
    ]
  },
  "tests": {
    "added": [
      { "file": "web/components/__tests__/token-stats-grid.test.tsx", "cases": [
        { "name": "renders Stats heading with correct text", "verifies": "heading3 typography applied" },
        { "name": "renders 4 stat items in 2-column layout", "verifies": "flex-wrap 50% width layout" },
        { "name": "stat labels use neutral2 color token", "verifies": "correct color token usage" }
      ]}
    ],
    "coverage": "3 new component tests covering rendering, layout, and color token usage"
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Tamagui installation fails or has incompatibility with Next.js 16/React 19
- A Uniswap component pattern requires packages not yet installed
- Existing hooks or data flow is broken by the migration
- Cannot achieve exact visual match and needs guidance on acceptable deviation
- Feature depends on a component that hasn't been migrated yet
