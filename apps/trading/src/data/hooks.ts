/**
 * React hooks that adapt the CASH REST/WS API into component-friendly state.
 *
 * Data sources:
 *  - Short-interval charts (1H/1D/1W): backend orderbook API at /cash-api
 *  - Long-interval charts (1M/1Y/ALL): GeckoTerminal OHLCV for LiquidSwap CASH/APT pool
 *    → free, no aggressive rate limits, real OHLC candles (not just line data)
 *  - Stats (price/volume/mcap): CoinGecko coin `cash-2` — ONE call per TTL
 *  - TVL: GeckoTerminal token pools endpoint
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchCandles,
  fetchMarket,
  fetchTrades,
  type CashCandle,
  type CashCandleInterval,
  type CashTrade,
} from '~/data/api'
import { cashWs } from '~/data/ws'

/** Total CASH token supply — all 1 billion tokens minted at genesis, no vesting. */
const CASH_TOTAL_SUPPLY = 1_000_000_000

// ============================================================
// Shared cache — module-level so all hooks share the same data
// ============================================================

interface CacheEntry<T> { data: T; ts: number }

function isFresh<T>(entry: CacheEntry<T> | null, ttl: number): entry is CacheEntry<T> {
  return entry !== null && Date.now() - entry.ts < ttl
}

const TTL_STATS   = 2  * 60_000   // 2 min  — price / volume / market cap
const TTL_CHART   = 10 * 60_000   // 10 min — OHLCV candles

const cache: {
  cgStats:    CacheEntry<CoinGeckoStats>    | null
  gtDay:      CacheEntry<CashCandle[]>      | null   // daily OHLCV (ALL / 1Y chart)
  gtHour:     CacheEntry<CashCandle[]>      | null   // hourly OHLCV (1M chart)
  tvl:        CacheEntry<number | null>     | null
} = { cgStats: null, gtDay: null, gtHour: null, tvl: null }

// ============================================================
// GeckoTerminal — OHLCV candles for LiquidSwap CASH/APT pool
// ============================================================

const GT_BASE = 'https://api.geckoterminal.com/api/v2'

/** CASH token address on Aptos mainnet */
const CASH_TOKEN_ADDRESS =
  '0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67::CASH::CASH'

/** LiquidSwap CASH/APT pool — Move type string used as GeckoTerminal pool ID */
const LIQUIDSWAP_POOL =
  '0x163df34fccbf003ce219d3f1d9e70d140b60622cb9dd47599c25fb2f797ba6e::liquidity_pool::LiquidityPool<0x61ed8b048636516b4eaf4c74250fa4f9440d9c3e163d96aeb863fe658a4bdc67::CASH::CASH, 0x1::aptos_coin::AptosCoin, 0x163df34fccbf003ce219d3f1d9e70d140b60622cb9dd47599c25fb2f797ba6e::curves::Uncorrelated>'

/**
 * Fetch OHLCV candles from GeckoTerminal for the LiquidSwap CASH/APT pool.
 *
 * timeframe=day,  limit=1000 → up to ~2.7yr of daily candles  (ALL / 1Y)
 * timeframe=hour, limit=720  → 30 days of hourly candles       (1M)
 *
 * currency=usd  → prices denominated in USD (not APT)
 * token=base    → prices for CASH (the base token), not APT
 */
/**
 * Fetch on-chain historical candles from the static JSON built by
 * `scripts/src/import-history.ts`. This covers the full ALL-TIME history
 * reconstructed from every on-chain swap event.
 */
export async function fetchHistoricalCandles(): Promise<CashCandle[]> {
  if (isFresh(cache.gtDay, TTL_CHART)) return cache.gtDay!.data

  const res = await fetch('/data/cash-historical-candles.json')
  if (!res.ok) throw new Error(`Historical candles ${res.status}`)

  const json = (await res.json()) as CashCandle[]
  const candles = json
    .filter((c) => c.close > 0)
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((c, i, arr) => i === 0 || c.timestamp !== arr[i - 1].timestamp)

  cache.gtDay = { data: candles, ts: Date.now() }
  return candles
}

