/**
 * Alert Configuration Management Routes
 *
 * Admin routes for managing system alert rules and reviewing alert history.
 *
 * GET    /alerts/configs            - List all alert configurations
 * POST   /alerts/configs            - Create an alert rule
 * PUT    /alerts/configs/:id        - Update an alert rule
 * DELETE /alerts/configs/:id        - Delete an alert rule
 * GET    /alerts/history            - List alert history
 * POST   /alerts/history/:id/ack    - Acknowledge an alert
 * POST   /alerts/history/:id/resolve - Resolve an alert
 */

import { Elysia, t } from "elysia";
import type { DatabaseService } from "@dotmx/shared";

export const ALERT_TYPES = [
  "price_deviation",
  "volume_spike",
  "spread_widening",
  "liquidation_cascade",
  "order_imbalance",
  "latency_spike",
  "system_error_rate",
  "withdrawal_spike",
  "large_deposit",
  "circuit_breaker_triggered",
] as const;

export const ALERT_SEVERITIES = ["info", "warning", "critical", "emergency"] as const;

export const ALERT_CHANNELS = ["email", "slack", "webhook", "pagerduty"] as const;

export function createAlertRoutes(db: DatabaseService) {
  return new Elysia({ prefix: "/alerts" })

    // ─── List Alert Configurations ──────────────────────────────────────
    .get(
      "/configs",
      async ({ query }) => {
        try {
          const conditions: string[] = [];
          const params: any[] = [];
          let idx = 1;

          if (query.type) {
            conditions.push(`alert_type = $${idx++}`);
            params.push(query.type);
          }
          if (query.isActive !== undefined) {
            conditions.push(`is_active = $${idx++}`);
            params.push(query.isActive === "true");
          }

          const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

          const configs = await db.query<{
            id: string;
            alert_type: string;
            name: string;
            description: string | null;
            severity: string;
            condition_config: any;
            channels: string[];
            cooldown_seconds: number;
            is_active: boolean;
            created_at: string;
            updated_at: string;
          }>(
            `SELECT id, alert_type, name, description, severity, condition_config,
                    channels, cooldown_seconds, is_active, created_at, updated_at
             FROM alert_configs
             ${where}
             ORDER BY 
               CASE severity 
                 WHEN 'emergency' THEN 1 
                 WHEN 'critical' THEN 2 
                 WHEN 'warning' THEN 3 
                 ELSE 4 
               END,
               alert_type`,
            params
          );

          return {
            configs: (configs ?? []).map((c) => ({
              id: c.id,
              alertType: c.alert_type,
              name: c.name,
              description: c.description,
              severity: c.severity,
              conditionConfig: c.condition_config,
              channels: c.channels,
              cooldownSeconds: c.cooldown_seconds,
              isActive: c.is_active,
              createdAt: c.created_at,
              updatedAt: c.updated_at,
            })),
            supportedTypes: ALERT_TYPES,
            supportedChannels: ALERT_CHANNELS,
          };
        } catch (error) {
          console.error("Failed to list alert configs:", error);
          return { configs: [], supportedTypes: ALERT_TYPES, supportedChannels: ALERT_CHANNELS };
        }
      },
      {
        query: t.Object({
          type: t.Optional(t.String()),
          isActive: t.Optional(t.String()),
        }),
        detail: {
          tags: ["alerts"],
          summary: "List alert configurations",
        },
      }
    )

    // ─── Create Alert Configuration ─────────────────────────────────────
    .post(
      "/configs",
      async ({ body, set }) => {
        if (!ALERT_TYPES.includes(body.alertType as (typeof ALERT_TYPES)[number])) {
          set.status = 422;
          return { error: `Invalid alert type: ${body.alertType}`, supportedTypes: ALERT_TYPES };
        }
        if (!ALERT_SEVERITIES.includes(body.severity as (typeof ALERT_SEVERITIES)[number])) {
          set.status = 422;
          return { error: `Invalid severity: ${body.severity}` };
        }
        for (const ch of body.channels) {
          if (!ALERT_CHANNELS.includes(ch as (typeof ALERT_CHANNELS)[number])) {
            set.status = 422;
            return { error: `Invalid channel: ${ch}`, supportedChannels: ALERT_CHANNELS };
          }
        }

        try {
          const result = await db.queryOne<{ id: string; created_at: string }>(
            `INSERT INTO alert_configs 
             (alert_type, name, description, severity, condition_config, channels, cooldown_seconds, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, created_at`,
            [
              body.alertType,
              body.name,
              body.description ?? null,
              body.severity,
              JSON.stringify(body.conditionConfig),
              body.channels,
              body.cooldownSeconds ?? 300,
              body.isActive ?? true,
            ]
          );

          return {
            id: result!.id,
            alertType: body.alertType,
            name: body.name,
            severity: body.severity,
            channels: body.channels,
            createdAt: result!.created_at,
            message: "Alert configuration created",
          };
        } catch (error) {
          console.error("Failed to create alert config:", error);
          set.status = 500;
          return { error: "Failed to create alert configuration" };
        }
      },
      {
        body: t.Object({
          alertType: t.String({ description: "Alert type identifier" }),
          name: t.String({ description: "Human-readable alert name" }),
          description: t.Optional(t.String()),
          severity: t.String({ description: "info | warning | critical | emergency" }),
          conditionConfig: t.Any({ description: "JSON condition object (type-dependent)" }),
          channels: t.Array(t.String(), { description: "Notification channels" }),
          cooldownSeconds: t.Optional(t.Number({ description: "Min seconds between triggers" })),
          isActive: t.Optional(t.Boolean()),
        }),
        detail: {
          tags: ["alerts"],
          summary: "Create an alert configuration",
          description: `Example conditionConfig for price_deviation:
            { "threshold_percent": 5, "window_seconds": 60, "markets": ["BTC-USD"] }`,
        },
      }
    )

    // ─── Update Alert Configuration ─────────────────────────────────────
    .put(
      "/configs/:id",
      async ({ params, body, set }) => {
        if (body.severity && !ALERT_SEVERITIES.includes(body.severity as any)) {
          set.status = 422;
          return { error: `Invalid severity: ${body.severity}` };
        }
        if (body.channels) {
          for (const ch of body.channels) {
            if (!ALERT_CHANNELS.includes(ch as any)) {
              set.status = 422;
              return { error: `Invalid channel: ${ch}` };
            }
          }
        }

        try {
          const result = await db.queryOne<{ id: string }>(
            `UPDATE alert_configs SET
              name = COALESCE($2, name),
              description = COALESCE($3, description),
              severity = COALESCE($4, severity),
              condition_config = COALESCE($5, condition_config),
              channels = COALESCE($6, channels),
              cooldown_seconds = COALESCE($7, cooldown_seconds),
              is_active = COALESCE($8, is_active),
              updated_at = NOW()
            WHERE id = $1
            RETURNING id`,
            [
              params.id,
              body.name ?? null,
              body.description ?? null,
              body.severity ?? null,
              body.conditionConfig ? JSON.stringify(body.conditionConfig) : null,
              body.channels ?? null,
              body.cooldownSeconds ?? null,
              body.isActive ?? null,
            ]
          );

          if (!result) {
            set.status = 404;
            return { error: "Alert configuration not found" };
          }

          return { success: true, message: "Alert configuration updated" };
        } catch (error) {
          console.error("Failed to update alert config:", error);
          set.status = 500;
          return { error: "Failed to update alert configuration" };
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          description: t.Optional(t.String()),
          severity: t.Optional(t.String()),
          conditionConfig: t.Optional(t.Any()),
          channels: t.Optional(t.Array(t.String())),
          cooldownSeconds: t.Optional(t.Number()),
          isActive: t.Optional(t.Boolean()),
        }),
        detail: {
          tags: ["alerts"],
          summary: "Update an alert configuration",
        },
      }
    )

    // ─── Delete Alert Configuration ─────────────────────────────────────
    .delete(
      "/configs/:id",
      async ({ params, set }) => {
        try {
          const result = await db.queryOne<{ id: string }>(
            `DELETE FROM alert_configs WHERE id = $1 RETURNING id`,
            [params.id]
          );

          if (!result) {
            set.status = 404;
            return { error: "Alert configuration not found" };
          }

          return { success: true, message: "Alert configuration deleted" };
        } catch (error) {
          console.error("Failed to delete alert config:", error);
          set.status = 500;
          return { error: "Failed to delete alert configuration" };
        }
      },
      {
        params: t.Object({ id: t.String() }),
        detail: {
          tags: ["alerts"],
          summary: "Delete an alert configuration",
        },
      }
    )

    // ─── Alert History ──────────────────────────────────────────────────
    .get(
      "/history",
      async ({ query }) => {
        try {
          const conditions: string[] = [];
          const params: any[] = [];
          let idx = 1;

          if (query.severity) {
            conditions.push(`ah.severity = $${idx++}`);
            params.push(query.severity);
          }
          if (query.acknowledged !== undefined) {
            if (query.acknowledged === "true") {
              conditions.push(`ah.acknowledged_at IS NOT NULL`);
            } else {
              conditions.push(`ah.acknowledged_at IS NULL`);
            }
          }
          if (query.resolved !== undefined) {
            if (query.resolved === "true") {
              conditions.push(`ah.resolved_at IS NOT NULL`);
            } else {
              conditions.push(`ah.resolved_at IS NULL`);
            }
          }

          const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
          const limit = Math.min(parseInt(query.limit || "50"), 200);
          const offset = parseInt(query.offset || "0");

          const alerts = await db.query<{
            id: string;
            config_id: string;
            alert_name: string;
            alert_type: string;
            severity: string;
            message: string;
            context: any;
            acknowledged_at: string | null;
            acknowledged_by: string | null;
            resolved_at: string | null;
            resolved_by: string | null;
            resolution_note: string | null;
            triggered_at: string;
          }>(
            `SELECT ah.id, ah.config_id, ac.name as alert_name, ac.alert_type,
                    ah.severity, ah.message, ah.context,
                    ah.acknowledged_at, ah.acknowledged_by,
                    ah.resolved_at, ah.resolved_by, ah.resolution_note,
                    ah.triggered_at
             FROM alert_history ah
             JOIN alert_configs ac ON ac.id = ah.config_id
             ${where}
             ORDER BY ah.triggered_at DESC
             LIMIT ${limit} OFFSET ${offset}`,
            params
          );

          const total = await db.queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM alert_history ah ${where}`,
            params
          );

          return {
            alerts: (alerts ?? []).map((a) => ({
              id: a.id,
              configId: a.config_id,
              alertName: a.alert_name,
              alertType: a.alert_type,
              severity: a.severity,
              message: a.message,
              context: a.context,
              acknowledgedAt: a.acknowledged_at,
              acknowledgedBy: a.acknowledged_by,
              resolvedAt: a.resolved_at,
              resolvedBy: a.resolved_by,
              resolutionNote: a.resolution_note,
              triggeredAt: a.triggered_at,
            })),
            total: parseInt(total?.count || "0"),
            limit,
            offset,
          };
        } catch (error) {
          console.error("Failed to list alert history:", error);
          return { alerts: [], total: 0, limit: 50, offset: 0 };
        }
      },
      {
        query: t.Object({
          severity: t.Optional(t.String()),
          acknowledged: t.Optional(t.String()),
          resolved: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
        }),
        detail: {
          tags: ["alerts"],
          summary: "List alert history",
          description: "List triggered alerts with filtering by severity, acknowledgment, and resolution status.",
        },
      }
    )

    // ─── Acknowledge Alert ──────────────────────────────────────────────
    .post(
      "/history/:id/ack",
      async ({ params, body, set }) => {
        try {
          const result = await db.queryOne<{ id: string }>(
            `UPDATE alert_history SET
              acknowledged_at = NOW(),
              acknowledged_by = $2
            WHERE id = $1 AND acknowledged_at IS NULL
            RETURNING id`,
            [params.id, body.acknowledgedBy]
          );

          if (!result) {
            set.status = 404;
            return { error: "Alert not found or already acknowledged" };
          }

          return { success: true, message: "Alert acknowledged" };
        } catch (error) {
          console.error("Failed to acknowledge alert:", error);
          set.status = 500;
          return { error: "Failed to acknowledge alert" };
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          acknowledgedBy: t.String({ description: "Admin user ID or name" }),
        }),
        detail: {
          tags: ["alerts"],
          summary: "Acknowledge an alert",
        },
      }
    )

    // ─── Resolve Alert ──────────────────────────────────────────────────
    .post(
      "/history/:id/resolve",
      async ({ params, body, set }) => {
        try {
          const result = await db.queryOne<{ id: string }>(
            `UPDATE alert_history SET
              resolved_at = NOW(),
              resolved_by = $2,
              resolution_note = $3
            WHERE id = $1 AND resolved_at IS NULL
            RETURNING id`,
            [params.id, body.resolvedBy, body.note ?? null]
          );

          if (!result) {
            set.status = 404;
            return { error: "Alert not found or already resolved" };
          }

          return { success: true, message: "Alert resolved" };
        } catch (error) {
          console.error("Failed to resolve alert:", error);
          set.status = 500;
          return { error: "Failed to resolve alert" };
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          resolvedBy: t.String({ description: "Admin user ID or name" }),
          note: t.Optional(t.String({ description: "Resolution note" })),
        }),
        detail: {
          tags: ["alerts"],
          summary: "Resolve an alert",
        },
      }
    );
}
