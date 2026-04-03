/**
 * CASH Token Detail Page — renders the REAL Uniswap TokenDetailsPage layout
 * with CASH data injected via CashTDPProvider.
 *
 * Route: /cash
 *
 * This page is visually identical to /explore/tokens/ethereum/NATIVE — the only
 * difference is the data source (CASH REST/WS API instead of GraphQL).
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Helmet } from 'react-helmet-async/lib/index'
import { Flex, Text } from 'ui/src'
import { useScroll } from '~/hooks/useScroll'
import { useScrollCompact } from '~/hooks/useScrollCompact'
import { TokenDetailsPageSkeleton } from '~/pages/TokenDetails/components/skeleton/Skeleton'
import { TokenDetailsContent } from '~/pages/TokenDetails/components/TokenDetails'
import { CashTDPProvider } from '~/pages/CashTDP/CashTDPProvider'
import { useTDPStore } from '~/pages/TokenDetails/context/useTDPStore'

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
  const { height: scrollY } = useScroll()
  const isCompact = useScrollCompact({ scrollY, thresholdCompact: 100, thresholdExpanded: 60 })
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
        <CashTDPProvider>
          <CashTDPContent />
        </CashTDPProvider>
      </TDPErrorBoundary>
    </>
  )
}
