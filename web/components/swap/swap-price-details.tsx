"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { SwapDirection, SwapQuote } from "@/lib/swap-quote";
import { formatBalance } from "@/lib/utils";

interface SwapPriceDetailsProps {
  quote: SwapQuote | null;
  direction: SwapDirection;
  loading: boolean;
  /** Symbol of the base asset (default: CASH) */
  baseSymbol?: string;
  /** Symbol of the quote asset (default: USD1) */
  quoteSymbol?: string;
}

/**
 * SwapPriceDetails — expandable section showing swap price info.
 *
 * Shows a summary line (exchange rate) that toggles to reveal:
 * - Exchange rate
 * - Price impact
 * - Minimum received
 */
export function SwapPriceDetails({
  quote,
  direction,
  loading,
  baseSymbol = "CASH",
  quoteSymbol = "USD1",
}: SwapPriceDetailsProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);

  if (!quote) {
    if (loading) {
      return (
        <div className="mt-3 flex items-center justify-center py-2">
          <div className="h-4 w-32 animate-pulse rounded bg-secondary" />
        </div>
      );
    }
    return (
      <div className="mt-3">
        {/* Expandable placeholder — interactive even without data */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between rounded-xl bg-background border border-border px-3 py-2.5 min-h-[44px] text-xs transition-colors hover:border-surface-hover"
        >
          <span className="text-text-muted">
            Enter an amount to see price details
          </span>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
          </motion.div>
        </button>

        {/* Expanded placeholder rows */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-2 rounded-xl bg-background border border-border px-3 py-3">
                <DetailRow label="Exchange rate" value="—" mono />
                <DetailRow label="Price impact" value="—" />
                <DetailRow label="Minimum received" value="—" mono />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const rateLabel = `1 ${baseSymbol} = ${formatBalance(quote.effectivePrice, 6)} ${quoteSymbol}`;

  const minimumLabel =
    direction === "sell"
      ? `${formatBalance(quote.minimumReceived, 6)} ${quoteSymbol}`
      : `${formatBalance(quote.minimumReceived, 6)} ${baseSymbol}`;

  const showPriceImpactWarning = quote.priceImpact > 0.001;
  const showPriceImpactDanger = quote.priceImpact > 0.01;

  return (
    <div className="mt-3">
      {/* Summary row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between rounded-xl bg-background border border-border px-3 py-2.5 min-h-[44px] text-xs transition-colors hover:border-surface-hover"
      >
        <span className="font-mono text-text-secondary">{rateLabel}</span>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </motion.div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2 rounded-xl bg-background border border-border px-3 py-3">
              {/* Exchange Rate */}
              <DetailRow label="Exchange rate" value={rateLabel} mono />

              {/* Price Impact */}
              <DetailRow
                label="Price impact"
                value={`${(quote.priceImpact * 100).toFixed(3)}%`}
                valueClassName={
                  showPriceImpactDanger
                    ? "text-cash-red"
                    : showPriceImpactWarning
                      ? "text-amber-400"
                      : "text-text-secondary"
                }
              />

              {/* Minimum Received */}
              <DetailRow label="Minimum received" value={minimumLabel} mono />

              {/* Insufficient liquidity warning */}
              {!quote.sufficientLiquidity && (
                <div className="rounded-lg bg-cash-red/10 border border-cash-red/20 px-3 py-2 mt-1">
                  <p className="text-xs text-cash-red">
                    ⚠ Insufficient liquidity — output may be lower than expected
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Single row in the price details */
function DetailRow({
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
      <span className="text-text-muted">{label}</span>
      <span
        className={
          valueClassName ?? `text-text-secondary ${mono ? "font-mono" : ""}`
        }
      >
        {value}
      </span>
    </div>
  );
}
