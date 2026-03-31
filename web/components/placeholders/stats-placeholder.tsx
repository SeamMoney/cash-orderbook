"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * StatsPlaceholder — skeleton for the token stats grid.
 * Shows Market Cap, 24h Volume, FDV, and Total Supply placeholders.
 */
export function StatsPlaceholder(): React.ReactElement {
  const stats = [
    { label: "Market cap", value: null },
    { label: "24H volume", value: null },
    { label: "FDV", value: null },
    { label: "Total supply", value: null },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-[#1A1A1A] bg-[#111111] p-4"
        >
          <p className="text-xs text-[#555555] mb-2">{stat.label}</p>
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}
