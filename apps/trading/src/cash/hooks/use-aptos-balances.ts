/**
 * useAptosWalletBalances — queries the Aptos Indexer for fungible asset balances.
 * Shared hook used by both the swap form (useCashOverrideProps) and the navbar wallet dropdown.
 */

import { useEffect, useState } from 'react'

const APTOS_INDEXER = 'https://api.mainnet.aptoslabs.com/v1/graphql'

const BALANCE_QUERY = `
  query GetBalances($owner: String!, $symbols: [String!]) {
    current_fungible_asset_balances(
      where: {
        owner_address: { _eq: $owner }
        metadata: { symbol: { _in: $symbols } }
      }
    ) {
      asset_type
      amount
      metadata { symbol decimals }
    }
  }
`

const SUPPORTED_SYMBOLS = ['CASH', 'USD1', 'USDC', 'USDt', 'USDe', 'APT']

export interface AptosBalances {
  /** Balance by symbol (human-readable) */
  bySymbol: Map<string, number>
  /** Balance by FA address (human-readable) */
  byAddress: Map<string, number>
}

const CASH_FA = '0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1'

const SYMBOL_TO_FA: Record<string, string> = {
  CASH: CASH_FA,
  USD1: '0x05fabd1b12e39967a3c24e91b7b8f67719a6dacee74f3c8b9fb7d93e855437d2',
  USDC: '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b',
  USDt: '0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b',
  USDe: '0xf37a8864fe737eb8ec2c2931047047cbaed1beed3fb0e5b7c5526dafd3b9c2e9',
}

async function fetchBalances(walletAddress: string): Promise<AptosBalances> {
  const bySymbol = new Map<string, number>()
  const byAddress = new Map<string, number>()

  try {
    const res = await fetch(APTOS_INDEXER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: BALANCE_QUERY,
        variables: { owner: walletAddress, symbols: SUPPORTED_SYMBOLS },
      }),
    })
    if (!res.ok) return { bySymbol, byAddress }

    const json = await res.json()
    const balances = json?.data?.current_fungible_asset_balances ?? []

    for (const b of balances) {
      const symbol: string = b.metadata?.symbol ?? ''
      const decimals: number = b.metadata?.decimals ?? 6
      const human = Number(b.amount) / Math.pow(10, decimals)

      bySymbol.set(symbol, human)

      const faAddr = SYMBOL_TO_FA[symbol]
      if (faAddr) byAddress.set(faAddr, human)
      byAddress.set(b.asset_type.toLowerCase(), human)
    }
  } catch {
    // Silently fail
  }

  return { bySymbol, byAddress }
}

export function useAptosWalletBalances(walletAddress: string | undefined): AptosBalances {
  const [balances, setBalances] = useState<AptosBalances>({
    bySymbol: new Map(),
    byAddress: new Map(),
  })

  useEffect(() => {
    if (!walletAddress) {
      setBalances({ bySymbol: new Map(), byAddress: new Map() })
      return
    }

    let cancelled = false

    async function poll(): Promise<void> {
      const b = await fetchBalances(walletAddress!)
      if (!cancelled) setBalances(b)
    }

    void poll()
    const interval = setInterval(() => void poll(), 15_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [walletAddress])

  return balances
}
