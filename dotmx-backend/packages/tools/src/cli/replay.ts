#!/usr/bin/env bun
/**
 * Replay CLI
 *
 * Replays journal events for a symbol to rebuild orderbook state.
 * Optionally restores from the latest snapshot first.
 *
 * Usage:
 *   bun run packages/tools/src/cli/replay.ts --symbol BTC-USD [--from SEQ] [--no-snapshot]
 */

import { createJournal } from "@dotmx/persistence";
import { createSnapshotStore, type Snapshot } from "@dotmx/persistence";
import { replaySymbol } from "@dotmx/persistence";

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name: string, fallback?: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}
const hasFlag = (name: string) => args.includes(`--${name}`);

const symbol = getArg("symbol");
const fromSeq = parseInt(getArg("from", "0")!, 10);
const skipSnapshot = hasFlag("no-snapshot");
const journalPath = getArg("journal-path", "./data/journal");
const snapshotPath = getArg("snapshot-path", "./data/snapshots");
const verbose = hasFlag("verbose") || hasFlag("v");

if (!symbol) {
  console.log("🔄 DotMX Journal Replay Tool");
  console.log("");
  console.log("Usage:");
  console.log("  bun run packages/tools/src/cli/replay.ts --symbol <SYMBOL> [options]");
  console.log("");
  console.log("Options:");
  console.log("  --symbol <SYM>          Trading pair symbol (required)");
  console.log("  --from <SEQ>            Start from sequence number (default: 0)");
  console.log("  --no-snapshot           Skip snapshot, replay from scratch");
  console.log("  --journal-path <PATH>   Journal directory (default: ./data/journal)");
  console.log("  --snapshot-path <PATH>  Snapshot directory (default: ./data/snapshots)");
  console.log("  --verbose               Print each replayed event");
  process.exit(1);
}

console.log(`🔄 Replaying ${symbol} from seq ${fromSeq}${skipSnapshot ? " (no snapshot)" : ""}...`);

// ── Setup ───────────────────────────────────────────────────────────────────
const journal = await createJournal(symbol, {
  basePath: journalPath!,
  segmentSizeBytes: 64 * 1024 * 1024,
  syncOnWrite: false, // read-only replay
});

const snapshots = await createSnapshotStore({
  basePath: snapshotPath!,
  maxSnapshots: 10,
});

// ── Replay ──────────────────────────────────────────────────────────────────
const startTime = performance.now();

let eventTypes: Record<string, number> = {};

const result = await replaySymbol(
  symbol,
  journal,
  skipSnapshot ? { save: async () => {}, loadLatest: async () => null, load: async () => null, list: async () => [] } : snapshots,
  verbose
    ? (event) => {
        eventTypes[event.kind] = (eventTypes[event.kind] ?? 0) + 1;
        console.log(`  [${event.sequenceId}] ${event.kind} — ${JSON.stringify(event.payload).substring(0, 80)}`);
      }
    : (event) => {
        eventTypes[event.kind] = (eventTypes[event.kind] ?? 0) + 1;
      }
);

const elapsed = performance.now() - startTime;

// ── Report ──────────────────────────────────────────────────────────────────
console.log("");
console.log("═══════════════════════════════════════════════");
console.log("  REPLAY RESULTS");
console.log("═══════════════════════════════════════════════");
console.log(`  Symbol:          ${symbol}`);
console.log(`  Snapshot:        ${result.snapshot ? `seq ${result.snapshot.sequenceId}` : "none"}`);
console.log(`  Events replayed: ${result.eventsReplayed.toLocaleString()}`);
console.log(`  Last sequence:   ${result.lastSeq}`);
console.log(`  Active orders:   ${result.orders.length}`);
console.log(`  Bid levels:      ${result.bids.length}`);
console.log(`  Ask levels:      ${result.asks.length}`);
console.log(`  Duration:        ${elapsed.toFixed(1)} ms`);
console.log("");

if (Object.keys(eventTypes).length > 0) {
  console.log("  Event breakdown:");
  for (const [kind, count] of Object.entries(eventTypes).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${kind}: ${count.toLocaleString()}`);
  }
}

console.log("═══════════════════════════════════════════════");

await journal.close();
