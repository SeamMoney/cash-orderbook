/**
 * CashTokenCloud — Uniswap-style floating token logos backdrop, but every
 * token is CASH. Used as the background of the /swap page.
 */

import { useCallback } from 'react'
import { GraphQLApi } from '@universe/api'
import { IconCloud, ItemPoint } from 'uniswap/src/components/IconCloud/IconCloud'
import { shuffleArray } from 'uniswap/src/components/IconCloud/utils'
import type { InteractiveToken } from '~/pages/Landing/assets/approvedTokens'
import { Ticker } from '~/pages/Landing/components/TokenCloud/Ticker'

const CASH_ADDRESS = '0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1'
const CASH_LOGO = 'https://assets.panora.exchange/tokens/aptos/CASH.png'

// Vibrant variations on the CASH green so the orbs read as distinct atmospheric blobs
const CASH_GREEN_VARIANTS = [
  '#40C463',
  '#5BD97A',
  '#7CE893',
  '#2AAB4A',
  '#9BF0AA',
  '#34D058',
  '#52DD7B',
]

// Build a list of CASH tokens — color cycles for visual variety
const cashTokens: InteractiveToken[] = shuffleArray(
  Array.from({ length: 30 }, (_, i) => ({
    name: 'CASH',
    symbol: 'CASH',
    address: CASH_ADDRESS,
    chain: GraphQLApi.Chain.Ethereum, // chain is unused for our render path
    color: CASH_GREEN_VARIANTS[i % CASH_GREEN_VARIANTS.length] as string,
    logoUrl: CASH_LOGO,
  })),
) as InteractiveToken[]

export function CashTokenCloud() {
  const renderOuterElement = useCallback((item: ItemPoint<InteractiveToken>) => {
    return <Ticker itemPoint={item} />
  }, [])

  // No-op press — matches the original TokenCloud's onPress signature so hover
  // detection / cursor styling activates on desktop.
  const onPress = useCallback(() => {}, [])

  return (
    <IconCloud
      data={cashTokens}
      // Bigger orbs on desktop = fewer of them visually, less crowded
      minItemSize={80}
      maxItemSize={140}
      renderOuterElement={renderOuterElement}
      onPress={onPress}
      getElementRounded={() => true}
    />
  )
}
