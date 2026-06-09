/**
 * Ticker Aggregator
 *
 * Maintains 24h rolling window statistics for each trading pair:
 * - Last price
 * - High/Low 24h
 * - Volume 24h
 * - Price change 24h
 * - Trade count
 *
 * Used for ticker endpoints and UI displays.
 */

import type { Trade as MarketTrade } from "../fanout";

// =============================================================================
// TYPES
// =============================================================================

export interface Ticker24h {
  symbol: string;
  lastPrice: number;
  open24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  volumeQuote24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  vwap24h: number;
  trades24h: number;
  lastTradeTime: number;
  timestamp: number;
}

export interface TickerUpdate {
  symbol: string;
  price: number;
  quantity: number;
  quoteVolume?: number;
  timestamp: number;
}

export interface TickerAggregator {
  /** Update with a new trade */
  onTrade(trade: TickerUpdate): void;

  /** Get current 24h ticker */
  getTicker(): Ticker24h;

  /** Get ticker with external fallback data */
  getTickerWithFallback(fallback: Partial<Ticker24h>): Ticker24h;

  /** Prune old data (called periodically) */
  prune(): void;

  /** Reset all data */
  reset(): void;
}

export interface TickerAggregatorConfig {
  windowMs: number; // 24h = 86400000
  pruneIntervalMs: number;
}

export const defaultTickerConfig: TickerAggregatorConfig = {
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  pruneIntervalMs: 60 * 1000, // Prune every minute
};

// =============================================================================
// IMPLEMENTATION
// =============================================================================

interface TradeRecord {
  price: number;
  quantity: number;
  quoteVolume: number;
  timestamp: number;
}

export function createTickerAggregator(
  symbol: string,
  config: TickerAggregatorConfig = defaultTickerConfig
): TickerAggregator {
  const trades: TradeRecord[] = [];
  let lastPrice = 0;
  let lastTradeTime = 0;
  let pruneTimer: Timer | null = null;

  // Cached stats for performance
  let cachedTicker: Ticker24h | null = null;
  let cacheInvalidated = true;

  function calculateTicker(): Ticker24h {
    if (!cacheInvalidated && cachedTicker) {
      return cachedTicker;
    }

    const now = Date.now();
    const cutoff = now - config.windowMs;

    // Get trades in window
    const windowTrades = trades.filter((t) => t.timestamp >= cutoff);

    if (windowTrades.length === 0) {
      cachedTicker = {
        symbol,
        lastPrice,
        open24h: lastPrice,
        high24h: lastPrice,
        low24h: lastPrice,
        volume24h: 0,
        volumeQuote24h: 0,
        priceChange24h: 0,
        priceChangePercent24h: 0,
        vwap24h: lastPrice,
        trades24h: 0,
        lastTradeTime,
        timestamp: now,
      };
      cacheInvalidated = false;
      return cachedTicker;
    }

    // Calculate stats
    const prices = windowTrades.map((t) => t.price);
    const open24h = windowTrades[0].price;
    const high24h = Math.max(...prices);
    const low24h = Math.min(...prices);
    const volume24h = windowTrades.reduce((sum, t) => sum + t.quantity, 0);
    const volumeQuote24h = windowTrades.reduce((sum, t) => sum + t.quoteVolume, 0);
    const vwap24h = volume24h > 0 ? volumeQuote24h / volume24h : lastPrice;
    const priceChange24h = lastPrice - open24h;
    const priceChangePercent24h = open24h > 0 ? (priceChange24h / open24h) * 100 : 0;

    cachedTicker = {
      symbol,
      lastPrice,
      open24h,
      high24h,
      low24h,
      volume24h,
      volumeQuote24h,
      priceChange24h,
      priceChangePercent24h,
      vwap24h,
      trades24h: windowTrades.length,
      lastTradeTime,
      timestamp: now,
    };

    cacheInvalidated = false;
    return cachedTicker;
  }

  return {
    onTrade(trade: TickerUpdate) {
      const quoteVolume = trade.quoteVolume ?? trade.price * trade.quantity;

      trades.push({
        price: trade.price,
        quantity: trade.quantity,
        quoteVolume,
        timestamp: trade.timestamp,
      });

      lastPrice = trade.price;
      lastTradeTime = trade.timestamp;
      cacheInvalidated = true;
    },

    getTicker(): Ticker24h {
      return calculateTicker();
    },

    getTickerWithFallback(fallback: Partial<Ticker24h>): Ticker24h {
      const ticker = calculateTicker();

      // Use internal data if we have trades, otherwise use fallback
      if (ticker.trades24h === 0 && fallback.lastPrice) {
        return {
          symbol,
          lastPrice: fallback.lastPrice ?? 0,
          open24h: fallback.open24h ?? fallback.lastPrice ?? 0,
          high24h: fallback.high24h ?? fallback.lastPrice ?? 0,
          low24h: fallback.low24h ?? fallback.lastPrice ?? 0,
          volume24h: fallback.volume24h ?? 0,
          volumeQuote24h: fallback.volumeQuote24h ?? 0,
          priceChange24h: fallback.priceChange24h ?? 0,
          priceChangePercent24h: fallback.priceChangePercent24h ?? 0,
          vwap24h: fallback.vwap24h ?? fallback.lastPrice ?? 0,
          trades24h: fallback.trades24h ?? 0,
          lastTradeTime: fallback.lastTradeTime ?? Date.now(),
          timestamp: Date.now(),
        };
      }

      return ticker;
    },

    prune() {
      const cutoff = Date.now() - config.windowMs;
      
      // Binary search for cutoff point
      let left = 0;
      let right = trades.length;
      
      while (left < right) {
        const mid = Math.floor((left + right) / 2);
        if (trades[mid].timestamp < cutoff) {
          left = mid + 1;
        } else {
          right = mid;
        }
      }

      if (left > 0) {
        trades.splice(0, left);
        cacheInvalidated = true;
      }
    },

    reset() {
      trades.length = 0;
      lastPrice = 0;
      lastTradeTime = 0;
      cachedTicker = null;
      cacheInvalidated = true;
    },
  };
}

