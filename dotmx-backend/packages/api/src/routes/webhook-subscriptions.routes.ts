/**
 * Webhook Subscription Routes (User-facing, Outbound)
 *
 * Allow users to subscribe to event notifications via outbound webhooks.
 * Separate from webhooks.routes.ts which handles inbound Alchemy webhooks.
 *
 * GET    /api/v1/webhook-subscriptions              - List user's subscriptions
 * POST   /api/v1/webhook-subscriptions              - Create a subscription
 * GET    /api/v1/webhook-subscriptions/:id          - Get details + delivery log
 * PUT    /api/v1/webhook-subscriptions/:id          - Update a subscription
 * DELETE /api/v1/webhook-subscriptions/:id          - Delete a subscription
 * POST   /api/v1/webhook-subscriptions/:id/test     - Send a test event
 */

import { Elysia, t } from "elysia";
import type { DatabaseService, AuthService } from "@dotmx/shared";
import { randomBytes, createHmac } from "crypto";

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

function requireUser(ctx: { user: AuthUser | null }): AuthUser {
  if (!ctx.user) throw new Error("Authentication required");
  return ctx.user;
}

/** Supported webhook event types */
export const SUPPORTED_WEBHOOK_EVENTS = [
  "order.placed",
  "order.filled",
  "order.partially_filled",
  "order.cancelled",
  "order.rejected",
  "trade.executed",
  "deposit.confirmed",
  "deposit.pending",
  "withdrawal.approved",
  "withdrawal.completed",
  "withdrawal.failed",
  "withdrawal.cancelled",
  "position.opened",
  "position.closed",
  "position.liquidated",
  "funding.payment",
  "margin.call",
] as const;

