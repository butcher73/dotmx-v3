/**
 * Engine Tests - Orderbook
 */

import { describe, test, expect } from "bun:test";
import {
  createOrderbook,
  addOrder,
  removeOrder,
  getBestBid,
  getBestAsk,
  getL2Snapshot,
  updateOrderQty,
  type Orderbook,
} from "../src/orderbook";
import type { Order } from "@dotmx/shared";

describe("Orderbook", () => {
  let book: Orderbook;

  const createOrder = (overrides: Partial<Order> = {}): Order => ({
    orderId: `order-${Math.random().toString(36).slice(2)}`,
    userId: "user1",
    symbol: "BTC-USDT",
    side: "BUY" as const,
    type: "LIMIT" as const,
    price: 50000,
    quantity: 1,
    quantityRemaining: 1,
    timeInForce: "GTC" as const,
    timestamp: Date.now(),
    sequenceId: 0,
    ...overrides,
  });

  test("should add buy order to bids", () => {
    book = createOrderbook("BTC-USDT");
    const order = createOrder({ side: "BUY", price: 50000 });

    addOrder(book, order);

    const { bids } = getL2Snapshot(book, 10);
    expect(bids.length).toBe(1);
    expect(bids[0].price).toBe(50000);
    expect(bids[0].quantity).toBe(1);
  });

  test("should add sell order to asks", () => {
    book = createOrderbook("BTC-USDT");
    const order = createOrder({ side: "SELL", price: 51000 });

    addOrder(book, order);

    const { asks } = getL2Snapshot(book, 10);
    expect(asks.length).toBe(1);
    expect(asks[0].price).toBe(51000);
  });

  test("should sort bids descending (best bid first)", () => {
    book = createOrderbook("BTC-USDT");

    addOrder(book, createOrder({ orderId: "1", side: "BUY", price: 50000 }));
    addOrder(book, createOrder({ orderId: "2", side: "BUY", price: 50100 }));
    addOrder(book, createOrder({ orderId: "3", side: "BUY", price: 49900 }));

    const { bids } = getL2Snapshot(book, 10);
    expect(bids[0].price).toBe(50100);
    expect(bids[1].price).toBe(50000);
    expect(bids[2].price).toBe(49900);
  });

  test("should sort asks ascending (best ask first)", () => {
    book = createOrderbook("BTC-USDT");

    addOrder(book, createOrder({ orderId: "1", side: "SELL", price: 51000 }));
    addOrder(book, createOrder({ orderId: "2", side: "SELL", price: 50900 }));
    addOrder(book, createOrder({ orderId: "3", side: "SELL", price: 51100 }));

    const { asks } = getL2Snapshot(book, 10);
    expect(asks[0].price).toBe(50900);
    expect(asks[1].price).toBe(51000);
    expect(asks[2].price).toBe(51100);
  });

  test("should aggregate quantity at same price level", () => {
    book = createOrderbook("BTC-USDT");

    addOrder(book, createOrder({ orderId: "1", side: "BUY", price: 50000, quantity: 1, quantityRemaining: 1 }));
    addOrder(book, createOrder({ orderId: "2", side: "BUY", price: 50000, quantity: 2, quantityRemaining: 2 }));

    const { bids } = getL2Snapshot(book, 10);
    expect(bids.length).toBe(1);
    expect(bids[0].quantity).toBe(3);
  });

  test("should remove order", () => {
    book = createOrderbook("BTC-USDT");
    const order = createOrder({ orderId: "to-cancel", side: "BUY", price: 50000 });

    addOrder(book, order);
    const cancelled = removeOrder(book, "to-cancel");

    expect(cancelled).toBeDefined();
    expect(cancelled!.orderId).toBe("to-cancel");
    expect(getL2Snapshot(book, 10).bids.length).toBe(0);
  });

  test("should return undefined when removing non-existent order", () => {
    book = createOrderbook("BTC-USDT");

    const result = removeOrder(book, "does-not-exist");

    expect(result).toBeUndefined();
  });

  test("should get best bid price", () => {
    book = createOrderbook("BTC-USDT");

    addOrder(book, createOrder({ orderId: "1", side: "BUY", price: 50000 }));
    addOrder(book, createOrder({ orderId: "2", side: "BUY", price: 50100 }));

    const bestBid = getBestBid(book);
    expect(bestBid?.price).toBe(50100);
  });

  test("should get best ask price", () => {
    book = createOrderbook("BTC-USDT");

    addOrder(book, createOrder({ orderId: "1", side: "SELL", price: 51000 }));
    addOrder(book, createOrder({ orderId: "2", side: "SELL", price: 50900 }));

    const bestAsk = getBestAsk(book);
    expect(bestAsk?.price).toBe(50900);
  });

  test("should update order quantity after partial fill", () => {
    book = createOrderbook("BTC-USDT");
    const order = createOrder({
      orderId: "partial",
      side: "BUY",
      price: 50000,
      quantity: 10,
      quantityRemaining: 10,
    });

    addOrder(book, order);
    updateOrderQty(book, "partial", 3);

    const { bids } = getL2Snapshot(book, 10);
    expect(bids[0].quantity).toBe(7);
  });

  test("should remove order when fully filled", () => {
    book = createOrderbook("BTC-USDT");
    const order = createOrder({
      orderId: "full",
      side: "BUY",
      price: 50000,
      quantity: 5,
      quantityRemaining: 5,
    });

    addOrder(book, order);
    updateOrderQty(book, "full", 5);

    expect(getL2Snapshot(book, 10).bids.length).toBe(0);
  });

  test("should maintain FIFO order at same price level", () => {
    book = createOrderbook("BTC-USDT");

    addOrder(book, createOrder({ orderId: "first", side: "BUY", price: 50000, timestamp: 1000 }));
    addOrder(book, createOrder({ orderId: "second", side: "BUY", price: 50000, timestamp: 2000 }));
    addOrder(book, createOrder({ orderId: "third", side: "BUY", price: 50000, timestamp: 3000 }));

    // Get orders at best bid - should be in FIFO order
    const level = getBestBid(book);
    expect(level).toBeDefined();
    expect(level!.orders[0].orderId).toBe("first");
    expect(level!.orders[1].orderId).toBe("second");
    expect(level!.orders[2].orderId).toBe("third");
  });
});
