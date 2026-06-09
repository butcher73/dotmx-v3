/**
 * Data Source Configuration
 *
 * Central configuration for external market data providers.
 * Controls which exchange feeds are active, their priority,
 * and how data is aggregated across multiple sources.
 *
 * Environment Variables:
 *   MARKETDATA_PRIMARY_SOURCE   - Primary exchange feed (default: "bitget")
 *   MARKETDATA_FALLBACK_SOURCE  - Fallback exchange feed (default: "binance")
 *   MARKETDATA_STRATEGY         - Aggregation strategy (default: "primary-with-fallback")
 *   MARKETDATA_SOURCES          - Comma-separated list of enabled sources (default: "bitget")
 */

import {
  createBitgetFeed,
  createBinanceFeed,
  createPriceFeedManager,
  type ExternalPriceFeed,
  type PriceFeedManager,
  type BitgetFuturesConfig,
  type BinanceFuturesConfig,
} from "./external";

// =============================================================================
// TYPES
// =============================================================================

export type DataSourceName = "bitget" | "binance";

export type AggregationStrategy =
  | "primary-only"           // Use only the primary source
  | "primary-with-fallback"  // Use primary, fall back to secondary if disconnected
  | "median";                // Aggregate across all sources (median price)

export interface DataSourceConfig {
  /** Which sources are enabled */
  sources: DataSourceName[];

  /** Primary source for data (first preference) */
  primary: DataSourceName;

  /** Fallback source when primary is unavailable */
  fallback?: DataSourceName;

  /** How to aggregate prices when multiple sources are active */
  strategy: AggregationStrategy;

  /** Per-source configuration overrides */
  sourceConfig?: {
    bitget?: Partial<BitgetFuturesConfig>;
    binance?: Partial<BinanceFuturesConfig>;
  };
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_DATASOURCE_CONFIG: DataSourceConfig = {
  sources: ["bitget"],
  primary: "bitget",
  fallback: "binance",
  strategy: "primary-with-fallback",
};

// =============================================================================
// CONFIG FROM ENVIRONMENT
// =============================================================================

export function loadDataSourceConfig(): DataSourceConfig {
  const primarySource = (process.env.MARKETDATA_PRIMARY_SOURCE ?? "bitget") as DataSourceName;
  const fallbackSource = (process.env.MARKETDATA_FALLBACK_SOURCE ?? "binance") as DataSourceName;
  const strategy = (process.env.MARKETDATA_STRATEGY ?? "primary-with-fallback") as AggregationStrategy;
  const sourcesEnv = process.env.MARKETDATA_SOURCES;

  let sources: DataSourceName[];
  if (sourcesEnv) {
    sources = sourcesEnv.split(",").map((s) => s.trim() as DataSourceName);
  } else {
    // Default: only primary (add fallback if strategy requires it)
    sources = strategy === "primary-only" ? [primarySource] : [primarySource];
    if (fallbackSource && !sources.includes(fallbackSource) && strategy !== "primary-only") {
      sources.push(fallbackSource);
    }
  }

  return {
    sources,
    primary: primarySource,
    fallback: fallbackSource,
    strategy,
  };
}

// =============================================================================
// FEED FACTORY
// =============================================================================

const FEED_FACTORIES: Record<DataSourceName, (config?: Record<string, unknown>) => ExternalPriceFeed> = {
  bitget: (config) => createBitgetFeed(config),
  binance: (config) => createBinanceFeed(config),
};

export function createFeed(name: DataSourceName, config?: Record<string, unknown>): ExternalPriceFeed {
  const factory = FEED_FACTORIES[name];
  if (!factory) {
    throw new Error(`Unknown data source: ${name}. Supported: ${Object.keys(FEED_FACTORIES).join(", ")}`);
  }
  return factory(config);
}

// =============================================================================
// INITIALIZE DATA SOURCES
// =============================================================================

export interface DataSourceResult {
  /** All created feeds, keyed by source name */
  feeds: Map<DataSourceName, ExternalPriceFeed>;

