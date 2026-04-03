/**
 * CashSwapWidget — Swap widget for the CASH token detail page.
 *
 * Replaces the Uniswap TDPSwapComponent with CASH-specific swap logic:
 * - Orderbook route for CASH↔USD1 (walks depth via calculateSwapQuote)
 * - Panora aggregator route for all other pairs
 * - Limit order tab for GTC limit orders
 * - Token selector with CASH, USD1, USDC, USDT, USDe
 * - CTA button with state-aware labels
 * - Toast notifications via sonner
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Flex, Text } from 'ui/src'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { toast } from 'sonner'
import { useDepth } from '~/cash/hooks/use-depth'
import { useBalances } from '~/cash/hooks/use-balances'
import { useAccountSubscription } from '~/cash/hooks/use-account-subscription'
import { buildPlaceOrderPayload } from '~/cash/lib/sdk'
import { calculateSwapQuote, type SwapDirection, type SwapQuote } from '~/cash/lib/swap-quote'
import {
  getPanoraQuote,
  getPanoraSwapPayload,
  PanoraError,
  type PanoraQuote,
} from '~/cash/lib/panora'
import { formatBalance } from '~/cash/lib/utils'
import { WalletSelectorModal } from '~/cash/providers/WalletSelectorModal'
import { STABLECOINS, CASH_DECIMALS } from '@cash/shared'

// ---------------------------------------------------------------------------
// Token types & data
// ---------------------------------------------------------------------------

interface TokenInfo {
  symbol: string
  name: string
  decimals: number
  gradient: string
}

/** All supported tokens — CASH first, then stablecoins (excluding GHO which is TBD) */
const SUPPORTED_TOKENS: TokenInfo[] = [
  {
    symbol: 'CASH',
    name: 'CASH',
    decimals: CASH_DECIMALS,
    gradient: 'from-green-400 to-emerald-600',
  },
  ...STABLECOINS.filter((s) => s.symbol !== 'GHO').map((s) => ({
    symbol: s.symbol,
    name: s.name,
    decimals: s.decimals,
    gradient: s.gradient,
  })),
]

const TOKENS: Record<string, TokenInfo> = Object.fromEntries(SUPPORTED_TOKENS.map((t) => [t.symbol, t]))

const DEFAULT_FROM_TOKEN = TOKENS['USD1'] ?? SUPPORTED_TOKENS[1]
const DEFAULT_TO_TOKEN = TOKENS['CASH'] ?? SUPPORTED_TOKENS[0]

/** Gradient color map for token icon backgrounds */
const GRADIENT_COLORS: Record<string, string> = {
  'green-400': '#4ade80',
  'emerald-600': '#059669',
  'amber-400': '#fbbf24',
  'yellow-500': '#eab308',
  'blue-400': '#60a5fa',
  'blue-600': '#2563eb',
  'emerald-400': '#34d399',
  'teal-500': '#14b8a6',
  'indigo-400': '#818cf8',
  'purple-500': '#a855f7',
  'purple-400': '#c084fc',
  'pink-500': '#ec4899',
}

function getGradientCSS(gradient: string): string {
  const fromMatch = gradient.match(/from-([a-z]+-\d+)/)
  const toMatch = gradient.match(/to-([a-z]+-\d+)/)
  const from = fromMatch ? GRADIENT_COLORS[fromMatch[1]] ?? '#888' : '#888'
  const to = toMatch ? GRADIENT_COLORS[toMatch[1]] ?? '#666' : '#666'
  return `linear-gradient(to bottom right, ${from}, ${to})`
}

/** Check if a pair routes through orderbook (CASH↔USD1) or Panora */
function isPanoraPair(from: TokenInfo, to: TokenInfo): boolean {
  const isCashUsd1 =
    (from.symbol === 'CASH' && to.symbol === 'USD1') || (from.symbol === 'USD1' && to.symbol === 'CASH')
  return !isCashUsd1
}

// ---------------------------------------------------------------------------
// Tab & selector types
// ---------------------------------------------------------------------------

