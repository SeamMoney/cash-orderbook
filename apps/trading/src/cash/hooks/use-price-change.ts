import { useMemo } from "react";
import { useCandles, type CandleData } from "./use-candles";

/**
 * Hook to compute the 24h price change percentage from candle data.
 * Uses the 1h candles (which cover a 24h window) and compares
 * the first close to the last close.
 *
 * Returns { change24h, loading, error }.
 */
export function usePriceChange(): {
  change24h: number | null;
  loading: boolean;
  error: string | null;
} {
  // Use 1h candles to get good 24h coverage
  const { candles, loading, error } = useCandles("1h", 15000);

  const change24h = useMemo((): number | null => {
    if (candles.length < 2) return null;

    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    // Filter candles within the 24h window
    const recentCandles: CandleData[] = candles.filter(
      (c) => c.timestamp >= twentyFourHoursAgo,
    );

    // If we have no candles in the 24h window, use all available candles
    const workingCandles =
      recentCandles.length >= 2 ? recentCandles : candles;

    if (workingCandles.length < 2) return null;

    const firstClose = workingCandles[0].close;
    const lastClose = workingCandles[workingCandles.length - 1].close;

    if (firstClose === 0) return null;

    return ((lastClose - firstClose) / firstClose) * 100;
  }, [candles]);

  return { change24h, loading, error };
}
