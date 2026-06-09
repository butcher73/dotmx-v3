/**
 * Global Formatting Utilities
 *
 * Centralized formatting functions for prices, amounts, percentages, and other values
 * Used across the entire trading application for consistent formatting
 */

// Unit conversion helper
function formatUnits(value: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const wholePart = value / divisor;
  const fractionalPart = value % divisor;
  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  return `${wholePart}.${fractionalStr}`;
}

// Decimal precision constants
export const DECIMAL_PRECISION = {
  price: 6,
  price18: 6, // For 18-decimal blockchain prices, display with 6 decimal places
  amount: 6,
  usd: 2,
  percentage: 2,
  leverage: 2,
} as const;

// Status and side color mappings
export const STATUS_COLORS = {
  active: "text-green-500",
  cancelled: "text-red-500",
  executed: "text-blue-500",
  liquidated: "text-orange-500",
} as const;

export const SIDE_COLORS = {
  buy: "text-green-500",
  long: "text-green-500",
  sell: "text-red-500",
  short: "text-red-500",
} as const;

export function formatPrice18(price: number | undefined): string {
  if (price === undefined || price === null || isNaN(price)) {
    return "N/A";
  }
  return price.toFixed(DECIMAL_PRECISION.price18);
}

export function formatAmount(amount: number | undefined): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return "N/A";
  }
  return amount.toFixed(DECIMAL_PRECISION.amount);
}

export function formatUSD(value: number | undefined): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "N/A";
  }
  return `$${value.toFixed(DECIMAL_PRECISION.usd)}`;
}

// Signed USD formatting with sign before dollar sign: +$7.00, -$15.50
export function formatSignedUSD(value: number | undefined): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "N/A";
  }
  const sign = value >= 0 ? "+" : "-";
  const absValue = Math.abs(value);
  return `${sign}$${absValue.toFixed(DECIMAL_PRECISION.usd)}`;
}

export function formatPercentage(value: number | undefined): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "N/A";
  }
  return `${value.toFixed(DECIMAL_PRECISION.percentage)}%`;
}

export function formatLeverage(leverage: number | undefined): string {
  if (leverage === undefined || leverage === null || isNaN(leverage)) {
    return "N/A";
  }
  return `${leverage.toFixed(DECIMAL_PRECISION.leverage)}x`;
}

export function formatPnL(pnl: number | undefined): string {
  if (pnl === undefined || pnl === null || isNaN(pnl)) {
    return "N/A";
  }
  return formatSignedUSD(pnl);
}

export function formatPnLWithColor(pnl: number | undefined): {
  formatted: string;
  color: string;
} {
  if (pnl === undefined || pnl === null || isNaN(pnl)) {
    return { formatted: "N/A", color: "text-gray-500" };
  }
  return {
    formatted: formatPnL(pnl),
    color: pnl >= 0 ? "text-emerald-400" : "text-red-400",
  };
}

export function formatPrice2Decimals(price: number | undefined): string {
  if (price === undefined || price === null || isNaN(price)) {
    return "N/A";
  }
  return price.toFixed(2);
}

export function formatPrice2DecimalsWithCommas(
  price: number | undefined
): string {
  if (price === undefined || price === null || isNaN(price)) {
    return "N/A";
  }
  // Show 4 decimals if price is between 0 and 1 (0.xx format), otherwise 2 decimals
  const decimals = price > 0 && price < 1 ? 4 : 2;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

export function formatBigIntPrice2Decimals(
  price: bigint | undefined,
  decimals: number = 18
): string {
  if (price === undefined || price === null) {
    return "N/A";
  }
  const formatted = Number(formatUnits(price, decimals));
  return formatPrice2Decimals(formatted);
}

export function formatBigIntPrice2DecimalsWithCommas(
  price: bigint | undefined,
  decimals: number = 18
): string {
  if (price === undefined || price === null) {
    return "N/A";
  }
  const formatted = Number(formatUnits(price, decimals));
  return formatPrice2DecimalsWithCommas(formatted);
}

// Blockchain-specific formatting functions
export function formatBigIntPrice(
  price: bigint | undefined,
  decimals: number = 18
): string {
  if (price === undefined || price === null) {
    return "N/A";
  }
  const formatted = Number(formatUnits(price, decimals));
  return formatPrice18(formatted);
}

export function formatBigIntUSD(
  value: bigint | undefined,
  decimals: number = 6
): string {
  if (value === undefined || value === null) {
    return "N/A";
  }
  const formatted = Number(formatUnits(value, decimals));
  return formatUSD(formatted);
}

export function formatBigIntAmount(
  amount: bigint | undefined,
  decimals: number = 6
): string {
  if (amount === undefined || amount === null) {
    return "N/A";
  }
  const formatted = Number(formatUnits(amount, decimals));
  return formatAmount(formatted);
}

// Utility functions
export function getPnLColor(pnl: number | undefined): string {
  if (pnl === undefined || pnl === null || isNaN(pnl)) {
    return "text-gray-500";
  }
  return pnl >= 0 ? "text-emerald-400" : "text-red-400";
}

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "text-gray-500";
}

