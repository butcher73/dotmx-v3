// Google Analytics utility functions for event tracking
import {
  ANALYTICS_CONFIG,
  validateEvent,
  shouldTrackEvent,
} from "./analytics-config";

// Enhanced types for better type safety and IntelliSense
export type EventCategory =
  | "navigation"
  | "interaction"
  | "trading"
  | "wallet"
  | "market"
  | "error"
  | "performance"
  | "major_milestone"
  | "major_trading"
  | "major_risk"
  | "custom"
  | "general";

export type TradingSide = "long" | "short";
export type TradeModificationType = "stop_loss" | "take_profit" | "size";
export type RiskLevel = "high" | "critical";
export type StreakType = "winning" | "trading";
export type UserTier =
  | "whale"
  | "premium"
  | "large"
  | "medium"
  | "standard"
  | "novice"
  | "expert"
  | "legendary";

// Optimized config type
type GAConfig = {
  event_category?: EventCategory;
  event_label?: string;
  value?: number;
  custom_parameters?: Record<string, string | number | boolean>;
  [key: string]:
    | string
    | number
    | boolean
    | Record<string, string | number | boolean>
    | undefined;
};

declare global {
  interface Window {
    gtag: (command: string, targetId: string, config?: GAConfig) => void;
    dataLayer: unknown[];
  }
}

export interface GAEvent {
  action: string;
  category?: EventCategory;
  label?: string;
  value?: number;
  custom_parameters?: Record<string, string | number | boolean>;
}

// Environment and configuration
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_CLIENT = typeof window !== "undefined";
const ENABLE_ANALYTICS = IS_PRODUCTION && IS_CLIENT;

// Performance optimizations
let eventQueue: GAEvent[] = [];
let isFlushingQueue = false;
const QUEUE_FLUSH_INTERVAL = ANALYTICS_CONFIG.QUEUE_FLUSH_INTERVAL;
const MAX_QUEUE_SIZE = ANALYTICS_CONFIG.MAX_QUEUE_SIZE;

// Utility functions
export const getUserTier = (amount: number): UserTier => {
  if (amount > 100000) return "whale";
  if (amount > 50000) return "premium";
  if (amount > 10000) return "large";
  if (amount > 5000) return "medium";
  return "standard";
};

export const getPositionTier = (size: number): UserTier => {
  if (size > 50000) return "whale";
  if (size > 10000) return "large";
  if (size > 5000) return "medium";
  return "standard";
};

export const getProfitTier = (pnl: number): UserTier => {
  if (pnl > 1000) return "premium";
  if (pnl > 500) return "medium";
  return "standard";
};

export const getVolumeTier = (volume: number): UserTier => {
  if (volume > 100000) return "whale";
  if (volume > 50000) return "premium";
  return "medium";
};

export const getAchievementTier = (count: number): UserTier => {
  if (count >= 10) return "legendary";
  if (count >= 5) return "expert";
  return "novice";
};

// Enhanced tracking function with queuing and error handling
export const trackEvent = (event: GAEvent): void => {
  try {
    // Validate event
    if (!validateEvent(event)) {
      return;
    }

    // Check sampling rate
    if (!shouldTrackEvent(event.action)) {
      return;
    }

    // Skip tracking in development or if analytics not available
    if (!ENABLE_ANALYTICS) {
      return;
    }

    // Validate event data
    if (!event.action) {
      return;
    }

    // Add to queue for batching
    eventQueue.push(event);

    // Flush queue if it gets too large
    if (eventQueue.length >= MAX_QUEUE_SIZE) {
      flushEventQueue();
    }

    // Set up auto-flush if not already running
    if (!isFlushingQueue) {
      setTimeout(flushEventQueue, QUEUE_FLUSH_INTERVAL);
      isFlushingQueue = true;
    }
  } catch {
    // Silent fail for analytics errors
  }
};

