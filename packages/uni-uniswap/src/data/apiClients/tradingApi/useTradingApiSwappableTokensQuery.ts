import type { QueryClient, QueryFunction, QueryKey, UseQueryResult } from '@tanstack/react-query'
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TradingApi, UseQueryApiHelperHookArgs } from '@universe/api'
import { type SwappableTokensParams } from '@universe/api'
import { useEffect } from 'react'
import { useCashTokenOverride } from 'uniswap/src/components/TokenSelector/CashTokenOverrideContext'
import { uniswapUrls } from 'uniswap/src/constants/urls'
import { TradingApiClient } from 'uniswap/src/data/apiClients/tradingApi/TradingApiClient'
import type { TradeableAsset } from 'uniswap/src/entities/assets'
import {
  getTokenAddressFromChainForTradingApi,
  toTradingApiSupportedChainId,
} from 'uniswap/src/features/transactions/swap/utils/tradingApi'
import { logger } from 'utilities/src/logger/logger'
import { ReactQueryCacheKey } from 'utilities/src/reactQuery/cache'
import { MAX_REACT_QUERY_CACHE_TIME_MS } from 'utilities/src/time/time'

export function useTradingApiSwappableTokensQuery({
  params,
  ...rest
}: UseQueryApiHelperHookArgs<
  SwappableTokensParams,
  TradingApi.GetSwappableTokensResponse
>): UseQueryResult<TradingApi.GetSwappableTokensResponse> {
  const cashOverride = useCashTokenOverride()
  const queryKey = swappableTokensQueryKey(params)

  return useQuery<TradingApi.GetSwappableTokensResponse>({
    queryKey,
    queryFn: params && !cashOverride.enabled ? swappableTokensQueryFn(params) : skipToken,
    // When CASH override is active, disable the query entirely (EVM-only, CORS-blocked).
    enabled: cashOverride.enabled ? false : undefined,
    // In order for `getSwappableTokensQueryData` to be more likely to have cached data,
    // we set the `gcTime` to the longest possible time.
    gcTime: MAX_REACT_QUERY_CACHE_TIME_MS,
    ...rest,
  })
}

// Synchronous way of reading the cached data for this query.
// It will return `undefined` if the data is not cached.
export function getSwappableTokensQueryData({
  queryClient,
  params,
}: {
  queryClient: QueryClient
  params: SwappableTokensParams
}): TradingApi.GetSwappableTokensResponse | undefined {
  return queryClient.getQueryData(swappableTokensQueryKey(params))
}

export function usePrefetchSwappableTokens(input: Maybe<TradeableAsset>): void {
  const cashOverride = useCashTokenOverride()
  const queryClient = useQueryClient()

  useEffect(() => {
    // When CASH override is active, skip prefetching swappable tokens from the
    // Uniswap trading API — it's EVM-only and will CORS-fail for our Aptos app.
    if (cashOverride.enabled) {
      return
    }

    const prefetchSwappableTokens = async (): Promise<void> => {
      const tokenIn = input?.address ? getTokenAddressFromChainForTradingApi(input.address, input.chainId) : undefined
      const tokenInChainId = toTradingApiSupportedChainId(input?.chainId)
      if (!tokenIn || !tokenInChainId) {
        return
      }

      await queryClient.prefetchQuery({
        queryKey: swappableTokensQueryKey({
          tokenIn,
          tokenInChainId,
        }),
        queryFn: swappableTokensQueryFn({
          tokenIn,
          tokenInChainId,
        }),
        // In order for `getSwappableTokensQueryData` to be more likely to have cached data,
        // we set the `gcTime` to the longest possible time.
        gcTime: MAX_REACT_QUERY_CACHE_TIME_MS,
      })
    }

    prefetchSwappableTokens().catch((e) => {
      logger.error(e, {
        tags: { file: 'useTradingApiSwappableTokensQuery', function: 'prefetchSwappableTokens' },
      })
    })
  }, [input, queryClient, cashOverride.enabled])
}

const swappableTokensQueryKey = (params?: SwappableTokensParams): QueryKey => {
  return [ReactQueryCacheKey.TradingApi, uniswapUrls.tradingApiPaths.swappableTokens, params]
}

const swappableTokensQueryFn = (
  params: SwappableTokensParams,
): QueryFunction<TradingApi.GetSwappableTokensResponse, QueryKey, never> | undefined => {
  return async (): ReturnType<typeof TradingApiClient.fetchSwappableTokens> =>
    await TradingApiClient.fetchSwappableTokens(params)
}
