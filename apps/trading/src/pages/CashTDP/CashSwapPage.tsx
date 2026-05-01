/**
 * CashSwapPage — /swap and /limit pages.
 *
 * Renders a hero layout matching app.uniswap.org:
 * - CashTokenCloud (floating CASH logos) as backdrop
 * - Centered swap form on top
 */

import { Helmet } from 'react-helmet-async/lib/index'
import { Flex, styled, Text, useMedia } from 'ui/src'
import { INTERFACE_NAV_HEIGHT } from 'ui/src/theme'

// Subtle grain texture overlay (matches Uniswap's homepage background)
const Grain = styled(Flex, {
  position: 'absolute',
  inset: 0,
  background: 'url(/images/noise-color.png)',
  opacity: 0.018,
  zIndex: 0,
  pointerEvents: 'none',
})
import { CashTokenOverrideProvider } from 'uniswap/src/components/TokenSelector/CashTokenOverrideContext'
import { CASH_TOKEN_OPTIONS } from '~/pages/CashTDP/cashTokenList'
import { AptosSwapButton } from '~/pages/CashTDP/AptosSwapButton'
import { CashTDPProvider } from '~/pages/CashTDP/CashTDPProvider'
import { CashTokenCloud } from '~/pages/CashTDP/CashTokenCloud'
import { useCashOverrideProps } from '~/pages/CashTDP/useCashOverrideProps'
import { TDPSwapComponent } from '~/pages/TokenDetails/components/swap/TDPSwapComponent'
import { Component, type ErrorInfo, type ReactNode } from 'react'

class SwapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.warn('[CashSwapPage] error caught:', error.message, info.componentStack)
  }
  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Flex alignItems="center" justifyContent="center" py="$spacing40">
          <Text variant="body2" color="$neutral2">
            Unable to load swap. Please refresh.
          </Text>
        </Flex>
      )
    }
    return this.props.children
  }
}

export default function CashSwapPage() {
  const { getQuote, getBalance, getUsdPrice } = useCashOverrideProps()
  const media = useMedia()

  return (
    <>
      <Helmet>
        <title>Swap — CASH</title>
      </Helmet>
      <Flex
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        justifyContent={media.sm ? 'flex-start' : 'center'}
        alignItems="center"
        overflow="hidden"
        pointerEvents="none"
        pt={media.sm ? INTERFACE_NAV_HEIGHT - 8 : INTERFACE_NAV_HEIGHT}
      >
        {/* Grain texture overlay (matches Uniswap homepage) */}
        <Grain />

        {/* Reduce the cloud-float-animation amplitude so the orb hit-area
            (static box) stays close enough to the visible orb that hover stays
            reliable. */}
        <style>{`
          @keyframes cloud-float-animation {
            0%   { transform: translateY(-3px); }
            50%  { transform: translateY(3px); }
            100% { transform: translateY(-3px); }
          }
        `}</style>

        {/* Floating CASH logos backdrop — hidden on mobile */}
        {!media.sm && (
          <div className="cash-cloud-wrapper" style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
            <CashTokenCloud />
          </div>
        )}

        {/* Centered swap form */}
        <Flex
          alignSelf="center"
          maxWidth="85vw"
          pointerEvents="auto"
          gap="$gap12"
          alignItems="center"
        >
          {/* Hero title — matches Uniswap homepage size/weight */}
          <Flex maxWidth={920} alignItems="center" pointerEvents="none">
            <Text
              variant="heading2"
              fontSize={36}
              lineHeight={44}
              textAlign="center"
              fontWeight="$book"
              $sm={{ fontSize: 28, lineHeight: 36 }}
            >
              Swap CASH, anywhere.
            </Text>
          </Flex>

          {/* Swap form */}
          <Flex
            pointerEvents="auto"
            width={480}
            p="$padding8"
            // Outer radius = inner panel radius (20px) + padding (8px) for concentric corners
            borderRadius={28}
            backgroundColor="$surface1"
            maxWidth="100%"
          >
            <SwapErrorBoundary>
              <CashTokenOverrideProvider
                tokens={CASH_TOKEN_OPTIONS}
                SwapButtonComponent={AptosSwapButton}
                getQuote={getQuote}
                getBalance={getBalance}
                getUsdPrice={getUsdPrice}
              >
                <CashTDPProvider>
                  <TDPSwapComponent hideHeader />
                </CashTDPProvider>
              </CashTokenOverrideProvider>
            </SwapErrorBoundary>
          </Flex>

          {/* Subtitle (matches Uniswap homepage) */}
          <Text
            variant="body1"
            textAlign="center"
            maxWidth={430}
            color="$neutral2"
            $short={{ variant: 'body2' }}
          >
            Buy and sell CASH with{' '}
            <Text variant="body1" color="$accent1" $short={{ variant: 'body2' }}>
              zero app fees
            </Text>{' '}
            on Aptos via the LiquidSwap CASH/APT pool.
          </Text>
        </Flex>
      </Flex>
    </>
  )
}
