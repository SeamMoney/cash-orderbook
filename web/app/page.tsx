"use client";

import { useState, useCallback } from "react";
import { Nav, type NavTab } from "@/components/nav";
import { Toaster } from "sonner";
import { TokenHeader } from "@/components/token-header";
import { PriceChart, type CrosshairData } from "@/components/price-chart";
import { StatsPlaceholder } from "@/components/placeholders/stats-placeholder";
import { SwapPlaceholder } from "@/components/placeholders/swap-placeholder";
import { TransactionsPlaceholder } from "@/components/placeholders/transactions-placeholder";
import { useMarket } from "@/hooks/use-market";

export default function Home(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<NavTab>("trade");
  const { market, loading: marketLoading } = useMarket();

  // Chart crosshair hover state — when hovering, override the header price
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const [hoverTimestamp, setHoverTimestamp] = useState<string | null>(null);

  const handleCrosshairMove = useCallback((data: CrosshairData): void => {
    setHoverPrice(data.price);
    setHoverTimestamp(data.timestamp);
  }, []);

  // Derive display values
  const displayPrice = hoverPrice ?? market?.lastPrice ?? null;
  const change24h =
    market && market.lastPrice > 0 && market.volume24h >= 0
      ? // Compute a synthetic 24h change for display
        // The API doesn't return change24h directly, so show 0.00 as fallback
        0
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#000000]">
      <Nav activeTab={activeTab} onTabChange={setActiveTab} />
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background: "#111111",
            border: "1px solid #1A1A1A",
            color: "#FFFFFF",
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

            {/* Stats Placeholder */}
            <StatsPlaceholder />

            {/* Transactions Placeholder */}
            <TransactionsPlaceholder />
          </div>

          {/* Right Column (~35%) — Sticky Swap Widget */}
          <div className="w-full md:w-[35%] mt-6 md:mt-0">
            <div className="md:sticky md:top-[72px]">
              <SwapPlaceholder />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
