/**
 * Integration Tests
 *
 * End-to-end tests for the matching engine.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { createMarketShard, type MarketShard } from "@dotmx/engine";
import { createBalanceStore, createPositionStore } from "@dotmx/ledger";
import { createL2BookBuilder, createMemoryFanout } from "@dotmx/marketdata";
import { createMemoryCommandBus, createShardRouter } from "@dotmx/gateway";
import { createOrderGenerator } from "@dotmx/tools";
import type { CreateOrderCommand, Event } from "@dotmx/shared";

describe("Integration: Full Order Flow", () => {
  let balanceStore: ReturnType<typeof createBalanceStore>;
  let positionStore: ReturnType<typeof createPositionStore>;
  let shard: MarketShard;
  let fanout: ReturnType<typeof createMemoryFanout>;
  let bookBuilder: ReturnType<typeof createL2BookBuilder>;

  beforeEach(() => {
    balanceStore = createBalanceStore();
    positionStore = createPositionStore();
    shard = createMarketShard({
      symbol: "BTC-USD",
      risk: {
        tickSize: 0.01,
        lotSize: 0.001,
        maxOrderSize: 1000,
        maxNotional: 10000000,
        priceDeviationThreshold: 0.1,
      },
    });
    fanout = createMemoryFanout();
    bookBuilder = createL2BookBuilder("BTC-USD");

    // Credit users with balance
    balanceStore.credit("maker", "USDT", 100000);
    balanceStore.credit("taker", "USDT", 100000);
  });

  it("should execute full order lifecycle", () => {
    // Maker places limit sell order
    const makerOrder: CreateOrderCommand = {
      requestId: "req-1",
      userId: "maker",
      symbol: "BTC-USD",
      side: "SELL",
      type: "LIMIT",
      price: 50100,
      quantity: 1,
      timeInForce: "GTC",
      timestamp: Date.now(),
    };

    const makerEvents = shard.processCommand(makerOrder);

    // Verify order accepted and resting
    expect(makerEvents.length).toBeGreaterThan(0);
    const acceptedEvent = makerEvents.find(e => e.kind === "OrderAccepted");
    expect(acceptedEvent).toBeDefined();

    // Apply events to book builder
    makerEvents.forEach(e => bookBuilder.applyEvent(e));

    // Check L2 book updated
    const book1 = bookBuilder.getSnapshot(10);
    expect(book1.asks.length).toBe(1);
    expect(book1.asks[0].price).toBe(50100);

    // Taker places market buy order
    const takerOrder: CreateOrderCommand = {
      requestId: "req-2",
      userId: "taker",
      symbol: "BTC-USD",
      side: "BUY",
      type: "MARKET",
      quantity: 0.5,
      timeInForce: "IOC",
      timestamp: Date.now(),
    };

    const takerEvents = shard.processCommand(takerOrder);

    // Verify trade executed
    const tradeEvent = takerEvents.find(e => e.kind === "Trade");
    expect(tradeEvent).toBeDefined();

    // Apply events to book builder
    takerEvents.forEach(e => bookBuilder.applyEvent(e));

    // Check remaining quantity on book
    const book2 = bookBuilder.getSnapshot(10);
    expect(book2.asks[0].quantity).toBe(0.5);
  });

  it("should reject order exceeding max notional", () => {
    // Try to place order exceeding maxNotional (10M)
    const largeOrder: CreateOrderCommand = {
      requestId: "req-3",
      userId: "taker",
      symbol: "BTC-USD",
      side: "BUY",
      type: "LIMIT",
      price: 50000,
      quantity: 300, // 300 * 50000 = 15M notional > 10M max
      timeInForce: "GTC",
      timestamp: Date.now(),
    };

    const events = shard.processCommand(largeOrder);

    // Should have a reject event
    const rejectEvent = events.find(e => e.kind === "Reject");
    expect(rejectEvent).toBeDefined();
  });
});

describe("Integration: Gateway Routing", () => {
  it("should route orders to correct shard based on symbol", () => {
    const router = createShardRouter({ numShards: 4, virtualNodes: 100 });

    // Add shards
    router.addShard(0, "shard-0:8000");
    router.addShard(1, "shard-1:8000");
    router.addShard(2, "shard-2:8000");
    router.addShard(3, "shard-3:8000");

    // Test consistent routing
    const btcShard = router.getShardId("BTC-USD");
    const ethShard = router.getShardId("ETH-USD");
    const solShard = router.getShardId("SOL-USD");

    // Verify deterministic routing (same symbol always goes to same shard)
    expect(router.getShardId("BTC-USD")).toBe(btcShard);
    expect(router.getShardId("BTC-USD")).toBe(btcShard);
    expect(router.getShardId("ETH-USD")).toBe(ethShard);

    // Shards should be in valid range
    expect(btcShard).toBeGreaterThanOrEqual(0);
    expect(btcShard).toBeLessThan(4);
    expect(ethShard).toBeGreaterThanOrEqual(0);
    expect(ethShard).toBeLessThan(4);
  });
});

describe("Integration: Order Generator Stress Test", () => {
  it("should handle burst of generated orders", () => {
    const generator = createOrderGenerator({
      symbol: "BTC-USD",
      basePrice: 50000,
      priceVolatility: 0.001,
      orderRatePerSecond: 1000,
      buyProbability: 0.5,
      limitProbability: 0.8,
      cancelProbability: 0,
      meanOrderSize: 0.1,
      sizeVolatility: 0.2,
      userCount: 50,
      tickSize: 0.01,
      lotSize: 0.001,
    });

    const shard = createMarketShard({
      symbol: "BTC-USD",
      risk: {
        tickSize: 0.01,
        lotSize: 0.001,
        maxOrderSize: 1000,
        maxNotional: 10000000,
        priceDeviationThreshold: 0.5,
      },
    });

    // Generate and process orders
    const orders = generator.generateBatch(100);
    let tradeCount = 0;
    let orderCount = 0;

    for (const order of orders) {
      const events = shard.processCommand(order);
      
      for (const event of events) {
        if (event.kind === "Trade") tradeCount++;
        if (event.kind === "OrderAccepted") orderCount++;
      }
    }

    // Should have processed orders
    expect(orderCount).toBeGreaterThan(0);
    
    // Stats should be updated
    const stats = generator.getStats();
    expect(stats.ordersGenerated).toBe(100);
  });

  it("should maintain market liquidity with market maker", () => {
    const shard = createMarketShard({
      symbol: "BTC-USD",
      risk: {
        tickSize: 0.01,
        lotSize: 0.001,
        maxOrderSize: 1000,
        maxNotional: 10000000,
        priceDeviationThreshold: 0.5,
      },
    });

    // Place some initial orders to create a book
    const buyOrder: CreateOrderCommand = {
      requestId: "mm-1",
      userId: "market-maker",
      symbol: "BTC-USD",
      side: "BUY",
      type: "LIMIT",
      price: 49900,
      quantity: 10,
      timeInForce: "GTC",
      timestamp: Date.now(),
    };

    const sellOrder: CreateOrderCommand = {
      requestId: "mm-2",
      userId: "market-maker",
      symbol: "BTC-USD",
      side: "SELL",
      type: "LIMIT",
      price: 50100,
      quantity: 10,
      timeInForce: "GTC",
      timestamp: Date.now(),
    };

    shard.processCommand(buyOrder);
    shard.processCommand(sellOrder);

    // Check book state
    const snapshot = shard.getSnapshot(10);
    expect(snapshot.bids.length).toBeGreaterThan(0);
    expect(snapshot.asks.length).toBeGreaterThan(0);

    // Spread should be reasonable
    const bestBid = snapshot.bids[0].price;
    const bestAsk = snapshot.asks[0].price;
    const spread = bestAsk - bestBid;
    expect(spread).toBe(200); // 50100 - 49900
  });
});

describe("Integration: Book Builder Event Processing", () => {
  it("should track orderbook state from events", () => {
    const shard = createMarketShard({
      symbol: "BTC-USD",
      risk: {
        tickSize: 0.01,
        lotSize: 0.001,
        maxOrderSize: 1000,
        maxNotional: 10000000,
        priceDeviationThreshold: 0.5,
      },
    });
    
    const bookBuilder = createL2BookBuilder("BTC-USD");
    const allEvents: Event[] = [];

    // Place orders
    const orders: CreateOrderCommand[] = [
      {
        requestId: "1",
        userId: "user1",
        symbol: "BTC-USD",
        side: "BUY",
        type: "LIMIT",
        price: 49900,
        quantity: 5,
        timeInForce: "GTC",
        timestamp: Date.now(),
      },
      {
        requestId: "2",
        userId: "user2",
        symbol: "BTC-USD",
        side: "SELL",
        type: "LIMIT",
        price: 50100,
        quantity: 5,
        timeInForce: "GTC",
        timestamp: Date.now(),
      },
    ];

    for (const order of orders) {
      const events = shard.processCommand(order);
      allEvents.push(...events);
      events.forEach(e => bookBuilder.applyEvent(e));
    }

    // Verify book builder state matches shard state
    const builderSnapshot = bookBuilder.getSnapshot(10);
    const shardSnapshot = shard.getSnapshot(10);

    expect(builderSnapshot.bids.length).toBe(shardSnapshot.bids.length);
    expect(builderSnapshot.asks.length).toBe(shardSnapshot.asks.length);
    expect(builderSnapshot.bids[0].price).toBe(49900);
    expect(builderSnapshot.asks[0].price).toBe(50100);
  });
});
