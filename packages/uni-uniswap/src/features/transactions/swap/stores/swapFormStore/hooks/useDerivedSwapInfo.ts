import { TradeType } from '@uniswap/sdk-core'
import { FeatureFlags, useFeatureFlag } from '@universe/gating'
import { useMemo } from 'react'
import { useUniswapContextSelector } from 'uniswap/src/contexts/UniswapContext'
import { useEnabledChains } from 'uniswap/src/features/chains/hooks/useEnabledChains'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { useOnChainCurrencyBalance } from 'uniswap/src/features/portfolio/api'
import { getCurrencyAmount, ValueType } from 'uniswap/src/features/tokens/getCurrencyAmount'
import { useCurrencyInfo } from 'uniswap/src/features/tokens/useCurrencyInfo'
import { useTransactionSettingsStore } from 'uniswap/src/features/transactions/components/settings/stores/transactionSettingsStore/useTransactionSettingsStore'
import { useUSDCValue } from 'uniswap/src/features/transactions/hooks/useUSDCPriceWrapper'
import { useTrade } from 'uniswap/src/features/transactions/swap/hooks/useTrade'
import { useTradeFromExistingPlan } from 'uniswap/src/features/transactions/swap/hooks/useTradeFromExistingPlan'
import type { DerivedSwapInfo } from 'uniswap/src/features/transactions/swap/types/derivedSwapInfo'
import { getWrapType } from 'uniswap/src/features/transactions/swap/utils/wrap'
import type { TransactionState } from 'uniswap/src/features/transactions/types/transactionState'
import { useWallet } from 'uniswap/src/features/wallet/hooks/useWallet'
import { CurrencyField } from 'uniswap/src/types/currency'
import { buildCurrencyId } from 'uniswap/src/utils/currencyId'
import { useCashTokenOverride } from 'uniswap/src/components/TokenSelector/CashTokenOverrideContext'

