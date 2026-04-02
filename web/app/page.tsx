"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useMedia } from "@tamagui/core";
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
import { Flex } from "@/components/ui/Flex";
import {
  TokenDetailsLayout,
  LeftPanel,
  RightPanel,
} from "@/components/layout/TokenDetailsLayout";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export default function Home(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<NavTab>("trade");
  const { market, loading: rawMarketLoading } = useMarket();
  const { change24h } = usePriceChange();
  const { trades, loading: tradesLoading } = useRealtimeTrades(50);
  const { realtimePrice, flashDirection } = useRealtimePrice();

  // Responsive breakpoint: xl = maxWidth: 1024px → stacked layout
  const media = useMedia();
  const isMobile = media.xl;

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
    <Flex minHeight="100vh" backgroundColor="$surface1">
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
        style={{ flex: 1, width: "100%", maxWidth: 1200, marginInline: "auto" }}
      >
        <TokenDetailsLayout>
          {/* Left Panel — Token Info + Chart + Stats + Transactions */}
          <LeftPanel>
            {/* Breadcrumb */}
            <Breadcrumb />

            {/* Token Header — logo, name, symbol + sticky condensed header */}
            <TokenHeader price={displayPrice} />

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

            {/* Swap Widget — shown inline on mobile only */}
            {isMobile && <SwapWidget />}

            {/* Token Info (About/Description) — before Transactions per Uniswap TDP order */}
            <TokenInfo />

            {/* Transactions Table */}
            <TransactionsTable trades={trades} loading={tradesLoading} />
          </LeftPanel>

          {/* Right Panel — Sticky Swap Widget (desktop only) */}
          {!isMobile && (
            <RightPanel>
              <div style={{ position: "sticky", top: 72 }}>
                <SwapWidget />
              </div>
            </RightPanel>
          )}
        </TokenDetailsLayout>
      </motion.main>
    </Flex>
  );
}
