/**
 * Module 04 — Matching Algorithm (Price-Time Priority)
 *
 * Core matching rules:
 * - Taker BUY matches best ASK (lowest) while bestAsk <= takerPrice
 * - Taker SELL matches best BID (highest) while bestBid >= takerPrice
 * - Fill quantity = min(takerRemaining, makerRemaining)
 * - Within a level, FIFO order
 */

import type { Order, Trade, Event, CreateOrderCommand, TimeInForce } from "@dotmx/shared";
import { generateId, nowMs } from "@dotmx/shared";
import {
  type Orderbook,
  getBestBid,
  getBestAsk,
  addOrder,
  updateOrderQty,
  removeOrder,
} from "../orderbook";
import { type EventEmitter } from "../events";
import { checkRisk, type RiskConfig, defaultRiskConfig } from "../risk";

export interface MatchResult {
  trades: Trade[];
  events: Event[];
  restingOrder?: Order;
  rejected: boolean;
  rejectReason?: string;
  /** Stop orders that were triggered by trades in this match */
  triggeredStopOrders?: Order[];
}

export interface MatchingEngineConfig {
  risk: RiskConfig;
  selfTradePreventionEnabled: boolean;
  selfTradePreventionMode: "CANCEL_MAKER" | "CANCEL_TAKER" | "CANCEL_BOTH";
}

/** Stored stop order awaiting trigger */
export interface StopOrderEntry {
  order: Order;
  stopPrice: number;
  /** The order type to submit when triggered (LIMIT or MARKET) */
  triggerType: "LIMIT" | "MARKET";
}

// Note: Fee calculation has been moved to TradeSettlementService.
export const defaultMatchingConfig: MatchingEngineConfig = {
  risk: defaultRiskConfig,
  selfTradePreventionEnabled: true,
  selfTradePreventionMode: "CANCEL_MAKER",
};

/**
 * Check if order can be fully filled (for FOK)
 */
function canFullyFill(
  book: Orderbook,
  side: "BUY" | "SELL",
  price: number,
  quantity: number
): boolean {
  const levels = side === "BUY" ? book.asks : book.bids;
  let remaining = quantity;

  for (const level of levels) {
    // Check price constraint
    if (side === "BUY" && level.price > price) break;
    if (side === "SELL" && level.price < price) break;

    remaining -= level.totalQty;
    if (remaining <= 0) return true;
  }

  return false;
}

/**
 * Match incoming order against orderbook
 */
