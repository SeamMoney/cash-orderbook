import type { BottomSheetView } from '@gorhom/bottom-sheet'
import { Currency } from '@uniswap/sdk-core'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flex, ModalCloseIcon, Text, useMedia, useScrollbarStyles, useSporeColors } from 'ui/src'
import { InfoCircleFilled } from 'ui/src/components/icons/InfoCircleFilled'
import { spacing } from 'ui/src/theme'
import PasteButton from 'uniswap/src/components/buttons/PasteButton'
import { useBottomSheetContext } from 'uniswap/src/components/modals/BottomSheetContext'
import { Modal } from 'uniswap/src/components/modals/Modal'
import { CrosschainSwapsPromoBanner } from 'uniswap/src/components/TokenSelector/CrosschainSwapsPromoBanner'
import { useClipboardCheck } from 'uniswap/src/components/TokenSelector/hooks/useClipboardCheck'
import { useTokenSelectionHandler } from 'uniswap/src/components/TokenSelector/hooks/useTokenSelectionHandler'
import { useTokenSelectorList } from 'uniswap/src/components/TokenSelector/hooks/useTokenSelectorList'
import { TokenSelectorFlow, TokenSelectorVariation } from 'uniswap/src/components/TokenSelector/types'
import { UnsupportedChainedActionsBanner } from 'uniswap/src/components/TokenSelector/UnsupportedChainedActionsBanner'
import { flowToModalName } from 'uniswap/src/components/TokenSelector/utils'
import { useUniswapContext } from 'uniswap/src/contexts/UniswapContext'
import { TradeableAsset } from 'uniswap/src/entities/assets'
import type { AddressGroup } from 'uniswap/src/features/accounts/store/types/AccountsState'
import { useEnabledChains } from 'uniswap/src/features/chains/hooks/useEnabledChains'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { useFilterCallbacks } from 'uniswap/src/features/search/SearchModal/hooks/useFilterCallbacks'
import { SearchTextInput } from 'uniswap/src/features/search/SearchTextInput'
import { InterfaceEventName, ModalName, SectionName } from 'uniswap/src/features/telemetry/constants'
import Trace from 'uniswap/src/features/telemetry/Trace'
import { isChainSupportedForChainedActions } from 'uniswap/src/features/transactions/swap/utils/chainedActions'
import { CurrencyField } from 'uniswap/src/types/currency'
import { getClipboard } from 'utilities/src/clipboard/clipboard'
import { dismissNativeKeyboard } from 'utilities/src/device/keyboard/dismissNativeKeyboard'
import { isExtensionApp, isMobileApp, isMobileWeb, isWebApp, isWebPlatform } from 'utilities/src/platform'
import { useDebounce } from 'utilities/src/time/timing'

export const TOKEN_SELECTOR_WEB_MAX_WIDTH = 400
export const TOKEN_SELECTOR_WEB_MAX_HEIGHT = 700

export const SNAP_POINTS = ['65%', '100%']

export interface TokenSelectorProps {
  variation: TokenSelectorVariation
  isModalOpen: boolean
  currencyField: CurrencyField
  flow: TokenSelectorFlow
  addresses: AddressGroup
  chainId?: UniverseChainId
  chainIds?: UniverseChainId[]
  input?: TradeableAsset
  output?: TradeableAsset
  isSurfaceReady?: boolean
  onClose: () => void
  focusHook?: ComponentProps<typeof BottomSheetView>['focusHook']
  onSelectChain?: (chainId: UniverseChainId | null) => void
  onSelectCurrency: ({
    currency,
    field,
    allowCrossChainPair,
    isPreselectedAsset,
  }: {
    currency: Currency
    field: CurrencyField
    allowCrossChainPair: boolean
    isPreselectedAsset: boolean
  }) => void
}


