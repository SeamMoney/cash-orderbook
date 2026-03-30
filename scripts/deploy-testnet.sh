#!/bin/bash
# deploy-testnet.sh — Deploy Cash Orderbook contracts to Aptos testnet.
#
# Prerequisites:
#   1. Aptos CLI installed (v8.0+)
#   2. A funded testnet account (run `aptos init --network testnet` if needed)
#   3. The deployer's profile configured in .aptos/config.yaml
#
# Usage:
#   ./scripts/deploy-testnet.sh [--profile <profile_name>]
#
# Environment variables:
#   APTOS_PROFILE  — Aptos CLI profile name (default: "default")
#
# This script:
#   1. Compiles the Move contracts
#   2. Extracts the deployer address from the profile
#   3. Publishes to testnet with the deployer address as cash_orderbook
#   4. Verifies the deployment by querying the TestCASH metadata

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACTS_DIR="$PROJECT_ROOT/contracts"

# Parse arguments
PROFILE="${APTOS_PROFILE:-default}"
while [[ $# -gt 0 ]]; do
    case $1 in
        --profile)
            PROFILE="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1"
            echo "Usage: $0 [--profile <profile_name>]"
            exit 1
            ;;
    esac
done

echo "========================================="
echo "  Cash Orderbook — Testnet Deployment"
echo "========================================="
echo ""
echo "Profile: $PROFILE"
echo "Contracts: $CONTRACTS_DIR"
echo ""

# Verify Aptos CLI is installed
if ! command -v aptos &> /dev/null; then
    echo "ERROR: Aptos CLI not found."
    echo "Install: https://aptos.dev/tools/aptos-cli/"
    exit 1
fi

echo "Aptos CLI: $(aptos --version)"
echo ""

# Extract deployer address from profile
echo "→ Extracting deployer address from profile '$PROFILE'..."
DEPLOYER_ADDRESS=$(aptos config show-profiles --profile "$PROFILE" 2>/dev/null \
    | grep -o '"account": "[^"]*"' \
    | head -1 \
    | sed 's/"account": "//;s/"//')

if [ -z "$DEPLOYER_ADDRESS" ]; then
    echo "ERROR: Could not extract deployer address from profile '$PROFILE'."
    echo "Run 'aptos init --network testnet' to create a profile."
    exit 1
fi

echo "   Deployer address: $DEPLOYER_ADDRESS"
echo ""

# Step 1: Compile contracts
echo "→ Step 1: Compiling contracts..."
cd "$CONTRACTS_DIR"
aptos move compile \
    --named-addresses "cash_orderbook=$DEPLOYER_ADDRESS" \
    2>&1

echo "   ✓ Compilation successful"
echo ""

# Step 2: Run tests before deploying
echo "→ Step 2: Running tests..."
aptos move test \
    --named-addresses "cash_orderbook=$DEPLOYER_ADDRESS" \
    2>&1

echo "   ✓ Tests passed"
echo ""

# Step 3: Publish to testnet
echo "→ Step 3: Publishing to Aptos testnet..."
echo "   This will submit a transaction to publish the package."
echo ""

aptos move publish \
    --named-addresses "cash_orderbook=$DEPLOYER_ADDRESS" \
    --profile "$PROFILE" \
    --assume-yes \
    2>&1

echo ""
echo "   ✓ Contracts published to testnet"
echo ""

# Step 4: Verify deployment
echo "→ Step 4: Verifying deployment..."
echo "   Querying TestCASH metadata..."

aptos move view \
    --function-id "${DEPLOYER_ADDRESS}::test_cash::decimals" \
    --profile "$PROFILE" \
    2>&1 || echo "   (View function query may require a moment to propagate)"

echo ""
echo "========================================="
echo "  ✓ Deployment Complete!"
echo "========================================="
echo ""
echo "  Deployer: $DEPLOYER_ADDRESS"
echo "  Network:  testnet"
echo ""
echo "  Next steps:"
echo "    1. Fund test accounts with: aptos move run \\"
echo "         --function-id ${DEPLOYER_ADDRESS}::test_cash::mint_test_cash \\"
echo "         --args address:<recipient> u64:<amount> \\"
echo "         --profile $PROFILE"
echo ""
echo "    2. Register a market using scripts/register-market.ts"
echo ""
