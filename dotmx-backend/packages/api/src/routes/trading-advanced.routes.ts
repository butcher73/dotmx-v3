/**
 * Advanced Trading Routes
 *
 * Extended trading endpoints for leveraged orders, batch operations,
 * and order modification.
 *
 * POST /orders/leverage    - Place leveraged order
 * POST /orders/batch       - Submit batch orders
 * PATCH /orders/:orderId   - Modify an existing order
 * GET  /trades             - Trade history
 * GET  /openOrders         - All open orders
 */

import { Elysia, t } from "elysia";
import type { DatabaseService, AuthService, TradeSettlementService } from "@dotmx/shared";
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

export function createAdvancedTradingRoutes(
  db: DatabaseService,
  gateway: GatewayAdapter,
  settlementService?: TradeSettlementService,
  authService?: AuthService
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

    // ─── Place Leveraged Order ───────────────────────────────────────────
    .post(
      "/orders/leverage",
      async ({ body, user, set }) => {
        const currentUser = requireUser({ user });
        if (!currentUser) {
          set.status = 401;
          return { error: "Authentication required" };
        }

        // Validate leverage
        if (body.leverage < 1 || body.leverage > 50) {
          set.status = 422;
          return { error: "Leverage must be between 1x and 50x" };
        }

        if (body.quantity <= 0) {
          set.status = 422;
          return { error: "Quantity must be greater than 0" };
        }

        if (body.type === "LIMIT" && (!body.price || body.price <= 0)) {
          set.status = 422;
          return { error: "Price required for LIMIT orders" };
        }

        try {
          // Calculate estimated price for market orders using last trade price
          let estimatedPrice = body.price;
          if (!estimatedPrice && body.type === "MARKET") {
            const lastTrade = await db.queryOne<{ price: string }>(
              `SELECT price FROM trades WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1`,
              [body.symbol]
            );
            if (!lastTrade) {
              set.status = 422;
              return { error: "No recent trades for this symbol; cannot estimate market order price" };
            }
            estimatedPrice = parseFloat(lastTrade.price);
          }

          // Calculate required margin
          const notional = body.quantity * (estimatedPrice ?? 0);
          const requiredMargin = notional / body.leverage;

          // Check user has sufficient balance
          const balance = await db.queryOne<{ available: string }>(
            `SELECT COALESCE(available, '0') as available
             FROM user_balances
             WHERE user_id = $1 AND asset = $2`,
            [currentUser.id, body.marginAsset ?? "USDT"]
          );

          const available = balance ? parseFloat(balance.available) : 0;
          if (available < requiredMargin) {
            set.status = 422;
            return {
              error: "Insufficient margin",
              required: requiredMargin,
              available,
            };
          }

          // Lock margin BEFORE placing order to prevent race with engine settlement
          await db.query(
            `UPDATE user_balances
             SET available = available - $1, locked = locked + $1
             WHERE user_id = $2 AND asset = $3`,
            [requiredMargin, currentUser.id, body.marginAsset ?? "USDT"]
          );

          // Place order via gateway
          const result = await gateway.placeOrder({
            userId: currentUser.id,
            symbol: body.symbol,
            side: body.side,
            type: body.type,
            price: body.price,
            quantity: body.quantity,
            timeInForce: body.timeInForce ?? "GTC",
            stopPrice: body.stopPrice,
            clientOrderId: body.clientOrderId,
          });

          if (!result.success) {
            // Rollback margin lock on rejection
            await db.query(
              `UPDATE user_balances
               SET available = available + $1, locked = locked - $1
               WHERE user_id = $2 AND asset = $3`,
              [requiredMargin, currentUser.id, body.marginAsset ?? "USDT"]
            );
            set.status = 400;
            return { error: result.error ?? "Order rejected" };
          }

          return {
            orderId: result.orderId,
            symbol: body.symbol,
            side: body.side,
            type: body.type,
            price: body.price,
            quantity: body.quantity,
            leverage: body.leverage,
            requiredMargin,
            status: "NEW",
          };
        } catch (error) {
          console.error("Failed to place leveraged order:", error);
          set.status = 500;
          return { error: "Failed to place order" };
        }
      },
      {
        body: t.Object({
          symbol: t.String({ description: "Trading pair (e.g., BTC-USDT)" }),
          side: t.Union([t.Literal("BUY"), t.Literal("SELL")]),
          type: t.Union([t.Literal("LIMIT"), t.Literal("MARKET"), t.Literal("STOP_LIMIT"), t.Literal("STOP_MARKET")]),
          price: t.Optional(t.Number({ description: "Limit price" })),
          quantity: t.Number({ description: "Order quantity" }),
          leverage: t.Number({ description: "Leverage (1x-50x)" }),
          timeInForce: t.Optional(t.Union([t.Literal("GTC"), t.Literal("IOC"), t.Literal("FOK"), t.Literal("POST_ONLY")])),
          stopPrice: t.Optional(t.Number({ description: "Stop trigger price" })),
          clientOrderId: t.Optional(t.String()),
          marginAsset: t.Optional(t.String({ description: "Margin asset (default: USDT)" })),
          reduceOnly: t.Optional(t.Boolean({ description: "Reduce-only order" })),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["trading"],
          summary: "Place leveraged order",
          description: "Place a perpetual futures order with specified leverage (1x-50x). Validates margin requirements.",
        },
      }
    )

    // ─── Batch Orders ────────────────────────────────────────────────────
    .post(
      "/orders/batch",
      async ({ body, user, set }) => {
        const currentUser = requireUser({ user });
        if (!currentUser) {
          set.status = 401;
          return { error: "Authentication required" };
        }

        if (body.orders.length > 20) {
          set.status = 422;
          return { error: "Maximum 20 orders per batch" };
        }

        if (body.orders.length === 0) {
          set.status = 422;
          return { error: "At least 1 order required" };
        }

        const results: Array<{
          index: number;
          success: boolean;
          orderId?: string;
          error?: string;
        }> = [];

        for (let i = 0; i < body.orders.length; i++) {
          const order = body.orders[i];
          try {
            const result = await gateway.placeOrder({
              userId: currentUser.id,
              symbol: order.symbol,
              side: order.side,
              type: order.type,
              price: order.price,
              quantity: order.quantity,
              timeInForce: order.timeInForce ?? "GTC",
              stopPrice: order.stopPrice,
              clientOrderId: order.clientOrderId,
            });

            results.push({
              index: i,
              success: result.success,
              orderId: result.orderId,
              error: result.error,
            });
          } catch (error) {
            results.push({
              index: i,
              success: false,
              error: (error as Error).message,
            });
          }
        }

        return {
          totalOrders: body.orders.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          results,
        };
      },
      {
        body: t.Object({
          orders: t.Array(
            t.Object({
              symbol: t.String(),
              side: t.Union([t.Literal("BUY"), t.Literal("SELL")]),
              type: t.Union([t.Literal("LIMIT"), t.Literal("MARKET"), t.Literal("STOP_LIMIT"), t.Literal("STOP_MARKET")]),
              price: t.Optional(t.Number()),
              quantity: t.Number(),
              timeInForce: t.Optional(t.Union([t.Literal("GTC"), t.Literal("IOC"), t.Literal("FOK"), t.Literal("POST_ONLY")])),
              stopPrice: t.Optional(t.Number({ description: "Stop trigger price" })),
              clientOrderId: t.Optional(t.String()),
            }),
            { maxItems: 20 }
          ),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["trading"],
          summary: "Batch order submission",
          description: "Submit up to 20 orders in a single request. Each order is processed independently.",
        },
      }
    )

    // ─── Modify Order ────────────────────────────────────────────────────
    .patch(
      "/orders/:orderId",
      async ({ params, body, user, set }) => {
        const currentUser = requireUser({ user });
        if (!currentUser) {
          set.status = 401;
          return { error: "Authentication required" };
        }

        if (!body.price && !body.quantity) {
          set.status = 422;
          return { error: "At least one of price or quantity must be specified" };
        }

        try {
          // Verify order belongs to user
          const orderStatus = await gateway.getOrderStatus(params.orderId);
          if (!orderStatus) {
            set.status = 404;
            return { error: "Order not found" };
          }

          if (orderStatus.status !== "OPEN" && orderStatus.status !== "PARTIAL") {
            set.status = 422;
            return { error: `Cannot modify order with status: ${orderStatus.status}` };
          }

          // Cancel-and-replace strategy: cancel old, place new
          const cancelResult = await gateway.cancelOrder(
            body.symbol ?? "",
            params.orderId,
            currentUser.id
          );

          if (!cancelResult.success) {
            set.status = 400;
            return { error: "Failed to cancel original order for modification" };
          }

          // Place replacement order with updated price/quantity
          const newOrder = await gateway.placeOrder({
            userId: currentUser.id,
            symbol: body.symbol ?? "",
            side: body.side ?? "BUY",
            type: "LIMIT",
            price: body.price,
            quantity: body.quantity ?? orderStatus.remainingQuantity,
            timeInForce: body.timeInForce ?? "GTC",
          });

          return {
            success: true,
            originalOrderId: params.orderId,
            newOrderId: newOrder.orderId,
            modifications: {
              price: body.price,
              quantity: body.quantity,
            },
          };
        } catch (error) {
          console.error("Failed to modify order:", error);
          set.status = 500;
          return { error: "Failed to modify order" };
        }
      },
      {
        params: t.Object({
          orderId: t.String({ description: "Original order ID to modify" }),
        }),
        body: t.Object({
          symbol: t.Optional(t.String()),
          side: t.Optional(t.Union([t.Literal("BUY"), t.Literal("SELL")])),
          price: t.Optional(t.Number({ description: "New price" })),
          quantity: t.Optional(t.Number({ description: "New quantity" })),
          timeInForce: t.Optional(t.Union([t.Literal("GTC"), t.Literal("IOC"), t.Literal("FOK"), t.Literal("POST_ONLY")])),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["trading"],
          summary: "Modify an order",
          description: "Modify an open order's price and/or quantity. Uses cancel-and-replace internally.",
        },
      }
    )

    // ─── Trade History ──────────────────────────────────────────────────
    .get(
      "/trades",
      async ({ query, user, set }) => {
        const currentUser = requireUser({ user });
        if (!currentUser) {
          set.status = 401;
          return { error: "Authentication required" };
        }

        try {
          const limit = query.limit ?? 50;
          const offset = query.offset ?? 0;

          const trades = await db.query<{
            id: string;
            symbol: string;
            side: string;
            price: string;
            quantity: string;
            fee: string;
            fee_asset: string;
            order_id: string;
            role: string;
            timestamp: string;
          }>(
            `SELECT bt.id, bt.asset as symbol,
                    CASE WHEN bt.type = 'trade_buy' THEN 'BUY' ELSE 'SELL' END as side,
                    bt.amount as quantity, bt.fee, bt.fee_asset,
                    bt.reference_id as order_id, bt.metadata->>'price' as price,
                    CASE WHEN bt.metadata->>'role' IS NOT NULL THEN bt.metadata->>'role' ELSE 'TAKER' END as role,
                    bt.created_at as timestamp
             FROM balance_transactions bt
             WHERE bt.user_id = $1 AND bt.type IN ('trade_buy', 'trade_sell')
             ${query.symbol ? "AND bt.asset = $3" : ""}
             ORDER BY bt.created_at DESC
             LIMIT $2 OFFSET ${offset}`,
            query.symbol ? [currentUser.id, limit, query.symbol] : [currentUser.id, limit]
          );

          return {
            trades: (trades ?? []).map((t) => ({
              id: t.id,
              symbol: t.symbol,
              side: t.side,
              price: t.price ? parseFloat(t.price) : 0,
              quantity: parseFloat(t.quantity),
              fee: t.fee ? parseFloat(t.fee) : 0,
              feeAsset: t.fee_asset,
              orderId: t.order_id,
              role: t.role,
              timestamp: t.timestamp,
            })),
            pagination: { limit, offset },
          };
        } catch (error) {
          console.error("Failed to fetch trades:", error);
          return { trades: [], pagination: { limit: 50, offset: 0 } };
        }
      },
      {
        query: t.Object({
          symbol: t.Optional(t.String({ description: "Filter by symbol" })),
          limit: t.Optional(t.Numeric({ description: "Limit (default 50, max 500)" })),
          offset: t.Optional(t.Numeric({ description: "Offset (default 0)" })),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["trading"],
          summary: "Trade history",
          description: "Get historical trades for the authenticated user",
        },
      }
    )

    // ─── Open Orders ────────────────────────────────────────────────────
    .get(
      "/openOrders",
      async ({ query, user, set }) => {
        const currentUser = requireUser({ user });
        if (!currentUser) {
          set.status = 401;
          return { error: "Authentication required" };
        }

        try {
          const orders = await db.query<{
            id: string;
            symbol: string;
            side: string;
            type: string;
            price: string;
            quantity: string;
            filled_quantity: string;
            status: string;
            time_in_force: string;
            client_order_id: string | null;
            created_at: string;
            updated_at: string;
          }>(
            `SELECT id, symbol, side, type, price, quantity,
                    (quantity - quantity_remaining) as filled_quantity,
                    status, time_in_force, client_order_id, created_at, updated_at
             FROM orders
             WHERE user_id = $1 AND status IN ('NEW', 'PARTIALLY_FILLED')
             ${query.symbol ? "AND symbol = $2" : ""}
             ORDER BY created_at DESC`,
            query.symbol ? [currentUser.id, query.symbol] : [currentUser.id]
          );

          return {
            orders: (orders ?? []).map((o) => ({
              orderId: o.id,
              symbol: o.symbol,
              side: o.side,
              type: o.type,
              price: parseFloat(o.price),
              quantity: parseFloat(o.quantity),
              filledQuantity: parseFloat(o.filled_quantity),
              remainingQuantity: parseFloat(o.quantity) - parseFloat(o.filled_quantity),
              status: o.status,
              timeInForce: o.time_in_force,
              clientOrderId: o.client_order_id,
              createdAt: o.created_at,
              updatedAt: o.updated_at,
            })),
          };
        } catch (error) {
          console.error("Failed to fetch open orders:", error);
          return { orders: [] };
        }
      },
      {
        query: t.Object({
          symbol: t.Optional(t.String({ description: "Filter by symbol" })),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["trading"],
          summary: "List open orders",
          description: "Get all open orders for the authenticated user",
        },
      }
    );
}
