/**
 * Replay
 *
 * Recover state on startup:
 * 1. Load latest snapshot
 * 2. Replay journal from snapshot offset
 * 3. Rebuild in-memory state
 */

import type { Event, Order, PriceLevel } from "@dotmx/shared";
import type { Journal } from "../journal";
import type { Snapshot, SnapshotStore } from "../snapshot";

export interface ReplayResult {
  snapshot: Snapshot | null;
  eventsReplayed: number;
  lastSeq: number;
  orders: Order[];
  bids: PriceLevel[];
  asks: PriceLevel[];
}

export type EventHandler = (event: Event) => void;

/**
 * Replay events for a symbol and rebuild state
 */
export async function replaySymbol(
  symbol: string,
  journal: Journal,
  snapshots: SnapshotStore,
  onEvent?: EventHandler
): Promise<ReplayResult> {
  // Load latest snapshot
  const snapshot = await snapshots.loadLatest(symbol);
  const startSeq = snapshot?.sequenceId ?? 0;

  // Initialize state from snapshot
  const orders: Order[] = snapshot?.orders ? [...snapshot.orders] : [];
  const bids: PriceLevel[] = snapshot?.bids ? [...snapshot.bids] : [];
  const asks: PriceLevel[] = snapshot?.asks ? [...snapshot.asks] : [];

  // Replay events from journal
  let eventsReplayed = 0;
  let lastSeq = startSeq;

  for await (const event of journal.read(startSeq)) {
    if (onEvent) {
      onEvent(event);
    }
    
    // Apply event to state
    applyEvent(event, orders, bids, asks);
    
    eventsReplayed++;
    lastSeq = event.sequenceId;
  }

  return {
    snapshot,
    eventsReplayed,
    lastSeq,
    orders,
    bids,
    asks,
  };
}

/**
 * Apply event to state (simplified - real implementation would be more complex)
 */
function applyEvent(
  event: Event,
  orders: Order[],
  bids: PriceLevel[],
  asks: PriceLevel[]
): void {
  const payload = event.payload as Record<string, unknown>;

  switch (event.kind) {
    case "OrderAccepted":
    case "OrderResting": {
      const order: Order = {
        orderId: payload.orderId as string,
        userId: payload.userId as string,
        symbol: event.symbol,
        side: payload.side as "BUY" | "SELL",
        type: payload.type as "LIMIT" | "MARKET",
        price: payload.price as number,
        quantity: payload.quantity as number,
        quantityRemaining: payload.quantityRemaining as number ?? payload.quantity as number,
        timeInForce: (payload.timeInForce as "GTC" | "IOC" | "FOK") ?? "GTC",
        timestamp: event.timestamp,
        sequenceId: event.sequenceId,
      };
      orders.push(order);
      break;
    }

    case "OrderFilled":
    case "OrderCanceled": {
      const orderId = payload.orderId as string;
      const index = orders.findIndex((o) => o.orderId === orderId);
      if (index !== -1) {
        orders.splice(index, 1);
      }
      break;
    }

    case "OrderPartiallyFilled": {
      const orderId = payload.orderId as string;
      const remaining = payload.remaining as number;
      const order = orders.find((o) => o.orderId === orderId);
      if (order) {
        order.quantityRemaining = remaining;
      }
      break;
    }

    case "Trade": {
      // Update level aggregates if needed
      break;
    }
  }
}

/**
 * Build snapshot from current shard state
 */
export function buildSnapshot(
  symbol: string,
  sequenceId: number,
  orders: Order[],
  bids: PriceLevel[],
  asks: PriceLevel[]
): Snapshot {
  return {
    symbol,
    sequenceId,
    timestamp: Date.now(),
    bids: [...bids],
    asks: [...asks],
    orders: [...orders],
  };
}

/**
 * Periodic snapshot scheduler
 */
export function createSnapshotScheduler(
  intervalMs: number,
  snapshotFn: () => Promise<void>
): { start: () => void; stop: () => void } {
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    start() {
      if (timer) return;
      timer = setInterval(async () => {
        try {
          await snapshotFn();
        } catch (err) {
          console.error("Snapshot failed:", err);
        }
      }, intervalMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
