// Global constants for the trading application

// Re-export from global formatting utilities for backward compatibility
export {
  DECIMAL_PRECISION,
  STATUS_COLORS,
  SIDE_COLORS,
} from "@/utils/formatting";

export const ORDER_STATUSES = {
  ACTIVE: "active",
  CANCELLED: "cancelled",
  EXECUTED: "executed",
  LIQUIDATED: "liquidated",
} as const;

export const ORDER_TYPES = {
  LIMIT: "limit",
  MARKET: "market",
  STOP: "stop",
} as const;

export const ORDER_SIDES = {
  BUY: "buy",
  SELL: "sell",
  LONG: "long",
  SHORT: "short",
} as const;

// Close percentage options for partial closing
export const CLOSE_PERCENTAGES = [25, 50, 75, 100] as const;

// Refresh intervals
export const REFRESH_INTERVALS = {
  PNL_UPDATE: 5000, // 5 seconds for PnL updates
  DATA_REFRESH: 1000, // 1 seconds after transactions
} as const;

// Social media links and contact
export const SOCIAL_LINKS = {
  TWITTER: "https://x.com/dotmx_hq",
  TELEGRAM: "https://t.me/dotmx_hq",
  EMAIL: "info@dotmx.xyz",
} as const;