  /** The primary feed (convenience reference) */
  primaryFeed: ExternalPriceFeed;

  /** PriceFeedManager when using multi-source strategies */
  manager: PriceFeedManager | null;

  /** Connect all feeds */
  connectAll(): Promise<void>;

  /** Disconnect all feeds */
  disconnectAll(): Promise<void>;

  /** Get the best available feed (primary if connected, otherwise fallback) */
  getActiveFeed(): ExternalPriceFeed;

  /** Log current status */
  logStatus(): void;
}

export function initializeDataSources(config: DataSourceConfig = loadDataSourceConfig()): DataSourceResult {
  const feeds = new Map<DataSourceName, ExternalPriceFeed>();
  let manager: PriceFeedManager | null = null;

  // Create feeds for all configured sources
  for (const sourceName of config.sources) {
    const sourceConfig = config.sourceConfig?.[sourceName] ?? {};
    const feed = createFeed(sourceName, sourceConfig);
    feeds.set(sourceName, feed);
  }

  // Ensure primary feed exists
  const primaryFeed = feeds.get(config.primary);
  if (!primaryFeed) {
    throw new Error(`Primary source "${config.primary}" is not in the sources list: [${config.sources.join(", ")}]`);
  }

  // Set up PriceFeedManager for multi-source strategies
  if (config.strategy === "median" && config.sources.length > 1) {
    manager = createPriceFeedManager();
    for (const feed of feeds.values()) {
      manager.addFeed(feed);
    }
  }

  return {
    feeds,
    primaryFeed,
    manager,

    async connectAll() {
      const results = await Promise.allSettled(
        Array.from(feeds.entries()).map(async ([name, feed]) => {
          try {
            await feed.connect();
            console.log(`✅ ${name} feed connected`);
          } catch (err) {
            console.error(`❌ ${name} feed failed to connect:`, err);
            throw err;
          }
        })
      );

      // At minimum, primary must connect
      const primaryIdx = config.sources.indexOf(config.primary);
      if (results[primaryIdx]?.status === "rejected") {
        // Try fallback
        if (config.fallback && config.strategy !== "primary-only") {
          const fallbackFeed = feeds.get(config.fallback);
          if (fallbackFeed?.isConnected()) {
            console.warn(`⚠️ Primary source "${config.primary}" failed, using fallback "${config.fallback}"`);
            return;
          }
        }
        console.error(`❌ Primary source "${config.primary}" failed and no fallback available`);
      }
    },

    async disconnectAll() {
      if (manager) {
        await manager.stop();
      }
      for (const [name, feed] of feeds) {
        try {
          await feed.disconnect();
          console.log(`🔌 ${name} feed disconnected`);
        } catch (err) {
          console.error(`Failed to disconnect ${name}:`, err);
        }
      }
    },

    getActiveFeed(): ExternalPriceFeed {
      // Primary first
      if (primaryFeed.isConnected()) return primaryFeed;
      // Try fallback
      if (config.fallback && config.strategy !== "primary-only") {
        const fallback = feeds.get(config.fallback);
        if (fallback?.isConnected()) return fallback;
      }
      // Return primary anyway (caller can handle disconnected state)
      return primaryFeed;
    },

    logStatus() {
      console.log(`📊 Data Source Configuration:`);
      console.log(`   Strategy: ${config.strategy}`);
      console.log(`   Primary:  ${config.primary}`);
      if (config.fallback) console.log(`   Fallback: ${config.fallback}`);
      console.log(`   Sources:`);
      for (const [name, feed] of feeds) {
        const isPrimary = name === config.primary ? " (primary)" : "";
        const isFallback = name === config.fallback ? " (fallback)" : "";
        const status = feed.isConnected() ? "🟢 connected" : "🔴 disconnected";
        console.log(`     - ${name}${isPrimary}${isFallback}: ${status}`);
      }
    },
  };
}
