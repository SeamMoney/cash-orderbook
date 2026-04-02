import { useState, useEffect, useRef } from "react";

/**
 * Ensures a loading state is displayed for at least `minMs` milliseconds
 * on the first render. After the initial display, the actual loading state
 * is returned without any additional delay.
 *
 * @param loading - The actual loading state from a data hook.
 * @param minMs - Minimum display duration in milliseconds (default: 300).
 * @returns `true` while the minimum duration hasn't elapsed or data is still loading.
 */
export function useMinDuration(loading: boolean, minMs = 300): boolean {
  const [minElapsed, setMinElapsed] = useState(false);
  const hasCompletedInitial = useRef(false);

  useEffect(() => {
    // Only enforce the minimum duration on the first load cycle
    if (hasCompletedInitial.current) return;

    const timer = setTimeout(() => {
      setMinElapsed(true);
      hasCompletedInitial.current = true;
    }, minMs);

    return () => clearTimeout(timer);
  }, [minMs]);

  // If the initial minimum hasn't elapsed yet, always show loading
  if (!minElapsed) return true;

  // After initial display, pass through the actual loading state
  return loading;
}
