/**
 * CASH token description section — renders the About section with CASH-specific
 * contract address pill, explorer link (Aptos), and project links.
 *
 * Custom override of the Uniswap TokenDescription component because the default
 * uses `shortenAddress` which only supports EVM/SVM addresses, not Aptos addresses.
 */

import { useCallback, useReducer } from 'react'
import { AnimatableCopyIcon, Flex, Text, TouchableArea } from 'ui/src'
import { GlobeFilled } from 'ui/src/components/icons/GlobeFilled'
import { BlockExplorer } from 'ui/src/components/icons/BlockExplorer'
import { XTwitter } from 'ui/src/components/icons/XTwitter'
import { iconSizes } from 'ui/src/theme'
import useCopyClipboard from '~/hooks/useCopyClipboard'
import { useTDPStore } from '~/pages/TokenDetails/context/useTDPStore'
import { EllipsisTamaguiStyle } from '~/theme/components/styles'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRUNCATE_CHARACTER_COUNT = 300

const APTOS_EXPLORER_BASE = 'https://explorer.aptoslabs.com/account'
const APTOS_NETWORK_PARAM = '?network=testnet'

// ---------------------------------------------------------------------------
// Pill button
// ---------------------------------------------------------------------------

const tokenPillStyles = {
  row: true,
  alignItems: 'center' as const,
  gap: '$gap8' as const,
  px: '$spacing12' as const,
  py: '$spacing8' as const,
  borderRadius: '$roundedFull' as const,
  backgroundColor: '$surface2' as const,
  hoverStyle: { backgroundColor: '$surface2Hovered' } as const,
}

function TokenLinkButton({ uri, icon, name }: { uri: string; icon: JSX.Element; name: string }) {
  return (
    <TouchableArea
      tag="a"
      role="link"
      href={uri}
      target="_blank"
      rel="noopener noreferrer"
      {...tokenPillStyles}
      $platform-web={{ textDecorationLine: 'none' }}
    >
      {icon}
      <Text variant="buttonLabel3" color="$neutral1">
        {name}
      </Text>
    </TouchableArea>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortenAptosAddress(address: string): string {
  if (!address || address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function truncateDescription(desc: string, maxCharacterCount = TRUNCATE_CHARACTER_COUNT) {
  let truncated = desc.slice(0, maxCharacterCount)
  truncated = `${truncated.slice(0, Math.min(truncated.length, truncated.lastIndexOf(' ')))}...`
  return truncated
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CashTokenDescription() {
  const { address, tokenQuery } = useTDPStore((s) => ({
    address: s.address,
    tokenQuery: s.tokenQuery,
  }))

  const { description, homepageUrl, twitterName } = tokenQuery.data?.token?.project ?? {}

  const [isCopied, setCopied] = useCopyClipboard()
  const copy = useCallback(() => {
    setCopied(address)
  }, [address, setCopied])

  const [isDescriptionTruncated, toggleIsDescriptionTruncated] = useReducer((x) => !x, true)
  const truncatedDescription = truncateDescription(description ?? '', TRUNCATE_CHARACTER_COUNT)
  const shouldTruncate = !!description && description.length > TRUNCATE_CHARACTER_COUNT
  const showTruncatedDescription = shouldTruncate && isDescriptionTruncated

  // Aptos explorer link
  const explorerUrl = `${APTOS_EXPLORER_BASE}/${address}${APTOS_NETWORK_PARAM}`

  return (
    <Flex data-testid="token-details-about-section" gap="$gap20" width="100%" $md={{ gap: '$gap16' }}>
      <Text variant="heading3">About</Text>
      <Flex maxWidth="100%" maxHeight="fit-content" {...EllipsisTamaguiStyle} whiteSpace="pre-wrap">
        {!description && (
          <Text variant="body2" color="$neutral3">
            No token information available
          </Text>
        )}
        {description && (
          <Text tag="h2" variant="body2" color="$neutral2" whiteSpace="normal">
            {!showTruncatedDescription ? (
              <span data-testid="token-details-description-full">{description}</span>
            ) : (
              <span data-testid="token-details-description-truncated">{truncatedDescription}</span>
            )}
          </Text>
        )}
        {shouldTruncate && (
          <TouchableArea
            onPress={toggleIsDescriptionTruncated}
            data-testid="token-description-show-more-button"
            display="inline"
          >
            <Text display="inline" variant="buttonLabel2" ml="$spacing8" textWrap="nowrap">
              {isDescriptionTruncated ? 'Show more' : 'Hide'}
            </Text>
          </TouchableArea>
        )}
      </Flex>
      <Flex row flexWrap="wrap" gap="$gap12" width="100%" data-testid="token-details-about-links">
        {/* Contract address pill with copy */}
        <TouchableArea onPress={copy} {...tokenPillStyles}>
          <AnimatableCopyIcon isCopied={isCopied} size={iconSizes.icon16} textColor="$neutral1" />
          <Text variant="buttonLabel3" color="$neutral1">
            {shortenAptosAddress(address)}
          </Text>
        </TouchableArea>

        {/* Aptos Explorer link */}
        <TokenLinkButton
          uri={explorerUrl}
          icon={<BlockExplorer size="$icon.16" color="$neutral1" />}
          name="Aptos Explorer"
        />

        {/* Website */}
        {homepageUrl && (
          <TokenLinkButton
            uri={homepageUrl}
            icon={<GlobeFilled size="$icon.16" color="$neutral1" />}
            name="Website"
          />
        )}

        {/* Twitter */}
        {twitterName && (
          <TokenLinkButton
            uri={`https://x.com/${twitterName}`}
            icon={<XTwitter size="$icon.16" color="$neutral1" />}
            name="Twitter"
          />
        )}
      </Flex>
    </Flex>
  )
}
