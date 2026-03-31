"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * TokenHeader — displays CASH token icon, name, ticker, live price, and 24h change.
 * Skeleton/placeholder for now — will be wired to API in later feature.
 */
export function TokenHeader(): React.ReactElement {
  return (
    <div className="flex items-center gap-4">
      {/* Token Icon */}
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00D54B]">
        <span className="text-sm font-bold text-black">C</span>
      </div>

      {/* Token Name / Ticker */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          CASH
        </h1>
        <span className="text-sm font-medium text-[#888888]">$CASH</span>
      </div>

      {/* Price + Change — skeleton placeholders for now */}
      <div className="ml-auto flex items-center gap-3">
        <Skeleton className="h-7 w-24 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
    </div>
  );
}
