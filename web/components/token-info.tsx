"use client";

import { useState, useCallback } from "react";
import { Copy, Check, ExternalLink, Globe } from "lucide-react";
import { Text, useTheme } from "@tamagui/core";
import { Flex } from "@/components/ui/Flex";
import { CONTRACT_ADDRESS } from "@/lib/sdk";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPLORER_BASE = "https://explorer.aptoslabs.com/account";
const NETWORK_PARAM = "?network=mainnet";
const WEBSITE_URL = "https://github.com/nicholasgasior/cash-orderbook";

const TOKEN_DESCRIPTION =
  "CASH is a token on the Aptos blockchain powering the CASH Orderbook, a high-performance Central Limit Order Book (CLOB) for zero-slippage trading. Built on Aptos' parallel execution engine (Block-STM), the CASH Orderbook delivers sub-second finality and throughput exceeding 100,000 transactions per second, enabling institutional-grade trading with price-time priority matching, maker/taker fee tiers, and full on-chain settlement via the FungibleAsset standard.";

const TRUNCATE_CHARACTER_COUNT = 300;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate to TRUNCATE_CHARACTER_COUNT, re-trimming at the last word boundary. */
function truncateDescription(
  desc: string,
  maxCharacterCount = TRUNCATE_CHARACTER_COUNT
): string {
  let truncated = desc.slice(0, maxCharacterCount);
  // Re-trim at last word boundary for cleanliness
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 0) {
    truncated = truncated.slice(0, lastSpace);
  }
  return `${truncated}...`;
}

// ---------------------------------------------------------------------------
// LinkPill — a single external-link pill matching Uniswap's TokenLinkButton
// ---------------------------------------------------------------------------

interface LinkPillProps {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  /** If true, show a success state (e.g. after copy). */
  success?: boolean;
}

/**
 * LinkPill — pressable pill with icon + label.
 *
 * Spec (from feature description & ABOUT-004):
 * - surface2 bg (#1F1F1F), surface2Hovered (#242424) on hover
 * - borderRadius: $rounded20 (20px)
 * - paddingHorizontal: $spacing12, paddingVertical: $spacing8
 * - gap: $spacing8
 * - Icon: 16px
 * - Text: body2 (17px), neutral2 color, hover neutral1
 */
function LinkPill({
  icon,
  label,
  href,
  onClick,
  success,
}: LinkPillProps): React.ReactElement {
  const isLink = !!href;
  const Tag = isLink ? "a" : "button";

  const linkProps = isLink
    ? { href, target: "_blank", rel: "noopener noreferrer" }
    : { type: "button" as const, onClick };

  return (
    <Flex
      tag={Tag}
      row
      alignItems="center"
      gap="$spacing8"
      backgroundColor="$surface2"
      borderRadius="$rounded20"
      paddingHorizontal="$spacing12"
      paddingVertical="$spacing8"
      hoverStyle={{ backgroundColor: "$surface2Hovered" }}
      cursor="pointer"
      data-testid="link-pill"
      style={{ textDecoration: "none" }}
      {...linkProps}
    >
      {icon}
      <Text
        fontFamily="$body"
        fontSize={17}
        lineHeight={22.1}
        fontWeight="485"
        color={success ? "$statusSuccess" : "$neutral2"}
        hoverStyle={{ color: "$neutral1" }}
        data-testid="pill-text"
      >
        {label}
      </Text>
    </Flex>
  );
}

// ---------------------------------------------------------------------------
// TokenInfo — About section
// ---------------------------------------------------------------------------

/**
 * TokenInfo — About section with token description, contract address pill,
 * and link pills for Explorer and Website.
 *
 * Matches Uniswap's TokenDescription component:
 * - Section heading: heading3 (25px/30px), neutral1
 * - Description: body1 (19px), neutral1, lineHeight 24px
 * - 300-char truncation with Show more / Show less toggle
 * - Link pills row: Flex row, gap $spacing8, flexWrap wrap
 */
export function TokenInfo(): React.ReactElement {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments where clipboard API is not available
      const textArea = document.createElement("textarea");
      textArea.value = CONTRACT_ADDRESS;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const truncatedAddress =
    CONTRACT_ADDRESS.length > 12
      ? `${CONTRACT_ADDRESS.slice(0, 6)}...${CONTRACT_ADDRESS.slice(-4)}`
      : CONTRACT_ADDRESS;

  const explorerUrl = `${EXPLORER_BASE}/${CONTRACT_ADDRESS}${NETWORK_PARAM}`;

  const shouldTruncate = TOKEN_DESCRIPTION.length > TRUNCATE_CHARACTER_COUNT;
  const displayDescription =
    shouldTruncate && !expanded
      ? truncateDescription(TOKEN_DESCRIPTION)
      : TOKEN_DESCRIPTION;

  return (
    <Flex gap="$gap20" width="100%" data-testid="about-section">
      {/* Section heading — heading3: 25px/30px, neutral1 */}
      <Text
        tag="h3"
        fontFamily="$heading"
        fontSize={25}
        lineHeight={30}
        fontWeight="485"
        color="$neutral1"
        data-testid="about-heading"
      >
        About
      </Text>

      {/* Description — body1: 19px, neutral1 (white), lineHeight 24px */}
      <Text
        fontFamily="$body"
        fontSize={19}
        lineHeight={24}
        fontWeight="485"
        color="$neutral1"
        maxWidth="100%"
        whiteSpace="pre-wrap"
        data-testid="about-description"
      >
        {displayDescription}
        {shouldTruncate && (
          <>
            {" "}
            <Text
              tag="button"
              fontFamily="$body"
              fontSize={17}
              lineHeight={22.1}
              fontWeight="485"
              color="$neutral2"
              hoverStyle={{ color: "$neutral1" }}
              cursor="pointer"
              onPress={() => setExpanded((prev) => !prev)}
              data-testid="show-more-toggle"
              display="inline"
              style={{
                background: "none",
                border: "none",
                padding: 0,
              }}
            >
              {expanded ? "Show less" : "Show more"}
            </Text>
          </>
        )}
      </Text>

      {/* Link pills row — Flex row, gap $spacing8, flexWrap wrap */}
      <Flex
        row
        flexWrap="wrap"
        gap="$gap8"
        width="100%"
        data-testid="link-pills-row"
      >
        {/* Contract address pill with copy */}
        <LinkPill
          icon={
            copied ? (
              <Check size={16} color={theme.statusSuccess?.val as string} />
            ) : (
              <Copy size={16} color={theme.neutral2?.val as string} />
            )
          }
          label={copied ? "Copied!" : truncatedAddress}
          onClick={handleCopy}
          success={copied}
        />

        {/* Explorer pill */}
        <LinkPill
          icon={
            <ExternalLink size={16} color={theme.neutral2?.val as string} />
          }
          label="Explorer"
          href={explorerUrl}
        />

        {/* Website pill */}
        <LinkPill
          icon={<Globe size={16} color={theme.neutral2?.val as string} />}
          label="Website"
          href={WEBSITE_URL}
        />
      </Flex>
    </Flex>
  );
}
