/**
 * SwapRouteInfo — displays Panora swap quote details below the swap button.
 * Styled to match the original Uniswap swap form footer layout.
 */

import { useState } from 'react'
import { Flex, Text } from 'ui/src'
import { ChevronsIn } from 'ui/src/components/icons/ChevronsIn'
import { ChevronsOut } from 'ui/src/components/icons/ChevronsOut'
import type { PanoraQuote } from '~/cash/lib/panora'

// ---------------------------------------------------------------------------
// Route inference
// ---------------------------------------------------------------------------

interface RouteHop {
  pair: string
  dex: string
  percentage: number
}

function inferRouteHops(fromSymbol: string, toSymbol: string): RouteHop[] {
  const from = fromSymbol.toUpperCase()
  const to = toSymbol.toUpperCase()

  if (from !== 'CASH' && to !== 'CASH') {
    return [{ pair: `${from}/${to}`, dex: 'Panora', percentage: 100 }]
  }
  if (to === 'CASH') {
    if (from === 'APT') return [{ pair: 'APT/CASH', dex: 'LiquidSwap', percentage: 100 }]
    return [
      { pair: `${from}/APT`, dex: 'Caliber', percentage: 100 },
      { pair: 'APT/CASH', dex: 'LiquidSwap', percentage: 100 },
    ]
  }
  if (from === 'CASH') {
    if (to === 'APT') return [{ pair: 'CASH/APT', dex: 'LiquidSwap', percentage: 100 }]
    return [
      { pair: 'CASH/APT', dex: 'LiquidSwap', percentage: 100 },
      { pair: `APT/${to}`, dex: 'Caliber', percentage: 100 },
    ]
  }
  return [{ pair: `${from}/${to}`, dex: 'Panora', percentage: 100 }]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number, decimals: number = 6): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: decimals })
  return n.toFixed(decimals)
}

/** Compact format for the rate line — keeps "1 X = Y Z ($USD)" on a single line. */
function formatRate(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(4)
  if (n >= 0.0001) return n.toFixed(6)
  return n.toExponential(4)
}

function impactColor(impact: number | null): string {
  if (impact === null) return 'var(--neutral3)'
  const abs = Math.abs(impact)
  if (abs >= 0.05) return 'var(--statusCritical)'
  if (abs >= 0.01) return 'var(--statusWarning)'
  return 'var(--statusSuccess)'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <Flex row justifyContent="space-between" alignItems="center" py="$spacing4">
      <Text variant="body3" color="$neutral2">{label}</Text>
      <Text variant="body3" color={valueColor ? undefined : '$neutral1'} style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </Text>
    </Flex>
  )
}

// ---------------------------------------------------------------------------
// Exported components
// ---------------------------------------------------------------------------

interface SwapRouteInfoProps {
  quote: PanoraQuote
  fromSymbol: string
  toSymbol: string
}

/**
 * Compact hop summary shown above the swap button.
 */
function HopSummary({ quote, fromSymbol, toSymbol }: SwapRouteInfoProps) {
  const hops = inferRouteHops(fromSymbol, toSymbol)
  const dexNames = [...new Set(hops.map((h) => h.dex))]

  return (
    <Flex row alignItems="center" gap="$spacing8">
      <Flex
        borderRadius="$rounded8"
        paddingHorizontal="$spacing6"
        paddingVertical="$spacing2"
        backgroundColor="rgba(64, 196, 99, 0.15)"
      >
        <Text variant="body4" style={{ color: 'var(--statusSuccess)' }}>
          {hops.length} {hops.length === 1 ? 'hop' : 'hops'}
        </Text>
      </Flex>
      <Text variant="body4" color="$neutral2">
        via {dexNames.join(', ')}
      </Text>
    </Flex>
  )
}

/**
 * Swap route info footer — matches the Uniswap swap form footer layout.
 * Flat rate line with inline chevron toggle, expandable detail rows below.
 */
export function SwapRouteInfo({ quote, fromSymbol, toSymbol }: SwapRouteInfoProps) {
  const [expanded, setExpanded] = useState(false)

  const hops = inferRouteHops(fromSymbol, toSymbol)
  const dexNames = [...new Set(hops.map((h) => h.dex))]
  const rate = quote.outputAmount / quote.inputAmount
  const rateStr = `1 ${fromSymbol} = ${formatRate(rate)} ${toSymbol}`
  const usdStr = quote.fromTokenAmountUSD != null && quote.fromTokenAmountUSD > 0
    ? ` ($${quote.fromTokenAmountUSD.toFixed(2)})`
    : ''

  return (
    <Flex gap="$spacing4">
      {/* Rate line — flat, no card. Matches Uniswap: "1 USDC = X ETH ($1.00)  ⟐  $0.09" */}
      <Flex
        row
        justifyContent="space-between"
        alignItems="center"
        gap="$spacing8"
        px="$spacing8"
        py="$spacing4"
        cursor="pointer"
        onPress={() => setExpanded(!expanded)}
        hoverStyle={{ opacity: 0.8 }}
      >
        <Text variant="body3" color="$neutral2" numberOfLines={1} flexShrink={1} ellipsizeMode="tail">
          {rateStr}{usdStr}
        </Text>
        <Flex
          row
          alignItems="center"
          gap="$spacing4"
          flexShrink={0}
        >
          <Text variant="body3" color="$neutral2">
            Gasless
          </Text>
          {expanded ? <ChevronsIn size={20} color="$neutral3" /> : <ChevronsOut size={20} color="$neutral3" />}
        </Flex>
      </Flex>

      {/* Expandable detail rows — matches Uniswap TransactionDetails layout */}
      {expanded && (
        <Flex px="$spacing8" gap="$spacing2">
          <DetailRow label="Fee" value="Free" valueColor="var(--statusSuccess)" />
          <DetailRow label="Network cost" value="Gasless" valueColor="var(--statusSuccess)" />
          <DetailRow
            label="Max slippage"
            value={`${quote.slippagePercentage}%`}
          />
          <DetailRow
            label="Route"
            value={`${hops.length} hops · ${dexNames.join(', ')}`}
          />
          {quote.priceImpact != null && (
            <DetailRow
              label="Price impact"
              value={`${(quote.priceImpact * 100).toFixed(2)}%`}
              valueColor={impactColor(quote.priceImpact)}
            />
          )}
          <DetailRow
            label="Min received"
            value={`${formatNumber(quote.minReceived)} ${toSymbol}`}
          />
        </Flex>
      )}
    </Flex>
  )
}

SwapRouteInfo.HopSummary = HopSummary
