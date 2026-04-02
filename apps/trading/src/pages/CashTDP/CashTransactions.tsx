/**
 * CASH activity section — displays recent trades from our REST API with
 * real-time WebSocket updates.
 *
 * Replaces the Uniswap ActivitySection which queries GraphQL for ETH transactions.
 */

import { Flex, Text } from 'ui/src'
import { useCashTrades } from '~/data/hooks'

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  if (diffMs < 60_000) return 'Just now'
  if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3600_000)}h ago`
  return date.toLocaleDateString()
}

function formatPrice(price: number): string {
  if (price >= 1) return `$${price.toFixed(2)}`
  return `$${price.toFixed(4)}`
}

function formatAmount(quantity: number): string {
  if (quantity >= 1_000_000) return `${(quantity / 1_000_000).toFixed(2)}M`
  if (quantity >= 1_000) return `${(quantity / 1_000).toFixed(2)}K`
  return quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatTotal(price: number, quantity: number): string {
  const total = price * quantity
  if (total >= 1_000_000) return `$${(total / 1_000_000).toFixed(2)}M`
  if (total >= 1_000) return `$${(total / 1_000).toFixed(2)}K`
  return `$${total.toFixed(2)}`
}

// ---------------------------------------------------------------------------
// Trade row component
// ---------------------------------------------------------------------------

interface TradeRowProps {
  trade: {
    id: string
    price: number
    quantity: number
    side: 'buy' | 'sell'
    timestamp: number
  }
}

function TradeRow({ trade }: TradeRowProps) {
  const isBuy = trade.side === 'buy'
  const sideColor = isBuy ? '#21C95E' : '#FF593C'
  const sideLabel = isBuy ? 'Buy' : 'Sell'

  return (
    <Flex
      row
      py="$spacing12"
      borderBottomWidth={0.5}
      borderBottomColor="$surface3"
      alignItems="center"
    >
      <Flex flex={1}>
        <Text variant="body3" color="$neutral2">
          {formatTime(trade.timestamp)}
        </Text>
      </Flex>
      <Flex flex={1}>
        <Text variant="body3" style={{ color: sideColor }} fontWeight="$medium">
          {sideLabel}
        </Text>
      </Flex>
      <Flex flex={1} alignItems="flex-end">
        <Text variant="body3" color="$neutral1">
          {formatPrice(trade.price)}
        </Text>
      </Flex>
      <Flex flex={1} alignItems="flex-end">
        <Text variant="body3" color="$neutral1">
          {formatAmount(trade.quantity)}
        </Text>
      </Flex>
      <Flex flex={1} alignItems="flex-end">
        <Text variant="body3" color="$neutral2">
          {formatTotal(trade.price, trade.quantity)}
        </Text>
      </Flex>
    </Flex>
  )
}

// ---------------------------------------------------------------------------
// Main activity section
// ---------------------------------------------------------------------------

export function CashActivitySection() {
  const { trades, loading } = useCashTrades(50)

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
            Time
          </Text>
        </Flex>
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
