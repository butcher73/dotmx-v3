/**
 * Trading Routes
 *
 * Core order management endpoints with authentication.
 *
 * POST   /orders          - Create order (via gateway)
 * DELETE /orders/:orderId - Cancel order
 * GET    /orders/:orderId - Order status
 * GET    /openOrders      - Open orders
 * GET    /trades          - Recent trades
 */

import { Elysia, t } from "elysia";
import type { DatabaseService, AuthService } from "@dotmx/shared";
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

/**
 * Legacy static export (kept for backwards compat — prefer createTradingRoutes)
 * Includes mock implementations for testing
 */
export const tradingRoutes = new Elysia({ prefix: "/v1" })
  .get("/ping", () => ({ status: "ok" }))
  .post(
    "/orders",
    ({ body, set }) => {
      const orderData = body as any;

      // Validate quantity
      if (orderData.quantity <= 0) {
        set.status = 422;
        return { error: "Quantity must be greater than 0" };
      }

      const response: any = {
        orderId: "mock-order-" + Date.now(),
        symbol: orderData.symbol || "BTC-USD",
        side: orderData.side || "BUY",
        type: orderData.type || "LIMIT",
        price: orderData.price || "0",
        quantity: orderData.quantity || "0",
        status: "NEW",
        timestamp: Date.now(),
      };

      // Include clientOrderId if provided
      if (orderData.clientOrderId) {
        response.clientOrderId = orderData.clientOrderId;
      }

      return response;
    },
    {
      body: t.Object({
        symbol: t.String(),
        side: t.Union([t.Literal("BUY"), t.Literal("SELL")]),
        type: t.Union([t.Literal("LIMIT"), t.Literal("MARKET"), t.Literal("STOP"), t.Literal("STOP_LIMIT")]),
        quantity: t.Number(),
        price: t.Optional(t.Number()),
        timeInForce: t.Optional(t.Union([t.Literal("GTC"), t.Literal("IOC"), t.Literal("FOK")])),
        clientOrderId: t.Optional(t.String()),
      }),
    }
  )
  .delete("/orders/:orderId", ({ params }) => ({
    orderId: params.orderId,
    status: "CANCELED",
    timestamp: Date.now(),
  }))
  .get("/orders/:orderId", ({ params }) => ({
    orderId: params.orderId,
    symbol: "BTC-USD",
    status: "NEW",
    timestamp: Date.now(),
  }))
  .get("/openOrders", ({ query }) => ({
    orders: [],
  }))
  .get("/trades", ({ query }) => ({
    trades: [],
  }));

/**
 * Create authenticated trading routes wired to gateway + DB
 */
