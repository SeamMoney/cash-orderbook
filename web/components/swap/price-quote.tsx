"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { SwapDirection, SwapQuote } from "@/lib/swap-quote";
import { formatBalance } from "@/lib/utils";

interface PriceQuoteProps {
  quote: SwapQuote | null;
  direction: SwapDirection;
  loading: boolean;
}

/**
 * PriceQuote — displays the swap price details below the output.
 *
 * Shows:
 * - Rate (effective price)
 * - Price impact (highlighted if > 0.1%)
 * - Minimum received (after slippage)
 * - Mid-market price
 */
export function PriceQuote({
  quote,
  direction,
  loading,
}: PriceQuoteProps): React.ReactElement | null {
  if (!quote) {
    if (loading) {
      return (
        <div className="mt-4 flex items-center justify-center py-3">
          <div className="h-4 w-32 animate-pulse rounded bg-[#2A2A2A]" />
        </div>
      );
    }
    return null;
  }

  const showPriceImpactWarning = quote.priceImpact > 0.001; // > 0.1%
  const showPriceImpactDanger = quote.priceImpact > 0.01; // > 1%

  const rateLabel = `1 CASH = ${formatBalance(quote.effectivePrice, 6)} USD1`;

  const minimumLabel =
    direction === "sell"
      ? `${formatBalance(quote.minimumReceived, 6)} USD1`
      : `${formatBalance(quote.minimumReceived, 6)} CASH`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="mt-4 space-y-2 overflow-hidden"
      >
        {/* Rate */}
        <QuoteRow label="Rate" value={rateLabel} mono />

        {/* Price Impact */}
        <QuoteRow
          label="Price Impact"
          value={`${(quote.priceImpact * 100).toFixed(3)}%`}
          valueClassName={
            showPriceImpactDanger
              ? "text-rose-400"
              : showPriceImpactWarning
                ? "text-amber-400"
                : "text-white/65"
          }
        />

        {/* Minimum Received */}
        <QuoteRow label="Min. Received" value={minimumLabel} mono />

        {/* Insufficient liquidity warning */}
        {!quote.sufficientLiquidity && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2"
          >
            <p className="text-xs text-rose-400">
              ⚠ Insufficient liquidity — output may be lower than expected
            </p>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/** Single row in the quote details */
function QuoteRow({
  label,
  value,
  mono = false,
  valueClassName,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClassName?: string;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#666666]">{label}</span>
      <span
        className={
          valueClassName ??
          `text-white/65 ${mono ? "font-sans" : ""}`
        }
      >
        {value}
      </span>
    </div>
  );
}
