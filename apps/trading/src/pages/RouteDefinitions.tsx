import { lazy, ReactNode, Suspense, useMemo } from 'react'
import { matchPath, Navigate, useLocation } from 'react-router'
import i18n from 'uniswap/src/i18n'
import { isBrowserRouterEnabled } from '~/utils/env'

const NotFound = lazy(() => import('~/pages/NotFound'))
const CashTokenDetailPage = lazy(() => import('~/pages/CashTDP'))
const CashSwapPage = lazy(() => import('~/pages/CashTDP/CashSwapPage'))

interface RouterConfig {
  browserRouterEnabled?: boolean
  hash?: string
}

/**
 * Convenience hook which organizes the router configuration into a single object.
 */
export function useRouterConfig(): RouterConfig {
  const browserRouterEnabled = isBrowserRouterEnabled()
  const { hash } = useLocation()

  return useMemo(
    () => ({
      browserRouterEnabled,
      hash,
    }),
    [browserRouterEnabled, hash],
  )
}

const StaticTitlesAndDescriptions = {
  CashTitle: 'CASH Orderbook',
  SwapTitle: i18n.t('title.buySellTradeEthereum'),
  SwapDescription: i18n.t('title.swappingMadeSimple'),
}

export interface RouteDefinition {
  path: string
  nestedPaths: string[]
  getTitle: (path?: string) => string
  getDescription: (path?: string) => string
  enabled: (args: RouterConfig) => boolean
  getElement: (args: RouterConfig) => ReactNode
}

// Assigns the defaults to the route definition.
function createRouteDefinition(route: Partial<RouteDefinition>): RouteDefinition {
  return {
    getElement: () => null,
    getTitle: () => StaticTitlesAndDescriptions.CashTitle,
    getDescription: () => StaticTitlesAndDescriptions.SwapDescription,
    enabled: () => true,
    path: '/',
    nestedPaths: [],
    // overwrite the defaults
    ...route,
  }
}

export const routes: RouteDefinition[] = [
  createRouteDefinition({
    path: '/',
    getTitle: () => StaticTitlesAndDescriptions.CashTitle,
    getDescription: () => StaticTitlesAndDescriptions.SwapDescription,
    getElement: (args) => {
      if (args.browserRouterEnabled && args.hash) {
        return <Navigate to={args.hash.replace('#', '')} replace />
      }
      // Redirect to CASH token detail page as the main landing
      return <Navigate to="/cash" replace />
    },
  }),
  // CASH Token Detail Page — uses our REST/WS API instead of GraphQL
  createRouteDefinition({
    path: '/cash',
    getTitle: () => 'CASH — Token Details',
    getDescription: () => 'CASH token detail page with real-time orderbook data',
    getElement: () => (
      <Suspense fallback={null}>
        <CashTokenDetailPage />
      </Suspense>
    ),
  }),
  createRouteDefinition({
    path: '/limits',
    getElement: () => <Navigate to="/limit" replace />,
    getTitle: () => i18n.t('title.placeLimit'),
  }),
  createRouteDefinition({
    path: '/limit',
    getElement: () => <CashSwapPage />,
    getTitle: () => i18n.t('title.placeLimit'),
  }),
  createRouteDefinition({
    path: '/swap',
    getElement: () => <CashSwapPage />,
    getTitle: () => StaticTitlesAndDescriptions.SwapTitle,
  }),
  createRouteDefinition({ path: '*', getElement: () => <Navigate to="/not-found" replace /> }),
  createRouteDefinition({ path: '/not-found', getElement: () => <NotFound /> }),
]

export const findRouteByPath = (pathname: string) => {
  for (const route of routes) {
    const match = matchPath(route.path, pathname)
    if (match) {
      return route
    }
    const subPaths = route.nestedPaths.map((nestedPath) => `${route.path}/${nestedPath}`)
    for (const subPath of subPaths) {
      const match = matchPath(subPath, pathname)
      if (match) {
        return route
      }
    }
  }
  return undefined
}
