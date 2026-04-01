# Matching Engine Self-Trade Prevention

The on-chain matching engine prevents an account from matching against its own resting orders.

- Enforcement exists in `contracts/sources/matching.move` where same-owner matches are skipped.
- Simulations that need an actual taker fill must use a different taker account than the maker account that posted ladder orders.
- Transaction success alone is not proof of a fill; scripts should verify emitted trade events or executed quantity deltas.
