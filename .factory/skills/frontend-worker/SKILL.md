---
name: frontend-worker
description: Frontend engineer for the CASH trading dashboard. Builds the Next.js app with real-time trading UI, wallet connection, and polished design system.
---

# Frontend Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Features involving: Next.js 16 app, trading dashboard UI, swap interface, orderbook view, wallet connection, real-time WebSocket updates, Framer Motion animations, Tailwind styling.

## Required Skills

- Reference `.factory/skills/frontend-trading/SKILL.md` for design system, component patterns, animations
- Reference `/Users/maxmohammadi/decibrrr/components/wallet/wallet-provider.tsx` for X-chain wallet setup
- Reference `/Users/maxmohammadi/decibrrr/components/wallet/wallet-selector.tsx` for wallet modal UI
- Invoke `agent-browser` skill for visual verification of completed UI

## Work Procedure

1. **Read the feature description** carefully. Understand what components/pages to create, what assertions this feature fulfills.

2. **Read existing code** in `web/` to understand current state, installed dependencies, routing structure.

3. **Implement components** following the design system:
   - Dark mode first: #212121 background, #FFFFFF primary text, #888888 secondary
   - Geist Sans for UI text, Geist Mono for prices/amounts/IDs
   - shadcn/ui (new-york style) as base component library
   - Framer Motion for transitions (AnimatePresence, motion.div)
   - Trading colors: emerald-500 (#10b981) for bids/buy, rose-500 (#f43f5e) for asks/sell
   - Tailwind v4 with CSS variables

4. **Wallet connection** (when applicable):
   - Use `@aptos-labs/wallet-adapter-react` with `AptosWalletAdapterProvider`
   - Enable cross-chain: `crossChainWallets: true` in dappConfig
   - Setup Ethereum derivation: `setupAutomaticEthereumWalletDerivation({ defaultNetwork: Network.MAINNET })`
   - Setup Solana derivation: `setupAutomaticSolanaWalletDerivation({ defaultNetwork: Network.MAINNET })`
   - Configure Aptos Connect: `aptosConnect: { dappId: '...' }`
   - Use `useWallet()` hook for connect/disconnect/signAndSubmitTransaction

5. **WebSocket integration** (when applicable):
   - Connect to ws://localhost:3101
   - Subscribe to channels: `orderbook`, `trades`, `account:{address}`
   - Handle reconnection on disconnect
   - Update React state on message receipt

6. **Run typecheck and lint**:
   - `cd web && pnpm typecheck` — zero errors
   - `cd web && pnpm lint` — zero errors

7. **Visual verification with agent-browser**:
   - Start the dev server: `cd web && PORT=3102 pnpm dev`
   - Use agent-browser to navigate to http://localhost:3102
   - Verify: page loads, correct layout, dark theme, components render
   - Take screenshots of key states
   - Stop the dev server after verification

8. **Manual checks**:
   - Verify no console errors in browser
   - Check responsive behavior at 1280px+ width
   - Verify wallet connection flow (if applicable)

## Example Handoff

```json
{
  "salientSummary": "Built swap interface with amount input, CASH/USDC selector, price quote display, and execute button. Connected to SDK for market order submission. Dark theme with Geist Mono prices. Verified with agent-browser — page loads, quote updates on input, swap button submits transaction.",
  "whatWasImplemented": "web/app/page.tsx: main swap page layout. web/components/swap/SwapWidget.tsx: amount input, asset selector, price quote, execute button. web/components/swap/PriceQuote.tsx: real-time quote from orderbook depth. web/hooks/useOrderbook.ts: WebSocket hook for book state. Connected to @cash/orderbook-sdk for transaction submission.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "cd web && pnpm typecheck", "exitCode": 0, "observation": "No errors" },
      { "command": "cd web && pnpm lint", "exitCode": 0, "observation": "No warnings" }
    ],
    "interactiveChecks": [
      { "action": "Navigate to http://localhost:3102", "observed": "Swap page loads with dark theme, tagline visible" },
      { "action": "Enter 100 in amount field", "observed": "Price quote updates showing estimated CASH output" },
      { "action": "Click Connect Wallet", "observed": "Modal opens with Google, Petra, MetaMask options" }
    ]
  },
  "tests": {
    "added": []
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Backend API/WebSocket not available (backend milestone not complete)
- SDK package not built or has type errors
- Wallet adapter packages have breaking changes
- Port 3102 already in use
