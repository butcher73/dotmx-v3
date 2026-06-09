/**
 * Mark Price Service
 *
 * Calculates mark price by combining:
 * 1. Internal orderbook mid-price
 * 2. External index price from exchanges (Binance, Bitget)
 * 3. Last trade price
 *
 * Mark Price Formula (configurable):
 * - When orderbook has good liquidity: Mid-price weighted with index
 * - When orderbook is thin: External index price with premium/discount
 * - Fallback: Last trade price or pure external price
 *
 * Uses:
 * - Liquidation calculations (avoid manipulation via thin orderbook)
 * - Funding rate calculation (mark - index premium)
 * - UI display of fair value
 * - Risk checks (price band validation)
 */

import type { L2Book } from "../builder";
import type { AggregatedPriceData, ExternalTicker } from "../external";

// =============================================================================
// TYPES
// =============================================================================

export interface MarkPriceData {
  symbol: string;
  markPrice: number;
  indexPrice: number;
  midPrice: number;
  lastPrice: number;
  fundingRate: number;
  nextFundingTime: number;
  source: MarkPriceSource;
  confidence: number; // 0-1, how confident we are in this price
  timestamp: number;
}

export type MarkPriceSource =
  | "internal" // Derived from internal orderbook
  | "external" // Derived from external exchanges
  | "hybrid" // Mix of internal and external
  | "fallback"; // Last trade or stale data

export type MarkPriceHandler = (data: MarkPriceData) => void;

export interface MarkPriceService {
  /** Update with internal orderbook data */
  updateOrderbook(book: L2Book): void;

  /** Update with internal trade */
  updateLastTrade(symbol: string, price: number, timestamp: number): void;

  /** Update with external price data */
  updateExternalPrice(data: AggregatedPriceData | ExternalTicker): void;

  /** Get current mark price */
  getMarkPrice(symbol: string): number;

  /** Get full mark price data */
  getMarkPriceData(symbol: string): MarkPriceData | null;

  /** Get all mark prices */
  getAllMarkPrices(): MarkPriceData[];

  /** Set handler for mark price updates */
  onUpdate(handler: MarkPriceHandler): void;
}

export interface MarkPriceConfig {
  /** Weight of internal mid-price (0-1) when orderbook is healthy */
  internalWeight: number;

  /** Minimum depth (in quote) required to consider orderbook "healthy" */
  minOrderbookDepth: number;

  /** Minimum spread (%) to consider orderbook "healthy" */
  maxSpread: number;

  /** How long external price is valid (ms) */
  externalPriceTtl: number;

  /** How long internal price is valid (ms) */
  internalPriceTtl: number;

  /** EMA smoothing factor for mark price (0-1) */
  emaAlpha: number;

  /** Update interval for publishing mark prices (ms) */
  updateIntervalMs: number;
}

export const defaultMarkPriceConfig: MarkPriceConfig = {
  internalWeight: 0.3, // 30% internal, 70% external when both available
  minOrderbookDepth: 10000, // $10k on each side
  maxSpread: 0.005, // 0.5%
  externalPriceTtl: 10000, // 10 seconds
  internalPriceTtl: 5000, // 5 seconds
  emaAlpha: 0.1, // EMA smoothing
  updateIntervalMs: 1000, // Publish every second
};

// =============================================================================
// IMPLEMENTATION
// =============================================================================

interface SymbolState {
  // Internal data
  midPrice: number;
  midPriceTimestamp: number;
  bidDepth: number;
  askDepth: number;
  spread: number;
  lastTradePrice: number;
  lastTradeTimestamp: number;

  // External data
  externalMarkPrice: number;
  externalIndexPrice: number;
  externalTimestamp: number;
  fundingRate: number;
  nextFundingTime: number;

  // Computed
  markPrice: number;
  markPriceEma: number;
  source: MarkPriceSource;
  confidence: number;
}

