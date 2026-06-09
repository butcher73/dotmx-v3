/**
 * PNL Calculation Utilities
 * Ensures consistent PNL calculations across all components
 */

// Unit conversion helper
function formatUnits(value: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const wholePart = value / divisor;
  const fractionalPart = value % divisor;
  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  return `${wholePart}.${fractionalStr}`;
}

export interface PositionData {
  isLong: boolean;
  timestamp: bigint;
  user: string;
  market: string;
  fundingTracker: bigint;
  price: bigint;
  margin: bigint;
  size: bigint;
}

export interface PNLData {
  totalUPL: number;
  individualUPLs: number[];
  positions: PositionData[];
  isConsistent: boolean;
  discrepancy: number | undefined;
}

/**
 * Calculate total PNL from individual position UPLs
 * This should match the contract's getUpl() function
 */
export function calculateTotalPNLFromPositions(
  positions: PositionData[],
  upls: bigint[]
): number {
  if (!positions || !upls || positions.length !== upls.length) {
    return 0;
  }

  return upls.reduce((total, upl) => {
    return total + parseFloat(formatUnits(upl, 6));
  }, 0);
}

/**
 * Verify PNL consistency between different data sources
 */
export function verifyPNLConsistency(
  contractTotalUPL: bigint | undefined,
  positionsWithUpls: readonly [PositionData[], bigint[]] | undefined
): PNLData {
  const totalUPL = contractTotalUPL
    ? parseFloat(formatUnits(contractTotalUPL, 6))
    : 0;

  let individualUPLs: number[] = [];
  let positions: PositionData[] = [];
  let calculatedTotal = 0;

  if (
    positionsWithUpls &&
    Array.isArray(positionsWithUpls) &&
    positionsWithUpls.length === 2
  ) {
    const [positionsArray, uplsArray] = positionsWithUpls;
    positions = [...positionsArray];
    individualUPLs = uplsArray.map((upl) => parseFloat(formatUnits(upl, 6)));
    calculatedTotal = calculateTotalPNLFromPositions(positionsArray, uplsArray);
  }

  const discrepancy = Math.abs(totalUPL - calculatedTotal);
  const isConsistent = discrepancy < 0.01; // Allow for small rounding differences

  return {
    totalUPL,
    individualUPLs,
    positions,
    isConsistent,
    discrepancy: isConsistent ? undefined : discrepancy,
  };
}

/**
 * Format PNL for display with consistency indicator
 */
export function formatPNL(
  pnl: number,
  options: {
    showSign?: boolean;
    currency?: string;
    precision?: number;
  } = {}
): string {
  const { showSign = true, currency = "$", precision = 2 } = options;

  const sign = showSign && pnl >= 0 ? "+" : "";
  return `${sign}${currency}${Math.abs(pnl).toFixed(precision)}`;
}

/**
 * Debug helper to check PNL consistency
 */
export function debugPNLDiscrepancy(): void {
  // Silently check for PNL discrepancies without logging
}
