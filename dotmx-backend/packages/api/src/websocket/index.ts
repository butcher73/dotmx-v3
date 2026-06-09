/**
 * WebSocket Handlers (Standalone)
 *
 * Utility functions for market data streaming.
 * The primary WS implementation is in ../ws/index.ts (Elysia WS plugin).
 * These provide standalone handler logic for depth and trade streams.
 */

import type { MarketDataFanout, MarketDataMessage } from "@dotmx/marketdata";

export interface WsSubscription {
  symbol: string;
  stream: "depth" | "trade" | "ticker";
}

export interface WsClient {
  id: string;
  send: (data: string) => void;
  subscriptions: Set<string>;
}

/**
 * Manage depth stream subscriptions for a set of clients.
 * Subscribes to the fanout and broadcasts L2 snapshots + deltas.
 */
export function handleDepthStream(
  fanout: MarketDataFanout,
  clients: Map<string, WsClient>
) {
  const symbolSubscribers = new Map<string, Set<string>>();
  const unsubscribes = new Map<string, () => void>();

  function subscribe(clientId: string, symbol: string) {
    const client = clients.get(clientId);
    if (!client) return;

    client.subscriptions.add(`depth@${symbol}`);

    let subs = symbolSubscribers.get(symbol);
    if (!subs) {
      subs = new Set();
      symbolSubscribers.set(symbol, subs);

      // Subscribe to fanout once per symbol
      const unsub = fanout.subscribe(symbol, (msg: MarketDataMessage) => {
        if (msg.type !== "snapshot" && msg.type !== "delta") return;

        const payload = JSON.stringify({
          stream: `${symbol}@depth`,
          data: msg.data,
        });

        const subscribers = symbolSubscribers.get(symbol);
        if (subscribers) {
          for (const cid of subscribers) {
            const c = clients.get(cid);
            if (c) {
              try { c.send(payload); } catch { /* client disconnected */ }
            }
          }
        }
      });
      unsubscribes.set(symbol, unsub);
    }
    subs.add(clientId);
  }

  function unsubscribe(clientId: string, symbol: string) {
    const client = clients.get(clientId);
    if (client) client.subscriptions.delete(`depth@${symbol}`);

    const subs = symbolSubscribers.get(symbol);
    if (subs) {
      subs.delete(clientId);
      if (subs.size === 0) {
        symbolSubscribers.delete(symbol);
        const unsub = unsubscribes.get(symbol);
        if (unsub) {
          unsub();
          unsubscribes.delete(symbol);
        }
      }
    }
  }

  function removeClient(clientId: string) {
    const client = clients.get(clientId);
    if (!client) return;
    for (const sub of client.subscriptions) {
      if (sub.startsWith("depth@")) {
        const symbol = sub.substring(6);
        unsubscribe(clientId, symbol);
      }
    }
  }

  function cleanup() {
    for (const unsub of unsubscribes.values()) unsub();
    unsubscribes.clear();
    symbolSubscribers.clear();
  }

  return { subscribe, unsubscribe, removeClient, cleanup };
}

/**
 * Manage trade stream subscriptions for a set of clients.
 * Subscribes to the fanout and broadcasts real-time trades.
 */
export function handleTradeStream(
  fanout: MarketDataFanout,
  clients: Map<string, WsClient>
) {
  const symbolSubscribers = new Map<string, Set<string>>();
  const unsubscribes = new Map<string, () => void>();

  function subscribe(clientId: string, symbol: string) {
    const client = clients.get(clientId);
    if (!client) return;

    client.subscriptions.add(`trade@${symbol}`);

    let subs = symbolSubscribers.get(symbol);
    if (!subs) {
      subs = new Set();
      symbolSubscribers.set(symbol, subs);

      const unsub = fanout.subscribe(symbol, (msg: MarketDataMessage) => {
        if (msg.type !== "trade") return;

        const payload = JSON.stringify({
          stream: `${symbol}@trade`,
          data: msg.data,
        });

        const subscribers = symbolSubscribers.get(symbol);
        if (subscribers) {
          for (const cid of subscribers) {
            const c = clients.get(cid);
            if (c) {
              try { c.send(payload); } catch { /* client disconnected */ }
            }
          }
        }
      });
      unsubscribes.set(symbol, unsub);
    }
    subs.add(clientId);
  }

  function unsubscribe(clientId: string, symbol: string) {
    const client = clients.get(clientId);
    if (client) client.subscriptions.delete(`trade@${symbol}`);

    const subs = symbolSubscribers.get(symbol);
    if (subs) {
      subs.delete(clientId);
      if (subs.size === 0) {
        symbolSubscribers.delete(symbol);
        const unsub = unsubscribes.get(symbol);
        if (unsub) {
          unsub();
          unsubscribes.delete(symbol);
        }
      }
    }
  }

  function removeClient(clientId: string) {
    const client = clients.get(clientId);
    if (!client) return;
    for (const sub of client.subscriptions) {
      if (sub.startsWith("trade@")) {
        const symbol = sub.substring(6);
        unsubscribe(clientId, symbol);
      }
    }
  }

  function cleanup() {
    for (const unsub of unsubscribes.values()) unsub();
    unsubscribes.clear();
    symbolSubscribers.clear();
  }

  return { subscribe, unsubscribe, removeClient, cleanup };
}