/** Returns information derived from the current swap state */
export function useDerivedSwapInfo({
  isDebouncing,
  ...state
}: TransactionState & { isDebouncing?: boolean }): DerivedSwapInfo {
  const {
    [CurrencyField.INPUT]: currencyAssetIn,
    [CurrencyField.OUTPUT]: currencyAssetOut,
    exactAmountFiat,
    exactAmountToken,
    exactCurrencyField,
    focusOnCurrencyField = CurrencyField.INPUT,
    selectingCurrencyField,
    txId,
  } = state

  const { defaultChainId } = useEnabledChains()

  const { customSlippageTolerance, selectedProtocols, isV4HookPoolsEnabled } = useTransactionSettingsStore((s) => ({
    customSlippageTolerance: s.customSlippageTolerance,
    selectedProtocols: s.selectedProtocols,
    isV4HookPoolsEnabled: s.isV4HookPoolsEnabled,
  }))

  const currencyInInfo = useCurrencyInfo(
    currencyAssetIn ? buildCurrencyId(currencyAssetIn.chainId, currencyAssetIn.address) : undefined,
    { refetch: true },
  )

  const currencyOutInfo = useCurrencyInfo(
    currencyAssetOut ? buildCurrencyId(currencyAssetOut.chainId, currencyAssetOut.address) : undefined,
    { refetch: true },
  )

  const currencyIn = currencyInInfo?.currency
  const currencyOut = currencyOutInfo?.currency

  const chainId = currencyIn?.chainId ?? currencyOut?.chainId ?? defaultChainId

  const { evmAccount, svmAccount } = useWallet()

  const account = chainId === UniverseChainId.Solana ? svmAccount : evmAccount

  const cashOverride = useCashTokenOverride()

  const currencies = useMemo(() => {
    return {
      [CurrencyField.INPUT]: currencyInInfo,
      [CurrencyField.OUTPUT]: currencyOutInfo,
    }
  }, [currencyInInfo, currencyOutInfo])

  const { balance: tokenInBalance } = useOnChainCurrencyBalance(currencyIn, account?.address)
  const { balance: tokenOutBalance } = useOnChainCurrencyBalance(currencyOut, account?.address)

  const isExactIn = exactCurrencyField === CurrencyField.INPUT
  const wrapType = getWrapType(currencyIn, currencyOut)

  const otherCurrency = isExactIn ? currencyOut : currencyIn
  const exactCurrency = isExactIn ? currencyIn : currencyOut

  // amountSpecified, otherCurrency, tradeType fully defines a trade
  const amountSpecified = useMemo(() => {
    return getCurrencyAmount({
      value: exactAmountToken,
      valueType: ValueType.Exact,
      currency: exactCurrency,
    })
  }, [exactAmountToken, exactCurrency])

  const sendPortionEnabled = useFeatureFlag(FeatureFlags.PortionFields)

  const generatePermitAsTransaction = useUniswapContextSelector((ctx) => {
    // If the account cannot sign typedData, permits should be completed as a transaction step,
    // unless the swap is going through the 7702 smart wallet flow, in which case the
    // swap_7702 endpoint consumes typedData in the process encoding the swap.
    return ctx.getCanSignPermits?.(chainId) && !ctx.getSwapDelegationInfo?.(chainId).delegationAddress
  })
  const tradeParams = useMemo(
    () => ({
      account,
      amountSpecified,
      otherCurrency,
      tradeType: isExactIn ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT,
      customSlippageTolerance,
      selectedProtocols,
      sendPortionEnabled,
      isDebouncing,
      generatePermitAsTransaction,
      isV4HookPoolsEnabled,
    }),
    [
      account,
      amountSpecified,
      otherCurrency,
      isExactIn,
      customSlippageTolerance,
      selectedProtocols,
      sendPortionEnabled,
      isDebouncing,
      generatePermitAsTransaction,
      isV4HookPoolsEnabled,
    ],
  )

  // When CASH override is active, skip ALL EVM trade/quote queries — they are useless
  // (Aptos-only app; the Uniswap trading API calls will CORS-fail anyway).
  const skipEvmTrade = cashOverride.enabled

  const existingPlanTrade = useTradeFromExistingPlan(tradeParams)
  const tradeFromQuote = useTrade({ ...tradeParams, skip: skipEvmTrade || !!existingPlanTrade })
  const trade = existingPlanTrade ?? tradeFromQuote

  const displayableTrade = trade.trade ?? trade.indicativeTrade

  const displayableTradeOutputAmount = displayableTrade?.outputAmount

  // Cash override: compute quote-based output amount when routing API is not available
  const cashQuoteOutputAmount = useMemo(() => {
    if (
      cashOverride.enabled &&
      cashOverride.getQuote &&
      isExactIn &&
      currencyIn &&
      currencyOut &&
      exactAmountToken
    ) {
      const amount = parseFloat(exactAmountToken)
      if (!isNaN(amount) && amount > 0) {
        const outAddress = currencyOut.wrapped.address.toLowerCase()
        // CASH address contains 'e66fef' — if output is CASH, direction is 'buy'; otherwise 'sell'
        const direction: 'buy' | 'sell' = outAddress.includes('e66fef') ? 'buy' : 'sell'
        const quote = cashOverride.getQuote(amount, direction)
        if (quote && quote.sufficientLiquidity) {
          return getCurrencyAmount({
            value: quote.outputAmount.toFixed(currencyOut.decimals),
            valueType: ValueType.Exact,
            currency: currencyOut,
          })
        }
      }
    }
    return undefined
  }, [cashOverride, isExactIn, currencyIn, currencyOut, exactAmountToken])

  const currencyAmounts = useMemo(
    () => ({
      [CurrencyField.INPUT]:
        exactCurrencyField === CurrencyField.INPUT ? amountSpecified : displayableTrade?.inputAmount,
      [CurrencyField.OUTPUT]:
        exactCurrencyField === CurrencyField.OUTPUT
          ? amountSpecified
          : (cashQuoteOutputAmount ?? displayableTradeOutputAmount),
    }),
    [exactCurrencyField, amountSpecified, displayableTrade?.inputAmount, displayableTradeOutputAmount, cashQuoteOutputAmount],
  )

  const inputCurrencyUSDValue = useUSDCValue(currencyAmounts[CurrencyField.INPUT])
  const outputCurrencyUSDValue = useUSDCValue(currencyAmounts[CurrencyField.OUTPUT])

  // Cash override: compute USD value from override price × amount.
  // The input currency itself is used as the wrapper (only .toExact() is read downstream).
  const cashInputUSD = useMemo(() => {
    if (!cashOverride.enabled || !cashOverride.getUsdPrice || !currencyIn) return undefined
    const addr = (currencyIn as any).address ?? currencyIn.wrapped?.address
    if (!addr) return undefined
    const price = cashOverride.getUsdPrice(addr)
    const amt = currencyAmounts[CurrencyField.INPUT]
    if (price == null || !amt) return undefined
    const human = parseFloat(amt.toExact())
    if (!isFinite(human)) return undefined
    const usd = human * price
    return getCurrencyAmount({
      value: usd.toFixed(currencyIn.decimals),
      valueType: ValueType.Exact,
      currency: currencyIn,
    }) ?? undefined
  }, [cashOverride, currencyIn, currencyAmounts])

  const cashOutputUSD = useMemo(() => {
    if (!cashOverride.enabled || !cashOverride.getUsdPrice || !currencyOut) return undefined
    const addr = (currencyOut as any).address ?? currencyOut.wrapped?.address
    if (!addr) return undefined
    const price = cashOverride.getUsdPrice(addr)
    const amt = currencyAmounts[CurrencyField.OUTPUT]
    if (price == null || !amt) return undefined
    const human = parseFloat(amt.toExact())
    if (!isFinite(human)) return undefined
    const usd = human * price
    return getCurrencyAmount({
      value: usd.toFixed(currencyOut.decimals),
      valueType: ValueType.Exact,
      currency: currencyOut,
    }) ?? undefined
  }, [cashOverride, currencyOut, currencyAmounts])

  const currencyAmountsUSDValue = useMemo(() => {
    return {
      [CurrencyField.INPUT]: cashInputUSD ?? inputCurrencyUSDValue,
      [CurrencyField.OUTPUT]: cashOutputUSD ?? outputCurrencyUSDValue,
    }
  }, [inputCurrencyUSDValue, outputCurrencyUSDValue, cashInputUSD, cashOutputUSD])

  // Cash override: inject on-chain balances from Aptos Indexer.
  // Use (currency as any).address directly — currencyIn.wrapped.address returns
  // WETH because our fake currencies have NativeCurrency as prototype.
  const cashTokenInBalance = useMemo(() => {
    if (cashOverride.enabled && cashOverride.getBalance && currencyIn) {
      const addr = (currencyIn as any).address ?? currencyIn.wrapped?.address
      if (!addr) return undefined
      const raw = cashOverride.getBalance(addr)
      if (raw !== null) {
        return getCurrencyAmount({
          value: Math.max(0, raw).toFixed(currencyIn.decimals),
          valueType: ValueType.Exact,
          currency: currencyIn,
        })
      }
    }
    return undefined
  }, [cashOverride, currencyIn])

  const cashTokenOutBalance = useMemo(() => {
    if (cashOverride.enabled && cashOverride.getBalance && currencyOut) {
      const addr = (currencyOut as any).address ?? currencyOut.wrapped?.address
      if (!addr) return undefined
      const raw = cashOverride.getBalance(addr)
      if (raw !== null) {
        return getCurrencyAmount({
          value: Math.max(0, raw).toFixed(currencyOut.decimals),
          valueType: ValueType.Exact,
          currency: currencyOut,
        })
      }
    }
    return undefined
  }, [cashOverride, currencyOut])

  const currencyBalances = useMemo(() => {
    return {
      [CurrencyField.INPUT]: cashTokenInBalance ?? tokenInBalance,
      [CurrencyField.OUTPUT]: cashTokenOutBalance ?? tokenOutBalance,
    }
  }, [tokenInBalance, tokenOutBalance, cashTokenInBalance, cashTokenOutBalance])

  return useMemo(() => {
    return {
      chainId,
      currencies,
      currencyAmounts,
      currencyAmountsUSDValue,
      currencyBalances,
      trade,
      exactAmountToken,
      exactAmountFiat,
      exactCurrencyField,
      focusOnCurrencyField,
      wrapType,
      selectingCurrencyField,
      txId,
      outputAmountUserWillReceive: displayableTrade?.quoteOutputAmountUserWillReceive,
    }
  }, [
    chainId,
    currencies,
    currencyAmounts,
    currencyAmountsUSDValue,
    currencyBalances,
    exactAmountFiat,
    exactAmountToken,
    exactCurrencyField,
    focusOnCurrencyField,
    selectingCurrencyField,
    trade,
    txId,
    wrapType,
    displayableTrade,
  ])
}
