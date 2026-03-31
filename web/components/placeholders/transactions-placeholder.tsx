"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * TransactionsPlaceholder — skeleton for the recent transactions table.
 * Shows table header and shimmer rows.
 * Will be replaced by @tanstack/react-table in a later feature.
 */
export function TransactionsPlaceholder(): React.ReactElement {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Transactions</h3>
        <span className="text-xs text-text-muted">Recent activity</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-5 gap-2 border-b border-border pb-2 text-xs text-text-muted">
        <span>Time</span>
        <span>Type</span>
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Maker</span>
      </div>

      {/* Skeleton rows */}
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={`tx-skel-${i}`}
            className="grid grid-cols-5 gap-2 py-3 items-center"
          >
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-3 w-8 rounded" />
            <Skeleton className="h-3 w-14 rounded ml-auto" />
            <Skeleton className="h-3 w-12 rounded ml-auto" />
            <Skeleton className="h-3 w-16 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
