/**
 * CashTokenDetailsContent — replaces the Uniswap TokenDetailsContent for the /cash route.
 *
 * Reuses Uniswap layout (skeleton, chart, header, swap widget, description) but replaces:
 * - StatsSection → CashStatsSection (reads directly from our useCashTokenData hook)
 * - ActivitySection → CashActivitySection (shows CASH trades from REST/WS, not ETH GraphQL)
 */

import { Flex, useMedia } from 'ui/src'
import { ChartSection } from '~/pages/TokenDetails/components/chart/ChartSection'
import { TDPBreadcrumb } from '~/pages/TokenDetails/components/header/TDPBreadcrumb'
import { TokenDetailsHeader } from '~/pages/TokenDetails/components/header/TokenDetailsHeader'
import { CashTokenDescription } from '~/pages/CashTDP/CashTokenDescription'
import { LeftPanel, RightPanel, TokenDetailsLayout } from '~/pages/TokenDetails/components/skeleton/Skeleton'
import { TDPSwapComponent } from '~/pages/TokenDetails/components/swap/TDPSwapComponent'
import { DetailsHeaderContainer } from '~/components/Explore/stickyHeader/DetailsHeaderContainer'
import { CashStatsSection } from '~/pages/CashTDP/CashStats'
import { CashActivitySection } from '~/pages/CashTDP/CashTransactions'
import { useCashTokenData } from '~/data/hooks'

export function CashTokenDetailsContent({ isCompact }: { isCompact: boolean }) {
  const media = useMedia()
  const isDesktop = !media.xl
  const { data: tokenData, loading: tokenLoading } = useCashTokenData()

  return (
    <>
      <TDPBreadcrumb />
      <DetailsHeaderContainer isCompact={isCompact}>
        <TokenDetailsHeader isCompact={isCompact} />
      </DetailsHeaderContainer>
      <TokenDetailsLayout>
        <LeftPanel gap="$spacing40" $lg={{ gap: '$gap32' }}>
          <ChartSection />

          <CashStatsSection tokenData={tokenData} loading={tokenLoading} />

          <CashTokenDescription />

          <CashActivitySection />
        </LeftPanel>
        <RightPanel>
          {/* Swap always visible on desktop */}
          <Flex display={isDesktop ? 'flex' : 'none'}>
            <TDPSwapComponent />
          </Flex>
        </RightPanel>
      </TokenDetailsLayout>
    </>
  )
}