/** Static Aptos chain badge — replaces the EVM chain filter dropdown. */
function AptosChainBadge(): JSX.Element {
  return (
    <Flex
      row
      alignItems="center"
      justifyContent="center"
      backgroundColor="$surface3"
      borderRadius="$roundedFull"
      width={32}
      height={32}
      flexShrink={0}
    >
      <svg width="20" height="20" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M30.6608 171.033C18.0837 197.498 9.30164 226.119 5 256.181H255.339L309.999 171.033H30.6608Z" fill="currentColor"/>
        <path d="M594.999 256.182C590.687 226.111 581.915 197.499 569.338 171.034H419.288L364.648 85.8753H508.549C454.803 33.2026 381.199 0.716797 299.994 0.716797C218.79 0.716797 145.195 33.2026 91.4395 85.8653H364.648L309.988 171.024L364.648 256.172H594.989L594.999 256.182Z" fill="currentColor"/>
        <path d="M146.04 426.5L91.3809 511.648C145.136 564.311 218.601 597.284 299.805 597.284C381.01 597.284 455.718 565.99 509.672 511.648H200.7L146.04 426.5Z" fill="currentColor"/>
        <path d="M200.68 341.331H5C9.31157 371.412 18.0837 400.024 30.6608 426.489H146.04L200.68 341.331Z" fill="currentColor"/>
        <path d="M255.339 426.499H569.339C581.916 400.034 590.698 371.413 595 341.351H309.999L255.339 256.192L200.68 341.341" fill="currentColor"/>
      </svg>
    </Flex>
  )
}

export function TokenSelectorContent({
  currencyField,
  flow,
  variation,
  input,
  output,
  addresses,
  chainId,
  chainIds,
  isSurfaceReady = true,
  onClose,
  onSelectChain,
  onSelectCurrency,
  renderedInModal,
}: Omit<TokenSelectorProps, 'isModalOpen'> & {
  renderedInModal: boolean
}): JSX.Element {
  const { onChangeChainFilter, onChangeText, searchFilter, chainFilter, parsedChainFilter, parsedSearchFilter } =
    useFilterCallbacks(chainId ?? null, flowToModalName(flow))
  const debouncedSearchFilter = useDebounce(searchFilter)
  const debouncedParsedSearchFilter = useDebounce(parsedSearchFilter)
  const scrollbarStyles = useScrollbarStyles()
  const { navigateToBuyOrReceiveWithEmptyWallet } = useUniswapContext()

  const oppositeToken = currencyField === CurrencyField.INPUT ? output : input

  const media = useMedia()
  const isSmallScreen = (media.sm && isWebApp) || isMobileApp || isMobileWeb

  const hasClipboardString = useClipboardCheck()

  const { chains: enabledChains, isTestnetModeEnabled } = useEnabledChains()

  const effectiveChainIds = chainIds ?? enabledChains

  const { t } = useTranslation()

  const { currencyFieldName, onSelectCurrencyCallback } = useTokenSelectionHandler({
    flow,
    currencyField,
    chainFilter,
    oppositeToken,
    debouncedSearchFilter,
    onSelectCurrency,
  })

  const handlePaste = async (): Promise<void> => {
    const clipboardContent = await getClipboard()
    if (clipboardContent) {
      onChangeText(clipboardContent)
    }
  }

  const [searchInFocus, setSearchInFocus] = useState(false)

  const onSendEmptyActionPress = useCallback(() => {
    onClose()
    navigateToBuyOrReceiveWithEmptyWallet?.()
  }, [navigateToBuyOrReceiveWithEmptyWallet, onClose])

  function onCancel(): void {
    setSearchInFocus(false)
  }
  function onFocus(): void {
    if (!isWebPlatform) {
      setSearchInFocus(true)
    }
  }

  const shouldAutoFocusSearch = isWebPlatform && !media.sm

  const shouldShowCrosschainPromoBanner = useMemo(
    () => flow === TokenSelectorFlow.Swap && (!chainFilter || isChainSupportedForChainedActions(chainFilter)),
    [flow, chainFilter],
  )

  const tokenSelector = useTokenSelectorList({
    searchInFocus,
    searchFilter,
    isTestnetModeEnabled,
    variation,
    addresses,
    chainFilter,
    input,
    output,
    renderedInModal,
    onSelectCurrency: onSelectCurrencyCallback,
    onSendEmptyActionPress,
    debouncedParsedSearchFilter,
    debouncedSearchFilter,
    parsedChainFilter,
  })

  return (
    <Trace
      logImpression={isWebApp} // TODO(WEB-5161): Deduplicate shared vs interface-only trace event
      eventOnTrigger={InterfaceEventName.TokenSelectorOpened}
      modal={ModalName.TokenSelectorWeb}
    >
      <Trace logImpression element={currencyFieldName} section={SectionName.TokenSelector}>
        <Flex grow gap="$spacing8" style={scrollbarStyles}>
          {!isSmallScreen && (
            <Flex row justifyContent="space-between" pt="$spacing16" px="$spacing16">
              <Text variant="subheading1">{t('common.selectToken.label')}</Text>
              <ModalCloseIcon onClose={onClose} />
            </Flex>
          )}
          <SearchTextInput
            autoFocus={shouldAutoFocusSearch}
            backgroundColor="$surface2"
            endAdornment={
              <Flex row alignItems="center" gap="$spacing4">
                {hasClipboardString && <PasteButton inline textVariant="buttonLabel3" onPress={handlePaste} />}
                <AptosChainBadge />
              </Flex>
            }
            placeholder={t('tokens.selector.search.placeholder')}
            px="$spacing16"
            py="$none"
            mx={spacing.spacing16}
            my="$spacing4"
            value={searchFilter ?? ''}
            onCancel={isWebPlatform ? undefined : onCancel}
            onChangeText={onChangeText}
            onFocus={onFocus}
          />
          {flow === TokenSelectorFlow.Limit && (
            <Flex
              row
              backgroundColor="$surface2"
              borderRadius="$rounded12"
              gap="$spacing12"
              mx="$spacing8"
              p="$spacing12"
            >
              <InfoCircleFilled color="$neutral2" size="$icon.20" />
              <Text variant="body3">{t('limits.form.disclaimer.mainnet.short')}</Text>
            </Flex>
          )}

          {isSurfaceReady && (
            <Flex grow>
              {shouldShowCrosschainPromoBanner && <CrosschainSwapsPromoBanner />}
              <UnsupportedChainedActionsBanner oppositeToken={oppositeToken} chainFilter={chainFilter ?? undefined} />
              {tokenSelector}
            </Flex>
          )}
        </Flex>
      </Trace>
    </Trace>
  )
}

