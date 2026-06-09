/**
 * Global Order Utilities
 *
 * Comprehensive utilities for order management, validation, and calculations
 * Used across the entire trading application
 */

// Order side type definitions (generic)
export type OrderSide = "long" | "short" | "buy" | "sell";
export type OrderType = "market" | "limit" | "stop";
export type OrderStatus = "active" | "cancelled" | "executed" | "liquidated";

// Generic order interface for utilities (can be extended by specific implementations)
export interface BaseOrder {
  id: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  price: number;
  amount: number;
  symbol: string;
  time: string;
  entryPrice?: number | undefined; // Made compatible with local Order type
  leverage?: number | undefined;
  unrealizedPnl?: number | undefined;
  realizedPnl?: number | undefined;
  isReduceOnly?: boolean | undefined;
}

import { isValidPrice, isValidAmount } from "./formatting";

// ========================================
// Order Side and Type Utilities
// ========================================

export function isLongPosition(side: OrderSide): boolean {
  return side === "long" || side === "buy";
}

export function isShortPosition(side: OrderSide): boolean {
  return side === "short" || side === "sell";
}

export function getOppositeOrderSide(side: OrderSide): OrderSide {
  if (isLongPosition(side)) {
    return side === "long" ? "short" : "sell";
  }
  return side === "short" ? "long" : "buy";
}

export function normalizeOrderSide(side: string): OrderSide {
  const lowerSide = side.toLowerCase();
  switch (lowerSide) {
    case "buy":
    case "long":
      return "long";
    case "sell":
    case "short":
      return "short";
    default:
      throw new Error(`Invalid order side: ${side}`);
  }
}

export function normalizeOrderType(type: string): OrderType {
  const lowerType = type.toLowerCase();
  switch (lowerType) {
    case "market":
      return "market";
    case "limit":
      return "limit";
    case "stop":
      return "stop";
    default:
      throw new Error(`Invalid order type: ${type}`);
  }
}

// ========================================
// Order Status Utilities
// ========================================

export function isActiveOrder(order: BaseOrder): boolean {
  return order.status === "active";
}

export function isExecutedOrder(order: BaseOrder): boolean {
  return order.status === "executed";
}

export function isCancelledOrder(order: BaseOrder): boolean {
  return order.status === "cancelled";
}

export function isLiquidatedOrder(order: BaseOrder): boolean {
  return order.status === "liquidated";
}

export function canCancelOrder(order: BaseOrder): boolean {
  return isActiveOrder(order);
}

export function canModifyOrder(order: BaseOrder): boolean {
  return isActiveOrder(order) && !order.isReduceOnly;
}

// ========================================
// Order Validation Functions
// ========================================

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateOrderPrice(
  order: BaseOrder,
  price: number
): ValidationResult {
  if (!isValidPrice(price)) {
    return { isValid: false, error: "Price must be a positive number" };
  }

  // Additional price validation logic can be added here
  // e.g., minimum/maximum price limits, price precision, etc.

  return { isValid: true };
}

export function validateOrderAmount(
  order: BaseOrder,
  amount: number
): ValidationResult {
  if (!isValidAmount(amount)) {
    return { isValid: false, error: "Amount must be a positive number" };
  }

  // Additional amount validation logic
  // e.g., minimum order size, maximum position size, etc.

  return { isValid: true };
}

export function validateTakeProfitPrice(
  order: BaseOrder,
  takeProfitPrice: number
): ValidationResult {
  const isLong = isLongPosition(order.side);
  const entryPrice = order.entryPrice || order.price;

  if (!isValidPrice(entryPrice)) {
    return { isValid: false, error: "Invalid entry price" };
  }

  if (!isValidPrice(takeProfitPrice)) {
    return { isValid: false, error: "Take profit price must be positive" };
  }

  if (isLong && takeProfitPrice <= entryPrice!) {
    return {
      isValid: false,
      error: "Take profit price must be above entry price for long positions",
    };
  }

  if (!isLong && takeProfitPrice >= entryPrice!) {
    return {
      isValid: false,
      error: "Take profit price must be below entry price for short positions",
    };
  }

  return { isValid: true };
}

export function validateStopLossPrice(
  order: BaseOrder,
  stopLossPrice: number
): ValidationResult {
  const isLong = isLongPosition(order.side);
  const entryPrice = order.entryPrice || order.price;

  if (!isValidPrice(entryPrice)) {
    return { isValid: false, error: "Invalid entry price" };
  }

  if (!isValidPrice(stopLossPrice)) {
    return { isValid: false, error: "Stop loss price must be positive" };
  }

  if (isLong && stopLossPrice >= entryPrice!) {
    return {
      isValid: false,
      error: "Stop loss price must be below entry price for long positions",
    };
  }

  if (!isLong && stopLossPrice <= entryPrice!) {
    return {
      isValid: false,
      error: "Stop loss price must be above entry price for short positions",
    };
  }

  return { isValid: true };
}

export function validateLeverageValue(leverage: number): ValidationResult {
  if (!leverage || leverage <= 0) {
    return { isValid: false, error: "Leverage must be positive" };
  }

  if (leverage < 1) {
    return { isValid: false, error: "Leverage must be at least 1x" };
  }

  if (leverage > 200) {
    return { isValid: false, error: "Leverage cannot exceed 200x" };
  }

  return { isValid: true };
}

