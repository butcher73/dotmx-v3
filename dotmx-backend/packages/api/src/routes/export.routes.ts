/**
 * Historical Data Export Routes
 *
 * Allow users to export their trading data in CSV or JSON format.
 *
 * GET /api/v1/export/trades        - Export trade history
 * GET /api/v1/export/orders        - Export order history
 * GET /api/v1/export/transactions  - Export balance transactions (deposits, withdrawals)
 * GET /api/v1/export/positions     - Export position history
 */

import { Elysia, t } from "elysia";
import type { DatabaseService, AuthService } from "@dotmx/shared";

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

function requireUser(ctx: { user: AuthUser | null }): AuthUser {
  if (!ctx.user) throw new Error("Authentication required");
  return ctx.user;
}

function toCSV(rows: Record<string, any>[], columns: string[]): string {
  if (rows.length === 0) return columns.join(",") + "\n";
  const header = columns.join(",");
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return "";
          const str = String(val);
          // Escape CSV values containing commas, quotes, or newlines
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    )
    .join("\n");
  return header + "\n" + body + "\n";
}

export function createExportRoutes(
  db: DatabaseService,
  authService?: AuthService
) {
  return new Elysia({ prefix: "/v1/export" })
    .derive(async ({ headers }) => {
      const authHeader = headers.authorization || headers.Authorization;
      if (!authHeader?.startsWith("Bearer "))
        return { user: null as AuthUser | null };
      try {
        const token = authHeader.substring(7);
        const jwt = authService
          ? await authService.verifyToken(token)
          : JSON.parse(
            Buffer.from(token.split(".")[1], "base64").toString()
          );
        const user = await db.queryOne<AuthUser>(
          `SELECT id, email, role FROM users WHERE id = $1 AND deleted_at IS NULL AND status = 'active'`,
          [jwt.sub]
        );
        return { user: user ?? null };
      } catch {
        return { user: null as AuthUser | null };
      }
    })

    // ─── Export Trades ──────────────────────────────────────────────────
    .get(
      "/trades",
      async ({ query, user, set }) => {
        const currentUser = requireUser({ user });

        try {
          const conditions = [`(buyer_id = $1 OR seller_id = $1)`];
          const params: any[] = [currentUser.id];
          let idx = 2;

          if (query.market) {
            conditions.push(`market = $${idx++}`);
            params.push(query.market);
          }
          if (query.from) {
            conditions.push(`created_at >= $${idx++}`);
            params.push(query.from);
          }
          if (query.to) {
            conditions.push(`created_at <= $${idx++}`);
            params.push(query.to);
          }

          const limit = Math.min(parseInt(query.limit || "1000"), 10000);

          const trades = await db.query<{
            id: string;
            market: string;
            price: string;
            quantity: string;
            side: string;
            fee: string;
            fee_currency: string;
            created_at: string;
          }>(
            `SELECT t.id, t.market, t.price, t.quantity,
                    CASE WHEN t.buyer_id = $1 THEN 'buy' ELSE 'sell' END as side,
                    COALESCE(t.taker_fee, '0') as fee,
                    COALESCE(t.fee_currency, 'USD') as fee_currency,
                    t.created_at
             FROM trades t
             WHERE ${conditions.join(" AND ")}
             ORDER BY t.created_at DESC
             LIMIT $${idx}`,
            [...params, limit]
          );

          const rows = trades ?? [];
          const columns = [
            "id",
            "market",
            "side",
            "price",
            "quantity",
            "fee",
            "fee_currency",
            "created_at",
          ];

          if (query.format === "csv") {
            set.headers["content-type"] = "text/csv";
            set.headers["content-disposition"] =
              `attachment; filename=trades_${new Date().toISOString().split("T")[0]}.csv`;
            return toCSV(rows, columns);
          }

          return { trades: rows, total: rows.length, format: "json" };
        } catch (error) {
          console.error("Failed to export trades:", error);
          set.status = 500;
          return { error: "Failed to export trades" };
        }
      },
      {
        query: t.Object({
          market: t.Optional(t.String()),
          from: t.Optional(t.String({ description: "ISO date start" })),
          to: t.Optional(t.String({ description: "ISO date end" })),
          format: t.Optional(t.String({ description: "json or csv (default: json)" })),
          limit: t.Optional(t.String({ description: "Max rows (default: 1000, max: 10000)" })),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["export"],
          summary: "Export trade history",
          description: "Export user trade history as JSON or CSV. Max 10,000 rows per request.",
        },
      }
    )

    // ─── Export Orders ──────────────────────────────────────────────────
    .get(
      "/orders",
      async ({ query, user, set }) => {
        const currentUser = requireUser({ user });

        try {
          const conditions = [`user_id = $1`];
          const params: any[] = [currentUser.id];
          let idx = 2;

          if (query.market) {
            conditions.push(`market = $${idx++}`);
            params.push(query.market);
          }
          if (query.status) {
            conditions.push(`status = $${idx++}`);
            params.push(query.status);
          }
          if (query.from) {
            conditions.push(`created_at >= $${idx++}`);
            params.push(query.from);
          }
          if (query.to) {
            conditions.push(`created_at <= $${idx++}`);
            params.push(query.to);
          }

          const limit = Math.min(parseInt(query.limit || "1000"), 10000);

          const orders = await db.query<{
            id: string;
            market: string;
            side: string;
            type: string;
            price: string;
            quantity: string;
            filled_quantity: string;
            status: string;
            time_in_force: string;
            created_at: string;
            updated_at: string;
          }>(
            `SELECT id, market, side, type, price, quantity,
                    (quantity - quantity_remaining) as filled_quantity, status, time_in_force,
                    created_at, updated_at
             FROM orders
             WHERE ${conditions.join(" AND ")}
             ORDER BY created_at DESC
             LIMIT $${idx}`,
            [...params, limit]
          );

          const rows = orders ?? [];
          const columns = [
            "id",
            "market",
            "side",
            "type",
            "price",
            "quantity",
            "filled_quantity",
            "status",
            "time_in_force",
            "created_at",
            "updated_at",
          ];

          if (query.format === "csv") {
            set.headers["content-type"] = "text/csv";
            set.headers["content-disposition"] =
              `attachment; filename=orders_${new Date().toISOString().split("T")[0]}.csv`;
            return toCSV(rows, columns);
          }

          return { orders: rows, total: rows.length, format: "json" };
        } catch (error) {
          console.error("Failed to export orders:", error);
          set.status = 500;
          return { error: "Failed to export orders" };
        }
      },
      {
        query: t.Object({
          market: t.Optional(t.String()),
          status: t.Optional(t.String()),
          from: t.Optional(t.String()),
          to: t.Optional(t.String()),
          format: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["export"],
          summary: "Export order history",
        },
      }
    )

    // ─── Export Transactions ────────────────────────────────────────────
    .get(
      "/transactions",
      async ({ query, user, set }) => {
        const currentUser = requireUser({ user });

        try {
          const conditions = [`user_id = $1`];
          const params: any[] = [currentUser.id];
          let idx = 2;

          if (query.type) {
            conditions.push(`transaction_type = $${idx++}`);
            params.push(query.type);
          }
          if (query.asset) {
            conditions.push(`asset = $${idx++}`);
            params.push(query.asset);
          }
          if (query.from) {
            conditions.push(`created_at >= $${idx++}`);
            params.push(query.from);
          }
          if (query.to) {
            conditions.push(`created_at <= $${idx++}`);
            params.push(query.to);
          }

          const limit = Math.min(parseInt(query.limit || "1000"), 10000);

          const txns = await db.query<{
            id: string;
            transaction_type: string;
            asset: string;
            amount: string;
            balance_before: string;
            balance_after: string;
            reference_id: string | null;
            description: string | null;
            created_at: string;
          }>(
            `SELECT id, transaction_type, asset, amount,
                    balance_before, balance_after,
                    reference_id, description, created_at
             FROM balance_transactions
             WHERE ${conditions.join(" AND ")}
             ORDER BY created_at DESC
             LIMIT $${idx}`,
            [...params, limit]
          );

          const rows = txns ?? [];
          const columns = [
            "id",
            "transaction_type",
            "asset",
            "amount",
            "balance_before",
            "balance_after",
            "reference_id",
            "description",
            "created_at",
          ];

          if (query.format === "csv") {
            set.headers["content-type"] = "text/csv";
            set.headers["content-disposition"] =
              `attachment; filename=transactions_${new Date().toISOString().split("T")[0]}.csv`;
            return toCSV(rows, columns);
          }

          return { transactions: rows, total: rows.length, format: "json" };
        } catch (error) {
          console.error("Failed to export transactions:", error);
          set.status = 500;
          return { error: "Failed to export transactions" };
        }
      },
      {
        query: t.Object({
          type: t.Optional(t.String({ description: "deposit, withdrawal, trade, fee, etc." })),
          asset: t.Optional(t.String()),
          from: t.Optional(t.String()),
          to: t.Optional(t.String()),
          format: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["export"],
          summary: "Export balance transactions",
          description: "Export deposits, withdrawals, trade settlements, and fee records.",
        },
      }
    )

    // ─── Export Positions ───────────────────────────────────────────────
    .get(
      "/positions",
      async ({ query, user, set }) => {
        const currentUser = requireUser({ user });

        try {
          const conditions = [`user_id = $1`];
          const params: any[] = [currentUser.id];
          let idx = 2;

          if (query.market) {
            conditions.push(`market = $${idx++}`);
            params.push(query.market);
          }
          if (query.status) {
            conditions.push(`status = $${idx++}`);
            params.push(query.status);
          }
          if (query.from) {
            conditions.push(`created_at >= $${idx++}`);
            params.push(query.from);
          }
          if (query.to) {
            conditions.push(`created_at <= $${idx++}`);
            params.push(query.to);
          }

          const limit = Math.min(parseInt(query.limit || "1000"), 10000);

          const positions = await db.query<{
            id: string;
            market: string;
            side: string;
            size: string;
            entry_price: string;
            liquidation_price: string | null;
            leverage: string;
            margin: string;
            unrealized_pnl: string;
            realized_pnl: string;
            status: string;
            opened_at: string;
            closed_at: string | null;
          }>(
            `SELECT id, market, side, size, entry_price, liquidation_price,
                    leverage, margin, unrealized_pnl, realized_pnl,
                    status, created_at as opened_at, closed_at
             FROM perpetual_positions
             WHERE ${conditions.join(" AND ")}
             ORDER BY created_at DESC
             LIMIT $${idx}`,
            [...params, limit]
          );

          const rows = positions ?? [];
          const columns = [
            "id",
            "market",
            "side",
            "size",
            "entry_price",
            "liquidation_price",
            "leverage",
            "margin",
            "unrealized_pnl",
            "realized_pnl",
            "status",
            "opened_at",
            "closed_at",
          ];

          if (query.format === "csv") {
            set.headers["content-type"] = "text/csv";
            set.headers["content-disposition"] =
              `attachment; filename=positions_${new Date().toISOString().split("T")[0]}.csv`;
            return toCSV(rows, columns);
          }

          return { positions: rows, total: rows.length, format: "json" };
        } catch (error) {
          console.error("Failed to export positions:", error);
          set.status = 500;
          return { error: "Failed to export positions" };
        }
      },
      {
        query: t.Object({
          market: t.Optional(t.String()),
          status: t.Optional(t.String({ description: "open, closed, liquidated" })),
          from: t.Optional(t.String()),
          to: t.Optional(t.String()),
          format: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["export"],
          summary: "Export position history",
          description: "Export perpetual futures position history including PnL data.",
        },
      }
    );
}
