/**
 * Consistent PNL Hook
 * Stub implementation - returns mock PNL consistency data
 */

export interface ConsistentPNLResult {
  totalUPL: number;
  isConsistent: boolean;
  discrepancy: number | undefined;
}

/**
 * Check PNL consistency
 * Always returns consistent state since we're using backend API
 */
export function useConsistentPNL(): ConsistentPNLResult {
  return {
    totalUPL: 0,
    isConsistent: true,
    discrepancy: undefined,
  };
}
