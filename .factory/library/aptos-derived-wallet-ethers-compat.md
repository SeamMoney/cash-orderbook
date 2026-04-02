# Aptos Derived Wallet Compatibility in `apps/trading`

- `apps/trading` currently pins `ethers@5.7.2`.
- Aptos derived-wallet packages expect `ethers` v6 APIs in this integration path.
- Current wallet provider catches derived-wallet import/setup failures and continues without derived wallet support.
- Result: Aptos wallet connection works, but Ethereum/Solana derived-wallet flows are degraded (best-effort only) unless the ethers compatibility gap is resolved.
