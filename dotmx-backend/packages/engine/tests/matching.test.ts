/**
 * Engine Tests - Matching
 */

import { describe, test, expect } from "bun:test";
import { createOrderbook, addOrder } from "../src/orderbook";
import { matchOrder, type MatchResult } from "../src/matching";
import { createEventEmitter } from "../src/events";
import type { Order, CreateOrderCommand } from "@dotmx/shared";

describe("Matching Engine", () => {
  const createCommand = (overrides: Partial<CreateOrderCommand> = {}): CreateOrderCommand => ({
    requestId: `req-${Math.random().toString(36).slice(2)}`,
    userId: "user1",
    symbol: "BTC-USDT",
    side: "BUY" as const,
    type: "LIMIT" as const,
    price: 50000,
    quantity: 1,
    timeInForce: "GTC",
    timestamp: Date.now(),
    ...overrides,
  });

  const createRestingOrder = (overrides: Partial<Order> = {}): Order => ({
    orderId: `order-${Math.random().toString(36).slice(2)}`,
    userId: "seller",
    symbol: "BTC-USDT",
    side: "SELL" as const,
    type: "LIMIT" as const,
    price: 50000,
    quantity: 1,
    quantityRemaining: 1,
    timeInForce: "GTC" as const,
    timestamp: Date.now(),
    sequenceId: 0,
    ...overrides,
  });

  test("should match buy order against resting ask", () => {
    const book = createOrderbook("BTC-USDT");
    const emitter = createEventEmitter("BTC-USDT");

    // Add resting sell order
    addOrder(book, createRestingOrder({
      orderId: "sell-1",
      userId: "seller",
      side: "SELL",
      price: 50000,
      quantity: 1,
      quantityRemaining: 1,
    }));

    // Incoming buy order
    const command = createCommand({
      userId: "buyer",
      side: "BUY",
      price: 50000,
      quantity: 1,
    });

    const result = matchOrder(book, command, emitter);

    expect(result.trades.length).toBe(1);
    expect(result.trades[0].price).toBe(50000);
    expect(result.trades[0].quantity).toBe(1);
  });

  test("should match sell order against resting bid", () => {
    const book = createOrderbook("BTC-USDT");
    const emitter = createEventEmitter("BTC-USDT");

    // Add resting buy order
    addOrder(book, createRestingOrder({
      orderId: "buy-1",
      userId: "buyer",
      side: "BUY",
      price: 50000,
      quantity: 1,
      quantityRemaining: 1,
    }));

    // Incoming sell order
    const command = createCommand({
      userId: "seller",
      side: "SELL",
      price: 50000,
      quantity: 1,
    });

    const result = matchOrder(book, command, emitter);

    expect(result.trades.length).toBe(1);
  });

  test("should execute at maker price (price-time priority)", () => {
    const book = createOrderbook("BTC-USDT");
    const emitter = createEventEmitter("BTC-USDT");

    // Resting sell at 50000
    addOrder(book, createRestingOrder({
      side: "SELL",
      price: 50000,
    }));

    // Buy willing to pay 50100 - should execute at 50000 (maker's price)
    const command = createCommand({
      userId: "buyer",
      side: "BUY",
      price: 50100,
    });

    const result = matchOrder(book, command, emitter);

    expect(result.trades[0].price).toBe(50000);
  });

  test("should partially fill and rest remainder", () => {
    const book = createOrderbook("BTC-USDT");
    const emitter = createEventEmitter("BTC-USDT");

    // Resting sell for 0.5
    addOrder(book, createRestingOrder({
      side: "SELL",
      price: 50000,
      quantity: 0.5,
      quantityRemaining: 0.5,
    }));

    // Buy for 1.0
    const command = createCommand({
      userId: "buyer",
      side: "BUY",
      price: 50000,
      quantity: 1,
    });

    const result = matchOrder(book, command, emitter);

    expect(result.trades.length).toBe(1);
    expect(result.trades[0].quantity).toBe(0.5);
    expect(result.restingOrder).toBeDefined();
    expect(result.restingOrder!.quantityRemaining).toBe(0.5);
  });

  test("should match against multiple levels", () => {
    const book = createOrderbook("BTC-USDT");
    const emitter = createEventEmitter("BTC-USDT");

    // Multiple sell orders at different prices
    addOrder(book, createRestingOrder({ orderId: "sell-1", side: "SELL", price: 50000, quantity: 0.5, quantityRemaining: 0.5 }));
    addOrder(book, createRestingOrder({ orderId: "sell-2", side: "SELL", price: 50100, quantity: 0.5, quantityRemaining: 0.5 }));

    // Buy sweeping both levels
    const command = createCommand({
      userId: "buyer",
      side: "BUY",
      price: 50200,
      quantity: 1,
    });

    const result = matchOrder(book, command, emitter);

    expect(result.trades.length).toBe(2);
    expect(result.trades[0].price).toBe(50000);
    expect(result.trades[1].price).toBe(50100);
  });

  test("should not match when prices don't cross", () => {
    const book = createOrderbook("BTC-USDT");
    const emitter = createEventEmitter("BTC-USDT");

    // Sell at 51000
    addOrder(book, createRestingOrder({
      side: "SELL",
      price: 51000,
    }));

    // Buy at 50000 - no cross
    const command = createCommand({
      side: "BUY",
      price: 50000,
    });

    const result = matchOrder(book, command, emitter);

    expect(result.trades.length).toBe(0);
    expect(result.restingOrder).toBeDefined();
  });

  test("should prevent self-trade (cancel maker mode)", () => {
    const book = createOrderbook("BTC-USDT");
    const emitter = createEventEmitter("BTC-USDT");

    // User's own sell order
    addOrder(book, createRestingOrder({
      orderId: "sell-1",
      userId: "user1",
      side: "SELL",
      price: 50000,
    }));

    // Same user's buy order
    const command = createCommand({
      userId: "user1",
      side: "BUY",
      price: 50000,
    });

    const result = matchOrder(book, command, emitter);

    // Should skip self-trade, maker cancelled
    expect(result.trades.length).toBe(0);
    // Order should rest since maker was cancelled
    expect(result.restingOrder).toBeDefined();
  });

  test("should cancel IOC order if not fully filled", () => {
    const book = createOrderbook("BTC-USDT");
    const emitter = createEventEmitter("BTC-USDT");

    // Partial liquidity
    addOrder(book, createRestingOrder({
      userId: "seller",
      side: "SELL",
      price: 50000,
      quantity: 0.5,
      quantityRemaining: 0.5,
    }));

    // IOC buy for 1.0
    const command = createCommand({
      userId: "buyer",
      side: "BUY",
      price: 50000,
      quantity: 1,
      timeInForce: "IOC",
    });

    const result = matchOrder(book, command, emitter);

    expect(result.trades.length).toBe(1);
    expect(result.restingOrder).toBeUndefined(); // IOC cancelled remainder
  });

  test("should cancel FOK order if not fully fillable", () => {
    const book = createOrderbook("BTC-USDT");
    const emitter = createEventEmitter("BTC-USDT");

    // Only 0.5 available
    addOrder(book, createRestingOrder({
      userId: "seller",
      side: "SELL",
      price: 50000,
      quantity: 0.5,
      quantityRemaining: 0.5,
    }));

    // FOK buy for 1.0
    const command = createCommand({
      userId: "buyer",
      side: "BUY",
      price: 50000,
      quantity: 1,
      timeInForce: "FOK",
    });

    const result = matchOrder(book, command, emitter);

    expect(result.trades.length).toBe(0); // No trades - cancelled
    expect(result.rejected).toBe(true);
  });

  test("should execute FOK when fully fillable", () => {
    const book = createOrderbook("BTC-USDT");
    const emitter = createEventEmitter("BTC-USDT");

    // Enough liquidity
    addOrder(book, createRestingOrder({
      userId: "seller",
      side: "SELL",
      price: 50000,
      quantity: 1,
      quantityRemaining: 1,
    }));

    // FOK buy for 1.0
    const command = createCommand({
      userId: "buyer",
      side: "BUY",
      price: 50000,
      quantity: 1,
      timeInForce: "FOK",
    });

    const result = matchOrder(book, command, emitter);

    expect(result.trades.length).toBe(1);
    expect(result.rejected).toBe(false);
  });
});
