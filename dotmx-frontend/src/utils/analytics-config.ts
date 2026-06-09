// Analytics configuration and constants

export const ANALYTICS_CONFIG = {
  // Environment settings
  ENABLE_IN_DEVELOPMENT: false,

  // Performance settings
  QUEUE_FLUSH_INTERVAL: 1000, // 1 second
  MAX_QUEUE_SIZE: 10,

  // Thresholds for automatic categorization
  THRESHOLDS: {
    LARGE_POSITION: 5000,
    WHALE_POSITION: 50000,
    SIGNIFICANT_DEPOSIT: 1000,
    WHALE_DEPOSIT: 10000,
    HIGH_PROFIT: 1000,
    MEDIUM_PROFIT: 500,
    HIGH_VOLUME: 100000,
    MEDIUM_VOLUME: 50000,
    EXPERT_STREAK: 10,
    NOVICE_STREAK: 5,
  },

  // Event priorities (for potential future rate limiting)
  EVENT_PRIORITIES: {
    HIGH: ["first_trade", "account_funded", "large_position_opened"],
    MEDIUM: ["wallet_connect", "symbol_change", "profitable_trade"],
    LOW: ["button_click", "modal_open", "page_view"],
  },

  // Sampling rates (for potential future implementation)
  SAMPLING_RATES: {
    page_view: 1.0, // Track all page views
    button_click: 0.8, // Track 80% of button clicks
    api_call: 0.5, // Track 50% of API calls (for performance)
  },
};

// Common event labels and categories
export const ANALYTICS_LABELS = {
  PAGES: {
    TRADING: "/trade/perp",
    LIQUIDITY: "/liquidity",
    PORTFOLIO: "/portfolio",
    ABOUT: "/about",
  },

  BUTTONS: {
    CONNECT_WALLET: "connect-wallet",
    APPROVE_USDC: "approve-usdc",
    ADD_LIQUIDITY: "add-liquidity",
    REMOVE_LIQUIDITY: "remove-liquidity",
    OPEN_TRADE: "open-trade",
    CLOSE_TRADE: "close-trade",
  },

  SYMBOLS: {
    BTC: "BTCUSDC",
    ETH: "ETHUSDC",
    BNB: "BNBUSDC",
    SOL: "SOLUSDC",
    XRP: "XRPUSDC",
  },

  WALLET_TYPES: {
    METAMASK: "metamask",
    WALLET_CONNECT: "walletconnect",
    COINBASE: "coinbase",
  },
};

// Helper functions for analytics
export const getEventSampleRate = (eventAction: string): number => {
  return (
    ANALYTICS_CONFIG.SAMPLING_RATES[
      eventAction as keyof typeof ANALYTICS_CONFIG.SAMPLING_RATES
    ] || 1.0
  );
};

export const shouldTrackEvent = (eventAction: string): boolean => {
  const sampleRate = getEventSampleRate(eventAction);
  return Math.random() < sampleRate;
};

export const isHighPriorityEvent = (eventAction: string): boolean => {
  return ANALYTICS_CONFIG.EVENT_PRIORITIES.HIGH.includes(eventAction);
};

// Analytics validation
export const validateEvent = (event: {
  action: string;
  category?: string;
  label?: string;
  value?: number;
}): boolean => {
  if (!event.action || typeof event.action !== "string") {
    return false;
  }

  if (
    event.value !== undefined &&
    (typeof event.value !== "number" || isNaN(event.value))
  ) {
    return false;
  }

  return true;
};

// Error logging utility
export const logAnalyticsError = (
  error: Error | unknown,
  context?: string
): void => {
  if (process.env.NODE_ENV === "development") {
    console.error(
      `❌ Analytics Error${context ? ` (${context})` : ""}:`,
      error
    );
  }
};
