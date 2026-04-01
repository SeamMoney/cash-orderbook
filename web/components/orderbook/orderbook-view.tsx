"use client";

import { useState, useCallback } from "react";
import { useRealtimeOrderbook } from "@/hooks/use-realtime-orderbook";
import { useRealtimeTrades } from "@/hooks/use-realtime-trades";
import { OrderbookLadder } from "./orderbook-ladder";
import { DepthChart } from "./depth-chart";
import { TradeTicker } from "./trade-ticker";
import { OrderForm } from "./order-form";
import { MyOrders } from "./my-orders";
import { ConnectionStatus } from "@/components/connection-status";
import {
  OrderbookSkeleton,
  TradeTickerSkeleton,
  DepthChartSkeleton,
} from "@/components/ui/skeleton";

/**
 * OrderbookView — the full advanced orderbook layout.
 * Multi-panel grid: orderbook ladder, depth chart, trade ticker, order form, my orders.
 * Real-time updates via WebSocket with connection status indicator.
 * Responsive: 1280px+ multi-panel grid, below 1024px vertical stack.
 */
export function OrderbookView(): React.ReactElement {
  const {
    depth,
    loading: depthLoading,
    wsStatus,
    priceFlashes,
  } = useRealtimeOrderbook();
  const { trades, loading: tradesLoading } = useRealtimeTrades(50);
  const [prefillPrice, setPrefillPrice] = useState<number | null>(null);
  const [orderRefresh, setOrderRefresh] = useState(0);

  const bids = depth?.bids ?? [];
  const asks = depth?.asks ?? [];

  const handlePriceClick = useCallback((price: number): void => {
    setPrefillPrice(price);
  }, []);

  const handleOrderPlaced = useCallback((): void => {
    setOrderRefresh((prev) => prev + 1);
  }, []);

  return (
    <div className="flex flex-col gap-3 w-full max-w-7xl mx-auto h-full">
      {/* Top Grid: Orderbook + Chart + Form */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-3 flex-1 min-h-0">
        {/* Left: Orderbook + Depth */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Orderbook Ladder */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] overflow-hidden flex-1 min-h-[300px]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#2A2A2A]">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-white">
                  Order Book
                </h3>
                <ConnectionStatus status={wsStatus} />
              </div>
              <span className="font-mono text-[10px] text-white/38">
                CASH / USDC
              </span>
            </div>
            {depthLoading ? (
              <OrderbookSkeleton />
            ) : (
              <OrderbookLadder
                bids={bids}
                asks={asks}
                onPriceClick={handlePriceClick}
                priceFlashes={priceFlashes}
              />
            )}
          </div>

          {/* Depth Chart */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] overflow-hidden h-[200px]">
            <div className="flex items-center px-3 py-2 border-b border-[#2A2A2A]">
              <h3 className="text-xs font-semibold text-white">
                Depth Chart
              </h3>
            </div>
            <div className="h-[calc(100%-33px)]">
              {depthLoading ? (
                <DepthChartSkeleton />
              ) : (
                <DepthChart bids={bids} asks={asks} />
              )}
            </div>
          </div>
        </div>

        {/* Right: Order Form + My Orders + Trade Ticker */}
        <div className="flex flex-col gap-3 min-h-0">
          {/* Order Form */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-4">
            <h3 className="text-xs font-semibold text-white mb-3">
              Place Order
            </h3>
            <OrderForm
              prefillPrice={prefillPrice}
              onOrderPlaced={handleOrderPlaced}
            />
          </div>

          {/* My Orders */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] overflow-hidden">
            <MyOrders refreshTrigger={orderRefresh} />
          </div>

          {/* Trade Ticker */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] overflow-hidden flex-1 min-h-[200px]">
            <div className="flex items-center px-3 py-2 border-b border-[#2A2A2A]">
              <h3 className="text-xs font-semibold text-white">
                Recent Trades
              </h3>
            </div>
            <div className="h-[calc(100%-33px)]">
              {tradesLoading ? (
                <TradeTickerSkeleton />
              ) : (
                <TradeTicker trades={trades} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
