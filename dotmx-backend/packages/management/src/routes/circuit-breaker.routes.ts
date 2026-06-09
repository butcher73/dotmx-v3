/**
 * Circuit Breaker Management Routes
 *
 * Admin endpoints for managing market circuit breakers.
 *
 * GET  /circuit-breaker                - List all circuit breaker configs
 * GET  /circuit-breaker/:symbol        - Get circuit breaker for symbol
 * PUT  /circuit-breaker/:symbol        - Update circuit breaker config
 * POST /circuit-breaker/:symbol/halt   - Manually halt a market
 * POST /circuit-breaker/:symbol/resume - Resume a halted market
 */

import { Elysia, t } from "elysia";
import type { DatabaseService } from "@dotmx/shared";

export function createCircuitBreakerRoutes(db: DatabaseService) {
  return new Elysia({ prefix: "/circuit-breaker" })

    // ─── List All Circuit Breaker Configs ─────────────────────────────────
    .get(
      "/",
      async () => {
        try {
          const configs = await db.query<{
            symbol: string;
            enabled: boolean;
            price_threshold_pct: string;
            window_seconds: number;
            cooldown_seconds: number;
            is_halted: boolean;
            halted_at: string | null;
            halted_by: string | null;
            last_triggered_at: string | null;
            updated_at: string;
          }>(
            `SELECT symbol, enabled, price_threshold_pct, window_seconds,
                    cooldown_seconds, is_halted, halted_at, halted_by,
                    last_triggered_at, updated_at
             FROM circuit_breaker_config
             ORDER BY symbol`
          );

          return {
            configs: (configs ?? []).map((c) => ({
              symbol: c.symbol,
              enabled: c.enabled,
              priceThresholdPct: parseFloat(c.price_threshold_pct),
              windowSeconds: c.window_seconds,
              cooldownSeconds: c.cooldown_seconds,
              isHalted: c.is_halted,
              haltedAt: c.halted_at,
              haltedBy: c.halted_by,
              lastTriggeredAt: c.last_triggered_at,
              updatedAt: c.updated_at,
            })),
          };
        } catch (error) {
          console.error("Failed to fetch circuit breaker configs:", error);
          return { configs: [] };
        }
      },
      {
        detail: {
          tags: ["circuit-breaker"],
          summary: "List circuit breaker configs",
        },
      }
    )

    // ─── Get Config for Symbol ────────────────────────────────────────────
    .get(
      "/:symbol",
      async ({ params, set }) => {
        const config = await db.queryOne<{
          symbol: string;
          enabled: boolean;
          price_threshold_pct: string;
          window_seconds: number;
          cooldown_seconds: number;
          is_halted: boolean;
          halted_at: string | null;
          halted_by: string | null;
          last_triggered_at: string | null;
          updated_at: string;
        }>(
          `SELECT * FROM circuit_breaker_config WHERE symbol = $1`,
          [params.symbol]
        );

        if (!config) {
          set.status = 404;
          return { error: "Circuit breaker config not found" };
        }

        return {
          symbol: config.symbol,
          enabled: config.enabled,
          priceThresholdPct: parseFloat(config.price_threshold_pct),
          windowSeconds: config.window_seconds,
          cooldownSeconds: config.cooldown_seconds,
          isHalted: config.is_halted,
          haltedAt: config.halted_at,
          haltedBy: config.halted_by,
          lastTriggeredAt: config.last_triggered_at,
          updatedAt: config.updated_at,
        };
      },
      {
        params: t.Object({
          symbol: t.String({ description: "Trading pair symbol" }),
        }),
        detail: {
          tags: ["circuit-breaker"],
          summary: "Get circuit breaker config",
        },
      }
    )

    // ─── Update Config ───────────────────────────────────────────────────
    .put(
      "/:symbol",
      async ({ params, body, set }) => {
        const existing = await db.queryOne(
          `SELECT symbol FROM circuit_breaker_config WHERE symbol = $1`,
          [params.symbol]
        );

        if (!existing) {
          // Create new config
          await db.execute(
            `INSERT INTO circuit_breaker_config 
               (symbol, enabled, price_threshold_pct, window_seconds, cooldown_seconds)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              params.symbol,
              body.enabled ?? true,
              body.priceThresholdPct ?? 10.0,
              body.windowSeconds ?? 60,
              body.cooldownSeconds ?? 300,
            ]
          );
        } else {
          // Update existing
          const updates: string[] = [];
          const values: any[] = [];
          let idx = 1;

          if (body.enabled !== undefined) {
            updates.push(`enabled = $${idx++}`);
            values.push(body.enabled);
          }
          if (body.priceThresholdPct !== undefined) {
            updates.push(`price_threshold_pct = $${idx++}`);
            values.push(body.priceThresholdPct);
          }
          if (body.windowSeconds !== undefined) {
            updates.push(`window_seconds = $${idx++}`);
            values.push(body.windowSeconds);
          }
          if (body.cooldownSeconds !== undefined) {
            updates.push(`cooldown_seconds = $${idx++}`);
            values.push(body.cooldownSeconds);
          }
          updates.push(`updated_at = NOW()`);

          if (updates.length > 1) {
            values.push(params.symbol);
            await db.execute(
              `UPDATE circuit_breaker_config SET ${updates.join(", ")} WHERE symbol = $${idx}`,
              values
            );
          }
        }

        return { success: true, symbol: params.symbol };
      },
      {
        params: t.Object({
          symbol: t.String({ description: "Trading pair symbol" }),
        }),
        body: t.Object({
          enabled: t.Optional(t.Boolean()),
          priceThresholdPct: t.Optional(t.Number()),
          windowSeconds: t.Optional(t.Number()),
          cooldownSeconds: t.Optional(t.Number()),
        }),
        detail: {
          tags: ["circuit-breaker"],
          summary: "Update circuit breaker config",
        },
      }
    )

    // ─── Manual Halt ─────────────────────────────────────────────────────
    .post(
      "/:symbol/halt",
      async ({ params, body, set }) => {
        const result = await db.execute(
          `UPDATE circuit_breaker_config
           SET is_halted = TRUE, 
               halted_at = NOW(), 
               halted_by = $2,
               last_triggered_at = NOW(),
               updated_at = NOW()
           WHERE symbol = $1`,
          [params.symbol, body?.reason ?? "manual_admin_halt"]
        );

        // Also update trading pair status
        await db.execute(
          `UPDATE trading_pairs SET status = 'halted' WHERE symbol = $1`,
          [params.symbol]
        );

        console.log(`⚠️ Market HALTED: ${params.symbol} (reason: ${body?.reason ?? "manual"})`);

        return {
          success: true,
          symbol: params.symbol,
          isHalted: true,
          haltedAt: new Date().toISOString(),
          reason: body?.reason ?? "manual_admin_halt",
        };
      },
      {
        params: t.Object({
          symbol: t.String({ description: "Trading pair symbol" }),
        }),
        body: t.Optional(
          t.Object({
            reason: t.Optional(t.String({ description: "Reason for halting" })),
          })
        ),
        detail: {
          tags: ["circuit-breaker"],
          summary: "Manually halt a market",
          description: "Emergency halt — stops all order matching for the symbol",
        },
      }
    )

    // ─── Resume Market ───────────────────────────────────────────────────
    .post(
      "/:symbol/resume",
      async ({ params }) => {
        await db.execute(
          `UPDATE circuit_breaker_config
           SET is_halted = FALSE, 
               halted_at = NULL, 
               halted_by = NULL,
               updated_at = NOW()
           WHERE symbol = $1`,
          [params.symbol]
        );

        await db.execute(
          `UPDATE trading_pairs SET status = 'active' WHERE symbol = $1`,
          [params.symbol]
        );

        console.log(`✅ Market RESUMED: ${params.symbol}`);

        return {
          success: true,
          symbol: params.symbol,
          isHalted: false,
          resumedAt: new Date().toISOString(),
        };
      },
      {
        params: t.Object({
          symbol: t.String({ description: "Trading pair symbol" }),
        }),
        detail: {
          tags: ["circuit-breaker"],
          summary: "Resume a halted market",
        },
      }
    );
}
