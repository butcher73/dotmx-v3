/**
 * System Metrics Routes
 *
 * Admin endpoints for system monitoring and metrics.
 *
 * GET /metrics              - System overview metrics
 * GET /metrics/trading      - Trading metrics (volume, orders, trades)
 * GET /metrics/positions    - Position/risk metrics
 * GET /metrics/system       - System health metrics (DB, memory, uptime)
 * GET /metrics/funding      - Funding rate metrics
 */

import { Elysia, t } from "elysia";
import type { DatabaseService } from "@dotmx/shared";

const SERVER_START_TIME = Date.now();

export function createMetricsRoutes(db: DatabaseService) {
  return new Elysia({ prefix: "/metrics" })

    // ─── Overview Metrics ────────────────────────────────────────────────
    .get(
      "/",
      async () => {
        try {
          const [trading, positions, system] = await Promise.all([
            getTradingMetrics(db),
            getPositionMetrics(db),
            getSystemMetrics(db),
          ]);

          return {
            timestamp: new Date().toISOString(),
            trading,
            positions,
            system,
          };
        } catch (error) {
          console.error("Failed to fetch metrics:", error);
          return {
            timestamp: new Date().toISOString(),
            error: "Failed to fetch metrics",
          };
        }
      },
      {
        detail: {
          tags: ["metrics"],
          summary: "System overview metrics",
          description: "Comprehensive system metrics dashboard",
        },
      }
    )

    // ─── Trading Metrics ─────────────────────────────────────────────────
    .get(
      "/trading",
      async ({ query }) => {
        try {
          const period = query.period ?? "24h";
          const interval = periodToInterval(period);

          const [volume, orderCounts, recentTrades] = await Promise.all([
            db.query<{
              symbol: string;
              trade_count: string;
              total_volume: string;
              total_quote_volume: string;
            }>(
              `SELECT symbol,
                      COUNT(*) as trade_count,
                      COALESCE(SUM(quantity), 0) as total_volume,
                      COALESCE(SUM(price * quantity), 0) as total_quote_volume
               FROM trades
               WHERE created_at >= NOW() - INTERVAL '${interval}'
               GROUP BY symbol
               ORDER BY total_quote_volume DESC`
            ),
            db.queryOne<{
              total_orders: string;
              open_orders: string;
              filled_orders: string;
              cancelled_orders: string;
            }>(
              `SELECT 
                  COUNT(*) as total_orders,
                  COUNT(*) FILTER (WHERE status = 'open' OR status = 'NEW' OR status = 'PARTIALLY_FILLED') as open_orders,
                  COUNT(*) FILTER (WHERE status = 'filled' OR status = 'FILLED') as filled_orders,
                  COUNT(*) FILTER (WHERE status = 'cancelled' OR status = 'CANCELED') as cancelled_orders
               FROM orders
               WHERE created_at >= NOW() - INTERVAL '${interval}'`
            ),
            db.query<{
              symbol: string;
              price: string;
              quantity: string;
              created_at: string;
            }>(
              `SELECT symbol, price, quantity, created_at
               FROM trades
               ORDER BY created_at DESC
               LIMIT 10`
            ),
          ]);

          return {
            period,
            volume: (volume ?? []).map((v) => ({
              symbol: v.symbol,
              tradeCount: parseInt(v.trade_count),
              baseVolume: parseFloat(v.total_volume),
              quoteVolume: parseFloat(v.total_quote_volume),
            })),
            orders: orderCounts
              ? {
                  total: parseInt(orderCounts.total_orders),
                  open: parseInt(orderCounts.open_orders),
                  filled: parseInt(orderCounts.filled_orders),
                  cancelled: parseInt(orderCounts.cancelled_orders),
                }
              : { total: 0, open: 0, filled: 0, cancelled: 0 },
            recentTrades: (recentTrades ?? []).map((t) => ({
              symbol: t.symbol,
              price: parseFloat(t.price),
              quantity: parseFloat(t.quantity),
              time: t.created_at,
            })),
          };
        } catch (error) {
          console.error("Failed to fetch trading metrics:", error);
          return { period: "24h", volume: [], orders: {}, recentTrades: [] };
        }
      },
      {
        query: t.Object({
          period: t.Optional(
            t.String({
              description: "Time period: 1h, 4h, 24h, 7d, 30d",
            })
          ),
        }),
        detail: {
          tags: ["metrics"],
          summary: "Trading metrics",
        },
      }
    )

    // ─── Position Metrics ────────────────────────────────────────────────
    .get(
      "/positions",
      async () => {
        try {
          const [positionSummary, topPositions, liquidations] =
            await Promise.all([
              db.query<{
                symbol: string;
                total_positions: string;
                long_count: string;
                short_count: string;
                total_size: string;
                total_margin: string;
                avg_leverage: string;
              }>(
                `SELECT symbol,
                        COUNT(*) as total_positions,
                        COUNT(*) FILTER (WHERE side = 'LONG') as long_count,
                        COUNT(*) FILTER (WHERE side = 'SHORT') as short_count,
                        COALESCE(SUM(ABS(size::numeric)), 0) as total_size,
                        COALESCE(SUM(margin::numeric), 0) as total_margin,
                        COALESCE(AVG(leverage), 1) as avg_leverage
                 FROM positions
                 WHERE status = 'open'
                 GROUP BY symbol
                 ORDER BY total_margin DESC`
              ),
              db.query<{
                user_id: string;
                symbol: string;
                side: string;
                size: string;
                margin: string;
                leverage: number;
                unrealized_pnl: string;
              }>(
                `SELECT user_id, symbol, side, size, margin, leverage, unrealized_pnl
                 FROM positions
                 WHERE status = 'open'
                 ORDER BY ABS(margin::numeric) DESC
                 LIMIT 10`
              ),
              db.queryOne<{
                total_24h: string;
                total_volume: string;
                total_margin_lost: string;
              }>(
                `SELECT 
                    COUNT(*) as total_24h,
                    COALESCE(SUM(ABS(size::numeric * liquidation_price::numeric)), 0) as total_volume,
                    COALESCE(SUM(margin_lost::numeric), 0) as total_margin_lost
                 FROM liquidation_history
                 WHERE timestamp >= NOW() - INTERVAL '24 hours'`
              ),
            ]);

          return {
            bySymbol: (positionSummary ?? []).map((p) => ({
              symbol: p.symbol,
              totalPositions: parseInt(p.total_positions),
              longCount: parseInt(p.long_count),
              shortCount: parseInt(p.short_count),
              totalSize: parseFloat(p.total_size),
              totalMargin: parseFloat(p.total_margin),
              avgLeverage: parseFloat(p.avg_leverage),
            })),
            topPositions: (topPositions ?? []).map((p) => ({
              userId: p.user_id,
              symbol: p.symbol,
              side: p.side,
              size: parseFloat(p.size),
              margin: parseFloat(p.margin),
              leverage: p.leverage,
              unrealizedPnl: parseFloat(p.unrealized_pnl),
            })),
            liquidations24h: liquidations
              ? {
                  count: parseInt(liquidations.total_24h),
                  totalVolume: parseFloat(liquidations.total_volume),
                  totalMarginLost: parseFloat(liquidations.total_margin_lost),
                }
              : { count: 0, totalVolume: 0, totalMarginLost: 0 },
          };
        } catch (error) {
          console.error("Failed to fetch position metrics:", error);
          return { bySymbol: [], topPositions: [], liquidations24h: {} };
        }
      },
      {
        detail: {
          tags: ["metrics"],
          summary: "Position & risk metrics",
        },
      }
    )

    // ─── System Health ───────────────────────────────────────────────────
    .get(
      "/system",
      async () => {
        try {
          const system = await getSystemMetrics(db);
          return system;
        } catch (error) {
          console.error("Failed to fetch system metrics:", error);
          return { error: "Failed to fetch system metrics" };
        }
      },
      {
        detail: {
          tags: ["metrics"],
          summary: "System health metrics",
        },
      }
    )

    // ─── Funding Metrics ─────────────────────────────────────────────────
    .get(
      "/funding",
      async () => {
        try {
          const [currentRates, paymentSummary, insuranceFund] =
            await Promise.all([
              db.query<{
                symbol: string;
                funding_rate: string;
                mark_price: string;
                timestamp: string;
              }>(
                `SELECT DISTINCT ON (symbol)
                        symbol, funding_rate, mark_price, timestamp
                 FROM funding_rate_history
                 ORDER BY symbol, timestamp DESC`
              ),
              db.queryOne<{
                total_payments: string;
                total_paid: string;
                total_received: string;
                unique_users: string;
              }>(
                `SELECT
                    COUNT(*) as total_payments,
                    COALESCE(SUM(CASE WHEN payment < 0 THEN ABS(payment) ELSE 0 END), 0) as total_paid,
                    COALESCE(SUM(CASE WHEN payment > 0 THEN payment ELSE 0 END), 0) as total_received,
                    COUNT(DISTINCT user_id) as unique_users
                 FROM funding_payments
                 WHERE timestamp >= NOW() - INTERVAL '24 hours'`
              ),
              db.queryOne<{
                balance: string;
                updated_at: string;
              }>(
                `SELECT balance, updated_at FROM insurance_fund WHERE asset = 'USDT'`
              ),
            ]);

          return {
            currentRates: (currentRates ?? []).map((r) => ({
              symbol: r.symbol,
              fundingRate: parseFloat(r.funding_rate),
              markPrice: parseFloat(r.mark_price),
              timestamp: r.timestamp,
            })),
            payments24h: paymentSummary
              ? {
                  totalPayments: parseInt(paymentSummary.total_payments),
                  totalPaid: parseFloat(paymentSummary.total_paid),
                  totalReceived: parseFloat(paymentSummary.total_received),
                  uniqueUsers: parseInt(paymentSummary.unique_users),
                }
              : {
                  totalPayments: 0,
                  totalPaid: 0,
                  totalReceived: 0,
                  uniqueUsers: 0,
                },
            insuranceFund: insuranceFund
              ? {
                  balance: parseFloat(insuranceFund.balance),
                  updatedAt: insuranceFund.updated_at,
                }
              : { balance: 0, updatedAt: null },
          };
        } catch (error) {
          console.error("Failed to fetch funding metrics:", error);
          return { currentRates: [], payments24h: {}, insuranceFund: {} };
        }
      },
      {
        detail: {
          tags: ["metrics"],
          summary: "Funding rate metrics",
        },
      }
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getTradingMetrics(db: DatabaseService) {
  const result = await db.queryOne<{
    total_trades_24h: string;
    total_volume_24h: string;
    total_orders_24h: string;
    open_orders: string;
  }>(
    `SELECT
        (SELECT COUNT(*) FROM trades WHERE created_at >= NOW() - INTERVAL '24 hours') as total_trades_24h,
        (SELECT COALESCE(SUM(price::numeric * quantity::numeric), 0) FROM trades WHERE created_at >= NOW() - INTERVAL '24 hours') as total_volume_24h,
        (SELECT COUNT(*) FROM orders WHERE created_at >= NOW() - INTERVAL '24 hours') as total_orders_24h,
        (SELECT COUNT(*) FROM orders WHERE status IN ('open', 'NEW', 'PARTIALLY_FILLED')) as open_orders`
  );

  return result
    ? {
        trades24h: parseInt(result.total_trades_24h),
        volume24h: parseFloat(result.total_volume_24h),
        orders24h: parseInt(result.total_orders_24h),
        openOrders: parseInt(result.open_orders),
      }
    : { trades24h: 0, volume24h: 0, orders24h: 0, openOrders: 0 };
}

async function getPositionMetrics(db: DatabaseService) {
  const result = await db.queryOne<{
    total_positions: string;
    total_margin: string;
    liquidations_24h: string;
  }>(
    `SELECT
        (SELECT COUNT(*) FROM positions WHERE status = 'open') as total_positions,
        (SELECT COALESCE(SUM(margin::numeric), 0) FROM positions WHERE status = 'open') as total_margin,
        (SELECT COUNT(*) FROM liquidation_history WHERE timestamp >= NOW() - INTERVAL '24 hours') as liquidations_24h`
  );

  return result
    ? {
        openPositions: parseInt(result.total_positions),
        totalMarginLocked: parseFloat(result.total_margin),
        liquidations24h: parseInt(result.liquidations_24h),
      }
    : { openPositions: 0, totalMarginLocked: 0, liquidations24h: 0 };
}

async function getSystemMetrics(db: DatabaseService) {
  const memUsage = process.memoryUsage();
  const uptimeMs = Date.now() - SERVER_START_TIME;

  let dbStatus = "unknown";
  let dbLatencyMs = 0;
  try {
    const start = Date.now();
    await db.queryOne("SELECT 1");
    dbLatencyMs = Date.now() - start;
    dbStatus = "healthy";
  } catch {
    dbStatus = "unhealthy";
  }

  let userCount = 0;
  try {
    const r = await db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM users`
    );
    userCount = r ? parseInt(r.count) : 0;
  } catch {}

  return {
    uptime: {
      seconds: Math.floor(uptimeMs / 1000),
      human: formatDuration(uptimeMs),
    },
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      unit: "MB",
    },
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
    },
    runtime: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid,
    },
    users: {
      total: userCount,
    },
    timestamp: new Date().toISOString(),
  };
}

function periodToInterval(period: string): string {
  const map: Record<string, string> = {
    "1h": "1 hour",
    "4h": "4 hours",
    "24h": "24 hours",
    "7d": "7 days",
    "30d": "30 days",
  };
  return map[period] ?? "24 hours";
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}
