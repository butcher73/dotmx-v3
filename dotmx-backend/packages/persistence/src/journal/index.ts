/**
 * Event Journal (Write-Ahead Log)
 *
 * Append-only log for crash recovery.
 * An event is "committed" only after journal append succeeds.
 */

import type { Event } from "@dotmx/shared";
import { mkdir, appendFile, readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export interface Journal {
  symbol: string;
  append(event: Event): Promise<void>;
  appendBatch(events: Event[]): Promise<void>;
  read(fromSeq: number): AsyncIterable<Event>;
  getLastSeq(): Promise<number>;
  close(): Promise<void>;
}

export interface JournalConfig {
  basePath: string;
  segmentSizeBytes: number;
  syncOnWrite: boolean;
}

export const defaultJournalConfig: JournalConfig = {
  basePath: "./data/journal",
  segmentSizeBytes: 64 * 1024 * 1024, // 64MB
  syncOnWrite: true,
};

const ENTRY_SEPARATOR = "\n";

export async function createJournal(
  symbol: string,
  config: JournalConfig = defaultJournalConfig
): Promise<Journal> {
  const symbolPath = join(config.basePath, symbol);

  // Ensure directory exists
  await mkdir(symbolPath, { recursive: true });

  let currentSegment = 0;
  let currentSegmentSize = 0;
  let lastSeq = 0;

  // Find current segment and last sequence
  async function initialize() {
    if (!existsSync(symbolPath)) return;

    const files = await readdir(symbolPath);
    const segmentFiles = files
      .filter((f) => f.endsWith(".journal"))
      .sort((a, b) => {
        const aNum = parseInt(a.split(".")[0], 10);
        const bNum = parseInt(b.split(".")[0], 10);
        return aNum - bNum;
      });

    if (segmentFiles.length > 0) {
      const lastFile = segmentFiles[segmentFiles.length - 1];
      currentSegment = parseInt(lastFile.split(".")[0], 10);

      const filePath = join(symbolPath, lastFile);
      const fileStat = await stat(filePath);
      currentSegmentSize = fileStat.size;

      // Read last sequence from file
      const content = await readFile(filePath, "utf-8");
      const lines = content.trim().split(ENTRY_SEPARATOR).filter(Boolean);
      if (lines.length > 0) {
        const lastEvent = JSON.parse(lines[lines.length - 1]) as Event;
        lastSeq = lastEvent.sequenceId;
      }
    }
  }

  await initialize();

  function getSegmentPath(segment: number): string {
    return join(symbolPath, `${String(segment).padStart(10, "0")}.journal`);
  }

  async function append(event: Event): Promise<void> {
    const entry = JSON.stringify(event) + ENTRY_SEPARATOR;
    const entryBytes = Buffer.byteLength(entry, "utf-8");

    // Rotate segment if needed
    if (currentSegmentSize + entryBytes > config.segmentSizeBytes) {
      currentSegment++;
      currentSegmentSize = 0;
    }

    const filePath = getSegmentPath(currentSegment);
    await appendFile(filePath, entry, { flush: config.syncOnWrite });

    currentSegmentSize += entryBytes;
    lastSeq = event.sequenceId;
  }

  async function appendBatch(events: Event[]): Promise<void> {
    for (const event of events) {
      await append(event);
    }
  }

  async function* read(fromSeq: number): AsyncIterable<Event> {
    if (!existsSync(symbolPath)) return;

    const files = await readdir(symbolPath);
    const segmentFiles = files.filter((f) => f.endsWith(".journal")).sort();

    for (const file of segmentFiles) {
      const filePath = join(symbolPath, file);
      const content = await readFile(filePath, "utf-8");
      const lines = content.trim().split(ENTRY_SEPARATOR).filter(Boolean);

      for (const line of lines) {
        const event = JSON.parse(line) as Event;
        if (event.sequenceId >= fromSeq) {
          yield event;
        }
      }
    }
  }

  return {
    symbol,
    append,
    appendBatch,
    read,
    async getLastSeq() {
      return lastSeq;
    },
    async close() {
      // Nothing to close for file-based journal
    },
  };
}

/**
 * Create a memory-based journal (for testing)
 */
export function createMemoryJournal(symbol: string): Journal {
  const events: Event[] = [];

  return {
    symbol,
    async append(event: Event) {
      events.push(event);
    },
    async appendBatch(batch: Event[]) {
      events.push(...batch);
    },
    async *read(fromSeq: number) {
      for (const event of events) {
        if (event.sequenceId >= fromSeq) {
          yield event;
        }
      }
    },
    async getLastSeq() {
      return events.length > 0 ? events[events.length - 1].sequenceId : 0;
    },
    async close() {},
  };
}
