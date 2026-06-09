/**
 * Market Data Server Entry Point
 *
 * Dedicated service for market data aggregation and distribution.
 * Proxies external exchange data (Bitget) combined with internal data.
 * Note: CORS is handled by Kong API Gateway.
 */

import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import {
  createL2BookBuilder,
  createMemoryFanout,
  initializeDataSources,
  loadDataSourceConfig,
  createMarketDataPersistence,
  type ExternalPriceFeed,
  type ExternalTicker,
  type ExternalKline,
  type DataSourceResult,
  type MarketDataPersistence,
  type L2Book,
} from "@dotmx/marketdata";
import { DatabaseService, toInternalSymbol, toExchangeSymbol, toDbSymbol, symbolsMatch } from "@dotmx/shared";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

// Database service for fetching symbols
let db: DatabaseService | null = null;

// External data sources (initialized from config)
let dataSources: DataSourceResult | null = null;

// Market data persistence (DB-backed)
let persistence: MarketDataPersistence | null = null;

// Active feed (primary or fallback)
function getActiveFeed(): ExternalPriceFeed | null {
  return dataSources?.getActiveFeed() ?? null;
}

// In-memory caches for real-time data
const tickerCache = new Map<string, ExternalTicker>();
const klineCache = new Map<string, ExternalKline[]>(); // key = symbol:interval

// WebSocket clients for streaming
interface WsClient {
  id: string;
  ws: any;
  subscriptions: Set<string>; // "ticker:BTCUSDT", "kline:BTCUSDT:1m"
}
const wsClients = new Map<string, WsClient>();

interface TradingPair {
  symbol: string;
  base_currency: string;
  quote_currency: string;
  status: string;
  tick_size: string;
  lot_size: string;
  min_order_size: string;
  max_order_size: string | null;
  maker_fee: string;
  taker_fee: string;
}

// Symbol mapping: internal symbol -> Bitget symbol
const SYMBOL_MAP: Record<string, string> = {};
const REVERSE_SYMBOL_MAP: Record<string, string> = {};

function toBitgetSymbol(internalSymbol: string): string {
  if (SYMBOL_MAP[internalSymbol]) return SYMBOL_MAP[internalSymbol];
  return toExchangeSymbol(internalSymbol);
}

function fromBitgetSymbol(bitgetSymbol: string): string {
  if (REVERSE_SYMBOL_MAP[bitgetSymbol]) return REVERSE_SYMBOL_MAP[bitgetSymbol];
  return toInternalSymbol(bitgetSymbol);
}

/**
 * Look up a ticker from cache with symbol normalization.
 * Handles BTC-USDT, BTC/USDT, BTCUSDT, BTCUSDT_UMCBL formats.
 */
function lookupTicker(rawSymbol: string): ExternalTicker | undefined {
  const sym = rawSymbol.replace(/_UMCBL$/, "");
  // Try exact match first
  if (tickerCache.has(sym)) return tickerCache.get(sym);
  // Try canonical internal format: "BTC-USDT"
  const internal = toInternalSymbol(sym);
  if (tickerCache.has(internal)) return tickerCache.get(internal);
  // Try flat exchange format: "BTCUSDT"
  const flat = toExchangeSymbol(sym);
  if (tickerCache.has(flat)) return tickerCache.get(flat);
  // Try slash DB format: "BTC/USDT"
  const slash = toDbSymbol(sym);
  if (tickerCache.has(slash)) return tickerCache.get(slash);
  // Try Bitget mapped symbol (from runtime map)
  const bitget = toBitgetSymbol(sym);
  if (tickerCache.has(bitget)) return tickerCache.get(bitget);
  return undefined;
}

/**
 * Periodically update trading_pairs table with live ticker data.
 * DB uses slash format (BTC/USDT) so we convert before querying.
 */
async function updateDbPrices() {
  if (!db) return;
  for (const [key, ticker] of tickerCache.entries()) {
    // Only update using internal symbol keys (containing / or -)
    if (!key.includes("/") && !key.includes("-")) continue;
    const dbSymbol = toDbSymbol(key);
    try {
      await db.query(
        `UPDATE trading_pairs SET
           last_price = $2,
           high_24h = $3,
           low_24h = $4,
           volume_24h = $5,
           price_change_24h = $6
         WHERE symbol = $1`,
        [
          dbSymbol,
          ticker.lastPrice,
          ticker.high24h,
          ticker.low24h,
          ticker.volume24h,
          ticker.priceChangePercent24h,
        ]
      );
    } catch (err) {
      // Silently ignore — pair may not exist in DB
    }
  }
}

