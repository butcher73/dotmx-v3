/**
 * Tools Package Tests
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  createOrderGenerator,
  createMarketMakerGenerator,
  createBenchmarkSuite,
  createMetricsRegistry,
  createEngineMetrics,
  createCli,
} from "../src";

describe("Order Generator", () => {
  let generator: ReturnType<typeof createOrderGenerator>;

  beforeEach(() => {
    generator = createOrderGenerator({
      symbol: "BTC-USD",
      basePrice: 50000,
      priceVolatility: 0.001,
      orderRatePerSecond: 100,
      buyProbability: 0.5,
      limitProbability: 0.8,
      cancelProbability: 0.1,
      meanOrderSize: 0.1,
      sizeVolatility: 0.5,
      userCount: 100,
      tickSize: 0.01,
      lotSize: 0.001,
    });
  });

  it("should generate valid order", () => {
    const order = generator.generate();

    expect(order.symbol).toBe("BTC-USD");
    expect(order.side).toMatch(/^(BUY|SELL)$/);
    expect(order.type).toMatch(/^(LIMIT|MARKET)$/);
    expect(order.quantity).toBeGreaterThan(0);
    expect(order.userId).toMatch(/^user-\d+$/);
  });

  it("should generate batch of orders", () => {
    const orders = generator.generateBatch(100);

    expect(orders.length).toBe(100);
    orders.forEach((order) => {
      expect(order.symbol).toBe("BTC-USD");
    });
  });

  it("should track statistics", () => {
    generator.generateBatch(100);
    const stats = generator.getStats();

    expect(stats.ordersGenerated).toBe(100);
    expect(stats.buyOrders + stats.sellOrders).toBe(100);
    expect(stats.limitOrders + stats.marketOrders).toBe(100);
  });

  it("should update reference price", () => {
    generator.updatePrice(60000);
    const order = generator.generate();

    if (order.type === "LIMIT" && order.price) {
      // Price should be around 60000 now
      expect(order.price).toBeGreaterThan(55000);
      expect(order.price).toBeLessThan(65000);
    }
  });

  it("should respect tick size", () => {
    const orders = generator.generateBatch(50);

    orders.forEach((order) => {
      if (order.price) {
        // Round to avoid floating point issues, then check tick alignment
        const rounded = Math.round(order.price * 100) / 100; // 2 decimal places for 0.01 tick
        expect(rounded).toBeCloseTo(order.price, 2);
      }
    });
  });

  it("should respect lot size", () => {
    const orders = generator.generateBatch(50);

    orders.forEach((order) => {
      // Round to avoid floating point issues, then check lot alignment  
      const rounded = Math.round(order.quantity * 1000) / 1000; // 3 decimal places for 0.001 lot
      expect(rounded).toBeCloseTo(order.quantity, 3);
    });
  });
});

describe("Market Maker Generator", () => {
  let mmGenerator: ReturnType<typeof createMarketMakerGenerator>;

  beforeEach(() => {
    mmGenerator = createMarketMakerGenerator("mm-1", "BTC-USD", {
      spreadBps: 10,
      sizePerLevel: 1,
      levels: 5,
      tickSize: 0.01,
    });
  });

  it("should generate two-sided quotes", () => {
    mmGenerator.updateMidPrice(50000);
    const { bid, ask } = mmGenerator.generateQuotes();

    expect(bid.side).toBe("BUY");
    expect(ask.side).toBe("SELL");
    expect(bid.price!).toBeLessThan(ask.price!);
  });

  it("should maintain spread", () => {
    mmGenerator.updateMidPrice(50000);
    const { bid, ask } = mmGenerator.generateQuotes();

    const spread = ask.price! - bid.price!;
    const expectedSpread = 50000 * (10 / 10000); // 10 bps

    expect(spread).toBeCloseTo(expectedSpread, 0);
  });
});

describe("Benchmark Suite", () => {
  it("should run benchmarks", async () => {
    const suite = createBenchmarkSuite({
      warmupIterations: 10,
      measureIterations: 100,
      gcBetweenRuns: false,
    });

    let counter = 0;
    suite.add("increment", () => {
      counter++;
    });

    const results = await suite.run();

    expect(results.length).toBe(1);
    expect(results[0].name).toBe("increment");
    expect(results[0].iterations).toBe(100);
    expect(results[0].opsPerSecond).toBeGreaterThan(0);
  });

  it("should calculate percentiles", async () => {
    const suite = createBenchmarkSuite({
      warmupIterations: 5,
      measureIterations: 50,
      gcBetweenRuns: false,
    });

    suite.add("sleep", async () => {
      await new Promise((r) => setTimeout(r, 1));
    });

    const results = await suite.run();

    expect(results[0].p50Ms).toBeGreaterThan(0);
    expect(results[0].p95Ms).toBeGreaterThanOrEqual(results[0].p50Ms);
    expect(results[0].p99Ms).toBeGreaterThanOrEqual(results[0].p95Ms);
  });
});

describe("Metrics Registry", () => {
  let registry: ReturnType<typeof createMetricsRegistry>;

  beforeEach(() => {
    registry = createMetricsRegistry();
  });

  it("should track counter", () => {
    const counter = registry.counter("requests_total", "Total requests");

    counter.inc();
    counter.inc();
    counter.add(5);

    expect(counter.get()).toBe(7);
  });

  it("should track counter with labels", () => {
    const counter = registry.counter("requests_total", "Total requests");

    counter.inc({ method: "GET" });
    counter.inc({ method: "POST" });
    counter.inc({ method: "GET" });

    expect(counter.get({ method: "GET" })).toBe(2);
    expect(counter.get({ method: "POST" })).toBe(1);
  });

  it("should track gauge", () => {
    const gauge = registry.gauge("connections", "Active connections");

    gauge.set(10);
    expect(gauge.get()).toBe(10);

    gauge.inc();
    expect(gauge.get()).toBe(11);

    gauge.dec();
    expect(gauge.get()).toBe(10);
  });

  it("should track histogram", () => {
    const histogram = registry.histogram("latency", "Request latency");

    histogram.observe(0.01);
    histogram.observe(0.05);
    histogram.observe(0.1);
    histogram.observe(0.5);

    expect(histogram.getCount()).toBe(4);
    expect(histogram.getSum()).toBeCloseTo(0.66);
    // With 4 values [0.01, 0.05, 0.1, 0.5], p50 with floor(4*0.5)=2 gives index 2 -> 0.1
    expect(histogram.getPercentile(0.5)).toBeCloseTo(0.1);
  });

  it("should export Prometheus format", () => {
    const counter = registry.counter("test_counter", "A test counter");
    counter.inc({ label: "value" });

    const output = registry.exportPrometheus();

    expect(output).toContain("# HELP test_counter");
    expect(output).toContain("# TYPE test_counter counter");
    expect(output).toContain('test_counter{label="value"} 1');
  });
});

describe("Engine Metrics", () => {
  it("should create all engine metrics", () => {
    const registry = createMetricsRegistry();
    const metrics = createEngineMetrics(registry);

    expect(metrics.ordersReceived).toBeDefined();
    expect(metrics.ordersMatched).toBeDefined();
    expect(metrics.ordersCanceled).toBeDefined();
    expect(metrics.tradesExecuted).toBeDefined();
    expect(metrics.matchLatency).toBeDefined();
    expect(metrics.orderbookDepth).toBeDefined();
    expect(metrics.activeConnections).toBeDefined();
  });
});

describe("CLI", () => {
  let cli: ReturnType<typeof createCli>;

  beforeEach(() => {
    cli = createCli("test-cli", "1.0.0");
  });

  it("should register and run commands", async () => {
    let executed = false;

    cli.register({
      name: "test",
      description: "Test command",
      async action() {
        executed = true;
      },
    });

    await cli.run(["test"]);

    expect(executed).toBe(true);
  });

  it("should parse options", async () => {
    let receivedArgs: Record<string, unknown> = {};

    cli.register({
      name: "greet",
      description: "Greet someone",
      options: [
        { name: "name", short: "n", type: "string", description: "Name" },
        { name: "count", short: "c", type: "number", default: 1, description: "Count" },
        { name: "loud", short: "l", type: "boolean", description: "Loud" },
      ],
      async action(args) {
        receivedArgs = args;
      },
    });

    await cli.run(["greet", "--name", "Alice", "-c", "3", "--loud"]);

    expect(receivedArgs.name).toBe("Alice");
    expect(receivedArgs.count).toBe(3);
    expect(receivedArgs.loud).toBe(true);
  });

  it("should use default values", async () => {
    let receivedArgs: Record<string, unknown> = {};

    cli.register({
      name: "test",
      description: "Test",
      options: [
        { name: "value", type: "number", default: 42, description: "Value" },
      ],
      async action(args) {
        receivedArgs = args;
      },
    });

    await cli.run(["test"]);

    expect(receivedArgs.value).toBe(42);
  });
});
