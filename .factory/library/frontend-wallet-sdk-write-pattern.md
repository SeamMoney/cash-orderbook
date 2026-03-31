# Frontend wallet-adapter + SDK write-path note

## Context

`@cash/orderbook-sdk` write methods (for example `CashOrderbook.placeOrder()`) currently expect an Aptos `Account` signer, while the web app uses wallet-adapter `signAndSubmitTransaction`.

## Current codebase pattern

In `web/lib/sdk.ts`, the frontend builds entry-function payloads and submits them through wallet adapter signing instead of calling SDK write methods directly.

## Why this matters

Workers implementing frontend trading flows should verify whether a task explicitly requires direct SDK write-method usage (`placeOrder`, `cancelOrder`, etc.) vs wallet-adapter payload submission, because these are not equivalent for scrutiny requirements.
