import { type Currency } from '@uniswap/sdk-core'
import { createContext, useContext, type ComponentType, type ReactNode } from 'react'
import { TokenOption } from 'uniswap/src/components/lists/items/types'

interface CashTokenOverrideValue {
  enabled: boolean
  tokens: TokenOption[]
  defaultInputCurrency?: Currency
  /** When set, this component replaces the standard Uniswap swap button */
  SwapButtonComponent?: ComponentType
  /** Returns a swap quote for the given input amount and direction */
  getQuote?: (amount: number, direction: 'buy' | 'sell') => { outputAmount: number; sufficientLiquidity: boolean } | null
  /** Returns the user's balance for a given token address (in human-readable units) */
  getBalance?: (address: string) => number | null
  /** Returns the USD price per unit for a given token address (used to compute fiat values) */
  getUsdPrice?: (address: string) => number | null
}

const CashTokenOverrideContext = createContext<CashTokenOverrideValue>({ enabled: false, tokens: [] })

export function CashTokenOverrideProvider({
  tokens,
  defaultInputCurrency,
  SwapButtonComponent,
  getQuote,
  getBalance,
  getUsdPrice,
  children,
}: {
  tokens: TokenOption[]
  defaultInputCurrency?: Currency
  SwapButtonComponent?: ComponentType
  getQuote?: (amount: number, direction: 'buy' | 'sell') => { outputAmount: number; sufficientLiquidity: boolean } | null
  getBalance?: (address: string) => number | null
  getUsdPrice?: (address: string) => number | null
  children: ReactNode
}): JSX.Element {
  return (
    <CashTokenOverrideContext.Provider value={{ enabled: true, tokens, defaultInputCurrency, SwapButtonComponent, getQuote, getBalance, getUsdPrice }}>
      {children}
    </CashTokenOverrideContext.Provider>
  )
}

export function useCashTokenOverride(): CashTokenOverrideValue {
  return useContext(CashTokenOverrideContext)
}
