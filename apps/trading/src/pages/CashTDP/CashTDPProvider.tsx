/**
 * CashTDPProvider — bridges CASH REST API data into the Uniswap TDP Zustand store shape.
 *
 * This provider fetches data from our API (GET /cash-api/market, /cash-api/candles),
 * maps it into the TokenWebQuery + TDPChartState shape, creates a Zustand store via
 * createTDPStore(), and wraps children with TDPStoreContext.Provider.
 *
 * This lets us render the REAL Uniswap TDP components (TokenDetailsContent) with CASH data.
 */

import type { QueryResult } from '@apollo/client'
import { GraphQLApi } from '@universe/api'
import { UTCTimestamp } from 'lightweight-charts'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { nativeOnChain } from 'uniswap/src/constants/tokens'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import type { PriceChartData } from '~/components/Charts/PriceChart'
import { ChartType, DataQuality, PriceChartType } from '~/components/Charts/utils'
import type { SingleHistogramData } from '~/components/Charts/VolumeChart/utils'
import { TimePeriod } from '~/appGraphql/data/util'
import type { CashCandle } from '~/data/api'
import { useCashTokenData, fetchGeckoTerminalOhlcv, fetchHistoricalCandles } from '~/data/hooks'
import type { TDPChartState } from '~/pages/TokenDetails/components/chart/TDPChartState'
import type { MultiChainMap, LoadedTDPContext } from '~/pages/TokenDetails/context/TDPContext'
import { TDPStoreContext } from '~/pages/TokenDetails/context/TDPContext'
import { createTDPStore } from '~/pages/TokenDetails/context/createTDPStore'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CASH_GREEN = '#00D54B'

/** CASH logo from Panora token list */
const CASH_LOGO_URL = 'https://assets.panora.exchange/tokens/aptos/CASH.png'

/** CASH contract address on Aptos */
const CASH_CONTRACT_ADDRESS = '0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1'

/** Full CASH token description (from web/components/token-info.tsx) */
const CASH_DESCRIPTION =
  'CASH is a token on the Aptos blockchain powering the CASH Orderbook, a high-performance Central Limit Order Book (CLOB) for zero-slippage trading. Built on Aptos\' parallel execution engine (Block-STM), the CASH Orderbook delivers sub-second finality and throughput exceeding 100,000 transactions per second, enabling institutional-grade trading with price-time priority matching, maker/taker fee tiers, and full on-chain settlement via the FungibleAsset standard.'

// Chart periods use GeckoTerminal OHLCV exclusively — no backend candle mapping needed.

// ---------------------------------------------------------------------------
// Helpers — build a mock TokenWebQuery result from CASH API data
// ---------------------------------------------------------------------------

function buildTokenQueryData(market: {
  lastPrice: number
  volume24h: number
  high52w: number | null
  low52w: number | null
  marketCap: number | null
  fdv: number | null
  tvl: number | null
}): GraphQLApi.TokenWebQuery {
  return {
    token: {
      __typename: 'Token' as const,
      id: 'cash-token',
      decimals: 8,
      name: 'CASH',
      chain: GraphQLApi.Chain.Ethereum,
      address: null,
      symbol: 'CASH',
      standard: null,
      market: {
        __typename: 'TokenMarket' as const,
        id: 'cash-market',
        totalValueLocked: { __typename: 'Amount' as const, id: 'cash-tvl', value: market.tvl, currency: GraphQLApi.Currency.Usd },
        price: { __typename: 'Amount' as const, id: 'cash-price', value: market.lastPrice, currency: GraphQLApi.Currency.Usd },
        volume24H: { __typename: 'Amount' as const, id: 'cash-vol', value: market.volume24h, currency: GraphQLApi.Currency.Usd },
        priceHigh52W: market.high52w != null
          ? { __typename: 'Amount' as const, id: 'cash-h52', value: market.high52w }
          : null,
        priceLow52W: market.low52w != null
          ? { __typename: 'Amount' as const, id: 'cash-l52', value: market.low52w }
          : null,
      },
      project: {
        __typename: 'TokenProject' as const,
        id: 'cash-project',
        name: 'CASH',
        description: CASH_DESCRIPTION,
        homepageUrl: 'https://github.com/nicholasgasior/cash-orderbook',
        twitterName: 'CashOrderbook',
        logoUrl: CASH_LOGO_URL,
        isSpam: false,
        tokens: [
          {
            __typename: 'Token' as const,
            id: 'cash-token-eth',
            chain: GraphQLApi.Chain.Ethereum,
            address: null,
            market: {
              __typename: 'TokenMarket' as const,
              id: 'cash-tok-market',
              totalValueLocked: null,
              price: { __typename: 'Amount' as const, id: 'cash-tok-price', value: market.lastPrice, currency: GraphQLApi.Currency.Usd },
              volume24H: { __typename: 'Amount' as const, id: 'cash-tok-vol', value: market.volume24h, currency: GraphQLApi.Currency.Usd },
            },
          },
        ],
        markets: [
          {
            __typename: 'TokenProjectMarket' as const,
            id: 'cash-proj-market',
            fullyDilutedValuation: market.fdv != null
              ? { __typename: 'Amount' as const, id: 'cash-fdv', value: market.fdv, currency: GraphQLApi.Currency.Usd }
              : null,
            marketCap: market.marketCap != null
              ? { __typename: 'Amount' as const, id: 'cash-mcap', value: market.marketCap, currency: GraphQLApi.Currency.Usd }
              : null,
            priceHigh52W: market.high52w != null
              ? { __typename: 'Amount' as const, id: 'cash-proj-h52', value: market.high52w }
              : null,
            priceLow52W: market.low52w != null
              ? { __typename: 'Amount' as const, id: 'cash-proj-l52', value: market.low52w }
              : null,
          },
        ],
      },
    },
  }
}