export function createMarkPriceService(
  config: MarkPriceConfig = defaultMarkPriceConfig
): MarkPriceService {
  const states = new Map<string, SymbolState>();
  const handlers = new Set<MarkPriceHandler>();
  let updateTimer: Timer | null = null;

  function getOrCreateState(symbol: string): SymbolState {
    let state = states.get(symbol);
    if (!state) {
      state = {
        midPrice: 0,
        midPriceTimestamp: 0,
        bidDepth: 0,
        askDepth: 0,
        spread: 0,
        lastTradePrice: 0,
        lastTradeTimestamp: 0,
        externalMarkPrice: 0,
        externalIndexPrice: 0,
        externalTimestamp: 0,
        fundingRate: 0,
        nextFundingTime: 0,
        markPrice: 0,
        markPriceEma: 0,
        source: "fallback",
        confidence: 0,
      };
      states.set(symbol, state);
    }
    return state;
  }

  function calculateMarkPrice(state: SymbolState): void {
    const now = Date.now();

    // Check data freshness
    const hasInternalPrice =
      state.midPrice > 0 && now - state.midPriceTimestamp < config.internalPriceTtl;
    const hasExternalPrice =
      state.externalMarkPrice > 0 && now - state.externalTimestamp < config.externalPriceTtl;
    const hasLastTrade = state.lastTradePrice > 0;

    // Check orderbook health
    const isOrderbookHealthy =
      hasInternalPrice &&
      state.bidDepth >= config.minOrderbookDepth &&
      state.askDepth >= config.minOrderbookDepth &&
      state.spread <= config.maxSpread;

    let newMarkPrice = 0;
    let source: MarkPriceSource = "fallback";
    let confidence = 0;

    if (isOrderbookHealthy && hasExternalPrice) {
      // Hybrid: Weight internal and external
      newMarkPrice =
        state.midPrice * config.internalWeight +
        state.externalMarkPrice * (1 - config.internalWeight);
      source = "hybrid";
      confidence = 0.9;
    } else if (hasExternalPrice) {
      // External only
      newMarkPrice = state.externalMarkPrice;
      source = "external";
      confidence = 0.7;
    } else if (hasInternalPrice) {
      // Internal only
      newMarkPrice = state.midPrice;
      source = "internal";
      confidence = isOrderbookHealthy ? 0.6 : 0.4;
    } else if (hasLastTrade) {
      // Fallback to last trade
      newMarkPrice = state.lastTradePrice;
      source = "fallback";
      confidence = 0.2;
    } else {
      // No data
      return;
    }

    // Apply EMA smoothing
    if (state.markPriceEma === 0) {
      state.markPriceEma = newMarkPrice;
    } else {
      state.markPriceEma =
        config.emaAlpha * newMarkPrice + (1 - config.emaAlpha) * state.markPriceEma;
    }

    state.markPrice = state.markPriceEma;
    state.source = source;
    state.confidence = confidence;
  }

  function emitUpdate(symbol: string, state: SymbolState): void {
    const data: MarkPriceData = {
      symbol,
      markPrice: state.markPrice,
      indexPrice: state.externalIndexPrice || state.midPrice,
      midPrice: state.midPrice,
      lastPrice: state.lastTradePrice,
      fundingRate: state.fundingRate,
      nextFundingTime: state.nextFundingTime,
      source: state.source,
      confidence: state.confidence,
      timestamp: Date.now(),
    };

    for (const handler of handlers) {
      try {
        handler(data);
      } catch (e) {
        console.error("Mark price handler error:", e);
      }
    }
  }

  // Start update loop
  function startUpdateLoop() {
    if (updateTimer) return;

    updateTimer = setInterval(() => {
      for (const [symbol, state] of states) {
        calculateMarkPrice(state);
        if (state.markPrice > 0) {
          emitUpdate(symbol, state);
        }
      }
    }, config.updateIntervalMs);
  }

  // Auto-start
  startUpdateLoop();

  return {
    updateOrderbook(book: L2Book) {
      const state = getOrCreateState(book.symbol);

      if (book.bids.length > 0 && book.asks.length > 0) {
        const bestBid = book.bids[0].price;
        const bestAsk = book.asks[0].price;

        state.midPrice = (bestBid + bestAsk) / 2;
        state.spread = (bestAsk - bestBid) / state.midPrice;

        // Calculate depth (sum of quantities at top levels * price)
        state.bidDepth = book.bids
          .slice(0, 10)
          .reduce((sum, l) => sum + l.price * l.quantity, 0);
        state.askDepth = book.asks
          .slice(0, 10)
          .reduce((sum, l) => sum + l.price * l.quantity, 0);
      }

      state.midPriceTimestamp = book.timestamp;

      // Recalculate immediately
      calculateMarkPrice(state);
    },

    updateLastTrade(symbol: string, price: number, timestamp: number) {
      const state = getOrCreateState(symbol);
      state.lastTradePrice = price;
      state.lastTradeTimestamp = timestamp;
    },

    updateExternalPrice(data: AggregatedPriceData | ExternalTicker) {
      const state = getOrCreateState(data.symbol);

      state.externalMarkPrice = data.markPrice;
      state.externalIndexPrice = data.indexPrice;
      state.externalTimestamp = data.timestamp;

      if ("fundingRate" in data) {
        state.fundingRate = data.fundingRate;
        state.nextFundingTime = data.nextFundingTime;
      }

      // Recalculate immediately
      calculateMarkPrice(state);
    },

    getMarkPrice(symbol: string): number {
      return states.get(symbol)?.markPrice ?? 0;
    },

    getMarkPriceData(symbol: string): MarkPriceData | null {
      const state = states.get(symbol);
      if (!state || state.markPrice === 0) return null;

      return {
        symbol,
        markPrice: state.markPrice,
        indexPrice: state.externalIndexPrice || state.midPrice,
        midPrice: state.midPrice,
        lastPrice: state.lastTradePrice,
        fundingRate: state.fundingRate,
        nextFundingTime: state.nextFundingTime,
        source: state.source,
        confidence: state.confidence,
        timestamp: Date.now(),
      };
    },

    getAllMarkPrices(): MarkPriceData[] {
      const result: MarkPriceData[] = [];

      for (const [symbol, state] of states) {
        if (state.markPrice > 0) {
          result.push({
            symbol,
            markPrice: state.markPrice,
            indexPrice: state.externalIndexPrice || state.midPrice,
            midPrice: state.midPrice,
            lastPrice: state.lastTradePrice,
            fundingRate: state.fundingRate,
            nextFundingTime: state.nextFundingTime,
            source: state.source,
            confidence: state.confidence,
            timestamp: Date.now(),
          });
        }
      }

      return result;
    },

    onUpdate(handler: MarkPriceHandler) {
      handlers.add(handler);
    },
  };
}

