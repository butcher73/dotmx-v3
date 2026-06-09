/**
 * Users Management Routes
 */

import { Elysia, t } from 'elysia';
import type { DatabaseService } from '@dotmx/shared';
import type { UserListItem, UserDetail, PaginatedResponse } from '../types';

export function createUsersRoutes(db: DatabaseService) {
  console.log('🔧 [Users] Routes initialized');

  return new Elysia({ prefix: '/users' })
    .get(
      '/',
      async ({ query }) => {
        console.log('');
        console.log('════════════════════════════════════════');
        console.log('📋 [Users] GET /users - REQUEST RECEIVED');
        console.log('════════════════════════════════════════');
        console.log('Query params:', JSON.stringify(query));

        const page = query.page || 1;
        const pageSize = query.pageSize || 20;
        const offset = (page - 1) * pageSize;
        const search = query.search || '';
        const status = query.status;
        const role = query.role;

        try {
          let whereClause = 'WHERE 1=1';
          const params: (string | number)[] = [];
          let paramIndex = 1;

          if (search) {
            whereClause += ` AND (u.email ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
          }

          if (status) {
            whereClause += ` AND u.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
          }

          if (role) {
            whereClause += ` AND u.role = $${paramIndex}`;
            params.push(role);
            paramIndex++;
          }

          // Get total count
          console.log('[Users] Running count query...');
          const countResult = await db.queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM users u ${whereClause}`,
            params
          );
          const totalItems = parseInt(countResult?.count || '0', 10);
          console.log(`[Users] Total users found: ${totalItems}`);

          // Get users - simplified query without kyc_applications join initially
          console.log('[Users] Fetching users list...');
          const users = await db.query<{
            id: string;
            email: string;
            username: string | null;
            first_name: string | null;
            last_name: string | null;
            role: string;
            status: string;
            email_verified: boolean;
            created_at: string;
            last_login_at: string | null;
          }>(
            `SELECT
               u.id, u.email, u.username, u.first_name, u.last_name,
               u.role, u.status, u.email_verified, u.created_at, u.last_login_at
             FROM users u
             ${whereClause}
             ORDER BY u.created_at DESC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, pageSize, offset]
          );

          const response: PaginatedResponse<UserListItem> = {
            data: users.map(u => ({
              id: u.id,
              email: u.email,
              username: u.username,
              firstName: u.first_name,
              lastName: u.last_name,
              role: u.role,
              status: u.status as UserListItem['status'],
              kycStatus: 'none' as UserListItem['kycStatus'],
              emailVerified: u.email_verified,
              createdAt: u.created_at,
              lastLoginAt: u.last_login_at
            })),
            pagination: {
              page,
              pageSize,
              totalItems,
              totalPages: Math.ceil(totalItems / pageSize)
            }
          };

          console.log(`[Users] Returning ${users.length} users`);

          return response;
        } catch (error) {
          console.error('[Users] ❌ Failed to fetch users:', error);
          console.error('[Users] Error stack:', (error as Error).stack);
          return {
            data: [],
            pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }
          };
        }
      },
      {
        query: t.Object({
          page: t.Optional(t.Number({ minimum: 1 })),
          pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
          search: t.Optional(t.String()),
          status: t.Optional(t.String()),
          role: t.Optional(t.String())
        }),
        detail: {
          tags: ['users'],
          summary: 'List users',
          description: 'Get paginated list of users with optional filtering'
        }
      }
    )
    .get(
      '/:userId',
      async ({ params }) => {
        try {
          const user = await db.queryOne<{
            id: string;
            email: string;
            username: string | null;
            first_name: string | null;
            last_name: string | null;
            avatar_url: string | null;
            role: string;
            status: string;
            email_verified: boolean;
            mfa_enabled: boolean;
            created_at: string;
            last_login_at: string | null;
            metadata: Record<string, unknown>;
          }>(
            `SELECT id, email, username, first_name, last_name, avatar_url,
                    role, status, email_verified, mfa_enabled, created_at,
                    last_login_at, metadata
             FROM users
             WHERE id = $1 AND deleted_at IS NULL`,
            [params.userId]
          );

          if (!user) {
            return { error: 'User not found' };
          }

          // Get KYC status (handle case where kyc_applications table doesn't exist)
          let kyc: { status: string } | null = null;
          try {
            kyc = await db.queryOne<{ status: string }>(
              `SELECT status FROM kyc_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
              [params.userId]
            );
          } catch (err) {
            // Table doesn't exist or query failed - default to none
            console.log('[Users] KYC query failed (table may not exist):', err instanceof Error ? err.message : err);
          }

          // Get balances (handle case where table structure is different)
          let balances: Array<{ currency: string; available: string; locked: string; }> = [];
          try {
            balances = await db.query<{
              currency: string;
              available: string;
              locked: string;
            }>(
              `SELECT
                 COALESCE(t.symbol, ub.asset_id::text) as currency,
                 COALESCE(ub.available::text, '0') as available,
                 COALESCE(ub.locked::text, '0') as locked
               FROM user_balances ub
               LEFT JOIN assets t ON t.id = ub.asset_id
               WHERE ub.user_id = $1`,
              [params.userId]
            );
          } catch (err) {
            console.log('[Users] Balances query failed:', err instanceof Error ? err.message : err);
          }

          // Get recent transactions (combine deposits and withdrawals)
          let transactions: Array<{
            id: string;
            type: string;
            currency: string;
            amount: string;
            status: string;
            tx_hash: string | null;
            created_at: string;
            completed_at: string | null;
          }> = [];
          try {
            // Try to get both deposits and withdrawals
            transactions = await db.query<{
              id: string;
              type: string;
              currency: string;
              amount: string;
              status: string;
              tx_hash: string | null;
              created_at: string;
              completed_at: string | null;
            }>(
              `(SELECT
                  d.id,
                  'deposit' as type,
                  COALESCE(t.symbol, d.asset_id::text) as currency,
                  d.amount::text,
                  d.status,
                  d.tx_hash,
                  d.created_at::text,
                  d.confirmed_at::text as completed_at
                FROM deposits d
                LEFT JOIN assets t ON t.id = d.asset_id
                WHERE d.user_id = $1)
               UNION ALL
               (SELECT
                  w.id,
                  'withdrawal' as type,
                  COALESCE(t.symbol, w.asset_id::text) as currency,
                  w.amount::text,
                  w.status,
                  w.tx_hash,
                  w.created_at::text,
                  w.completed_at::text
                FROM withdrawal_requests w
                LEFT JOIN assets t ON t.id = w.asset_id
                WHERE w.user_id = $1)
               ORDER BY created_at DESC
               LIMIT 10`,
              [params.userId]
            );
          } catch (err) {
            // If withdrawals table doesn't exist, try deposits only
            try {
              transactions = await db.query<{
                id: string;
                type: string;
                currency: string;
                amount: string;
                status: string;
                tx_hash: string | null;
                created_at: string;
                completed_at: string | null;
              }>(
                `SELECT
                    d.id,
                    'deposit' as type,
                    COALESCE(t.symbol, d.asset_id::text) as currency,
                    d.amount::text,
                    d.status,
                    d.tx_hash,
                    d.created_at::text,
                    d.confirmed_at::text as completed_at
                  FROM deposits d
                  LEFT JOIN assets t ON t.id = d.asset_id
                  WHERE d.user_id = $1
                  ORDER BY d.created_at DESC
                  LIMIT 10`,
                [params.userId]
              );
            } catch (nestedErr) {
              console.log('[Users] Transactions query failed:', nestedErr instanceof Error ? nestedErr.message : nestedErr);
            }
          }

          const userDetail: UserDetail = {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.first_name,
            lastName: user.last_name,
            avatarUrl: user.avatar_url,
            role: user.role,
            status: user.status as UserDetail['status'],
            kycStatus: (kyc?.status || 'none') as UserDetail['kycStatus'],
            emailVerified: user.email_verified,
            mfaEnabled: user.mfa_enabled,
            createdAt: user.created_at,
            lastLoginAt: user.last_login_at,
            metadata: user.metadata || {},
            balances: balances.map(b => ({
              currency: b.currency,
              available: parseFloat(b.available),
              locked: parseFloat(b.locked),
              total: parseFloat(b.available) + parseFloat(b.locked)
            })),
            recentTransactions: transactions.map(t => ({
              id: t.id,
              userId: params.userId,
              userEmail: user.email,
              type: t.type as any,
              currency: t.currency,
              amount: parseFloat(t.amount),
              status: t.status as any,
              txHash: t.tx_hash,
              createdAt: t.created_at,
              completedAt: t.completed_at
            }))
          };

          return userDetail;
        } catch (error) {
          console.error('[Users] Failed to fetch user:', error);
          return { error: 'Failed to fetch user' };
        }
      },
      {
        params: t.Object({
          userId: t.String()
        }),
        detail: {
          tags: ['users'],
          summary: 'Get user details',
          description: 'Get detailed information about a specific user'
        }
      }
    )
    .patch(
      '/:userId/status',
      async ({ params, body }) => {
        try {
          await db.query(
            `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`,
            [body.status, params.userId]
          );

          // If suspending or deactivating user, revoke all their active sessions
          if (body.status === 'suspended' || body.status === 'banned' || body.status === 'deleted') {
            await db.query(
              `UPDATE sessions SET revoked = TRUE, revoked_at = NOW(), revoked_reason = 'User status changed to ' || $1 WHERE user_id = $2 AND revoked = FALSE`,
              [body.status, params.userId]
            );
          }

          return { success: true };
        } catch (error) {
          console.error('[Users] Failed to update status:', error);
          return { error: 'Failed to update user status' };
        }
      },
      {
        params: t.Object({
          userId: t.String()
        }),
        body: t.Object({
          status: t.Union([
            t.Literal('active'),
            t.Literal('suspended'),
            t.Literal('banned'),
            t.Literal('deleted')
          ])
        }),
        detail: {
          tags: ['users'],
          summary: 'Update user status',
          description: 'Change the status of a user account'
        }
      }
    )
    .patch(
      '/:userId/role',
      async ({ params, body }) => {
        try {
          await db.query(
            `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`,
            [body.role, params.userId]
          );

          return { success: true };
        } catch (error) {
          console.error('[Users] Failed to update role:', error);
          return { error: 'Failed to update user role' };
        }
      },
      {
        params: t.Object({
          userId: t.String()
        }),
        body: t.Object({
          role: t.String()
        }),
        detail: {
          tags: ['users'],
          summary: 'Update user role',
          description: 'Change the role of a user'
        }
      }
    )
    .patch(
      '/:userId',
      async ({ params, body }) => {
        try {
          const updates: string[] = [];
          const values: any[] = [];
          let paramIndex = 1;

          if (body.email !== undefined) {
            updates.push(`email = $${paramIndex}`);
            values.push(body.email);
            paramIndex++;
          }

          if (body.username !== undefined) {
            updates.push(`username = $${paramIndex}`);
            values.push(body.username);
            paramIndex++;
          }

          if (body.firstName !== undefined) {
            updates.push(`first_name = $${paramIndex}`);
            values.push(body.firstName);
            paramIndex++;
          }

          if (body.lastName !== undefined) {
            updates.push(`last_name = $${paramIndex}`);
            values.push(body.lastName);
            paramIndex++;
          }

          if (updates.length === 0) {
            return { error: 'No fields to update' };
          }

          updates.push(`updated_at = NOW()`);
          values.push(params.userId);

          const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
          await db.query(query, values);

          // Fetch and return updated user
          const updatedUser = await db.queryOne<{
            id: string;
            email: string;
            username: string | null;
            first_name: string | null;
            last_name: string | null;
            avatar_url: string | null;
            role: string;
            status: string;
            email_verified: boolean;
            mfa_enabled: boolean;
            created_at: string;
            last_login_at: string | null;
            metadata: Record<string, unknown>;
          }>(
            `SELECT id, email, username, first_name, last_name, avatar_url,
                    role, status, email_verified, mfa_enabled, created_at,
                    last_login_at, metadata
             FROM users
             WHERE id = $1`,
            [params.userId]
          );

          if (!updatedUser) {
            return { error: 'User not found after update' };
          }

          // Get KYC status
          let kyc: { status: string } | null = null;
          try {
            kyc = await db.queryOne<{ status: string }>(
              `SELECT status FROM kyc_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
              [params.userId]
            );
          } catch (err) {
            // KYC table doesn't exist or query failed
          }

          return {
            success: true,
            user: {
              id: updatedUser.id,
              email: updatedUser.email,
              username: updatedUser.username,
              firstName: updatedUser.first_name,
              lastName: updatedUser.last_name,
              avatarUrl: updatedUser.avatar_url,
              role: updatedUser.role,
              status: updatedUser.status as any,
              kycStatus: (kyc?.status as any) || 'none',
              emailVerified: updatedUser.email_verified,
              mfaEnabled: updatedUser.mfa_enabled,
              createdAt: updatedUser.created_at,
              lastLoginAt: updatedUser.last_login_at,
              metadata: updatedUser.metadata,
              balances: [],
              recentTransactions: []
            }
          };
        } catch (error: any) {
          console.error('[Users] Failed to update user:', error);
          if (error.code === '23505') {
            return { error: 'Email or username already exists' };
          }
          return { error: 'Failed to update user' };
        }
      },
      {
        params: t.Object({
          userId: t.String()
        }),
        body: t.Object({
          email: t.Optional(t.String({ format: 'email' })),
          username: t.Optional(t.String()),
          firstName: t.Optional(t.String()),
          lastName: t.Optional(t.String())
        }),
        detail: {
          tags: ['users'],
          summary: 'Update user profile',
          description: 'Update user information (email, username, first name, last name)'
        }
      }
    )
    .patch(
      '/:userId/password',
      async ({ params, body }) => {
        try {
          console.log('[Users] 🔐 Change password request for user:', params.userId);

          // Check if user exists
          const user = await db.queryOne<{ id: string; email: string }>(
            'SELECT id, email FROM users WHERE id = $1',
            [params.userId]
          );

          if (!user) {
            console.log('[Users] ❌ User not found:', params.userId);
            return { error: 'NOT_FOUND', message: 'User not found' };
          }

          console.log('[Users] ✅ User found:', user.email);
          console.log('[Users] 🔒 Hashing new password...');

          // Hash the new password
          const hashedPassword = await Bun.password.hash(body.newPassword, {
            algorithm: 'argon2id',
            memoryCost: 65536,
            timeCost: 3,
          });

          console.log('[Users] ✅ Password hashed, updating database...');

          // Update password
          const result = await db.query(
            `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
            [hashedPassword, params.userId]
          );

          console.log('[Users] ✅ Password updated successfully for:', user.email);
          console.log('[Users] 📊 Rows affected:', result.rowCount);

          // Revoke all sessions for this user (security best practice)
          await db.query(
            `UPDATE sessions SET revoked = TRUE, revoked_at = NOW(), revoked_reason = 'Password reset by admin' WHERE user_id = $1 AND revoked = FALSE`,
            [params.userId]
          );

          return { success: true };
        } catch (error) {
          console.error('[Users] ❌ Failed to change password:', error);
          return { error: 'Failed to change password' };
        }
      },
      {
        params: t.Object({
          userId: t.String()
        }),
        body: t.Object({
          newPassword: t.String({ minLength: 8 })
        }),
        detail: {
          tags: ['users'],
          summary: 'Change user password',
          description: 'Admin can change a user\'s password'
        }
      }
    );
}
