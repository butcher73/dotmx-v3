/**
 * Market Data Routes
 *
 * Public market data endpoints.
 *
 * GET /depth       - L2 orderbook snapshot
 * GET /ticker/24hr - 24h ticker stats
 * GET /trades      - Recent public trades
 * GET /symbols     - Available trading pairs
 */

import { Elysia, t } from "elysia";
import type { DatabaseService } from "@dotmx/shared";

/**
 * Legacy static export (kept for backwards compat)
 * Includes mock implementations for testing
 */
export const marketDataRoutes = new Elysia({ prefix: "/v1" })
  .get("/ping", () => ({ status: "ok" }))
  .get(
    "/depth",
    ({ query, set }) => {
      if (!query.symbol) {
        set.status = 422;
        return { error: "symbol parameter is required" };
      }
      return {
        symbol: query.symbol,
        bids: [],
        asks: [],
        lastUpdateId: Date.now(),
        timestamp: Date.now(),
      };
    },
    {
      query: t.Object({
        symbol: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
      }),
    }
  )
  .get(
    "/ticker/24hr",
    ({ query }) => ({
      symbol: query.symbol || "BTC-USD",
      lastPrice: "0",
      highPrice: "0",
      lowPrice: "0",
      volume: "0",
      quoteVolume: "0",
      priceChange: "0",
      priceChangePercent: "0",
      trades: 0,
    }),
    {
      query: t.Object({
        symbol: t.Optional(t.String()),
      }),
    }
  );

/**
 * Create market data routes wired to DB
 */
