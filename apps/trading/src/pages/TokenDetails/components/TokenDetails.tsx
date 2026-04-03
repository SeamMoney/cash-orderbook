import { FeatureFlags, useFeatureFlag } from '@universe/gating'
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
import { ScrollDirection } from '~/hooks/useScroll'
import { ActivitySection } from '~/pages/TokenDetails/components/activity/ActivitySection'
import { BalanceSummary, PageChainBalanceSummary } from '~/pages/TokenDetails/components/balances/BalanceSummary'
import { ChartSection } from '~/pages/TokenDetails/components/chart/ChartSection'
import { TDPBreadcrumb } from '~/pages/TokenDetails/components/header/TDPBreadcrumb'
import { TokenDetailsHeader } from '~/pages/TokenDetails/components/header/TokenDetailsHeader'
import { BridgedAssetSection } from '~/pages/TokenDetails/components/info/BridgedAssetSection'
import { StatsSection } from '~/pages/TokenDetails/components/info/StatsSection'
import { TokenDescription } from '~/pages/TokenDetails/components/info/TokenDescription'
import { LeftPanel, RightPanel, TokenDetailsLayout } from '~/pages/TokenDetails/components/skeleton/Skeleton'
import { TDPSwapComponent } from '~/pages/TokenDetails/components/swap/TDPSwapComponent'
import { TokenCarousel } from '~/pages/TokenDetails/components/TokenCarousel/TokenCarousel'
import { useTDPStore } from '~/pages/TokenDetails/context/useTDPStore'
import { useEffect, useRef, useState } from 'react'

/**
 * Tracks only scroll direction changes — never fires a state update on every scroll
 * pixel. Replaces useScroll() which updates height state every frame and causes the
 * entire TokenDetailsContent tree to re-render during scrolling.
 */
function useScrollDirection(): ScrollDirection | undefined {
  const [direction, setDirection] = useState<ScrollDirection | undefined>()
  const lastYRef = useRef(window.scrollY)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        const scrollY = window.scrollY
        const newDir = scrollY > lastYRef.current ? ScrollDirection.DOWN : ScrollDirection.UP
        lastYRef.current = scrollY
        rafRef.current = null
        setDirection((prev) => (prev !== newDir ? newDir : prev))
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return direction
}

export function TokenDetailsContent({ isCompact }: { isCompact: boolean }) {
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
  const pageChainBalance = multiChainMap[currencyChain]?.balance

  const scrollDirection = useScrollDirection()

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

          <StatsSection tokenQueryData={tokenQueryData} />

          <TokenDescription />

          <ActivitySection />
          {isTDPTokenCarouselEnabled && (
            <TokenCarousel
              title={t('explore.popularOn.title', { chain: chainLabel })}
              tooltipText={t('explore.popularOn.tooltip')}
              chainId={chainId}
            />
          )}
        </LeftPanel>
        <RightPanel>
          {/* Swap always visible on desktop (uses display to preserve state) */}
          <Flex display={isDesktop ? 'flex' : 'none'}>
            <TDPSwapComponent />
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
