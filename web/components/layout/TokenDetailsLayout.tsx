"use client";

import { styled } from "@tamagui/core";
import { Flex } from "@/components/ui/Flex";

/**
 * SWAP_COMPONENT_WIDTH — matches Uniswap's constant from Skeleton.tsx.
 */
export const SWAP_COMPONENT_WIDTH = 360;

/**
 * TokenDetailsLayout — main two-column layout container.
 *
 * Desktop: row, 80px gap, centered, 40px horizontal padding.
 * Mobile (≤1024px): column, 0 gap, centered, 20px horizontal padding.
 *
 * Matches Uniswap's TokenDetailsLayout from:
 * apps/web/src/pages/TokenDetails/components/skeleton/Skeleton.tsx
 */
export const TokenDetailsLayout = styled(Flex, {
  flexDirection: "row",
  justifyContent: "center",
  width: "100%",
  gap: 80,
  marginTop: 32,
  paddingBottom: 48,
  paddingHorizontal: 40,

  $lg: {
    paddingHorizontal: 20,
  },
  $xl: {
    flexDirection: "column",
    alignItems: "center",
    gap: 0,
  },
});

TokenDetailsLayout.displayName = "TokenDetailsLayout";

/**
 * LeftPanel — fills remaining space, holds main content.
 */
export const LeftPanel = styled(Flex, {
  width: "100%",
  flexGrow: 1,
  flexShrink: 1,
  gap: 24,
});

LeftPanel.displayName = "LeftPanel";

/**
 * RightPanel — fixed 360px width sidebar for the swap widget.
 * On mobile (≤1024px): full width, max 780px.
 */
export const RightPanel = styled(Flex, {
  gap: 40,
  width: SWAP_COMPONENT_WIDTH,

  $xl: {
    width: "100%",
    maxWidth: 780,
  },
});

RightPanel.displayName = "RightPanel";
