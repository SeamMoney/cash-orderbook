// Ordering is intentional and must be preserved: sideEffects followed by functionality.
import '~/sideEffects'

import { ApolloProvider } from '@apollo/client'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import type { PropsWithChildren } from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Helmet, HelmetProvider } from 'react-helmet-async/lib/index'
import { I18nextProvider } from 'react-i18next'
import { Provider } from 'react-redux'
import { BrowserRouter, HashRouter, useLocation } from 'react-router'
import { PortalProvider } from 'ui/src'
import { ReactRouterUrlProvider } from 'uniswap/src/contexts/UrlContext'
import { LocalizationContextProvider } from 'uniswap/src/features/language/LocalizationContext'
import { TokenPriceProvider } from 'uniswap/src/features/prices/TokenPriceContext'
import i18n from 'uniswap/src/i18n'
import { AssetActivityProvider } from '~/appGraphql/data/apollo/AssetActivityProvider'
import { apolloClient } from '~/appGraphql/data/apollo/client'
import { TokenBalancesProvider } from '~/appGraphql/data/apollo/TokenBalancesProvider'
import { QueryClientPersistProvider } from '~/components/PersistQueryClient'
import { createWeb3Provider, WalletCapabilitiesEffects } from '~/components/Web3Provider/createWeb3Provider'
import { WebUniswapProvider } from '~/components/Web3Provider/WebUniswapContext'
import { wagmiConfig } from '~/components/Web3Provider/wagmiConfig'
import { WebAccountsStoreProvider } from '~/features/accounts/store/provider'
import { ConnectWalletMutationProvider } from '~/features/wallet/connection/hooks/useConnectWalletMutation'
import { ExternalWalletProvider } from '~/features/wallet/providers/ExternalWalletProvider'
import { useDeferredComponent } from '~/hooks/useDeferredComponent'
import { LanguageProvider } from '~/i18n/LanguageProvider'
import { BlockNumberProvider } from '~/lib/hooks/useBlockNumber'
import App from '~/pages/App'
import store from '~/state'
import { LivePricesProvider } from '~/state/livePrices/LivePricesProvider'
import { ThemedGlobalStyle, ThemeProvider } from '~/theme'
import { TamaguiProvider } from '~/theme/tamaguiProvider'
import { AptosWalletProvider } from '~/cash/providers/AptosWalletProvider'
import { isBrowserRouterEnabled } from '~/utils/env'
import { unregister as unregisterServiceWorker } from '~/utils/serviceWorker'
import { getCanonicalUrl } from '~/utils/urlRoutes'

if (window.ethereum) {
  window.ethereum.autoRefreshOnNetworkChange = false
}

const loadListsUpdater = () => import('~/state/lists/updater')
const loadApplicationUpdater = () => import('~/state/application/updater')
const loadActivityStateUpdater = () =>
  import('~/state/activity/updater').then((m) => ({ default: m.ActivityStateUpdater }))
const loadLogsUpdater = () => import('~/state/logs/updater')
const loadFiatOnRampTransactionsUpdater = () => import('~/state/fiatOnRampTransactions/updater')

function Updaters() {
  const location = useLocation()

  const ListsUpdater = useDeferredComponent(loadListsUpdater)
  const ApplicationUpdater = useDeferredComponent(loadApplicationUpdater)
  const ActivityStateUpdater = useDeferredComponent(loadActivityStateUpdater)
  const LogsUpdater = useDeferredComponent(loadLogsUpdater)
  const FiatOnRampTransactionsUpdater = useDeferredComponent(loadFiatOnRampTransactionsUpdater)

  return (
    <>
      <Helmet>
        <link rel="canonical" href={getCanonicalUrl(location.pathname)} />
      </Helmet>
      {ListsUpdater && <ListsUpdater />}
      {ApplicationUpdater && <ApplicationUpdater />}
      {ActivityStateUpdater && <ActivityStateUpdater />}
      {LogsUpdater && <LogsUpdater />}
      {FiatOnRampTransactionsUpdater && <FiatOnRampTransactionsUpdater />}
    </>
  )
}

// Production Web3Provider – always reconnects on mount and runs capability effects.
const Web3Provider = createWeb3Provider({ wagmiConfig })

function GraphqlProviders({ children }: { children: React.ReactNode }) {
  return (
    <ApolloProvider client={apolloClient}>
      <AssetActivityProvider>
        <TokenBalancesProvider>{children}</TokenBalancesProvider>
      </AssetActivityProvider>
    </ApolloProvider>
  )
}

// Stub StatsigProvider: just render children without Statsig SDK
function StatsigProvider({ children }: PropsWithChildren) {
  return <>{children}</>
}

const container = document.getElementById('root') as HTMLElement

const Router = isBrowserRouterEnabled() ? BrowserRouter : HashRouter

const RootApp = (): JSX.Element => {
  return (
    <StrictMode>
      <HelmetProvider>
        <ReactRouterUrlProvider>
          <Provider store={store}>
            <QueryClientPersistProvider>
              <NuqsAdapter>
                <AptosWalletProvider>
                <Router>
                  <I18nextProvider i18n={i18n}>
                    <LanguageProvider>
                      <Web3Provider>
                        <StatsigProvider>
                          <WalletCapabilitiesEffects />
                          <ExternalWalletProvider>
                            <ConnectWalletMutationProvider>
                              <WebAccountsStoreProvider>
                                <WebUniswapProvider>
                                  <TokenPriceProvider>
                                    <GraphqlProviders>
                                      <LivePricesProvider>
                                        <LocalizationContextProvider>
                                          <BlockNumberProvider>
                                            <Updaters />
                                            <ThemeProvider>
                                              <TamaguiProvider>
                                                <PortalProvider>
                                                  <ThemedGlobalStyle />
                                                  <App />
                                                </PortalProvider>
                                              </TamaguiProvider>
                                            </ThemeProvider>
                                          </BlockNumberProvider>
                                        </LocalizationContextProvider>
                                      </LivePricesProvider>
                                    </GraphqlProviders>
                                  </TokenPriceProvider>
                                </WebUniswapProvider>
                              </WebAccountsStoreProvider>
                            </ConnectWalletMutationProvider>
                          </ExternalWalletProvider>
                        </StatsigProvider>
                      </Web3Provider>
                    </LanguageProvider>
                  </I18nextProvider>
                </Router>
                </AptosWalletProvider>
              </NuqsAdapter>
            </QueryClientPersistProvider>
          </Provider>
        </ReactRouterUrlProvider>
      </HelmetProvider>
    </StrictMode>
  )
}

createRoot(container).render(<RootApp />)

// We once had a ServiceWorker, and users who have not visited since then may still have it registered.
// This ensures it is truly gone.
unregisterServiceWorker()
