"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Nav, type NavTab } from "@/components/nav";
import { Toaster } from "sonner";
import { TokenHeader } from "@/components/token-header";
import { PriceChart, type CrosshairData } from "@/components/price-chart";
import { TokenStatsGrid } from "@/components/token-stats-grid";
import { SwapWidget } from "@/components/swap";
import { TransactionsTable } from "@/components/transactions-table";
import { TokenInfo } from "@/components/token-info";
import { useMarket } from "@/hooks/use-market";
import { usePriceChange } from "@/hooks/use-price-change";
import { useMinDuration } from "@/hooks/use-min-duration";
import { useRealtimeTrades } from "@/hooks/use-realtime-trades";
import { useRealtimePrice } from "@/hooks/use-realtime-price";

/** Breadcrumb displayed above the token header. */
function Breadcrumb(): React.ReactElement {
  return (
    <nav className="flex items-center gap-1 text-[15px] text-white/65 mb-5">
      <span className="hover:text-white/85 cursor-pointer transition-colors">Tokens</span>
      <ChevronRight className="h-4 w-4 text-white/38" />
      <span className="text-white">CASH</span>
    </nav>
  );
}

export default function Home(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<NavTab>("trade");
  const { market, loading: rawMarketLoading } = useMarket();
  const { change24h } = usePriceChange();
  const { trades, loading: tradesLoading } = useRealtimeTrades(50);
  const { realtimePrice, flashDirection } = useRealtimePrice();

  // Ensure stats skeleton is visible for at least 300ms on initial page load
  const marketLoading = useMinDuration(rawMarketLoading, 300);

  // Chart crosshair hover state — when hovering, override the header price
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const [hoverTimestamp, setHoverTimestamp] = useState<string | null>(null);
  const [hoverOhlc, setHoverOhlc] = useState<{
    open: number;
    high: number;
    low: number;
    close: number;
  } | null>(null);

  const handleCrosshairMove = useCallback((data: CrosshairData): void => {
    setHoverPrice(data.price);
    setHoverTimestamp(data.timestamp);
    if (
      data.chartMode === "candle" &&
      data.open != null &&
      data.high != null &&
      data.low != null &&
      data.close != null
    ) {
      setHoverOhlc({
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
      });
    } else {
      setHoverOhlc(null);
    }
  }, []);

  // Derive display values — prefer hover price, then realtime WS price, then API price
  const displayPrice = hoverPrice ?? realtimePrice ?? market?.lastPrice ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav activeTab={activeTab} onTabChange={setActiveTab} />
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            color: "var(--color-foreground)",
          },
        }}
      />

      {/* Main Content — Two Column Layout with page transition */}
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mx-auto w-full max-w-[1200px] flex-1 px-5 md:px-10 mt-8 pb-12"
      >
        <div className="flex flex-col lg:flex-row gap-20">
          {/* Left Column (~65%) — Token Info + Chart + Stats + Transactions */}
          <div className="flex-1 min-w-0 space-y-6 md:space-y-10">
            {/* Breadcrumb */}
            <Breadcrumb />

            {/* Token Header — logo, name, symbol only */}
            <TokenHeader />

            {/* Price Chart — includes price display above the chart canvas */}
            <PriceChart
              onCrosshairMove={handleCrosshairMove}
              price={displayPrice}
              change24h={change24h}
              priceLoading={marketLoading}
              hoverTimestamp={hoverTimestamp}
              flashDirection={flashDirection}
              hoverOhlc={hoverOhlc}
            />

            {/* Token Stats Grid */}
            <TokenStatsGrid market={market} loading={marketLoading} />

            {/* Swap Widget — shown inline on mobile, hidden on desktop (shown in right column) */}
            <div className="lg:hidden">
              <SwapWidget />
            </div>

            {/* Transactions Table */}
            <TransactionsTable trades={trades} loading={tradesLoading} />

            {/* Token Info */}
            <TokenInfo />
          </div>

          {/* Right Column (~35%) — Sticky Swap Widget (desktop only) */}
          <div className="hidden lg:block w-[360px] flex-shrink-0">
            <div className="sticky top-[72px]">
              <SwapWidget />
            </div>
          </div>
        </div>
      </motion.main>
    </div>
  );
}
