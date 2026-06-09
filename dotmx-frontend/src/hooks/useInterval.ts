/**
 * useInterval — declarative polling primitive with automatic cleanup
 *
 * Pass `delay: null` to pause the interval without unmounting.
 *
 * Usage:
 *   useInterval(fetchData, autoRefresh ? 10_000 : null);
 */

import { useEffect, useRef } from "react";

export function useInterval(callback: () => void, delay: number | null) {
  // Keep the latest callback without invalidating the effect
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => callbackRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
