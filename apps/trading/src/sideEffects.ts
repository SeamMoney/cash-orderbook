/* eslint-disable @typescript-eslint/no-unnecessary-condition */
// note the reason for the setupi18n function is to avoid webpack tree shaking the file out
import { setupi18n } from 'uniswap/src/i18n/i18n-setup-interface'
import '@reach/dialog/styles.css'
import '~/global.css'
import '~/polyfills'
import '~/tracing'

// WalletConnect import removed — package not installed in CASH fork
import { setupWagmiAutoConnect } from '~/components/Web3Provider/wagmiAutoConnect'
import { setupTurnstileCSPErrorFilter } from '~/utils/setupTurnstileCSPErrorFilter'
import { setupVitePreloadErrorHandler } from '~/utils/setupVitePreloadErrorHandler'

// adding these so webpack won't tree shake this away, sideEffects was giving trouble
setupi18n()
setupWagmiAutoConnect()
setupVitePreloadErrorHandler()
setupTurnstileCSPErrorFilter()