export async function fetchGeckoTerminalOhlcv(
  timeframe: 'day' | 'hour',
  limit: number = 1000,
): Promise<CashCandle[]> {
  const cacheKey = timeframe === 'day' ? 'gtDay' : 'gtHour'
  if (isFresh(cache[cacheKey], TTL_CHART)) return cache[cacheKey]!.data

  const encodedPool = encodeURIComponent(LIQUIDSWAP_POOL)
  const url = `${GT_BASE}/networks/aptos/pools/${encodedPool}/ohlcv/${timeframe}?currency=usd&limit=${limit}&token=base`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`GeckoTerminal OHLCV ${res.status}`)

  const json = (await res.json()) as {
    data?: {
      attributes?: {
        ohlcv_list?: [number, number, number, number, number, number][]
      }
    }
  }

  const list = json.data?.attributes?.ohlcv_list ?? []
  const candles = list
    .map(([ts, open, high, low, close, volume]) => ({
      timestamp: ts * 1000,   // GeckoTerminal gives Unix seconds → convert to ms
      open, high, low, close,
      volume,
    }))
    .filter((c) => c.close > 0)
    .sort((a, b) => a.timestamp - b.timestamp)
    // Deduplicate: lightweight-charts requires strictly ascending timestamps
    .filter((c, i, arr) => i === 0 || c.timestamp !== arr[i - 1].timestamp)

  cache[cacheKey] = { data: candles, ts: Date.now() }
  return candles
}

// ============================================================
// GeckoTerminal — LiquidSwap pool TVL
// ============================================================

async function fetchGeckoTerminalTvl(): Promise<number | null> {
  if (isFresh(cache.tvl, TTL_CHART)) return cache.tvl!.data

  // Token pools endpoint returns all pools for CASH, sorted by TVL descending.
  const url = `${GT_BASE}/networks/aptos/tokens/${encodeURIComponent(CASH_TOKEN_ADDRESS)}/pools?page=1`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    cache.tvl = { data: null, ts: Date.now() }
    return null
  }

  const json = (await res.json()) as {
    data?: Array<{ attributes?: { reserve_in_usd?: string } }>
  }
  const raw = json.data?.[0]?.attributes?.reserve_in_usd
  const data = raw ? parseFloat(raw) : null
  cache.tvl = { data, ts: Date.now() }
  return data
}

// ============================================================
// CoinGecko — stats only (price / volume / market cap / FDV / ATH / ATL)
// ONE call per TTL — no chart data fetched here.
// ============================================================

const CG_BASE = 'https://api.coingecko.com/api/v3'
const CG_COIN  = 'cash-2'

export interface CoinGeckoStats {
  price:      number
  volume24h:  number
  marketCap:  number
  fdv:        number
  /** All-time high/low used as 52W proxy (CASH <2yo, so ATH ≈ 52W high) */
  ath:        number | null
  atl:        number | null
}

