/**
 * Position & Portfolio Routes
 *
 * Perpetual futures position management endpoints.
 *
 * GET  /positions              - List all user positions
 * GET  /positions/:symbol      - Get position for symbol
 * POST /positions/:symbol/close - Close a position
 * GET  /portfolio              - Portfolio summary
 * GET  /funding-history        - User funding payment history
 */

import { Elysia, t } from "elysia";
import type { DatabaseService, AuthService, TradeSettlementService } from "@dotmx/shared";
import { toInternalSymbol } from "@dotmx/shared";
import type { GatewayAdapter } from "@dotmx/gateway";

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

function requireUser(ctx: { user: AuthUser | null }): AuthUser {
  if (!ctx.user) throw new Error("Authentication required");
  return ctx.user;
}

export function createPositionRoutes(
  db: DatabaseService,
  authService?: AuthService,
  gateway?: GatewayAdapter,
  settlementService?: TradeSettlementService
) {
  return new Elysia({ prefix: "/v1" })
    .derive(async ({ headers, ...ctx }) => {
      // Support API key auth (set by apiKeyPlugin upstream)
      const apiKeyUser = (ctx as any).api_key_user as AuthUser | undefined;
      if (apiKeyUser) return { user: apiKeyUser as AuthUser | null };

      // Fall back to JWT Bearer token
      const authHeader = headers.authorization || headers.Authorization;
      if (!authHeader?.startsWith("Bearer ")) return { user: null as AuthUser | null };
      try {
        const token = authHeader.substring(7);
        const jwt = authService
          ? await authService.verifyToken(token)
          : JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
        const user = await db.queryOne<AuthUser>(
          `SELECT id, email, role FROM users WHERE id = $1 AND deleted_at IS NULL AND status = 'active'`,
          [jwt.sub]
        );
        return { user: user ?? null };
      } catch {
        return { user: null as AuthUser | null };
      }
    })

    // ─── List All Positions ──────────────────────────────────────────────
    .get(
      "/positions",
      async ({ user, set }) => {
        const currentUser = requireUser({ user });
        if (!currentUser) {
          set.status = 401;
          return { error: "Authentication required" };
        }

        try {
          const positions = await db.query<{
            id: string;
            user_id: string;
            symbol: string;
            side: string;
            size: string;
            entry_price: string;
            leverage: number;
            liquidation_price: string | null;
            margin: string;
            unrealized_pnl: string;
            realized_pnl: string;
            opened_at: string;
            updated_at: string;
          }>(
            `SELECT id, user_id, symbol, side, size, entry_price, leverage,
                    liquidation_price, margin, unrealized_pnl, realized_pnl,
                    opened_at, updated_at
             FROM positions
             WHERE user_id = $1 AND status = 'open'
             ORDER BY opened_at DESC`,
            [currentUser.id]
          );

          return {
            positions: (positions ?? []).map((p) => ({
              id: p.id,
              symbol: p.symbol,
              side: p.side,
              size: parseFloat(p.size),
              entryPrice: parseFloat(p.entry_price),
              leverage: p.leverage,
              liquidationPrice: p.liquidation_price ? parseFloat(p.liquidation_price) : null,
              margin: parseFloat(p.margin),
              unrealizedPnl: parseFloat(p.unrealized_pnl),
              realizedPnl: parseFloat(p.realized_pnl),
              openedAt: p.opened_at,
              updatedAt: p.updated_at,
            })),
          };
        } catch (error) {
          console.error("Failed to fetch positions:", error);
          return { positions: [] };
        }
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["positions"],
          summary: "List all open positions",
          description: "Get all open perpetual futures positions for the authenticated user",
        },
      }
    )

    // ─── Get Position for Symbol ─────────────────────────────────────────
    .get(
      "/positions/:symbol",
      async ({ params, user, set }) => {
        const currentUser = requireUser({ user });
        if (!currentUser) {
          set.status = 401;
          return { error: "Authentication required" };
        }

        try {
          const symbol = toInternalSymbol(params.symbol);
          const position = await db.queryOne<{
            id: string;
            user_id: string;
            symbol: string;
            side: string;
            size: string;
            entry_price: string;
            leverage: number;
            liquidation_price: string | null;
            margin: string;
            unrealized_pnl: string;
            realized_pnl: string;
            funding_accumulated: string;
            opened_at: string;
            updated_at: string;
          }>(
            `SELECT id, user_id, symbol, side, size, entry_price, leverage,
                    liquidation_price, margin, unrealized_pnl, realized_pnl,
                    COALESCE(funding_accumulated, '0') as funding_accumulated,
                    opened_at, updated_at
             FROM positions
             WHERE user_id = $1 AND symbol = $2 AND status = 'open'`,
            [currentUser.id, symbol]
          );

          if (!position) {
            return { position: null };
          }

          return {
            position: {
              id: position.id,
              symbol: position.symbol,
              side: position.side,
              size: parseFloat(position.size),
              entryPrice: parseFloat(position.entry_price),
              leverage: position.leverage,
              liquidationPrice: position.liquidation_price
                ? parseFloat(position.liquidation_price)
                : null,
              margin: parseFloat(position.margin),
              unrealizedPnl: parseFloat(position.unrealized_pnl),
              realizedPnl: parseFloat(position.realized_pnl),
              fundingAccumulated: parseFloat(position.funding_accumulated),
              openedAt: position.opened_at,
              updatedAt: position.updated_at,
            },
          };
        } catch (error) {
          console.error("Failed to fetch position:", error);
          return { position: null, error: "Failed to fetch position" };
        }
      },
      {
        params: t.Object({
          symbol: t.String({ description: "Trading pair symbol (e.g., BTC-USDT)" }),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["positions"],
          summary: "Get position for symbol",
          description: "Get the open position for a specific trading pair",
        },
      }
    )

    // ─── Close Position ──────────────────────────────────────────────────
    .post(
      "/positions/:symbol/close",
      async ({ params, body, user, set }) => {
        const currentUser = requireUser({ user });
        if (!currentUser) {
          set.status = 401;
          return { error: "Authentication required" };
        }

        try {
          // Find open position
          const symbol = toInternalSymbol(params.symbol);
          const position = await db.queryOne<{
            id: string;
            side: string;
            size: string;
          }>(
            `SELECT id, side, size FROM positions
             WHERE user_id = $1 AND symbol = $2 AND status = 'open'`,
            [currentUser.id, symbol]
          );

          if (!position) {
            set.status = 404;
            return { error: "No open position found" };
          }

          // Submit a market order in the opposite direction to close
          const closeSide = position.side === "LONG" ? "SELL" : "BUY";
          const closeSize = body?.quantity ?? Math.abs(parseFloat(position.size));

          // Submit real close order via gateway
          if (gateway) {
            const result = await gateway.placeOrder({
              userId: currentUser.id,
              symbol,
              side: closeSide as "BUY" | "SELL",
              type: "MARKET",
              quantity: closeSize,
            });

            if (!result.success) {
              set.status = 400;
              return { error: result.error ?? "Failed to submit close order" };
            }

            return {
              success: true,
              message: "Position close order submitted",
              orderId: result.orderId,
              symbol,
              side: closeSide,
              quantity: closeSize,
              type: "MARKET",
            };
          }

          // Fallback: no gateway — record close intent in DB
          await db.execute(
            `UPDATE positions SET status = 'closing', updated_at = NOW()
             WHERE id = $1 AND user_id = $2`,
            [position.id, currentUser.id]
          );

          return {
            success: true,
            message: "Position close order submitted",
            orderId: `close-${position.id}`,
            symbol,
            side: closeSide,
            quantity: closeSize,
            type: "MARKET",
          };
        } catch (error) {
          console.error("Failed to close position:", error);
          set.status = 500;
          return { error: "Failed to close position" };
        }
      },
      {
        params: t.Object({
          symbol: t.String({ description: "Trading pair symbol" }),
        }),
        body: t.Optional(
          t.Object({
            quantity: t.Optional(t.Number({ description: "Partial close quantity (default: full)" })),
          })
        ),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["positions"],
          summary: "Close a position",
          description: "Submit a market order to close an open position. Optionally specify quantity for partial close.",
        },
      }
    )

    // ─── Portfolio Summary ───────────────────────────────────────────────
    .get(
      "/portfolio",
      async ({ user, set }) => {
        const currentUser = requireUser({ user });
        if (!currentUser) {
          set.status = 401;
          return { error: "Authentication required" };
        }

        try {
          // Get balances
          const balances = await db.query<{
            asset: string;
            available: string;
            locked: string;
            pending: string;
          }>(
            `SELECT asset,
                    COALESCE(available, '0') as available,
                    COALESCE(locked, '0') as locked,
                    COALESCE(pending, '0') as pending
             FROM user_balances
             WHERE user_id = $1`,
            [currentUser.id]
          );

          // Get open positions
          const positions = await db.query<{
            symbol: string;
            side: string;
            size: string;
            entry_price: string;
            leverage: number;
            margin: string;
            unrealized_pnl: string;
            realized_pnl: string;
          }>(
            `SELECT symbol, side, size, entry_price, leverage, margin,
                    unrealized_pnl, realized_pnl
             FROM positions
             WHERE user_id = $1 AND status = 'open'`,
            [currentUser.id]
          );

          // Calculate totals
          const totalBalance = (balances ?? []).reduce(
            (acc, b) => acc + parseFloat(b.available) + parseFloat(b.locked),
            0
          );
          const totalMargin = (positions ?? []).reduce(
            (acc, p) => acc + parseFloat(p.margin),
            0
          );
          const totalUnrealizedPnl = (positions ?? []).reduce(
            (acc, p) => acc + parseFloat(p.unrealized_pnl),
            0
          );
          const totalRealizedPnl = (positions ?? []).reduce(
            (acc, p) => acc + parseFloat(p.realized_pnl),
            0
          );

          return {
            userId: currentUser.id,
            totalBalance,
            availableBalance: totalBalance - totalMargin,
            totalMarginUsed: totalMargin,
            totalUnrealizedPnl,
            totalRealizedPnl,
            marginLevel: totalMargin > 0 ? totalBalance / totalMargin : null,
            positions: (positions ?? []).map((p) => ({
              symbol: p.symbol,
              side: p.side,
              size: parseFloat(p.size),
              entryPrice: parseFloat(p.entry_price),
              leverage: p.leverage,
              margin: parseFloat(p.margin),
              unrealizedPnl: parseFloat(p.unrealized_pnl),
            })),
            balances: (balances ?? []).map((b) => ({
              asset: b.asset,
              available: parseFloat(b.available),
              locked: parseFloat(b.locked),
              pending: parseFloat(b.pending),
            })),
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          console.error("Failed to fetch portfolio:", error);
          set.status = 500;
          return { error: "Failed to fetch portfolio summary" };
        }
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["portfolio"],
          summary: "Portfolio summary",
          description: "Get complete portfolio overview including balances, positions, margin usage, and P&L",
        },
      }
    )

    // ─── Funding Payment History ─────────────────────────────────────────
    .get(
      "/funding-history",
      async ({ query, user, set }) => {
        const currentUser = requireUser({ user });
        if (!currentUser) {
          set.status = 401;
          return { error: "Authentication required" };
        }

        try {
          const limit = query.limit ?? 50;
          const offset = query.offset ?? 0;

          const payments = await db.query<{
            id: string;
            symbol: string;
            side: string;
            position_size: string;
            funding_rate: string;
            payment: string;
            timestamp: string;
          }>(
            `SELECT id, symbol, side, position_size, funding_rate, payment, timestamp
             FROM funding_payments
             WHERE user_id = $1
             ${query.symbol ? "AND symbol = $2" : ""}
             ORDER BY timestamp DESC
             LIMIT ${limit} OFFSET ${offset}`,
            query.symbol ? [currentUser.id, toInternalSymbol(query.symbol)] : [currentUser.id]
          );

          return {
            payments: (payments ?? []).map((p) => ({
              id: p.id,
              symbol: p.symbol,
              side: p.side,
              positionSize: parseFloat(p.position_size),
              fundingRate: parseFloat(p.funding_rate),
              payment: parseFloat(p.payment),
              timestamp: p.timestamp,
            })),
            pagination: { limit, offset },
          };
        } catch (error) {
          console.error("Failed to fetch funding history:", error);
          return { payments: [], pagination: { limit: 50, offset: 0 } };
        }
      },
      {
        query: t.Object({
          symbol: t.Optional(t.String({ description: "Filter by symbol" })),
          limit: t.Optional(t.Numeric({ description: "Limit (default 50)" })),
          offset: t.Optional(t.Numeric({ description: "Offset (default 0)" })),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["positions"],
          summary: "Funding payment history",
          description: "Get historical funding payments for the authenticated user",
        },
      }
    );
}
