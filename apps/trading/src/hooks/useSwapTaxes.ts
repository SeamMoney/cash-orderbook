import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { ZERO_PERCENT } from '~/constants/misc'

/**
 * No-op implementation — the original hook tried to call an EVM fee-on-transfer
 * detector contract which doesn't exist for Aptos addresses and caused
 * errors / retry loops.  We simply return zero taxes.
 */
// Use the buyFeeBps/sellFeeBps fields from Token GQL query where possible instead of this hook
export function useSwapTaxes({
  inputTokenAddress: _inputTokenAddress,
  outputTokenAddress: _outputTokenAddress,
  tokenChainId: _tokenChainId,
}: {
  inputTokenAddress?: string
  outputTokenAddress?: string
  tokenChainId?: UniverseChainId
}) {
  return { inputTax: ZERO_PERCENT, outputTax: ZERO_PERCENT }
}