// Broadcast to subscribed WebSocket clients
function broadcastToSubscribers(channel: string, data: unknown) {
  for (const client of wsClients.values()) {
    if (client.subscriptions.has(channel)) {
      try {
        client.ws.send(JSON.stringify(data));
      } catch {
        // Client disconnected, will be cleaned up
      }
    }
  }
}

async function getSymbolsFromDb(): Promise<TradingPair[]> {
  if (!db) {
    console.warn("⚠️ Database not connected, returning empty symbols");
    return [];
  }

  try {
    const rows = await db.query<TradingPair>(
      `SELECT symbol, base_currency, quote_currency, status, 
              tick_size, lot_size, min_order_size, max_order_size,
              maker_fee, taker_fee
       FROM trading_pairs 
       WHERE status = 'active'
       ORDER BY display_order, symbol`
    );
    return rows ?? [];
  } catch (error) {
    console.error("❌ Failed to fetch symbols from database:", error);
    return [];
  }
}

// Granularity mapping: various formats → Bitget V2 format
const GRANULARITY_MAP: Record<string, string> = {
  "1": "1m", "3": "3m", "5": "5m", "15": "15m", "30": "30m",
  "60": "1H", "240": "4H", "360": "6H", "720": "12H",
  "1min": "1m", "3min": "3m", "5min": "5m", "15min": "15m", "30min": "30m",
  "1h": "1H", "4h": "4H", "6h": "6H", "12h": "12H",
  "1day": "1D", "1week": "1W",
  "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
  "1H": "1H", "4H": "4H", "6H": "6H", "12H": "12H",
  "1D": "1D", "1W": "1W", "1M": "1M",
};

function toBitgetGranularity(g: string): string {
  return GRANULARITY_MAP[g] || g;
}

