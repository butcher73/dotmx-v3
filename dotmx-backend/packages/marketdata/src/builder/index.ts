/**
 * L2 Book Builder
 *
 * Maintains aggregated price levels (L2) from L3 order events.
 * Publishes deltas for WebSocket consumers.
 */

import type { Event, PriceLevel } from "@dotmx/shared";

export interface L2Book {
  symbol: string;
  bids: PriceLevel[];
  asks: PriceLevel[];
  lastUpdateId: number;
  timestamp: number;
}

export interface L2Delta {
  symbol: string;
  bids: PriceLevel[]; // Changed levels
  asks: PriceLevel[]; // Changed levels
  updateId: number;
  timestamp: number;
}

export interface L2BookBuilder {
  getBook(): L2Book;
  getSnapshot(depth?: number): L2Book;
  applyEvent(event: Event): L2Delta | null;
  reset(): void;
}

export interface BookBuilderConfig {
  maxLevels: number;
  pricePrecision: number;
}

export const defaultBuilderConfig: BookBuilderConfig = {
  maxLevels: 100,
  pricePrecision: 2,
};

/**
 * Round price to precision
 */
function roundPrice(price: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(price * factor) / factor;
}

/**
 * Create L2 book builder
 */
export function createL2BookBuilder(
  symbol: string,
  config: BookBuilderConfig = defaultBuilderConfig
): L2BookBuilder {
  // price -> { quantity, orderCount }
  const bids = new Map<number, { quantity: number; orderCount: number }>();
  const asks = new Map<number, { quantity: number; orderCount: number }>();
  let updateId = 0;

  function getSortedLevels(
    map: Map<number, { quantity: number; orderCount: number }>,
    side: "BUY" | "SELL",
    limit?: number
  ): PriceLevel[] {
    const entries = Array.from(map.entries())
      .filter(([_, data]) => data.quantity > 0)
      .map(([price, data]) => ({ price, quantity: data.quantity, orderCount: data.orderCount }));

    // Bids: highest first, Asks: lowest first
    if (side === "BUY") {
      entries.sort((a, b) => b.price - a.price);
    } else {
      entries.sort((a, b) => a.price - b.price);
    }

    return limit ? entries.slice(0, limit) : entries;
  }

  function applyOrderDelta(
    side: "BUY" | "SELL",
    price: number,
    qtyDelta: number,
    orderCountDelta: number = 0
  ): PriceLevel | null {
    const map = side === "BUY" ? bids : asks;
    const roundedPrice = roundPrice(price, config.pricePrecision);
    
    const current = map.get(roundedPrice) ?? { quantity: 0, orderCount: 0 };
    const newQty = Math.max(0, current.quantity + qtyDelta);
    const newOrderCount = Math.max(0, current.orderCount + orderCountDelta);

    if (newQty === 0) {
      map.delete(roundedPrice);
    } else {
      map.set(roundedPrice, { quantity: newQty, orderCount: newOrderCount });
    }

    // Trim to max levels
    if (map.size > config.maxLevels) {
      const levels = getSortedLevels(map, side);
      const toRemove = levels.slice(config.maxLevels);
      for (const level of toRemove) {
        map.delete(level.price);
      }
    }

    return { price: roundedPrice, quantity: newQty, orderCount: newOrderCount };
  }

  return {
    getBook(): L2Book {
      return {
        symbol,
        bids: getSortedLevels(bids, "BUY"),
        asks: getSortedLevels(asks, "SELL"),
        lastUpdateId: updateId,
        timestamp: Date.now(),
      };
    },

    getSnapshot(depth?: number): L2Book {
      const limit = depth ?? config.maxLevels;
      return {
        symbol,
        bids: getSortedLevels(bids, "BUY", limit),
        asks: getSortedLevels(asks, "SELL", limit),
        lastUpdateId: updateId,
        timestamp: Date.now(),
      };
    },

    applyEvent(event: Event): L2Delta | null {
      const payload = event.payload as Record<string, unknown>;
      const changedBids: PriceLevel[] = [];
      const changedAsks: PriceLevel[] = [];

      switch (event.kind) {
        case "OrderResting": {
          const side = payload.side as "BUY" | "SELL";
          const price = payload.price as number;
          const qty = payload.quantityRemaining as number ?? payload.quantity as number;
          
          const change = applyOrderDelta(side, price, qty, 1); // +1 order
          if (change) {
            if (side === "BUY") changedBids.push(change);
            else changedAsks.push(change);
          }
          break;
        }

        case "Trade": {
          // Both maker and taker sides may change
          const makerSide = payload.makerSide as "BUY" | "SELL";
          const price = payload.price as number;
          const qty = payload.quantity as number;
          
          // Reduce maker side quantity (order count stays same for partial fills)
          const change = applyOrderDelta(makerSide, price, -qty, 0);
          if (change) {
            if (makerSide === "BUY") changedBids.push(change);
            else changedAsks.push(change);
          }
          break;
        }

        case "OrderCanceled": {
          const side = payload.side as "BUY" | "SELL";
          const price = payload.price as number;
          const qty = payload.remainingQuantity as number ?? payload.quantity as number;
          
          const change = applyOrderDelta(side, price, -qty, -1); // -1 order
          if (change) {
            if (side === "BUY") changedBids.push(change);
            else changedAsks.push(change);
          }
          break;
        }

        case "OrderFilled": {
          // Order completely filled - decrement order count
          const side = payload.side as "BUY" | "SELL";
          const price = payload.price as number;
          const change = applyOrderDelta(side, price, 0, -1);
          if (change) {
            if (side === "BUY") changedBids.push(change);
            else changedAsks.push(change);
          }
          break;
        }

        case "OrderPartiallyFilled": {
          // Already handled in Trade
          break;
        }

        default:
          return null;
      }

      if (changedBids.length === 0 && changedAsks.length === 0) {
        return null;
      }

      updateId++;

      return {
        symbol,
        bids: changedBids,
        asks: changedAsks,
        updateId,
        timestamp: event.timestamp,
      };
    },

    reset(): void {
      bids.clear();
      asks.clear();
      updateId = 0;
    },
  };
}
