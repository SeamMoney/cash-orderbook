"use client";

/**
 * TokenHeader — displays CASH token icon, name, and ticker.
 * Price display has been relocated to the chart section (PriceChart component).
 */
export function TokenHeader(): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      {/* Token Icon */}
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
        <span className="text-sm font-bold text-black">C</span>
      </div>

      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight text-white">
          CASH
        </h1>
        <span className="text-sm font-medium text-muted-foreground">$CASH</span>
      </div>
    </div>
  );
}
