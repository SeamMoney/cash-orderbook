# Layout-Chart API Contract Clarifications

Date: 2026-03-31

- `GET /market` currently returns market metadata plus `lastPrice` and `volume24h`; it does **not** return `change24h`.
  - Evidence: `api/src/routes/market.ts` route doc + `shared/src/index.ts` `MarketInfo` type.
- `GET /candles` currently accepts only `interval` (`1m|5m|15m|1h|1d`) and returns full candles for that interval.
  - It does **not** currently support a `limit` query parameter.
  - Evidence: `api/src/routes/candles.ts` `candlesQuerySchema` only includes `interval`.

Implication for frontend workers: compute 24h change client-side from candles (or add backend support explicitly) instead of reading `change24h` from `/market`.
