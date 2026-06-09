/**
 * Kline (Candlestick) Aggregator
 *
 * Aggregates trades into OHLCV candlesticks for charting.
 * Supports multiple timeframes: 1m, 5m, 15m, 1h, 4h, 1d, etc.
 *
 * Features:
 * - Real-time candle updates
 * - Historical candle storage (in-memory + optional persistence)
 * - External candle fallback when no internal trades
 */

// =============================================================================
// TYPES
// =============================================================================

export interface Kline {
  symbol: string;
  interval: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volumeQuote: number;
  trades: number;
  isClosed: boolean;
}

export interface KlineUpdate {
  symbol: string;
  price: number;
  quantity: number;
  timestamp: number;
}

export type KlineHandler = (kline: Kline) => void;

export interface KlineAggregator {
  /** Process a trade */
  onTrade(trade: KlineUpdate): void;

  /** Get current (in-progress) candle */
  getCurrentCandle(): Kline | null;

  /** Get historical candles */
  getCandles(limit?: number): Kline[];

  /** Set handler for candle updates */
  onUpdate(handler: KlineHandler): void;

  /** Force close current candle */
  closeCurrentCandle(): void;

  /** Set historical candles (from external source or persistence) */
  setHistory(candles: Kline[]): void;

  /** Reset all data */
  reset(): void;
}

export interface KlineAggregatorConfig {
  maxCandles: number;
}

export const defaultKlineConfig: KlineAggregatorConfig = {
  maxCandles: 1000,
};

// =============================================================================
// INTERVAL HELPERS
// =============================================================================

export type KlineInterval =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "8h"
  | "12h"
  | "1d"
  | "3d"
  | "1w"
  | "1M";

const INTERVAL_MS: Record<string, number> = {
  "1m": 60 * 1000,
  "3m": 3 * 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "8h": 8 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000, // Approximate
};

export function getIntervalMs(interval: string): number {
  return INTERVAL_MS[interval] ?? 60 * 1000;
}

export function getCandleOpenTime(timestamp: number, intervalMs: number): number {
  return Math.floor(timestamp / intervalMs) * intervalMs;
}

export function getCandleCloseTime(openTime: number, intervalMs: number): number {
  return openTime + intervalMs - 1;
}

// =============================================================================
// KLINE AGGREGATOR IMPLEMENTATION
// =============================================================================

export function createKlineAggregator(
  symbol: string,
  interval: KlineInterval,
  config: KlineAggregatorConfig = defaultKlineConfig
): KlineAggregator {
  const intervalMs = getIntervalMs(interval);
  const candles: Kline[] = [];
  let currentCandle: Kline | null = null;
  let handler: KlineHandler | null = null;

  function createNewCandle(timestamp: number, price: number, quantity: number): Kline {
    const openTime = getCandleOpenTime(timestamp, intervalMs);
    return {
      symbol,
      interval,
      openTime,
      closeTime: getCandleCloseTime(openTime, intervalMs),
      open: price,
      high: price,
      low: price,
      close: price,
      volume: quantity,
      volumeQuote: price * quantity,
      trades: 1,
      isClosed: false,
    };
  }

  function updateCandle(candle: Kline, price: number, quantity: number): void {
    candle.high = Math.max(candle.high, price);
    candle.low = Math.min(candle.low, price);
    candle.close = price;
    candle.volume += quantity;
    candle.volumeQuote += price * quantity;
    candle.trades++;
  }

  function closeCandle(candle: Kline): void {
    candle.isClosed = true;
    candles.push(candle);

    // Trim old candles
    while (candles.length > config.maxCandles) {
      candles.shift();
    }

    if (handler) {
      handler(candle);
    }
  }

  function emitUpdate(candle: Kline): void {
    if (handler) {
      handler(candle);
    }
  }

  return {
    onTrade(trade: KlineUpdate) {
      const openTime = getCandleOpenTime(trade.timestamp, intervalMs);

      // Check if we need to close current candle and start new one
      if (currentCandle && currentCandle.openTime !== openTime) {
        closeCandle(currentCandle);
        currentCandle = null;
      }

      if (!currentCandle) {
        currentCandle = createNewCandle(trade.timestamp, trade.price, trade.quantity);
      } else {
        updateCandle(currentCandle, trade.price, trade.quantity);
      }

      emitUpdate(currentCandle);
    },

    getCurrentCandle(): Kline | null {
      return currentCandle;
    },

    getCandles(limit?: number): Kline[] {
      const result = currentCandle ? [...candles, currentCandle] : [...candles];
      
      if (limit && result.length > limit) {
        return result.slice(-limit);
      }
      
      return result;
    },

    onUpdate(h: KlineHandler) {
      handler = h;
    },

    closeCurrentCandle() {
      if (currentCandle) {
        closeCandle(currentCandle);
        currentCandle = null;
      }
    },

    setHistory(history: Kline[]) {
      candles.length = 0;
      candles.push(...history.filter((k) => k.isClosed));

      // Set current candle if there's an open one
      const openCandle = history.find((k) => !k.isClosed);
      if (openCandle) {
        currentCandle = openCandle;
      }

      // Trim to max
      while (candles.length > config.maxCandles) {
        candles.shift();
      }
    },

    reset() {
      candles.length = 0;
      currentCandle = null;
    },
  };
}