/**
 * Build a mock Apollo QueryResult wrapping our synthetic TokenWebQuery.
 */
function buildMockQueryResult(
  data: GraphQLApi.TokenWebQuery,
  loading: boolean,
): QueryResult<GraphQLApi.TokenWebQuery, GraphQLApi.Exact<{ chain: GraphQLApi.Chain; address?: string }>> {
  return {
    data,
    loading,
    error: undefined,
    called: true,
    networkStatus: 7, // ready
    // Stubs for the remaining QueryResult interface — the TDP components only read data/loading/error
    previousData: undefined,
    variables: { chain: GraphQLApi.Chain.Ethereum },
    fetchMore: (() => Promise.resolve({ data, loading: false })) as any,
    refetch: (() => Promise.resolve({ data, loading: false })) as any,
    startPolling: () => {},
    stopPolling: () => {},
    subscribeToMore: (() => () => {}) as any,
    updateQuery: () => {},
    reobserve: (() => Promise.resolve({ data, loading: false })) as any,
    client: {} as any,
    observable: {} as any,
    obpisFetchingMore: false,
  } as unknown as QueryResult<GraphQLApi.TokenWebQuery, GraphQLApi.Exact<{ chain: GraphQLApi.Chain; address?: string }>>
}

// ---------------------------------------------------------------------------
// Hook — chart state backed by CASH candles
// ---------------------------------------------------------------------------

function candleToPriceChartData(candle: CashCandle): PriceChartData {
  const time = (candle.timestamp / 1000) as UTCTimestamp // API gives ms, lightweight-charts needs seconds
  return {
    time,
    value: candle.close,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }
}

function candleToVolumeData(candle: CashCandle): SingleHistogramData {
  return {
    time: (candle.timestamp / 1000) as UTCTimestamp,
    value: candle.volume,
  }
}

function useCashChartState(currentPrice?: number): TDPChartState {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(TimePeriod.MAX)
  const [chartType, setChartType] = useState<ChartType.PRICE | ChartType.VOLUME | ChartType.TVL>(ChartType.PRICE)
  const [priceChartType, setPriceChartType] = useState<PriceChartType>(PriceChartType.LINE)

  const [priceEntries, setPriceEntries] = useState<PriceChartData[]>([])
  const [volumeEntries, setVolumeEntries] = useState<SingleHistogramData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      try {
        setLoading(true)

        let candles: CashCandle[]

        // All periods use on-chain historical daily candles from the static JSON.
        const historicalCandles = await fetchHistoricalCandles()
        // Copy so we don't mutate the cache
        const allCandles = [...historicalCandles]

        // Append a synthetic "now" candle at the current timestamp so the
        // dot sits at the very end of the line
        const nowMs = Date.now()
        const lastCandle = allCandles[allCandles.length - 1]
        const nowPrice = currentPrice && currentPrice > 0 ? currentPrice : lastCandle?.close ?? 0
        if (lastCandle && nowMs > lastCandle.timestamp && nowPrice > 0) {
          allCandles.push({
            timestamp: nowMs,
            open: nowPrice,
            high: nowPrice,
            low: nowPrice,
            close: nowPrice,
            volume: 0,
          })
        }

        if (timePeriod === TimePeriod.MAX) {
          candles = allCandles
        } else if (timePeriod === TimePeriod.YEAR) {
          const cutoff = nowMs - 365 * 24 * 60 * 60 * 1000
          candles = allCandles.filter((c) => c.timestamp >= cutoff)
        } else if (timePeriod === TimePeriod.MONTH) {
          const cutoff = nowMs - 30 * 24 * 60 * 60 * 1000
          candles = allCandles.filter((c) => c.timestamp >= cutoff)
        } else if (timePeriod === TimePeriod.WEEK) {
          const cutoff = nowMs - 7 * 24 * 60 * 60 * 1000
          candles = allCandles.filter((c) => c.timestamp >= cutoff)
        } else {
          // 1D / 1H — show last 14 daily candles for visual context
          candles = allCandles.slice(-14)
        }

        if (!cancelled) {
          // Deduplicate by time (seconds) — lightweight-charts requires strictly ascending
          const priceData = candles.map(candleToPriceChartData)
            .filter((d, i, arr) => i === 0 || d.time !== arr[i - 1].time)
          const volumeData = candles.map(candleToVolumeData)
            .filter((d, i, arr) => i === 0 || d.time !== arr[i - 1].time)
          setPriceEntries(priceData)
          setVolumeEntries(volumeData)
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[CashChart] Failed to load candles for', timePeriod, err)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => { cancelled = true }
  }, [timePeriod, currentPrice])

  return useMemo(() => {
    const priceQuery = {
      chartType: ChartType.PRICE as const,
      entries: priceEntries,
      loading,
      dataQuality: priceEntries.length > 0 ? DataQuality.VALID : DataQuality.INVALID,
    }
    const volumeQuery = {
      chartType: ChartType.VOLUME as const,
      entries: volumeEntries,
      loading,
      dataQuality: volumeEntries.length > 0 ? DataQuality.VALID : DataQuality.INVALID,
    }
    const tvlQuery = {
      chartType: ChartType.TVL as const,
      entries: [] as { time: UTCTimestamp; values: number[] }[],
      loading: false,
      dataQuality: DataQuality.INVALID,
    }

    const activeQuery = (() => {
      switch (chartType) {
        case ChartType.PRICE:
          return priceQuery
        case ChartType.VOLUME:
          return volumeQuery
        case ChartType.TVL:
          return tvlQuery
      }
    })()

    return {
      timePeriod,
      setTimePeriod,
      setChartType,
      priceChartType,
      setPriceChartType,
      activeQuery,
      disableCandlestickUI: false,
    }
  }, [timePeriod, chartType, priceChartType, priceEntries, volumeEntries, loading])
}

