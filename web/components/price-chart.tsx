"use client";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type RefObject,
} from "react";
import { Text, useTheme } from "@tamagui/core";
import { Flex } from "@/components/ui/Flex";
import { Skeleton } from "@/components/ui/skeleton";
import { useCandles, type CandleInterval } from "@/hooks/use-candles";
import { useMinDuration } from "@/hooks/use-min-duration";
import { useRealtimeTrades } from "@/hooks/use-realtime-trades";
import { formatBalance } from "@/lib/utils";
import type { PriceFlashDirection } from "@/hooks/use-realtime-price";

/** Time range tab options shown below the chart. */
const TIME_RANGES: { label: string; interval: CandleInterval }[] = [
  { label: "1H", interval: "1m" },
  { label: "1D", interval: "5m" },
  { label: "1W", interval: "15m" },
  { label: "1M", interval: "1h" },
  { label: "1Y", interval: "1d" },
  { label: "ALL", interval: "1d" },
];

/** Chart display mode: candlestick bars or area/line chart. */
export type ChartMode = "candle" | "line";

/** Props for the crosshair hover callback. */
export interface CrosshairData {
  price: number | null;
  timestamp: string | null;
  /** OHLC values when hovering in candlestick mode. */
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  /** Current chart mode so the consumer knows which fields are available. */
  chartMode?: ChartMode;
}

/** OHLC hover values from candlestick crosshair. */
interface OhlcValues {
  open: number;
  high: number;
  low: number;
  close: number;
}

interface PriceChartProps {
  /** Callback when user hovers the chart crosshair. */
  onCrosshairMove?: (data: CrosshairData) => void;
  /** Current price to display above the chart (from API or chart hover). */
  price: number | null;
  /** 24h price change percentage. Positive = green, negative = red. */
  change24h: number | null;
  /** Whether market data is still loading. */
  priceLoading: boolean;
  /** Optional: the date/time label shown when hovering the chart. */
  hoverTimestamp?: string | null;
  /** Optional: flash direction for price change animation ("up" = green, "down" = red). */
  flashDirection?: PriceFlashDirection;
  /** Optional: OHLC values when hovering candlestick chart. */
  hoverOhlc?: OhlcValues | null;
}

/**
 * PriceChart — TradingView lightweight-charts with candlestick/line toggle and time range tabs.
 * Includes the price display above the chart canvas (relocated from token header).
 * Default: CandlestickSeries with green up / red down bars.
 * Toggle to AreaSeries (line + gradient) via Candle | Line buttons.
 * Shows empty state when no data, loading skeleton while fetching.
 */
