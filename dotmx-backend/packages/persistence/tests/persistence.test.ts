/**
 * Persistence Package Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm } from "fs/promises";
import {
  createJournal,
  createSnapshotStore,
  replaySymbol,
  buildSnapshot,
} from "../src";
import type { Event } from "@dotmx/shared";

const TEST_DIR = "./test-data-persistence";

describe("Journal", () => {
  let journal: Awaited<ReturnType<typeof createJournal>>;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    journal = await createJournal("BTC-USD", {
      basePath: TEST_DIR,
      segmentSizeBytes: 1024, // Small for testing rotation
      syncOnWrite: false,
    });
  });

  afterEach(async () => {
    await journal.close();
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should append and read events", async () => {
    const event: Event = {
      eventId: "evt-1",
      symbol: "BTC-USD",
      kind: "OrderAccepted",
      sequenceId: 1,
      timestamp: Date.now(),
      payload: { orderId: "order-1" },
    };

    await journal.append(event);

    const events: Event[] = [];
    for await (const e of journal.read(0)) {
      events.push(e);
    }

    expect(events.length).toBe(1);
    expect(events[0].eventId).toBe("evt-1");
  });

  it("should read from specific sequence", async () => {
    for (let i = 1; i <= 5; i++) {
      await journal.append({
        eventId: `evt-${i}`,
        symbol: "BTC-USD",
        kind: "OrderAccepted",
        sequenceId: i,
        timestamp: Date.now(),
        payload: { orderId: `order-${i}` },
      });
    }

    const events: Event[] = [];
    for await (const e of journal.read(3)) {
      events.push(e);
    }

    expect(events.length).toBe(3);
    expect(events[0].sequenceId).toBe(3);
  });

  it("should report last sequence id", async () => {
    const lastSeq = await journal.getLastSeq();
    expect(lastSeq).toBe(0);

    await journal.append({
      eventId: "evt-1",
      symbol: "BTC-USD",
      kind: "OrderAccepted",
      sequenceId: 100,
      timestamp: Date.now(),
      payload: {},
    });

    const newLastSeq = await journal.getLastSeq();
    expect(newLastSeq).toBe(100);
  });
});

describe("Snapshot Store", () => {
  let store: Awaited<ReturnType<typeof createSnapshotStore>>;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    store = await createSnapshotStore({
      basePath: TEST_DIR,
      maxSnapshots: 3,
    });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should save and load snapshot", async () => {
    const snapshot = buildSnapshot(
      "BTC-USD",
      100,
      [], // orders
      [{ price: 49000, quantity: 10, orderCount: 1 }], // bids
      [{ price: 51000, quantity: 5, orderCount: 1 }]  // asks
    );

    await store.save(snapshot);

    const loaded = await store.loadLatest("BTC-USD");
    expect(loaded).not.toBeNull();
    expect(loaded!.symbol).toBe("BTC-USD");
    expect(loaded!.sequenceId).toBe(100);
  });

  it("should return null for missing snapshot", async () => {
    const loaded = await store.loadLatest("NONEXISTENT");
    expect(loaded).toBeNull();
  });

  it("should list snapshots", async () => {
    for (let i = 1; i <= 3; i++) {
      await store.save(buildSnapshot("BTC-USD", i * 100, [], [], []));
    }

    const list = await store.list("BTC-USD");
    expect(list.length).toBe(3);
  });
});

describe("Replay", () => {
  let journal: Awaited<ReturnType<typeof createJournal>>;
  let snapshotStore: Awaited<ReturnType<typeof createSnapshotStore>>;

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    journal = await createJournal("BTC-USD", { basePath: TEST_DIR, segmentSizeBytes: 4096, syncOnWrite: false });
    snapshotStore = await createSnapshotStore({ basePath: TEST_DIR, maxSnapshots: 5 });
  });

  afterEach(async () => {
    await journal.close();
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should replay from empty state", async () => {
    // Add events to journal
    for (let i = 1; i <= 5; i++) {
      await journal.append({
        eventId: `evt-${i}`,
        symbol: "BTC-USD",
        kind: "OrderAccepted",
        sequenceId: i,
        timestamp: Date.now(),
        payload: { orderId: `order-${i}` },
      });
    }

    const result = await replaySymbol("BTC-USD", journal, snapshotStore);

    expect(result.lastSeq).toBe(5);
    expect(result.eventsReplayed).toBe(5);
    expect(result.snapshot).toBeNull(); // No snapshot
  });

  it("should replay from snapshot", async () => {
    // Save a snapshot at sequence 50
    await snapshotStore.save(buildSnapshot("BTC-USD", 50, [], [], []));

    // Add events after snapshot
    for (let i = 51; i <= 60; i++) {
      await journal.append({
        eventId: `evt-${i}`,
        symbol: "BTC-USD",
        kind: "OrderAccepted",
        sequenceId: i,
        timestamp: Date.now(),
        payload: {},
      });
    }

    const result = await replaySymbol("BTC-USD", journal, snapshotStore);

    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot!.sequenceId).toBe(50);
    expect(result.eventsReplayed).toBe(10);
    expect(result.lastSeq).toBe(60);
  });
});
