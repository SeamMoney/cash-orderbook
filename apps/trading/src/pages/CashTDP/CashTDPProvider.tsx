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
import { TimePeriod, toHistoryDuration } from '~/appGraphql/data/util'
import { fetchCandles, fetchMarket, type CashCandle, type CashCandleInterval } from '~/data/api'
import { useCashTokenData } from '~/data/hooks'
import type { TDPChartState } from '~/pages/TokenDetails/components/chart/TDPChartState'
import type { MultiChainMap, PendingTDPContext, LoadedTDPContext } from '~/pages/TokenDetails/context/TDPContext'
import { TDPStoreContext } from '~/pages/TokenDetails/context/TDPContext'
import { createTDPStore } from '~/pages/TokenDetails/context/createTDPStore'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CASH_GREEN = '#00D54B'

/**
 * Data URI for the CASH green dollar sign logo (same SVG as NavIcon.tsx).
 * Used by TokenDetailsHeader → TokenLogo to render the token icon.
 */
const CASH_LOGO_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none">' +
    '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-1.5c-1.5-.27-2.82-1.13-3.28-2.59l1.63-.65c.36 1.13 1.38 1.64 2.65 1.64 1.33 0 2.14-.55 2.14-1.46 0-.82-.58-1.27-2.14-1.72-1.88-.54-3.35-1.19-3.35-3.04 0-1.63 1.28-2.72 3.35-3.02V6h2v1.65c1.31.29 2.22 1.1 2.58 2.35l-1.63.65c-.28-.89-1.02-1.5-2.14-1.5-1.22 0-1.93.58-1.93 1.37 0 .74.59 1.13 2.14 1.58 2.08.58 3.35 1.29 3.35 3.18 0 1.73-1.34 2.82-3.37 3.12V17z" fill="#00D54B"/>' +
    '</svg>',
)}`

/** Total CASH token supply — all 1 billion tokens minted at genesis, no vesting. */
const CASH_TOTAL_SUPPLY = 1_000_000_000

/** CASH contract address on Aptos */
const CASH_CONTRACT_ADDRESS = '0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1'

/** Full CASH token description (from web/components/token-info.tsx) */
const CASH_DESCRIPTION =
  'CASH is a token on the Aptos blockchain powering the CASH Orderbook, a high-performance Central Limit Order Book (CLOB) for zero-slippage trading. Built on Aptos\' parallel execution engine (Block-STM), the CASH Orderbook delivers sub-second finality and throughput exceeding 100,000 transactions per second, enabling institutional-grade trading with price-time priority matching, maker/taker fee tiers, and full on-chain settlement via the FungibleAsset standard.'

/** Map TimePeriod → API candle interval */
const PERIOD_TO_INTERVAL: Record<TimePeriod, CashCandleInterval> = {
  [TimePeriod.HOUR]: '1m',
  [TimePeriod.DAY]: '5m',
  [TimePeriod.WEEK]: '1h',
  [TimePeriod.MONTH]: '1h',
  [TimePeriod.YEAR]: '1d',
  [TimePeriod.MAX]: '1d',
}

/** How far back each time period reaches */
const PERIOD_MS: Record<string, number> = {
  [TimePeriod.HOUR]: 60 * 60 * 1000,
  [TimePeriod.DAY]: 24 * 60 * 60 * 1000,
  [TimePeriod.WEEK]: 7 * 24 * 60 * 60 * 1000,
  [TimePeriod.MONTH]: 30 * 24 * 60 * 60 * 1000,
  [TimePeriod.YEAR]: 365 * 24 * 60 * 60 * 1000,
}

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
        totalValueLocked: { __typename: 'Amount' as const, id: 'cash-tvl', value: null, currency: GraphQLApi.Currency.Usd },
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

function useCashChartState(): TDPChartState {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(TimePeriod.DAY)
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
        const interval = PERIOD_TO_INTERVAL[timePeriod]
        const candles = await fetchCandles(interval)

        // Filter by time period
        const now = Date.now()
        const cutoffMs = PERIOD_MS[timePeriod]
        const cutoff = cutoffMs ? now - cutoffMs : 0
        const filtered = cutoff > 0 ? candles.filter((c) => c.timestamp >= cutoff) : candles

        if (!cancelled) {
          setPriceEntries(filtered.map(candleToPriceChartData))
          setVolumeEntries(filtered.map(candleToVolumeData))
        }
      } catch {
        // Keep existing data on error
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => { cancelled = true }
  }, [timePeriod])

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
  const chartState = useCashChartState()

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
