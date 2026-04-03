/* eslint-disable import/no-unused-modules */
// TODO(WEB-4448): for multichain, refactored our custom useBlockNumber in favor of wagmi's hook. Remove this provider

import { atom } from 'jotai'
import { createContext, PropsWithChildren, useContext, useMemo } from 'react'
import { UniverseChainId } from 'uniswap/src/features/chains/types'

// MulticallUpdater is outside of the SwapAndLimitContext but we still want to use the swap context chainId for swap-related multicalls
export const multicallUpdaterSwapChainIdAtom = atom<UniverseChainId | undefined>(undefined)

const MISSING_PROVIDER = Symbol()

export const BlockNumberContext = createContext<
  | {
      fastForward(block: number): void
      block?: number
      mainnetBlock?: number
    }
  | typeof MISSING_PROVIDER
>(MISSING_PROVIDER)
function useBlockNumberContext() {
  const blockNumber = useContext(BlockNumberContext)
  if (blockNumber === MISSING_PROVIDER) {
    throw new Error('BlockNumber hooks must be wrapped in a <BlockNumberProvider>')
  }
  return blockNumber
}
export function useFastForwardBlockNumber(): (block: number) => void {
  return useBlockNumberContext().fastForward
}
/** Requires that BlockUpdater be installed in the DOM tree. */
export default function useBlockNumber(): number | undefined {
  return useBlockNumberContext().block
}
export function useMainnetBlockNumber(): number | undefined {
  return useBlockNumberContext().mainnetBlock
}
const noop = (_block: number) => {}

export function BlockNumberProvider({ children }: PropsWithChildren) {
  const value = useMemo(
    () => ({
      fastForward: noop,
      block: undefined,
      mainnetBlock: undefined,
    }),
    [],
  )
  return <BlockNumberContext.Provider value={value}>{children}</BlockNumberContext.Provider>
}