function TokenSelectorModalContent(props: TokenSelectorProps): JSX.Element {
  const { isModalOpen } = props
  const { isSheetReady } = useBottomSheetContext()

  useEffect(() => {
    if (isModalOpen) {
      // Dismiss native keyboard when opening modal in case it was opened by the current screen.
      dismissNativeKeyboard()
    }
  }, [isModalOpen])

  return <TokenSelectorContent {...props} isSurfaceReady={isSheetReady} renderedInModal={true} />
}

function _TokenSelectorModal(props: TokenSelectorProps): JSX.Element {
  const colors = useSporeColors()
  const { isModalOpen, onClose, focusHook } = props

  return (
    <Modal
      extendOnKeyboardVisible
      fullScreen
      hideKeyboardOnDismiss
      hideKeyboardOnSwipeDown
      renderBehindBottomInset
      backgroundColor={colors.surface1.val}
      isModalOpen={isModalOpen}
      maxWidth={isWebPlatform ? TOKEN_SELECTOR_WEB_MAX_WIDTH : undefined}
      maxHeight={isWebApp ? TOKEN_SELECTOR_WEB_MAX_HEIGHT : undefined}
      name={ModalName.TokenSelector}
      padding="$none"
      snapPoints={SNAP_POINTS}
      height={isWebApp ? '100vh' : undefined}
      focusHook={focusHook}
      onClose={onClose}
    >
      <Flex grow maxHeight="100%" overflow="hidden">
        <TokenSelectorModalContent {...props} />
      </Flex>
    </Modal>
  )
}

export const TokenSelectorModal = memo(_TokenSelectorModal)
