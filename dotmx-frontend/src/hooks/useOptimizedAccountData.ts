/**
 * Optimized Account Data Hook
 * Stub implementation - returns mock account data
 */

import { useState, useCallback } from "react";

export interface OptimizedAccountData {
  protocolBalance: bigint;
  usdcBalance: bigint;
  unrealizedPnl: number;
  positions: unknown[];
  isLoading: boolean;
  refreshAll: () => Promise<void>;
}

/**
 * Get optimized account data
 * Returns mock data - real data should come from API
 */
export function useOptimizedAccountData(): OptimizedAccountData {
  const [isLoading, setIsLoading] = useState(false);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    // TODO: Implement API call to fetch account data
    await new Promise((resolve) => setTimeout(resolve, 100));
    setIsLoading(false);
  }, []);

  return {
    protocolBalance: BigInt(0),
    usdcBalance: BigInt(0),
    unrealizedPnl: 0,
    positions: [],
    isLoading,
    refreshAll,
  };
}