// ---------------------------------------------------------------------------
// Provider component
// ---------------------------------------------------------------------------

interface CashTDPProviderProps {
  children: ReactNode
}

export function CashTDPProvider({ children }: CashTDPProviderProps): JSX.Element {
  const { data: tokenData, loading: tokenLoading } = useCashTokenData()
  const chartState = useCashChartState(tokenData?.price)

  // Create a Token-like currency for CASH so the header shows name/symbol and
  // the address pill renders the contract address with a copy button.
  const currency = useMemo(() => {
    const native = nativeOnChain(UniverseChainId.Mainnet)
    return Object.create(native, {
      name: { value: 'CASH', writable: false, enumerable: true, configurable: true },
      symbol: { value: 'CASH', writable: false, enumerable: true, configurable: true },
      // Mark as non-native so the contract address pill appears in the header
      isNative: { value: false, writable: false, enumerable: true, configurable: true },
      isToken: { value: true, writable: false, enumerable: true, configurable: true },
      address: { value: CASH_CONTRACT_ADDRESS, writable: false, enumerable: true, configurable: true },
    }) as typeof native
  }, [])

  const tokenQueryData = useMemo(
    () =>
      buildTokenQueryData({
        lastPrice: tokenData?.price ?? 0,
        volume24h: tokenData?.volume24h ?? 0,
        high52w: tokenData?.high52w ?? null,
        low52w: tokenData?.low52w ?? null,
        marketCap: tokenData?.marketCap ?? null,
        fdv: tokenData?.fdv ?? null,
        tvl: tokenData?.tvl ?? null,
      }),
    [tokenData],
  )

  const tokenQuery = useMemo(
    () => buildMockQueryResult(tokenQueryData, tokenLoading),
    [tokenQueryData, tokenLoading],
  )

  const multiChainMap: MultiChainMap = useMemo(
    () => ({
      [GraphQLApi.Chain.Ethereum]: { address: undefined, balance: undefined },
    }),
    [],
  )

  const derivedState: LoadedTDPContext = useMemo(
    () => ({
      currency,
      currencyChain: GraphQLApi.Chain.Ethereum,
      currencyChainId: UniverseChainId.Mainnet,
      address: CASH_CONTRACT_ADDRESS,
      tokenQuery,
      chartState,
      multiChainMap,
      tokenColor: CASH_GREEN,
    }),
    [currency, tokenQuery, chartState, multiChainMap],
  )

  const storeRef = useRef(createTDPStore(derivedState))

  // Keep store in sync with derived state
  useEffect(() => {
    const store = storeRef.current
    const state = store.getState()
    const { actions } = state

    actions.setTokenQuery(derivedState.tokenQuery)
    actions.setChartState(derivedState.chartState)
    actions.setMultiChainMap(derivedState.multiChainMap)
    actions.setTokenColor(derivedState.tokenColor)
    actions.setCurrency(derivedState.currency)
    actions.setAddress(derivedState.address)
  }, [derivedState])

  return (
    <TDPStoreContext.Provider value={storeRef.current}>
      {children}
    </TDPStoreContext.Provider>
  )
}
