"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks window scroll position using requestAnimationFrame for performance.
 * Returns the current scroll Y height.
 */
export function useScroll(): { height: number } {
  const [height, setHeight] = useState(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const updateScrollState = (): void => {
      setHeight(window.scrollY);
      rafIdRef.current = null;
    };

    const scrollListener = (): void => {
      if (rafIdRef.current !== null) {
        return;
      }
      rafIdRef.current = requestAnimationFrame(updateScrollState);
    };

    window.addEventListener("scroll", scrollListener, { passive: true });
    // Initial state
    updateScrollState();

    return () => {
      window.removeEventListener("scroll", scrollListener);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  return { height };
}
