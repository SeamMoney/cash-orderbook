"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * ChartPlaceholder — skeleton placeholder for the price chart area.
 * Will be replaced with a lightweight-charts LineChart in a later feature.
 */
export function ChartPlaceholder(): React.ReactElement {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      {/* Time range tabs placeholder */}
      <div className="mb-4 flex items-center gap-2">
        {["1H", "1D", "1W", "1M", "1Y"].map((range) => (
          <div
            key={range}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              range === "1D"
                ? "bg-secondary text-white"
                : "text-text-muted hover:text-muted-foreground cursor-pointer"
            }`}
          >
            {range}
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="relative h-[300px] w-full overflow-hidden rounded-lg">
        <Skeleton className="h-full w-full" />
        {/* Faux chart line overlay for visual context */}
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-text-muted">Chart loading...</p>
        </div>
      </div>
    </div>
  );
}
