/**
 * useAsyncAction — generic primitive for loading/error/execute state
 *
 * Wraps any async function so that the caller gets a stable `execute`
 * reference alongside `isLoading` and `error` state — eliminating the
 * repeated try/catch/finally boilerplate throughout the hook layer.
 *
 * Usage:
 *   const { execute: placeOrder, isLoading, error } = useAsyncAction(
 *     (order: OrderRequest) => apiClient.placeOrder(order),
 *     "Failed to place order"
 *   );
 */

import { useState, useCallback, useRef } from "react";

export function useAsyncAction<TResult, TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<TResult>,
  defaultError = "Operation failed"
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Keep the latest fn reference so `execute` stays stable across renders
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      setIsLoading(true);
      setError(null);
      try {
        return await fnRef.current(...args);
      } catch (err) {
        const caught = err instanceof Error ? err : new Error(defaultError);
        setError(caught);
        throw caught;
      } finally {
        setIsLoading(false);
      }
    },
    [defaultError]
  );

  return { execute, isLoading, error };
}
