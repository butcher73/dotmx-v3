#!/usr/bin/env bun
// @ts-nocheck
/**
 * Benchmark CLI
 *
 * Runs the matching engine with synthetic order flow and measures
 * throughput and latency.
 *
 * Usage:
 *   bun run packages/tools/src/cli/bench.ts [--symbols N] [--ops N] [--duration N]
 */

import { createOrderGenerator } from "../generator";
import { createMetricsRegistry, createEngineMetrics } from "../metrics";
import { createMarketShard } from "@dotmx/engine/shard";

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const SYMBOLS = ["BTC-USDT", "ETH-USDT", "SOL-USDT"].slice(
  0,
  parseInt(getArg("symbols", "3"), 10)
);
const OPS = parseInt(getArg("ops", "100000"), 10);
const DURATION_MS = parseInt(getArg("duration", "0"), 10); // 0 = run OPS count

console.log("🚀 DotMX Matching Engine Benchmark");
console.log(`   Symbols:    ${SYMBOLS.join(", ")}`);
console.log(`   Operations: ${OPS.toLocaleString()}`);
console.log(`   Mode:       ${DURATION_MS > 0 ? `${DURATION_MS}ms timed` : "fixed ops"}`);
console.log("");

// ── Setup shards & generators ───────────────────────────────────────────────
const registry = createMetricsRegistry();
const metrics = createEngineMetrics(registry);

const basePrices: Record<string, number> = {
  "BTC-USD": 50000,
  "ETH-USD": 3000,
  "SOL-USD": 100,
};

const shards = SYMBOLS.map((symbol) => createMarketShard({ symbol }));
const generators = SYMBOLS.map((symbol) =>
  createOrderGenerator({
    symbol,
    basePrice: basePrices[symbol] ?? 1000,
    priceVolatility: 0.001,
    orderRatePerSecond: 0, // unused — we drive manually
    buyProbability: 0.5,
    limitProbability: 0.8,
    cancelProbability: 0.1,
    meanOrderSize: symbol === "BTC-USD" ? 0.1 : 1,
    sizeVolatility: 0.5,
    userCount: 200,
    tickSize: 0.01,
    lotSize: 0.001,
  })
);

// ── Warmup ──────────────────────────────────────────────────────────────────
const WARMUP = Math.min(1000, Math.floor(OPS * 0.01));
console.log(`⏳ Warming up (${WARMUP} orders)...`);
for (let i = 0; i < WARMUP; i++) {
  const idx = i % shards.length;
  const order = generators[idx].generate();
  shards[idx].processCreateOrder(order);
}

// ── Benchmark loop ──────────────────────────────────────────────────────────
console.log(`📊 Running benchmark...`);

const latencies: number[] = [];
let opsCompleted = 0;
let tradesProduced = 0;

const startTime = performance.now();
const endCondition = DURATION_MS > 0
  ? () => performance.now() - startTime < DURATION_MS
  : () => opsCompleted < OPS;

while (endCondition()) {
  const idx = opsCompleted % shards.length;
  const order = generators[idx].generate();

  const t0 = performance.now();
  const events = shards[idx].processCreateOrder(order);
  const elapsed = performance.now() - t0;

  latencies.push(elapsed);
  metrics.ordersReceived.inc({ symbol: SYMBOLS[idx] });

  for (const ev of events) {
    if (ev.kind === "Trade") {
      tradesProduced++;
      metrics.tradesExecuted.inc({ symbol: SYMBOLS[idx] });
    }
  }

  opsCompleted++;
}

const totalTimeMs = performance.now() - startTime;

// ── Compute stats ───────────────────────────────────────────────────────────
latencies.sort((a, b) => a - b);
const p50 = latencies[Math.floor(latencies.length * 0.5)];
const p95 = latencies[Math.floor(latencies.length * 0.95)];
const p99 = latencies[Math.floor(latencies.length * 0.99)];
const avgLatency = latencies.reduce((s, v) => s + v, 0) / latencies.length;
const opsPerSec = (opsCompleted / totalTimeMs) * 1000;

console.log("");
console.log("═══════════════════════════════════════════════");
console.log("  BENCHMARK RESULTS");
console.log("═══════════════════════════════════════════════");
console.log(`  Total ops:      ${opsCompleted.toLocaleString()}`);
console.log(`  Trades:         ${tradesProduced.toLocaleString()}`);
console.log(`  Duration:       ${totalTimeMs.toFixed(1)} ms`);
console.log(`  Throughput:     ${opsPerSec.toFixed(0)} ops/sec`);
console.log("");
console.log("  Latency (ms):");
console.log(`    avg:  ${(avgLatency * 1000).toFixed(2)} µs`);
console.log(`    p50:  ${(p50 * 1000).toFixed(2)} µs`);
console.log(`    p95:  ${(p95 * 1000).toFixed(2)} µs`);
console.log(`    p99:  ${(p99 * 1000).toFixed(2)} µs`);
console.log(`    min:  ${(latencies[0] * 1000).toFixed(2)} µs`);
console.log(`    max:  ${(latencies[latencies.length - 1] * 1000).toFixed(2)} µs`);
console.log("");

// Orderbook state after benchmark
for (const shard of shards) {
  const state = shard.getState();
  console.log(`  ${state.symbol}: ${state.orderCount} resting orders, ` +
    `${state.bidLevels} bid levels, ${state.askLevels} ask levels, ` +
    `mid ${state.midPrice?.toFixed(2) ?? "N/A"}`);
}

console.log("═══════════════════════════════════════════════");