// =============================================================================
// KLINE STORE (Multi-symbol, Multi-interval)
// =============================================================================

export interface KlineStore {
  onTrade(symbol: string, trade: KlineUpdate): void;
  getCurrentCandle(symbol: string, interval: KlineInterval): Kline | null;
  getCandles(symbol: string, interval: KlineInterval, limit?: number): Kline[];
  onUpdate(symbol: string, interval: KlineInterval, handler: KlineHandler): void;
  setHistory(symbol: string, interval: KlineInterval, candles: Kline[]): void;
  getSupportedIntervals(): KlineInterval[];
  start(): void;
  stop(): void;
}

export interface KlineStoreConfig {
  intervals: KlineInterval[];
  maxCandlesPerInterval: number;
}

export const defaultKlineStoreConfig: KlineStoreConfig = {
  intervals: ["1m", "5m", "15m", "1h", "4h", "1d"],
  maxCandlesPerInterval: 500,
};

export function createKlineStore(config: KlineStoreConfig = defaultKlineStoreConfig): KlineStore {
  // Map: symbol -> interval -> aggregator
  const aggregators = new Map<string, Map<string, KlineAggregator>>();
  let closeTimer: Timer | null = null;

  function getAggregator(symbol: string, interval: KlineInterval): KlineAggregator {
    let symbolAggs = aggregators.get(symbol);
    if (!symbolAggs) {
      symbolAggs = new Map();
      aggregators.set(symbol, symbolAggs);
    }

    let agg = symbolAggs.get(interval);
    if (!agg) {
      agg = createKlineAggregator(symbol, interval, {
        maxCandles: config.maxCandlesPerInterval,
      });
      symbolAggs.set(interval, agg);
    }

    return agg;
  }

  return {
    onTrade(symbol: string, trade: KlineUpdate) {
      // Update all intervals for this symbol
      for (const interval of config.intervals) {
        getAggregator(symbol, interval).onTrade(trade);
      }
    },

    getCurrentCandle(symbol: string, interval: KlineInterval): Kline | null {
      return getAggregator(symbol, interval).getCurrentCandle();
    },

    getCandles(symbol: string, interval: KlineInterval, limit?: number): Kline[] {
      return getAggregator(symbol, interval).getCandles(limit);
    },

    onUpdate(symbol: string, interval: KlineInterval, handler: KlineHandler) {
      getAggregator(symbol, interval).onUpdate(handler);
    },

    setHistory(symbol: string, interval: KlineInterval, candles: Kline[]) {
      getAggregator(symbol, interval).setHistory(candles);
    },

    getSupportedIntervals(): KlineInterval[] {
      return [...config.intervals];
    },

    start() {
      // Timer to ensure candles get closed even without trades
      // Check every minute if any candles should be closed
      closeTimer = setInterval(() => {
        const now = Date.now();
        
        for (const [symbol, symbolAggs] of aggregators) {
          for (const [interval, agg] of symbolAggs) {
            const current = agg.getCurrentCandle();
            if (current && now > current.closeTime) {
              agg.closeCurrentCandle();
            }
          }
        }
      }, 60 * 1000);
    },

    stop() {
      if (closeTimer) {
        clearInterval(closeTimer);
        closeTimer = null;
      }
    },
  };
}