export function createWebhookSubscriptionRoutes(
  db: DatabaseService,
  authService?: AuthService
) {
  return new Elysia({ prefix: "/v1/webhook-subscriptions" })
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

    // ─── List Subscriptions ──────────────────────────────────────────────
    .get(
      "/",
      async ({ user, set }) => {
        const currentUser = requireUser({ user });

        try {
          const subs = await db.query<{
            id: string;
            url: string;
            events: string[];
            is_active: boolean;
            failures: number;
            max_failures: number;
            last_success_at: string | null;
            last_failure_at: string | null;
            created_at: string;
          }>(
            `SELECT id, url, events, is_active, failures, max_failures,
                    last_success_at, last_failure_at, created_at
             FROM webhook_subscriptions
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [currentUser.id]
          );

          return {
            subscriptions: (subs ?? []).map((s) => ({
              id: s.id,
              url: s.url,
              events: s.events,
              isActive: s.is_active,
              failures: s.failures,
              maxFailures: s.max_failures,
              lastSuccessAt: s.last_success_at,
              lastFailureAt: s.last_failure_at,
              createdAt: s.created_at,
            })),
            supportedEvents: SUPPORTED_WEBHOOK_EVENTS,
          };
        } catch (error) {
          console.error("Failed to list webhooks:", error);
          return { subscriptions: [], supportedEvents: SUPPORTED_WEBHOOK_EVENTS };
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
          tags: ["webhook-subscriptions"],
          summary: "List webhook subscriptions",
        },
      }
    )

    // ─── Create Subscription ─────────────────────────────────────────────
    .post(
      "/",
      async ({ body, user, set }) => {
        const currentUser = requireUser({ user });

        // Validate events
        for (const event of body.events) {
          if (
            !SUPPORTED_WEBHOOK_EVENTS.includes(event as (typeof SUPPORTED_WEBHOOK_EVENTS)[number])
          ) {
            set.status = 422;
            return {
              error: `Unsupported event type: ${event}`,
              supportedEvents: SUPPORTED_WEBHOOK_EVENTS,
            };
          }
        }

        // Validate URL
        try {
          const parsed = new URL(body.url);
          if (!["https:", "http:"].includes(parsed.protocol)) {
            set.status = 422;
            return { error: "Webhook URL must use HTTP(S)" };
          }
        } catch {
          set.status = 422;
          return { error: "Invalid webhook URL" };
        }

        // Check subscription limit (max 10 per user)
        const count = await db.queryOne<{ count: string }>(
          `SELECT COUNT(*) as count FROM webhook_subscriptions WHERE user_id = $1`,
          [currentUser.id]
        );
        if (count && parseInt(count.count) >= 10) {
          set.status = 422;
          return { error: "Maximum 10 webhook subscriptions per user" };
        }

        // Generate HMAC secret
        const secret = randomBytes(32).toString("hex");

        try {
          const sub = await db.queryOne<{ id: string; created_at: string }>(
            `INSERT INTO webhook_subscriptions (user_id, url, events, secret)
             VALUES ($1, $2, $3, $4)
             RETURNING id, created_at`,
            [currentUser.id, body.url, body.events, secret]
          );

          return {
            id: sub!.id,
            url: body.url,
            events: body.events,
            secret, // Only returned on creation
            isActive: true,
            createdAt: sub!.created_at,
            message:
              "Save the secret — it signs webhook payloads via HMAC-SHA256 and cannot be retrieved later.",
          };
        } catch (error) {
          console.error("Failed to create webhook:", error);
          set.status = 500;
          return { error: "Failed to create webhook subscription" };
        }
      },
      {
        body: t.Object({
          url: t.String({ description: "Webhook endpoint URL (HTTPS recommended)" }),
          events: t.Array(t.String(), {
            description: "Event types to subscribe to",
            minItems: 1,
          }),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["webhook-subscriptions"],
          summary: "Create a webhook subscription",
          description:
            "Create a new outbound webhook subscription. Returns a secret for HMAC-SHA256 signature verification.",
        },
      }
    )

    // ─── Get Subscription Details + Delivery History ─────────────────────
    .get(
      "/:id",
      async ({ params, user, set }) => {
        const currentUser = requireUser({ user });

        try {
          const sub = await db.queryOne<{
            id: string;
            url: string;
            events: string[];
            is_active: boolean;
            failures: number;
            max_failures: number;
            last_success_at: string | null;
            last_failure_at: string | null;
            last_failure_reason: string | null;
            created_at: string;
          }>(
            `SELECT id, url, events, is_active, failures, max_failures,
                    last_success_at, last_failure_at, last_failure_reason, created_at
             FROM webhook_subscriptions
             WHERE id = $1 AND user_id = $2`,
            [params.id, currentUser.id]
          );

          if (!sub) {
            set.status = 404;
            return { error: "Webhook subscription not found" };
          }

          const deliveries = await db.query<{
            id: string;
            event_type: string;
            status: string;
            response_status: number | null;
            response_time_ms: number | null;
            attempt: number;
            created_at: string;
            delivered_at: string | null;
          }>(
            `SELECT id, event_type, status, response_status, response_time_ms,
                    attempt, created_at, delivered_at
             FROM webhook_deliveries
             WHERE subscription_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [params.id]
          );

          return {
            subscription: {
              id: sub.id,
              url: sub.url,
              events: sub.events,
              isActive: sub.is_active,
              failures: sub.failures,
              maxFailures: sub.max_failures,
              lastSuccessAt: sub.last_success_at,
              lastFailureAt: sub.last_failure_at,
              lastFailureReason: sub.last_failure_reason,
              createdAt: sub.created_at,
            },
            recentDeliveries: (deliveries ?? []).map((d) => ({
              id: d.id,
              eventType: d.event_type,
              status: d.status,
              responseStatus: d.response_status,
              responseTimeMs: d.response_time_ms,
              attempt: d.attempt,
              createdAt: d.created_at,
              deliveredAt: d.delivered_at,
            })),
          };
        } catch (error) {
          console.error("Failed to get webhook details:", error);
          set.status = 500;
          return { error: "Failed to get webhook details" };
        }
      },
      {
        params: t.Object({
          id: t.String({ description: "Subscription ID" }),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["webhook-subscriptions"],
          summary: "Get subscription details with delivery history",
        },
      }
    )

    // ─── Update Subscription ─────────────────────────────────────────────
    .put(
      "/:id",
      async ({ params, body, user, set }) => {
        const currentUser = requireUser({ user });

        if (body.events) {
          for (const event of body.events) {
            if (
              !SUPPORTED_WEBHOOK_EVENTS.includes(
                event as (typeof SUPPORTED_WEBHOOK_EVENTS)[number]
              )
            ) {
              set.status = 422;
              return { error: `Unsupported event type: ${event}` };
            }
          }
        }

        if (body.url) {
          try {
            new URL(body.url);
          } catch {
            set.status = 422;
            return { error: "Invalid webhook URL" };
          }
        }

        try {
          const result = await db.queryOne<{ id: string }>(
            `UPDATE webhook_subscriptions SET
              url = COALESCE($3, url),
              events = COALESCE($4, events),
              is_active = COALESCE($5, is_active),
              failures = CASE WHEN $5 = TRUE THEN 0 ELSE failures END,
              updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            RETURNING id`,
            [params.id, currentUser.id, body.url, body.events, body.isActive]
          );

          if (!result) {
            set.status = 404;
            return { error: "Webhook subscription not found" };
          }

          return { success: true, message: "Webhook updated" };
        } catch (error) {
          console.error("Failed to update webhook:", error);
          set.status = 500;
          return { error: "Failed to update webhook" };
        }
      },
      {
        params: t.Object({
          id: t.String({ description: "Subscription ID" }),
        }),
        body: t.Object({
          url: t.Optional(t.String()),
          events: t.Optional(t.Array(t.String())),
          isActive: t.Optional(t.Boolean()),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["webhook-subscriptions"],
          summary: "Update a webhook subscription",
        },
      }
    )

    // ─── Delete Subscription ─────────────────────────────────────────────
    .delete(
      "/:id",
      async ({ params, user, set }) => {
        const currentUser = requireUser({ user });

        try {
          const result = await db.queryOne<{ id: string }>(
            `DELETE FROM webhook_subscriptions WHERE id = $1 AND user_id = $2 RETURNING id`,
            [params.id, currentUser.id]
          );

          if (!result) {
            set.status = 404;
            return { error: "Webhook subscription not found" };
          }

          return { success: true, message: "Webhook subscription deleted" };
        } catch (error) {
          console.error("Failed to delete webhook:", error);
          set.status = 500;
          return { error: "Failed to delete webhook" };
        }
      },
      {
        params: t.Object({
          id: t.String({ description: "Subscription ID" }),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["webhook-subscriptions"],
          summary: "Delete a webhook subscription",
        },
      }
    )

    // ─── Test Webhook ────────────────────────────────────────────────────
    .post(
      "/:id/test",
      async ({ params, user, set }) => {
        const currentUser = requireUser({ user });

        try {
          const sub = await db.queryOne<{
            id: string;
            url: string;
            secret: string;
          }>(
            `SELECT id, url, secret FROM webhook_subscriptions 
             WHERE id = $1 AND user_id = $2`,
            [params.id, currentUser.id]
          );

          if (!sub) {
            set.status = 404;
            return { error: "Webhook subscription not found" };
          }

          const testPayload = {
            event: "test",
            data: {
              message: "This is a test webhook delivery from DotMX",
              timestamp: new Date().toISOString(),
              subscriptionId: sub.id,
            },
          };

          const payloadStr = JSON.stringify(testPayload);
          const signature = createHmac("sha256", sub.secret)
            .update(payloadStr)
            .digest("hex");

          const startTime = Date.now();
          let responseStatus = 0;
          let responseBody = "";

          try {
            const response = await fetch(sub.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-DotMX-Signature": `sha256=${signature}`,
                "X-DotMX-Event": "test",
                "X-DotMX-Delivery": sub.id,
              },
              body: payloadStr,
              signal: AbortSignal.timeout(10000),
            });

            responseStatus = response.status;
            responseBody = await response.text().catch(() => "");
          } catch (err: any) {
            responseBody = err.message;
          }

          const responseTimeMs = Date.now() - startTime;
          const isSuccess = responseStatus >= 200 && responseStatus < 300;

          // Log delivery
          await db.execute(
            `INSERT INTO webhook_deliveries 
             (subscription_id, event_type, payload, status, response_status, response_body, response_time_ms, delivered_at)
             VALUES ($1, 'test', $2, $3, $4, $5, $6, NOW())`,
            [
              sub.id,
              testPayload,
              isSuccess ? "success" : "failed",
              responseStatus || null,
              responseBody.substring(0, 1000),
              responseTimeMs,
            ]
          );

          return {
            success: isSuccess,
            responseStatus,
            responseTimeMs,
            message: isSuccess
              ? "Test webhook delivered successfully"
              : "Test webhook delivery failed",
          };
        } catch (error) {
          console.error("Failed to send test webhook:", error);
          set.status = 500;
          return { error: "Failed to send test webhook" };
        }
      },
      {
        params: t.Object({
          id: t.String({ description: "Subscription ID" }),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error("Authentication required");
          }
        },
        detail: {
          tags: ["webhook-subscriptions"],
          summary: "Send a test webhook event",
          description:
            "Sends a test payload to the webhook URL with HMAC-SHA256 signature and reports the result.",
        },
      }
    );
}
