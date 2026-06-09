// Trading components for professional trading interface
export { default as OrderBook } from "./OrderBook";
export { default as TradingChart } from "./RealtimeTradingChart"; // Real-time chart with WebSocket integration
export { default as RealtimeTradingChart } from "./RealtimeTradingChart"; // Alias for backwards compatibility
export { default as TradingForm } from "./TradingForm";
export { default as OrdersTable } from "./OrdersTable";
export { default as PriceTicker } from "./PriceTicker"; // Legacy – prefer TradeHeader
export { default as SymbolSelector } from "./SymbolSelector"; // Legacy – prefer PairSelector
export { default as PairSelector } from "./PairSelector";
export { default as MarketStatsBar } from "./MarketStatsBar";
export { default as TradeHeader } from "./TradeHeader";
export { default as ChartDebugInfo } from "./ChartDebugInfo";
export { default as WebSocketIndicator } from "./WebSocketIndicator";
export { default as UserBalance } from "./UserBalance";
export { default as TradingData } from "./TradingData";
export { PositionCloseModal } from "./PositionCloseModal";
export { QuickCloseButton } from "./QuickCloseButton";
export { TransactionTable } from "./TransactionTable";
export { PositionChartSync } from "./PositionChartSync";

// Order components
export { default as ActiveOrdersTable } from "./ActiveOrdersTable";
export { default as OrderRow } from "./OrderRow";
export { default as OrderActions } from "./OrderActions";
export { default as TableState } from "./TableState";
export { default as PositionsTable } from "./PositionsTable";
export { default as TradeHistoryTable } from "./TradeHistoryTable";

// Shared components
export * from "./shared";
export { TradingErrorBoundary } from "./shared/TradingErrorBoundary";

// Re-export global order utilities for convenience
export {
  // Order side and type utilities
  isLongPosition,
  isShortPosition,
  getOppositeOrderSide,
  normalizeOrderSide,
  normalizeOrderType,

  // Order status utilities
  isActiveOrder,
  isExecutedOrder,
  isCancelledOrder,
  isLiquidatedOrder,
  canCancelOrder,
  canModifyOrder,

  // Validation functions
  validateOrderPrice,
  validateOrderAmount,
  validateTakeProfitPrice,
  validateStopLossPrice,
  validateLeverageValue,

  // Calculation utilities
  calculateOrderValue,
  calculateRequiredMargin,
  calculateLiquidationPrice,
  calculatePnL,
  calculatePnLPercentage,
  calculatePositionSize,

  // Display utilities
  getOrderDisplayName,
  getOrderStatusDisplayName,
  getOrderPriorityScore,

  // Filtering and sorting
  filterOrdersByStatus,
  filterOrdersBySide,
  filterOrdersBySymbol,
  sortOrdersByPriority,
  sortOrdersByTime,
  sortOrdersByPnL,

  // Trading strategy utilities
  calculateRiskRewardRatio,
  calculateBreakevenPrice,
  getOptimalTakeProfitPrice,

  // Types
  type ValidationResult,
  type BaseOrder,
  type OrderSide,
  type OrderType,
  type OrderStatus,
} from "@/utils/orders";
