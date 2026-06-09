// @ts-nocheck
/**
 * Loyalty & Referral API Routes
 */

import { Elysia, t } from 'elysia';
import type { AuthContext } from '../../../shared/src/middleware/auth.middleware';
import { LoyaltyPointsService } from '../../../shared/src/services/loyalty.service';
import { ReferralService } from '../../../shared/src/services/referral.service';
import { DatabaseService } from '../../../shared/src/services/database';

export const loyaltyRoutes = (db: DatabaseService) => {
  const loyaltyService = new LoyaltyPointsService(db, {
    base_points_per_usd_volume: parseFloat(process.env.POINTS_PER_USD_VOLUME || '0.01'),
    min_volume_for_points: parseFloat(process.env.MIN_VOLUME_FOR_POINTS || '10'),
    max_daily_points: parseFloat(process.env.MAX_DAILY_POINTS || '100000'),
  });

  const referralService = new ReferralService(db, loyaltyService, {
    default_signup_reward: parseFloat(process.env.REFERRAL_SIGNUP_REWARD || '100'),
    default_first_trade_reward: parseFloat(process.env.REFERRAL_FIRST_TRADE_REWARD || '500'),
    default_commission_percentage: parseFloat(process.env.REFERRAL_COMMISSION_PCT || '10'),
  });

  return new Elysia({ prefix: '/loyalty' })
    // Get user's loyalty points
    .get(
      '/points',
      async ({ user }: AuthContext) => {
        const points = await loyaltyService.getUserPoints(user.id);
        if (!points) {
          return {
            error: 'Loyalty points not found',
            code: 'NOT_FOUND',
          };
        }

        return {
          success: true,
          data: points,
        };
      },
      {
        detail: {
          tags: ['Loyalty'],
          summary: 'Get user loyalty points',
          description: 'Get current loyalty points balance and tier information',
        },
      }
    )

    // Get points transaction history
    .get(
      '/history',
      async ({ user, query }: AuthContext & { query: { limit?: number; offset?: number } }) => {
        const limit = Math.min(query.limit || 50, 100);
        const offset = query.offset || 0;

        const transactions = await loyaltyService.getPointsTransactions(user.id, limit, offset);

        return {
          success: true,
          data: transactions,
          pagination: {
            limit,
            offset,
            has_more: transactions.length === limit,
          },
        };
      },
      {
        query: t.Object({
          limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
          offset: t.Optional(t.Number({ minimum: 0 })),
        }),
        detail: {
          tags: ['Loyalty'],
          summary: 'Get points history',
          description: 'Get transaction history of loyalty points',
        },
      }
    )

    // Get user statistics
    .get(
      '/statistics',
      async ({ user }: AuthContext) => {
        const stats = await loyaltyService.getUserStatistics(user.id);

        return {
          success: true,
          data: stats || {},
        };
      },
      {
        detail: {
          tags: ['Loyalty'],
          summary: 'Get user statistics',
          description: 'Get comprehensive trading and loyalty statistics',
        },
      }
    )

    // Get leaderboard
    .get(
      '/leaderboard',
      async ({
        query,
      }: {
        query: {
          type: 'points' | 'volume' | 'profit';
          period?: 'daily' | 'weekly' | 'monthly' | 'all_time';
          limit?: number;
        };
      }) => {
        const type = query.type || 'points';
        const period = query.period || 'all_time';
        const limit = Math.min(query.limit || 100, 500);

        const leaderboard = await loyaltyService.getLeaderboard(type, period, limit);

        return {
          success: true,
          data: leaderboard,
          metadata: {
            type,
            period,
            count: leaderboard.length,
          },
        };
      },
      {
        query: t.Object({
          type: t.Union([t.Literal('points'), t.Literal('volume'), t.Literal('profit')]),
          period: t.Optional(
            t.Union([
              t.Literal('daily'),
              t.Literal('weekly'),
              t.Literal('monthly'),
              t.Literal('all_time'),
            ])
          ),
          limit: t.Optional(t.Number({ minimum: 1, maximum: 500 })),
        }),
        detail: {
          tags: ['Loyalty'],
          summary: 'Get leaderboard',
          description: 'Get rankings by points, volume, or profit',
        },
      }
    )

    // Spend points (redeem rewards)
    .post(
      '/spend',
      async ({ user, body }: AuthContext & { body: any }) => {
        try {
          const transaction = await loyaltyService.spendPoints(
            user.id,
            body.amount,
            body.source || 'manual_redemption',
            body.description || 'Points redemption',
            body.metadata || {}
          );

          return {
            success: true,
            data: transaction,
            message: 'Points spent successfully',
          };
        } catch (error: any) {
          return {
            error: error.message || 'Failed to spend points',
            code: 'SPEND_FAILED',
          };
        }
      },
      {
        body: t.Object({
          amount: t.Number({ minimum: 1 }),
          source: t.Optional(t.String()),
          description: t.Optional(t.String()),
          metadata: t.Optional(t.Record(t.String(), t.Any())),
        }),
        detail: {
          tags: ['Loyalty'],
          summary: 'Spend points',
          description: 'Spend loyalty points for rewards or benefits',
        },
      }
    )

    // Create referral code
    .post(
      '/referral/create',
      async ({ user, body }: AuthContext & { body: any }) => {
        try {
          const code = await referralService.createReferralCode(user.id, {
            custom_code: body.custom_code,
            max_uses: body.max_uses,
            expires_at: body.expires_at ? new Date(body.expires_at) : undefined,
            signup_reward: body.signup_reward,
            first_trade_reward: body.first_trade_reward,
            commission_percentage: body.commission_percentage,
          });

          return {
            success: true,
            data: code,
            message: 'Referral code created successfully',
          };
        } catch (error: any) {
          return {
            error: error.message || 'Failed to create referral code',
            code: 'CREATE_FAILED',
          };
        }
      },
      {
        body: t.Object({
          custom_code: t.Optional(t.String({ minLength: 6, maxLength: 20 })),
          max_uses: t.Optional(t.Number({ minimum: 1 })),
          expires_at: t.Optional(t.String()),
          signup_reward: t.Optional(t.Number({ minimum: 0 })),
          first_trade_reward: t.Optional(t.Number({ minimum: 0 })),
          commission_percentage: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        }),
        detail: {
          tags: ['Referral'],
          summary: 'Create referral code',
          description: 'Create a new referral code with custom settings',
        },
      }
    )

    // Get user's referral codes
    .get(
      '/referral/codes',
      async ({ user }: AuthContext) => {
        const codes = await referralService.getUserReferralCodes(user.id);

        return {
          success: true,
          data: codes,
        };
      },
      {
        detail: {
          tags: ['Referral'],
          summary: 'Get referral codes',
          description: "Get all user's referral codes",
        },
      }
    )

    // Apply referral code
    .post(
      '/referral/apply',
      async ({ user, body }: AuthContext & { body: { code: string } }) => {
        try {
          const referral = await referralService.applyReferralCode(user.id, body.code);

          return {
            success: true,
            data: referral,
            message: 'Referral code applied successfully',
          };
        } catch (error: any) {
          return {
            error: error.message || 'Failed to apply referral code',
            code: 'APPLY_FAILED',
          };
        }
      },
      {
        body: t.Object({
          code: t.String({ minLength: 6, maxLength: 20 }),
        }),
        detail: {
          tags: ['Referral'],
          summary: 'Apply referral code',
          description: 'Apply a referral code during signup',
        },
      }
    )

    // Get referral statistics
    .get(
      '/referral/statistics',
      async ({ user }: AuthContext) => {
        const stats = await referralService.getReferralStatistics(user.id);

        return {
          success: true,
          data: stats,
        };
      },
      {
        detail: {
          tags: ['Referral'],
          summary: 'Get referral statistics',
          description: 'Get comprehensive referral statistics and earnings',
        },
      }
    )

    // Get user's referrals
    .get(
      '/referral/list',
      async ({ user, query }: AuthContext & { query: { limit?: number; offset?: number } }) => {
        const limit = Math.min(query.limit || 50, 100);
        const offset = query.offset || 0;

        const referrals = await referralService.getUserReferrals(user.id, limit, offset);

        return {
          success: true,
          data: referrals,
          pagination: {
            limit,
            offset,
            has_more: referrals.length === limit,
          },
        };
      },
      {
        query: t.Object({
          limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
          offset: t.Optional(t.Number({ minimum: 0 })),
        }),
        detail: {
          tags: ['Referral'],
          summary: 'Get referrals',
          description: 'Get list of referred users',
        },
      }
    )

    // Update referral code
    .patch(
      '/referral/:code_id',
      async ({ user, params, body }: AuthContext & { params: { code_id: string }; body: any }) => {
        try {
          const code = await referralService.updateReferralCode(user.id, params.code_id, {
            max_uses: body.max_uses,
            expires_at: body.expires_at ? new Date(body.expires_at) : undefined,
            signup_reward: body.signup_reward,
            first_trade_reward: body.first_trade_reward,
            commission_percentage: body.commission_percentage,
            is_active: body.is_active,
          });

          return {
            success: true,
            data: code,
            message: 'Referral code updated successfully',
          };
        } catch (error: any) {
          return {
            error: error.message || 'Failed to update referral code',
            code: 'UPDATE_FAILED',
          };
        }
      },
      {
        params: t.Object({
          code_id: t.String(),
        }),
        body: t.Object({
          max_uses: t.Optional(t.Number({ minimum: 1 })),
          expires_at: t.Optional(t.String()),
          signup_reward: t.Optional(t.Number({ minimum: 0 })),
          first_trade_reward: t.Optional(t.Number({ minimum: 0 })),
          commission_percentage: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
          is_active: t.Optional(t.Boolean()),
        }),
        detail: {
          tags: ['Referral'],
          summary: 'Update referral code',
          description: 'Update referral code settings',
        },
      }
    )

    // Deactivate referral code
    .delete(
      '/referral/:code_id',
      async ({ user, params }: AuthContext & { params: { code_id: string } }) => {
        try {
          await referralService.deactivateReferralCode(user.id, params.code_id);

          return {
            success: true,
            message: 'Referral code deactivated successfully',
          };
        } catch (error: any) {
          return {
            error: error.message || 'Failed to deactivate referral code',
            code: 'DEACTIVATE_FAILED',
          };
        }
      },
      {
        params: t.Object({
          code_id: t.String(),
        }),
        detail: {
          tags: ['Referral'],
          summary: 'Deactivate referral code',
          description: 'Deactivate a referral code',
        },
      }
    );
};