// =============================================================================
// TICKER STORE (Multi-symbol)
// =============================================================================

export interface TickerStore {
  onTrade(symbol: string, trade: TickerUpdate): void;
  getTicker(symbol: string): Ticker24h | null;
  getAllTickers(): Ticker24h[];
  setExternalTicker(symbol: string, ticker: Partial<Ticker24h>): void;
  start(): void;
  stop(): void;
}

export function createTickerStore(config: TickerAggregatorConfig = defaultTickerConfig): TickerStore {
  const aggregators = new Map<string, TickerAggregator>();
  const externalTickers = new Map<string, Partial<Ticker24h>>();
  let pruneTimer: Timer | null = null;

  function getOrCreateAggregator(symbol: string): TickerAggregator {
    let agg = aggregators.get(symbol);
    if (!agg) {
      agg = createTickerAggregator(symbol, config);
      aggregators.set(symbol, agg);
    }
    return agg;
  }

  return {
    onTrade(symbol: string, trade: TickerUpdate) {
      getOrCreateAggregator(symbol).onTrade(trade);
    },

    getTicker(symbol: string): Ticker24h | null {
      const agg = aggregators.get(symbol);
      const external = externalTickers.get(symbol);

      if (!agg && !external) return null;

      if (agg) {
        return agg.getTickerWithFallback(external ?? {});
      }

      // Only external data available
      if (external) {
        return {
          symbol,
          lastPrice: external.lastPrice ?? 0,
          open24h: external.open24h ?? external.lastPrice ?? 0,
          high24h: external.high24h ?? external.lastPrice ?? 0,
          low24h: external.low24h ?? external.lastPrice ?? 0,
          volume24h: external.volume24h ?? 0,
          volumeQuote24h: external.volumeQuote24h ?? 0,
          priceChange24h: external.priceChange24h ?? 0,
          priceChangePercent24h: external.priceChangePercent24h ?? 0,
          vwap24h: external.vwap24h ?? external.lastPrice ?? 0,
          trades24h: external.trades24h ?? 0,
          lastTradeTime: external.lastTradeTime ?? Date.now(),
          timestamp: Date.now(),
        };
      }

      return null;
    },

    getAllTickers(): Ticker24h[] {
      const allSymbols = new Set([...aggregators.keys(), ...externalTickers.keys()]);
      const result: Ticker24h[] = [];

      for (const symbol of allSymbols) {
        const ticker = this.getTicker(symbol);
        if (ticker) {
          result.push(ticker);
        }
      }

      return result;
    },

    setExternalTicker(symbol: string, ticker: Partial<Ticker24h>) {
      externalTickers.set(symbol, ticker);
    },

    start() {
      if (pruneTimer) return;

      pruneTimer = setInterval(() => {
        for (const agg of aggregators.values()) {
          agg.prune();
        }
      }, config.pruneIntervalMs);
    },

    stop() {
      if (pruneTimer) {
        clearInterval(pruneTimer);
        pruneTimer = null;
      }
    },
  };
}
