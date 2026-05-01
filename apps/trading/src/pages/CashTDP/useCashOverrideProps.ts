import { useCallback, useEffect, useRef, useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { getPanoraQuote, type PanoraQuote } from '~/cash/lib/panora'
import { useAptosWalletBalances } from '~/cash/hooks/use-aptos-balances'
import { useCashTokenData } from '~/data/hooks'

// ---------------------------------------------------------------------------
// Token address → symbol map (for Panora quotes)
// ---------------------------------------------------------------------------

const CASH_ADDRESS = '0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1'

const ADDRESS_TO_SYMBOL: Record<string, string> = {
  [CASH_ADDRESS.toLowerCase()]: 'CASH',
  '0x05fabd1b12e39967a3c24e91b7b8f67719a6dacee74f3c8b9fb7d93e855437d2': 'USD1',
  '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b': 'USDC',
  '0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b': 'USDt',
  '0xf37a8864fe737eb8ec2c2931047047cbaed1beed3fb0e5b7c5526dafd3b9c2e9': 'USDe',
}

// Balance fetching is in the shared hook: ~/cash/hooks/use-aptos-balances.ts

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useCashOverrideProps(): {
  getQuote: (amount: number, direction: 'buy' | 'sell') => { outputAmount: number; sufficientLiquidity: boolean } | null
  getBalance: (address: string) => number | null
  getUsdPrice: (address: string) => number | null
} {
  const { connected, account } = useWallet()
  const walletAddress = connected && account?.address ? account.address.toString() : undefined
  const aptosBalances = useAptosWalletBalances(walletAddress).byAddress
  const { data: cashData } = useCashTokenData()

  // Cache for the latest Panora quote to return synchronously
  const quoteCache = useRef<Map<string, { outputAmount: number; sufficientLiquidity: boolean }>>(new Map())
  const [, forceUpdate] = useState(0)

  const getQuote = useCallback(
    (amount: number, direction: 'buy' | 'sell') => {
      if (isNaN(amount) || amount <= 0) return null

      const fromSymbol = direction === 'buy' ? 'USD1' : 'CASH'
      const toSymbol = direction === 'buy' ? 'CASH' : 'USD1'
      const cacheKey = `${fromSymbol}-${toSymbol}-${amount}`

      const cached = quoteCache.current.get(cacheKey)
      if (cached) return cached

      getPanoraQuote(fromSymbol, toSymbol, amount, 1)
        .then((q: PanoraQuote) => {
          quoteCache.current.set(cacheKey, {
            outputAmount: q.outputAmount,
            sufficientLiquidity: q.outputAmount > 0,
          })
          forceUpdate((n) => n + 1)
        })
        .catch(() => {
          quoteCache.current.set(cacheKey, {
            outputAmount: 0,
            sufficientLiquidity: false,
          })
          forceUpdate((n) => n + 1)
        })

      return null
    },
    [],
  )

  // Clear quote cache periodically so quotes stay fresh
  useEffect(() => {
    const interval = setInterval(() => {
      quoteCache.current.clear()
    }, 15_000)
    return () => clearInterval(interval)
  }, [])

  const getBalance = useCallback(
    (address: string): number | null => {
      if (!walletAddress) return null
      const lower = address.toLowerCase()
      return aptosBalances.get(lower) ?? 0
    },
    [walletAddress, aptosBalances],
  )

  const cashPrice = cashData?.price ?? 0
  const getUsdPrice = useCallback(
    (address: string): number | null => {
      const lower = address.toLowerCase()
      const symbol = ADDRESS_TO_SYMBOL[lower]
      if (!symbol) return null
      if (symbol === 'CASH') return cashPrice > 0 ? cashPrice : null
      // USD1, USDC, USDt, USDe — all USD-pegged stablecoins
      return 1
    },
    [cashPrice],
  )

  return { getQuote, getBalance, getUsdPrice }
}
