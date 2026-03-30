# Environment

## Token Addresses

| Token | Address | Decimals | Standard |
|-------|---------|----------|----------|
| CASH (mainnet) | `0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67::CASH::CASH` | 6 | Legacy coin (auto-migrated to FA) |
| USDC (mainnet) | `0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b` | 6 | Native FungibleAsset |
| TestCASH (testnet) | TBD (deployed by us) | 6 | FungibleAsset |
| USDC (testnet) | `0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832` | 6 | Native FA (faucetable) |

## Precision

All prices and quantities use 6 decimal places. PRICE_SCALE = 1_000_000 (10^6).

## Aptos RPC

- Mainnet: `https://fullnode.mainnet.aptoslabs.com/v1` (or with API key)
- Testnet: `https://fullnode.testnet.aptoslabs.com/v1`
- Indexer gRPC: `https://grpc.mainnet.aptoslabs.com` (requires API key)

## Required Environment Variables

```
APTOS_PRIVATE_KEY=          # Deployer private key (never commit)
APTOS_NETWORK=mainnet       # or testnet
APTOS_API_KEY=              # Optional, for rate-limited RPC
CONTRACT_ADDRESS=           # Deployed contract address
PORT=3100                   # API server port
WS_PORT=3101                # WebSocket port
```

## Deployment

- Contracts deployed via `aptos move publish` with object-based deployment for upgradability
- Fresh deployer accounts (user will create and fund)
- No testnet deployment in pipeline — local `aptos move test` only, then mainnet
