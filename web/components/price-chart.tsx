"use client";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type RefObject,
} from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCandles, type CandleInterval } from "@/hooks/use-candles";
import { useMinDuration } from "@/hooks/use-min-duration";
import { useRealtimeTrades } from "@/hooks/use-realtime-trades";

/** Time range tab options shown below the chart. */
const TIME_RANGES: { label: string; interval: CandleInterval }[] = [
  { label: "1H", interval: "1m" },
  { label: "1D", interval: "5m" },
  { label: "1W", interval: "15m" },
  { label: "1M", interval: "1h" },
  { label: "1Y", interval: "1d" },
];

/** Props for the crosshair hover callback. */
export interface CrosshairData {
  price: number | null;
  timestamp: string | null;
}

interface PriceChartProps {
  /** Callback when user hovers the chart crosshair. */
  onCrosshairMove?: (data: CrosshairData) => void;
}

/**
 * PriceChart — TradingView lightweight-charts area chart with time range tabs.
 * Green line + gradient when period is positive, red when negative.
 * Shows empty state when no data, loading skeleton while fetching.
 */
export function PriceChart({
  onCrosshairMove,
}: PriceChartProps): React.ReactElement {
  const [activeRange, setActiveRange] = useState(1); // default "1D"
  const interval = TIME_RANGES[activeRange].interval;
  const { candles, loading: rawLoading, error } = useCandles(interval);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { trades: realtimeTrades, wsStatus } = useRealtimeTrades(10);

  // Ensure skeleton is visible for at least 300ms on initial page load
  const loading = useMinDuration(rawLoading, 300);

  const hasData = candles.length > 0;
  const isEmpty = !loading && !hasData;

  // Determine if period is positive (first close < last close)
  const isPositive =
    hasData ? candles[candles.length - 1].close >= candles[0].close : true;

  const lineColor = isPositive ? "#00D54B" : "#FF3B30";
  const topGradient = isPositive
    ? "rgba(0, 213, 75, 0.3)"
    : "rgba(255, 59, 48, 0.3)";
  const bottomGradient = isPositive
    ? "rgba(0, 213, 75, 0.0)"
    : "rgba(255, 59, 48, 0.0)";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      {/* Time range tabs */}
      <div className="mb-4 flex items-center gap-1 sm:gap-2">
        {TIME_RANGES.map((range, idx) => (
          <button
            key={range.label}
            onClick={() => setActiveRange(idx)}
            className={`rounded-full px-3 py-1.5 min-h-[44px] min-w-[44px] text-xs font-medium transition-colors ${
              idx === activeRange
                ? "bg-secondary text-white"
                : "text-text-muted hover:text-muted-foreground cursor-pointer"
            }`}
            aria-label={`Show ${range.label} chart range`}
            aria-pressed={idx === activeRange}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Chart area */}
      <div className="relative h-[220px] sm:h-[300px] w-full overflow-hidden rounded-lg">
        {loading ? (
          <ChartSkeleton />
        ) : isEmpty ? (
          <ChartEmptyState error={error} />
        ) : (
          <LightweightChart
            containerRef={chartContainerRef}
            candles={candles}
            lineColor={lineColor}
            topGradient={topGradient}
            bottomGradient={bottomGradient}
            onCrosshairMove={onCrosshairMove}
            realtimeTrades={realtimeTrades}
            wsConnected={wsStatus === "connected"}
          />
        )}
      </div>
    </div>
  );
}

/** Skeleton loading state for the chart. */
function ChartSkeleton(): React.ReactElement {
  return (
    <div className="relative h-full w-full">
      <Skeleton className="h-full w-full" />
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-sm text-text-muted">Loading chart...</p>
      </div>
    </div>
  );
}

/** Empty state when no candle data is available. */
function ChartEmptyState({
  error,
}: {
  error: string | null;
}): React.ReactElement {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background">
      <div className="mb-2 text-2xl opacity-20">📈</div>
      <p className="text-sm font-medium text-text-muted">
        {error ? "Unable to load chart data" : "No chart data available"}
      </p>
      <p className="mt-1 text-xs opacity-30">
        {error
          ? "Check that the API is running"
          : "Trade data will appear here"}
      </p>
    </div>
  );
}

/** Trade data shape from useRealtimeTrades */
interface RealtimeTrade {
  id: string;
  price: number;
  quantity: number;
  side: "buy" | "sell";
  timestamp: number;
}

