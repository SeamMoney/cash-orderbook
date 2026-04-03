import { OnchainItemListOptionType, TokenOption } from 'uniswap/src/components/lists/items/types'
import { nativeOnChain } from 'uniswap/src/constants/tokens'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { CurrencyInfo } from 'uniswap/src/features/dataApi/types'

/**
 * Creates a Token-like currency object that bypasses @uniswap/sdk-core address
 * validation (which rejects Aptos 64-char addresses). Uses the same Object.create
 * pattern as CashTDPProvider.
 */
function makeTokenOption(
  address: string,
  decimals: number,
  symbol: string,
  name: string,
  logoUrl: string,
): TokenOption {
  const base = nativeOnChain(UniverseChainId.Mainnet)
  const currency = Object.create(base, {
    name: { value: name, writable: false, enumerable: true, configurable: true },
    symbol: { value: symbol, writable: false, enumerable: true, configurable: true },
    decimals: { value: decimals, writable: false, enumerable: true, configurable: true },
    isNative: { value: false, writable: false, enumerable: true, configurable: true },
    isToken: { value: true, writable: false, enumerable: true, configurable: true },
    address: { value: address, writable: false, enumerable: true, configurable: true },
    chainId: { value: 1, writable: false, enumerable: true, configurable: true },
  })
  const currencyInfo: CurrencyInfo = {
    currency,
    currencyId: `1-${address}`,
    logoUrl,
  }
  return {
    type: OnchainItemListOptionType.Token,
    currencyInfo,
    quantity: null,
    balanceUSD: null,
  }
}

export const CASH_TOKEN_OPTIONS: TokenOption[] = [
  makeTokenOption(
    '0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1',
    8,
    'CASH',
    'CASH',
    'https://assets.panora.exchange/tokens/aptos/CASH.png',
  ),
  makeTokenOption(
    '0x05fabd1b12e39967a3c24e91b7b8f67719a6dacee74f3c8b9fb7d93e855437d2',
    6,
    'USD1',
    'World Liberty Financial USD',
    'https://assets.panora.exchange/tokens/aptos/USD1.png',
  ),
  makeTokenOption(
    '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b',
    6,
    'USDC',
    'USD Coin',
    'https://assets.panora.exchange/tokens/aptos/USDC.svg',
  ),
  makeTokenOption(
    '0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b',
    6,
    'USDt',
    'Tether USD',
    'https://assets.panora.exchange/tokens/aptos/USDT.svg',
  ),
  makeTokenOption(
    '0xf37a8864fe737eb8ec2c2931047047cbaed1beed3fb0e5b7c5526dafd3b9c2e9',
    6,
    'USDe',
    'USDe',
    'https://assets.panora.exchange/tokens/aptos/USDe.png',
  ),
]

/** USD1 currency for use as default swap input */
export const USD1_CURRENCY = CASH_TOKEN_OPTIONS[1]!.currencyInfo.currency
