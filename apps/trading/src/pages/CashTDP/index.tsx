/**
 * CASH Token Detail Page — renders token data from our REST/WS API
 * instead of Uniswap's GraphQL backend.
 *
 * Route: /cash
 */

import { Helmet } from 'react-helmet-async/lib/index'
import { Flex, Text } from 'ui/src'
import { useCashTokenData, useCashTrades } from '~/data/hooks'
import { CashChartSection } from '~/pages/CashTDP/CashChart'
import { CashHeader } from '~/pages/CashTDP/CashHeader'
import { CashStatsSection } from '~/pages/CashTDP/CashStats'
import { CashTransactionsTable } from '~/pages/CashTDP/CashTransactions'
import { SwapSkeleton } from '~/components/swap/SwapSkeleton'

export default function CashTokenDetailPage() {
  const { data: tokenData, loading: tokenLoading } = useCashTokenData()
  const { trades, loading: tradesLoading } = useCashTrades(50)

  return (
    <>
      <Helmet>
        <title>CASH — Token Details</title>
      </Helmet>

      {/* Breadcrumb */}
      <div style={{ width: '100%', padding: '48px 40px 0' }}>
        <Text variant="body3" color="$neutral2">
          Tokens › CASH
        </Text>
      </div>

      {/* Header */}
      <div style={{ width: '100%', padding: '16px 40px 0' }}>
        <CashHeader price={tokenData?.price ?? null} loading={tokenLoading} />
      </div>

      {/* Main two-column layout */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          width: '100%',
          gap: 80,
          marginTop: 32,
          padding: '0 40px 48px',
        }}
      >
        {/* Left Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 40, minWidth: 0 }}>
          {/* Chart */}
          <CashChartSection />

          {/* Stats */}
          <CashStatsSection tokenData={tokenData} loading={tokenLoading} />

          {/* About */}
          <Flex gap="$gap16">
            <Text variant="heading3">About CASH</Text>
            <Text variant="body2" color="$neutral2">
              CASH is a spot trading token on the Aptos blockchain. It powers the CASH Central Limit Order Book (CLOB),
              providing decentralized price discovery and settlement for digital assets.
            </Text>
          </Flex>

          {/* Transactions */}
          <CashTransactionsTable trades={trades} loading={tradesLoading} />
        </div>

        {/* Right Panel — Swap Widget */}
        <div style={{ width: 360, flexShrink: 0 }}>
          <SwapSkeleton />
        </div>
      </div>
    </>
  )
}
