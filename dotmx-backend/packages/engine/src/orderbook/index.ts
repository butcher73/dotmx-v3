/**
 * Module 03 — Orderbook Data Structures
 *
 * Price-time priority orderbook with:
 * - O(log N) insert/cancel via sorted arrays
 * - O(1) best bid/ask access
 * - Efficient iteration for matching
 */

import type { Order, PriceLevel } from "@dotmx/shared";

export interface OrderbookLevel {
  price: number;
  orders: Order[];
  totalQty: number;
  orderCount: number;
}

export interface Orderbook {
  symbol: string;
  bids: OrderbookLevel[]; // Sorted descending by price
  asks: OrderbookLevel[]; // Sorted ascending by price
  ordersById: Map<string, Order>;
}

export function createOrderbook(symbol: string): Orderbook {
  return {
    symbol,
    bids: [],
    asks: [],
    ordersById: new Map(),
  };
}

/**
 * Get best bid (highest buy price)
 */
export function getBestBid(book: Orderbook): OrderbookLevel | undefined {
  return book.bids[0];
}

/**
 * Get best ask (lowest sell price)
 */
export function getBestAsk(book: Orderbook): OrderbookLevel | undefined {
  return book.asks[0];
}

/**
 * Binary search for price level insertion point
 */
function findLevelIndex(
  levels: OrderbookLevel[],
  price: number,
  descending: boolean
): { index: number; exists: boolean } {
  let left = 0;
  let right = levels.length;

  while (left < right) {
    const mid = (left + right) >>> 1;
    const cmp = descending ? levels[mid].price - price : price - levels[mid].price;

    if (cmp < 0) {
      right = mid;
    } else if (cmp > 0) {
      left = mid + 1;
    } else {
      return { index: mid, exists: true };
    }
  }

  return { index: left, exists: false };
}

/**
 * Add order to orderbook
 */
export function addOrder(book: Orderbook, order: Order): void {
  const side = order.side === "BUY" ? book.bids : book.asks;
  const descending = order.side === "BUY";

  const { index, exists } = findLevelIndex(side, order.price, descending);

  if (exists) {
    // Add to existing level (FIFO - append to end)
    const level = side[index];
    level.orders.push(order);
    level.totalQty += order.quantityRemaining;
    level.orderCount++;
  } else {
    // Create new level
    const newLevel: OrderbookLevel = {
      price: order.price,
      orders: [order],
      totalQty: order.quantityRemaining,
      orderCount: 1,
    };
    side.splice(index, 0, newLevel);
  }

  book.ordersById.set(order.orderId, order);
}

/**
 * Remove order from orderbook
 */
export function removeOrder(book: Orderbook, orderId: string): Order | undefined {
  const order = book.ordersById.get(orderId);
  if (!order) return undefined;

  const side = order.side === "BUY" ? book.bids : book.asks;
  const descending = order.side === "BUY";

  const { index, exists } = findLevelIndex(side, order.price, descending);

  if (exists) {
    const level = side[index];
    const orderIndex = level.orders.findIndex((o) => o.orderId === orderId);

    if (orderIndex !== -1) {
      level.orders.splice(orderIndex, 1);
      level.totalQty -= order.quantityRemaining;
      level.orderCount--;

      // Remove empty level
      if (level.orderCount === 0) {
        side.splice(index, 1);
      }
    }
  }

  book.ordersById.delete(orderId);
  return order;
}

/**
 * Update order quantity after partial fill
 */
export function updateOrderQty(
  book: Orderbook,
  orderId: string,
  filledQty: number
): void {
  const order = book.ordersById.get(orderId);
  if (!order) return;

  const side = order.side === "BUY" ? book.bids : book.asks;
  const descending = order.side === "BUY";

  const { index, exists } = findLevelIndex(side, order.price, descending);

  if (exists) {
    const level = side[index];
    level.totalQty -= filledQty;
    order.quantityRemaining -= filledQty;

    // Remove fully filled order
    if (order.quantityRemaining <= 0) {
      const orderIndex = level.orders.findIndex((o) => o.orderId === orderId);
      if (orderIndex !== -1) {
        level.orders.splice(orderIndex, 1);
        level.orderCount--;
      }
      book.ordersById.delete(orderId);

      // Remove empty level
      if (level.orderCount === 0) {
        side.splice(index, 1);
      }
    }
  }
}

/**
 * Get L2 snapshot (aggregated by price level)
 */
export function getL2Snapshot(
  book: Orderbook,
  depth: number = 20
): { bids: PriceLevel[]; asks: PriceLevel[] } {
  const bids: PriceLevel[] = book.bids.slice(0, depth).map((level) => ({
    price: level.price,
    quantity: level.totalQty,
    orderCount: level.orderCount,
  }));

  const asks: PriceLevel[] = book.asks.slice(0, depth).map((level) => ({
    price: level.price,
    quantity: level.totalQty,
    orderCount: level.orderCount,
  }));

  return { bids, asks };
}

/**
 * Get spread
 */
export function getSpread(book: Orderbook): number | null {
  const bestBid = getBestBid(book);
  const bestAsk = getBestAsk(book);

  if (!bestBid || !bestAsk) return null;
  return bestAsk.price - bestBid.price;
}

/**
 * Get mid price
 */
export function getMidPrice(book: Orderbook): number | null {
  const bestBid = getBestBid(book);
  const bestAsk = getBestAsk(book);

  if (!bestBid || !bestAsk) return null;
  return (bestBid.price + bestAsk.price) / 2;
}
