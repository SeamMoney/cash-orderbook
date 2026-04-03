import { GqlResult, GraphQLApi } from '@universe/api'
import { useMemo } from 'react'
import { useCashTokenOverride } from 'uniswap/src/components/TokenSelector/CashTokenOverrideContext'
import { getCommonBase } from 'uniswap/src/constants/routing'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { CurrencyInfo } from 'uniswap/src/features/dataApi/types'
import { currencyIdToContractInput } from 'uniswap/src/features/dataApi/utils/currencyIdToContractInput'
import { gqlTokenToCurrencyInfo } from 'uniswap/src/features/dataApi/utils/gqlTokenToCurrencyInfo'
import {
  buildNativeCurrencyId,
  buildWrappedNativeCurrencyId,
  currencyIdToAddress,
  currencyIdToChain,
} from 'uniswap/src/utils/currencyId'

function useCurrencyInfoQuery(
  _currencyId?: string,
  options?: { refetch?: boolean; skip?: boolean },
): { currencyInfo: Maybe<CurrencyInfo>; loading: boolean; error?: Error } {
  const queryResult = GraphQLApi.useTokenQuery({
    variables: currencyIdToContractInput(_currencyId ?? ''),
    skip: !_currencyId || options?.skip,
    fetchPolicy: options?.refetch ? 'cache-and-network' : 'cache-first',
  })

  const currencyInfo = useMemo(() => {
    if (!_currencyId) {
      return undefined
    }

    const chainId = currencyIdToChain(_currencyId)
    let address: Address | undefined
    try {
      address = currencyIdToAddress(_currencyId)
    } catch (_error) {
      return undefined
    }
    if (chainId && address) {
      const commonBase = getCommonBase(chainId, address)
      if (commonBase) {
        // Creating new object to avoid error "Cannot assign to read only property"
        const copyCommonBase = { ...commonBase }
        // Related to TODO(WEB-5111)
        // Some common base images are broken so this'll ensure we read from uniswap images
        if (queryResult.data?.token?.project?.logoUrl) {
          copyCommonBase.logoUrl = queryResult.data.token.project.logoUrl
        }
        copyCommonBase.currencyId = _currencyId

        // Local common base object will not have remote project id, so we add it here.
        copyCommonBase.projectId = queryResult.data?.token?.project?.id

        return copyCommonBase
      }
    }

    return queryResult.data?.token && gqlTokenToCurrencyInfo(queryResult.data.token)
  }, [_currencyId, queryResult.data?.token])

  return {
    currencyInfo,
    loading: queryResult.loading,
    error: queryResult.error,
  }
}

export function useCurrencyInfo(
  _currencyId?: string,
  options?: { refetch?: boolean; skip?: boolean },
): Maybe<CurrencyInfo> {
  const cashOverride = useCashTokenOverride()

  const cashMatch = useMemo(() => {
    if (!cashOverride.enabled || !_currencyId) {
      return undefined
    }
    return cashOverride.tokens.find((t) => t.currencyInfo.currencyId === _currencyId)?.currencyInfo
  }, [cashOverride.enabled, cashOverride.tokens, _currencyId])

  const { currencyInfo } = useCurrencyInfoQuery(_currencyId, {
    ...options,
    skip: options?.skip || !!cashMatch,
  })

  return cashMatch ?? currencyInfo
}

export function useCurrencyInfoWithLoading(
  _currencyId?: string,
  options?: { refetch?: boolean; skip?: boolean },
): {
  currencyInfo: Maybe<CurrencyInfo>
  loading: boolean
  error?: Error
} {
  const cashOverride = useCashTokenOverride()

  const cashMatch = useMemo(() => {
    if (!cashOverride.enabled || !_currencyId) {
      return undefined
    }
    return cashOverride.tokens.find((t) => t.currencyInfo.currencyId === _currencyId)?.currencyInfo
  }, [cashOverride.enabled, cashOverride.tokens, _currencyId])

  const result = useCurrencyInfoQuery(_currencyId, {
    ...options,
    skip: options?.skip || !!cashMatch,
  })

  return {
    currencyInfo: cashMatch ?? result.currencyInfo,
    loading: cashMatch ? false : result.loading,
    error: cashMatch ? undefined : result.error,
  }
}

export function useCurrencyInfos(
  _currencyIds: string[],
  options?: { refetch?: boolean; skip?: boolean },
): Maybe<CurrencyInfo>[] {
  const { data } = GraphQLApi.useTokensQuery({
    variables: {
      contracts: _currencyIds.map(currencyIdToContractInput),
    },
    skip: !_currencyIds.length || options?.skip,
    fetchPolicy: options?.refetch ? 'cache-and-network' : 'cache-first',
  })

  return useMemo(() => {
    return data?.tokens?.map((token) => token && gqlTokenToCurrencyInfo(token)) ?? []
  }, [data])
}

export function useCurrencyInfosWithLoading(
  _currencyIds: string[],
  options?: { refetch?: boolean; skip?: boolean },
): GqlResult<CurrencyInfo[]> {
  const queryResult = GraphQLApi.useTokensQuery({
    variables: {
      contracts: _currencyIds.map(currencyIdToContractInput),
    },
    skip: !_currencyIds.length || options?.skip,
    fetchPolicy: options?.refetch ? 'cache-and-network' : 'cache-first',
  })

  return useMemo(() => {
    return {
      data:
        queryResult.data?.tokens
          ?.map((token) => token && gqlTokenToCurrencyInfo(token))
          .filter((currencyInfo) => !!currencyInfo) ?? [],
      loading: queryResult.loading,
      error: queryResult.error,
      refetch: queryResult.refetch,
    }
  }, [queryResult.data?.tokens, queryResult.loading, queryResult.error, queryResult.refetch])
}

export function useNativeCurrencyInfo(chainId: UniverseChainId): Maybe<CurrencyInfo> {
  const nativeCurrencyId = buildNativeCurrencyId(chainId)
  return useCurrencyInfo(nativeCurrencyId)
}

export function useWrappedNativeCurrencyInfo(chainId: UniverseChainId): Maybe<CurrencyInfo> {
  const wrappedCurrencyId = buildWrappedNativeCurrencyId(chainId)
  return useCurrencyInfo(wrappedCurrencyId)
}
