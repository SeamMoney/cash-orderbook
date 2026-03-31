"use client";

import { ArrowDownUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * SwapPlaceholder — skeleton for the swap widget card.
 * Shows the card structure with "You pay" / "You receive" inputs,
 * direction toggle, and CTA button placeholder.
 * Will be replaced by the full SwapWidget in a later feature.
 */
export function SwapPlaceholder(): React.ReactElement {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {/* Swap / Limit tabs */}
      <div className="mb-4 flex items-center gap-1 rounded-full bg-background p-1">
        <button className="flex-1 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-white">
          Swap
        </button>
        <button className="flex-1 rounded-full px-4 py-1.5 text-sm font-medium text-text-muted">
          Limit
        </button>
      </div>

      {/* You pay */}
      <div className="rounded-xl bg-background border border-border p-4 mb-1">
        <p className="text-xs text-text-muted mb-2">You pay</p>
        <div className="flex items-center justify-between">
          <span className="font-mono text-2xl text-text-muted">0</span>
          <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
            <div className="h-5 w-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600" />
            <span className="text-sm font-medium text-white">CASH</span>
          </div>
        </div>
        <div className="mt-1">
          <Skeleton className="h-3 w-12 rounded" />
        </div>
      </div>

      {/* Direction toggle */}
      <div className="flex justify-center -my-3 relative z-10">
        <button className="rounded-xl border border-border bg-card p-2 text-text-muted hover:text-white hover:border-surface-hover transition-colors">
          <ArrowDownUp className="h-4 w-4" />
        </button>
      </div>

      {/* You receive */}
      <div className="rounded-xl bg-background border border-border p-4 mt-1">
        <p className="text-xs text-text-muted mb-2">You receive</p>
        <div className="flex items-center justify-between">
          <span className="font-mono text-2xl text-text-muted">0</span>
          <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
            <div className="h-5 w-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600" />
            <span className="text-sm font-medium text-white">USDC</span>
          </div>
        </div>
        <div className="mt-1">
          <Skeleton className="h-3 w-12 rounded" />
        </div>
      </div>

      {/* CTA Button */}
      <button
        disabled
        className="mt-4 w-full rounded-2xl bg-primary py-3 text-base font-semibold text-primary-foreground opacity-50 cursor-not-allowed transition-opacity"
      >
        Connect Wallet
      </button>
    </div>
  );
}
