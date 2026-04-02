/**
 * React hooks that adapt the CASH REST/WS API into component-friendly state.
 *
 * These replace the Uniswap GraphQL hooks for the CASH token detail page.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchCandles,
  fetchMarket,
  fetchTrades,
  type CashCandle,
  type CashCandleInterval,
  type CashMarketInfo,
  type CashTrade,
} from '~/data/api'
import { cashWs } from '~/data/ws'

/** Total CASH token supply — all 1 billion tokens minted at genesis, no vesting. */
const CASH_TOTAL_SUPPLY = 1_000_000_000

// ============================================================
// useCashTokenData — token metadata + market stats
// ============================================================

export interface CashTokenData {
  name: string
  symbol: string
  price: number
  volume24h: number
  pair: string
  status: string
  /** Derived stats */
  marketCap: number | null
  fdv: number | null
  high52w: number | null
  low52w: number | null
}

export function useCashTokenData(): {
  data: CashTokenData | null
  loading: boolean
  error: Error | null
} {
  const [data, setData] = useState<CashTokenData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      try {
        setLoading(true)
        const market = await fetchMarket()

        // Also fetch 1d candles to derive 52w high/low
        let high52w: number | null = null
        let low52w: number | null = null
        try {
          const dailyCandles = await fetchCandles('1d')
          if (dailyCandles.length > 0) {
            // Take last 365 candles (or all available)
            const yearCandles = dailyCandles.slice(-365)
            high52w = Math.max(...yearCandles.map((c) => c.high))
            low52w = Math.min(...yearCandles.map((c) => c.low))
          }
        } catch {
          // Non-critical
        }

        if (!cancelled) {
          setData({
            name: 'CASH',
            symbol: 'CASH',
            price: market.lastPrice,
            volume24h: market.volume24h,
            pair: market.pair,
            status: market.status,
            marketCap: market.lastPrice > 0 ? CASH_TOTAL_SUPPLY * market.lastPrice : null,
            fdv: market.lastPrice > 0 ? CASH_TOTAL_SUPPLY * market.lastPrice : null,
            high52w,
            low52w,
          })
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    // Poll every 10 seconds for fresh market data
    const interval = setInterval(() => void load(), 10_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return { data, loading, error }
}

// ============================================================
// useCashPriceHistory — OHLCV candle data for charts
// ============================================================

/** Map from UI time period label to API candle interval */
const PERIOD_TO_INTERVAL: Record<string, CashCandleInterval> = {
  '1H': '1m',
  '1D': '5m',
  '1W': '1h',
  '1M': '1h',
  '1Y': '1d',
  ALL: '1d',
}

export function useCashPriceHistory(period: string = '1D'): {
  candles: CashCandle[]
  loading: boolean
  error: Error | null
} {
  const [candles, setCandles] = useState<CashCandle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      try {
        setLoading(true)
        const interval = PERIOD_TO_INTERVAL[period] ?? '5m'
        const data = await fetchCandles(interval)

        // Filter candles based on the time period
        const now = Date.now()
        const periodMs: Record<string, number> = {
          '1H': 60 * 60 * 1000,
          '1D': 24 * 60 * 60 * 1000,
          '1W': 7 * 24 * 60 * 60 * 1000,
          '1M': 30 * 24 * 60 * 60 * 1000,
          '1Y': 365 * 24 * 60 * 60 * 1000,
        }
        const cutoff = periodMs[period] ? now - periodMs[period] : 0
        const filtered = cutoff > 0 ? data.filter((c) => c.timestamp >= cutoff) : data

        if (!cancelled) {
          setCandles(filtered)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [period])

  return { candles, loading, error }
}

// ============================================================
// useCashTrades — recent trades with real-time updates
// ============================================================

export function useCashTrades(limit = 50): {
  trades: CashTrade[]
  loading: boolean
  error: Error | null
} {
  const [trades, setTrades] = useState<CashTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const tradesRef = useRef<CashTrade[]>([])

  // Initial fetch
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
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [limit])

  // Subscribe to real-time trade updates
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