export function PriceChart({
  onCrosshairMove,
  price,
  change24h,
  priceLoading,
  hoverTimestamp,
  flashDirection,
  hoverOhlc,
}: PriceChartProps): React.ReactElement {
  const [activeRange, setActiveRange] = useState(1); // default "1D"
  const [chartMode, setChartMode] = useState<ChartMode>("candle");
  const interval = TIME_RANGES[activeRange].interval;
  const { candles, loading: rawLoading, error, transitionTimestamp } = useCandles(interval);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { trades: realtimeTrades, wsStatus } = useRealtimeTrades(10);

  // Ensure skeleton is visible for at least 300ms on initial page load
  const loading = useMinDuration(rawLoading, 300);

  const hasData = candles.length > 0;
  const isEmpty = !loading && !hasData;

  // Access theme tokens for dynamic color usage
  const theme = useTheme();

  // Determine if period is positive (first close < last close)
  const isPositive =
    hasData ? candles[candles.length - 1].close >= candles[0].close : true;

  const lineColor = isPositive
    ? (theme.accent1?.val as string)
    : (theme.statusCritical?.val as string);
  const topGradient = isPositive
    ? "rgba(0, 213, 75, 0.3)"
    : "rgba(255, 89, 60, 0.3)";
  const bottomGradient = isPositive
    ? "rgba(0, 213, 75, 0.0)"
    : "rgba(255, 89, 60, 0.0)";

  // Price display helpers
  const isPricePositive = change24h !== null && change24h >= 0;
  const changeColor = isPricePositive ? "text-cash-green" : "text-cash-red";
  const changePrefix = isPricePositive ? "+" : "";

  // Flash animation state
  const [flashClass, setFlashClass] = useState("");

  const applyFlash = useCallback((direction: PriceFlashDirection): void => {
    if (!direction) {
      setFlashClass("");
      return;
    }
    setFlashClass("");
    requestAnimationFrame(() => {
      setFlashClass(direction === "up" ? "animate-flash-green" : "animate-flash-red");
    });
  }, []);

  useEffect(() => {
    applyFlash(flashDirection ?? null);
  }, [flashDirection, applyFlash]);

  return (
    <Flex data-testid="chart-section">
      {/* Price display — above the chart canvas */}
      <Flex marginBottom="$spacing12">
        <Flex row alignItems="baseline" gap="$spacing12">
          {priceLoading ? (
            <>
              <Skeleton className="h-9 w-32 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </>
          ) : (
            <>
              <Text
                fontFamily="$heading"
                fontSize={37}
                lineHeight={40}
                fontWeight="485"
                color="$neutral1"
                className={flashClass}
                style={{ borderRadius: 6, paddingInline: 4, marginInline: -4 }}
                data-testid="chart-price-display"
              >
                {price !== null
                  ? `$${formatBalance(price, price < 1 ? 6 : 2)}`
                  : "$--"}
              </Text>
              {change24h !== null && !hoverTimestamp ? (
                <Text
                  fontFamily="$body"
                  fontSize={17}
                  lineHeight={22.1}
                  fontWeight="535"
                  color={isPricePositive ? "$statusSuccess" : "$statusCritical"}
                  data-testid="chart-change-percentage"
                >
                  {changePrefix}
                  {change24h.toFixed(2)}%
                </Text>
              ) : null}
              {hoverTimestamp ? (
                <Text
                  fontFamily="$body"
                  fontSize={13}
                  lineHeight={16}
                  color="$neutral3"
                >
                  {hoverTimestamp}
                </Text>
              ) : null}
            </>
          )}
        </Flex>

        {/* OHLC values when hovering candlestick chart */}
        {hoverOhlc ? (
          <Flex row alignItems="center" gap="$spacing12" marginTop="$spacing4">
            {(["open", "high", "low", "close"] as const).map((key) => (
              <Text
                key={key}
                fontFamily="$monospace"
                fontSize={13}
                lineHeight={16}
                color="$neutral3"
              >
                {key[0].toUpperCase()}{" "}
                <Text
                  fontFamily="$monospace"
                  fontSize={13}
                  lineHeight={16}
                  color="$neutral1"
                >
                  {formatBalance(
                    hoverOhlc[key],
                    hoverOhlc[key] < 1 ? 6 : 2
                  )}
                </Text>
              </Text>
            ))}
          </Flex>
        ) : null}
      </Flex>

      {/* Chart area — 356px height, transparent bg, no border-radius */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: 356 }}
        data-testid="chart-container"
      >
        {loading ? (
          <ChartSkeleton />
        ) : isEmpty ? (
          <ChartEmptyState error={error} />
        ) : (
          <LightweightChart
            containerRef={chartContainerRef}
            candles={candles}
            chartMode={chartMode}
            interval={interval}
            lineColor={lineColor}
            topGradient={topGradient}
            bottomGradient={bottomGradient}
            onCrosshairMove={onCrosshairMove}
            realtimeTrades={realtimeTrades}
            wsConnected={wsStatus === "connected"}
            transitionTimestamp={transitionTimestamp}
          />
        )}
      </div>

      {/* Chart controls — BELOW the chart (matching Uniswap ChartSection layout) */}
      <Flex
        row
        alignItems="center"
        justifyContent="space-between"
        marginTop="$spacing16"
        data-testid="chart-controls"
      >
        {/* Chart mode toggle (Candle / Line) */}
        <Flex
          row
          alignItems="center"
          gap="$spacing4"
          borderRadius="$rounded8"
          backgroundColor="$surface2"
          padding="$spacing2"
        >
          <button
            onClick={() => setChartMode("candle")}
            style={{
              borderRadius: 6,
              paddingInline: 12,
              paddingBlock: 6,
              fontSize: 13,
              lineHeight: "16px",
              fontWeight: 535,
              fontFamily: "inherit",
              border: "none",
              cursor: "pointer",
              transition: "color 150ms ease, background-color 150ms ease",
              backgroundColor:
                chartMode === "candle"
                  ? (theme.accent1?.val as string)
                  : "transparent",
              color:
                chartMode === "candle"
                  ? (theme.black?.val as string)
                  : (theme.neutral3?.val as string),
            }}
            aria-label="Candlestick chart"
            aria-pressed={chartMode === "candle"}
          >
            Candle
          </button>
          <button
            onClick={() => setChartMode("line")}
            style={{
              borderRadius: 6,
              paddingInline: 12,
              paddingBlock: 6,
              fontSize: 13,
              lineHeight: "16px",
              fontWeight: 535,
              fontFamily: "inherit",
              border: "none",
              cursor: "pointer",
              transition: "color 150ms ease, background-color 150ms ease",
              backgroundColor:
                chartMode === "line"
                  ? (theme.accent1?.val as string)
                  : "transparent",
              color:
                chartMode === "line"
                  ? (theme.black?.val as string)
                  : (theme.neutral3?.val as string),
            }}
            aria-label="Line chart"
            aria-pressed={chartMode === "line"}
          >
            Line
          </button>
        </Flex>

        {/* Time range tabs — body4 (13px), active: neutral1, inactive: neutral3 */}
        <Flex row alignItems="center" gap="$spacing4">
          {TIME_RANGES.map((range, idx) => (
            <button
              key={range.label}
              onClick={() => setActiveRange(idx)}
              style={{
                paddingInline: 10,
                paddingBlock: 6,
                fontSize: 13,
                lineHeight: "16px",
                fontWeight: idx === activeRange ? 535 : 485,
                fontFamily: "inherit",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                transition: "color 150ms ease",
                backgroundColor: "transparent",
                color:
                  idx === activeRange
                    ? (theme.neutral1?.val as string)
                    : (theme.neutral3?.val as string),
              }}
              aria-label={`Show ${range.label} chart range`}
              aria-pressed={idx === activeRange}
              data-testid={`time-range-${range.label}`}
            >
              {range.label}
            </button>
          ))}
        </Flex>
      </Flex>
    </Flex>
  );
}

