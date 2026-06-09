/**
 * Withdrawal Limits Routes (Management)
 *
 * Admin endpoints for managing user withdrawal limits.
 *
 * GET    /withdrawal-limits              - List all limit tiers
 * GET    /withdrawal-limits/:userId      - Get user's effective limits + usage
 * PUT    /withdrawal-limits/tier/:tier   - Update tier default limits
 * POST   /withdrawal-limits/user/:userId - Set user-specific override
 * DELETE /withdrawal-limits/user/:userId - Remove user override (revert to tier)
 */

import { Elysia, t } from "elysia";
import type { DatabaseService } from "@dotmx/shared";

export function createWithdrawalLimitsRoutes(db: DatabaseService) {
  return new Elysia({ prefix: "/withdrawal-limits" })

    // ─── List All Tier Configurations ────────────────────────────────────
    .get(
      "/",
      async () => {
        try {
          const tiers = await db.query<{
            id: string;
            user_id: string | null;
            tier: string;
            daily_limit_usd: string;
            daily_withdrawal_count: number;
            monthly_limit_usd: string;
            monthly_withdrawal_count: number;
            min_withdrawal_usd: string;
            max_withdrawal_usd: string;
            large_withdrawal_threshold_usd: string;
            large_withdrawal_delay_hours: number;
            requires_manual_approval_above_usd: string | null;
            is_active: boolean;
            updated_at: string;
          }>(
            `SELECT * FROM withdrawal_limits WHERE user_id IS NULL ORDER BY daily_limit_usd ASC`
          );

          return {
            tiers: (tiers ?? []).map((t) => ({
              id: t.id,
              tier: t.tier,
              dailyLimitUsd: parseFloat(t.daily_limit_usd),
              dailyWithdrawalCount: t.daily_withdrawal_count,
              monthlyLimitUsd: parseFloat(t.monthly_limit_usd),
              monthlyWithdrawalCount: t.monthly_withdrawal_count,
              minWithdrawalUsd: parseFloat(t.min_withdrawal_usd),
              maxWithdrawalUsd: parseFloat(t.max_withdrawal_usd),
              largeWithdrawalThresholdUsd: parseFloat(t.large_withdrawal_threshold_usd),
              largeWithdrawalDelayHours: t.large_withdrawal_delay_hours,
              requiresManualApprovalAboveUsd: t.requires_manual_approval_above_usd
                ? parseFloat(t.requires_manual_approval_above_usd)
                : null,
              isActive: t.is_active,
              updatedAt: t.updated_at,
            })),
          };
        } catch (error) {
          console.error("Failed to fetch withdrawal limits:", error);
          return { tiers: [] };
        }
      },
      {
        detail: {
          tags: ["withdrawal-limits"],
          summary: "List all limit tier configurations",
        },
      }
    )

    // ─── Get User Effective Limits + Usage ───────────────────────────────
    .get(
      "/:userId",
      async ({ params, set }) => {
        try {
          // 1. Check for user-specific override
          const userOverride = await db.queryOne<{
            tier: string;
            daily_limit_usd: string;
            monthly_limit_usd: string;
            daily_withdrawal_count: number;
            monthly_withdrawal_count: number;
            min_withdrawal_usd: string;
            max_withdrawal_usd: string;
            large_withdrawal_threshold_usd: string;
            large_withdrawal_delay_hours: number;
            requires_manual_approval_above_usd: string | null;
          }>(
            `SELECT * FROM withdrawal_limits WHERE user_id = $1 AND is_active = TRUE`,
            [params.userId]
          );

          // 2. If no override, get user's KYC tier and look up tier defaults
          let effectiveLimits = userOverride;
          let source = "user_override";

          if (!effectiveLimits) {
            // Get user KYC level to determine tier
            const user = await db.queryOne<{ kyc_level: string }>(
              `SELECT COALESCE(kyc_level, 'none') as kyc_level FROM users WHERE id = $1`,
              [params.userId]
            );

            // kyc_level is an integer (0=none, 1=basic, 2=verified, 3=enhanced)
            const kycLevel = parseInt(user?.kyc_level || '0', 10);
            const tier = kycLevel >= 2 ? "verified" : (kycLevel >= 1 ? "basic" : "default");
            source = `tier:${tier}`;

            effectiveLimits = await db.queryOne(
              `SELECT * FROM withdrawal_limits WHERE user_id IS NULL AND tier = $1 AND is_active = TRUE`,
              [tier]
            );
          }

          if (!effectiveLimits) {
            // Fallback to hardcoded defaults
            effectiveLimits = {
              tier: "default",
              daily_limit_usd: "10000",
              monthly_limit_usd: "100000",
              daily_withdrawal_count: 10,
              monthly_withdrawal_count: 100,
              min_withdrawal_usd: "10",
              max_withdrawal_usd: "5000",
              large_withdrawal_threshold_usd: "10000",
              large_withdrawal_delay_hours: 24,
              requires_manual_approval_above_usd: "50000",
            };
            source = "hardcoded_default";
          }

          // 3. Calculate current usage (24h rolling window for daily, 30d for monthly)
          const dailyUsage = await db.queryOne<{
            total_usd: string;
            count: string;
          }>(
            `SELECT COALESCE(SUM(amount_usd), 0) as total_usd, COUNT(*) as count
             FROM withdrawal_usage
             WHERE user_id = $1 AND timestamp > NOW() - INTERVAL '24 hours'`,
            [params.userId]
          );

          const monthlyUsage = await db.queryOne<{
            total_usd: string;
            count: string;
          }>(
            `SELECT COALESCE(SUM(amount_usd), 0) as total_usd, COUNT(*) as count
             FROM withdrawal_usage
             WHERE user_id = $1 AND timestamp > NOW() - INTERVAL '30 days'`,
            [params.userId]
          );

          return {
            userId: params.userId,
            source,
            limits: {
              dailyLimitUsd: parseFloat(effectiveLimits.daily_limit_usd),
              monthlyLimitUsd: parseFloat(effectiveLimits.monthly_limit_usd),
              dailyWithdrawalCount: effectiveLimits.daily_withdrawal_count,
              monthlyWithdrawalCount: effectiveLimits.monthly_withdrawal_count,
              minWithdrawalUsd: parseFloat(effectiveLimits.min_withdrawal_usd),
              maxWithdrawalUsd: parseFloat(effectiveLimits.max_withdrawal_usd),
              largeWithdrawalThresholdUsd: parseFloat(
                effectiveLimits.large_withdrawal_threshold_usd
              ),
              largeWithdrawalDelayHours: effectiveLimits.large_withdrawal_delay_hours,
              requiresManualApprovalAboveUsd: effectiveLimits.requires_manual_approval_above_usd
                ? parseFloat(effectiveLimits.requires_manual_approval_above_usd)
                : null,
            },
            usage: {
              daily: {
                amountUsd: dailyUsage ? parseFloat(dailyUsage.total_usd) : 0,
                count: dailyUsage ? parseInt(dailyUsage.count) : 0,
                remainingUsd: Math.max(
                  0,
                  parseFloat(effectiveLimits.daily_limit_usd) -
                  (dailyUsage ? parseFloat(dailyUsage.total_usd) : 0)
                ),
                remainingCount: Math.max(
                  0,
                  effectiveLimits.daily_withdrawal_count -
                  (dailyUsage ? parseInt(dailyUsage.count) : 0)
                ),
              },
              monthly: {
                amountUsd: monthlyUsage ? parseFloat(monthlyUsage.total_usd) : 0,
                count: monthlyUsage ? parseInt(monthlyUsage.count) : 0,
                remainingUsd: Math.max(
                  0,
                  parseFloat(effectiveLimits.monthly_limit_usd) -
                  (monthlyUsage ? parseFloat(monthlyUsage.total_usd) : 0)
                ),
                remainingCount: Math.max(
                  0,
                  effectiveLimits.monthly_withdrawal_count -
                  (monthlyUsage ? parseInt(monthlyUsage.count) : 0)
                ),
              },
            },
          };
        } catch (error) {
          console.error("Failed to fetch user withdrawal limits:", error);
          set.status = 500;
          return { error: "Failed to fetch withdrawal limits" };
        }
      },
      {
        params: t.Object({
          userId: t.String({ description: "User ID" }),
        }),
        detail: {
          tags: ["withdrawal-limits"],
          summary: "Get user effective limits and usage",
        },
      }
    )

    // ─── Update Tier Default Limits ──────────────────────────────────────
    .put(
      "/tier/:tier",
      async ({ params, body, set }) => {
        try {
          const result = await db.queryOne<{ id: string }>(
            `UPDATE withdrawal_limits SET
              daily_limit_usd = COALESCE($2, daily_limit_usd),
              monthly_limit_usd = COALESCE($3, monthly_limit_usd),
              daily_withdrawal_count = COALESCE($4, daily_withdrawal_count),
              monthly_withdrawal_count = COALESCE($5, monthly_withdrawal_count),
              min_withdrawal_usd = COALESCE($6, min_withdrawal_usd),
              max_withdrawal_usd = COALESCE($7, max_withdrawal_usd),
              large_withdrawal_threshold_usd = COALESCE($8, large_withdrawal_threshold_usd),
              large_withdrawal_delay_hours = COALESCE($9, large_withdrawal_delay_hours),
              requires_manual_approval_above_usd = COALESCE($10, requires_manual_approval_above_usd),
              updated_at = NOW()
            WHERE tier = $1 AND user_id IS NULL
            RETURNING id`,
            [
              params.tier,
              body.dailyLimitUsd,
              body.monthlyLimitUsd,
              body.dailyWithdrawalCount,
              body.monthlyWithdrawalCount,
              body.minWithdrawalUsd,
              body.maxWithdrawalUsd,
              body.largeWithdrawalThresholdUsd,
              body.largeWithdrawalDelayHours,
              body.requiresManualApprovalAboveUsd,
            ]
          );

          if (!result) {
            set.status = 404;
            return { error: `Tier '${params.tier}' not found` };
          }

          return { success: true, tier: params.tier, message: "Tier limits updated" };
        } catch (error) {
          console.error("Failed to update tier limits:", error);
          set.status = 500;
          return { error: "Failed to update tier limits" };
        }
      },
      {
        params: t.Object({
          tier: t.String({ description: "Tier name (default, verified, premium, institutional)" }),
        }),
        body: t.Object({
          dailyLimitUsd: t.Optional(t.Number()),
          monthlyLimitUsd: t.Optional(t.Number()),
          dailyWithdrawalCount: t.Optional(t.Number()),
          monthlyWithdrawalCount: t.Optional(t.Number()),
          minWithdrawalUsd: t.Optional(t.Number()),
          maxWithdrawalUsd: t.Optional(t.Number()),
          largeWithdrawalThresholdUsd: t.Optional(t.Number()),
          largeWithdrawalDelayHours: t.Optional(t.Number()),
          requiresManualApprovalAboveUsd: t.Optional(t.Number()),
        }),
        detail: {
          tags: ["withdrawal-limits"],
          summary: "Update tier default limits",
        },
      }
    )

    // ─── Set User-Specific Override ──────────────────────────────────────
    .post(
      "/user/:userId",
      async ({ params, body, set }) => {
        try {
          // Upsert user-specific limits
          await db.execute(
            `INSERT INTO withdrawal_limits (
              user_id, tier, daily_limit_usd, monthly_limit_usd,
              daily_withdrawal_count, monthly_withdrawal_count,
              min_withdrawal_usd, max_withdrawal_usd,
              large_withdrawal_threshold_usd, large_withdrawal_delay_hours,
              requires_manual_approval_above_usd
            ) VALUES ($1, 'custom', $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (user_id) DO UPDATE SET
              daily_limit_usd = COALESCE($2, withdrawal_limits.daily_limit_usd),
              monthly_limit_usd = COALESCE($3, withdrawal_limits.monthly_limit_usd),
              daily_withdrawal_count = COALESCE($4, withdrawal_limits.daily_withdrawal_count),
              monthly_withdrawal_count = COALESCE($5, withdrawal_limits.monthly_withdrawal_count),
              min_withdrawal_usd = COALESCE($6, withdrawal_limits.min_withdrawal_usd),
              max_withdrawal_usd = COALESCE($7, withdrawal_limits.max_withdrawal_usd),
              large_withdrawal_threshold_usd = COALESCE($8, withdrawal_limits.large_withdrawal_threshold_usd),
              large_withdrawal_delay_hours = COALESCE($9, withdrawal_limits.large_withdrawal_delay_hours),
              requires_manual_approval_above_usd = COALESCE($10, withdrawal_limits.requires_manual_approval_above_usd),
              is_active = TRUE,
              updated_at = NOW()`,
            [
              params.userId,
              body.dailyLimitUsd,
              body.monthlyLimitUsd,
              body.dailyWithdrawalCount,
              body.monthlyWithdrawalCount,
              body.minWithdrawalUsd,
              body.maxWithdrawalUsd,
              body.largeWithdrawalThresholdUsd,
              body.largeWithdrawalDelayHours,
              body.requiresManualApprovalAboveUsd,
            ]
          );

          return {
            success: true,
            userId: params.userId,
            message: "User-specific withdrawal limits set",
          };
        } catch (error) {
          console.error("Failed to set user limits:", error);
          set.status = 500;
          return { error: "Failed to set user limits" };
        }
      },
      {
        params: t.Object({
          userId: t.String({ description: "User ID" }),
        }),
        body: t.Object({
          dailyLimitUsd: t.Optional(t.Number()),
          monthlyLimitUsd: t.Optional(t.Number()),
          dailyWithdrawalCount: t.Optional(t.Number()),
          monthlyWithdrawalCount: t.Optional(t.Number()),
          minWithdrawalUsd: t.Optional(t.Number()),
          maxWithdrawalUsd: t.Optional(t.Number()),
          largeWithdrawalThresholdUsd: t.Optional(t.Number()),
          largeWithdrawalDelayHours: t.Optional(t.Number()),
          requiresManualApprovalAboveUsd: t.Optional(t.Number()),
        }),
        detail: {
          tags: ["withdrawal-limits"],
          summary: "Set user-specific withdrawal limits override",
        },
      }
    )

    // ─── Remove User Override ────────────────────────────────────────────
    .delete(
      "/user/:userId",
      async ({ params, set }) => {
        try {
          const result = await db.queryOne<{ id: string }>(
            `DELETE FROM withdrawal_limits WHERE user_id = $1 RETURNING id`,
            [params.userId]
          );

          if (!result) {
            set.status = 404;
            return { error: "No user-specific limits found" };
          }

          return {
            success: true,
            userId: params.userId,
            message: "User limits removed, reverted to tier defaults",
          };
        } catch (error) {
          console.error("Failed to remove user limits:", error);
          set.status = 500;
          return { error: "Failed to remove user limits" };
        }
      },
      {
        params: t.Object({
          userId: t.String({ description: "User ID" }),
        }),
        detail: {
          tags: ["withdrawal-limits"],
          summary: "Remove user limit override (revert to tier defaults)",
        },
      }
    );
}
