/**
 * Perpetual Market Data Routes
 *
 * Public endpoints for perpetual futures market data.
 *
 * GET /market/funding-rate/:symbol     - Current funding rate
 * GET /market/funding-rates            - All funding rates
 * GET /market/funding-history/:symbol  - Historical funding rates
 * GET /market/mark-price/:symbol       - Mark price for symbol
 * GET /market/mark-prices              - All mark prices
 * GET /market/liquidations             - Recent liquidation events
 * GET /market/open-interest/:symbol    - Open interest
 */

import { Elysia, t } from "elysia";
import type { DatabaseService } from "@dotmx/shared";
import { toInternalSymbol } from "@dotmx/shared";

export function createPerpetualMarketRoutes(db: DatabaseService) {
  return new Elysia({ prefix: "/v1/market" })

    // ─── Current Funding Rate ────────────────────────────────────────────
    .get(
      "/funding-rate/:symbol",
      async ({ params }) => {
        try {
          const rate = await db.queryOne<{
            symbol: string;
            funding_rate: string;
            mark_price: string;
            index_price: string;
            next_funding_time: string;
            funding_timestamp: string;
          }>(
            `SELECT symbol, funding_rate, mark_price, index_price,
                    next_funding_time, funding_timestamp
             FROM funding_rate_history
             WHERE symbol = $1
             ORDER BY funding_timestamp DESC
             LIMIT 1`,
            [toInternalSymbol(params.symbol)]
          );

          if (!rate) {
            // Return default if no history yet
            return {
              symbol: toInternalSymbol(params.symbol),
              fundingRate: 0,
              markPrice: 0,
              indexPrice: 0,
              nextFundingTime: getNextFundingTime(),
              timestamp: new Date().toISOString(),
            };
          }

          return {
            symbol: rate.symbol,
            fundingRate: parseFloat(rate.funding_rate),
            markPrice: parseFloat(rate.mark_price),
            indexPrice: parseFloat(rate.index_price),
            nextFundingTime: rate.next_funding_time,
            timestamp: rate.funding_timestamp,
          };
        } catch (error) {
          console.error("Failed to fetch funding rate:", error);
          return {
            symbol: toInternalSymbol(params.symbol),
            fundingRate: 0,
            markPrice: 0,
            indexPrice: 0,
            nextFundingTime: getNextFundingTime(),
            timestamp: new Date().toISOString(),
          };
        }
      },
      {
        params: t.Object({
          symbol: t.String({ description: "Trading pair symbol" }),
        }),
        detail: {
          tags: ["perpetual"],
          summary: "Get current funding rate",
          description: "Get the current funding rate for a perpetual futures symbol",
        },
      }
    )

    // ─── All Funding Rates ───────────────────────────────────────────────
    .get(
      "/funding-rates",
      async () => {
        try {
          const rates = await db.query<{
            symbol: string;
            funding_rate: string;
            mark_price: string;
            index_price: string;
            next_funding_time: string;
            timestamp: string;
          }>(
            `SELECT DISTINCT ON (symbol)
                    symbol, funding_rate, mark_price, index_price,
                    next_funding_time, timestamp
             FROM funding_rate_history
             ORDER BY symbol, timestamp DESC`
          );

          return {
            rates: (rates ?? []).map((r) => ({
              symbol: r.symbol,
              fundingRate: parseFloat(r.funding_rate),
              markPrice: parseFloat(r.mark_price),
              indexPrice: parseFloat(r.index_price),
              nextFundingTime: r.next_funding_time,
              timestamp: r.timestamp,
            })),
          };
        } catch (error) {
          console.error("Failed to fetch funding rates:", error);
          return { rates: [] };
        }
      },
      {
        detail: {
          tags: ["perpetual"],
          summary: "Get all funding rates",
          description: "Get current funding rates for all perpetual futures symbols",
        },
      }
    )

    // ─── Historical Funding Rates ────────────────────────────────────────
    .get(
      "/funding-history/:symbol",
      async ({ params, query }) => {
        try {
          const limit = query.limit ?? 100;
          const offset = query.offset ?? 0;

          const history = await db.query<{
            symbol: string;
            funding_rate: string;
            mark_price: string;
            index_price: string;
            open_interest: string | null;
            timestamp: string;
          }>(
            `SELECT symbol, funding_rate, mark_price, index_price,
                    open_interest, timestamp
             FROM funding_rate_history
             WHERE symbol = $1
             ${query.startTime ? "AND timestamp >= $3" : ""}
             ${query.endTime ? `AND timestamp <= $${query.startTime ? "4" : "3"}` : ""}
             ORDER BY timestamp DESC
             LIMIT $2 OFFSET ${offset}`,
            [toInternalSymbol(params.symbol), limit, ...(query.startTime ? [query.startTime] : []), ...(query.endTime ? [query.endTime] : [])]
          );

          return {
            symbol: toInternalSymbol(params.symbol),
            history: (history ?? []).map((h) => ({
              fundingRate: parseFloat(h.funding_rate),
              markPrice: parseFloat(h.mark_price),
              indexPrice: parseFloat(h.index_price),
              openInterest: h.open_interest ? parseFloat(h.open_interest) : null,
              timestamp: h.timestamp,
            })),
            pagination: { limit, offset },
          };
        } catch (error) {
          console.error("Failed to fetch funding history:", error);
          return {
            symbol: toInternalSymbol(params.symbol),
            history: [],
            pagination: { limit: 100, offset: 0 },
          };
        }
      },
      {
        params: t.Object({
          symbol: t.String({ description: "Trading pair symbol" }),
        }),
        query: t.Object({
          limit: t.Optional(t.Numeric({ description: "Limit (default 100)" })),
          offset: t.Optional(t.Numeric({ description: "Offset" })),
          startTime: t.Optional(t.String({ description: "Start time (ISO 8601)" })),
          endTime: t.Optional(t.String({ description: "End time (ISO 8601)" })),
        }),
        detail: {
          tags: ["perpetual"],
          summary: "Historical funding rates",
          description: "Get historical funding rate data for a perpetual symbol",
        },
      }
    )

    // ─── Mark Price ──────────────────────────────────────────────────────
    .get(
      "/mark-price/:symbol",
      async ({ params }) => {
        try {
          const data = await db.queryOne<{
            symbol: string;
            mark_price: string;
            index_price: string;
            last_funding_rate: string;
            next_funding_time: string;
            timestamp: string;
          }>(
            `SELECT symbol, mark_price, index_price, 
                    funding_rate as last_funding_rate,
                    next_funding_time, timestamp
             FROM funding_rate_history
             WHERE symbol = $1
             ORDER BY timestamp DESC
             LIMIT 1`,
            [toInternalSymbol(params.symbol)]
          );

          if (!data) {
            return {
              symbol: toInternalSymbol(params.symbol),
              markPrice: 0,
              indexPrice: 0,
              lastFundingRate: 0,
              nextFundingTime: getNextFundingTime(),
              timestamp: new Date().toISOString(),
            };
          }

          return {
            symbol: data.symbol,
            markPrice: parseFloat(data.mark_price),
            indexPrice: parseFloat(data.index_price),
            lastFundingRate: parseFloat(data.last_funding_rate),
            nextFundingTime: data.next_funding_time,
            timestamp: data.timestamp,
          };
        } catch (error) {
          console.error("Failed to fetch mark price:", error);
          return {
            symbol: toInternalSymbol(params.symbol),
            markPrice: 0,
            indexPrice: 0,
            lastFundingRate: 0,
            nextFundingTime: getNextFundingTime(),
            timestamp: new Date().toISOString(),
          };
        }
      },
      {
        params: t.Object({
          symbol: t.String({ description: "Trading pair symbol" }),
        }),
        detail: {
          tags: ["perpetual"],
          summary: "Get mark price",
          description: "Get the current mark price, index price, and funding rate for a symbol",
        },
      }
    )

    // ─── All Mark Prices ─────────────────────────────────────────────────
    .get(
      "/mark-prices",
      async () => {
        try {
          const prices = await db.query<{
            symbol: string;
            mark_price: string;
            index_price: string;
            funding_rate: string;
            timestamp: string;
          }>(
            `SELECT DISTINCT ON (symbol)
                    symbol, mark_price, index_price, funding_rate, timestamp
             FROM funding_rate_history
             ORDER BY symbol, timestamp DESC`
          );

          return {
            prices: (prices ?? []).map((p) => ({
              symbol: p.symbol,
              markPrice: parseFloat(p.mark_price),
              indexPrice: parseFloat(p.index_price),
              fundingRate: parseFloat(p.funding_rate),
              timestamp: p.timestamp,
            })),
          };
        } catch (error) {
          console.error("Failed to fetch mark prices:", error);
          return { prices: [] };
        }
      },
      {
        detail: {
          tags: ["perpetual"],
          summary: "Get all mark prices",
          description: "Get current mark prices for all perpetual futures symbols",
        },
      }
    )

    // ─── Liquidation Feed ────────────────────────────────────────────────
    .get(
      "/liquidations",
      async ({ query }) => {
        try {
          const limit = query.limit ?? 50;

          const liquidations = await db.query<{
            id: string;
            symbol: string;
            side: string;
            size: string;
            entry_price: string;
            liquidation_price: string;
            margin_lost: string;
            insurance_fund_contribution: string;
            timestamp: string;
          }>(
            `SELECT id, symbol, side, size, entry_price, liquidation_price,
                    margin_lost, insurance_fund_contribution, timestamp
             FROM liquidation_history
             ${query.symbol ? "WHERE symbol = $2" : ""}
             ORDER BY timestamp DESC
             LIMIT $1`,
            query.symbol ? [limit, query.symbol] : [limit]
          );

          return {
            liquidations: (liquidations ?? []).map((l) => ({
              id: l.id,
              symbol: l.symbol,
              side: l.side,
              size: parseFloat(l.size),
              entryPrice: parseFloat(l.entry_price),
              liquidationPrice: parseFloat(l.liquidation_price),
              marginLost: parseFloat(l.margin_lost),
              insuranceFund: parseFloat(l.insurance_fund_contribution),
              timestamp: l.timestamp,
            })),
          };
        } catch (error) {
          console.error("Failed to fetch liquidations:", error);
          return { liquidations: [] };
        }
      },
      {
        query: t.Object({
          symbol: t.Optional(t.String({ description: "Filter by symbol" })),
          limit: t.Optional(t.Numeric({ description: "Limit (default 50)" })),
        }),
        detail: {
          tags: ["perpetual"],
          summary: "Recent liquidations",
          description: "Get recent liquidation events (public feed)",
        },
      }
    )

    // ─── Open Interest ───────────────────────────────────────────────────
    .get(
      "/open-interest/:symbol",
      async ({ params }) => {
        try {
          // Sum all open positions for the symbol
          const oi = await db.queryOne<{
            long_oi: string;
            short_oi: string;
            total_positions: string;
          }>(
            `SELECT 
                COALESCE(SUM(CASE WHEN side = 'LONG' THEN ABS(size::numeric) ELSE 0 END), 0) as long_oi,
                COALESCE(SUM(CASE WHEN side = 'SHORT' THEN ABS(size::numeric) ELSE 0 END), 0) as short_oi,
                COUNT(*) as total_positions
             FROM positions
             WHERE symbol = $1 AND status = 'open'`,
            [toInternalSymbol(params.symbol)]
          );

          return {
            symbol: toInternalSymbol(params.symbol),
            openInterest: oi
              ? parseFloat(oi.long_oi) + parseFloat(oi.short_oi)
              : 0,
            longOpenInterest: oi ? parseFloat(oi.long_oi) : 0,
            shortOpenInterest: oi ? parseFloat(oi.short_oi) : 0,
            totalPositions: oi ? parseInt(oi.total_positions) : 0,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          console.error("Failed to fetch open interest:", error);
          return {
            symbol: toInternalSymbol(params.symbol),
            openInterest: 0,
            longOpenInterest: 0,
            shortOpenInterest: 0,
            totalPositions: 0,
            timestamp: new Date().toISOString(),
          };
        }
      },
      {
        params: t.Object({
          symbol: t.String({ description: "Trading pair symbol" }),
        }),
        detail: {
          tags: ["perpetual"],
          summary: "Open interest",
          description: "Get open interest data for a perpetual futures symbol",
        },
      }
    );
}

/** Calculate next 8-hour funding time (00:00, 08:00, 16:00 UTC) */
function getNextFundingTime(): string {
  const now = new Date();
  const hour = now.getUTCHours();
  let nextHour: number;
  if (hour < 8) nextHour = 8;
  else if (hour < 16) nextHour = 16;
  else nextHour = 24; // midnight next day

  const next = new Date(now);
  next.setUTCHours(nextHour % 24, 0, 0, 0);
  if (nextHour === 24) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}
