"use client";

import { Text } from "@tamagui/core";
import { Flex } from "@/components/ui/Flex";
import { Skeleton } from "@/components/ui/skeleton";
import type { MarketData } from "@/hooks/use-market";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format large numbers with K, M, B suffixes. */
function formatCompact(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// StatItem — a single stat with label + value, matching Uniswap StatWrapper
// ---------------------------------------------------------------------------

interface StatItemProps {
  label: string;
  value: string | null;
  loading: boolean;
}

/**
 * A single stat item displayed as a column: label on top, value below.
 * Matches Uniswap's StatWrapper pattern:
 * - flex: 1 1 calc(50% - 20px) → 2-column layout with gap
 * - gap $spacing4 between label and value
 * - borderBottomWidth 0.5, borderBottomColor $surface3
 * - paddingBottom $spacing16
 */
function StatItem({ label, value, loading }: StatItemProps): React.ReactElement {
  return (
    <Flex
      gap="$spacing4"
      borderBottomWidth={0.5}
      borderBottomColor="$surface3"
      paddingBottom="$spacing16"
      style={{ flex: "1 1 calc(50% - 20px)" }}
      data-testid={`stat-item-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {/* Stat label — body3: 15px, neutral2 */}
      <Text
        fontFamily="$body"
        fontSize={15}
        lineHeight={19.5}
        fontWeight="485"
        color="$neutral2"
        data-testid="stat-label"
      >
        {label}
      </Text>

      {/* Stat value — heading3: 25px/30px, neutral1 */}
      {loading ? (
        <Skeleton className="h-7 w-24 rounded-md" />
      ) : (
        <Text
          fontFamily="$heading"
          fontSize={25}
          lineHeight={30}
          fontWeight="485"
          color="$neutral1"
          data-testid="stat-value"
        >
          {value ?? "--"}
        </Text>
      )}
    </Flex>
  );
}

// ---------------------------------------------------------------------------
// TokenStatsGrid — the full stats section
// ---------------------------------------------------------------------------

interface TokenStatsGridProps {
  /** Market data from the /market endpoint. */
  market: MarketData | null;
  /** Whether market data is still loading. */
  loading: boolean;
}

/**
 * TokenStatsGrid — displays Market Cap, 24h Volume, FDV, and Total Supply.
 *
 * Matches Uniswap's StatsSection:
 * - Section heading: heading3 (25px/30px), neutral1
 * - StatsWrapper: Flex row, flexWrap wrap, gap $spacing20, width 100%
 * - Each StatWrapper: Flex column, 2-column layout with surface3 bottom border
 *
 * Data is sourced from the REST API /market endpoint.
 */
export function TokenStatsGrid({
  market,
  loading,
}: TokenStatsGridProps): React.ReactElement {
  const volume24h =
    market && market.volume24h > 0
      ? formatCompact(market.volume24h)
      : market
        ? "$0.00"
        : null;

  // Market cap is not available from the API, show as -- placeholder
  const marketCap: string | null = null;

  // FDV is not available, always show --
  const fdv: string | null = null;

  // Total supply is not available from the API, show as -- placeholder
  const totalSupply: string | null = null;

  return (
    <Flex data-testid="stats-section">
      {/* Section heading — heading3: 25px/30px, neutral1 */}
      <Text
        tag="h3"
        fontFamily="$heading"
        fontSize={25}
        lineHeight={30}
        fontWeight="485"
        color="$neutral1"
        paddingTop="$spacing24"
        paddingBottom="$spacing4"
        data-testid="stats-heading"
      >
        Stats
      </Text>

      {/* StatsWrapper — Flex row, flexWrap wrap, gap $spacing20, width 100% */}
      <Flex
        row
        flexWrap="wrap"
        gap="$gap20"
        width="100%"
        data-testid="stats-wrapper"
      >
        <StatItem label="Market cap" value={marketCap} loading={loading} />
        <StatItem label="24H volume" value={volume24h} loading={loading} />
        <StatItem label="FDV" value={fdv} loading={loading} />
        <StatItem label="Total supply" value={totalSupply} loading={loading} />
      </Flex>
    </Flex>
  );
}
