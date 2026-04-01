# Testnet Deployment Details

## Important: Faucet Deprecation
The Aptos testnet faucet no longer supports programmatic minting. The SDK's `aptos.fundAccount()` and the CLI's `aptos account fund-with-faucet` will fail on testnet with: "There is no way to programmatically mint testnet APT, you must use the minting site at https://aptos.dev/network/faucet". Scripts must fund new accounts via APT transfers from the deployer instead. Both `buy-simulation.ts` and `setup-demo-wallet.ts` have been updated with this fallback.

## Contract Deployment
- **Network**: Aptos Testnet
- **Contract address**: `0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1`
- **CLI profile**: `cash-testnet` (in project-local `.aptos/config.yaml`)
- **Deployer address**: `0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1`
- **Publish tx**: `0x1e17940bd198cde5efc68c90a04709ec6fb1a9a6aa303c605e886e48193ed54e` (chunked publish, 2 txns)

## Asset Addresses (Testnet)
- **TestCASH metadata**: `0x6a3975108d59dca6a8744b0f8623ff815acd414b3167bddc2e06eb4c54ef599d` (6 decimals)
- **USD1 metadata**: `0x14b1ec8a5f31554d0cd19c390be83444ed519be2d7108c3e27dcbc4230c01fa3` (8 decimals)
- **USD1 contract**: `0xca4d40eae9f07fb28a121862d649203fb4335ece9536ee51790e19f812ff7aea`

## Market Configuration
- **Pair ID**: 0 (CASH/USD1)
- **Quote decimals**: 8
- **Lot size**: 1,000 (0.001 CASH)
- **Tick size**: 1,000 (0.00001 USD1)
- **Min size**: 10,000 (0.01 CASH)

## Key Transaction Hashes
- Register market: `0x37928074e1dfe301053eb77fb62d959cd096f9b671c3a646193e1fbe73524e9d`
- Mint TestCASH: `0xd92b63c7cbfc914a28a75f79ac0e0085c4e49a33453f4d4268ad81bfb8e63cf7`
- Mint USD1: `0xf166fb259e16972da8de0d672e04ae58cab7342be3b70c39b946ad489924141a`
- Deposit CASH: `0xac42a4e79f8e37d9df8225fae6f9e551c6905bfe32bfcf914c50f717d4c51ffd`
- Deposit USD1: `0x1d5e87eb9c2d3a894fc075733e2761b55284d1fc44922d8cf763f575e5a06af4`

## Orderbook State
- 10 bid orders placed around 0.0001 USD1/CASH
- 10 ask orders placed around 0.000101 USD1/CASH
- Aggregated into 2 bid levels + 1 ask level (due to PRICE_SCALE rounding at very low prices)

## Running Scripts Against Testnet
```bash
# Register market
APTOS_PRIVATE_KEY=<key> CONTRACT_ADDRESS=0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1 \
  APTOS_NETWORK=testnet QUOTE_ASSET=USD1 \
  pnpm --filter @cash/scripts register-market

# Full deployment (register + mint + deposit + seed)
APTOS_PRIVATE_KEY=<key> CONTRACT_ADDRESS=0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1 \
  pnpm --filter @cash/scripts deploy-testnet-full

# Seed orderbook
APTOS_PRIVATE_KEY=<key> CONTRACT_ADDRESS=0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1 \
  APTOS_NETWORK=testnet QUOTE_ASSET=USD1 \
  BASE_ASSET_ADDRESS=0x6a3975108d59dca6a8744b0f8623ff815acd414b3167bddc2e06eb4c54ef599d \
  pnpm --filter @cash/scripts seed-orderbook
```
