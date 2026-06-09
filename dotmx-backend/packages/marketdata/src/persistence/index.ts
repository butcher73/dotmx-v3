/**
 * Market Data Persistence
 *
 * Stores incoming exchange data (klines, trades, ticker snapshots) into
 * PostgreSQL so the server can recover state on restart and serve historical
 * data without hitting the external exchange API every time.
 *
 * Design choices:
 * - Batch inserts via unnest() for throughput
 * - Klines use UPSERT (ON CONFLICT … DO UPDATE) so real-time updates merge cleanly
 * - Trades are append-only with periodic pruning
 * - Ticker snapshots are append-only with periodic pruning
 */

import type {
  ExternalTicker,
  ExternalKline,
  ExternalTrade,
} from "../external";

// =============================================================================
// TYPES
// =============================================================================

/** Minimal DB interface matching @dotmx/shared DatabaseService */
export interface MarketDataDb {
  execute(query: string, params?: any[]): Promise<void>;
  query<T = any>(query: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(query: string, params?: any[]): Promise<T | null>;
}

export interface MarketDataPersistence {
  /** Ensure tables exist (idempotent, safe to call on every startup) */
  ensureTables(): Promise<void>;

  // ── Klines ──────────────────────────────────────────────────────────
  /** Upsert a single kline (called on every WS kline update) */
  saveKline(kline: ExternalKline): Promise<void>;

  /** Batch upsert klines (for initial history load) */
  saveKlines(klines: ExternalKline[]): Promise<void>;

  /** Load historical klines from DB */
  loadKlines(
    symbol: string,
    interval: string,
    limit?: number,
  ): Promise<ExternalKline[]>;

  // ── Trades ──────────────────────────────────────────────────────────
  /** Append a single trade */
  saveTrade(trade: ExternalTrade): Promise<void>;

  /** Batch append trades */
  saveTrades(trades: ExternalTrade[]): Promise<void>;

  /** Load recent trades */
  loadTrades(symbol: string, limit?: number): Promise<ExternalTrade[]>;

  // ── Ticker snapshots ────────────────────────────────────────────────
  /** Save a ticker snapshot */
  saveTickerSnapshot(ticker: ExternalTicker): Promise<void>;

  /** Load most-recent ticker snapshot per symbol (for startup recovery) */
  loadLatestTickers(): Promise<ExternalTicker[]>;

  // ── Maintenance ─────────────────────────────────────────────────────
  /** Prune old trades (default: older than 24h) */
  pruneTrades(olderThanMs?: number): Promise<number>;

  /** Prune old ticker snapshots (default: older than 24h) */
  pruneTickerSnapshots(olderThanMs?: number): Promise<number>;

