/**
 * CASH stats section — displays market stats from our REST API.
 *
 * Replaces the Uniswap StatsSection which relies on Apollo cache fragments.
 * Uses the same layout structure as the Uniswap original (StatsWrapper, StatWrapper).
 */

import { Flex, Text } from 'ui/src'
import { StatsWrapper, StatWrapper } from '~/pages/TokenDetails/components/info/StatsSection'
import type { CashTokenData } from '~/data/hooks'

interface CashStatsSectionProps {
  tokenData: CashTokenData | null
  loading: boolean
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  if (value >= 1) return `$${value.toFixed(2)}`
  return `$${value.toFixed(4)}`
}

function StatItem({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <StatWrapper tableRow data-testid={testId}>
      <Text variant="body3" color="$neutral2" tag="td">
        {label}
      </Text>
      <Text
        tag="td"
        mt="$spacing8"
        fontSize={28}
        color="$neutral1"
        fontWeight="$book"
        $platform-web={{ overflowWrap: 'break-word' }}
      >
        {value}
      </Text>
    </StatWrapper>
  )
}

export function CashStatsSection({ tokenData, loading }: CashStatsSectionProps) {
  if (loading || !tokenData) {
    return (
      <StatsWrapper data-testid="cash-stats-section">
        <Text variant="heading3">Stats</Text>
        <Text color="$neutral3">Loading stats…</Text>
      </StatsWrapper>
    )
  }

  return (
    <StatsWrapper data-testid="cash-stats-section">
      <Text variant="heading3">Stats</Text>
      <Flex row flexWrap="wrap" rowGap="$spacing24" tag="table">
        <StatItem
          label="TVL"
          value="N/A"
          testId="cash-stat-tvl"
        />
        <StatItem
          label="Market cap"
          value={tokenData.marketCap != null ? formatCurrency(tokenData.marketCap) : '—'}
          testId="cash-stat-market-cap"
        />
        <StatItem
          label="FDV"
          value={tokenData.fdv != null ? formatCurrency(tokenData.fdv) : '—'}
          testId="cash-stat-fdv"
        />
        <StatItem
          label="1 day volume"
          value={formatCurrency(tokenData.volume24h)}
          testId="cash-stat-volume"
        />
        <StatItem
          label="52W high"
          value={formatCurrency(tokenData.high52w)}
          testId="cash-stat-52w-high"
        />
        <StatItem
          label="52W low"
          value={formatCurrency(tokenData.low52w)}
          testId="cash-stat-52w-low"
        />
      </Flex>
    </StatsWrapper>
  )
}
