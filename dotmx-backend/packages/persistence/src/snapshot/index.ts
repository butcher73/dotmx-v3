/**
 * Snapshots
 *
 * Periodic snapshots for faster recovery.
 * Snapshot = L2 book levels + active orders + last sequence
 */

import type { Order, PriceLevel } from "@dotmx/shared";
import { mkdir, writeFile, readFile, readdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export interface Snapshot {
  symbol: string;
  sequenceId: number;
  timestamp: number;
  bids: PriceLevel[];
  asks: PriceLevel[];
  orders: Order[];
}

export interface SnapshotStore {
  save(snapshot: Snapshot): Promise<void>;
  loadLatest(symbol: string): Promise<Snapshot | null>;
  load(symbol: string, sequenceId: number): Promise<Snapshot | null>;
  list(symbol: string): Promise<{ seq: number; timestamp: number }[]>;
}

export interface SnapshotConfig {
  basePath: string;
  maxSnapshots: number; // Keep only N most recent
}

export const defaultSnapshotConfig: SnapshotConfig = {
  basePath: "./data/snapshots",
  maxSnapshots: 10,
};

export async function createSnapshotStore(
  config: SnapshotConfig = defaultSnapshotConfig
): Promise<SnapshotStore> {
  async function getSymbolPath(symbol: string): Promise<string> {
    const path = join(config.basePath, symbol);
    await mkdir(path, { recursive: true });
    return path;
  }

  function getSnapshotFilename(sequenceId: number): string {
    return `${String(sequenceId).padStart(16, "0")}.snapshot.json`;
  }

  async function save(snapshot: Snapshot): Promise<void> {
    const symbolPath = await getSymbolPath(snapshot.symbol);
    const filename = getSnapshotFilename(snapshot.sequenceId);
    const filePath = join(symbolPath, filename);

    await writeFile(filePath, JSON.stringify(snapshot, null, 2));

    // Cleanup old snapshots
    const files = await readdir(symbolPath);
    const snapshotFiles = files.filter((f) => f.endsWith(".snapshot.json")).sort();

    if (snapshotFiles.length > config.maxSnapshots) {
      const toDelete = snapshotFiles.slice(0, snapshotFiles.length - config.maxSnapshots);
      const { unlink } = await import("fs/promises");
      for (const file of toDelete) {
        await unlink(join(symbolPath, file));
      }
    }
  }

  async function loadLatest(symbol: string): Promise<Snapshot | null> {
    const symbolPath = join(config.basePath, symbol);
    if (!existsSync(symbolPath)) return null;

    const files = await readdir(symbolPath);
    const snapshotFiles = files.filter((f) => f.endsWith(".snapshot.json")).sort();

    if (snapshotFiles.length === 0) return null;

    const latestFile = snapshotFiles[snapshotFiles.length - 1];
    const content = await readFile(join(symbolPath, latestFile), "utf-8");
    return JSON.parse(content) as Snapshot;
  }

  async function load(symbol: string, sequenceId: number): Promise<Snapshot | null> {
    const symbolPath = join(config.basePath, symbol);
    const filename = getSnapshotFilename(sequenceId);
    const filePath = join(symbolPath, filename);

    if (!existsSync(filePath)) return null;

    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as Snapshot;
  }

  async function list(symbol: string): Promise<{ seq: number; timestamp: number }[]> {
    const symbolPath = join(config.basePath, symbol);
    if (!existsSync(symbolPath)) return [];

    const files = await readdir(symbolPath);
    const snapshotFiles = files.filter((f) => f.endsWith(".snapshot.json")).sort();

    const result: { seq: number; timestamp: number }[] = [];
    for (const file of snapshotFiles) {
      const content = await readFile(join(symbolPath, file), "utf-8");
      const snapshot = JSON.parse(content) as Snapshot;
      result.push({ seq: snapshot.sequenceId, timestamp: snapshot.timestamp });
    }

    return result;
  }

  return {
    save,
    loadLatest,
    load,
    list,
  };
}

/**
 * Create a memory-based snapshot store (for testing)
 */
export function createMemorySnapshotStore(): SnapshotStore {
  const snapshots = new Map<string, Snapshot[]>();

  return {
    async save(snapshot: Snapshot) {
      const list = snapshots.get(snapshot.symbol) ?? [];
      list.push(snapshot);
      snapshots.set(snapshot.symbol, list);
    },
    async loadLatest(symbol: string) {
      const list = snapshots.get(symbol);
      if (!list || list.length === 0) return null;
      return list[list.length - 1];
    },
    async load(symbol: string, sequenceId: number) {
      const list = snapshots.get(symbol);
      if (!list) return null;
      return list.find((s) => s.sequenceId === sequenceId) ?? null;
    },
    async list(symbol: string) {
      const list = snapshots.get(symbol) ?? [];
      return list.map((s) => ({ seq: s.sequenceId, timestamp: s.timestamp }));
    },
  };
}
