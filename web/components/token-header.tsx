"use client";

/**
 * TokenHeader — displays CASH token icon, name, and ticker.
 * Price display has been relocated to the chart section (PriceChart component).
 */
export function TokenHeader(): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      {/* Token Icon */}
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary">
        <span className="text-lg font-bold text-black">C</span>
      </div>

      <div className="flex items-center gap-3">
        <h1 className="text-[25px] leading-[30px] font-medium tracking-tight text-white">
          CASH
        </h1>
        <span className="text-[17px] font-medium text-muted-foreground">$CASH</span>
      </div>
    </div>
  );
}
