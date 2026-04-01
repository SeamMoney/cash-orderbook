#!/bin/bash
set -e

cd /Users/maxmohammadi/cash-orderbook

# Install dependencies (idempotent)
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Build shared and SDK packages (needed by web)
pnpm -r build --filter=@cash/shared --filter=@cash/orderbook-sdk 2>/dev/null || true

echo "Environment ready."