// =============================================================================
// UTILITY: FUNDING RATE CALCULATOR
// =============================================================================

export interface FundingRateParams {
  markPrice: number;
  indexPrice: number;
  interestRate: number; // Usually 0.01% = 0.0001
  maxRate: number; // Usually 0.75% = 0.0075
  dampening: number; // Premium dampening factor
}

export const defaultFundingParams: FundingRateParams = {
  markPrice: 0,
  indexPrice: 0,
  interestRate: 0.0001, // 0.01% per 8h
  maxRate: 0.0075, // 0.75%
  dampening: 1,
};

/**
 * Calculate funding rate from mark and index price
 * Based on Binance/Bybit formula
 */
export function calculateFundingRate(params: FundingRateParams): number {
  const { markPrice, indexPrice, interestRate, maxRate, dampening } = params;

  if (indexPrice === 0 || markPrice === 0) return 0;

  // Premium = (Mark Price - Index Price) / Index Price
  const premium = (markPrice - indexPrice) / indexPrice;

  // Funding Rate = Average Premium + clamp(Premium, -max, max)
  // Simplified: just use premium with dampening
  const fundingRate = premium * dampening + interestRate;

  // Clamp to max
  return Math.max(-maxRate, Math.min(maxRate, fundingRate));
}

/**
 * Get next funding time (8h intervals: 00:00, 08:00, 16:00 UTC)
 */
export function getNextFundingTime(): number {
  const now = new Date();
  const hours = now.getUTCHours();
  const nextFundingHour = Math.ceil((hours + 1) / 8) * 8;
  
  const nextFunding = new Date(now);
  nextFunding.setUTCHours(nextFundingHour % 24, 0, 0, 0);
  
  if (nextFundingHour >= 24) {
    nextFunding.setUTCDate(nextFunding.getUTCDate() + 1);
  }
  
  return nextFunding.getTime();
}

/**
 * Get time until next funding (ms)
 */
export function getTimeToFunding(): number {
  return getNextFundingTime() - Date.now();
}
