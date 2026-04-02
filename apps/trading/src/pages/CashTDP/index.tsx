/**
 * CASH Token Detail Page — renders the real Uniswap TDP layout components
 * with CASH data provided by CashTDPProvider.
 *
 * Route: /cash
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Helmet } from 'react-helmet-async/lib/index'
import { Flex, Text } from 'ui/src'
import { CashTDPProvider } from '~/pages/CashTDP/CashTDPProvider'
import { CashTokenDetailsContent } from '~/pages/CashTDP/CashTokenDetailsContent'

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
          <CashTokenDetailsContent isCompact={false} />
        </CashTDPProvider>
      </TDPErrorBoundary>
    </>
  )
}
