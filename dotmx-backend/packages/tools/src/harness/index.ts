/**
 * Benchmark Harness
 *
 * Performance testing and benchmarking tools.
 */

import { createOrderbook, addOrder, matchOrder } from "@dotmx/engine";
import { createEventEmitter } from "@dotmx/engine";
import { createOrderGenerator, type GeneratorConfig } from "../generator";

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTimeMs: number;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  opsPerSecond: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export interface BenchmarkConfig {
  warmupIterations: number;
  measureIterations: number;
  gcBetweenRuns: boolean;
}

export const defaultBenchmarkConfig: BenchmarkConfig = {
  warmupIterations: 1000,
  measureIterations: 10000,
  gcBetweenRuns: true,
};

/**
 * Run a benchmark
 */
export async function runBenchmark(
  name: string,
  fn: () => void | Promise<void>,
  config: BenchmarkConfig = defaultBenchmarkConfig
): Promise<BenchmarkResult> {
  // Warmup
  for (let i = 0; i < config.warmupIterations; i++) {
    await fn();
  }

  // Force GC if available
  if (config.gcBetweenRuns && typeof globalThis.gc === "function") {
    globalThis.gc();
  }

  // Measure
  const times: number[] = [];

  for (let i = 0; i < config.measureIterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  // Calculate stats
  times.sort((a, b) => a - b);

  const totalTime = times.reduce((a, b) => a + b, 0);
  const avgTime = totalTime / times.length;
  const minTime = times[0];
  const maxTime = times[times.length - 1];
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];

  return {
    name,
    iterations: config.measureIterations,
    totalTimeMs: totalTime,
    avgTimeMs: avgTime,
    minTimeMs: minTime,
    maxTimeMs: maxTime,
    opsPerSecond: 1000 / avgTime,
    p50Ms: p50,
    p95Ms: p95,
    p99Ms: p99,
  };
}

/**
 * Benchmark suite
 */
export interface BenchmarkSuite {
  add(name: string, fn: () => void | Promise<void>): void;
  run(): Promise<BenchmarkResult[]>;
  printResults(results: BenchmarkResult[]): void;
}

export function createBenchmarkSuite(config: BenchmarkConfig = defaultBenchmarkConfig): BenchmarkSuite {
  const benchmarks: Array<{ name: string; fn: () => void | Promise<void> }> = [];

  return {
    add(name: string, fn: () => void | Promise<void>): void {
      benchmarks.push({ name, fn });
    },

    async run(): Promise<BenchmarkResult[]> {
      const results: BenchmarkResult[] = [];

      for (const { name, fn } of benchmarks) {
        console.log(`Running: ${name}...`);
        const result = await runBenchmark(name, fn, config);
        results.push(result);
      }

      return results;
    },

    printResults(results: BenchmarkResult[]): void {
      console.log("\n" + "=".repeat(80));
      console.log("BENCHMARK RESULTS");
      console.log("=".repeat(80));

      for (const r of results) {
        console.log(`\n${r.name}`);
        console.log("-".repeat(40));
        console.log(`  Iterations:    ${r.iterations.toLocaleString()}`);
        console.log(`  Ops/sec:       ${r.opsPerSecond.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
        console.log(`  Avg:           ${r.avgTimeMs.toFixed(4)} ms`);
        console.log(`  Min:           ${r.minTimeMs.toFixed(4)} ms`);
        console.log(`  Max:           ${r.maxTimeMs.toFixed(4)} ms`);
        console.log(`  P50:           ${r.p50Ms.toFixed(4)} ms`);
        console.log(`  P95:           ${r.p95Ms.toFixed(4)} ms`);
        console.log(`  P99:           ${r.p99Ms.toFixed(4)} ms`);
      }

      console.log("\n" + "=".repeat(80));
    },
  };
}

/**
 * Pre-built matching engine benchmark
 */
export async function runMatchingEngineBenchmark(
  generatorConfig?: Partial<GeneratorConfig>
): Promise<BenchmarkResult[]> {
  const suite = createBenchmarkSuite({
    warmupIterations: 500,
    measureIterations: 5000,
    gcBetweenRuns: true,
  });

  const generator = createOrderGenerator({
    ...generatorConfig,
    symbol: "BTC-USD",
    basePrice: 50000,
  } as GeneratorConfig);

  // Benchmark: Order insertion
  suite.add("Order Insertion", () => {
    const book = createOrderbook("BTC-USD");
    const orders = generator.generateBatch(100);
    for (const cmd of orders) {
      addOrder(book, {
        orderId: cmd.requestId,
        userId: cmd.userId,
        symbol: cmd.symbol,
        side: cmd.side,
        type: cmd.type,
        price: cmd.price ?? 50000,
        quantity: cmd.quantity,
        quantityRemaining: cmd.quantity,
        timeInForce: cmd.timeInForce ?? "GTC",
        timestamp: cmd.timestamp,
        sequenceId: 0,
      });
    }
  });

  // Benchmark: Full matching cycle
  suite.add("Full Match Cycle", () => {
    const book = createOrderbook("BTC-USD");
    const emitter = createEventEmitter("BTC-USD");

    // Pre-fill book
    for (let i = 0; i < 50; i++) {
      addOrder(book, {
        orderId: `ask-${i}`,
        userId: "mm",
        symbol: "BTC-USD",
        side: "SELL",
        type: "LIMIT",
        price: 50000 + i * 10,
        quantity: 1,
        quantityRemaining: 1,
        timeInForce: "GTC",
        timestamp: Date.now(),
        sequenceId: 0,
      });
      addOrder(book, {
        orderId: `bid-${i}`,
        userId: "mm",
        symbol: "BTC-USD",
        side: "BUY",
        type: "LIMIT",
        price: 49990 - i * 10,
        quantity: 1,
        quantityRemaining: 1,
        timeInForce: "GTC",
        timestamp: Date.now(),
        sequenceId: 0,
      });
    }

    // Execute matching order
    const cmd = generator.generate();
    matchOrder(book, cmd, emitter, 50000);
  });

  const results = await suite.run();
  suite.printResults(results);
  return results;
}

/**
 * Throughput test
 */
export async function runThroughputTest(
  durationSeconds: number = 10,
  generatorConfig?: Partial<GeneratorConfig>
): Promise<{ ordersProcessed: number; opsPerSecond: number }> {
  const book = createOrderbook("BTC-USD");
  const emitter = createEventEmitter("BTC-USD");
  const generator = createOrderGenerator({
    ...generatorConfig,
    symbol: "BTC-USD",
  } as GeneratorConfig);

  let ordersProcessed = 0;
  const startTime = Date.now();
  const endTime = startTime + durationSeconds * 1000;

  while (Date.now() < endTime) {
    const cmd = generator.generate();
    matchOrder(book, cmd, emitter, 50000);
    ordersProcessed++;
  }

  const actualDuration = (Date.now() - startTime) / 1000;
  const opsPerSecond = ordersProcessed / actualDuration;

  console.log(`\nThroughput Test Results:`);
  console.log(`  Duration:         ${actualDuration.toFixed(2)} seconds`);
  console.log(`  Orders Processed: ${ordersProcessed.toLocaleString()}`);
  console.log(`  Ops/sec:          ${opsPerSecond.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);

  return { ordersProcessed, opsPerSecond };
}