async function main() {
  console.log("🚀 Starting DotMX Market Data Server...");

  // Initialize database connection
  if (process.env.DATABASE_URL) {
    try {
      db = new DatabaseService({
        connection_string: process.env.DATABASE_URL,
        max_connections: 10,
      });
      console.log("✅ Database connected");

      // Initialize market data persistence
      persistence = createMarketDataPersistence(db);
      await persistence.ensureTables();
      console.log("✅ Market data persistence ready");
    } catch (error) {
      console.error("❌ Failed to connect to database:", error);
    }
  } else {
    console.warn("⚠️ DATABASE_URL not set, symbols endpoint will return empty array");
  }

  // Fetch initial symbols from database
  const tradingPairs = await getSymbolsFromDb();
  const SYMBOLS = tradingPairs?.map((p) => p.symbol) ?? [];

  // Build symbol mappings
  for (const pair of tradingPairs) {
    const bitgetSym = `${pair.base_currency}USDT`;
    SYMBOL_MAP[pair.symbol] = bitgetSym;
    REVERSE_SYMBOL_MAP[bitgetSym] = pair.symbol;
  }

  // Initialize book builders
  const books = new Map<string, ReturnType<typeof createL2BookBuilder>>();
  const fanout = createMemoryFanout();

  for (const symbol of SYMBOLS) {
    books.set(symbol, createL2BookBuilder(symbol));
  }

  // ---------------------------------------------------------------------------
  // External Data Sources — proxy exchange data to frontend
  // ---------------------------------------------------------------------------
  const dsConfig = loadDataSourceConfig();
  try {
    dataSources = initializeDataSources(dsConfig);
    await dataSources.connectAll();
    dataSources.logStatus();

    // Subscribe all feeds to all symbols
    for (const feed of dataSources.feeds.values()) {
      for (const pair of tradingPairs) {
        feed.subscribeTicker(pair.symbol);
        feed.subscribeOrderbook(pair.symbol);
        feed.subscribeTrades(pair.symbol);
        for (const interval of ["1m", "5m", "15m", "1H", "4H", "1D"]) {
          feed.subscribeKlines(pair.symbol, interval);
        }
      }

      // Wire event handlers — all feeds broadcast through the same channels
      feed.onTicker((ticker) => {
        const internalSymbol = ticker.symbol;
        const exchangeSym = toBitgetSymbol(internalSymbol);
        const dbSym = REVERSE_SYMBOL_MAP[exchangeSym] || toDbSymbol(internalSymbol);

        // Merge: always update prices, but preserve 24h stats if new data has zeros
        // (Binance mark price stream sends 0 for high/low/volume — don't lose Bitget data)
        const existing = tickerCache.get(exchangeSym);
        let final = ticker;
        if (existing && ticker.high24h === 0 && existing.high24h > 0) {
          final = {
            ...existing,
            lastPrice: ticker.lastPrice || existing.lastPrice,
            markPrice: ticker.markPrice || existing.markPrice,
            indexPrice: ticker.indexPrice || existing.indexPrice,
            bid: ticker.bid || existing.bid,
            ask: ticker.ask || existing.ask,
            fundingRate: ticker.fundingRate || existing.fundingRate,
            nextFundingTime: ticker.nextFundingTime || existing.nextFundingTime,
            timestamp: ticker.timestamp,
          };
        }

        tickerCache.set(exchangeSym, final);
        tickerCache.set(internalSymbol, final);
        tickerCache.set(dbSym, final); // Also cache under DB symbol (slash format) for updateDbPrices

        // Persist ticker snapshot to DB (using exchange symbol for consistency)
        if (persistence) {
          const persistTicker = { ...final, symbol: exchangeSym };
          persistence.saveTickerSnapshot(persistTicker).catch(() => {});
        }

        broadcastToSubscribers(`ticker:${exchangeSym}`, {
          type: "ticker",
          symbol: exchangeSym,
          data: {
            symbol: exchangeSym,
            lastPr: final.lastPrice.toString(),
            open24h: ((final.lastPrice - final.priceChange24h) || final.lastPrice).toString(),
            high24h: final.high24h.toString(),
            low24h: final.low24h.toString(),
            baseVolume: final.volume24h.toString(),
            quoteVolume: final.volumeQuote24h.toString(),
            change24h: final.priceChange24h.toString(),
            changeUtc24h: (final.priceChangePercent24h / 100).toString(),
            markPrice: final.markPrice.toString(),
            indexPrice: final.indexPrice.toString(),
            fundingRate: final.fundingRate.toString(),
            nextFundingTime: final.nextFundingTime.toString(),
            bidPr: final.bid.toString(),
            askPr: final.ask.toString(),
            ts: final.timestamp.toString(),
          },
          ts: Date.now(),
        });
      });

      feed.onKline((kline) => {
        const exchangeSym = toBitgetSymbol(kline.symbol);
        const cacheKey = `${exchangeSym}:${kline.interval}`;

        let candles = klineCache.get(cacheKey) || [];
        const existingIdx = candles.findIndex((c) => c.openTime === kline.openTime);
        if (existingIdx >= 0) {
          candles[existingIdx] = kline;
        } else {
          candles.push(kline);
          if (candles.length > 1000) candles = candles.slice(-1000);
        }
        klineCache.set(cacheKey, candles);

        // Persist kline to DB (using exchange symbol for consistency)
        if (persistence) {
          const persistKline = { ...kline, symbol: exchangeSym };
          persistence.saveKline(persistKline).catch(() => {});
        }

        broadcastToSubscribers(`kline:${exchangeSym}:${kline.interval}`, {
          type: "kline",
          symbol: exchangeSym,
          interval: kline.interval,
          data: {
            timestamp: kline.openTime,
            open: kline.open,
            high: kline.high,
            low: kline.low,
            close: kline.close,
            volume: kline.volume,
          },
          ts: Date.now(),
        });
      });

      feed.onTrade((trade) => {
        const exchangeSym = toBitgetSymbol(trade.symbol);

        // Persist trade to DB (using exchange symbol for consistency)
        if (persistence) {
          const persistTrade = { ...trade, symbol: exchangeSym };
          persistence.saveTrade(persistTrade).catch(() => {});
        }

        broadcastToSubscribers(`trade:${exchangeSym}`, {
          type: "trade",
          symbol: exchangeSym,
          data: {
            tradeId: trade.tradeId,
            price: trade.price.toString(),
            size: trade.quantity.toString(),
            side: trade.side,
            ts: trade.timestamp.toString(),
          },
          ts: Date.now(),
        });
      });

      feed.onOrderbook((ob) => {
        const exchangeSym = toBitgetSymbol(ob.symbol);
        broadcastToSubscribers(`orderbook:${exchangeSym}`, {
          type: "orderbook",
          symbol: exchangeSym,
          data: {
            bids: ob.bids,
            asks: ob.asks,
            ts: ob.timestamp,
          },
          ts: Date.now(),
        });
      });
    }
  } catch (error) {
    console.error("⚠️ Failed to initialize data sources (will use REST fallback):", error);
  }

  // ---------------------------------------------------------------------------
  // Recover state from database on startup
  // ---------------------------------------------------------------------------
  if (persistence) {
    try {
      // Load cached tickers so UI shows data immediately
      const savedTickers = await persistence.loadLatestTickers();
      for (const t of savedTickers) {
        const exchangeSym = toBitgetSymbol(t.symbol);
        tickerCache.set(exchangeSym, t);
        tickerCache.set(t.symbol, t);
      }
      if (savedTickers.length > 0) {
        console.log(`📊 Recovered ${savedTickers.length} ticker(s) from DB`);
      }

      // Load cached klines for popular intervals
      for (const pair of tradingPairs) {
        for (const interval of ["1m", "5m", "15m", "1H", "4H", "1D"]) {
          const exchangeSym = toBitgetSymbol(pair.symbol);
          const klines = await persistence.loadKlines(exchangeSym, interval, 500);
          if (klines.length > 0) {
            const cacheKey = `${exchangeSym}:${interval}`;
            klineCache.set(cacheKey, klines);
          }
        }
      }
      const totalKlines = Array.from(klineCache.values()).reduce((sum, arr) => sum + arr.length, 0);
      if (totalKlines > 0) {
        console.log(`📊 Recovered ${totalKlines} kline(s) across ${klineCache.size} cache keys from DB`);
      }
    } catch (err) {
      console.warn("⚠️ Failed to recover market data from DB:", err);
    }
  }

  // Create REST API
  const app = new Elysia()
    .use(cors({ origin: true, credentials: true }))
    .get("/", () => ({
      name: "DotMX Market Data Server",
      version: "2.0.0",
      symbols: SYMBOLS,
      features: ["ticker", "klines", "orderbook", "trades", "ws-streaming"],
    }))
    .get("/health", () => ({
      status: "ok",
      sources: Object.fromEntries(
        Array.from(dataSources?.feeds.entries() ?? []).map(([name, feed]) => [name, feed.isConnected()])
      ),
    }))
    .get("/api/health", () => ({
      status: "ok",
      sources: Object.fromEntries(
        Array.from(dataSources?.feeds.entries() ?? []).map(([name, feed]) => [name, feed.isConnected()])
      ),
    }))

    // ── Orderbook ──────────────────────────────────────────────────────
    .get(
      "/orderbook/:symbol",
      async ({ params, query }) => {
        const depth = query.depth ?? 20;
        // Try internal book first
        const builder = books.get(params.symbol);
        if (builder) {
          const book = builder.getSnapshot(depth);
          if (book.bids.length > 0 || book.asks.length > 0) return book;
        }
        // Fallback to external feed
        const feed = getActiveFeed();
        if (feed) {
          try {
            const sym = params.symbol.replace(/_UMCBL$/, "");
            return await feed.fetchOrderbook(sym, depth);
          } catch { /* fall through */ }
        }
        return { error: "Symbol not found" };
      },
      { params: t.Object({ symbol: t.String() }), query: t.Object({ depth: t.Optional(t.Numeric()) }) }
    )
    .get(
      "/api/orderbook/:symbol",
      async ({ params, query }) => {
        const depth = query.depth ?? 20;
        const builder = books.get(params.symbol);
        if (builder) {
          const book = builder.getSnapshot(depth);
          if (book.bids.length > 0 || book.asks.length > 0) return book;
        }
        const feed2 = getActiveFeed();
        if (feed2) {
          try { return await feed2.fetchOrderbook(params.symbol, depth); } catch { /* */ }
        }
        return { error: "Symbol not found" };
      },
      { params: t.Object({ symbol: t.String() }), query: t.Object({ depth: t.Optional(t.Numeric()) }) }
    )

    // ── Symbols ────────────────────────────────────────────────────────
    .get("/symbols", async () => {
      const pairs = await getSymbolsFromDb();
      return {
        symbols: (pairs ?? []).map((p) => ({
          symbol: p.symbol,
          baseAsset: p.base_currency,
          quoteAsset: p.quote_currency,
          status: p.status?.toUpperCase() ?? "ACTIVE",
          minOrderSize: p.min_order_size,
          maxOrderSize: p.max_order_size,
          tickSize: p.tick_size,
          lotSize: p.lot_size,
          makerFee: p.maker_fee,
          takerFee: p.taker_fee,
        })),
      };
    })
    .get("/api/symbols", async () => {
      const pairs = await getSymbolsFromDb();
      return {
        symbols: (pairs ?? []).map((p) => ({
          symbol: p.symbol,
          baseAsset: p.base_currency,
          quoteAsset: p.quote_currency,
          status: p.status?.toUpperCase() ?? "ACTIVE",
          minOrderSize: p.min_order_size,
          maxOrderSize: p.max_order_size,
          tickSize: p.tick_size,
          lotSize: p.lot_size,
          makerFee: p.maker_fee,
          takerFee: p.taker_fee,
        })),
      };
    })

    // ── Ticker ──────────────────────────────────────────────────────────
    .get(
      "/api/v1/ticker",
      async ({ query }) => {
        const symbol = (query.symbol || "BTCUSDT").replace(/_UMCBL$/, "");
        // Check cache first (populated from WS stream)
        const cached = tickerCache.get(symbol);
        if (cached) {
          return { success: true, data: [formatTickerResponse(cached)] };
        }
        // REST fallback
        const feed = getActiveFeed();
        if (feed) {
          try {
            const ticker = await feed.fetchTicker(symbol);
            tickerCache.set(symbol, ticker);
            return { success: true, data: [formatTickerResponse(ticker)] };
          } catch (err) {
            return { success: false, error: String(err) };
          }
        }
        return { success: false, error: "No data source available" };
      },
      { query: t.Object({ symbol: t.Optional(t.String()) }) }
    )

    // ── Klines / Candlesticks ──────────────────────────────────────────
    .get(
      "/api/v1/klines",
      async ({ query }) => {
        const symbol = (query.symbol || "BTCUSDT").replace(/_UMCBL$/, "");
        const granularity = toBitgetGranularity(query.granularity || "1m");
        const limit = parseInt(query.limit || "200", 10);

        // Try DB first (aggregated data)
        if (persistence) {
          try {
            const dbKlines = await persistence.loadKlines(toExchangeSymbol(symbol), granularity, limit);
            if (dbKlines.length >= 10) {
              const formatted = dbKlines.map((k) => ({
                timestamp: k.openTime,
                open: k.open,
                high: k.high,
                low: k.low,
                close: k.close,
                volume: k.volume,
                quoteVolume: 0,
                usdtVolume: 0,
              }));
              return { success: true, data: formatted, symbol, granularity, source: "db" };
            }
          } catch {
            // Fall through to REST
          }
        }

        // REST fetch from exchange (fallback or initial seed)
        const feed = getActiveFeed();
        if (feed) {
          try {
            const klines = await feed.fetchKlines(symbol, granularity, limit);
            const formatted = klines.map((k) => ({
              timestamp: k.openTime,
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
              volume: k.volume,
              quoteVolume: 0,
              usdtVolume: 0,
            }));

            // Persist fetched klines to DB for future use
            if (persistence && klines.length > 0) {
              persistence.saveKlines(klines).catch(() => {});
            }

            return { success: true, data: formatted, symbol, granularity, source: "exchange" };
          } catch (err) {
            return { success: false, error: String(err) };
          }
        }
        return { success: false, error: "No data source available" };
      },
      { query: t.Object({ symbol: t.Optional(t.String()), granularity: t.Optional(t.String()), limit: t.Optional(t.String()) }) }
    )

    // ── Funding Rate ───────────────────────────────────────────────────
    .get(
      "/api/v1/funding-rate/:symbol",
      async ({ params }) => {
        const symbol = params.symbol.replace(/_UMCBL$/, "");
        const ticker = tickerCache.get(symbol);
        if (ticker) {
          return {
            success: true,
            data: {
              symbol,
              fundingRate: ticker.fundingRate,
              nextFundingTime: ticker.nextFundingTime,
              markPrice: ticker.markPrice,
              indexPrice: ticker.indexPrice,
            },
          };
        }
        // REST fallback
        const feedFr = getActiveFeed();
        if (feedFr) {
          try {
            const t = await feedFr.fetchTicker(symbol);
            return {
              success: true,
              data: {
                symbol,
                fundingRate: t.fundingRate,
                nextFundingTime: t.nextFundingTime,
                markPrice: t.markPrice,
                indexPrice: t.indexPrice,
              },
            };
          } catch { /* */ }
        }
        return { success: false, error: "No funding rate data" };
      },
      { params: t.Object({ symbol: t.String() }) }
    )

    // ── Mark Price ──────────────────────────────────────────────────────
    .get(
      "/api/v1/mark-price/:symbol",
      async ({ params }) => {
        const symbol = params.symbol.replace(/_UMCBL$/, "");
        const ticker = tickerCache.get(symbol);
        if (ticker) {
          return {
            success: true,
            data: { symbol, markPrice: ticker.markPrice, indexPrice: ticker.indexPrice, ts: ticker.timestamp },
          };
        }
        const feedMp = getActiveFeed();
        if (feedMp) {
          try {
            const t = await feedMp.fetchTicker(symbol);
            return { success: true, data: { symbol, markPrice: t.markPrice, indexPrice: t.indexPrice, ts: t.timestamp } };
          } catch { /* */ }
        }
        return { success: false, error: "No mark price data" };
      },
      { params: t.Object({ symbol: t.String() }) }
    )

    // ── Routes matching frontend ApiClient paths ──────────────────────
    // nginx strips /api/ prefix, so /api/v1/market/* → /v1/market/*
    .get(
      "/v1/market/depth",
      async ({ query }) => {
        const rawSymbol = query.symbol || "BTCUSDT";
        const limit = query.limit || 20;
        const sym = rawSymbol.replace(/_UMCBL$/, "");
        // Try internal book
        const builder = books.get(sym);
        if (builder) {
          const book = builder.getSnapshot(limit);
          if (book.bids.length > 0 || book.asks.length > 0) {
            return { symbol: sym, bids: book.bids, asks: book.asks, timestamp: Date.now() };
          }
        }
        // Fallback to external feed
        const feedRef = getActiveFeed();
        if (feedRef) {
          try {
            const ob = await feedRef.fetchOrderbook(sym, limit);
            return { symbol: sym, bids: ob.bids, asks: ob.asks, timestamp: ob.timestamp };
          } catch { /* */ }
        }
        return { symbol: sym, bids: [], asks: [], timestamp: Date.now() };
      },
      { query: t.Object({ symbol: t.Optional(t.String()), limit: t.Optional(t.Numeric()) }) }
    )
    .get(
      "/v1/market/trades/recent",
      async ({ query }) => {
        const rawSymbol = query.symbol || "BTCUSDT";
        const limit = query.limit || 50;
        const feedRef = getActiveFeed();
        if (feedRef) {
          try {
            const klines = await feedRef.fetchKlines(rawSymbol, "1m", 1);
            // No dedicated trades REST API in feeds; return empty for now
          } catch { /* */ }
        }
        return { trades: [] };
      },
      { query: t.Object({ symbol: t.Optional(t.String()), limit: t.Optional(t.Numeric()) }) }
    )
    .get(
      "/v1/market/funding-rates",
      async () => {
        const rates = [];
        for (const [sym, ticker] of tickerCache.entries()) {
          // Skip duplicate keys (internal/db formats)
          if (sym.includes("/") || sym.includes("-")) continue;
          rates.push({
            symbol: sym,
            fundingRate: ticker.fundingRate,
            markPrice: ticker.markPrice,
            indexPrice: ticker.indexPrice,
            nextFundingTime: ticker.nextFundingTime ? new Date(ticker.nextFundingTime).toISOString() : "",
            timestamp: new Date().toISOString(),
          });
        }
        return { rates };
      }
    )
    .get(
      "/v1/market/ticker/24hr",
      async ({ query }) => {
        const rawSymbol = (query.symbol || "BTCUSDT");
        const feedRef = getActiveFeed();
        const ticker = lookupTicker(rawSymbol) || (feedRef ? await feedRef.fetchTicker(toExchangeSymbol(rawSymbol)).catch(() => null) : null);
        if (ticker) {
          return {
            symbol: ticker.symbol,
            lastPrice: ticker.lastPrice.toString(),
            highPrice: ticker.high24h.toString(),
            lowPrice: ticker.low24h.toString(),
            volume: ticker.volume24h.toString(),
            quoteVolume: ticker.volumeQuote24h.toString(),
            priceChange: ticker.priceChange24h.toString(),
            priceChangePercent: (ticker.priceChangePercent24h).toFixed(2),
            trades: 0,
          };
        }
        return {
          symbol: rawSymbol,
          lastPrice: "0",
          highPrice: "0",
          lowPrice: "0",
          volume: "0",
          quoteVolume: "0",
          priceChange: "0",
          priceChangePercent: "0",
          trades: 0,
        };
      },
      { query: t.Object({ symbol: t.Optional(t.String()) }) }
    )
    .get(
      "/v1/market/funding-rate/:symbol",
      async ({ params }) => {
        const rawSymbol = params.symbol;
        const feedRef2 = getActiveFeed();
        const ticker = lookupTicker(rawSymbol) || (feedRef2 ? await feedRef2.fetchTicker(toExchangeSymbol(rawSymbol)).catch(() => null) : null);
        if (ticker) {
          return {
            symbol: rawSymbol,
            fundingRate: ticker.fundingRate,
            nextFundingTime: ticker.nextFundingTime ? new Date(ticker.nextFundingTime).toISOString() : "",
            markPrice: ticker.markPrice,
            indexPrice: ticker.indexPrice,
            timestamp: new Date().toISOString(),
          };
        }
        return {
          symbol: rawSymbol,
          fundingRate: 0,
          markPrice: 0,
          indexPrice: 0,
          nextFundingTime: "",
          timestamp: new Date().toISOString(),
        };
      },
      { params: t.Object({ symbol: t.String() }) }
    )
    .get(
      "/v1/market/mark-price/:symbol",
      async ({ params }) => {
        const rawSymbol = params.symbol;
        const feedRef3 = getActiveFeed();
        const ticker = lookupTicker(rawSymbol) || (feedRef3 ? await feedRef3.fetchTicker(toExchangeSymbol(rawSymbol)).catch(() => null) : null);
        if (ticker) {
          return {
            symbol: rawSymbol,
            markPrice: ticker.markPrice,
            indexPrice: ticker.indexPrice,
            lastFundingRate: ticker.fundingRate,
            nextFundingTime: ticker.nextFundingTime ? new Date(ticker.nextFundingTime).toISOString() : "",
            timestamp: new Date().toISOString(),
          };
        }
        return {
          symbol: rawSymbol,
          markPrice: 0,
          indexPrice: 0,
          lastFundingRate: 0,
          nextFundingTime: "",
          timestamp: new Date().toISOString(),
        };
      },
      { params: t.Object({ symbol: t.String() }) }
    )
    .get(
      "/v1/market/open-interest/:symbol",
      async ({ params }) => {
        return {
          symbol: params.symbol,
          openInterest: 0,
          longOpenInterest: 0,
          shortOpenInterest: 0,
          totalPositions: 0,
          timestamp: new Date().toISOString(),
        };
      },
      { params: t.Object({ symbol: t.String() }) }
    )

    // ── WebSocket for streaming ────────────────────────────────────────
    .ws("/ws", {
      open(ws) {
        const clientId = crypto.randomUUID();
        (ws as any).__clientId = clientId;
        wsClients.set(clientId, { id: clientId, ws, subscriptions: new Set() });
        console.log(`📡 WS client connected: ${clientId}`);
      },
      close(ws) {
        const clientId = (ws as any).__clientId;
        if (clientId) {
          wsClients.delete(clientId);
          console.log(`📡 WS client disconnected: ${clientId}`);
        }
      },
      message(ws, message) {
        const clientId = (ws as any).__clientId;
        const client = clientId ? wsClients.get(clientId) : null;
        if (!client) return;

        try {
          const msg = typeof message === "string" ? JSON.parse(message) : message;

          if (msg === "ping" || (msg as any) === "ping") {
            ws.send(JSON.stringify("pong"));
            return;
          }

          const action = (msg as any).action || (msg as any).op;
          const args = (msg as any).args || [];

          switch (action) {
            case "subscribe": {
              // Support both { action: "subscribe", args: [{channel, instId}] }
              // and simple { action: "subscribe", symbol, channels: [] } formats
              if (Array.isArray(args) && args.length > 0) {
                for (const arg of args) {
                  const channel = arg.channel;
                  const instId = (arg.instId || arg.symbol || "").replace(/_UMCBL$/, "");
                  const interval = arg.interval;

                  if (channel === "ticker") {
                    client.subscriptions.add(`ticker:${instId}`);
                    // Send last cached ticker immediately
                    const cached = tickerCache.get(instId);
                    if (cached) {
                      ws.send(JSON.stringify({
                        type: "ticker",
                        symbol: instId,
                        data: formatTickerResponse(cached),
                        ts: Date.now(),
                      }));
                    }
                  } else if (channel === "kline" || channel?.startsWith("candle")) {
                    const intv = interval || channel.replace("candle", "") || "1m";
                    client.subscriptions.add(`kline:${instId}:${intv}`);
                  } else if (channel === "trade") {
                    client.subscriptions.add(`trade:${instId}`);
                  } else if (channel === "orderbook" || channel === "books5" || channel === "books15") {
                    client.subscriptions.add(`orderbook:${instId}`);
                  }
                }
              } else {
                // Simple format
                const symbols = (msg as any).symbols ?? ((msg as any).symbol ? [(msg as any).symbol] : []);
                const channels = (msg as any).channels ?? ["ticker"];
                for (const sym of symbols) {
                  const cleanSym = sym.replace(/_UMCBL$/, "");
                  for (const ch of channels) {
                    client.subscriptions.add(`${ch}:${cleanSym}`);
                  }
                }
              }
              ws.send(JSON.stringify({ type: "subscribed", subscriptions: Array.from(client.subscriptions) }));
              break;
            }
            case "unsubscribe": {
              if (Array.isArray(args)) {
                for (const arg of args) {
                  const channel = arg.channel;
                  const instId = (arg.instId || "").replace(/_UMCBL$/, "");
                  client.subscriptions.delete(`${channel}:${instId}`);
                }
              }
              ws.send(JSON.stringify({ type: "unsubscribed" }));
              break;
            }
          }
        } catch (err) {
          console.error("WS message parse error:", err);
        }
      },
    })
    .listen({ port: PORT, hostname: HOST });

  console.log(`✅ Market Data Server running at http://${HOST}:${PORT}`);
  console.log(`📡 WebSocket: ws://${HOST}:${PORT}/ws`);
  console.log(`📊 Symbols loaded from DB: ${SYMBOLS.length > 0 ? SYMBOLS.join(", ") : "(none)"}`);
  if (dataSources) dataSources.logStatus();

  // Periodically sync ticker data into trading_pairs table (every 10s)
  setInterval(updateDbPrices, 10_000);
  // Run once immediately after a short delay for initial data
  setTimeout(updateDbPrices, 5_000);

  // Periodic pruning of old market data (every 30 minutes)
  if (persistence) {
    setInterval(async () => {
      try {
        await persistence!.pruneTrades();       // Remove trades older than 24h
        await persistence!.pruneTickerSnapshots(); // Remove snapshots older than 24h
        await persistence!.pruneKlines(5000);      // Keep max 5000 klines per symbol+interval
      } catch (err) {
        console.error("[Persistence] Prune error:", err);
      }
    }, 30 * 60 * 1000);
  }

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down market data server...");
    if (dataSources) await dataSources.disconnectAll();
    if (db) await db.close();
    process.exit(0);
  });
}

// Format ticker for API response (Bitget-compatible format)
function formatTickerResponse(ticker: ExternalTicker) {
  return {
    symbol: ticker.symbol,
    lastPr: ticker.lastPrice.toString(),
    open24h: ((ticker.lastPrice - ticker.priceChange24h) || ticker.lastPrice).toString(),
    high24h: ticker.high24h.toString(),
    low24h: ticker.low24h.toString(),
    baseVolume: ticker.volume24h.toString(),
    quoteVolume: ticker.volumeQuote24h.toString(),
    change24h: ticker.priceChange24h.toString(),
    changeUtc24h: (ticker.priceChangePercent24h / 100).toString(),
    markPrice: ticker.markPrice.toString(),
    indexPrice: ticker.indexPrice.toString(),
    fundingRate: ticker.fundingRate.toString(),
    nextFundingTime: ticker.nextFundingTime.toString(),
    bidPr: ticker.bid.toString(),
    askPr: ticker.ask.toString(),
    ts: ticker.timestamp.toString(),
  };
}

main().catch((err) => {
  console.error("❌ Failed to start market data server:", err);
  process.exit(1);
});
