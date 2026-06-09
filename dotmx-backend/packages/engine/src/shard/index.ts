/**
 * Module 02 — Market Shard (Single Writer)
 *
 * Each shard handles one symbol with:
 * - In-memory orderbook
 * - Matching loop
 * - Event emission
 * - Command queue (FIFO)
 */

import type { Command, Event, CreateOrderCommand, CancelOrderCommand } from "@dotmx/shared";
import { createOrderbook, type Orderbook, getL2Snapshot, getMidPrice } from "../orderbook";
import { createEventEmitter, type EventEmitter } from "../events";
import { matchOrder, cancelOrder, type MatchingEngineConfig, defaultMatchingConfig } from "../matching";
import { type RiskConfig, defaultRiskConfig } from "../risk";

export interface ShardState {
  symbol: string;
  lastSeq: number;
  orderCount: number;
  bidLevels: number;
  askLevels: number;
  midPrice: number | null;
}

export interface MarketShard {
  symbol: string;
  book: Orderbook;
  events: EventEmitter;
  config: MatchingEngineConfig;
  
  processCommand(command: Command): Event[];
  processCreateOrder(command: CreateOrderCommand): Event[];
  processCancelOrder(command: CancelOrderCommand): Event[];
  getState(): ShardState;
  getSnapshot(depth?: number): ReturnType<typeof getL2Snapshot>;
  setMarkPrice(price: number): void;
}

export interface MarketShardConfig {
  symbol: string;
  matching?: Partial<MatchingEngineConfig>;
  risk?: Partial<RiskConfig>;
  startSeq?: number;
}

export function createMarketShard(config: MarketShardConfig): MarketShard {
  const { symbol, startSeq = 0 } = config;
  
  const book = createOrderbook(symbol);
  const events = createEventEmitter(symbol, startSeq);
  
  const matchingConfig: MatchingEngineConfig = {
    ...defaultMatchingConfig,
    ...config.matching,
    risk: {
      ...defaultRiskConfig,
      ...config.risk,
    },
  };

  let markPrice = 0;

  function processCreateOrder(command: CreateOrderCommand): Event[] {
    const result = matchOrder(book, command, events, markPrice, matchingConfig);
    
    // Update mark price from last trade
    if (result.trades.length > 0) {
      markPrice = result.trades[result.trades.length - 1].price;
    }
    
    return result.events;
  }

  function processCancelOrder(command: CancelOrderCommand): Event[] {
    const result = cancelOrder(book, command.orderId, events);
    return result.events;
  }

  function processCommand(command: Command): Event[] {
    if ("side" in command) {
      return processCreateOrder(command as CreateOrderCommand);
    } else if ("orderId" in command) {
      return processCancelOrder(command as CancelOrderCommand);
    }
    return [];
  }

  return {
    symbol,
    book,
    events,
    config: matchingConfig,

    processCommand,
    processCreateOrder,
    processCancelOrder,

    getState(): ShardState {
      return {
        symbol,
        lastSeq: events.currentSeq,
        orderCount: book.ordersById.size,
        bidLevels: book.bids.length,
        askLevels: book.asks.length,
        midPrice: getMidPrice(book),
      };
    },

    getSnapshot(depth = 20) {
      return getL2Snapshot(book, depth);
    },

    setMarkPrice(price: number) {
      markPrice = price;
    },
  };
}

/**
 * Shard Manager - manages multiple shards
 */
export interface ShardManager {
  createShard(symbol: string, config?: Partial<MarketShardConfig>): MarketShard;
  getShard(symbol: string): MarketShard | undefined;
  getAllShards(): Map<string, MarketShard>;
  removeShard(symbol: string): boolean;
}

export function createShardManager(): ShardManager {
  const shards = new Map<string, MarketShard>();

  return {
    createShard(symbol: string, config?: Partial<MarketShardConfig>): MarketShard {
      if (shards.has(symbol)) {
        throw new Error(`Shard for ${symbol} already exists`);
      }

      const shard = createMarketShard({ symbol, ...config });
      shards.set(symbol, shard);
      return shard;
    },

    getShard(symbol: string): MarketShard | undefined {
      return shards.get(symbol);
    },

    getAllShards(): Map<string, MarketShard> {
      return shards;
    },

    removeShard(symbol: string): boolean {
      return shards.delete(symbol);
    },
  };
}
