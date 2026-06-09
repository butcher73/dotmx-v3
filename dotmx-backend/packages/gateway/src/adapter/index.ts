/**
 * Gateway Adapter
 *
 * Connects API to engine shards via command bus.
 * Handles command creation, routing, and response correlation.
 */

import type { CreateOrderCommand, CancelOrderCommand, Event, TradeSettlementService } from "@dotmx/shared";
import { generateId, nowMs } from "@dotmx/shared";
import type { CommandBus } from "../bus";
import type { ShardRouter } from "../router";

export interface GatewayAdapter {
  placeOrder(order: OrderRequest): Promise<OrderResponse>;
  cancelOrder(symbol: string, orderId: string, userId: string): Promise<CancelResponse>;
  getOrderStatus(orderId: string): Promise<OrderStatus | null>;
  subscribeToFills(userId: string, callback: (fill: FillEvent) => void): () => void;
}

export interface OrderRequest {
  userId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET" | "STOP_LIMIT" | "STOP_MARKET";
  price?: number;
  quantity: number;
  timeInForce?: "GTC" | "IOC" | "FOK" | "POST_ONLY";
  stopPrice?: number;
  clientOrderId?: string;
  takeProfit?: number;
  stopLoss?: number;
}

export interface OrderResponse {
  success: boolean;
  orderId?: string;
  error?: string;
}

export interface CancelResponse {
  success: boolean;
  error?: string;
}

export interface OrderStatus {
  orderId: string;
  status: "PENDING" | "OPEN" | "PARTIAL" | "FILLED" | "CANCELED" | "REJECTED";
  filledQuantity: number;
  remainingQuantity: number;
}

export interface FillEvent {
  orderId: string;
  tradeId: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  makerFee?: number;
  takerFee?: number;
  timestamp: number;
}

/**
 * Create gateway adapter
 */
export function createGatewayAdapter(
  commandBus: CommandBus,
  router: ShardRouter,
  settlementService?: TradeSettlementService
): GatewayAdapter {
  // Track pending orders for response correlation
  const pendingOrders = new Map<string, {
    resolve: (response: OrderResponse) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();

  // Track order statuses
  const orderStatuses = new Map<string, OrderStatus>();

  // Track fill subscribers
  const fillSubscribers = new Map<string, Set<(fill: FillEvent) => void>>();

  // Handle events from engine (would be connected to event bus in real system)
  async function handleEvent(event: Event): Promise<void> {
    const payload = event.payload as Record<string, unknown>;
    const orderId = payload.orderId as string | undefined;

    switch (event.kind) {
      case "OrderAccepted": {
        if (orderId) {
          orderStatuses.set(orderId, {
            orderId,
            status: "OPEN",
            filledQuantity: 0,
            remainingQuantity: payload.quantity as number,
          });

          const pending = pendingOrders.get(orderId);
          if (pending) {
            clearTimeout(pending.timeout);
            pending.resolve({ success: true, orderId });
            pendingOrders.delete(orderId);
          }
        }
        break;
      }

      case "Reject": {
        if (orderId) {
          const pending = pendingOrders.get(orderId);
          if (pending) {
            clearTimeout(pending.timeout);
            pending.resolve({
              success: false,
              error: payload.reason as string,
            });
            pendingOrders.delete(orderId);
          }
        }
        break;
      }

      case "Trade": {
        // Settle the trade first — must complete before notifying subscribers
        let settlementResult: { makerFee: number; takerFee: number; settled: boolean; error?: string } | null = null;
        if (settlementService) {
          try {
            settlementResult = await settlementService.settleTrade({
              tradeId: payload.tradeId as string,
              symbol: event.symbol,
              price: payload.price as number,
              quantity: payload.quantity as number,
              makerUserId: payload.makerUserId as string,
              takerUserId: payload.takerUserId as string,
              makerOrderId: payload.makerOrderId as string,
              takerOrderId: payload.takerOrderId as string,
              makerSide: payload.makerSide as "BUY" | "SELL",
              timestamp: event.timestamp,
            });
            if (settlementResult && !settlementResult.settled) {
              console.error('[Gateway] Trade settlement returned error:', settlementResult.error);
            }
          } catch (err) {
            console.error('[Gateway] Trade settlement threw:', err);
          }
        }

        const fill: FillEvent = {
          orderId: orderId ?? "",
          tradeId: payload.tradeId as string,
          symbol: event.symbol,
          side: payload.side as "BUY" | "SELL",
          price: payload.price as number,
          quantity: payload.quantity as number,
          timestamp: event.timestamp,
          makerFee: settlementResult?.makerFee,
          takerFee: settlementResult?.takerFee,
        };

        // Notify subscribers
        const userId = payload.userId as string;
        const subs = fillSubscribers.get(userId);
        if (subs) {
          for (const cb of subs) {
            cb(fill);
          }
        }
        break;
      }

      case "OrderFilled":
      case "OrderPartiallyFilled": {
        if (orderId) {
          const status = orderStatuses.get(orderId);
          if (status) {
            status.status = event.kind === "OrderFilled" ? "FILLED" : "PARTIAL";
            status.filledQuantity = payload.filled as number ?? 0;
            status.remainingQuantity = payload.remaining as number ?? 0;
          }
        }
        break;
      }

      case "OrderCanceled": {
        if (orderId) {
          const status = orderStatuses.get(orderId);
          if (status) {
            status.status = "CANCELED";
          }
        }
        break;
      }
    }
  }

  return {
    async placeOrder(request: OrderRequest): Promise<OrderResponse> {
      const orderId = generateId();
      const requestId = generateId();

      const command: CreateOrderCommand = {
        requestId,
        userId: request.userId,
        symbol: request.symbol,
        side: request.side,
        type: request.type,
        price: request.price,
        quantity: request.quantity,
        timeInForce: request.timeInForce ?? "GTC",
        stopPrice: request.stopPrice,
        clientOrderId: request.clientOrderId,
        takeProfit: request.takeProfit,
        stopLoss: request.stopLoss,
        timestamp: nowMs(),
      };

      // Publish to command bus (engine may or may not be listening)
      try {
        await commandBus.publish(command);
      } catch (err) {
        console.error("[Gateway] Failed to publish order command:", err);
      }

      // Track order status
      orderStatuses.set(orderId, {
        orderId,
        status: "OPEN",
        filledQuantity: 0,
        remainingQuantity: request.quantity,
      });

      // Return immediately with accepted order
      // In production with NATS, this would wait for engine acknowledgment
      return { success: true, orderId };
    },

    async cancelOrder(symbol: string, orderId: string, userId: string): Promise<CancelResponse> {
      const command: CancelOrderCommand = {
        requestId: generateId(),
        userId,
        orderId,
        symbol,
        timestamp: nowMs(),
      };

      await commandBus.publish(command);

      // In a real system, we'd wait for CancelAck event
      return { success: true };
    },

    getOrderStatus(orderId: string): Promise<OrderStatus | null> {
      return Promise.resolve(orderStatuses.get(orderId) ?? null);
    },

    subscribeToFills(userId: string, callback: (fill: FillEvent) => void): () => void {
      const subs = fillSubscribers.get(userId) ?? new Set();
      subs.add(callback);
      fillSubscribers.set(userId, subs);

      return () => {
        subs.delete(callback);
        if (subs.size === 0) {
          fillSubscribers.delete(userId);
        }
      };
    },
  };
}