// Batch flush events for better performance
const flushEventQueue = (): void => {
  if (eventQueue.length === 0) {
    isFlushingQueue = false;
    return;
  }

  const eventsToFlush = [...eventQueue];
  eventQueue = [];

  eventsToFlush.forEach((event) => {
    if (window.gtag) {
      const gtagConfig: Record<string, string | number | boolean> = {
        event_category: event.category || "general",
      };

      if (event.label !== undefined) {
        gtagConfig.event_label = event.label;
      }
      if (event.value !== undefined) {
        gtagConfig.value = event.value;
      }
      if (event.custom_parameters) {
        Object.assign(gtagConfig, event.custom_parameters);
      }

      window.gtag("event", event.action, gtagConfig);
    }
  });

  isFlushingQueue = false;
};

// Optimized analytics object with type safety
export const analytics = {
  // Trading events
  trade: {
    open: (symbol: string, side: TradingSide, size: number, leverage: number) =>
      trackEvent({
        action: "trade_open",
        category: "trading",
        label: `${symbol}_${side}`,
        value: size,
        custom_parameters: {
          symbol,
          side,
          size,
          leverage,
          position_tier: getPositionTier(size),
        },
      }),

    close: (symbol: string, side: TradingSide, pnl: number) =>
      trackEvent({
        action: "trade_close",
        category: "trading",
        label: `${symbol}_${side}`,
        value: pnl,
        custom_parameters: {
          symbol,
          side,
          pnl,
          profit_tier: getProfitTier(pnl),
          is_profitable: pnl > 0,
        },
      }),

    modify: (symbol: string, type: TradeModificationType) =>
      trackEvent({
        action: "trade_modify",
        category: "trading",
        label: `${symbol}_${type}`,
        custom_parameters: {
          symbol,
          modification_type: type,
        },
      }),
  },

  // Wallet events
  wallet: {
    connect: (walletType: string) =>
      trackEvent({
        action: "wallet_connect",
        category: "wallet",
        label: walletType,
        custom_parameters: {
          wallet_type: walletType,
        },
      }),

    disconnect: () =>
      trackEvent({
        action: "wallet_disconnect",
        category: "wallet",
      }),

    deposit: (amount: number, token: string) =>
      trackEvent({
        action: "wallet_deposit",
        category: "wallet",
        label: token,
        value: amount,
        custom_parameters: {
          token,
          amount,
          user_tier: getUserTier(amount),
        },
      }),

    withdraw: (amount: number, token: string) =>
      trackEvent({
        action: "wallet_withdraw",
        category: "wallet",
        label: token,
        value: amount,
        custom_parameters: {
          token,
          amount,
          user_tier: getUserTier(amount),
        },
      }),
  },

  // UI events
  ui: {
    pageView: (
      pageName: string,
      additionalData?: Record<string, string | number | boolean>
    ) =>
      trackEvent({
        action: "page_view",
        category: "navigation",
        label: pageName,
        custom_parameters: {
          page_name: pageName,
          timestamp: Date.now(),
          ...additionalData,
        },
      }),

    buttonClick: (
      buttonName: string,
      location: string,
      additionalData?: Record<string, string | number | boolean>
    ) =>
      trackEvent({
        action: "button_click",
        category: "interaction",
        label: buttonName,
        custom_parameters: {
          button_name: buttonName,
          location,
          ...additionalData,
        },
      }),

    modalOpen: (modalName: string) =>
      trackEvent({
        action: "modal_open",
        category: "interaction",
        label: modalName,
        custom_parameters: {
          modal_name: modalName,
        },
      }),

    modalClose: (modalName: string) =>
      trackEvent({
        action: "modal_close",
        category: "interaction",
        label: modalName,
        custom_parameters: {
          modal_name: modalName,
        },
      }),
  },

  // Market events
  market: {
    symbolChange: (fromSymbol: string, toSymbol: string) =>
      trackEvent({
        action: "symbol_change",
        category: "market",
        label: `${fromSymbol}_to_${toSymbol}`,
        custom_parameters: {
          from_symbol: fromSymbol,
          to_symbol: toSymbol,
        },
      }),

    chartTimeframeChange: (timeframe: string) =>
      trackEvent({
        action: "chart_timeframe_change",
        category: "market",
        label: timeframe,
        custom_parameters: {
          timeframe,
        },
      }),
  },

  // Error events
  error: {
    transaction: (
      errorType: string,
      errorMessage: string,
      additionalData?: Record<string, string | number | boolean>
    ) =>
      trackEvent({
        action: "transaction_error",
        category: "error",
        label: errorType,
        custom_parameters: {
          error_type: errorType,
          error_message: errorMessage,
          timestamp: Date.now(),
          ...additionalData,
        },
      }),

    connection: (errorType: string) =>
      trackEvent({
        action: "connection_error",
        category: "error",
        label: errorType,
        custom_parameters: {
          error_type: errorType,
          timestamp: Date.now(),
        },
      }),
  },

  // Performance events
  performance: {
    pageLoad: (pageName: string, loadTime: number) =>
      trackEvent({
        action: "page_load_time",
        category: "performance",
        label: pageName,
        value: Math.round(loadTime),
        custom_parameters: {
          page_name: pageName,
          load_time: Math.round(loadTime),
        },
      }),

    apiCall: (endpoint: string, responseTime: number, success: boolean) =>
      trackEvent({
        action: "api_call",
        category: "performance",
        label: endpoint,
        value: Math.round(responseTime),
        custom_parameters: {
          endpoint,
          response_time: Math.round(responseTime),
          success,
        },
      }),
  },

  // Major events - Optimized with smart categorization
  major: {
    firstTrade: (symbol: string, side: TradingSide, size: number) =>
      trackEvent({
        action: "first_trade",
        category: "major_milestone",
        label: `${symbol}_${side}`,
        value: size,
        custom_parameters: {
          symbol,
          side,
          size,
          milestone_type: "first_trade",
          user_tier: getPositionTier(size),
        },
      }),

    largePosition: (symbol: string, size: number, leverage: number) =>
      trackEvent({
        action: "large_position_opened",
        category: "major_trading",
        label: symbol,
        value: size,
        custom_parameters: {
          symbol,
          size,
          leverage,
          position_tier: getPositionTier(size),
        },
      }),

    profitableTrade: (symbol: string, pnl: number, roi: number) =>
      trackEvent({
        action: "profitable_trade",
        category: "major_trading",
        label: symbol,
        value: pnl,
        custom_parameters: {
          symbol,
          pnl,
          roi,
          profit_tier: getProfitTier(pnl),
        },
      }),

    accountFunded: (amount: number, token: string) =>
      trackEvent({
        action: "account_funded",
        category: "major_milestone",
        label: token,
        value: amount,
        custom_parameters: {
          token,
          amount,
          funding_tier: getUserTier(amount),
        },
      }),

    highVolumeDay: (totalVolume: number, tradeCount: number) =>
      trackEvent({
        action: "high_volume_day",
        category: "major_trading",
        label: "volume_milestone",
        value: totalVolume,
        custom_parameters: {
          total_volume: totalVolume,
          trade_count: tradeCount,
          volume_tier: getVolumeTier(totalVolume),
        },
      }),

    featureUnlock: (featureName: string, userTier: string) =>
      trackEvent({
        action: "feature_unlocked",
        category: "major_milestone",
        label: featureName,
        custom_parameters: {
          feature_name: featureName,
          user_tier: userTier,
          unlock_method: "organic",
        },
      }),

    liquidationRisk: (symbol: string, riskLevel: RiskLevel) =>
      trackEvent({
        action: "liquidation_risk",
        category: "major_risk",
        label: `${symbol}_${riskLevel}`,
        custom_parameters: {
          symbol,
          risk_level: riskLevel,
          event_type: "warning",
        },
      }),

    streakAchievement: (streakType: StreakType, count: number) =>
      trackEvent({
        action: "streak_achievement",
        category: "major_milestone",
        label: `${streakType}_streak_${count}`,
        value: count,
        custom_parameters: {
          streak_type: streakType,
          streak_count: count,
          achievement_tier: getAchievementTier(count),
        },
      }),
  },
};

// Optimized custom event tracking
export const trackCustomEvent = (
  eventName: string,
  parameters?: Record<string, string | number | boolean>
) => {
  const event: GAEvent = {
    action: eventName,
    category: "custom" as const,
  };

  if (parameters) {
    event.custom_parameters = parameters;
  }

  trackEvent(event);
};

// Cleanup function for memory management
export const cleanupAnalytics = (): void => {
  flushEventQueue();
  eventQueue = [];
};