/** The actual lightweight-charts render component. Dynamically imports the library. */
function LightweightChart({
  containerRef: _externalRef,
  candles,
  lineColor,
  topGradient,
  bottomGradient,
  onCrosshairMove,
  realtimeTrades,
  wsConnected,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  candles: { close: number; timestamp: number }[];
  lineColor: string;
  topGradient: string;
  bottomGradient: string;
  onCrosshairMove?: (data: CrosshairData) => void;
  realtimeTrades?: RealtimeTrade[];
  wsConnected?: boolean;
}): React.ReactElement {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<
    typeof import("lightweight-charts").createChart
  > | null>(null);
  // Store area series ref for WS updates. Uses Record to avoid
  // importing lightweight-charts types at module level (dynamic import).
  const areaSeriesRef = useRef<Record<string, unknown> | null>(null);
  const lastUpdateTimestampRef = useRef<number>(0);

  const onCrosshairMoveRef = useRef(onCrosshairMove);
  onCrosshairMoveRef.current = onCrosshairMove;

  const formatTimestamp = useCallback((ts: number): string => {
    const date = new Date(ts);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    let disposed = false;

    const initChart = async (): Promise<void> => {
      // Dynamic import to avoid SSR issues
      const { createChart, AreaSeries, CrosshairMode } = await import(
        "lightweight-charts"
      );

      if (disposed || !chartContainerRef.current) return;

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight || 300,
        layout: {
          background: { color: "transparent" },
          textColor: "#888888",
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { color: "#1A1A1A", style: 2 },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: "#555555",
            width: 1,
            style: 2,
            labelBackgroundColor: "#1A1A1A",
          },
          horzLine: {
            color: "#555555",
            width: 1,
            style: 2,
            labelBackgroundColor: "#1A1A1A",
          },
        },
        rightPriceScale: {
          borderColor: "#1A1A1A",
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        timeScale: {
          borderColor: "#1A1A1A",
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: { vertTouchDrag: false },
      });

      chartRef.current = chart;

      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor,
        topColor: topGradient,
        bottomColor: bottomGradient,
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBackgroundColor: lineColor,
        crosshairMarkerBorderColor: "#FFFFFF",
        crosshairMarkerBorderWidth: 2,
        priceFormat: {
          type: "price",
          precision: 4,
          minMove: 0.0001,
        },
      });

      // Convert candle data to area series format { time, value }
      // lightweight-charts expects time as seconds (UTC timestamp)
      const chartData = candles
        .map((c) => ({
          time: Math.floor(c.timestamp / 1000) as import("lightweight-charts").UTCTimestamp,
          value: c.close,
        }))
        .sort((a, b) => (a.time as number) - (b.time as number));

      areaSeries.setData(chartData);
      areaSeriesRef.current = areaSeries as unknown as Record<string, unknown>;
      // Track the latest timestamp from historical data to avoid duplicates
      if (chartData.length > 0) {
        lastUpdateTimestampRef.current = chartData[chartData.length - 1].time as number;
      }
      chart.timeScale().fitContent();

      // Subscribe to crosshair move for hover tooltip
      chart.subscribeCrosshairMove((param) => {
        if (!onCrosshairMoveRef.current) return;

        if (
          !param.time ||
          param.point === undefined ||
          param.point.x < 0 ||
          param.point.y < 0
        ) {
          onCrosshairMoveRef.current({ price: null, timestamp: null });
          return;
        }

        const seriesData = param.seriesData.get(areaSeries);
        if (seriesData && "value" in seriesData) {
          const ts = (param.time as number) * 1000;
          onCrosshairMoveRef.current({
            price: seriesData.value as number,
            timestamp: formatTimestamp(ts),
          });
        }
      });

      // Handle resize
      const handleResize = (): void => {
        if (chartContainerRef.current && chart) {
          chart.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight || 300,
          });
        }
      };

      const observer = new ResizeObserver(handleResize);
      observer.observe(chartContainerRef.current);

      // Store cleanup data
      (chart as unknown as { _observer: ResizeObserver })._observer = observer;
    };

    void initChart();

    return () => {
      disposed = true;
      areaSeriesRef.current = null;
      lastUpdateTimestampRef.current = 0;
      if (chartRef.current) {
        const chart = chartRef.current;
        const observer = (chart as unknown as { _observer?: ResizeObserver })
          ._observer;
        if (observer) observer.disconnect();
        chart.remove();
        chartRef.current = null;
      }
    };
  }, [candles, lineColor, topGradient, bottomGradient, formatTimestamp]);

  // Append new data points from WebSocket trades to the chart series
  useEffect(() => {
    if (!wsConnected || !realtimeTrades || realtimeTrades.length === 0) return;
    if (!areaSeriesRef.current) return;

    // Process only trades newer than the last update
    const newTrades = realtimeTrades.filter((t) => {
      const timeSec = Math.floor(t.timestamp / 1000);
      return timeSec > lastUpdateTimestampRef.current;
    });

    if (newTrades.length === 0) return;

    // Sort by timestamp ascending and update the series
    const sorted = [...newTrades].sort((a, b) => a.timestamp - b.timestamp);
    const updateFn = areaSeriesRef.current.update as
      | ((data: { time: number; value: number }) => void)
      | undefined;
    if (!updateFn) return;

    for (const trade of sorted) {
      const timeSec = Math.floor(trade.timestamp / 1000);
      try {
        updateFn({
          time: timeSec,
          value: trade.price,
        });
        lastUpdateTimestampRef.current = timeSec;
      } catch {
        // Silently ignore update errors (e.g., invalid time ordering)
      }
    }
  }, [realtimeTrades, wsConnected]);

  return (
    <div
      ref={chartContainerRef}
      className="h-full w-full"
      aria-label="Price chart"
    />
  );
}