// ========================================
// Order Calculation Utilities
// ========================================

export function calculateOrderValue(price: number, amount: number): number {
  return price * amount;
}

export function calculateRequiredMargin(
  orderValue: number,
  leverage: number
): number {
  return orderValue / leverage;
}

export function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  isLong: boolean,
  maintenanceMarginRate: number = 0.005 // 0.5% default
): number {
  if (isLong) {
    return entryPrice * (1 - 1 / leverage + maintenanceMarginRate);
  } else {
    return entryPrice * (1 + 1 / leverage - maintenanceMarginRate);
  }
}

export function calculatePnL(
  entryPrice: number,
  currentPrice: number,
  amount: number,
  isLong: boolean
): number {
  if (isLong) {
    return (currentPrice - entryPrice) * amount;
  } else {
    return (entryPrice - currentPrice) * amount;
  }
}

export function calculatePnLPercentage(
  pnl: number,
  initialMargin: number
): number {
  if (initialMargin === 0) return 0;
  return (pnl / initialMargin) * 100;
}

export function calculatePositionSize(
  margin: number,
  leverage: number,
  price: number
): number {
  const notionalValue = margin * leverage;
  return notionalValue / price;
}

// ========================================
// Order Formatting and Display Utilities
// ========================================

export function getOrderDisplayName(order: BaseOrder): string {
  const side = order.side.toUpperCase();
  const type = order.type.charAt(0).toUpperCase() + order.type.slice(1);
  return `${side} ${type}`;
}

export function getOrderStatusDisplayName(status: OrderStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "executed":
      return "Executed";
    case "cancelled":
      return "Cancelled";
    case "liquidated":
      return "Liquidated";
    default:
      // This should never happen, but provide a fallback
      return String(status).charAt(0).toUpperCase() + String(status).slice(1);
  }
}

export function getOrderPriorityScore(order: BaseOrder): number {
  // Higher score = higher priority in display
  let score = 0;

  // Status priority
  switch (order.status) {
    case "active":
      score += 1000;
      break;
    case "executed":
      score += 500;
      break;
    case "liquidated":
      score += 100;
      break;
    case "cancelled":
      score += 0;
      break;
  }

  // PnL priority (losses first for active orders)
  if (order.status === "active" && order.unrealizedPnl) {
    score += order.unrealizedPnl < 0 ? 100 : 50;
  }

  // Leverage priority (higher leverage = higher priority)
  if (order.leverage) {
    score += Math.min(order.leverage, 50); // Cap at 50 points
  }

  return score;
}

// ========================================
// Order Filtering and Sorting Utilities
// ========================================

export function filterOrdersByStatus<T extends BaseOrder>(
  orders: T[],
  status: OrderStatus
): T[] {
  return orders.filter((order) => order.status === status);
}

export function filterOrdersBySide<T extends BaseOrder>(
  orders: T[],
  side: OrderSide
): T[] {
  return orders.filter((order) => order.side === side);
}

export function filterOrdersBySymbol<T extends BaseOrder>(
  orders: T[],
  symbol: string
): T[] {
  return orders.filter((order) => order.symbol === symbol);
}

export function sortOrdersByPriority<T extends BaseOrder>(orders: T[]): T[] {
  return [...orders].sort(
    (a, b) => getOrderPriorityScore(b) - getOrderPriorityScore(a)
  );
}

export function sortOrdersByTime<T extends BaseOrder>(
  orders: T[],
  descending: boolean = true
): T[] {
  return [...orders].sort((a, b) => {
    const timeA = new Date(a.time).getTime();
    const timeB = new Date(b.time).getTime();
    return descending ? timeB - timeA : timeA - timeB;
  });
}

export function sortOrdersByPnL<T extends BaseOrder>(
  orders: T[],
  descending: boolean = true
): T[] {
  return [...orders].sort((a, b) => {
    const pnlA = a.unrealizedPnl || a.realizedPnl || 0;
    const pnlB = b.unrealizedPnl || b.realizedPnl || 0;
    return descending ? pnlB - pnlA : pnlA - pnlB;
  });
}

// ========================================
// Trading Strategy Utilities
// ========================================

export function calculateRiskRewardRatio(
  entryPrice: number,
  takeProfitPrice: number,
  stopLossPrice: number,
  isLong: boolean
): number {
  const profit = isLong
    ? takeProfitPrice - entryPrice
    : entryPrice - takeProfitPrice;

  const loss = isLong ? entryPrice - stopLossPrice : stopLossPrice - entryPrice;

  return loss > 0 ? profit / loss : 0;
}

export function calculateBreakevenPrice(
  entryPrice: number,
  fees: number,
  amount: number
): number {
  const feePerUnit = fees / amount;
  return entryPrice + feePerUnit;
}

export function getOptimalTakeProfitPrice(
  entryPrice: number,
  stopLossPrice: number,
  targetRiskRewardRatio: number,
  isLong: boolean
): number {
  const risk = isLong ? entryPrice - stopLossPrice : stopLossPrice - entryPrice;

  const targetReward = risk * targetRiskRewardRatio;

  return isLong ? entryPrice + targetReward : entryPrice - targetReward;
}
