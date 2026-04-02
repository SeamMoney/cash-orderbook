/**
 * CASH stats section — displays market stats from our REST API.
 */

import { Flex, Text } from 'ui/src'
import type { CashTokenData } from '~/data/hooks'

interface CashStatsSectionProps {
  tokenData: CashTokenData | null
  loading: boolean
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`
  return `$${value.toFixed(4)}`
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <Flex flexBasis="33.33%" flexGrow={0} flexShrink={0} pr="$spacing12" $sm={{ flexBasis: '50%' }}>
      <Text variant="body3" color="$neutral2">
        {label}
      </Text>
      <Text fontSize={28} color="$neutral1" fontWeight="$book" mt="$spacing8">
        {value}
      </Text>
    </Flex>
  )
}

export function CashStatsSection({ tokenData, loading }: CashStatsSectionProps) {
  if (loading || !tokenData) {
    return (
      <Flex gap="$gap20" data-testid="cash-stats-section">
        <Text variant="heading3">Stats</Text>
        <Text color="$neutral3">Loading stats…</Text>
      </Flex>
    )
  }

  return (
    <Flex gap="$gap20" data-testid="cash-stats-section">
      <Text variant="heading3">Stats</Text>
      <Flex row flexWrap="wrap" rowGap="$spacing24" tag="div">
        <StatItem label="Market cap" value={formatCurrency(tokenData.marketCap)} />
        <StatItem label="FDV" value={formatCurrency(tokenData.fdv)} />
        <StatItem label="1 day volume" value={formatCurrency(tokenData.volume24h)} />
        <StatItem label="52W high" value={formatCurrency(tokenData.high52w)} />
        <StatItem label="52W low" value={formatCurrency(tokenData.low52w)} />
        <StatItem label="Price" value={formatCurrency(tokenData.price)} />
      </Flex>
    </Flex>
  )
}
