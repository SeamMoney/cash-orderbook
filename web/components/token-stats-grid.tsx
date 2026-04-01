"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { MarketData } from "@/hooks/use-market";

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

interface StatItemProps {
  label: string;
  value: string | null;
  loading: boolean;
}

/** A single stat item with label on left, value on right (row layout). */
function StatItem({ label, value, loading }: StatItemProps): React.ReactElement {
  return (
    <div className="flex flex-row items-center justify-between w-[calc(50%-10px)] border-b border-white/12 pb-4">
      <p className="text-[17px] font-medium text-white/65">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-24 rounded-md" />
      ) : (
        <p className="font-sans text-[25px] leading-[30px] font-medium text-white">
          {value ?? "--"}
        </p>
      )}
    </div>
  );
}

interface TokenStatsGridProps {
  /** Market data from the /market endpoint. */
  market: MarketData | null;
  /** Whether market data is still loading. */
  loading: boolean;
}

/**
 * TokenStatsGrid — displays Market Cap, 24h Volume, FDV, and Total Supply.
 * Data is sourced from the REST API /market endpoint.
 * FDV is a placeholder (--) since the API doesn't provide it.
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
    <div>
      <h3 className="text-[25px] leading-[30px] font-medium text-white mb-4">Stats</h3>
      <div className="flex flex-wrap gap-5">
        <StatItem label="Market cap" value={marketCap} loading={loading} />
        <StatItem label="24H volume" value={volume24h} loading={loading} />
        <StatItem label="FDV" value={fdv} loading={loading} />
        <StatItem label="Total supply" value={totalSupply} loading={loading} />
      </div>
    </div>
  );
}
