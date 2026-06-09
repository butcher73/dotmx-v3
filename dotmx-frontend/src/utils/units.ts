/**
 * Utility functions for unit conversions
 * These functions handle conversion between bigint and decimal numbers
 */

/**
 * Format a bigint value to a decimal string
 * @param value - The bigint value to format
 * @param decimals - The number of decimal places (default: 18)
 * @returns Formatted decimal string
 */
export function formatUnits(value: bigint, decimals: number = 18): string {
  const divisor = 10n ** BigInt(decimals);
  const quotient = value / divisor;
  const remainder = value % divisor;

  if (remainder === 0n) {
    return quotient.toString();
  }

  const remainderStr = remainder.toString().padStart(decimals, "0");
  const trimmedRemainder = remainderStr.replace(/0+$/, "");

  return `${quotient}.${trimmedRemainder}`;
}

/**
 * Parse a decimal string to a bigint value
 * @param value - The decimal string to parse
 * @param decimals - The number of decimal places (default: 18)
 * @returns Bigint value
 */
export function parseUnits(value: string, decimals: number = 18): bigint {
  const [whole, fraction = ""] = value.split(".");

  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  const combined = whole + paddedFraction;

  return BigInt(combined);
}

/**
 * Format USDC (6 decimals)
 */
export function formatUSDC(amount: bigint): string {
  return formatUnits(amount, 6);
}

/**
 * Parse USDC (6 decimals)
 */
export function parseUSDC(amount: string): bigint {
  return parseUnits(amount, 6);
}
