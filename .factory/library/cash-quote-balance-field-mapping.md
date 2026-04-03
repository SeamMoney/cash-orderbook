# CASH Quote Balance Field Mapping

- `GET /balances` currently returns `cash` and `usdc` fields.
- In current CASH trading UX, the primary quote asset is `USD1` (including default `USD1 -> CASH` swap flow).
- Frontend balance lookups must map `USD1` UI symbol to the backend `usdc` balance field (or provide a normalized quote-balance field) to avoid incorrect insufficient-balance CTA behavior.