export function createMarketDataRoutes(db: DatabaseService) {
  return new Elysia({ prefix: "/api/v1/market" })

    // ─── Orderbook Depth ──────────────────────────────────────────────────
    .get(
      "/depth",
      async ({ query, set }) => {
        const limit = query.limit ?? 20;

        try {
          // Fetch best bids from open orders
          const bids = await db.query<{
            price: string;
            total_qty: string;
            order_count: string;
          }>(
            `SELECT price, SUM(quantity - COALESCE(filled_quantity, 0)) as total_qty,
                    COUNT(*) as order_count
             FROM orders
             WHERE symbol = $1 AND side = 'BUY' AND status IN ('NEW', 'PARTIALLY_FILLED')
             GROUP BY price
             ORDER BY price DESC
             LIMIT $2`,
            [query.symbol, limit]
          );

          // Fetch best asks from open orders
          const asks = await db.query<{
            price: string;
            total_qty: string;
            order_count: string;
          }>(
            `SELECT price, SUM(quantity - COALESCE(filled_quantity, 0)) as total_qty,
                    COUNT(*) as order_count
             FROM orders
             WHERE symbol = $1 AND side = 'SELL' AND status IN ('NEW', 'PARTIALLY_FILLED')
             GROUP BY price
             ORDER BY price ASC
             LIMIT $2`,
            [query.symbol, limit]
          );

          return {
            symbol: query.symbol,
            bids: (bids ?? []).map((b) => [
              parseFloat(b.price),
              parseFloat(b.total_qty),
              parseInt(b.order_count),
            ]),
            asks: (asks ?? []).map((a) => [
              parseFloat(a.price),
              parseFloat(a.total_qty),
              parseInt(a.order_count),
            ]),
            timestamp: Date.now(),
          };
        } catch (error) {
          console.error("Failed to fetch orderbook depth:", error);
          return {
            symbol: query.symbol,
            bids: [],
            asks: [],
            timestamp: Date.now(),
          };
        }
      },
      {
        query: t.Object({
          symbol: t.String({ description: "Trading pair (e.g., BTC-USDT)" }),
          limit: t.Optional(t.Numeric({ description: "Number of price levels (default 20)" })),
        }),
        detail: {
          tags: ["market-data"],
          summary: "Orderbook depth",
          description: "Get L2 orderbook snapshot for a symbol with aggregated price levels",
        },
      }
    )

    // ─── 24h Ticker ───────────────────────────────────────────────────────
    .get(
      "/ticker/24hr",
      async ({ query, set }) => {
        try {
          const conditions = query.symbol ? "AND bt.asset = $1" : "";
          const params = query.symbol ? [query.symbol] : [];

          const tickers = await db.query<{
            symbol: string;
            last_price: string;
            high_24h: string;
            low_24h: string;
            volume_24h: string;
            volume_quote_24h: string;
            first_price: string;
            trade_count: string;
          }>(
            `SELECT bt.asset as symbol,
                    (SELECT bt2.metadata->>'price' FROM balance_transactions bt2 
                     WHERE bt2.asset = bt.asset AND bt2.type IN ('trade_buy', 'trade_sell')
                     ORDER BY bt2.created_at DESC LIMIT 1) as last_price,
                    MAX((bt.metadata->>'price')::numeric) as high_24h,
                    MIN((bt.metadata->>'price')::numeric) as low_24h,
                    SUM(bt.amount) as volume_24h,
                    SUM(bt.amount * (bt.metadata->>'price')::numeric) as volume_quote_24h,
                    (SELECT bt3.metadata->>'price' FROM balance_transactions bt3
                     WHERE bt3.asset = bt.asset AND bt3.type IN ('trade_buy', 'trade_sell')
                     AND bt3.created_at >= NOW() - INTERVAL '24 hours'
                     ORDER BY bt3.created_at ASC LIMIT 1) as first_price,
                    COUNT(*) as trade_count
             FROM balance_transactions bt
             WHERE bt.type IN ('trade_buy', 'trade_sell')
             AND bt.created_at >= NOW() - INTERVAL '24 hours'
             ${conditions}
             GROUP BY bt.asset`,
            params
          );

          const result = (tickers ?? []).map((t) => {
            const lastPrice = parseFloat(t.last_price ?? "0");
            const firstPrice = parseFloat(t.first_price ?? "0");
            const priceChange = lastPrice - firstPrice;
            const priceChangePercent = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;

            return {
              symbol: t.symbol,
              lastPrice: lastPrice.toString(),
              highPrice: (parseFloat(t.high_24h ?? "0")).toString(),
              lowPrice: (parseFloat(t.low_24h ?? "0")).toString(),
              volume: (parseFloat(t.volume_24h ?? "0")).toString(),
              quoteVolume: (parseFloat(t.volume_quote_24h ?? "0")).toString(),
              priceChange: priceChange.toString(),
              priceChangePercent: priceChangePercent.toFixed(2),
              trades: parseInt(t.trade_count),
            };
          });

          // If single symbol was requested, return single object
          if (query.symbol && result.length > 0) {
            return result[0];
          }

          return query.symbol
            ? { symbol: query.symbol, lastPrice: "0", priceChange: "0", priceChangePercent: "0", volume: "0" }
            : result;
        } catch (error) {
          console.error("Failed to fetch 24h ticker:", error);
          return {
            symbol: query.symbol ?? "",
            lastPrice: "0",
            priceChange: "0",
            priceChangePercent: "0",
            volume: "0",
          };
        }
      },
      {
        query: t.Object({
          symbol: t.Optional(t.String({ description: "Filter by symbol (omit for all)" })),
        }),
        detail: {
          tags: ["market-data"],
          summary: "24h ticker statistics",
          description: "Get 24-hour rolling window price change statistics",
        },
      }
    )

    // ─── Recent Public Trades ─────────────────────────────────────────────
    .get(
      "/trades/recent",
      async ({ query, set }) => {
        try {
          const limit = query.limit ?? 50;

          const trades = await db.query<{
            id: string;
            symbol: string;
            price: string;
            quantity: string;
            side: string;
            timestamp: string;
          }>(
            `SELECT bt.id, bt.asset as symbol,
                    bt.metadata->>'price' as price,
                    bt.amount as quantity,
                    CASE WHEN bt.type = 'trade_buy' THEN 'BUY' ELSE 'SELL' END as side,
                    bt.created_at as timestamp
             FROM balance_transactions bt
             WHERE bt.type IN ('trade_buy', 'trade_sell')
             AND bt.asset = $1
             ORDER BY bt.created_at DESC
             LIMIT $2`,
            [query.symbol, limit]
          );

          return {
            trades: (trades ?? []).map((t) => ({
              id: t.id,
              symbol: t.symbol,
              price: parseFloat(t.price ?? "0"),
              quantity: parseFloat(t.quantity),
              side: t.side,
              timestamp: t.timestamp,
            })),
          };
        } catch (error) {
          console.error("Failed to fetch recent trades:", error);
          return { trades: [] };
        }
      },
      {
        query: t.Object({
          symbol: t.String({ description: "Trading pair symbol" }),
          limit: t.Optional(t.Numeric({ description: "Max results (default 50)" })),
        }),
        detail: {
          tags: ["market-data"],
          summary: "Recent trades",
          description: "Get recent public trades for a symbol",
        },
      }
    );
}
