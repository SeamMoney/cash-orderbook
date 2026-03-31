"use client";

import { useState, useCallback } from "react";
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

export default function Home(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<NavTab>("trade");
  const { market, loading: rawMarketLoading } = useMarket();
  const { change24h } = usePriceChange();
  const { trades, loading: tradesLoading } = useRealtimeTrades(50);

  // Ensure stats skeleton is visible for at least 300ms on initial page load
  const marketLoading = useMinDuration(rawMarketLoading, 300);

  // Chart crosshair hover state — when hovering, override the header price
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const [hoverTimestamp, setHoverTimestamp] = useState<string | null>(null);

  const handleCrosshairMove = useCallback((data: CrosshairData): void => {
    setHoverPrice(data.price);
    setHoverTimestamp(data.timestamp);
  }, []);

  // Derive display values
  const displayPrice = hoverPrice ?? market?.lastPrice ?? null;

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

      {/* Main Content — Two Column Layout */}
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6">
        <div className="flex flex-col md:flex-row md:gap-6 lg:gap-8">
          {/* Left Column (~65%) — Token Info + Chart + Stats + Transactions */}
          <div className="w-full md:w-[65%] space-y-6">
            {/* Token Header */}
            <TokenHeader
              price={displayPrice}
              change24h={change24h}
              loading={marketLoading}
              hoverTimestamp={hoverTimestamp}
            />

            {/* Price Chart */}
            <PriceChart onCrosshairMove={handleCrosshairMove} />

            {/* Token Stats Grid */}
            <TokenStatsGrid market={market} loading={marketLoading} />

            {/* Transactions Table */}
            <TransactionsTable trades={trades} loading={tradesLoading} />

            {/* Token Info */}
            <TokenInfo />
          </div>

          {/* Right Column (~35%) — Sticky Swap Widget */}
          <div className="w-full md:w-[35%] mt-6 md:mt-0">
            <div className="md:sticky md:top-[72px]">
              <SwapWidget />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