type SwapTab = 'swap' | 'limit'
type SelectorSlot = 'from' | 'to' | null

// ---------------------------------------------------------------------------
// CashSwapWidget
// ---------------------------------------------------------------------------

export function CashSwapWidget(): React.ReactElement {
  const { connected, account, signAndSubmitTransaction } = useWallet()
  const { depth, loading: depthLoading } = useDepth(3000)

  const walletAddress = connected && account?.address ? account.address.toString() : undefined
  const { balances, updateBalances } = useBalances(walletAddress)
  useAccountSubscription(walletAddress, updateBalances)

  // Wallet selector modal
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false)

  // Tab state
  const [activeTab, setActiveTab] = useState<SwapTab>('swap')

  // Swap tab state
  const [fromToken, setFromToken] = useState<TokenInfo>(DEFAULT_FROM_TOKEN)
  const [toToken, setToToken] = useState<TokenInfo>(DEFAULT_TO_TOKEN)
  const [inputAmount, setInputAmount] = useState('')
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [panoraQuote, setPanoraQuote] = useState<PanoraQuote | null>(null)
  const [panoraError, setPanoraError] = useState<string | null>(null)
  const [isSwapping, setIsSwapping] = useState(false)

  // Token selector state
  const [selectorOpen, setSelectorOpen] = useState<SelectorSlot>(null)

  // Limit tab state
  const [limitSide, setLimitSide] = useState<'buy' | 'sell'>('buy')
  const [limitPrice, setLimitPrice] = useState('')
  const [limitAmount, setLimitAmount] = useState('')
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derived
  const direction: SwapDirection = toToken.symbol === 'CASH' ? 'buy' : 'sell'
  const usePanora = isPanoraPair(fromToken, toToken)
  const inputNum = parseFloat(inputAmount)

  const getTokenBalance = useCallback(
    (symbol: string): number | null => {
      if (!balances) return null
      if (symbol === 'CASH') return balances.cash.available
      if (symbol === 'USDC') return balances.usdc.available
      // USD1, USDT, USDe — not tracked by our API yet; treat as 0 so the
      // insufficient-balance CTA fires correctly when the wallet is connected.
      return 0
    },
    [balances],
  )

  const fromBalance = getTokenBalance(fromToken.symbol)
  const insufficientBalance =
    connected && fromBalance !== null && !isNaN(inputNum) && inputNum > 0 && inputNum > fromBalance

  const activeOutputAmount = usePanora ? panoraQuote?.outputAmount ?? null : quote?.outputAmount ?? null

  // Calculate quote with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const amount = parseFloat(inputAmount)
    if (isNaN(amount) || amount <= 0) {
      setQuote(null)
      setPanoraQuote(null)
      setPanoraError(null)
      return
    }

    if (!usePanora) {
      setPanoraQuote(null)
      setPanoraError(null)
      if (!depth) {
        setQuote(null)
        return
      }
      debounceRef.current = setTimeout(() => {
        const result = calculateSwapQuote(amount, direction, depth.bids, depth.asks)
        setQuote(result)
      }, 300)
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
      }
    }

    // Panora path
    setQuote(null)
    let cancelled = false
    debounceRef.current = setTimeout(() => {
      setPanoraError(null)
      getPanoraQuote(fromToken.symbol, toToken.symbol, amount, 0.5)
        .then((result) => {
          if (!cancelled) setPanoraQuote(result)
        })
        .catch((err) => {
          if (!cancelled) {
            setPanoraQuote(null)
            setPanoraError(err instanceof PanoraError ? err.message : 'Route unavailable')
          }
        })
    }, 500)

    return () => {
      cancelled = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [inputAmount, direction, depth, usePanora, fromToken.symbol, toToken.symbol])

  // Handlers
  const handleDirectionToggle = useCallback((): void => {
    setFromToken((prev) => {
      const next = toToken
      setToToken(prev)
      return next
    })
    setInputAmount('')
    setQuote(null)
    setPanoraQuote(null)
    setPanoraError(null)
  }, [toToken])

  const handleTokenSelect = useCallback(
    (token: TokenInfo): void => {
      if (selectorOpen === 'from') {
        if (token.symbol === toToken.symbol) setToToken(fromToken)
        setFromToken(token)
      } else if (selectorOpen === 'to') {
        if (token.symbol === fromToken.symbol) setFromToken(toToken)
        setToToken(token)
      }
      setInputAmount('')
      setQuote(null)
      setPanoraQuote(null)
      setPanoraError(null)
      setSelectorOpen(null)
    },
    [selectorOpen, fromToken, toToken],
  )

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value
    if (value === '' || /^\d*\.?\d*$/.test(value)) setInputAmount(value)
  }, [])

  const handleLimitPriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value
    if (value === '' || /^\d*\.?\d*$/.test(value)) setLimitPrice(value)
  }, [])

  const handleLimitAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value
    if (value === '' || /^\d*\.?\d*$/.test(value)) setLimitAmount(value)
  }, [])

  // Swap execution
  const handleSwap = useCallback(async (): Promise<void> => {
    if (!connected || !account || !signAndSubmitTransaction) {
      toast.error('Please connect your wallet first')
      return
    }
    const amount = parseFloat(inputAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (!usePanora && !quote) {
      toast.error('No price quote available')
      return
    }
    if (usePanora && !panoraQuote) {
      toast.error('No price quote available')
      return
    }

    setIsSwapping(true)
    try {
      if (usePanora) {
        const txData = await getPanoraSwapPayload(
          fromToken.symbol,
          toToken.symbol,
          amount,
          0.5,
          account.address.toString(),
        )
        const response = await signAndSubmitTransaction({
          data: txData as Parameters<typeof signAndSubmitTransaction>[0]['data'],
        })
        const txHash =
          typeof response === 'object' && response !== null && 'hash' in response
            ? (response as { hash: string }).hash
            : String(response)
        toast.success('Swap successful', {
          description: `Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
          duration: 6000,
        })
      } else {
        const baseQuantity = direction === 'buy' ? quote!.outputAmount : amount
        const payload = buildPlaceOrderPayload({
          pairId: 0,
          price: 0,
          quantity: baseQuantity,
          side: direction === 'buy' ? 'buy' : 'sell',
          orderType: 'Market',
        })
        const response = await signAndSubmitTransaction({ data: payload })
        const txHash =
          typeof response === 'object' && response !== null && 'hash' in response
            ? (response as { hash: string }).hash
            : String(response)
        toast.success('Swap successful', {
          description: `Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
          duration: 6000,
        })
      }
      setInputAmount('')
      setQuote(null)
      setPanoraQuote(null)
      setPanoraError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed'
      toast.error('Swap failed', { description: message, duration: 8000 })
    } finally {
      setIsSwapping(false)
    }
  }, [connected, account, signAndSubmitTransaction, inputAmount, quote, panoraQuote, direction, usePanora, fromToken.symbol, toToken.symbol])

  // Limit order execution
  const handlePlaceLimitOrder = useCallback(async (): Promise<void> => {
    if (!connected || !account || !signAndSubmitTransaction) {
      toast.error('Please connect your wallet first')
      return
    }
    const price = parseFloat(limitPrice)
    const amount = parseFloat(limitAmount)
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid price')
      return
    }
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setIsPlacingOrder(true)
    try {
      const payload = buildPlaceOrderPayload({
        pairId: 0,
        price,
        quantity: amount,
        side: limitSide,
        orderType: 'GTC',
      })
      const response = await signAndSubmitTransaction({ data: payload })
      const txHash =
        typeof response === 'object' && response !== null && 'hash' in response
          ? (response as { hash: string }).hash
          : String(response)
      toast.success('Order placed', {
        description: `${limitSide === 'buy' ? 'Buy' : 'Sell'} ${amount} CASH @ ${price} USD1 — Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
        duration: 6000,
      })
      setLimitPrice('')
      setLimitAmount('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed'
      toast.error('Order failed', { description: message, duration: 8000 })
    } finally {
      setIsPlacingOrder(false)
    }
  }, [connected, account, signAndSubmitTransaction, limitPrice, limitAmount, limitSide])

  // CTA states
  const swapCta = useMemo((): { label: string; disabled: boolean; connectWallet: boolean } => {
    if (!connected) return { label: 'Connect Wallet', disabled: false, connectWallet: true }
    if (!inputAmount || parseFloat(inputAmount) <= 0)
      return { label: 'Enter an amount', disabled: true, connectWallet: false }
    if (insufficientBalance)
      return { label: `Insufficient ${fromToken.symbol} balance`, disabled: true, connectWallet: false }
    if (usePanora) {
      if (panoraError) return { label: 'Route unavailable', disabled: true, connectWallet: false }
      if (!panoraQuote) return { label: 'Fetching quote...', disabled: true, connectWallet: false }
    } else {
      if (!quote) return { label: 'Fetching quote...', disabled: true, connectWallet: false }
      if (!quote.sufficientLiquidity)
        return { label: 'Insufficient liquidity', disabled: true, connectWallet: false }
    }
    if (isSwapping) return { label: 'Swapping...', disabled: true, connectWallet: false }
    return { label: 'Swap', disabled: false, connectWallet: false }
  }, [connected, inputAmount, insufficientBalance, fromToken.symbol, usePanora, panoraError, panoraQuote, quote, isSwapping])

  const limitCta = useMemo((): { label: string; disabled: boolean; connectWallet: boolean } => {
    if (!connected) return { label: 'Connect Wallet', disabled: false, connectWallet: true }
    if (!limitPrice || parseFloat(limitPrice) <= 0)
      return { label: 'Enter a price', disabled: true, connectWallet: false }
    if (!limitAmount || parseFloat(limitAmount) <= 0)
      return { label: 'Enter an amount', disabled: true, connectWallet: false }
    if (isPlacingOrder) return { label: 'Placing order...', disabled: true, connectWallet: false }
    return { label: 'Place Order', disabled: false, connectWallet: false }
  }, [connected, limitPrice, limitAmount, isPlacingOrder])

  // Price details
  const priceDetails = useMemo(() => {
    if (usePanora && panoraQuote) {
      const perUnitRate = panoraQuote.inputAmount > 0 ? panoraQuote.outputAmount / panoraQuote.inputAmount : 0
      return {
        rate: perUnitRate > 0 ? `1 ${fromToken.symbol} ≈ ${formatBalance(perUnitRate, 6)} ${toToken.symbol}` : null,
        priceImpact: panoraQuote.priceImpact,
        minimumReceived: `${formatBalance(panoraQuote.minReceived, 6)} ${toToken.symbol}`,
        route: panoraQuote.routeDescription,
      }
    }
    if (!usePanora && quote) {
      const baseSymbol = direction === 'sell' ? fromToken.symbol : toToken.symbol
      const quoteSymbol = direction === 'sell' ? toToken.symbol : fromToken.symbol
      return {
        rate: `1 ${baseSymbol} = ${formatBalance(quote.effectivePrice, 6)} ${quoteSymbol}`,
        priceImpact: quote.priceImpact,
        minimumReceived:
          direction === 'sell'
            ? `${formatBalance(quote.minimumReceived, 6)} ${quoteSymbol}`
            : `${formatBalance(quote.minimumReceived, 6)} ${baseSymbol}`,
        route: 'Direct (Orderbook)',
      }
    }
    return null
  }, [usePanora, panoraQuote, quote, direction, fromToken.symbol, toToken.symbol])

  return (
    <Flex
      backgroundColor="$surface1"
      borderWidth={1}
      borderStyle="solid"
      borderColor="$surface3"
      borderRadius="$rounded16"
      padding="$spacing8"
      data-testid="cash-swap-widget"
    >
      {/* Swap / Limit Tabs */}
      <Flex row alignItems="center" mb="$spacing12" data-testid="swap-tabs">
        {(['swap', 'limit'] as const).map((tab) => (
          <Flex
            key={tab}
            flex={1}
            alignItems="center"
            justifyContent="center"
            py="$spacing8"
            cursor="pointer"
            borderRadius="$rounded8"
            backgroundColor={activeTab === tab ? 'rgba(255,255,255,0.08)' : 'transparent'}
            onPress={() => setActiveTab(tab)}
            data-testid={`swap-tab-${tab}`}
          >
            <Text
              variant="body2"
              fontWeight="500"
              color={activeTab === tab ? '$neutral1' : '$neutral2'}
              textTransform="capitalize"
            >
              {tab}
            </Text>
          </Flex>
        ))}
      </Flex>

      {/* Swap Tab */}
      {activeTab === 'swap' && (
        <Flex gap="$spacing4">
          {/* You Pay */}
          <Flex
            backgroundColor="$surface2"
            borderRadius="$rounded16"
            minHeight={120}
            padding="$spacing16"
            borderWidth={1}
            borderStyle="solid"
            borderColor="$surface2"
            data-testid="swap-input-pay"
          >
            <Flex row alignItems="center" justifyContent="space-between" mb="$spacing8">
              <Text variant="body4" color="$neutral3">
                You pay
              </Text>
              {connected && fromBalance !== null && (
                <Text variant="body4" color="$neutral3">
                  Balance: <Text variant="body4" color="$neutral2">{formatBalance(fromBalance, 4)}</Text>
                </Text>
              )}
            </Flex>
            <Flex row alignItems="center" gap="$spacing12">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={inputAmount}
                onChange={handleInputChange}
                data-testid="swap-input-amount"
                style={{
                  flex: 1,
                  background: 'transparent',
                  fontSize: 28,
                  fontFamily: 'var(--font-geist-sans, system-ui), sans-serif',
                  color: '#FFFFFF',
                  border: 'none',
                  outline: 'none',
                  minWidth: 0,
                  padding: 0,
                }}
              />
              <TokenPill token={fromToken} onClick={() => setSelectorOpen('from')} />
            </Flex>
          </Flex>

          {/* Arrow */}
          <Flex alignItems="center" justifyContent="center" zIndex={2}>
            <Flex
              width={40}
              height={40}
              borderRadius="$rounded12"
              backgroundColor="$surface2"
              borderWidth={4}
              borderStyle="solid"
              borderColor="$surface1"
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              mt={-18}
              mb={-18}
              onPress={handleDirectionToggle}
              data-testid="swap-arrow"
            >
              <ArrowDownUpIcon />
            </Flex>
          </Flex>

          {/* You Receive */}
          <Flex
            backgroundColor="$surface2"
            borderRadius="$rounded16"
            minHeight={120}
            padding="$spacing16"
            borderWidth={1}
            borderStyle="solid"
            borderColor="$surface2"
            data-testid="swap-input-receive"
          >
            <Flex row alignItems="center" justifyContent="space-between" mb="$spacing8">
              <Text variant="body4" color="$neutral3">
                You receive
              </Text>
            </Flex>
            <Flex row alignItems="center" gap="$spacing12">
              <Text
                variant="heading3"
                color="$neutral1"
                flex={1}
                style={{ fontSize: 28 }}
                data-testid="swap-output-amount"
              >
                {activeOutputAmount !== null ? formatBalance(activeOutputAmount, 6) : '0'}
              </Text>
              <TokenPill token={toToken} onClick={() => setSelectorOpen('to')} />
            </Flex>
          </Flex>

          {/* Panora error */}
          {usePanora && panoraError && (
            <Flex
              mt="$spacing8"
              borderRadius="$rounded12"
              padding="$spacing12"
              backgroundColor="rgba(255,89,60,0.1)"
              borderWidth={1}
              borderStyle="solid"
              borderColor="rgba(255,89,60,0.2)"
            >
              <Text variant="body4" color="$statusCritical">
                ⚠ {panoraError}
              </Text>
            </Flex>
          )}

          {/* CTA Button */}
          <CTAButton
            label={swapCta.label}
            disabled={swapCta.disabled}
            loading={isSwapping}
            onClick={swapCta.connectWallet ? () => setWalletSelectorOpen(true) : handleSwap}
            testId="swap-cta"
          />

          {/* Price Details */}
          {priceDetails && (
            <Flex
              mt="$spacing8"
              borderRadius="$rounded12"
              padding="$spacing12"
              backgroundColor="$surface2"
              gap="$spacing8"
            >
              {priceDetails.rate && (
                <DetailRow label="Exchange rate" value={priceDetails.rate} />
              )}
              <DetailRow label="Route" value={priceDetails.route} />
              {priceDetails.priceImpact !== null && (
                <DetailRow
                  label="Price impact"
                  value={`${(priceDetails.priceImpact * 100).toFixed(3)}%`}
                  valueColor={
                    priceDetails.priceImpact > 0.01 ? '#FF593C' : priceDetails.priceImpact > 0.001 ? '#fbbf24' : undefined
                  }
                />
              )}
              <DetailRow label="Minimum received" value={priceDetails.minimumReceived} />
            </Flex>
          )}
        </Flex>
      )}

      {/* Limit Tab */}
      {activeTab === 'limit' && (
        <Flex gap="$spacing12">
          {/* Buy/Sell Toggle */}
          <Flex row alignItems="center" gap="$spacing4" data-testid="limit-side-toggle">
            {(['buy', 'sell'] as const).map((side) => (
              <Flex
                key={side}
                flex={1}
                alignItems="center"
                justifyContent="center"
                borderRadius="$roundedFull"
                py="$spacing8"
                minHeight={44}
                cursor="pointer"
                backgroundColor={
                  limitSide === side ? (side === 'buy' ? '#21C95E' : '#FF593C') : 'transparent'
                }
                onPress={() => setLimitSide(side)}
                data-testid={`limit-side-${side}`}
              >
                <Text
                  variant="buttonLabel3"
                  fontWeight="500"
                  color={limitSide === side ? '$neutral1' : '$neutral2'}
                  textTransform="capitalize"
                >
                  {side}
                </Text>
              </Flex>
            ))}
          </Flex>

          {/* Price Input */}
          <Flex
            backgroundColor="$surface2"
            borderRadius="$rounded16"
            padding="$spacing16"
            borderWidth={1}
            borderStyle="solid"
            borderColor="$surface2"
            data-testid="limit-price-input"
          >
            <Flex row alignItems="center" justifyContent="space-between" mb="$spacing8">
              <Text variant="body4" color="$neutral3">
                Price (USD1)
              </Text>
            </Flex>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={limitPrice}
              onChange={handleLimitPriceChange}
              data-testid="limit-price-value"
              style={{
                width: '100%',
                background: 'transparent',
                fontSize: 28,
                fontFamily: 'var(--font-geist-sans, system-ui), sans-serif',
                color: '#FFFFFF',
                border: 'none',
                outline: 'none',
                padding: 0,
              }}
            />
          </Flex>

          {/* Amount Input */}
          <Flex
            backgroundColor="$surface2"
            borderRadius="$rounded16"
            padding="$spacing16"
            borderWidth={1}
            borderStyle="solid"
            borderColor="$surface2"
            data-testid="limit-amount-input"
          >
            <Flex row alignItems="center" justifyContent="space-between" mb="$spacing8">
              <Text variant="body4" color="$neutral3">
                Amount (CASH)
              </Text>
              {connected && balances && (
                <Text variant="body4" color="$neutral3">
                  Balance:{' '}
                  <Text variant="body4" color="$neutral2">
                    {limitSide === 'sell'
                      ? formatBalance(balances.cash.available, 4)
                      : formatBalance(getTokenBalance('USD1') ?? 0, 4)}
                  </Text>
                </Text>
              )}
            </Flex>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={limitAmount}
              onChange={handleLimitAmountChange}
              data-testid="limit-amount-value"
              style={{
                width: '100%',
                background: 'transparent',
                fontSize: 28,
                fontFamily: 'var(--font-geist-sans, system-ui), sans-serif',
                color: '#FFFFFF',
                border: 'none',
                outline: 'none',
                padding: 0,
              }}
            />
          </Flex>

          {/* Order Total */}
          {limitPrice && limitAmount && parseFloat(limitPrice) > 0 && parseFloat(limitAmount) > 0 && (
            <Flex
              backgroundColor="$surface2"
              borderRadius="$rounded16"
              padding="$spacing12"
              borderWidth={1}
              borderStyle="solid"
              borderColor="$surface2"
            >
              <Flex row alignItems="center" justifyContent="space-between">
                <Text variant="body3" color="$neutral3">
                  Total
                </Text>
                <Text variant="body3" color="$neutral1">
                  {formatBalance(parseFloat(limitPrice) * parseFloat(limitAmount), 2)} USD1
                </Text>
              </Flex>
            </Flex>
          )}

          {/* Place Order CTA */}
          <CTAButton
            label={limitCta.label}
            disabled={limitCta.disabled}
            loading={isPlacingOrder}
            onClick={limitCta.connectWallet ? () => setWalletSelectorOpen(true) : handlePlaceLimitOrder}
            color={
              !limitCta.disabled && !limitCta.connectWallet
                ? limitSide === 'buy'
                  ? '#21C95E'
                  : '#FF593C'
                : undefined
            }
            testId="limit-cta"
          />
        </Flex>
      )}

      {/* Token Selector Modal */}
      {selectorOpen !== null && (
        <TokenSelectorOverlay
          tokens={SUPPORTED_TOKENS}
          selectedSymbol={selectorOpen === 'from' ? fromToken.symbol : toToken.symbol}
          onSelect={handleTokenSelect}
          onClose={() => setSelectorOpen(null)}
          balances={balances}
        />
      )}

      {/* Wallet Selector Modal */}
      <WalletSelectorModal isOpen={walletSelectorOpen} onClose={() => setWalletSelectorOpen(false)} />
    </Flex>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Token pill button showing icon + symbol + chevron */
function TokenPill({ token, onClick }: { token: TokenInfo; onClick: () => void }): React.ReactElement {
  return (
    <Flex
      tag="button"
      row
      alignItems="center"
      gap="$spacing6"
      backgroundColor="$surface1"
      borderRadius="$roundedFull"
      px="$spacing8"
      py="$spacing4"
      cursor="pointer"
      hoverStyle={{ backgroundColor: '$surface1Hovered' }}
      onPress={onClick}
      data-testid={`token-selector-${token.symbol}`}
    >
      <Flex
        width={28}
        height={28}
        borderRadius="$roundedFull"
        alignItems="center"
        justifyContent="center"
        style={{ backgroundImage: getGradientCSS(token.gradient) }}
      >
        <Text variant="body4" fontWeight="600" color="$neutral1" style={{ fontSize: 10 }}>
          {token.symbol[0]}
        </Text>
      </Flex>
      <Text variant="buttonLabel2" fontWeight="500" color="$neutral1">
        {token.symbol}
      </Text>
      <ChevronDownIcon />
    </Flex>
  )
}

/** CTA button */
function CTAButton({
  label,
  disabled,
  loading,
  onClick,
  color,
  testId,
}: {
  label: string
  disabled: boolean
  loading: boolean
  onClick: () => void
  color?: string
  testId: string
}): React.ReactElement {
  return (
    <Flex
      tag="button"
      row
      alignItems="center"
      justifyContent="center"
      borderRadius="$rounded20"
      minHeight={56}
      width="100%"
      cursor={disabled ? 'not-allowed' : 'pointer'}
      mt="$spacing16"
      backgroundColor={disabled ? '$surface3Solid' : undefined}
      style={
        !disabled
          ? {
              backgroundColor: color ?? '#00D54B',
            }
          : undefined
      }
      hoverStyle={disabled ? undefined : { opacity: 0.9 }}
      onPress={disabled ? undefined : onClick}
      data-testid={testId}
    >
      {loading && <LoadingSpinner />}
      <Text
        variant="buttonLabel2"
        color={disabled ? '$neutral3' : '$neutral1'}
        style={{ fontWeight: 500 }}
      >
        {label}
      </Text>
    </Flex>
  )
}

/** Price detail row */
function DetailRow({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}): React.ReactElement {
  return (
    <Flex row alignItems="center" justifyContent="space-between">
      <Text variant="body4" color="$neutral3">
        {label}
      </Text>
      <Text variant="body4" color="$neutral2" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </Text>
    </Flex>
  )
}

/** Token selector overlay modal */
function TokenSelectorOverlay({
  tokens,
  selectedSymbol,
  onSelect,
  onClose,
  balances,
}: {
  tokens: TokenInfo[]
  selectedSymbol: string
  onSelect: (token: TokenInfo) => void
  onClose: () => void
  balances: import('@cash/shared').UserBalances | null
}): React.ReactElement {
  const getBalance = useCallback(
    (symbol: string): number | null => {
      if (!balances) return null
      if (symbol === 'CASH') return balances.cash.available
      if (symbol === 'USDC') return balances.usdc.available
      // USD1, USDT, USDe — not tracked by our API yet; show 0 when connected
      return 0
    },
    [balances],
  )

  return (
    <Flex
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={100}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
      }}
    >
      {/* Backdrop */}
      <Flex
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
        }}
        onPress={onClose}
      />
      {/* Modal */}
      <Flex
        backgroundColor="$surface1"
        borderRadius="$rounded16"
        borderWidth={1}
        borderStyle="solid"
        borderColor="$surface3"
        width={360}
        maxHeight={480}
        overflow="hidden"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 101,
        }}
        data-testid="token-selector-modal"
      >
        {/* Header */}
        <Flex row alignItems="center" justifyContent="space-between" padding="$spacing16" borderBottomWidth={1} borderBottomColor="$surface3" borderBottomStyle="solid">
          <Text variant="subheading2" fontWeight="600" color="$neutral1">
            Select a token
          </Text>
          <Flex
            tag="button"
            width={32}
            height={32}
            borderRadius="$rounded8"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            hoverStyle={{ backgroundColor: '$surface2' }}
            onPress={onClose}
          >
            <CloseIcon />
          </Flex>
        </Flex>

        {/* Token list */}
        <Flex overflow="auto" style={{ maxHeight: 400 }}>
          {tokens.map((token) => {
            const isSelected = token.symbol === selectedSymbol
            const balance = getBalance(token.symbol)

            return (
              <Flex
                key={token.symbol}
                tag="button"
                row
                alignItems="center"
                gap="$spacing12"
                padding="$spacing12"
                px="$spacing16"
                cursor={isSelected ? 'not-allowed' : 'pointer'}
                opacity={isSelected ? 0.4 : 1}
                hoverStyle={isSelected ? undefined : { backgroundColor: '$surface2' }}
                onPress={isSelected ? undefined : () => onSelect(token)}
                data-testid={`token-option-${token.symbol}`}
              >
                <Flex
                  width={36}
                  height={36}
                  borderRadius="$roundedFull"
                  alignItems="center"
                  justifyContent="center"
                  style={{ backgroundImage: getGradientCSS(token.gradient) }}
                >
                  <Text variant="body4" fontWeight="600" color="$neutral1">
                    {token.symbol[0]}
                  </Text>
                </Flex>
                <Flex flex={1}>
                  <Text variant="body2" color="$neutral1">
                    {token.name}
                  </Text>
                  <Text variant="body4" color="$neutral3">
                    {token.symbol}
                  </Text>
                </Flex>
                <Text variant="body3" color="$neutral2">
                  {balance !== null ? formatBalance(balance, 4) : '—'}
                </Text>
              </Flex>
            )
          })}
        </Flex>
      </Flex>
    </Flex>
  )
}

// ---------------------------------------------------------------------------
// SVG Icons (inline to avoid lucide-react dependency)
// ---------------------------------------------------------------------------

function ArrowDownUpIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 16 4 4 4-4" />
      <path d="M7 20V4" />
      <path d="m21 8-4-4-4 4" />
      <path d="M17 4v16" />
    </svg>
  )
}

function ChevronDownIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function CloseIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function LoadingSpinner(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(255,255,255,0.38)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: 'spin 1s linear infinite', marginRight: 8 }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
