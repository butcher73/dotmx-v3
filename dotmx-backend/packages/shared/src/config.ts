/**
 * Configuration Management
 *
 * Typed configuration loading with validation.
 */

import { z } from "zod";

// =============================================================================
// SCHEMAS
// =============================================================================

export const DatabaseConfigSchema = z.object({
  url: z.string().url(),
  poolSize: z.number().min(1).max(100).default(10),
  ssl: z.boolean().default(false),
});

export const NatsConfigSchema = z.object({
  url: z.string().default("nats://localhost:4222"),
  name: z.string().optional(),
  reconnect: z.boolean().default(true),
  maxReconnectAttempts: z.number().default(10),
});

export const RedisConfigSchema = z.object({
  url: z.string().default("redis://localhost:6379"),
  db: z.number().min(0).max(15).default(0),
});

export const ServerConfigSchema = z.object({
  host: z.string().default("0.0.0.0"),
  port: z.number().min(1).max(65535).default(3000),
});

export const EngineConfigSchema = z.object({
  shardId: z.number().min(0).default(0),
  symbols: z.array(z.string()).default(["BTC-USD", "ETH-USD"]),
  snapshotIntervalMs: z.number().min(1000).default(60000),
  journalPath: z.string().default("./data/journal"),
  snapshotPath: z.string().default("./data/snapshots"),
});

export const MarketDataConfigSchema = z.object({
  throttleMs: z.number().min(10).default(100),
  maxDepth: z.number().min(1).max(1000).default(20),
});

export const RiskConfigSchema = z.object({
  maxOrderQty: z.number().positive().default(1000),
  maxNotional: z.number().positive().default(10000000),
  priceBandPercent: z.number().min(0).max(1).default(0.1),
});

export const AppConfigSchema = z.object({
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  server: ServerConfigSchema.default({}),
  database: DatabaseConfigSchema.optional(),
  nats: NatsConfigSchema.default({}),
  redis: RedisConfigSchema.default({}),
  engine: EngineConfigSchema.default({}),
  marketData: MarketDataConfigSchema.default({}),
  risk: RiskConfigSchema.default({}),
});

// =============================================================================
// TYPES
// =============================================================================

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type NatsConfig = z.infer<typeof NatsConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type EngineConfig = z.infer<typeof EngineConfigSchema>;
export type MarketDataConfig = z.infer<typeof MarketDataConfigSchema>;
export type RiskConfig = z.infer<typeof RiskConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

// =============================================================================
// LOADING
// =============================================================================

/**
 * Load configuration from environment variables
 */
export function loadConfig(): AppConfig {
  const env = process.env;

  const raw = {
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    server: {
      host: env.HOST,
      port: env.PORT ? parseInt(env.PORT, 10) : undefined,
    },
    database: env.DATABASE_URL
      ? {
          url: env.DATABASE_URL,
          poolSize: env.DB_POOL_SIZE ? parseInt(env.DB_POOL_SIZE, 10) : undefined,
          ssl: env.DB_SSL === "true",
        }
      : undefined,
    nats: {
      url: env.NATS_URL,
      name: env.NATS_NAME,
    },
    redis: {
      url: env.REDIS_URL,
      db: env.REDIS_DB ? parseInt(env.REDIS_DB, 10) : undefined,
    },
    engine: {
      shardId: env.SHARD_ID ? parseInt(env.SHARD_ID, 10) : undefined,
      symbols: env.SYMBOLS ? env.SYMBOLS.split(",") : undefined,
      snapshotIntervalMs: env.SNAPSHOT_INTERVAL ? parseInt(env.SNAPSHOT_INTERVAL, 10) : undefined,
      journalPath: env.JOURNAL_PATH,
      snapshotPath: env.SNAPSHOT_PATH,
    },
    marketData: {
      throttleMs: env.THROTTLE_MS ? parseInt(env.THROTTLE_MS, 10) : undefined,
      maxDepth: env.MAX_DEPTH ? parseInt(env.MAX_DEPTH, 10) : undefined,
    },
    risk: {
      maxOrderQty: env.MAX_ORDER_QTY ? parseFloat(env.MAX_ORDER_QTY) : undefined,
      maxNotional: env.MAX_NOTIONAL ? parseFloat(env.MAX_NOTIONAL) : undefined,
      priceBandPercent: env.PRICE_BAND_PERCENT ? parseFloat(env.PRICE_BAND_PERCENT) : undefined,
    },
  };

  // Remove undefined values recursively
  function removeUndefined(obj: any): any {
    if (obj === null || obj === undefined) return undefined;
    if (typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(removeUndefined);

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleaned = removeUndefined(value);
      if (cleaned !== undefined && !(typeof cleaned === "object" && Object.keys(cleaned).length === 0)) {
        result[key] = cleaned;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  const cleaned = removeUndefined(raw) ?? {};
  return AppConfigSchema.parse(cleaned);
}

/**
 * Validate configuration
 */
export function validateConfig(config: unknown): AppConfig {
  return AppConfigSchema.parse(config);
}

/**
 * Get required environment variable
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
export function getEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}