  /** Prune old klines per interval, keeping up to maxCandles per symbol+interval */
  pruneKlines(maxCandles?: number): Promise<number>;
}

// =============================================================================
// POSTGRES IMPLEMENTATION
// =============================================================================

export function createMarketDataPersistence(
  db: MarketDataDb,
): MarketDataPersistence {
  // Write buffer for batching (accumulate and flush periodically)
  let klineBuffer: ExternalKline[] = [];
  let tradeBuffer: ExternalTrade[] = [];
  let tickerBuffer: ExternalTicker[] = [];
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  const FLUSH_INTERVAL_MS = 2_000; // Flush every 2s
  const MAX_BUFFER_SIZE = 200;

  // Start periodic flush
  flushTimer = setInterval(flushAll, FLUSH_INTERVAL_MS);

  async function flushAll() {
    try {
      await Promise.all([flushKlines(), flushTrades(), flushTickers()]);
    } catch (err) {
      console.error("[MarketDataPersistence] Flush error:", err);
    }
  }

  async function flushKlines() {
    if (klineBuffer.length === 0) return;
    const batch = klineBuffer.splice(0, klineBuffer.length);
    await batchUpsertKlines(batch);
  }

  async function flushTrades() {
    if (tradeBuffer.length === 0) return;
    const batch = tradeBuffer.splice(0, tradeBuffer.length);
    await batchInsertTrades(batch);
  }

  async function flushTickers() {
    if (tickerBuffer.length === 0) return;
    const batch = tickerBuffer.splice(0, tickerBuffer.length);
    await batchInsertTickers(batch);
  }

  // ── Kline batch upsert ──────────────────────────────────────────────

  async function batchUpsertKlines(klines: ExternalKline[]) {
    if (klines.length === 0) return;

    // De-duplicate: keep latest per (symbol, interval, openTime)
    const map = new Map<string, ExternalKline>();
    for (const k of klines) {
      const key = `${k.symbol}|${k.interval}|${k.openTime}`;
      map.set(key, k);
    }
    const deduped = Array.from(map.values());

    // Build multi-row VALUES clause
    const values: any[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const k of deduped) {
      placeholders.push(
        `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10})`,
      );
      values.push(
        k.symbol,
        k.interval,
        k.openTime,
        k.closeTime,
        k.open,
        k.high,
        k.low,
        k.close,
        k.volume,
        k.trades,
        k.exchange,
      );
      idx += 11;
    }

    await db.execute(
      `INSERT INTO market_klines (symbol, interval, open_time, close_time, open, high, low, close, volume, trades, source)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (symbol, interval, open_time)
       DO UPDATE SET
         close_time = EXCLUDED.close_time,
         high = GREATEST(market_klines.high, EXCLUDED.high),
         low  = LEAST(market_klines.low, EXCLUDED.low),
         close = EXCLUDED.close,
         volume = EXCLUDED.volume,
         trades = EXCLUDED.trades,
         source = EXCLUDED.source,
         updated_at = NOW()`,
      values,
    );
  }

  // ── Trade batch insert ──────────────────────────────────────────────

  async function batchInsertTrades(trades: ExternalTrade[]) {
    if (trades.length === 0) return;

    const values: any[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const t of trades) {
      placeholders.push(
        `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6})`,
      );
      values.push(
        t.symbol,
        t.tradeId,
        t.price,
        t.quantity,
        t.side,
        t.exchange,
        t.timestamp,
      );
      idx += 7;
    }

    await db.execute(
      `INSERT INTO market_trades (symbol, trade_id, price, quantity, side, source, ts)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT DO NOTHING`,
      values,
    );
  }

  // ── Ticker batch insert ─────────────────────────────────────────────

  async function batchInsertTickers(tickers: ExternalTicker[]) {
    if (tickers.length === 0) return;

    // De-duplicate: keep latest per symbol
    const map = new Map<string, ExternalTicker>();
    for (const t of tickers) {
      map.set(t.symbol, t);
    }
    const deduped = Array.from(map.values());

    const values: any[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const t of deduped) {
      placeholders.push(
        `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9}, $${idx + 10}, $${idx + 11}, $${idx + 12}, $${idx + 13})`,
      );
      values.push(
        t.symbol,
        t.lastPrice,
        t.markPrice,
        t.indexPrice,
        t.bid,
        t.ask,
        t.high24h,
        t.low24h,
        t.volume24h,
        t.volumeQuote24h,
        t.priceChangePercent24h,
        t.fundingRate,
        t.exchange,
        t.timestamp,
      );
      idx += 14;
    }

    await db.execute(
      `INSERT INTO market_ticker_snapshots
         (symbol, last_price, mark_price, index_price, bid, ask, high_24h, low_24h,
          volume_24h, volume_quote_24h, price_change_pct_24h, funding_rate, source, ts)
       VALUES ${placeholders.join(", ")}`,
      // ts = now epoch ms, use the ticker's timestamp
      values,
    );
  }

  // ── Public API ──────────────────────────────────────────────────────

  return {
    async ensureTables() {
      // All tables are created by schema.sql — this is a safety net
      await db.execute(`
        CREATE TABLE IF NOT EXISTS market_klines (
          symbol      VARCHAR(32) NOT NULL,
          interval    VARCHAR(8)  NOT NULL,
          open_time   BIGINT      NOT NULL,
          close_time  BIGINT      NOT NULL,
          open        DECIMAL(24,12) NOT NULL,
          high        DECIMAL(24,12) NOT NULL,
          low         DECIMAL(24,12) NOT NULL,
          close       DECIMAL(24,12) NOT NULL,
          volume      DECIMAL(24,12) NOT NULL DEFAULT 0,
          trades      INTEGER        NOT NULL DEFAULT 0,
          source      VARCHAR(16) NOT NULL DEFAULT 'bitget',
          created_at  TIMESTAMPTZ DEFAULT NOW(),
          updated_at  TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (symbol, interval, open_time)
        );
        CREATE INDEX IF NOT EXISTS idx_market_klines_lookup
          ON market_klines(symbol, interval, open_time DESC);

        CREATE TABLE IF NOT EXISTS market_trades (
          id          BIGSERIAL   PRIMARY KEY,
          symbol      VARCHAR(32) NOT NULL,
          trade_id    VARCHAR(64),
          price       DECIMAL(24,12) NOT NULL,
          quantity    DECIMAL(24,12) NOT NULL,
          side        VARCHAR(4)  NOT NULL CHECK (side IN ('buy','sell')),
          source      VARCHAR(16) NOT NULL DEFAULT 'bitget',
          ts          BIGINT      NOT NULL,
          created_at  TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_market_trades_symbol_ts
          ON market_trades(symbol, ts DESC);

        CREATE TABLE IF NOT EXISTS market_ticker_snapshots (
          id               BIGSERIAL   PRIMARY KEY,
          symbol           VARCHAR(32) NOT NULL,
          last_price       DECIMAL(24,12) NOT NULL,
          mark_price       DECIMAL(24,12),
          index_price      DECIMAL(24,12),
          bid              DECIMAL(24,12),
          ask              DECIMAL(24,12),
          high_24h         DECIMAL(24,12),
          low_24h          DECIMAL(24,12),
          volume_24h       DECIMAL(24,12),
          volume_quote_24h DECIMAL(24,12),
          price_change_24h DECIMAL(24,12),
          price_change_pct_24h DECIMAL(10,4),
          funding_rate     DECIMAL(18,12),
          source           VARCHAR(16) NOT NULL DEFAULT 'bitget',
          ts               BIGINT      NOT NULL,
          created_at       TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_market_ticker_snapshots_symbol_ts
          ON market_ticker_snapshots(symbol, created_at DESC);
      `);
      console.log("✓ Market data tables ensured");
    },

    // ── Klines ────────────────────────────────────────────────────────

    async saveKline(kline: ExternalKline) {
      klineBuffer.push(kline);
      if (klineBuffer.length >= MAX_BUFFER_SIZE) {
        await flushKlines();
      }
    },

    async saveKlines(klines: ExternalKline[]) {
      await batchUpsertKlines(klines);
    },

    async loadKlines(
      symbol: string,
      interval: string,
      limit = 500,
    ): Promise<ExternalKline[]> {
      const rows = await db.query<{
        symbol: string;
        interval: string;
        open_time: string;
        close_time: string;
        open: string;
        high: string;
        low: string;
        close: string;
        volume: string;
        trades: number;
        source: string;
      }>(
        `SELECT symbol, interval, open_time, close_time,
                open, high, low, close, volume, trades, source
         FROM market_klines
         WHERE symbol = $1 AND interval = $2
         ORDER BY open_time DESC
         LIMIT $3`,
        [symbol, interval, limit],
      );

      return rows
        .map((r) => ({
          symbol: r.symbol,
          exchange: r.source,
          interval: r.interval,
          openTime: Number(r.open_time),
          closeTime: Number(r.close_time),
          open: Number(r.open),
          high: Number(r.high),
          low: Number(r.low),
          close: Number(r.close),
          volume: Number(r.volume),
          trades: r.trades,
        }))
        .reverse(); // ascending order
    },

    // ── Trades ────────────────────────────────────────────────────────

    async saveTrade(trade: ExternalTrade) {
      tradeBuffer.push(trade);
      if (tradeBuffer.length >= MAX_BUFFER_SIZE) {
        await flushTrades();
      }
    },

    async saveTrades(trades: ExternalTrade[]) {
      await batchInsertTrades(trades);
    },

    async loadTrades(symbol: string, limit = 100): Promise<ExternalTrade[]> {
      const rows = await db.query<{
        symbol: string;
        trade_id: string;
        price: string;
        quantity: string;
        side: "buy" | "sell";
        source: string;
        ts: string;
      }>(
        `SELECT symbol, trade_id, price, quantity, side, source, ts
         FROM market_trades
         WHERE symbol = $1
         ORDER BY ts DESC
         LIMIT $2`,
        [symbol, limit],
      );

      return rows
        .map((r) => ({
          symbol: r.symbol,
          exchange: r.source,
          tradeId: r.trade_id,
          price: Number(r.price),
          quantity: Number(r.quantity),
          side: r.side,
          timestamp: Number(r.ts),
        }))
        .reverse();
    },

    // ── Ticker snapshots ──────────────────────────────────────────────

    async saveTickerSnapshot(ticker: ExternalTicker) {
      tickerBuffer.push(ticker);
      if (tickerBuffer.length >= MAX_BUFFER_SIZE) {
        await flushTickers();
      }
    },

    async loadLatestTickers(): Promise<ExternalTicker[]> {
      const rows = await db.query<{
        symbol: string;
        last_price: string;
        mark_price: string;
        index_price: string;
        bid: string;
        ask: string;
        high_24h: string;
        low_24h: string;
        volume_24h: string;
        volume_quote_24h: string;
        price_change_pct_24h: string;
        funding_rate: string;
        source: string;
        ts: string;
      }>(
        `SELECT DISTINCT ON (symbol)
           symbol, last_price, mark_price, index_price, bid, ask,
           high_24h, low_24h, volume_24h, volume_quote_24h,
           price_change_pct_24h, funding_rate, source, ts
         FROM market_ticker_snapshots
         ORDER BY symbol, created_at DESC`,
      );

      return rows.map((r) => ({
        symbol: r.symbol,
        exchange: r.source,
        lastPrice: Number(r.last_price),
        markPrice: Number(r.mark_price) || 0,
        indexPrice: Number(r.index_price) || 0,
        bid: Number(r.bid) || 0,
        ask: Number(r.ask) || 0,
        high24h: Number(r.high_24h) || 0,
        low24h: Number(r.low_24h) || 0,
        volume24h: Number(r.volume_24h) || 0,
        volumeQuote24h: Number(r.volume_quote_24h) || 0,
        priceChange24h: 0,
        priceChangePercent24h: Number(r.price_change_pct_24h) || 0,
        fundingRate: Number(r.funding_rate) || 0,
        nextFundingTime: 0,
        timestamp: Number(r.ts) || Date.now(),
      }));
    },

    // ── Maintenance ───────────────────────────────────────────────────

    async pruneTrades(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
      const cutoff = Date.now() - olderThanMs;
      const result = await db.query<{ count: string }>(
        `WITH deleted AS (
           DELETE FROM market_trades WHERE ts < $1 RETURNING 1
         ) SELECT count(*)::text AS count FROM deleted`,
        [cutoff],
      );
      const count = Number(result[0]?.count ?? 0);
      if (count > 0) console.log(`[Persistence] Pruned ${count} old trades`);
      return count;
    },

    async pruneTickerSnapshots(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
      const cutoff = new Date(Date.now() - olderThanMs).toISOString();
      const result = await db.query<{ count: string }>(
        `WITH deleted AS (
           DELETE FROM market_ticker_snapshots WHERE created_at < $1 RETURNING 1
         ) SELECT count(*)::text AS count FROM deleted`,
        [cutoff],
      );
      const count = Number(result[0]?.count ?? 0);
      if (count > 0) console.log(`[Persistence] Pruned ${count} old ticker snapshots`);
      return count;
    },

    async pruneKlines(maxCandles = 5000): Promise<number> {
      // For each symbol+interval, keep only the most recent `maxCandles`
      const result = await db.query<{ count: string }>(
        `WITH ranked AS (
           SELECT symbol, interval, open_time,
                  ROW_NUMBER() OVER (PARTITION BY symbol, interval ORDER BY open_time DESC) AS rn
           FROM market_klines
         ), to_delete AS (
           DELETE FROM market_klines
           WHERE (symbol, interval, open_time) IN (
             SELECT symbol, interval, open_time FROM ranked WHERE rn > $1
           ) RETURNING 1
         ) SELECT count(*)::text AS count FROM to_delete`,
        [maxCandles],
      );
      const count = Number(result[0]?.count ?? 0);
      if (count > 0) console.log(`[Persistence] Pruned ${count} old klines`);
      return count;
    },
  };
}
