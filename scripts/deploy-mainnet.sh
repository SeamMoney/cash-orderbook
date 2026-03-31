#!/bin/bash
# deploy-mainnet.sh — Deploy Cash Orderbook contracts to Aptos mainnet.
#
# Uses object-based deployment for upgradability (`--object-address create`).
# Reads the deployer's private key from the APTOS_PRIVATE_KEY environment variable.
#
# Prerequisites:
#   1. Aptos CLI v8.0+ installed
#   2. APTOS_PRIVATE_KEY env var set (hex-encoded ed25519 private key, no 0x prefix)
#   3. Deployer account funded with APT for gas
#
# Usage:
#   APTOS_PRIVATE_KEY=<hex_key> ./scripts/deploy-mainnet.sh [--profile <name>]
#
# Flags:
#   --profile <name>   Aptos CLI profile to use (default: "default")
#   --dry-run          Compile and test only, skip publishing
#   --skip-tests       Skip running Move tests before deploy
#
# Object-based deployment creates an upgradable package on a new object address.
# The deployer retains upgrade authority via their account.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACTS_DIR="$PROJECT_ROOT/contracts"

# Defaults
PROFILE="${APTOS_PROFILE:-default}"
DRY_RUN=false
SKIP_TESTS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --profile)
            PROFILE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -h|--help)
            echo "Usage: APTOS_PRIVATE_KEY=<key> $0 [--profile <name>] [--dry-run] [--skip-tests]"
            exit 0
            ;;
        *)
            echo "Unknown argument: $1"
            echo "Usage: APTOS_PRIVATE_KEY=<key> $0 [--profile <name>] [--dry-run] [--skip-tests]"
            exit 1
            ;;
    esac
done

echo "============================================="
echo "  CASH Orderbook — Mainnet Deployment"
echo "============================================="
echo ""

# Verify Aptos CLI is installed
if ! command -v aptos &> /dev/null; then
    echo "ERROR: Aptos CLI not found."
    echo "Install: https://aptos.dev/tools/aptos-cli/"
    exit 1
fi

echo "Aptos CLI: $(aptos --version)"
echo "Profile:   $PROFILE"
echo "Contracts: $CONTRACTS_DIR"
echo ""

# Verify APTOS_PRIVATE_KEY is set
if [ -z "${APTOS_PRIVATE_KEY:-}" ]; then
    echo "ERROR: APTOS_PRIVATE_KEY environment variable is not set."
    echo ""
    echo "Set it with your deployer's hex-encoded ed25519 private key:"
    echo "  export APTOS_PRIVATE_KEY=<your_hex_private_key>"
    echo ""
    echo "You can generate a new key with:"
    echo "  aptos key generate --output-file deployer.key"
    echo "  export APTOS_PRIVATE_KEY=\$(cat deployer.key)"
    exit 1
fi

# Extract deployer address from profile
echo "→ Extracting deployer address from profile '$PROFILE'..."
DEPLOYER_ADDRESS=$(aptos config show-profiles --profile "$PROFILE" 2>/dev/null \
    | grep -o '"account": "[^"]*"' \
    | head -1 \
    | sed 's/"account": "//;s/"//')

if [ -z "$DEPLOYER_ADDRESS" ]; then
    echo "WARNING: Could not extract deployer address from profile '$PROFILE'."
    echo "Attempting to derive from private key..."
    echo ""
    echo "Please ensure your Aptos profile is configured:"
    echo "  aptos init --network mainnet --private-key \$APTOS_PRIVATE_KEY"
    echo ""
    echo "Then re-run this script."
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

# Step 2: Run tests (unless skipped)
if [ "$SKIP_TESTS" = false ]; then
    echo "→ Step 2: Running tests..."
    aptos move test \
        --named-addresses "cash_orderbook=$DEPLOYER_ADDRESS" \
        2>&1
    echo "   ✓ All tests passed"
    echo ""
else
    echo "→ Step 2: Skipping tests (--skip-tests)"
    echo ""
fi

# Step 3: Publish to mainnet (unless dry-run)
if [ "$DRY_RUN" = true ]; then
    echo "→ Step 3: DRY RUN — skipping publish"
    echo "   Would publish to mainnet with object-based deployment."
    echo ""
else
    echo "→ Step 3: Publishing to Aptos mainnet (object-based deployment)..."
    echo "   This creates an upgradable package on a new object address."
    echo "   The deployer ($DEPLOYER_ADDRESS) retains upgrade authority."
    echo ""

    PUBLISH_OUTPUT=$(aptos move publish \
        --named-addresses "cash_orderbook=$DEPLOYER_ADDRESS" \
        --profile "$PROFILE" \
        --object-address create \
        --assume-yes \
        2>&1)

    echo "$PUBLISH_OUTPUT"

    # Try to extract the object address from the output
    OBJECT_ADDRESS=$(echo "$PUBLISH_OUTPUT" \
        | grep -o '"object_address": "[^"]*"' \
        | head -1 \
        | sed 's/"object_address": "//;s/"//' || true)

    echo ""
    echo "   ✓ Contracts published to mainnet"
    echo ""

    if [ -n "$OBJECT_ADDRESS" ]; then
        echo "   Object address: $OBJECT_ADDRESS"
        echo "   (Use this address as CONTRACT_ADDRESS in your .env)"
        echo ""
    fi
fi

# Summary
echo "============================================="
echo "  ✓ Deployment Complete!"
echo "============================================="
echo ""
echo "  Deployer:  $DEPLOYER_ADDRESS"
echo "  Network:   mainnet"
echo "  Upgrade:   object-based (deployer has upgrade authority)"
echo ""
echo "  Next steps:"
echo "    1. Note the object address from the publish output above"
echo "    2. Set CONTRACT_ADDRESS=<object_address> in your .env"
echo "    3. Run: npx tsx scripts/src/register-market.ts"
echo "    4. Run: npx tsx scripts/src/seed-orderbook.ts"
echo ""
