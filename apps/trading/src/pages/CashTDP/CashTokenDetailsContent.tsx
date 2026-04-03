/**
 * CashTokenDetailsContent — mirrors the real Uniswap TokenDetailsContent layout
 * for pixel-perfect styling parity, but swaps in:
 * - CashSwapWidget instead of TDPSwapComponent (Aptos swap, not EVM)
 * - CashTokenDescription instead of TokenDescription (Aptos address formatting)
 *
 * All other sections (chart, stats, activity, header, layout) use the REAL
 * Uniswap components — the CashTDPProvider populates the TDP store with
 * correct data so they render identically to /explore/tokens/ethereum/NATIVE.
 */

import { FeatureFlags, useFeatureFlag } from '@universe/gating'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Flex, useIsTouchDevice, useMedia } from 'ui/src'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { fromGraphQLChain, getChainLabel } from 'uniswap/src/features/chains/utils'
import { InterfacePageName } from 'uniswap/src/features/telemetry/constants'
import Trace from 'uniswap/src/features/telemetry/Trace'
import { useCurrencyInfo } from 'uniswap/src/features/tokens/useCurrencyInfo'
import { buildCurrencyId } from 'uniswap/src/utils/currencyId'
import { DetailsHeaderContainer } from '~/components/Explore/stickyHeader/DetailsHeaderContainer'
import { MobileBottomBar, TDPActionTabs } from '~/components/NavBar/MobileBottomBar'
import { ScrollDirection, useScroll } from '~/hooks/useScroll'
import { CashActivitySection } from '~/pages/CashTDP/CashTransactions'
import { BalanceSummary, PageChainBalanceSummary } from '~/pages/TokenDetails/components/balances/BalanceSummary'
import { ChartSection } from '~/pages/TokenDetails/components/chart/ChartSection'
import { TDPBreadcrumb } from '~/pages/TokenDetails/components/header/TDPBreadcrumb'
import { TokenDetailsHeader } from '~/pages/TokenDetails/components/header/TokenDetailsHeader'
import { BridgedAssetSection } from '~/pages/TokenDetails/components/info/BridgedAssetSection'
import { StatsSection } from '~/pages/TokenDetails/components/info/StatsSection'
import { LeftPanel, RightPanel, TokenDetailsLayout } from '~/pages/TokenDetails/components/skeleton/Skeleton'
import { TokenCarousel } from '~/pages/TokenDetails/components/TokenCarousel/TokenCarousel'
import { useTDPStore } from '~/pages/TokenDetails/context/useTDPStore'

// ── CASH-specific overrides ────────────────────────────────────────────────
import { CashSwapWidget } from '~/pages/CashTDP/CashSwapWidget'
import { CashTokenDescription } from '~/pages/CashTDP/CashTokenDescription'

export function CashTokenDetailsContent({ isCompact }: { isCompact: boolean }) {
  const media = useMedia()
  const isTouchDevice = useIsTouchDevice()
  const { t } = useTranslation()

  const { tokenQuery, currencyChain, multiChainMap, address, currency } = useTDPStore((s) => ({
    tokenQuery: s.tokenQuery,
    currencyChain: s.currencyChain,
    multiChainMap: s.multiChainMap,
    address: s.address,
    currency: s.currency!,
  }))
  const tokenQueryData = tokenQuery.data?.token

  // Build aggregated data from the TDP store's tokenQueryData so StatsSection shows
  // Market cap, FDV, 52W High/Low from the CASH REST API instead of dashes.
  // This bypasses the MultichainTokenUx feature flag which is always false in our stub.
  const cashAggregatedData = useMemo(
    () =>
      tokenQueryData
        ? { market: tokenQueryData.market, project: tokenQueryData.project }
        : undefined,
    [tokenQueryData],
  )
  const pageChainBalance = multiChainMap[currencyChain]?.balance

  const { direction: scrollDirection } = useScroll()

  const chainId = fromGraphQLChain(currencyChain) ?? UniverseChainId.Mainnet
  const currencyInfo = useCurrencyInfo(
    tokenQueryData?.address ? buildCurrencyId(chainId, tokenQueryData.address) : undefined,
  )
  const isBridgedAsset = Boolean(currencyInfo?.isBridged)
  const showTokenInfo = !!pageChainBalance || isBridgedAsset
  const isDesktop = !media.xl
  const showBalanceInfo = isDesktop && showTokenInfo

  const chainLabel = getChainLabel(chainId)
  const isTDPTokenCarouselEnabled = useFeatureFlag(FeatureFlags.TDPTokenCarousel)

  return (
    <Trace
      logImpression
      page={InterfacePageName.TokenDetailsPage}
      properties={{
        tokenAddress: address,
        tokenSymbol: currency.symbol,
        tokenName: currency.name,
        chainId: currency.chainId,
      }}
    >
      <TDPBreadcrumb />
      <DetailsHeaderContainer isCompact={isCompact}>
        <TokenDetailsHeader isCompact={isCompact} />
      </DetailsHeaderContainer>
      <TokenDetailsLayout>
        <LeftPanel gap="$spacing40" $lg={{ gap: '$gap32' }}>
          <ChartSection />

          {!showBalanceInfo && (
            <Flex gap="$gap24">
              {!!pageChainBalance && <PageChainBalanceSummary pageChainBalance={pageChainBalance} />}
              <BridgedAssetSection
                tokenQueryData={tokenQueryData}
                currencyInfo={currencyInfo}
                isBridgedAsset={isBridgedAsset}
              />
            </Flex>
          )}

          <StatsSection tokenQueryData={tokenQueryData} forceAggregatedData={cashAggregatedData} />

          {/* CASH override: use Aptos-aware description with Aptos Explorer links */}
          <CashTokenDescription />

          <CashActivitySection />
          {isTDPTokenCarouselEnabled && (
            <TokenCarousel
              title={t('explore.popularOn.title', { chain: chainLabel })}
              tooltipText={t('explore.popularOn.tooltip')}
              chainId={chainId}
            />
          )}
        </LeftPanel>
        <RightPanel>
          {/* CASH override: Aptos swap widget instead of EVM TDPSwapComponent */}
          <Flex display={isDesktop ? 'flex' : 'none'}>
            <CashSwapWidget />
          </Flex>

          {/* Balance and bridged sections only show when user has balance or it's bridged */}
          <Flex display={showBalanceInfo ? 'flex' : 'none'} gap="$gap24" mt="$gap24">
            <BalanceSummary />
            <BridgedAssetSection
              tokenQueryData={tokenQueryData}
              currencyInfo={currencyInfo}
              isBridgedAsset={isBridgedAsset}
            />
          </Flex>
        </RightPanel>

        <MobileBottomBar hide={isTouchDevice && scrollDirection === ScrollDirection.DOWN}>
          <Flex data-testid="tdp-mobile-bottom-bar">
            <TDPActionTabs />
          </Flex>
        </MobileBottomBar>
      </TokenDetailsLayout>
    </Trace>
  )
}
