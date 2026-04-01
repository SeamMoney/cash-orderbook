"use client";

import { GetProps, styled, View } from "@tamagui/core";

/**
 * Flex — a styled Tamagui View defaulting to flexDirection: 'column'.
 * Matches Uniswap's Flex component from ui/src/components/layout/Flex.tsx.
 */
export const Flex = styled(View, {
  flexDirection: "column",

  variants: {
    row: {
      true: {
        flexDirection: "row",
      },
      false: {
        flexDirection: "column",
      },
    },

    shrink: {
      true: {
        flexShrink: 1,
      },
    },

    grow: {
      true: {
        flexGrow: 1,
      },
    },

    fill: {
      true: {
        flex: 1,
      },
    },

    centered: {
      true: {
        alignItems: "center",
        justifyContent: "center",
      },
    },
  } as const,
});

Flex.displayName = "Flex";

export type FlexProps = GetProps<typeof Flex>;