export function matchOrder(
  book: Orderbook,
  command: CreateOrderCommand,
  emitter: EventEmitter,
  markPrice: number = 0,
  config: MatchingEngineConfig = defaultMatchingConfig
): MatchResult {
  const result: MatchResult = {
    trades: [],
    events: [],
    rejected: false,
  };

  const orderId = generateId();
  const price = command.price ?? 0;
  const timeInForce: TimeInForce = command.timeInForce ?? "GTC";

  // Risk checks
  if (command.type === "LIMIT") {
    const riskResult = checkRisk(
      {
        userId: command.userId,
        symbol: command.symbol,
        side: command.side,
        price,
        quantity: command.quantity,
      },
      markPrice,
      config.risk
    );

    if (!riskResult.allowed) {
      result.rejected = true;
      result.rejectReason = riskResult.reason;
      result.events.push(emitter.emitReject(orderId, riskResult.reason!));
      return result;
    }
  }

  // Create order object
  const order: Order = {
    orderId,
    userId: command.userId,
    symbol: command.symbol,
    side: command.side,
    type: command.type,
    price,
    quantity: command.quantity,
    quantityRemaining: command.quantity,
    timeInForce,
    clientOrderId: command.clientOrderId,
    timestamp: command.timestamp,
    sequenceId: emitter.currentSeq + 1,
  };

  // Emit order accepted
  result.events.push(emitter.emitOrderAccepted(order));

  // FOK check - must be fully fillable
  if (timeInForce === "FOK" && command.type === "LIMIT") {
    if (!canFullyFill(book, command.side, price, command.quantity)) {
      result.rejected = true;
      result.rejectReason = "FOK_NOT_FILLABLE";
      result.events.push(emitter.emitOrderCanceled(orderId, "FOK_NOT_FILLABLE"));
      return result;
    }
  }

  // POST_ONLY check - reject if order would immediately match (cross the spread)
  if (timeInForce === "POST_ONLY" && command.type === "LIMIT") {
    const bestOpposite = command.side === "BUY" ? getBestAsk(book) : getBestBid(book);
    if (bestOpposite && bestOpposite.orders.length > 0) {
      const wouldCross = command.side === "BUY"
        ? price >= bestOpposite.price
        : price <= bestOpposite.price;
      if (wouldCross) {
        result.rejected = true;
        result.rejectReason = "POST_ONLY_WOULD_CROSS";
        result.events.push(emitter.emitOrderCanceled(orderId, "POST_ONLY_WOULD_CROSS"));
        return result;
      }
    }
    // If no crossing, POST_ONLY falls through to rest on book like GTC
  }

  // Market order or limit order - attempt matching
  const isBuy = command.side === "BUY";

  while (order.quantityRemaining > 0) {
    const bestLevel = isBuy ? getBestAsk(book) : getBestBid(book);

    // No liquidity
    if (!bestLevel || bestLevel.orders.length === 0) break;

    // Price doesn't cross (limit orders only)
    if (command.type === "LIMIT") {
      if (isBuy && bestLevel.price > price) break;
      if (!isBuy && bestLevel.price < price) break;
    }

    // Get first order at this level (FIFO)
    const makerOrder = bestLevel.orders[0];

    // Self-trade prevention
    if (config.selfTradePreventionEnabled && makerOrder.userId === order.userId) {
      if (config.selfTradePreventionMode === "CANCEL_MAKER") {
        removeOrder(book, makerOrder.orderId);
        result.events.push(emitter.emitOrderCanceled(makerOrder.orderId, "SELF_TRADE_PREVENTION"));
        continue;
      } else if (config.selfTradePreventionMode === "CANCEL_TAKER") {
        result.events.push(emitter.emitOrderCanceled(orderId, "SELF_TRADE_PREVENTION"));
        return result;
      } else if (config.selfTradePreventionMode === "CANCEL_BOTH") {
        removeOrder(book, makerOrder.orderId);
        result.events.push(emitter.emitOrderCanceled(makerOrder.orderId, "SELF_TRADE_PREVENTION"));
        result.events.push(emitter.emitOrderCanceled(orderId, "SELF_TRADE_PREVENTION"));
        return result;
      }
    }

    // Calculate fill quantity
    const fillQty = Math.min(order.quantityRemaining, makerOrder.quantityRemaining);
    const fillPrice = makerOrder.price; // Maker's price

    // Create trade — fees are set to 0; settlement service fills them in
    const trade: Trade = {
      tradeId: generateId(),
      symbol: book.symbol,
      makerOrderId: makerOrder.orderId,
      takerOrderId: order.orderId,
      makerSide: makerOrder.side,
      price: fillPrice,
      quantity: fillQty,
      makerFee: 0,
      takerFee: 0,
      timestamp: nowMs(),
      sequenceId: emitter.currentSeq + 1,
    };

    result.trades.push(trade);
    result.events.push(emitter.emitTrade(trade));

    // Update taker
    order.quantityRemaining -= fillQty;

    // Update maker in book
    updateOrderQty(book, makerOrder.orderId, fillQty);

    // Emit maker events
    if (makerOrder.quantityRemaining <= 0) {
      result.events.push(emitter.emitOrderFilled(makerOrder.orderId));
    } else {
      result.events.push(
        emitter.emitOrderPartiallyFilled(makerOrder.orderId, makerOrder.quantityRemaining)
      );
    }
  }

  // Handle remaining quantity
  if (order.quantityRemaining > 0) {
    if (timeInForce === "IOC") {
      // Cancel remaining
      result.events.push(emitter.emitOrderCanceled(orderId, "IOC_REMAINDER"));
    } else if (command.type === "MARKET") {
      // Market orders don't rest
      result.events.push(emitter.emitOrderCanceled(orderId, "MARKET_NO_LIQUIDITY"));
    } else if (command.type === "LIMIT" && (timeInForce === "GTC" || timeInForce === "POST_ONLY")) {
      // Rest on book (POST_ONLY always rests — crossing was already rejected above)
      addOrder(book, order);
      result.restingOrder = order;
      result.events.push(emitter.emitOrderResting(order));
    }
  } else {
    // Fully filled
    result.events.push(emitter.emitOrderFilled(orderId));
  }

  return result;
}

