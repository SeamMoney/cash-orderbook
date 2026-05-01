/**
 * AptosSwapButton — executes swaps via Panora DEX aggregator on Aptos.
 *
 * Reads the swap form state (input token, output token, typed amount) from the
 * Uniswap swap form store, fetches a real quote from Panora, and submits the
 * transaction via the Aptos wallet adapter.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button, Flex, Text } from 'ui/src'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { toast } from 'sonner'
import { useSwapFormStore } from 'uniswap/src/features/transactions/swap/stores/swapFormStore/useSwapFormStore'
import { getPanoraQuote, getPanoraSwapPayload, type PanoraQuote } from '~/cash/lib/panora'
import { useAptosWalletBalances } from '~/cash/hooks/use-aptos-balances'
import { WalletSelectorModal } from '~/cash/providers/WalletSelectorModal'
import { SwapRouteInfo } from '~/pages/CashTDP/SwapRouteInfo'

/** Aptos address of the CASH token */
const CASH_ADDRESS = '0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1'

/** Map token addresses to Panora symbols */
const ADDRESS_TO_SYMBOL: Record<string, string> = {
  [CASH_ADDRESS.toLowerCase()]: 'CASH',
  '0x05fabd1b12e39967a3c24e91b7b8f67719a6dacee74f3c8b9fb7d93e855437d2': 'USD1',
  '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b': 'USDC',
  '0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b': 'USDt',
  '0xf37a8864fe737eb8ec2c2931047047cbaed1beed3fb0e5b7c5526dafd3b9c2e9': 'USDe',
}

