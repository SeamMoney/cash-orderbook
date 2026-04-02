"use client";

import { useEffect, useState } from "react";

interface UseScrollCompactOptions {
  /** Current scroll Y position in pixels. */
  scrollY?: number;
  /** Scroll position above which the header becomes compact. */
  thresholdCompact?: number;
  /** Scroll position below which the header expands back. */
  thresholdExpanded?: number;
  /** Whether to enable scroll-based compaction. */
  enabled?: boolean;
}

const DEFAULT_THRESHOLD_COMPACT = 120;
const DEFAULT_THRESHOLD_EXPANDED = 60;

/**
 * Returns whether the header should be in "compact" (sticky) mode based on scroll.
 * Uses hysteresis (different thresholds for compact vs expanded) to avoid flickering.
 * Based on Uniswap's useScrollCompact pattern.
 */
export function useScrollCompact({
  scrollY,
  thresholdCompact = DEFAULT_THRESHOLD_COMPACT,
  thresholdExpanded = DEFAULT_THRESHOLD_EXPANDED,
  enabled = true,
}: UseScrollCompactOptions): boolean {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    if (!enabled || scrollY === undefined) {
      setIsCompact(false);
      return;
    }

    setIsCompact((prev) => {
      if (!prev && scrollY > thresholdCompact) {
        return true;
      }
      if (prev && scrollY < thresholdExpanded) {
        return false;
      }
      return prev;
    });
  }, [enabled, scrollY, thresholdCompact, thresholdExpanded]);

  return isCompact;
}
