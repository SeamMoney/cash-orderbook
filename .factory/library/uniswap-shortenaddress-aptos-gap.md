# `shortenAddress` Utility Does Not Support Aptos Addresses

- `packages/uni-utilities/src/addresses/index.ts` validates only EVM/SVM address formats before shortening.
- Aptos addresses fail this validation and return an empty string in consumers that rely on `shortenAddress`.
- When porting CASH/Aptos UI into Uniswap components, use an Aptos-aware formatter instead of `shortenAddress` for Aptos addresses.
