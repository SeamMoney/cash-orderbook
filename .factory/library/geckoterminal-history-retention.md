# GeckoTerminal OHLCV retention note

- For the current CASH/APT LiquidSwap pool query path used by `scripts/src/import-history.ts`, GeckoTerminal API responses currently only backfill to approximately **2025-08-06** for USD OHLCV candles.
- This can be newer than the actual pool creation date; treat it as upstream data availability/retention behavior, not a local import bug.
- Earliest candle in `web/data/historical-candles.json` generated during milestone run was timestamp `1754438400000` (2025-08-06 UTC).