/** Skeleton loading state for the chart. */
function ChartSkeleton(): React.ReactElement {
  return (
    <div className="relative h-full w-full">
      <Skeleton className="h-full w-full" />
      <Flex
        centered
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
      >
        <Text fontFamily="$body" fontSize={13} lineHeight={16} color="$neutral3">
          Loading chart...
        </Text>
      </Flex>
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
    <Flex
      centered
      width="100%"
      height="100%"
      borderRadius="$rounded8"
      borderWidth={1}
      borderStyle="dashed"
      borderColor="$surface3"
      backgroundColor="$surface1"
    >
      <Text fontSize={24} marginBottom="$spacing8" opacity={0.2}>
        📈
      </Text>
      <Text fontFamily="$body" fontSize={13} lineHeight={16} fontWeight="535" color="$neutral3">
        {error ? "Unable to load chart data" : "No chart data available"}
      </Text>
      <Text fontFamily="$body" fontSize={13} lineHeight={16} color="$neutral3" opacity={0.3} marginTop="$spacing4">
        {error
          ? "Check that the API is running"
          : "Trade data will appear here"}
      </Text>
    </Flex>
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

/** Candle data shape with full OHLCV fields. */
interface CandleInput {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
}

/** Map candle intervals to their duration in seconds for real-time bucketing. */
const INTERVAL_SECONDS: Record<CandleInterval, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "1d": 86400,
};

/**
 * Compute the start-of-interval bucket (in seconds) for a given timestamp.
 * E.g. for a 5m interval, 12:03:22 → 12:00:00 (floored to the 5-min boundary).
 */
function intervalBucket(timestampSec: number, intervalSec: number): number {
  return Math.floor(timestampSec / intervalSec) * intervalSec;
}

/** The actual lightweight-charts render component. Dynamically imports the library. */
function LightweightChart({
  containerRef: _externalRef,
  candles,
  chartMode,
  interval,
  lineColor,
  topGradient,
  bottomGradient,
  onCrosshairMove,
  realtimeTrades,
  wsConnected,
  transitionTimestamp,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  candles: CandleInput[];
  chartMode: ChartMode;
  interval: CandleInterval;
  lineColor: string;
  topGradient: string;
  bottomGradient: string;
  onCrosshairMove?: (data: CrosshairData) => void;
  realtimeTrades?: RealtimeTrade[];
  wsConnected?: boolean;
  /** Timestamp (ms) marking the transition from historical to live data. */
  transitionTimestamp?: number | null;
}): React.ReactElement {
  const theme = useTheme();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<
    typeof import("lightweight-charts").createChart
  > | null>(null);
  // Store series ref for WS updates. Uses Record to avoid
  // importing lightweight-charts types at module level (dynamic import).
  const seriesRef = useRef<Record<string, unknown> | null>(null);
  const lastUpdateTimestampRef = useRef<number>(0);
  /** Set of trade IDs already processed to avoid duplicate updates. */
  const processedTradeIdsRef = useRef<Set<string>>(new Set());
  /** Track current candle OHLC state for real-time aggregation in candlestick mode. */
  const currentCandleRef = useRef<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  } | null>(null);

  const onCrosshairMoveRef = useRef(onCrosshairMove);
  onCrosshairMoveRef.current = onCrosshairMove;

  const chartModeRef = useRef(chartMode);
  chartModeRef.current = chartMode;

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
      const { createChart, AreaSeries, CandlestickSeries, CrosshairMode, createSeriesMarkers } =
        await import("lightweight-charts");

      if (disposed || !chartContainerRef.current) return;

      // Resolve theme tokens for lightweight-charts (accepts hex/rgba strings only)
      const neutral3Val = theme.neutral3?.val as string;
      const surface3Val = theme.surface3?.val as string;
      const surface2Val = theme.surface2?.val as string;

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight || 300,
        layout: {
          background: { color: "transparent" },
          textColor: neutral3Val,
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { color: surface3Val, style: 2 },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: neutral3Val,
            width: 1,
            style: 2,
            labelBackgroundColor: surface2Val,
          },
          horzLine: {
            color: neutral3Val,
            width: 1,
            style: 2,
            labelBackgroundColor: surface2Val,
          },
        },
        rightPriceScale: {
          borderColor: surface3Val,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        timeScale: {
          borderColor: surface3Val,
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: { vertTouchDrag: false },
      });

      chartRef.current = chart;

      // lightweight-charts expects time as seconds (UTC timestamp)
      type UTCTs = import("lightweight-charts").UTCTimestamp;

      if (chartMode === "candle") {
        // --- Candlestick Series ---
        const accent1Val = theme.accent1?.val as string;
        const criticalVal = theme.statusCritical?.val as string;
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: accent1Val,
          downColor: criticalVal,
          wickUpColor: accent1Val,
          wickDownColor: criticalVal,
          borderUpColor: accent1Val,
          borderDownColor: criticalVal,
          priceFormat: {
            type: "price",
            precision: 4,
            minMove: 0.0001,
          },
        });

        const chartData = candles
          .map((c) => ({
            time: (Math.floor(c.timestamp / 1000)) as UTCTs,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));

        candleSeries.setData(chartData);
        seriesRef.current = candleSeries as unknown as Record<string, unknown>;

        // Initialize currentCandleRef with the last candle for real-time aggregation.
        // Bucket the time to the interval boundary so incoming trades compare correctly.
        if (chartData.length > 0) {
          const last = chartData[chartData.length - 1];
          const intSec = INTERVAL_SECONDS[interval];
          currentCandleRef.current = {
            time: intervalBucket(last.time as number, intSec),
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
          };
          lastUpdateTimestampRef.current = last.time as number;
        }

        // Subscribe to crosshair — expose OHLC values
        chart.subscribeCrosshairMove((param) => {
          if (!onCrosshairMoveRef.current) return;

          if (
            !param.time ||
            param.point === undefined ||
            param.point.x < 0 ||
            param.point.y < 0
          ) {
            onCrosshairMoveRef.current({
              price: null,
              timestamp: null,
              chartMode: chartModeRef.current,
            });
            return;
          }

          const seriesData = param.seriesData.get(candleSeries);
          if (seriesData && "close" in seriesData) {
            const ohlc = seriesData as {
              open: number;
              high: number;
              low: number;
              close: number;
            };
            const ts = (param.time as number) * 1000;
            onCrosshairMoveRef.current({
              price: ohlc.close,
              timestamp: formatTimestamp(ts),
              open: ohlc.open,
              high: ohlc.high,
              low: ohlc.low,
              close: ohlc.close,
              chartMode: "candle",
            });
          }
        });
      } else {
        // --- Area Series (line + gradient) ---
        const areaSeries = chart.addSeries(AreaSeries, {
          lineColor,
          topColor: topGradient,
          bottomColor: bottomGradient,
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          crosshairMarkerBackgroundColor: lineColor,
          crosshairMarkerBorderColor: theme.neutral1?.val as string,
          crosshairMarkerBorderWidth: 2,
          priceFormat: {
            type: "price",
            precision: 4,
            minMove: 0.0001,
          },
        });

        const chartData = candles
          .map((c) => ({
            time: (Math.floor(c.timestamp / 1000)) as UTCTs,
            value: c.close,
          }))
          .sort((a, b) => (a.time as number) - (b.time as number));

        areaSeries.setData(chartData);
        seriesRef.current = areaSeries as unknown as Record<string, unknown>;
        currentCandleRef.current = null;

        if (chartData.length > 0) {
          lastUpdateTimestampRef.current = chartData[chartData.length - 1]
            .time as number;
        }

        // Subscribe to crosshair — single value (close only)
        chart.subscribeCrosshairMove((param) => {
          if (!onCrosshairMoveRef.current) return;

          if (
            !param.time ||
            param.point === undefined ||
            param.point.x < 0 ||
            param.point.y < 0
          ) {
            onCrosshairMoveRef.current({
              price: null,
              timestamp: null,
              chartMode: chartModeRef.current,
            });
            return;
          }

          const seriesData = param.seriesData.get(areaSeries);
          if (seriesData && "value" in seriesData) {
            const ts = (param.time as number) * 1000;
            onCrosshairMoveRef.current({
              price: seriesData.value as number,
              timestamp: formatTimestamp(ts),
              chartMode: "line",
            });
          }
        });
      }

      // Add transition marker between historical and live data
      // In lightweight-charts v5, use the createSeriesMarkers() plugin API
      if (transitionTimestamp && seriesRef.current) {
        const transitionTimeSec = Math.floor(transitionTimestamp / 1000) as UTCTs;
        // Check if the transition time falls within our candle data range
        const candleTimestamps = candles.map((c) => Math.floor(c.timestamp / 1000));
        const minTs = Math.min(...candleTimestamps);
        const maxTs = Math.max(...candleTimestamps);

        if (transitionTimeSec >= minTs && transitionTimeSec <= maxTs) {
          createSeriesMarkers(
            seriesRef.current as unknown as Parameters<typeof createSeriesMarkers>[0],
            [
              {
                time: transitionTimeSec,
                position: "aboveBar" as const,
                color: neutral3Val,
                shape: "arrowDown" as const,
                text: "New Venue",
              },
            ],
          );
        }
      }

      chart.timeScale().fitContent();

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

    // Capture ref values for cleanup function (react-hooks/exhaustive-deps)
    const processedIds = processedTradeIdsRef.current;

    return () => {
      disposed = true;
      seriesRef.current = null;
      currentCandleRef.current = null;
      lastUpdateTimestampRef.current = 0;
      processedIds.clear();
      if (chartRef.current) {
        const chart = chartRef.current;
        const observer = (chart as unknown as { _observer?: ResizeObserver })
          ._observer;
        if (observer) observer.disconnect();
        chart.remove();
        chartRef.current = null;
      }
    };
  }, [
    candles,
    chartMode,
    interval,
    lineColor,
    topGradient,
    bottomGradient,
    formatTimestamp,
    transitionTimestamp,
  ]);

  // Append new data points from WebSocket trades to the chart series
  useEffect(() => {
    if (!wsConnected || !realtimeTrades || realtimeTrades.length === 0) return;
    if (!seriesRef.current) return;

    // Process trades at or newer than the last update timestamp.
    // Use trade IDs to avoid reprocessing the same trade on effect re-runs,
    // while still allowing same-second trades to be folded into the current candle.
    const newTrades = realtimeTrades.filter((t) => {
      if (processedTradeIdsRef.current.has(t.id)) return false;
      const timeSec = Math.floor(t.timestamp / 1000);
      return timeSec >= lastUpdateTimestampRef.current;
    });

    if (newTrades.length === 0) return;

    // Sort by timestamp ascending
    const sorted = [...newTrades].sort((a, b) => a.timestamp - b.timestamp);

    // Cap processed IDs set to avoid unbounded memory growth
    if (processedTradeIdsRef.current.size > 500) {
      processedTradeIdsRef.current.clear();
    }

    const updateFn = seriesRef.current.update as
      | ((data: Record<string, unknown>) => void)
      | undefined;
    if (!updateFn) return;

    if (chartMode === "candle") {
      // In candlestick mode: aggregate trades into interval-aligned candles.
      // Bucket by the active timeframe (1m=60s, 5m=300s, etc.) so trades
      // within the same interval period update one candle bar.
      const intSec = INTERVAL_SECONDS[interval];

      for (const trade of sorted) {
        const timeSec = Math.floor(trade.timestamp / 1000);
        const bucket = intervalBucket(timeSec, intSec);

        if (
          currentCandleRef.current &&
          bucket === currentCandleRef.current.time
        ) {
          // Same interval bucket — update OHLC
          const candle = currentCandleRef.current;
          candle.high = Math.max(candle.high, trade.price);
          candle.low = Math.min(candle.low, trade.price);
          candle.close = trade.price;
        } else {
          // New interval bucket — start a fresh candle
          currentCandleRef.current = {
            time: bucket,
            open: trade.price,
            high: trade.price,
            low: trade.price,
            close: trade.price,
          };
        }

        try {
          updateFn({
            time: currentCandleRef.current.time,
            open: currentCandleRef.current.open,
            high: currentCandleRef.current.high,
            low: currentCandleRef.current.low,
            close: currentCandleRef.current.close,
          });
          lastUpdateTimestampRef.current = timeSec;
          processedTradeIdsRef.current.add(trade.id);
        } catch {
          // Silently ignore update errors (e.g., invalid time ordering)
        }
      }
    } else {
      // In line mode: append as individual points
      for (const trade of sorted) {
        const timeSec = Math.floor(trade.timestamp / 1000);
        try {
          updateFn({
            time: timeSec,
            value: trade.price,
          });
          lastUpdateTimestampRef.current = timeSec;
          processedTradeIdsRef.current.add(trade.id);
        } catch {
          // Silently ignore update errors (e.g., invalid time ordering)
        }
      }
    }
  }, [realtimeTrades, wsConnected, chartMode, interval]);

  return (
    <div
      ref={chartContainerRef}
      className="h-full w-full"
      aria-label="Price chart"
    />
  );
}