export function getSideColor(side: string): string {
  return SIDE_COLORS[side as keyof typeof SIDE_COLORS] || "text-gray-500";
}

export function truncateAddress(
  address: string,
  startLength: number = 6,
  endLength: number = 4
): string {
  if (address.length <= startLength + endLength) return address;
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
}

export function truncateOrderId(orderId: string): string {
  if (orderId.length <= 8) return orderId;
  return `${orderId.slice(0, 4)}...${orderId.slice(-4)}`;
}

// Mathematical utility functions
export function calculateUnrealizedPnLPercentage(
  unrealizedPnl: number | undefined,
  positionMargin: number | undefined
): number | undefined {
  if (
    unrealizedPnl === undefined ||
    positionMargin === undefined ||
    positionMargin === 0
  ) {
    return undefined;
  }
  return (unrealizedPnl / positionMargin) * 100;
}

// Validation functions
export function isValidPrice(price: number | undefined): boolean {
  return price !== undefined && price !== null && !isNaN(price) && price > 0;
}

export function isValidAmount(amount: number | undefined): boolean {
  return (
    amount !== undefined && amount !== null && !isNaN(amount) && amount > 0
  );
}

// Number formatting with locale support
export function formatNumber(
  value: number | undefined,
  options?: Intl.NumberFormatOptions
): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", options).format(value);
}

export function formatCompactNumber(value: number | undefined): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

// Token logo mapping
export const TOKEN_LOGOS: Record<string, string> = {
  BTC: "/img/token/btc.svg",
  ETH: "/img/token/eth.svg",
  BNB: "/img/token/bnb.svg",
  ADA: "/img/token/ada.svg",
  XRP: "/img/token/xrp.svg",
  SOL: "/img/token/sol.svg",
  DOGE: "/img/token/doge.svg",
  MATIC: "/img/token/polygon.svg",
  SHIB: "/img/token/shib.svg",
  LINK: "/img/token/link.svg",
  OP: "/img/token/op.svg",
  DOT: "/img/token/dot.svg",
  ARB: "/img/token/arb.svg",
  WLD: "/img/token/wld.svg",
  TRX: "/img/token/trx.svg",
  SUI: "/img/token/sui.svg",
};

// Market data specific formatting functions (from hooks utilities)
export function formatMarketPrice(price: number): string {
  if (!price || !isFinite(price) || isNaN(price)) return "$0.00";
  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  } else if (price >= 1) {
    return `$${price.toFixed(2)}`;
  } else if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  } else {
    return `$${price.toFixed(8)}`;
  }
}

export function formatVolume(volume: number): string {
  if (volume >= 1000000000) {
    return `$${(volume / 1000000000).toFixed(2)}B`;
  } else if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(2)}M`;
  } else if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(2)}K`;
  } else {
    return `$${volume.toFixed(2)}`;
  }
}

export function formatChangePercent(change: number): string {
  const sign = change >= 0 ? "+" : "-";
  const absValue = Math.abs(change);
  return `${sign}${absValue.toFixed(2)}%`;
}

