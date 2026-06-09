/**
 * Engine Server Entry Point
 *
 * Starts the matching engine with shard management.
 */

import { createMarketShard, createShardManager, type MarketShard } from "@dotmx/engine";
import { createJournal, createSnapshotStore, replaySymbol, buildSnapshot } from "@dotmx/persistence";
import { createL2BookBuilder, createMemoryFanout } from "@dotmx/marketdata";
import { createMemoryCommandBus } from "@dotmx/gateway";
import type { CreateOrderCommand, CancelOrderCommand } from "@dotmx/shared";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

const SHARD_ID = parseInt(process.env.SHARD_ID ?? "0", 10);
const SYMBOLS = (process.env.SYMBOLS ?? "BTC-USDT,ETH-USDT").split(",");
const SNAPSHOT_INTERVAL = parseInt(process.env.SNAPSHOT_INTERVAL ?? "60000", 10);
const ENGINE_PORT = parseInt(process.env.ENGINE_PORT ?? "3003", 10);

async function main() {
  console.log(`🚀 Starting DotMX Engine Shard ${SHARD_ID}...`);
  console.log(`📊 Symbols: ${SYMBOLS.join(", ")}`);

  // Initialize dependencies
  const shardManager = createShardManager();
  const snapshotStore = await createSnapshotStore({ basePath: "./data/snapshots", maxSnapshots: 10 });
  const fanout = createMemoryFanout();
  const commandBus = createMemoryCommandBus();

  // Track journals for cleanup
  const journals = new Map<string, Awaited<ReturnType<typeof createJournal>>>();
  const bookBuilders = new Map<string, ReturnType<typeof createL2BookBuilder>>();

  // Initialize each symbol
  for (const symbol of SYMBOLS) {
    console.log(`   Loading ${symbol}...`);

    // Create journal for this symbol
    const journal = await createJournal(symbol, {
      basePath: "./data/journal",
      segmentSizeBytes: 64 * 1024 * 1024,
      syncOnWrite: true,
    });
    journals.set(symbol, journal);

    // Replay to recover state
    const replayResult = await replaySymbol(symbol, journal, snapshotStore);
    console.log(`   ↳ Replayed ${replayResult.eventsReplayed} events (seq: ${replayResult.lastSeq})`);

    // Create market shard
    const shard = shardManager.createShard(symbol, {
      risk: {
        tickSize: 0.01,
        lotSize: 0.001,
        maxOrderSize: 1000,
        maxNotional: 10000000,
        priceDeviationThreshold: 0.1,
      },
      startSeq: replayResult.lastSeq,
    });

    // Create L2 book builder
    const bookBuilder = createL2BookBuilder(symbol);
    bookBuilders.set(symbol, bookBuilder);

    // Publish initial snapshot
    const book = bookBuilder.getSnapshot(20);
    fanout.publish({ type: "snapshot", data: book });

    // Schedule periodic snapshots
    setInterval(async () => {
      const snapshot = buildSnapshot(
        symbol,
        shard.events.currentSeq,
        [], // Would serialize orderbook orders
        bookBuilder.getBook().bids,
        bookBuilder.getBook().asks
      );
      await snapshotStore.save(snapshot);
      console.log(`💾 Snapshot saved for ${symbol} at seq ${snapshot.sequenceId}`);
    }, SNAPSHOT_INTERVAL);
  }

  // Subscribe to commands and process them
  for (const symbol of SYMBOLS) {
    await commandBus.subscribe(`commands.${symbol}`, async (cmd, ack) => {
      try {
        const shard = shardManager.getShard(symbol);
        const journal = journals.get(symbol);
        const bookBuilder = bookBuilders.get(symbol);

        if (!shard || !journal || !bookBuilder) {
          console.error(`Shard not found for ${symbol}`);
          return;
        }

        // Process command and get events
        const events = shard.processCommand(cmd as CreateOrderCommand | CancelOrderCommand);

        // Persist events and update book
        for (const event of events) {
          await journal.append(event);
          const delta = bookBuilder.applyEvent(event);
          if (delta) {
            fanout.publish({ type: "delta", data: delta });
          }
        }

        ack();
      } catch (err) {
        console.error(`Command processing failed:`, err);
      }
    });
  }

  console.log(`✅ Engine Shard ${SHARD_ID} ready`);
  console.log(`   Processing ${SYMBOLS.length} symbols`);

  // HTTP server for health and status
  const app = new Elysia()
    .use(cors())
    .get("/", () => ({
      service: "engine",
      shardId: SHARD_ID,
      status: "running",
      symbols: SYMBOLS,
    }))
    .get("/health", () => {
      const shardStatus = SYMBOLS.map(symbol => {
        const shard = shardManager.getShard(symbol);
        const state = shard?.getState();
        return {
          symbol,
          status: shard ? "active" : "inactive",
          sequenceId: state?.lastSeq ?? 0,
          orderCount: state?.orderCount ?? 0,
          bidLevels: state?.bidLevels ?? 0,
          askLevels: state?.askLevels ?? 0,
          midPrice: state?.midPrice ?? null,
        };
      });

      return {
        service: "engine",
        shardId: SHARD_ID,
        status: "healthy",
        uptime: process.uptime(),
        symbols: shardStatus,
      };
    })
    .get("/shards", () => {
      const allShards = shardManager.getAllShards();
      return {
        shardId: SHARD_ID,
        shards: allShards.map(shard => {
          const state = shard.getState();
          return {
            symbol: state.symbol,
            lastSeq: state.lastSeq,
            orderCount: state.orderCount,
            bidLevels: state.bidLevels,
            askLevels: state.askLevels,
            midPrice: state.midPrice,
          };
        }),
      };
    })
    .listen(ENGINE_PORT);

  console.log(`🌐 Engine HTTP server listening on port ${ENGINE_PORT}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n🛑 Shutting down engine...");
    
    // Final snapshots
    for (const symbol of SYMBOLS) {
      const shard = shardManager.getShard(symbol);
      const bookBuilder = bookBuilders.get(symbol);
      if (shard && bookBuilder) {
        console.log(`   Saving final snapshot for ${symbol}...`);
        const snapshot = buildSnapshot(
          symbol,
          shard.events.currentSeq,
          [],
          bookBuilder.getBook().bids,
          bookBuilder.getBook().asks
        );
        await snapshotStore.save(snapshot);
      }
    }

    // Close journals
    for (const journal of journals.values()) {
      await journal.close();
    }
    
    await commandBus.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("❌ Failed to start engine:", err);
  process.exit(1);
});
