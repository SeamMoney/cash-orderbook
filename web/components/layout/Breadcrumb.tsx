"use client";

import { Text, useTheme } from "@tamagui/core";
import { ChevronRight } from "lucide-react";
import { Flex } from "@/components/ui/Flex";

/**
 * Breadcrumb — navigation trail above the token header.
 *
 * Uses Tamagui Flex with gap $spacing4, ChevronRight SVG separator (lucide-react, 16px),
 * Text body3 (15px) with neutral2 color, active item neutral1.
 *
 * Matches Uniswap's BreadcrumbNavContainer + BreadcrumbNavLink pattern.
 */
export function Breadcrumb(): React.ReactElement {
  const theme = useTheme();
  return (
    <Flex
      row
      alignItems="center"
      gap={4}
      marginBottom={20}
      tag="nav"
      aria-label="breadcrumb"
    >
      <Text
        fontFamily="$body"
        fontSize={15}
        lineHeight={19.5}
        color="$neutral2"
        cursor="pointer"
        hoverStyle={{ color: "$neutral2Hovered" }}
      >
        Tokens
      </Text>
      <ChevronRight size={16} color={theme.neutral3.val} />
      <Text
        fontFamily="$body"
        fontSize={15}
        lineHeight={19.5}
        color="$neutral1"
      >
        CASH
      </Text>
    </Flex>
  );
}
