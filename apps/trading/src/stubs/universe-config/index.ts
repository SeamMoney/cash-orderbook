/**
 * Stub for @universe/config package.
 * Provides a minimal getConfig() that reads from process.env (Vite defines).
 */

export interface Config {
  alchemyApiKey: string
  amplitudeProxyUrlOverride: string
  apiBaseUrlOverride: string
  apiBaseUrlV2Override: string
  appsflyerApiKey: string
  appsflyerAppId: string
  blockaidProxyUrl: string
  datadogClientToken: string
  datadogProjectId: string
  isE2ETest: boolean
  forApiUrlOverride: string
  graphqlUrlOverride: string
  includePrototypeFeatures: string
  infuraKey: string
  isVercelEnvironment: boolean
  jupiterProxyUrl: string
  onesignalAppId: string
  quicknodeEndpointName: string
  quicknodeEndpointToken: string
  scantasticApiUrlOverride: string
  statsigProxyUrlOverride: string
  statsigApiKey: string
  tradingApiKey: string
  tradingApiUrlOverride: string
  tradingApiWebTestEnv: string
  liquidityServiceUrlOverride: string
  uniswapApiKey: string
  unitagsApiUrlOverride: string
  uniswapNotifApiBaseUrlOverride: string
  entryGatewayApiUrlOverride: string
  walletConnectProjectId: string
  walletConnectProjectIdBeta: string
  walletConnectProjectIdDev: string
  enableSessionService: boolean
  enableSessionUpgradeAuto: boolean
  enableEntryGatewayProxy: boolean
}

let cachedConfig: Config | undefined

export const getConfig = (): Config => {
  if (cachedConfig !== undefined) {
    return cachedConfig
  }

  const config: Config = {
    alchemyApiKey: process.env.REACT_APP_ALCHEMY_API_KEY || '',
    amplitudeProxyUrlOverride: process.env.AMPLITUDE_PROXY_URL_OVERRIDE || '',
    apiBaseUrlOverride: process.env.API_BASE_URL_OVERRIDE || '',
    apiBaseUrlV2Override: process.env.API_BASE_URL_V2_OVERRIDE || '',
    appsflyerApiKey: '',
    appsflyerAppId: '',
    blockaidProxyUrl: process.env.REACT_APP_BLOCKAID_PROXY_URL || '',
    datadogClientToken: process.env.REACT_APP_DATADOG_CLIENT_TOKEN || '',
    datadogProjectId: process.env.REACT_APP_DATADOG_PROJECT_ID || '',
    isE2ETest: false,
    forApiUrlOverride: process.env.FOR_API_URL_OVERRIDE || '',
    graphqlUrlOverride: process.env.REACT_APP_AWS_API_ENDPOINT || '',
    includePrototypeFeatures: '',
    infuraKey: process.env.REACT_APP_INFURA_KEY || '',
    isVercelEnvironment: !!process.env.VERCEL,
    jupiterProxyUrl: '',
    onesignalAppId: '',
    quicknodeEndpointName: process.env.REACT_APP_QUICKNODE_ENDPOINT_NAME || '',
    quicknodeEndpointToken: process.env.REACT_APP_QUICKNODE_ENDPOINT_TOKEN || '',
    scantasticApiUrlOverride: '',
    statsigProxyUrlOverride: process.env.REACT_APP_STATSIG_PROXY_URL || '',
    statsigApiKey: process.env.REACT_APP_STATSIG_API_KEY || '',
    tradingApiKey: process.env.REACT_APP_TRADING_API_KEY || '',
    tradingApiUrlOverride: '',
    tradingApiWebTestEnv: '',
    liquidityServiceUrlOverride: '',
    uniswapApiKey: '',
    unitagsApiUrlOverride: '',
    uniswapNotifApiBaseUrlOverride: '',
    entryGatewayApiUrlOverride: process.env.ENTRY_GATEWAY_API_URL_OVERRIDE || '',
    walletConnectProjectId: process.env.REACT_APP_WALLET_CONNECT_PROJECT_ID || '',
    walletConnectProjectIdBeta: '',
    walletConnectProjectIdDev: '',
    enableSessionService: false,
    enableSessionUpgradeAuto: false,
    enableEntryGatewayProxy: false,
  }

  cachedConfig = config
  return config
}
