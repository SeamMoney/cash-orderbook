"use client";

import { useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DepthLevel } from "@/hooks/use-depth";

interface OrderbookLadderProps {
  bids: DepthLevel[];
  asks: DepthLevel[];
  onPriceClick: (price: number) => void;
  maxRows?: number;
  /** Map of price → "up" | "down" for flash animation */
  priceFlashes?: Map<number, "up" | "down">;
}

function formatPrice(price: number): string {
  return price.toFixed(6);
}

function formatQty(qty: number): string {
  if (qty >= 1_000_000) return `${(qty / 1_000_000).toFixed(2)}M`;
  if (qty >= 1_000) return `${(qty / 1_000).toFixed(2)}K`;
  return qty.toFixed(2);
}

/** Inline flash background class based on direction */
function getFlashClass(flash: "up" | "down" | undefined): string {
  if (flash === "up") return "animate-flash-green";
  if (flash === "down") return "animate-flash-red";
  return "";
}

/**
 * OrderbookLadder — two-column grid: bids (left, emerald) and asks (right, rose).
 * Each row: price (Geist Mono), quantity, depth bar (background width proportional to cumulative depth).
 * Click on price row fills order form price.
 * Sorted: bids descending, asks ascending.
 * Price flash animation: green on price increase, red on decrease.
 */
export function OrderbookLadder({
  bids,
  asks,
  onPriceClick,
  maxRows = 15,
  priceFlashes,
}: OrderbookLadderProps): React.ReactElement {
  const displayBids = useMemo(() => bids.slice(0, maxRows), [bids, maxRows]);
  const displayAsks = useMemo(() => asks.slice(0, maxRows), [asks, maxRows]);

  // Max cumulative depth for sizing the bars
  const maxDepth = useMemo(() => {
    const maxBidDepth =
      displayBids.length > 0
        ? displayBids[displayBids.length - 1].total
        : 0;
    const maxAskDepth =
      displayAsks.length > 0
        ? displayAsks[displayAsks.length - 1].total
        : 0;
    return Math.max(maxBidDepth, maxAskDepth, 1);
  }, [displayBids, displayAsks]);

  const handlePriceClick = useCallback(
    (price: number): void => {
      onPriceClick(price);
    },
    [onPriceClick],
  );

  // Spread display
  const spread = useMemo(() => {
    if (displayAsks.length > 0 && displayBids.length > 0) {
      const s = displayAsks[0].price - displayBids[0].price;
      const pct =
        displayBids[0].price > 0
          ? ((s / displayBids[0].price) * 100).toFixed(3)
          : "0.000";
      return { value: s.toFixed(6), pct };
    }
    return null;
  }, [displayAsks, displayBids]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="grid grid-cols-6 gap-0 px-3 py-1.5 text-[10px] text-[#666666] uppercase tracking-wider border-b border-[#2A2A2A]">
        <span className="col-span-2">Price</span>
        <span className="text-right">Size</span>
        <span className="col-span-2 text-right">Price</span>
        <span className="text-right">Size</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {displayBids.length === 0 && displayAsks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 gap-1">
            <span className="text-sm text-white/38">No orders yet</span>
            <span className="text-[10px] text-[#444444]">
              Place an order or wait for the book to fill
            </span>
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-0 h-full">
          {/* Bids (left, green) — sorted descending by price */}
          <div className="flex flex-col border-r border-[#2A2A2A]/50">
            <AnimatePresence initial={false}>
              {displayBids.length > 0 ? (
                displayBids.map((level) => (
                  <motion.div
                    key={`bid-${level.price}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={`relative flex items-center justify-between px-3 py-[3px] cursor-pointer hover:bg-emerald-500/10 group ${getFlashClass(priceFlashes?.get(level.price))}`}
                    onClick={() => handlePriceClick(level.price)}
                  >
                    {/* Depth bar */}
                    <div
                      className="absolute inset-y-0 right-0 bg-emerald-500/15 transition-[width] duration-150 ease-out"
                      style={{
                        width: `${(level.total / maxDepth) * 100}%`,
                      }}
                    />
                    <span className="font-mono text-xs text-emerald-400 z-10 group-hover:text-emerald-300">
                      {formatPrice(level.price)}
                    </span>
                    <span className="font-mono text-xs text-[#999999] z-10">
                      {formatQty(level.quantity)}
                    </span>
                  </motion.div>
                ))
              ) : (
                <div className="flex items-center justify-center py-8 text-xs text-white/38">
                  No bids
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Asks (right, red) — sorted ascending by price */}
          <div className="flex flex-col">
            <AnimatePresence initial={false}>
              {displayAsks.length > 0 ? (
                displayAsks.map((level) => (
                  <motion.div
                    key={`ask-${level.price}`}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={`relative flex items-center justify-between px-3 py-[3px] cursor-pointer hover:bg-rose-500/10 group ${getFlashClass(priceFlashes?.get(level.price))}`}
                    onClick={() => handlePriceClick(level.price)}
                  >
                    {/* Depth bar */}
                    <div
                      className="absolute inset-y-0 left-0 bg-rose-500/15 transition-[width] duration-150 ease-out"
                      style={{
                        width: `${(level.total / maxDepth) * 100}%`,
                      }}
                    />
                    <span className="font-mono text-xs text-rose-400 z-10 group-hover:text-rose-300">
                      {formatPrice(level.price)}
                    </span>
                    <span className="font-mono text-xs text-[#999999] z-10">
                      {formatQty(level.quantity)}
                    </span>
                  </motion.div>
                ))
              ) : (
                <div className="flex items-center justify-center py-8 text-xs text-white/38">
                  No asks
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
        )}
      </div>

      {/* Spread */}
      {spread && (
        <div className="flex items-center justify-center gap-2 px-3 py-1.5 border-t border-[#2A2A2A] text-[10px] text-[#666666]">
          <span>Spread:</span>
          <span className="font-mono text-white/65">{spread.value}</span>
          <span className="text-white/38">({spread.pct}%)</span>
        </div>
      )}
    </div>
  );
}
