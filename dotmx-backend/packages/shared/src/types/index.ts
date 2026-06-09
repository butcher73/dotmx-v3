/**
 * Shared type definitions across all packages
 */

// === Core Domain Types ===

// Security types
export * from './security';

// Fee tier types
export * from './fees';

// Custodial wallet types
export * from './custodial-wallet';

export type OrderSide = "BUY" | "SELL";
export type OrderType = "LIMIT" | "MARKET" | "STOP_LIMIT" | "STOP_MARKET";
export type TimeInForce = "GTC" | "IOC" | "FOK" | "POST_ONLY";

export interface Order {
  orderId: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: number; // fixed point
  quantity: number;
  quantityRemaining: number;
  timeInForce: TimeInForce;
  stopPrice?: number; // Trigger price for stop orders
  clientOrderId?: string;
  timestamp: number; // ms
  sequenceId: number;
}

export interface Trade {
  tradeId: string;
  symbol: string;
  makerOrderId: string;
  takerOrderId: string;
  makerSide: OrderSide;
  price: number;
  quantity: number;
  makerFee: number;
  takerFee: number;
  timestamp: number; // ms
  sequenceId: number;
}

// === Event Types ===

export type EventKind =
  | "OrderAccepted"
  | "OrderResting"
  | "Trade"
  | "OrderPartiallyFilled"
  | "OrderFilled"
  | "OrderCanceled"
  | "Reject";

export interface Event {
  eventId: string;
  symbol: string;
  sequenceId: number;
  timestamp: number;
  kind: EventKind;
  payload: Record<string, unknown>;
}

// === Command Types ===

export interface CreateOrderCommand {
  requestId: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price?: number;
  quantity: number;
  timeInForce?: TimeInForce;
  stopPrice?: number; // Trigger price for STOP_LIMIT / STOP_MARKET
  clientOrderId?: string;
  takeProfit?: number;
  stopLoss?: number;
  timestamp: number;
}

export interface CancelOrderCommand {
  requestId: string;
  userId: string;
  orderId: string;
  symbol: string;
  timestamp: number;
}

export type Command = CreateOrderCommand | CancelOrderCommand;

// === Risk Types ===

export interface RiskCheckContext {
  userId: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  collateral?: number;
  currentPosition?: number;
  openOrdersNotional?: number;
}

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
}

// === Market Data Types ===

export interface PriceLevel {
  price: number;
  quantity: number;
  orderCount: number;
}

export interface L2Snapshot {
  symbol: string;
  bids: PriceLevel[];
  asks: PriceLevel[];
  timestamp: number;
  sequenceId: number;
}

export interface L2Diff {
  symbol: string;
  updateId: number;
  bids: PriceLevel[];
  asks: PriceLevel[];
  timestamp: number;
}
