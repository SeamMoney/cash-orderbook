# Panora API Auth Requirement

- Observation date: 2026-03-31 (swap-panora scrutiny re-run).
- `GET https://api.panora.exchange/swap/quote` returned HTTP 401 without `x-api-key`.
- Treat Panora quote/swap endpoints as API-key protected in practice.
- Keep Panora API key in environment configuration (never hardcode in client code).
