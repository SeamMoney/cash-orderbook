import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { useCashTokenOverride } from 'uniswap/src/components/TokenSelector/CashTokenOverrideContext'
import { useTradeService } from 'uniswap/src/features/services'
import { createIndicativeTradeServiceQueryOptions } from 'uniswap/src/features/transactions/swap/hooks/useTrade/useIndicativeTradeServiceQueryOptions'
import { IndicativeTrade, type UseTradeArgs } from 'uniswap/src/features/transactions/swap/types/trade'
import { useEvent } from 'utilities/src/react/hooks'

export function useIndicativeTradeQuery(params: UseTradeArgs): {
  trade: IndicativeTrade | undefined
  isLoading: boolean
} {
  const cashOverride = useCashTokenOverride()
  const tradeService = useTradeService()
  const getIndicativeTradeQueryOptions = useEvent(createIndicativeTradeServiceQueryOptions({ tradeService }))

  const baseOptions = getIndicativeTradeQueryOptions(params)

  const { data, isLoading }: UseQueryResult<IndicativeTrade | null> = useQuery({
    ...baseOptions,
    // When CASH override is active, disable indicative trade queries (EVM-only, CORS-blocked).
    enabled: cashOverride.enabled ? false : baseOptions.enabled,
  })

  return {
    trade: data ?? undefined,
    isLoading,
  }
}