// Format balance with 4 decimals if < 10, no rounding up (for account metrics)
export function formatAvailableBalance(balance: number): string {
  if (balance < 10) {
    // Truncate to 4 decimal places without rounding up
    const truncated = Math.floor(balance * 10000) / 10000;
    return truncated.toLocaleString("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  } else {
    return balance.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}

// Balance and margin formatting - handles different ranges appropriately
export function formatBalance(balance: number): string {
  if (balance >= 1000000000) {
    return `$${(balance / 1000000000).toFixed(0)}B`;
  } else if (balance >= 1000000) {
    return `$${(balance / 1000000).toFixed(0)}M`;
  } else if (balance >= 1000) {
    return `$${(balance / 1000).toFixed(0)}K`;
  } else {
    return `$${balance.toFixed(2)}`;
  }
}

// Signed balance formatting with sign before dollar sign
export function formatSignedBalance(balance: number): string {
  const sign = balance >= 0 ? "+" : "-";
  const absValue = Math.abs(balance);

  if (absValue >= 1000000000) {
    return `${sign}$${(absValue / 1000000000).toFixed(0)}B`;
  } else if (absValue >= 1000000) {
    return `${sign}$${(absValue / 1000000).toFixed(0)}M`;
  } else if (absValue >= 1000) {
    return `${sign}$${(absValue / 1000).toFixed(0)}K`;
  } else {
    return `${sign}$${absValue.toFixed(2)}`;
  }
}

// Standard USD formatting with 2 decimals and locale
export function formatUSDWithLocale(value: number): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "N/A";
  }
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Leverage formatting
export function formatLeverageValue(leverage: number): string {
  if (leverage === undefined || leverage === null || isNaN(leverage)) {
    return "N/A";
  }
  return `${leverage.toFixed(1)}x`;
}

// Price formatting with smart decimals based on price range
export function formatPrice(price: number): string {
  if (price === undefined || price === null || isNaN(price)) {
    return "N/A";
  }

  if (price >= 1000) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (price >= 1) {
    return price.toFixed(2);
  } else if (price >= 0.01) {
    return price.toFixed(4);
  } else {
    return price.toFixed(8);
  }
}

// Size/position value formatting
export function formatSizeUSD(value: number): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "N/A";
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

// Percentage formatting with 1 decimal place
export function formatPercentage1(value: number): string {
  if (value === undefined || value === null || isNaN(value)) {
    return "N/A";
  }
  return `${value.toFixed(1)}%`;
}

// Fee/small amount formatting
export function formatFee(fee: number): string {
  if (fee === undefined || fee === null || isNaN(fee)) {
    return "N/A";
  }
  return `${fee.toFixed(2)} USDC`;
}

// Margin level percentage formatting
export function formatMarginLevel(marginLevel: number): string {
  if (marginLevel === undefined || marginLevel === null || isNaN(marginLevel)) {
    return "N/A";
  }
  return `${marginLevel.toFixed(0)}%`;
}

// Error message amount formatting
export function formatErrorAmount(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return "N/A";
  }
  return amount.toFixed(2);
}

// Exact USDC amount formatting with 6 decimal precision (no rounding)
export function formatExactUSDC(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return "0";
  }
  // Use toFixed(6) to preserve exact 6 decimal precision for USDC
  return amount.toFixed(6);
}

/**
 * Format a crypto amount string by stripping trailing zeros.
 * Keeps at least `minDecimals` decimal places (default 2) for readability,
 * and at most `maxDecimals` significant decimal digits (default 8).
 *
 * Examples:
 *   "0.000000010000000000" → "0.00000001"
 *   "1.500000000000000000" → "1.50"
 *   "100.000000"           → "100.00"
 *   "0.123456789012"       → "0.12345678"
 */
export function formatCryptoAmount(
  value: string | number | undefined | null,
  maxDecimals = 8,
  minDecimals = 2
): string {
  if (value == null || value === "") return "0";

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";

  // Format with max precision then strip trailing zeros
  const formatted = num.toFixed(maxDecimals);

  // Remove trailing zeros, but keep at least minDecimals
  const parts = formatted.split(".");
  const intPart = parts[0] ?? "0";
  const decPart = parts[1];
  if (!decPart) return intPart;

  // Trim trailing zeros
  let trimmed = decPart.replace(/0+$/, "");

  // Pad to minimum decimals
  trimmed = trimmed.padEnd(minDecimals, "0");

  return `${intPart}.${trimmed}`;
}

export function calculateChangePercent(
  current: number,
  previous: number
): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}
