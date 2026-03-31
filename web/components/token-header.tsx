"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBalance } from "@/lib/utils";
import type { PriceFlashDirection } from "@/hooks/use-realtime-price";

interface TokenHeaderProps {
  /** Current price to display (from API or chart hover). */
  price: number | null;
  /** 24h price change percentage. Positive = green, negative = red. */
  change24h: number | null;
  /** Whether market data is still loading. */
  loading: boolean;
  /** Optional: the date/time label shown when hovering the chart. */
  hoverTimestamp?: string | null;
  /** Optional: flash direction for price change animation ("up" = green, "down" = red). */
  flashDirection?: PriceFlashDirection;
}

/**
 * TokenHeader — displays CASH token icon, name, ticker, live price, and 24h change.
 * When hovering the chart, the price updates to the hovered value and a timestamp is shown.
 * When a WebSocket trade arrives, flashes green (price up) or red (price down).
 */
export function TokenHeader({
  price,
  change24h,
  loading,
  hoverTimestamp,
  flashDirection,
}: TokenHeaderProps): React.ReactElement {
  const isPositive = change24h !== null && change24h >= 0;
  const changeColor = isPositive ? "text-cash-green" : "text-cash-red";
  const changePrefix = isPositive ? "+" : "";

  // Manage flash CSS class on price element
  const priceRef = useRef<HTMLSpanElement>(null);
  const [flashClass, setFlashClass] = useState("");

  const applyFlash = useCallback((direction: PriceFlashDirection): void => {
    if (!direction) {
      setFlashClass("");
      return;
    }
    // Remove any existing flash class, then re-apply after a frame
    // to restart the CSS animation
    setFlashClass("");
    requestAnimationFrame(() => {
      setFlashClass(direction === "up" ? "animate-flash-green" : "animate-flash-red");
    });
  }, []);

  useEffect(() => {
    applyFlash(flashDirection ?? null);
  }, [flashDirection, applyFlash]);

  return (
    <div className="flex flex-col gap-1">
      {/* Top row: icon + name + ticker */}
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

      {/* Price + Change row */}
      <div className="flex items-baseline gap-3">
        {loading ? (
          <>
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </>
        ) : (
          <>
            <span
              ref={priceRef}
              className={`font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white rounded-md px-1 -mx-1 ${flashClass}`}
            >
              {price !== null
                ? `$${formatBalance(price, price < 1 ? 6 : 2)}`
                : "$--"}
            </span>
            {change24h !== null && !hoverTimestamp ? (
              <span className={`font-mono text-sm font-medium ${changeColor}`}>
                {changePrefix}
                {change24h.toFixed(2)}%
              </span>
            ) : null}
            {hoverTimestamp ? (
              <span className="font-mono text-sm text-muted-foreground">
                {hoverTimestamp}
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
