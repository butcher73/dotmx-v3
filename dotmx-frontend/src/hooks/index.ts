/**
 * Hooks Index
 * Central export point for all custom hooks
 * Simplified structure with all hooks in the root directory
 */

// =============================================================================
// AUTHENTICATION HOOKS
// =============================================================================
export { useAuth, useAccount, useConnect, AuthProvider } from "./useAuth";
export type { User } from "@/services/ApiClient";

// =============================================================================
// PRIMITIVE ASYNC HOOKS
// =============================================================================
export { useAsyncAction } from "./useAsyncAction";
export { useInterval } from "./useInterval";

// =============================================================================
// PNL CONSISTENCY HOOKS
// =============================================================================
export { useConsistentPNL } from "./useConsistentPNL";
export type { ConsistentPNLResult } from "./useConsistentPNL";

// =============================================================================
// ACCOUNT DATA HOOKS
// =============================================================================
export { useOptimizedAccountData } from "./useOptimizedAccountData";
export type { OptimizedAccountData } from "./useOptimizedAccountData";

// =============================================================================
// ANALYTICS HOOKS
// =============================================================================
export { useUIAnalytics, usePerformanceAnalytics } from "./useAnalytics";

// =============================================================================
// TRADING HOOKS
// =============================================================================
export {
  usePositionsData,
  usePlaceOrder,
  useCancelOrder,
  useOrders,
  useClosePosition,
  useBalance,
  useAccountMetrics,
  type Order,
} from "./useTrading";

export { usePositionOperations } from "./usePositionOperations";
export type { PositionOperationsResult } from "./usePositionOperations";

export { useTradingVolume } from "./useTradingVolume";
export type { VolumeMetrics } from "./useTradingVolume";
export { useTradingOperations } from "./useTradingOperations";

// =============================================================================
// DATA HOOKS
// =============================================================================
export {
  useStoreMarkets,
  usePerpSymbols,
  useBitgetWebSocket,
  useBitgetCandlestick,
  useMarketData,
  usePortfolioChart,
  useOrderHistory,
  useTransactionHistory,
  useBackendTicker,
  useFundingRate,
  useOpenInterest,
  useBackendOrderBook,
  useBackendTrades,
  FALLBACK_SYMBOLS,
  type PerpSymbol,
  type StoreMarket,
  type BitgetWebSocketState,
  type BitgetWebSocketActions,
  type CandlestickOptions,
  type CandlestickReturn,
  type BitgetTickerData,
  type BitgetTradeData,
  type BitgetCandlestickData,
  type MarketDataItem,
  type KLineData,
  type BackendTickerData,
  type FundingRateData,
  type OpenInterestData,
} from "./useData";

// =============================================================================
// TYPES
// =============================================================================
export type { Position } from "@/config/types";

// =============================================================================
// UTILITIES
// =============================================================================
export {
  TOKEN_LOGOS,
  formatMarketPrice as formatPrice,
  formatVolume,
  formatChangePercent,
  calculateChangePercent,
} from "@/utils/formatting";