export async function fetchCoinGeckoStats(): Promise<CoinGeckoStats> {
  if (isFresh(cache.cgStats, TTL_STATS)) return cache.cgStats!.data

  const url = `${CG_BASE}/coins/${CG_COIN}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)

  const json = (await res.json()) as {
    market_data: {
      current_price:          { usd: number }
      total_volume:           { usd: number }
      market_cap:             { usd: number }
      fully_diluted_valuation:{ usd: number } | null
      ath:                    { usd: number }
      atl:                    { usd: number }
    }
  }

  const md   = json.market_data
  const data: CoinGeckoStats = {
    price:     md.current_price.usd,
    volume24h: md.total_volume.usd,
    marketCap: md.market_cap.usd,
    fdv:       md.fully_diluted_valuation?.usd ?? md.market_cap.usd,
    ath:       md.ath?.usd ?? null,
    atl:       md.atl?.usd ?? null,
  }
  cache.cgStats = { data, ts: Date.now() }
  return data
}

// ============================================================
// useCashTokenData — token metadata + market stats
// ============================================================

export interface CashTokenData {
  name:       string
  symbol:     string
  price:      number
  volume24h:  number
  pair:       string
  status:     string
  marketCap:  number | null
  fdv:        number | null
  high52w:    number | null
  low52w:     number | null
  tvl:        number | null
}

export function useCashTokenData(): {
  data:    CashTokenData | null
  loading: boolean
  error:   Error | null
} {
  const [data,    setData]    = useState<CashTokenData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<Error | null>(null)

  useEffect(() => {
    let cancelled  = false
    let hasLoaded  = false

    async function load(): Promise<void> {
      const isFirstFetch = !hasLoaded
      try {
        if (isFirstFetch) setLoading(true)

        // Three independent sources — all wrapped in .catch() so one failure
        // doesn't bring down the entire page.
        const [market, cgStats, tvl] = await Promise.all([
          fetchMarket().catch(() => null),
          fetchCoinGeckoStats().catch(() => null),
          fetchGeckoTerminalTvl().catch(() => null),
        ])

        // 52W high/low: use ATH/ATL from CoinGecko as initial proxy.
        // Once the user visits a long-period chart, gtDay cache is warm and we
        // upgrade to exact GeckoTerminal OHLCV values on the next poll.
        let high52w: number | null = cgStats?.ath ?? null
        let low52w:  number | null = cgStats?.atl ?? null
        if (isFresh(cache.gtDay, TTL_CHART)) {
          const cutoff   = Date.now() - 365 * 24 * 60 * 60 * 1000
          const yearData = cache.gtDay.data.filter((c) => c.timestamp >= cutoff)
          if (yearData.length > 0) {
            high52w = Math.max(...yearData.map((c) => c.high))
            low52w  = Math.min(...yearData.map((c) => c.low))
          }
        }

        const price      = cgStats?.price     ?? market?.lastPrice ?? 0
        const volume24h  = cgStats?.volume24h ?? market?.volume24h ?? 0
        const marketCap  = cgStats?.marketCap ?? (price > 0 ? CASH_TOTAL_SUPPLY * price : null)
        const fdv        = cgStats?.fdv        ?? marketCap

        if (!cancelled) {
          setData({
            name: 'CASH', symbol: 'CASH',
            price, volume24h,
            pair:   market?.pair ?? 'CASH/USD',
            status: market?.status ?? 'active',
            marketCap, fdv,
            high52w, low52w,
            tvl,
          })
          setError(null)
          hasLoaded = true
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (!cancelled && isFirstFetch) setLoading(false)
      }
    }

    void load()
    // Refresh every 2 min — CoinGecko cache absorbs most polls.
    const interval = setInterval(() => void load(), 2 * 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return { data, loading, error }
}

// ============================================================
// useCashPriceHistory — candle data for the standalone CashChart component
// ============================================================

const PERIOD_TO_INTERVAL: Record<string, CashCandleInterval> = {
  '1D': '5m',
  '1W': '1h',
}

export function useCashPriceHistory(period: string = '1D'): {
  candles: CashCandle[]
  loading: boolean
  error:   Error | null
} {
  const [candles, setCandles] = useState<CashCandle[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      try {
        setLoading(true)
        let data: CashCandle[]

        if (period === 'ALL' || period === '1Y') {
          // Daily OHLCV from GeckoTerminal — full history, cached
          data = await fetchGeckoTerminalOhlcv('day', 1000)
          if (period === '1Y') {
            const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000
            data = data.filter((c) => c.timestamp >= cutoff)
          }
        } else if (period === '1M') {
          // Hourly OHLCV — 30 days
          data = await fetchGeckoTerminalOhlcv('hour', 720)
        } else if (period === '1H') {
          // 5m candles from backend, filtered to last hour
          data = await fetchCandles('5m')
          data = data.filter((c) => c.timestamp >= Date.now() - 60 * 60 * 1000)
        } else {
          const interval = PERIOD_TO_INTERVAL[period] ?? '5m'
          data = await fetchCandles(interval)
          const periodMs: Record<string, number> = {
            '1D': 24 * 60 * 60 * 1000,
            '1W':  7 * 24 * 60 * 60 * 1000,
          }
          const cutoff = periodMs[period] ? Date.now() - periodMs[period] : 0
          if (cutoff > 0) data = data.filter((c) => c.timestamp >= cutoff)
        }

        if (!cancelled) { setCandles(data); setError(null) }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [period])

  return { candles, loading, error }
}

// ============================================================
// useCashTrades — recent trades with real-time updates
// ============================================================

export function useCashTrades(limit = 50): {
  trades:  CashTrade[]
  loading: boolean
  error:   Error | null
} {
  const [trades,  setTrades]  = useState<CashTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<Error | null>(null)
  const tradesRef = useRef<CashTrade[]>([])

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      try {
        setLoading(true)
        const data = await fetchTrades(limit)
        if (!cancelled) {
          tradesRef.current = data
          setTrades(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [limit])

  const handleNewTrade = useCallback(
    (data: unknown) => {
      const trade = data as CashTrade
      if (trade?.id && trade?.price) {
        const updated = [trade, ...tradesRef.current].slice(0, limit)
        tradesRef.current = updated
        setTrades(updated)
      }
    },
    [limit],
  )

  useEffect(() => {
    const unsub = cashWs.subscribe('trades', handleNewTrade)
    return unsub
  }, [handleNewTrade])

  return { trades, loading, error }
}
