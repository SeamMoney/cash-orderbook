/**
 * Base fetch client for the CASH REST API (port 3100).
 *
 * All adapter hooks consume this client to fetch market data,
 * candles, trades, and depth from the orderbook backend.
 */

/** In dev the Vite proxy forwards /cash-api/* → localhost:3100/* */
const API_BASE = '/cash-api'

export interface CashMarketInfo {
  pairId: number
  pair: string
  baseAsset: string
  quoteAsset: string
  lotSize: number
  tickSize: number
  minSize: number
  status: 'active' | 'paused' | 'delisted'
  lastPrice: number
  volume24h: number
}

export interface CashCandle {
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number
}

export type CashCandleInterval = '1m' | '5m' | '15m' | '1h' | '1d'

export interface CashTrade {
  id: string
  price: number
  quantity: number
  side: 'buy' | 'sell'
  timestamp: number
}

export interface CashDepthLevel {
  price: number
  quantity: number
}

export interface CashDepth {
  bids: CashDepthLevel[]
  asks: CashDepthLevel[]
}

async function fetchJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  let url = `${API_BASE}${path}`
  if (params) {
    const qs = new URLSearchParams(params).toString()
    url = `${url}?${qs}`
  }
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`CASH API error: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

/** GET /market — token metadata + market stats */
export function fetchMarket(): Promise<CashMarketInfo> {
  return fetchJson<CashMarketInfo>('/market')
}

/** GET /candles?interval=X — OHLCV candle data */
export function fetchCandles(interval: CashCandleInterval = '1d'): Promise<CashCandle[]> {
  return fetchJson<CashCandle[]>('/candles', { interval })
}

/** GET /trades?limit=N — recent trades */
export function fetchTrades(limit = 50): Promise<CashTrade[]> {
  return fetchJson<CashTrade[]>('/trades', { limit: String(limit) })
}

/** GET /depth — orderbook depth snapshot */
export function fetchDepth(): Promise<CashDepth> {
  return fetchJson<CashDepth>('/depth')
}

/** GET /health — health check */
export function fetchHealth(): Promise<{ status: string; uptime: number }> {
  return fetchJson<{ status: string; uptime: number }>('/health')
}