export function AptosSwapButton(): JSX.Element {
  const { connected, account, signAndSubmitTransaction } = useWallet()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // On the /swap and /limit hero pages, the form is QUOTE-ONLY. Clicking the
  // button redirects to /cash with the input prefilled. /cash is where the
  // actual swap is executed.
  const isQuoteOnly = pathname === '/swap' || pathname === '/limit'
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false)
  const [isSwapping, setIsSwapping] = useState(false)
  const [quote, setQuote] = useState<PanoraQuote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const walletAddress = connected && account?.address ? account.address.toString() : undefined
  const aptosBalances = useAptosWalletBalances(walletAddress)

  // Read the form state from the Uniswap swap widget
  const { exactAmountToken, input, output } = useSwapFormStore((s) => ({
    exactAmountToken: s.exactAmountToken,
    input: s.input,
    output: s.output,
  }))

  const inputAddress = input?.address?.toLowerCase() ?? ''
  const outputAddress = output?.address?.toLowerCase() ?? ''
  const fromSymbol = ADDRESS_TO_SYMBOL[inputAddress] ?? null
  const toSymbol = ADDRESS_TO_SYMBOL[outputAddress] ?? null
  const amount = parseFloat(exactAmountToken ?? '')
  const isValidAmount = !isNaN(amount) && amount > 0

  // Check if user has enough balance for the input token
  const inputBalance = fromSymbol ? (aptosBalances.bySymbol.get(fromSymbol) ?? 0) : 0
  const hasInsufficientFunds = connected && isValidAmount && inputBalance < amount

  // Fetch Panora quote with debounce
  useEffect(() => {
    setQuote(null)
    setQuoteError(null)

    if (!fromSymbol || !toSymbol || !isValidAmount || fromSymbol === toSymbol) {
      return
    }

    setQuoteLoading(true)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const q = await getPanoraQuote(fromSymbol, toSymbol, amount, 1)
        setQuote(q)
        setQuoteError(null)
      } catch (err) {
        setQuote(null)
        setQuoteError(err instanceof Error ? err.message : 'Quote failed')
      } finally {
        setQuoteLoading(false)
      }
    }, 500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [fromSymbol, toSymbol, amount, isValidAmount])

  // Button state machine
  type BtnState = { label: string; disabled: boolean; isConnect: boolean; isInsufficient: boolean; isGetStarted: boolean }

  const getButtonState = (): BtnState => {
    // Quote-only mode (/swap, /limit hero pages): always show "Get started" — clicking redirects to /cash
    if (isQuoteOnly) {
      return { label: 'Get started', disabled: false, isConnect: false, isInsufficient: false, isGetStarted: true }
    }

    if (!connected) return { label: 'Get started', disabled: false, isConnect: true, isInsufficient: false, isGetStarted: true }
    if (!fromSymbol || !toSymbol) return { label: 'Get started', disabled: true, isConnect: false, isInsufficient: false, isGetStarted: true }
    if (!isValidAmount) return { label: 'Enter an amount', disabled: true, isConnect: false, isInsufficient: false, isGetStarted: false }
    if (quoteLoading) return { label: 'Fetching quote...', disabled: true, isConnect: false, isInsufficient: false, isGetStarted: false }
    if (quoteError) return { label: 'No route available', disabled: true, isConnect: false, isInsufficient: false, isGetStarted: false }
    if (!quote || quote.outputAmount <= 0) return { label: 'Insufficient liquidity', disabled: true, isConnect: false, isInsufficient: false, isGetStarted: false }
    if (hasInsufficientFunds) return { label: 'Add funds to swap', disabled: true, isConnect: false, isInsufficient: true, isGetStarted: false }
    if (isSwapping) return { label: 'Swapping...', disabled: true, isConnect: false, isInsufficient: false, isGetStarted: false }
    return { label: 'Swap', disabled: false, isConnect: false, isInsufficient: false, isGetStarted: false }
  }

  const btnState = getButtonState()

  // Swap execution via Panora
  const handleSwap = useCallback(async (): Promise<void> => {
    if (!connected || !account || !signAndSubmitTransaction) {
      setWalletSelectorOpen(true)
      return
    }
    if (!fromSymbol || !toSymbol || !isValidAmount || !quote) return

    setIsSwapping(true)
    try {
      const txData = await getPanoraSwapPayload(
        fromSymbol,
        toSymbol,
        amount,
        1,
        account.address.toString(),
      ) as any

      if (!txData) {
        throw new Error('No transaction payload returned from Panora')
      }

      // Panora returns { function, type_arguments, arguments } — pass as entry function payload
      const response = await signAndSubmitTransaction({
        data: {
          function: txData.function,
          typeArguments: txData.type_arguments ?? [],
          functionArguments: txData.arguments ?? [],
        },
      })
      const txHash =
        typeof response === 'object' && response !== null && 'hash' in response
          ? (response as { hash: string }).hash
          : String(response)
      toast.success('Swap submitted', {
        description: `Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
        duration: 6000,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transaction failed'
      toast.error('Swap failed', { description: message, duration: 8000 })
    } finally {
      setIsSwapping(false)
    }
  }, [connected, account, signAndSubmitTransaction, fromSymbol, toSymbol, isValidAmount, quote, amount])

  return (
    <Flex gap="$spacing8">
      <Flex row alignSelf="stretch">
        <Button
          variant={btnState.isInsufficient ? 'default' : 'branded'}
          emphasis={btnState.isInsufficient ? 'secondary' : 'primary'}
          size="large"
          isDisabled={btnState.disabled}
          // Match the exact CASH_GREEN used by the SelectTokenButton pill
          backgroundColor={btnState.isInsufficient ? undefined : '#00D54B'}
          hoverStyle={btnState.isInsufficient ? undefined : { backgroundColor: '#00C144' }}
          pressStyle={btnState.isInsufficient ? undefined : { backgroundColor: '#00B33D' }}
          onPress={
            isQuoteOnly
              ? () => {
                  // Redirect to /cash with the input prefilled in URL params
                  const params = new URLSearchParams()
                  if (fromSymbol) params.set('inputCurrency', fromSymbol)
                  if (toSymbol) params.set('outputCurrency', toSymbol)
                  if (isValidAmount) params.set('amount', String(amount))
                  navigate(`/cash${params.toString() ? `?${params.toString()}` : ''}`)
                }
              : btnState.isConnect
                ? () => setWalletSelectorOpen(true)
                : handleSwap
          }
          flexGrow={1}
        >
          {btnState.isInsufficient ? (
            <Text color="$statusCritical">{btnState.label}</Text>
          ) : (
            <Text color="$white" variant="buttonLabel2">{btnState.label}</Text>
          )}
        </Button>
      </Flex>

      {/* Rate + route info footer (matches Uniswap footer layout) */}
      {quote && isValidAmount && fromSymbol && toSymbol && (
        <SwapRouteInfo quote={quote} fromSymbol={fromSymbol} toSymbol={toSymbol} />
      )}

      <WalletSelectorModal isOpen={walletSelectorOpen} onClose={() => setWalletSelectorOpen(false)} />
    </Flex>
  )
}
