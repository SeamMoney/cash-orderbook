/**
 * CASH Token Detail Page — renders the REAL Uniswap TokenDetailsPage layout
 * with CASH data injected via CashTDPProvider.
 *
 * Route: /cash
 *
 * This page is visually identical to /explore/tokens/ethereum/NATIVE — the only
 * difference is the data source (CASH REST/WS API instead of GraphQL).
 */

import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async/lib/index'
import { Flex, Text } from 'ui/src'
import { CashTokenOverrideProvider } from 'uniswap/src/components/TokenSelector/CashTokenOverrideContext'
import { CASH_TOKEN_OPTIONS } from '~/pages/CashTDP/cashTokenList'
import { AptosSwapButton } from '~/pages/CashTDP/AptosSwapButton'
import { CashTDPProvider } from '~/pages/CashTDP/CashTDPProvider'
import { useCashOverrideProps } from '~/pages/CashTDP/useCashOverrideProps'
import { TokenDetailsContent } from '~/pages/TokenDetails/components/TokenDetails'
import { TokenDetailsPageSkeleton } from '~/pages/TokenDetails/components/skeleton/Skeleton'
import { useTDPStore } from '~/pages/TokenDetails/context/useTDPStore'

/**
 * Tracks only the compact/expanded threshold crossing — never updates state on
 * every scroll pixel. CashTDPContent only re-renders when the header mode flips.
 */
function useIsCompact(thresholdCompact = 100, thresholdExpanded = 60): boolean {
  const [isCompact, setIsCompact] = useState(false)
  const isCompactRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const check = () => {
      const scrollY = window.scrollY
      const prev = isCompactRef.current
      let next = prev
      if (!prev && scrollY > thresholdCompact) next = true
      else if (prev && scrollY < thresholdExpanded) next = false
      if (next !== prev) {
        isCompactRef.current = next
        setIsCompact(next)
      }
      rafRef.current = null
    }

    const onScroll = () => {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(check)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    check()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [thresholdCompact, thresholdExpanded])

  return isCompact
}

// ---------------------------------------------------------------------------
// Error boundary — catches EVM-specific crashes (wagmi, provider context, etc.)
// and renders a graceful fallback instead of a white screen.
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  fallback: ReactNode
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class TDPErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.warn('[CashTDP] Component error caught by boundary:', error.message, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Inner content — reads from TDP store for loading state
// ---------------------------------------------------------------------------

function CashTDPContent() {
  const isCompact = useIsCompact(100, 60)
  const { currency, tokenQuery } = useTDPStore((s) => ({
    currency: s.currency,
    tokenQuery: s.tokenQuery,
  }))

  if (tokenQuery.loading || !currency) {
    return <TokenDetailsPageSkeleton isCompact={isCompact} />
  }

  return <TokenDetailsContent isCompact={isCompact} />
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function CashTokenDetailPage() {
  const { getQuote, getBalance, getUsdPrice } = useCashOverrideProps()
  return (
    <>
      <Helmet>
        <title>CASH — Token Details</title>
      </Helmet>
      <TDPErrorBoundary
        fallback={
          <Flex alignItems="center" justifyContent="center" py="$spacing40" px="$spacing20">
            <Text variant="heading3" color="$neutral2">
              Unable to load CASH token details. Please refresh.
            </Text>
          </Flex>
        }
      >
        <CashTokenOverrideProvider
          tokens={CASH_TOKEN_OPTIONS}
          SwapButtonComponent={AptosSwapButton}
          getQuote={getQuote}
          getBalance={getBalance}
          getUsdPrice={getUsdPrice}
        >
          <CashTDPProvider>
            <CashTDPContent />
          </CashTDPProvider>
        </CashTokenOverrideProvider>
      </TDPErrorBoundary>
    </>
  )
}