export function createTradingRoutes(
  db: DatabaseService,
  gateway: GatewayAdapter,
  authService?: AuthService
) {
  return new Elysia({ prefix: "/api/v1" })
    .derive(async ({ headers }) => {
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

    // ─── Place Order ──────────────────────────────────────────────────────
    .post(
      "/orders",
      async ({ body, user, set }) => {
        const currentUser = requireUser({ user });

        if (body.quantity <= 0) {
          set.status = 422;
          return { error: "Quantity must be greater than 0" };
        }

        if (body.type === "LIMIT" && (!body.price || body.price <= 0)) {
          set.status = 422;
          return { error: "Price required for LIMIT orders" };
        }

        if ((body.type === "STOP_LIMIT" || body.type === "STOP_MARKET") && (!body.stopPrice || body.stopPrice <= 0)) {
          set.status = 422;
          return { error: "stopPrice required for stop orders" };
        }

        if (body.type === "STOP_LIMIT" && (!body.price || body.price <= 0)) {
          set.status = 422;
          return { error: "Price required for STOP_LIMIT orders" };
        }

        try {
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
            set.status = 400;
            return { error: result.error ?? "Order rejected" };
          }

          // Record order in DB
          await db.execute(
            `INSERT INTO orders (id, user_id, symbol, side, type, price, quantity, status, time_in_force, client_order_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'NEW', $8, $9)`,
            [
              result.orderId,
              currentUser.id,
              body.symbol,
              body.side,
              body.type,
              body.price ?? 0,
              body.quantity,
              body.timeInForce ?? "GTC",
              body.clientOrderId ?? null,
            ]
          );

          return {
            orderId: result.orderId,
            symbol: body.symbol,
            side: body.side,
            type: body.type,
            price: body.price,
            quantity: body.quantity,
            timeInForce: body.timeInForce ?? "GTC",
            stopPrice: body.stopPrice,
            status: "NEW",
          };
        } catch (error) {
          console.error("Failed to place order:", error);
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
          timeInForce: t.Optional(t.Union([t.Literal("GTC"), t.Literal("IOC"), t.Literal("FOK"), t.Literal("POST_ONLY")])),
          stopPrice: t.Optional(t.Number({ description: "Stop trigger price (required for STOP_LIMIT / STOP_MARKET)" })),
          clientOrderId: t.Optional(t.String()),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["trading"],
          summary: "Place a new order",
          description: "Submit a new buy or sell order to the matching engine via gateway",
        },
      }
    )

    // ─── Cancel Order ─────────────────────────────────────────────────────
    .delete(
      "/orders/:orderId",
      async ({ params, query, user, set }) => {
        const currentUser = requireUser({ user });

        try {
          // Verify order belongs to user
          const order = await db.queryOne<{ id: string; symbol: string; user_id: string }>(
            `SELECT id, symbol, user_id FROM orders WHERE id = $1`,
            [params.orderId]
          );

          if (!order) {
            set.status = 404;
            return { error: "Order not found" };
          }

          if (order.user_id !== currentUser.id) {
            set.status = 403;
            return { error: "Not authorized to cancel this order" };
          }

          const result = await gateway.cancelOrder(
            order.symbol,
            params.orderId,
            currentUser.id
          );

          if (!result.success) {
            set.status = 400;
            return { error: result.error ?? "Cancel failed" };
          }

          // Update DB
          await db.execute(
            `UPDATE orders SET status = 'CANCELED', updated_at = NOW() WHERE id = $1`,
            [params.orderId]
          );

          return {
            orderId: params.orderId,
            status: "CANCELED",
          };
        } catch (error) {
          console.error("Failed to cancel order:", error);
          set.status = 500;
          return { error: "Failed to cancel order" };
        }
      },
      {
        params: t.Object({
          orderId: t.String({ description: "Order ID to cancel" }),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["trading"],
          summary: "Cancel an order",
          description: "Cancel an existing open order. The order must belong to the authenticated user.",
        },
      }
    )

    // ─── Get Order Status ─────────────────────────────────────────────────
    .get(
      "/orders/:orderId",
      async ({ params, user, set }) => {
        const currentUser = requireUser({ user });

        try {
          const order = await db.queryOne<{
            id: string;
            user_id: string;
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
            `SELECT id, user_id, symbol, side, type, price, quantity,
                    COALESCE(filled_quantity, '0') as filled_quantity,
                    status, time_in_force, client_order_id, created_at, updated_at
             FROM orders WHERE id = $1`,
            [params.orderId]
          );

          if (!order) {
            set.status = 404;
            return { error: "Order not found" };
          }

          if (order.user_id !== currentUser.id) {
            set.status = 403;
            return { error: "Not authorized to view this order" };
          }

          return {
            orderId: order.id,
            symbol: order.symbol,
            side: order.side,
            type: order.type,
            price: parseFloat(order.price),
            quantity: parseFloat(order.quantity),
            filledQuantity: parseFloat(order.filled_quantity),
            remainingQuantity: parseFloat(order.quantity) - parseFloat(order.filled_quantity),
            status: order.status,
            timeInForce: order.time_in_force,
            clientOrderId: order.client_order_id,
            createdAt: order.created_at,
            updatedAt: order.updated_at,
          };
        } catch (error) {
          console.error("Failed to fetch order:", error);
          set.status = 500;
          return { error: "Failed to fetch order" };
        }
      },
      {
        params: t.Object({
          orderId: t.String({ description: "Order ID" }),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["trading"],
          summary: "Get order status",
          description: "Get the current status and details of an order",
        },
      }
    )

    // ─── Open Orders ──────────────────────────────────────────────────────
    .get(
      "/openOrders",
      async ({ query, user, set }) => {
        const currentUser = requireUser({ user });

        try {
          const limit = query.limit ?? 100;

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
                    COALESCE(filled_quantity, '0') as filled_quantity,
                    status, time_in_force, client_order_id, created_at, updated_at
             FROM orders
             WHERE user_id = $1 AND status IN ('NEW', 'PARTIALLY_FILLED')
             ${query.symbol ? "AND symbol = $2" : ""}
             ORDER BY created_at DESC
             LIMIT ${limit}`,
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
          limit: t.Optional(t.Numeric({ description: "Max results (default 100)" })),
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
    )

    // ─── Recent Trades ────────────────────────────────────────────────────
    .get(
      "/trades",
      async ({ query, user, set }) => {
        const currentUser = requireUser({ user });

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
             LIMIT $2 OFFSET $${query.symbol ? 4 : 3}`,
            query.symbol ? [currentUser.id, limit, query.symbol, offset] : [currentUser.id, limit, offset]
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
    );
}
