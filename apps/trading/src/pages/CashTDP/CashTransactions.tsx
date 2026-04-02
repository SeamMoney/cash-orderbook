/**
 * CASH transactions table — displays recent trades from our REST API.
 */

import { Flex, Text } from 'ui/src'
import type { CashTrade } from '~/data/api'

interface CashTransactionsTableProps {
  trades: CashTrade[]
  loading: boolean
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  if (diffMs < 60_000) return 'Just now'
  if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3600_000)}h ago`
  return date.toLocaleDateString()
}

function TradeRow({ trade }: { trade: CashTrade }) {
  const sideColor = trade.side === 'buy' ? '#21C95E' : '#FF593C'

  return (
    <Flex
      row
      py="$spacing12"
      borderBottomWidth={0.5}
      borderBottomColor="$surface3"
      alignItems="center"
    >
      <Flex flex={1}>
        <Text variant="body3" style={{ color: sideColor }} textTransform="capitalize">
          {trade.side}
        </Text>
      </Flex>
      <Flex flex={1} alignItems="flex-end">
        <Text variant="body3" color="$neutral1">
          ${trade.price.toFixed(4)}
        </Text>
      </Flex>
      <Flex flex={1} alignItems="flex-end">
        <Text variant="body3" color="$neutral1">
          {trade.quantity.toLocaleString()}
        </Text>
      </Flex>
      <Flex flex={1} alignItems="flex-end">
        <Text variant="body3" color="$neutral2">
          ${(trade.price * trade.quantity).toFixed(2)}
        </Text>
      </Flex>
      <Flex flex={1} alignItems="flex-end">
        <Text variant="body3" color="$neutral2">
          {formatTime(trade.timestamp)}
        </Text>
      </Flex>
    </Flex>
  )
}

export function CashTransactionsTable({ trades, loading }: CashTransactionsTableProps) {
  return (
    <Flex width="100%" data-testid="cash-transactions-section">
      <Text variant="heading3" mb="$spacing24">
        Transactions
      </Text>

      {/* Table header */}
      <Flex
        row
        py="$spacing8"
        borderBottomWidth={0.5}
        borderBottomColor="$surface3"
      >
        <Flex flex={1}>
          <Text variant="body3" color="$neutral2" fontWeight="$medium">
            Type
          </Text>
        </Flex>
        <Flex flex={1} alignItems="flex-end">
          <Text variant="body3" color="$neutral2" fontWeight="$medium">
            Price
          </Text>
        </Flex>
        <Flex flex={1} alignItems="flex-end">
          <Text variant="body3" color="$neutral2" fontWeight="$medium">
            Amount
          </Text>
        </Flex>
        <Flex flex={1} alignItems="flex-end">
          <Text variant="body3" color="$neutral2" fontWeight="$medium">
            Total
          </Text>
        </Flex>
        <Flex flex={1} alignItems="flex-end">
          <Text variant="body3" color="$neutral2" fontWeight="$medium">
            Time
          </Text>
        </Flex>
      </Flex>

      {/* Table body */}
      {loading && trades.length === 0 ? (
        <Flex py="$spacing24" alignItems="center">
          <Text color="$neutral3">Loading transactions…</Text>
        </Flex>
      ) : trades.length === 0 ? (
        <Flex py="$spacing24" alignItems="center">
          <Text color="$neutral3">No transactions yet</Text>
        </Flex>
      ) : (
        trades.map((trade) => <TradeRow key={trade.id} trade={trade} />)
      )}
    </Flex>
  )
}
