"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface TradeEntry {
  id: string;
  price: number;
  quantity: number;
  side: "buy" | "sell";
  timestamp: number;
}

interface TradeTickerProps {
  trades: TradeEntry[];
  maxEntries?: number;
}

function formatPrice(price: number): string {
  return price.toFixed(6);
}

function formatQty(qty: number): string {
  if (qty >= 1_000_000) return `${(qty / 1_000_000).toFixed(2)}M`;
  if (qty >= 1_000) return `${(qty / 1_000).toFixed(2)}K`;
  return qty.toFixed(2);
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 1000) return "now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

/**
 * TradeTicker — scrolling vertical list of recent trades.
 * Each: price (colored by side), quantity, time ago.
 * AnimatePresence with slide-in animation for new trades.
 */
export function TradeTicker({
  trades,
  maxEntries = 30,
}: TradeTickerProps): React.ReactElement {
  const displayTrades = useMemo(
    () => trades.slice(0, maxEntries),
    [trades, maxEntries],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 text-[10px] text-[#666666] uppercase tracking-wider border-b border-[#2A2A2A]">
        <span>Price</span>
        <span>Size</span>
        <span>Time</span>
      </div>

      {/* Trades List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {displayTrades.length > 0 ? (
          <AnimatePresence initial={false}>
            {displayTrades.map((trade) => (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, height: 0, x: 20 }}
                animate={{ opacity: 1, height: "auto", x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex items-center justify-between px-3 py-[3px] font-mono text-xs"
              >
                <span
                  className={
                    trade.side === "buy"
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }
                >
                  {formatPrice(trade.price)}
                </span>
                <span className="text-[#999999]">
                  {formatQty(trade.quantity)}
                </span>
                <span className="text-[#555555] text-[10px]">
                  {timeAgo(trade.timestamp)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="flex items-center justify-center py-8 text-xs text-[#555555]">
            No trades yet
          </div>
        )}
      </div>
    </div>
  );
}
