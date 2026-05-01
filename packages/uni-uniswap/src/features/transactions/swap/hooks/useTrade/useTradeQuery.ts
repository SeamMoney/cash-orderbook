import { UseQueryResult } from '@tanstack/react-query'
import { useQueryWithImmediateGarbageCollection } from '@universe/api'
import { useRef } from 'react'
import { useCashTokenOverride } from 'uniswap/src/components/TokenSelector/CashTokenOverrideContext'
import { useTradeService } from 'uniswap/src/features/services'
import { usePollingIntervalByChain } from 'uniswap/src/features/transactions/hooks/usePollingIntervalByChain'
import { parseQuoteCurrencies } from 'uniswap/src/features/transactions/swap/hooks/useTrade/parseQuoteCurrencies'
import { createTradeServiceQueryOptions } from 'uniswap/src/features/transactions/swap/hooks/useTrade/useTradeServiceQueryOptions'
import { TradeWithGasEstimates } from 'uniswap/src/features/transactions/swap/services/tradeService/tradeService'
import { UseTradeArgs } from 'uniswap/src/features/transactions/swap/types/trade'
import { useEvent } from 'utilities/src/react/hooks'
import { ONE_SECOND_MS } from 'utilities/src/time/time'

export function useTradeQuery(params: UseTradeArgs): UseQueryResult<TradeWithGasEstimates> {
  const cashOverride = useCashTokenOverride()
  const quoteCurrencyData = parseQuoteCurrencies(params)
  const pollingIntervalForChain = usePollingIntervalByChain(quoteCurrencyData.currencyIn?.chainId)
  const internalPollInterval = params.pollInterval ?? pollingIntervalForChain
  const tradeService = useTradeService()
  const getTradeQueryOptions = useEvent(createTradeServiceQueryOptions({ tradeService }))

  const baseOptions = getTradeQueryOptions(params)

  const response = useQueryWithImmediateGarbageCollection({
    ...baseOptions,
    // When CASH override is active, disable the EVM quote polling entirely.
    // The Uniswap trading API is unreachable (CORS) and irrelevant for Aptos.
    enabled: cashOverride.enabled ? false : baseOptions.enabled,
    refetchInterval: cashOverride.enabled ? false : internalPollInterval,
    // We set the `gcTime` to 15 seconds longer than the refetch interval so that there's more than enough time for a refetch to complete before we clear the stale data.
    // If the user loses internet connection (or leaves the app and comes back) for longer than this,
    // then we clear stale data and show a big loading spinner in the swap review screen.
    immediateGcTime: internalPollInterval + ONE_SECOND_MS * 15,
    // We want to retry once, rather than the default, in order to populate response.error / Error UI sooner.
    // The query will still poll after failed retries, due to staleness.
    retry: 1,
  })

  const errorRef = useRef<Error | null>(response.error)

  // We want to keep the error while react-query is refetching, so that the error message doesn't go in and out while it's polling.
  if (response.errorUpdatedAt > response.dataUpdatedAt) {
    // If there's a new error, save the new one. If there's no error (we're re-fetching), keep the old one.
    errorRef.current = response.error ?? errorRef.current
  } else {
    errorRef.current = response.error
  }

  return {
    ...response,
    error: errorRef.current,
  } as UseQueryResult<TradeWithGasEstimates>
}
