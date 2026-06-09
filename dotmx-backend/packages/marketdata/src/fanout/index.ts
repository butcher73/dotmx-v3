// @ts-nocheck
/**
 * Market Data Fanout
 *
 * Broadcasts market data to WebSocket subscribers.
 * Uses Redis pub/sub for horizontal scaling.
 */

import type { L2Book, L2Delta } from "../builder";

export interface Trade {
  tradeId: string;
  symbol: string;
  price: number;
  quantity: number;
  makerSide: "BUY" | "SELL";
  timestamp: number;
}

export interface Ticker {
  symbol: string;
  lastPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}

export type MarketDataMessage =
  | { type: "snapshot"; data: L2Book }
  | { type: "delta"; data: L2Delta }
  | { type: "trade"; data: Trade }
  | { type: "ticker"; data: Ticker };

export type MarketDataHandler = (message: MarketDataMessage) => void;

export interface MarketDataFanout {
  publish(message: MarketDataMessage): Promise<void>;
  subscribe(symbol: string, handler: MarketDataHandler): () => void;
  subscribeAll(handler: MarketDataHandler): () => void;
  getSubscriberCount(symbol: string): number;
}

export interface FanoutConfig {
  redisUrl?: string;
  channelPrefix: string;
}

export const defaultFanoutConfig: FanoutConfig = {
  channelPrefix: "md:",
};

/**
 * Create memory-based fanout (single server)
 */
export function createMemoryFanout(): MarketDataFanout {
  const subscribers = new Map<string, Set<MarketDataHandler>>();
  const allSubscribers = new Set<MarketDataHandler>();

  return {
    async publish(message: MarketDataMessage) {
      const symbol = getSymbolFromMessage(message);
      
      // Notify symbol-specific subscribers
      const subs = subscribers.get(symbol);
      if (subs) {
        for (const handler of subs) {
          try {
            handler(message);
          } catch (e) {
            console.error("Fanout handler error:", e);
          }
        }
      }

      // Notify all-symbol subscribers
      for (const handler of allSubscribers) {
        try {
          handler(message);
        } catch (e) {
          console.error("Fanout handler error:", e);
        }
      }
    },

    subscribe(symbol: string, handler: MarketDataHandler): () => void {
      const subs = subscribers.get(symbol) ?? new Set();
      subs.add(handler);
      subscribers.set(symbol, subs);

      return () => {
        subs.delete(handler);
        if (subs.size === 0) {
          subscribers.delete(symbol);
        }
      };
    },

    subscribeAll(handler: MarketDataHandler): () => void {
      allSubscribers.add(handler);
      return () => {
        allSubscribers.delete(handler);
      };
    },

    getSubscriberCount(symbol: string): number {
      return (subscribers.get(symbol)?.size ?? 0) + allSubscribers.size;
    },
  };
}

/**
 * Create Redis-based fanout (multi-server)
 */
export async function createRedisFanout(
  config: FanoutConfig = defaultFanoutConfig
): Promise<MarketDataFanout> {
  // Dynamic import to avoid bundling issues
  const { createClient } = await import("redis");
  
  const redisUrl = config.redisUrl ?? "redis://localhost:6379";
  
  const pubClient = createClient({ url: redisUrl });
  const subClient = createClient({ url: redisUrl });
  
  await pubClient.connect();
  await subClient.connect();

  const localSubscribers = new Map<string, Set<MarketDataHandler>>();
  const allSubscribers = new Set<MarketDataHandler>();

  // Subscribe to all market data channels
  await subClient.pSubscribe(`${config.channelPrefix}*`, (message, channel) => {
    try {
      const parsed = JSON.parse(message) as MarketDataMessage;
      const symbol = channel.replace(config.channelPrefix, "");

      // Notify local subscribers
      const subs = localSubscribers.get(symbol);
      if (subs) {
        for (const handler of subs) {
          handler(parsed);
        }
      }

      for (const handler of allSubscribers) {
        handler(parsed);
      }
    } catch (e) {
      console.error("Redis fanout parse error:", e);
    }
  });

  return {
    async publish(message: MarketDataMessage) {
      const symbol = getSymbolFromMessage(message);
      const channel = `${config.channelPrefix}${symbol}`;
      await pubClient.publish(channel, JSON.stringify(message));
    },

    subscribe(symbol: string, handler: MarketDataHandler): () => void {
      const subs = localSubscribers.get(symbol) ?? new Set();
      subs.add(handler);
      localSubscribers.set(symbol, subs);

      return () => {
        subs.delete(handler);
        if (subs.size === 0) {
          localSubscribers.delete(symbol);
        }
      };
    },

    subscribeAll(handler: MarketDataHandler): () => void {
      allSubscribers.add(handler);
      return () => {
        allSubscribers.delete(handler);
      };
    },

    getSubscriberCount(symbol: string): number {
      return (localSubscribers.get(symbol)?.size ?? 0) + allSubscribers.size;
    },
  };
}

function getSymbolFromMessage(message: MarketDataMessage): string {
  return message.data.symbol;
}
