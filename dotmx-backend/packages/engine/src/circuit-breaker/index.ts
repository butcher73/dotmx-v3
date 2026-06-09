/**
 * Circuit Breaker Service
 *
 * Monitors trade prices and automatically halts a market when extreme
 * price moves are detected within a time window.
 *
 * Features:
 * - Configurable price threshold per symbol (default 10% in 60s)
 * - Auto-cooldown period before re-opening
 * - Manual halt/resume override
 * - Hooks for DB persistence of breaker state
 */

export type MarketState = "open" | "halted" | "pre_open" | "closed";

export interface CircuitBreakerConfig {
  /** Maximum price move (fraction, e.g. 0.10 = 10%) */
  maxPriceMove: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Cooldown after halt in milliseconds */
  cooldownMs: number;
  /** Auto-resume after cooldown (default: false, needs manual resume) */
  autoResume: boolean;
}

interface PriceRecord {
  price: number;
  timestamp: number;
}

interface MarketBreakerState {
  state: MarketState;
  referencePrice: number | null;
  referenceTimestamp: number | null;
  haltedAt: number | null;
  config: CircuitBreakerConfig;
  /** Recent prices for window analysis */
  recentPrices: PriceRecord[];
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  maxPriceMove: 0.10,    // 10%
  windowMs: 60_000,       // 1 minute
  cooldownMs: 300_000,    // 5 minutes
  autoResume: false,
};

export interface CircuitBreakerService {
  /** Check if trading is allowed for a symbol */
  isTradingAllowed(symbol: string): boolean;

  /** Get current market state */
  getMarketState(symbol: string): MarketState;

  /** Report a trade price — returns the new market state */
  checkPrice(symbol: string, price: number): MarketState;

  /** Configure circuit breaker for a symbol */
  configure(symbol: string, config: Partial<CircuitBreakerConfig>): void;

  /** Manually halt a market */
  halt(symbol: string, reason?: string): void;

  /** Resume a halted market */
  resume(symbol: string): void;

  /** Get all halted markets */
  getHaltedMarkets(): string[];

  /** Register a callback for state changes */
  onStateChange(callback: (symbol: string, oldState: MarketState, newState: MarketState, reason: string) => void): void;
}

/**
 * Create a circuit breaker service
 */
export function createCircuitBreakerService(defaultConfig?: Partial<CircuitBreakerConfig>): CircuitBreakerService {
  const markets = new Map<string, MarketBreakerState>();
  const listeners: Array<(symbol: string, oldState: MarketState, newState: MarketState, reason: string) => void> = [];
  const mergedDefault = { ...DEFAULT_CONFIG, ...defaultConfig };

  function getOrCreate(symbol: string): MarketBreakerState {
    let state = markets.get(symbol);
    if (!state) {
      state = {
        state: "open",
        referencePrice: null,
        referenceTimestamp: null,
        haltedAt: null,
        config: { ...mergedDefault },
        recentPrices: [],
      };
      markets.set(symbol, state);
    }
    return state;
  }

  function setState(symbol: string, market: MarketBreakerState, newState: MarketState, reason: string) {
    const oldState = market.state;
    if (oldState === newState) return;

    market.state = newState;

    if (newState === "halted") {
      market.haltedAt = Date.now();
    }

    if (newState === "open") {
      market.haltedAt = null;
      market.referencePrice = null;
      market.referenceTimestamp = null;
      market.recentPrices = [];
    }

    console.log(`[CircuitBreaker] ${symbol}: ${oldState} → ${newState} (${reason})`);

    for (const listener of listeners) {
      try {
        listener(symbol, oldState, newState, reason);
      } catch (e) {
        console.error(`[CircuitBreaker] Listener error:`, e);
      }
    }
  }

  function checkCooldown(symbol: string, market: MarketBreakerState) {
    if (market.state !== "halted" || !market.haltedAt) return;
    if (!market.config.autoResume) return;

    const elapsed = Date.now() - market.haltedAt;
    if (elapsed >= market.config.cooldownMs) {
      setState(symbol, market, "open", `cooldown_expired (${Math.round(elapsed / 1000)}s)`);
    }
  }

  return {
    isTradingAllowed(symbol: string): boolean {
      const market = markets.get(symbol);
      if (!market) return true; // Unknown symbols are allowed by default
      // Check cooldown expiry
      checkCooldown(symbol, market);
      return market.state === "open";
    },

    getMarketState(symbol: string): MarketState {
      const market = markets.get(symbol);
      if (!market) return "open";
      checkCooldown(symbol, market);
      return market.state;
    },

    checkPrice(symbol: string, price: number): MarketState {
      const market = getOrCreate(symbol);

      // If halted, check cooldown
      if (market.state === "halted") {
        checkCooldown(symbol, market);
        return market.state;
      }

      // If not open, don't process
      if (market.state !== "open") return market.state;

      const now = Date.now();

      // Add to recent prices
      market.recentPrices.push({ price, timestamp: now });

      // Prune old entries outside the window
      const windowStart = now - market.config.windowMs;
      market.recentPrices = market.recentPrices.filter(r => r.timestamp >= windowStart);

      // Set or update reference price
      if (market.referencePrice === null || market.referenceTimestamp === null) {
        market.referencePrice = price;
        market.referenceTimestamp = now;
        return market.state;
      }

      // If reference is outside window, use the oldest price in the window
      if (market.referenceTimestamp < windowStart) {
        if (market.recentPrices.length > 0) {
          const oldest = market.recentPrices[0];
          market.referencePrice = oldest.price;
          market.referenceTimestamp = oldest.timestamp;
        } else {
          market.referencePrice = price;
          market.referenceTimestamp = now;
          return market.state;
        }
      }

      // Calculate deviation
      const deviation = Math.abs(price - market.referencePrice) / market.referencePrice;

      if (deviation > market.config.maxPriceMove) {
        setState(
          symbol,
          market,
          "halted",
          `price_deviation ${(deviation * 100).toFixed(2)}% > ${(market.config.maxPriceMove * 100).toFixed(2)}% in ${market.config.windowMs / 1000}s`
        );
      }

      return market.state;
    },

    configure(symbol: string, config: Partial<CircuitBreakerConfig>): void {
      const market = getOrCreate(symbol);
      market.config = { ...market.config, ...config };
    },

    halt(symbol: string, reason?: string): void {
      const market = getOrCreate(symbol);
      setState(symbol, market, "halted", reason || "manual_halt");
    },

    resume(symbol: string): void {
      const market = markets.get(symbol);
      if (!market) return;
      setState(symbol, market, "open", "manual_resume");
    },

    getHaltedMarkets(): string[] {
      const halted: string[] = [];
      for (const [symbol, market] of markets) {
        if (market.state === "halted") {
          halted.push(symbol);
        }
      }
      return halted;
    },

    onStateChange(callback: (symbol: string, oldState: MarketState, newState: MarketState, reason: string) => void): void {
      listeners.push(callback);
    },
  };
}
