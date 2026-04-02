"use client";

import { Text, useMedia } from "@tamagui/core";
import { Flex } from "@/components/ui/Flex";
import { useScroll } from "@/hooks/use-scroll";
import { useScrollCompact } from "@/hooks/use-scroll-compact";

// ---------------------------------------------------------------------------
// Constants (mirrors Uniswap's stickyHeader/constants.ts)
// ---------------------------------------------------------------------------

const HEADER_TRANSITION = "all 0.2s ease";

const HEADER_LOGO_SIZE = {
  compact: 40,
  expanded: 56,
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TokenHeaderProps {
  /** Current display price for the condensed sticky header. */
  price?: number | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TokenHeader — displays CASH token icon, name, and ticker.
 *
 * When the user scrolls past the header, a condensed sticky version appears
 * at the top of the viewport with a smaller logo, name, and price display.
 *
 * Matches Uniswap's TokenDetailsHeader + DetailsHeaderContainer pattern.
 */
export function TokenHeader({ price }: TokenHeaderProps): React.ReactElement {
  const media = useMedia();
  const isMobile = media.xl;

  // Scroll-based compact state with hysteresis
  const { height: scrollY } = useScroll();
  const isCompact = useScrollCompact({
    scrollY,
    thresholdCompact: 100,
    thresholdExpanded: 60,
  });

  const logoSize = isCompact
    ? HEADER_LOGO_SIZE.compact
    : HEADER_LOGO_SIZE.expanded;

  return (
    <>
      {/* ── Sticky condensed header (visible when scrolled past threshold) ── */}
      <div
        style={{
          position: "fixed",
          top: 72, // below the 72px navbar
          left: 0,
          right: 0,
          zIndex: 100,
          transform: isCompact ? "translateY(0)" : "translateY(-100%)",
          opacity: isCompact ? 1 : 0,
          transition: "transform 0.2s ease, opacity 0.2s ease",
          pointerEvents: isCompact ? "auto" : "none",
        }}
      >
        <Flex
          width="100%"
          backgroundColor="$surface1"
          borderBottomWidth={1}
          borderBottomColor="$surface3"
          paddingHorizontal={isMobile ? 20 : 40}
          paddingVertical={12}
        >
          <Flex
            row
            alignItems="center"
            gap="$spacing12"
            width="100%"
            maxWidth={1200}
            alignSelf="center"
          >
            {/* Compact logo */}
            <Flex
              width={HEADER_LOGO_SIZE.compact}
              height={HEADER_LOGO_SIZE.compact}
              borderRadius={999999}
              backgroundColor="$accent1"
              alignItems="center"
              justifyContent="center"
              style={{ transition: HEADER_TRANSITION }}
            >
              <Text
                fontFamily="$body"
                fontSize={14}
                fontWeight="700"
                color="$black"
              >
                C
              </Text>
            </Flex>

            {/* Compact name + price */}
            <Text
              fontFamily="$body"
              fontSize={17}
              lineHeight={20}
              fontWeight="485"
              color="$neutral1"
              style={{ transition: HEADER_TRANSITION }}
            >
              CASH
            </Text>

            <Text
              fontFamily="$body"
              fontSize={17}
              lineHeight={20}
              fontWeight="485"
              color="$neutral2"
              style={{ transition: HEADER_TRANSITION }}
            >
              {price != null ? `$${price.toFixed(4)}` : "–"}
            </Text>
          </Flex>
        </Flex>
      </div>

      {/* ── Main (expanded) header ── */}
      <Flex
        row
        alignItems="center"
        gap="$spacing12"
        data-testid="token-header"
        style={{ transition: HEADER_TRANSITION }}
      >
        {/* Token Logo — 56px expanded, 40px when compact */}
        <Flex
          width={logoSize}
          height={logoSize}
          borderRadius={999999}
          backgroundColor="$accent1"
          alignItems="center"
          justifyContent="center"
          style={{ transition: HEADER_TRANSITION }}
        >
          <Text
            fontFamily="$body"
            fontSize={logoSize === 56 ? 18 : 14}
            fontWeight="700"
            color="$black"
          >
            C
          </Text>
        </Flex>

        {/* Name + Symbol group */}
        <Flex row alignItems="center" gap="$spacing12">
          {/* Token name — heading3: 25px/30px */}
          <Text
            tag="h1"
            fontFamily="$heading"
            fontSize={25}
            lineHeight={30}
            fontWeight="485"
            color="$neutral1"
            style={{ transition: HEADER_TRANSITION }}
          >
            CASH
          </Text>

          {/* Token symbol — body2: 17px, neutral2 */}
          <Text
            fontFamily="$body"
            fontSize={17}
            lineHeight={22}
            fontWeight="485"
            color="$neutral2"
            style={{ transition: HEADER_TRANSITION }}
          >
            $CASH
          </Text>
        </Flex>
      </Flex>
    </>
  );
}
