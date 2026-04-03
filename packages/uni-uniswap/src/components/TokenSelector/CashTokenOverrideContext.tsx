import { type Currency } from '@uniswap/sdk-core'
import { createContext, useContext, type ReactNode } from 'react'
import { TokenOption } from 'uniswap/src/components/lists/items/types'

interface CashTokenOverrideValue {
  enabled: boolean
  tokens: TokenOption[]
  defaultInputCurrency?: Currency
}

const CashTokenOverrideContext = createContext<CashTokenOverrideValue>({ enabled: false, tokens: [] })

export function CashTokenOverrideProvider({
  tokens,
  defaultInputCurrency,
  children,
}: {
  tokens: TokenOption[]
  defaultInputCurrency?: Currency
  children: ReactNode
}): JSX.Element {
  return (
    <CashTokenOverrideContext.Provider value={{ enabled: true, tokens, defaultInputCurrency }}>
      {children}
    </CashTokenOverrideContext.Provider>
  )
}

export function useCashTokenOverride(): CashTokenOverrideValue {
  return useContext(CashTokenOverrideContext)
}
