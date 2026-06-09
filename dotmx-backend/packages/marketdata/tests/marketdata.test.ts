/**
 * Market Data Package Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  createL2BookBuilder,
  createMemoryFanout,
  createThrottle,
} from "../src";
import type { Event } from "@dotmx/shared";
import type { MarketDataMessage } from "../src/fanout";

describe("L2 Book Builder", () => {
  let builder: ReturnType<typeof createL2BookBuilder>;

  beforeEach(() => {
    builder = createL2BookBuilder("BTC-USD");
  });

  it("should add bids correctly", () => {
    builder.applyEvent({
      eventId: "evt-1",
      symbol: "BTC-USD",
      kind: "OrderResting",
      sequenceId: 1,
      timestamp: Date.now(),
      payload: {
        orderId: "order-1",
        side: "BUY",
        price: 50000,
        quantity: 1,
      },
    });

    const snapshot = builder.getSnapshot(10);
    expect(snapshot.bids.length).toBe(1);
    expect(snapshot.bids[0].price).toBe(50000);
    expect(snapshot.bids[0].quantity).toBe(1);
  });

  it("should add asks correctly", () => {
    builder.applyEvent({
      eventId: "evt-1",
      symbol: "BTC-USD",
      kind: "OrderResting",
      sequenceId: 1,
      timestamp: Date.now(),
      payload: {
        orderId: "order-1",
        side: "SELL",
        price: 51000,
        quantity: 2,
      },
    });

    const snapshot = builder.getSnapshot(10);
    expect(snapshot.asks.length).toBe(1);
    expect(snapshot.asks[0].price).toBe(51000);
    expect(snapshot.asks[0].quantity).toBe(2);
  });

  it("should aggregate at same price level", () => {
    builder.applyEvent({
      eventId: "evt-1",
      symbol: "BTC-USD",
      kind: "OrderResting",
      sequenceId: 1,
      timestamp: Date.now(),
      payload: { orderId: "order-1", side: "BUY", price: 50000, quantity: 1 },
    });

    builder.applyEvent({
      eventId: "evt-2",
      symbol: "BTC-USD",
      kind: "OrderResting",
      sequenceId: 2,
      timestamp: Date.now(),
      payload: { orderId: "order-2", side: "BUY", price: 50000, quantity: 2 },
    });

    const snapshot = builder.getSnapshot(10);
    expect(snapshot.bids.length).toBe(1);
    expect(snapshot.bids[0].quantity).toBe(3);
  });

  it("should remove quantity on cancel", () => {
    builder.applyEvent({
      eventId: "evt-1",
      symbol: "BTC-USD",
      kind: "OrderResting",
      sequenceId: 1,
      timestamp: Date.now(),
      payload: { orderId: "order-1", side: "BUY", price: 50000, quantity: 5 },
    });

    builder.applyEvent({
      eventId: "evt-2",
      symbol: "BTC-USD",
      kind: "OrderCanceled",
      sequenceId: 2,
      timestamp: Date.now(),
      payload: { orderId: "order-1", side: "BUY", price: 50000, remainingQuantity: 5 },
    });

    const snapshot = builder.getSnapshot(10);
    expect(snapshot.bids.length).toBe(0);
  });

  it("should reduce quantity on trade", () => {
    builder.applyEvent({
      eventId: "evt-1",
      symbol: "BTC-USD",
      kind: "OrderResting",
      sequenceId: 1,
      timestamp: Date.now(),
      payload: { orderId: "order-1", side: "BUY", price: 50000, quantity: 5 },
    });

    builder.applyEvent({
      eventId: "evt-2",
      symbol: "BTC-USD",
      kind: "Trade",
      sequenceId: 2,
      timestamp: Date.now(),
      payload: { makerOrderId: "order-1", makerSide: "BUY", price: 50000, quantity: 2 },
    });

    const snapshot = builder.getSnapshot(10);
    expect(snapshot.bids[0].quantity).toBe(3);
  });

  it("should return delta on event", () => {
    const delta = builder.applyEvent({
      eventId: "evt-1",
      symbol: "BTC-USD",
      kind: "OrderResting",
      sequenceId: 1,
      timestamp: Date.now(),
      payload: { orderId: "order-1", side: "BUY", price: 50000, quantity: 5 },
    });

    expect(delta).not.toBeNull();
    expect(delta!.bids.length).toBe(1);
    expect(delta!.bids[0]).toEqual({ price: 50000, quantity: 5, orderCount: 1 });
  });

  it("should limit snapshot depth", () => {
    for (let i = 0; i < 50; i++) {
      builder.applyEvent({
        eventId: `evt-${i}`,
        symbol: "BTC-USD",
        kind: "OrderResting",
        sequenceId: i,
        timestamp: Date.now(),
        payload: { orderId: `order-${i}`, side: "BUY", price: 50000 - i, quantity: 1 },
      });
    }

    const snapshot = builder.getSnapshot(10);
    expect(snapshot.bids.length).toBe(10);
    expect(snapshot.bids[0].price).toBe(50000); // Best bid first
  });
});

describe("Memory Fanout", () => {
  let fanout: ReturnType<typeof createMemoryFanout>;

  beforeEach(() => {
    fanout = createMemoryFanout();
  });

  it("should publish and receive messages", async () => {
    const received: MarketDataMessage[] = [];

    fanout.subscribeAll((msg) => {
      received.push(msg);
    });

    await fanout.publish({
      type: "trade",
      data: { tradeId: "t1", symbol: "BTC-USD", price: 50000, quantity: 1, makerSide: "BUY", timestamp: Date.now() },
    });
    await fanout.publish({
      type: "trade",
      data: { tradeId: "t2", symbol: "BTC-USD", price: 50100, quantity: 2, makerSide: "SELL", timestamp: Date.now() },
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(received.length).toBe(2);
  });

  it("should support unsubscribe", async () => {
    const received: MarketDataMessage[] = [];

    const unsubscribe = fanout.subscribeAll((msg) => {
      received.push(msg);
    });

    await fanout.publish({
      type: "trade",
      data: { tradeId: "t1", symbol: "BTC-USD", price: 50000, quantity: 1, makerSide: "BUY", timestamp: Date.now() },
    });
    unsubscribe();
    await fanout.publish({
      type: "trade",
      data: { tradeId: "t2", symbol: "BTC-USD", price: 50100, quantity: 2, makerSide: "SELL", timestamp: Date.now() },
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(received.length).toBe(1);
  });

  it("should support multiple subscribers", async () => {
    let count1 = 0;
    let count2 = 0;

    fanout.subscribeAll(() => count1++);
    fanout.subscribeAll(() => count2++);

    await fanout.publish({
      type: "trade",
      data: { tradeId: "t1", symbol: "BTC-USD", price: 50000, quantity: 1, makerSide: "BUY", timestamp: Date.now() },
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });
});

describe("Throttle", () => {
  let throttle: ReturnType<typeof createThrottle<number>>;

  afterEach(() => {
    if (throttle) throttle.stop();
  });

  it("should collect and flush items", async () => {
    throttle = createThrottle<number>({ intervalMs: 50, maxQueueSize: 100 });
    const outputs: number[][] = [];

    throttle.setHandler((items) => {
      outputs.push(items);
    });

    // Push multiple items
    for (let i = 0; i < 10; i++) {
      throttle.push(i);
    }

    // Wait for flush
    await new Promise((r) => setTimeout(r, 100));

    // Should have received all items in one or two flushes
    const allItems = outputs.flat();
    expect(allItems.length).toBe(10);
    expect(allItems).toContain(9);
  });

  it("should respect max queue size", () => {
    throttle = createThrottle<number>({ intervalMs: 1000, maxQueueSize: 3 });

    for (let i = 0; i < 10; i++) {
      throttle.push(i);
    }

    const flushed = throttle.flush();
    // Only the last 3 should remain (FIFO drop)
    expect(flushed.length).toBe(3);
    expect(flushed).toEqual([7, 8, 9]);
  });

  it("should manual flush work correctly", () => {
    throttle = createThrottle<number>({ intervalMs: 1000, maxQueueSize: 100 });

    throttle.push(1);
    throttle.push(2);
    throttle.push(3);

    const items = throttle.flush();
    expect(items).toEqual([1, 2, 3]);

    // Second flush should be empty
    const items2 = throttle.flush();
    expect(items2).toEqual([]);
  });
});