/**
 * Cancel an order
 */
export function cancelOrder(
  book: Orderbook,
  orderId: string,
  emitter: EventEmitter
): { success: boolean; events: Event[] } {
  const order = removeOrder(book, orderId);

  if (!order) {
    return {
      success: false,
      events: [emitter.emitReject(orderId, "ORDER_NOT_FOUND")],
    };
  }

  return {
    success: true,
    events: [emitter.emitOrderCanceled(orderId, "USER_CANCEL")],
  };
}

// =============================================================================
// STOP ORDER STORE
// =============================================================================

/**
 * In-memory stop order store.
 * Stop orders are held here until the market price crosses their stopPrice,
 * at which point they are converted to LIMIT or MARKET orders and submitted.
 */
export interface StopOrderStore {
  /** All pending stop orders keyed by orderId */
  orders: Map<string, StopOrderEntry>;
}

export function createStopOrderStore(): StopOrderStore {
  return { orders: new Map() };
}

/**
 * Add a stop order to the store. Returns the accepted order event.
 */
export function addStopOrder(
  store: StopOrderStore,
  command: CreateOrderCommand,
  emitter: EventEmitter
): { orderId: string; events: Event[] } {
  const orderId = generateId();
  const triggerType = command.type === "STOP_LIMIT" ? "LIMIT" : "MARKET";

  const order: Order = {
    orderId,
    userId: command.userId,
    symbol: command.symbol,
    side: command.side,
    type: command.type,
    price: command.price ?? 0,
    quantity: command.quantity,
    quantityRemaining: command.quantity,
    timeInForce: command.timeInForce ?? "GTC",
    stopPrice: command.stopPrice,
    clientOrderId: command.clientOrderId,
    timestamp: command.timestamp,
    sequenceId: emitter.currentSeq + 1,
  };

  store.orders.set(orderId, {
    order,
    stopPrice: command.stopPrice ?? 0,
    triggerType,
  });

  return {
    orderId,
    events: [emitter.emitOrderAccepted(order)],
  };
}

/**
 * Cancel a stop order from the store.
 */
export function cancelStopOrder(
  store: StopOrderStore,
  orderId: string,
  emitter: EventEmitter
): { success: boolean; events: Event[] } {
  const entry = store.orders.get(orderId);
  if (!entry) {
    return { success: false, events: [] };
  }
  store.orders.delete(orderId);
  return {
    success: true,
    events: [emitter.emitOrderCanceled(orderId, "USER_CANCEL")],
  };
}

/**
 * Check stop orders after a trade. Returns CreateOrderCommands for triggered stops.
 *
 * Stop-Limit BUY triggers when market price >= stopPrice
 * Stop-Limit SELL triggers when market price <= stopPrice
 * (Same logic for Stop-Market)
 */
export function checkStopOrders(
  store: StopOrderStore,
  symbol: string,
  lastTradePrice: number
): CreateOrderCommand[] {
  const triggered: CreateOrderCommand[] = [];

  for (const [orderId, entry] of store.orders) {
    if (entry.order.symbol !== symbol) continue;

    let shouldTrigger = false;
    if (entry.order.side === "BUY" && lastTradePrice >= entry.stopPrice) {
      shouldTrigger = true;
    } else if (entry.order.side === "SELL" && lastTradePrice <= entry.stopPrice) {
      shouldTrigger = true;
    }

    if (shouldTrigger) {
      store.orders.delete(orderId);

      triggered.push({
        requestId: generateId(),
        userId: entry.order.userId,
        symbol: entry.order.symbol,
        side: entry.order.side,
        type: entry.triggerType,
        price: entry.triggerType === "LIMIT" ? entry.order.price : undefined,
        quantity: entry.order.quantityRemaining,
        timeInForce: entry.order.timeInForce === "POST_ONLY" ? "GTC" : entry.order.timeInForce,
        clientOrderId: entry.order.clientOrderId,
        timestamp: nowMs(),
      });
    }
  }

  return triggered;
}
