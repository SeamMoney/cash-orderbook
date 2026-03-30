#!/bin/bash
set -e

echo "=== CASH Orderbook — Environment Setup ==="

# Install dependencies if node_modules missing
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install
fi

# Verify Aptos CLI
if ! command -v aptos &> /dev/null; then
  echo "ERROR: Aptos CLI not found. Install from https://aptos.dev/tools/aptos-cli/"
  exit 1
fi

echo "Aptos CLI: $(aptos --version)"
echo "Node: $(node --version)"
echo "pnpm: $(pnpm --version)"

# Create .env if not exists
if [ ! -f ".env" ]; then
  echo "Creating .env from .env.example..."
  if [ -f ".env.example" ]; then
    cp .env.example .env
  fi
fi

echo "=== Setup complete ==="
