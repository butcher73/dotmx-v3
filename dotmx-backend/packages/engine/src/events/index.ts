/**
 * Module 06 — Event Model & Sequencing
 *
 * Clean event stream for determinism and replay:
 * - Per market shard ordering
 * - Monotonic sequence IDs
 * - Append-only
 */

import type { Event, EventKind, Order, Trade } from "@dotmx/shared";
import { generateId, nowMs } from "@dotmx/shared";

export interface EventEmitter {
  symbol: string;
  currentSeq: number;
  emit(kind: EventKind, payload: Record<string, unknown>): Event;
  emitOrderAccepted(order: Order): Event;
  emitOrderResting(order: Order): Event;
  emitTrade(trade: Trade): Event;
  emitOrderFilled(orderId: string): Event;
  emitOrderPartiallyFilled(orderId: string, remaining: number): Event;
  emitOrderCanceled(orderId: string, reason?: string): Event;
  emitReject(orderId: string, reason: string): Event;
}

export function createEventEmitter(symbol: string, startSeq = 0): EventEmitter {
  let currentSeq = startSeq;

  function emit(kind: EventKind, payload: Record<string, unknown>): Event {
    currentSeq++;
    return {
      eventId: generateId(),
      symbol,
      sequenceId: currentSeq,
      timestamp: nowMs(),
      kind,
      payload,
    };
  }

  return {
    symbol,
    get currentSeq() {
      return currentSeq;
    },

    emit,

    emitOrderAccepted(order: Order): Event {
      return emit("OrderAccepted", {
        orderId: order.orderId,
        userId: order.userId,
        side: order.side,
        type: order.type,
        price: order.price,
        quantity: order.quantity,
        timeInForce: order.timeInForce,
        clientOrderId: order.clientOrderId,
      });
    },

    emitOrderResting(order: Order): Event {
      return emit("OrderResting", {
        orderId: order.orderId,
        side: order.side,
        price: order.price,
        quantity: order.quantity,
        quantityRemaining: order.quantityRemaining,
      });
    },

    emitTrade(trade: Trade): Event {
      return emit("Trade", {
        tradeId: trade.tradeId,
        makerOrderId: trade.makerOrderId,
        takerOrderId: trade.takerOrderId,
        makerSide: trade.makerSide,
        price: trade.price,
        quantity: trade.quantity,
        makerFee: trade.makerFee,
        takerFee: trade.takerFee,
      });
    },

    emitOrderFilled(orderId: string): Event {
      return emit("OrderFilled", { orderId });
    },

    emitOrderPartiallyFilled(orderId: string, remaining: number): Event {
      return emit("OrderPartiallyFilled", { orderId, remaining });
    },

    emitOrderCanceled(orderId: string, reason?: string): Event {
      return emit("OrderCanceled", { orderId, reason });
    },

    emitReject(orderId: string, reason: string): Event {
      return emit("Reject", { orderId, reason });
    },
  };
}

export function serializeEvent(event: Event): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(event));
}

export function deserializeEvent(buffer: Uint8Array): Event {
  return JSON.parse(new TextDecoder().decode(buffer));
}
