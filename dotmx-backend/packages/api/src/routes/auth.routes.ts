// @ts-nocheck
/**
 * Authentication API Routes
 * Handles user registration, login, password management, and wallet authentication
 */

import { Elysia, t } from 'elysia';
import { createHmac, randomBytes } from 'crypto';
import { AuthService } from '../services/auth.service';
import { WalletAuthService } from '../services/wallet-auth.service';
import { DatabaseService } from '../services/database';
import { authPlugin, apiKeyPlugin, getUser } from '@dotmx/shared/middleware/auth.middleware';
import type {
  RegisterRequest,
  LoginRequest,
  WalletAuthChallengeRequest,
  WalletAuthVerifyRequest,
  PasswordResetRequest,
  ChangePasswordRequest,
  LinkWalletRequest,
  CreateApiKeyRequest,
  Login2FAResponse,
  Login2FAVerifyRequest,
} from '../types/auth';

// ============================================
// Rate Limiting (in-memory)
// ============================================
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimiter(maxRequests: number, windowMs: number) {
  return ({ request, set }: any) => {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || request.headers.get('cf-connecting-ip')
      || 'unknown';
    const key = `${ip}:${new URL(request.url).pathname}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (entry.count >= maxRequests) {
      set.status = 429;
      return {
        error: 'Too many requests',
        retry_after: Math.ceil((entry.resetAt - now) / 1000),
      };
    }

    entry.count++;
  };
}

// Cleanup old entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 60_000);

export function createAuthRoutes(
  db: DatabaseService,
  authService: AuthService,
  walletAuthService: WalletAuthService
) {
  return new Elysia({ prefix: '/auth' })
    .decorate('db', db)
    .decorate('authService', authService)
    .derive(async ({ headers, db }) => {
      // Derive user from Authorization header
      const authHeader = headers.authorization || headers.Authorization;

      if (!authHeader) {
        return { user: null, jwt: null };
      }

      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = await authService.verifyToken(token);
          const user = await db.queryOne<any>(
            `SELECT id, email, email_verified, first_name, last_name, username,
                    avatar_url, role, status, mfa_enabled, last_login_at,
                    created_at, updated_at, metadata
             FROM users WHERE id = $1 AND deleted_at IS NULL AND status = 'active'`,
            [jwt.sub]
          );
          return { user, jwt };
        } catch (error) {
          return { user: null, jwt: null };
        }
      }

      return { user: null, jwt: null };
    })
    .use(apiKeyPlugin(db))

    /**
     * Register with email and password
     */
    .post(
      '/register',
      async ({ body, request, set }) => {
        const ip_address = request.headers.get('x-forwarded-for') || undefined;
        const user_agent = request.headers.get('user-agent') || undefined;

        const result = await authService.register(body, {
          ip_address,
          user_agent,
        });

        set.status = 201;
        return {
          user: result.user,
          tokens: result.tokens,
          message: 'Registration successful. Please verify your email.',
        };
      },
      {
        beforeHandle: rateLimiter(3, 60_000),
        body: t.Object({
          email: t.String({ format: 'email' }),
          password: t.String({ minLength: 8 }),
          first_name: t.Optional(t.String()),
          last_name: t.Optional(t.String()),
          username: t.Optional(t.String()),
        }),
      }
    )

    /**
     * Login with email and password.
     * Rate limited: 5 requests per 60 seconds per IP.
     * If 2FA is enabled, returns a temp_token instead of full tokens.
     */
    .post(
      '/login',
      async ({ body, request, server }) => {
        // Extract IP from various headers (proxy-aware) or socket
        const forwarded = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const cfIp = request.headers.get('cf-connecting-ip');
        // Get socket IP as fallback
        const socketIp = server?.requestIP(request)?.address;
        const ip_address = forwarded?.split(',')[0]?.trim() || realIp || cfIp || socketIp || undefined;
        const user_agent = request.headers.get('user-agent') || undefined;

        const result = await authService.login(body, {
          ip_address,
          user_agent,
          device_name: body.device_name,
          device_fingerprint: body.device_fingerprint,
        });

        // Handle 2FA challenge response
        if ('requires_2fa' in result && result.requires_2fa) {
          return {
            user: result.user,
            requires_2fa: true,
            temp_token: result.temp_token,
          };
        }

        return {
          user: result.user,
          tokens: result.tokens,
        };
      },
      {
        beforeHandle: rateLimiter(5, 60_000),
        body: t.Object({
          email: t.String({ format: 'email' }),
          password: t.String(),
          device_name: t.Optional(t.String()),
          device_fingerprint: t.Optional(t.String()),
        }),
      }
    )

    /**
     * Verify 2FA code and complete login.
     * Rate limited: 5 requests per 60 seconds per IP.
     */
    .post(
      '/login/2fa/verify',
      async ({ body, request, server }) => {
        const forwarded = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const cfIp = request.headers.get('cf-connecting-ip');
        const socketIp = server?.requestIP(request)?.address;
        const ip_address = forwarded?.split(',')[0]?.trim() || realIp || cfIp || socketIp || undefined;
        const user_agent = request.headers.get('user-agent') || undefined;

        const result = await authService.verifyLogin2FA(
          body.temp_token,
          body.code,
          { ip_address, user_agent }
        );

        return {
          user: result.user,
          tokens: result.tokens,
          message: '2FA verification successful',
        };
      },
      {
        beforeHandle: rateLimiter(5, 60_000),
        body: t.Object({
          temp_token: t.String(),
          code: t.String({ minLength: 6, maxLength: 6 }),
        }),
      }
    )

    /**
     * Refresh access token
     */
    .post(
      '/refresh',
      async ({ body, request, server }) => {
        // Extract IP from various headers (proxy-aware) or socket
        const forwarded = request.headers.get('x-forwarded-for');
        const realIp = request.headers.get('x-real-ip');
        const cfIp = request.headers.get('cf-connecting-ip');
        const socketIp = server?.requestIP(request)?.address;
        const ip_address = forwarded?.split(',')[0]?.trim() || realIp || cfIp || socketIp || undefined;
        const user_agent = request.headers.get('user-agent') || undefined;

        const tokens = await authService.refreshToken(body.refresh_token, {
          ip_address,
          user_agent,
        });

        return { tokens };
      },
      {
        body: t.Object({
          refresh_token: t.String(),
        }),
      }
    )

    /**
     * Logout (revoke session)
     */
    .post(
      '/logout',
      async ({ body, request, user, set }) => {
        if (!user) {
          // This shouldn't happen due to beforeHandle, but safety check
          set.status = 401;
          return { error: 'Authentication required' };
        }
        const ip_address = request.headers.get('x-forwarded-for') || undefined;
        const user_agent = request.headers.get('user-agent') || undefined;

        await authService.logout(body.refresh_token, user.id, {
          ip_address,
          user_agent,
        });

        return { message: 'Logged out successfully' };
      },
      {
        body: t.Object({
          refresh_token: t.String(),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    /**
     * Request password reset
     */
    .post(
      '/password/reset/request',
      async ({ body, request }) => {
        const ip_address = request.headers.get('x-forwarded-for') || undefined;
        const user_agent = request.headers.get('user-agent') || undefined;

        await authService.requestPasswordReset(body, {
          ip_address,
          user_agent,
        });

        return {
          message:
            'If the email exists, a password reset link has been sent.',
        };
      },
      {
        beforeHandle: rateLimiter(3, 60_000),
        body: t.Object({
          email: t.String({ format: 'email' }),
        }),
      }
    )

    /**
     * Reset password with token
     */
    .post(
      '/password/reset/verify',
      async ({ body, request }) => {
        const ip_address = request.headers.get('x-forwarded-for') || undefined;
        const user_agent = request.headers.get('user-agent') || undefined;

        await authService.resetPassword(body.token, body.new_password, {
          ip_address,
          user_agent,
        });

        return { message: 'Password reset successful' };
      },
      {
        body: t.Object({
          token: t.String(),
          new_password: t.String({ minLength: 8 }),
        }),
      }
    )

    /**
     * Change password (authenticated)
     */
    .post(
      '/password/change',
      async ({ body, request, user }) => {
        const currentUser = getUser({ user });
        const ip_address = request.headers.get('x-forwarded-for') || undefined;
        const user_agent = request.headers.get('user-agent') || undefined;

        await authService.changePassword(currentUser.id, body, {
          ip_address,
          user_agent,
        });

        return { message: 'Password changed successfully' };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
        body: t.Object({
          old_password: t.String(),
          new_password: t.String({ minLength: 8 }),
        }),
      }
    )

    /**
     * Verify email
     */
    .post(
      '/email/verify',
      async ({ body }) => {
        await authService.verifyEmail(body.token);
        return { message: 'Email verified successfully' };
      },
      {
        body: t.Object({
          token: t.String(),
        }),
      }
    )

    /**
     * Get wallet authentication challenge
     */
    .post(
      '/wallet/challenge',
      async ({ body, request }) => {
        const ip_address = request.headers.get('x-forwarded-for') || undefined;

        const challenge = await walletAuthService.createChallenge(body, {
          ip_address,
        });

        return challenge;
      },
      {
        body: t.Object({
          wallet_address: t.String(),
          chain_code: t.String(),
        }),
      }
    )

    /**
     * Verify wallet signature and authenticate
     */
    .post(
      '/wallet/verify',
      async ({ body, request, set }) => {
        const ip_address = request.headers.get('x-forwarded-for') || undefined;
        const user_agent = request.headers.get('user-agent') || undefined;

        const result = await walletAuthService.verifyAndAuthenticate(body, {
          ip_address,
          user_agent,
        });

        if (result.is_new_user) {
          set.status = 201;
        }

        return {
          user: result.user,
          tokens: result.tokens,
          is_new_user: result.is_new_user,
        };
      },
      {
        body: t.Object({
          wallet_address: t.String(),
          chain_code: t.String(),
          nonce: t.String(),
          signature: t.String(),
          device_name: t.Optional(t.String()),
          device_fingerprint: t.Optional(t.String()),
        }),
      }
    )

    /**
     * Get current user profile
     */
    .get(
      '/me',
      async ({ user }) => {
        const currentUser = getUser({ user });

        // Return user object wrapped in a user field for API consistency
        return { user: currentUser };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    /**
     * Update user profile
     */
    .patch(
      '/me',
      async ({ body, user }) => {
        const currentUser = getUser({ user });

        const updatedUser = await db.queryOne(
          `UPDATE users
           SET first_name = COALESCE($1, first_name),
               last_name = COALESCE($2, last_name),
               username = COALESCE($3, username),
               avatar_url = COALESCE($4, avatar_url)
           WHERE id = $5
           RETURNING id, email, email_verified, first_name, last_name, username,
                     avatar_url, role, status, mfa_enabled, last_login_at,
                     created_at, updated_at, metadata`,
          [
            body.first_name || null,
            body.last_name || null,
            body.username || null,
            body.avatar_url || null,
            currentUser.id,
          ]
        );

        return updatedUser;
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
        body: t.Object({
          first_name: t.Optional(t.String()),
          last_name: t.Optional(t.String()),
          username: t.Optional(t.String()),
          avatar_url: t.Optional(t.String()),
        }),
      }
    )

    /**
     * Get user's wallets
     */
    .get(
      '/wallets',
      async ({ user }) => {
        const currentUser = getUser({ user });
        const wallets = await walletAuthService.getUserWallets(currentUser.id);
        return { wallets };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    /**
     * Link a wallet to account
     */
    .post(
      '/wallets/link',
      async ({ body, user, request, set }) => {
        const currentUser = getUser({ user });
        const ip_address = request.headers.get('x-forwarded-for') || undefined;
        const user_agent = request.headers.get('user-agent') || undefined;

        const wallet = await walletAuthService.linkWallet(currentUser.id, body, {
          ip_address,
          user_agent,
        });

        set.status = 201;
        return { wallet };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
        body: t.Object({
          wallet_address: t.String(),
          chain_code: t.String(),
          chain_id: t.Optional(t.Number()),
          wallet_type: t.Optional(t.String()),
          signature: t.String(),
          nonce: t.String(),
          is_primary: t.Optional(t.Boolean()),
        }),
      }
    )

    /**
     * Unlink a wallet
     */
    .delete(
      '/wallets/:id',
      async ({ params, user, request }) => {
        const currentUser = getUser({ user });
        const ip_address = request.headers.get('x-forwarded-for') || undefined;
        const user_agent = request.headers.get('user-agent') || undefined;

        await walletAuthService.unlinkWallet(currentUser.id, params.id, {
          ip_address,
          user_agent,
        });

        return { message: 'Wallet unlinked successfully' };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    /**
     * Set primary wallet
     */
    .put(
      '/wallets/:id/primary',
      async ({ params, user }) => {
        const currentUser = getUser({ user });
        await walletAuthService.setPrimaryWallet(currentUser.id, params.id);
        return { message: 'Primary wallet updated' };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    /**
     * List user's API keys
     */
    .get(
      '/api-keys',
      async ({ user }) => {
        const currentUser = getUser({ user });

        const keys = await db.query(
          `SELECT id, key_prefix, name, scopes, rate_limit_per_minute,
                  is_active, expires_at, last_used_at, created_at
           FROM api_keys
           WHERE user_id = $1
           ORDER BY created_at DESC`,
          [currentUser.id]
        );

        return { api_keys: keys };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    /**
     * Create new API key
     */
    .post(
      '/api-keys',
      async ({ body, user, set }) => {
        const currentUser = getUser({ user });

        // Generate API key
        const apiKey = `dmx_${randomBytes(24).toString('hex')}`;

        const keyHash = (() => {
          const secret = process.env.API_KEY_HMAC_SECRET || process.env.JWT_SECRET || 'api-key-secret';
          return createHmac('sha256', secret).update(apiKey).digest('hex');
        })();

        const keyPrefix = apiKey.substring(0, 12);
        const expires_at = body.expires_in_days
          ? new Date(Date.now() + body.expires_in_days * 86400000)
          : null;

        const keyInfo = await db.queryOne(
          `INSERT INTO api_keys (user_id, key_hash, key_prefix, name, scopes,
                                 rate_limit_per_minute, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, key_prefix, name, scopes, rate_limit_per_minute,
                     is_active, expires_at, last_used_at, created_at`,
          [
            currentUser.id,
            keyHash,
            keyPrefix,
            body.name,
            body.scopes,
            body.rate_limit_per_minute || 100,
            expires_at,
          ]
        );

        set.status = 201;
        return {
          api_key: apiKey, // Only shown once
          key: keyInfo,
          message: 'Save this API key. It will not be shown again.',
        };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
        body: t.Object({
          name: t.String(),
          scopes: t.Array(t.String()),
          rate_limit_per_minute: t.Optional(t.Number()),
          expires_in_days: t.Optional(t.Number()),
        }),
      }
    )

    /**
     * Delete API key
     */
    .delete(
      '/api-keys/:id',
      async ({ params, user }) => {
        const currentUser = getUser({ user });

        await db.execute(
          'DELETE FROM api_keys WHERE id = $1 AND user_id = $2',
          [params.id, currentUser.id]
        );

        return { message: 'API key deleted' };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    /**
     * Get user's sessions
     */
    .get(
      '/sessions',
      async ({ user }) => {
        const currentUser = getUser({ user });

        // Get current session jti from token
        const currentJti = (user as { jti?: string })?.jti;

        const sessions = await db.query(
          `SELECT id, device_name, device_fingerprint, ip_address, user_agent, access_token_jti,
                  last_activity_at, expires_at, revoked, created_at
           FROM sessions
           WHERE user_id = $1 AND expires_at > NOW() AND revoked = FALSE
           ORDER BY last_activity_at DESC`,
          [currentUser.id]
        );

        // Parse user_agent for browser and OS info, mark current session
        const enrichedSessions = sessions.map((session: Record<string, unknown>) => {
          const ua = (session.user_agent as string) || '';

          // Parse browser
          let browser = 'Unknown Browser';
          if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
          else if (ua.includes('Firefox')) browser = 'Firefox';
          else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
          else if (ua.includes('Edg')) browser = 'Edge';

          // Parse OS
          let os = '';
          if (ua.includes('Windows')) os = 'Windows';
          else if (ua.includes('Mac')) os = 'macOS';
          else if (ua.includes('Linux') && !ua.includes('Android')) os = 'Linux';
          else if (ua.includes('Android')) os = 'Android';
          else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

          // Parse device type
          let device_type = 'desktop';
          if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
            device_type = 'mobile';
          } else if (ua.includes('iPad') || ua.includes('Tablet')) {
            device_type = 'tablet';
          }

          // Check if this is the current session by matching jti
          const is_current = session.access_token_jti === currentJti;

          // Remove access_token_jti from response (security)
          const { access_token_jti, ...sessionWithoutJti } = session;

          return {
            ...sessionWithoutJti,
            browser,
            os,
            device_type,
            is_current,
          };
        });

        return { sessions: enrichedSessions };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    /**
     * Revoke session
     */
    .delete(
      '/sessions/:id',
      async ({ params, user }) => {
        const currentUser = getUser({ user });

        await db.execute(
          `UPDATE sessions
           SET revoked = TRUE, revoked_at = NOW(), revoked_reason = 'User action'
           WHERE id = $1 AND user_id = $2`,
          [params.id, currentUser.id]
        );

        return { message: 'Session revoked' };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    // =========================================================================
    // TWO-FACTOR AUTHENTICATION (2FA)
    // =========================================================================

    /**
     * Get 2FA status
     */
    .get(
      '/2fa/status',
      async ({ user }) => {
        const currentUser = getUser({ user });

        try {
          const result = await db.queryOne(
            `SELECT id, method, enabled, setup_completed_at, last_used_at,
                    total_uses, failed_attempts
             FROM user_2fa WHERE user_id = $1`,
            [currentUser.id]
          );

          if (!result) {
            return {
              enabled: false,
              method: null,
              setup_completed: false,
            };
          }

          return {
            enabled: result.enabled,
            method: result.method,
            setup_completed: !!result.setup_completed_at,
            last_used_at: result.last_used_at,
            total_uses: result.total_uses,
          };
        } catch (error) {
          // If table doesn't exist, return disabled status
          console.log('2FA table not available, returning disabled status');
          return {
            enabled: false,
            method: null,
            setup_completed: false,
          };
        }
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    /**
     * Setup 2FA - Generate secret and QR code
     */
    .post(
      '/2fa/setup',
      async ({ user, set }) => {
        const currentUser = getUser({ user });

        // Import security utils
        const { generateTOTPSecret, generateBackupCodes, hashBackupCodes } = await import('@dotmx/shared');

        // Generate TOTP secret and QR code
        const { secret, uri, qrCodeUrl } = generateTOTPSecret('DotMX', currentUser.email);

        // Generate backup codes
        const backupCodes = generateBackupCodes(10);
        const hashedBackupCodes = hashBackupCodes(backupCodes);

        // Initialize or update 2FA record
        await db.execute(
          `INSERT INTO user_2fa (user_id, method, enabled, totp_secret, totp_backup_codes)
           VALUES ($1, 'totp', false, $2, $3)
           ON CONFLICT (user_id) DO UPDATE SET
             method = 'totp',
             totp_secret = $2,
             totp_backup_codes = $3,
             setup_completed_at = NULL,
             enabled = false,
             updated_at = CURRENT_TIMESTAMP`,
          [currentUser.id, secret, hashedBackupCodes]
        );

        set.status = 201;
        return {
          secret,
          qr_code_url: qrCodeUrl,
          uri,
          backup_codes: backupCodes, // Only shown once
          message: 'Scan the QR code with your authenticator app, then verify a code to enable 2FA.',
        };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    /**
     * Verify 2FA code and enable 2FA
     * Rate limited: 5 attempts per 60 seconds per user to prevent brute force.
     */
    .post(
      '/2fa/verify',
      async ({ body, user, request, set }) => {
        const currentUser = getUser({ user });
        const ip_address = request.headers.get('x-forwarded-for') || undefined;

        // Rate-limit: check failed_attempts with a sliding window
        const twoFaRecord = await db.queryOne<{
          totp_secret: string;
          enabled: boolean;
          failed_attempts: number;
          last_failed_at: string | null;
        }>(
          `SELECT totp_secret, enabled, failed_attempts, last_failed_at FROM user_2fa WHERE user_id = $1`,
          [currentUser.id]
        );

        if (!twoFaRecord || !twoFaRecord.totp_secret) {
          throw new Error('2FA not set up. Please call /2fa/setup first.');
        }

        // Brute-force protection: if > 5 failed attempts in the last 60 seconds, block
        if (twoFaRecord.failed_attempts >= 5 && twoFaRecord.last_failed_at) {
          const lastFailed = new Date(twoFaRecord.last_failed_at).getTime();
          const windowStart = Date.now() - 60_000;
          if (lastFailed > windowStart) {
            set.status = 429;
            return { error: 'Too many attempts. Please wait before trying again.' };
          }
          // Window expired — reset failed count
          await db.execute(
            `UPDATE user_2fa SET failed_attempts = 0 WHERE user_id = $1`,
            [currentUser.id]
          );
        }

        // Verify TOTP code
        const { TOTP } = await import('otpauth');
        const totp = new TOTP({
          secret: twoFaRecord.totp_secret,
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        });

        const delta = totp.validate({ token: body.code, window: 1 });

        if (delta === null) {
          // Update failed attempts
          await db.execute(
            `UPDATE user_2fa SET failed_attempts = failed_attempts + 1, last_failed_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
            [currentUser.id]
          );
          throw new Error('Invalid verification code');
        }

        // Enable 2FA
        await db.execute(
          `UPDATE user_2fa
           SET enabled = true,
               setup_completed_at = CURRENT_TIMESTAMP,
               setup_by_ip = $1,
               total_uses = total_uses + 1,
               last_used_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2`,
          [ip_address, currentUser.id]
        );

        // Update user's mfa_enabled flag
        await db.execute(
          `UPDATE users SET mfa_enabled = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [currentUser.id]
        );

        return {
          success: true,
          message: '2FA has been enabled successfully',
        };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
        body: t.Object({
          code: t.String({ minLength: 6, maxLength: 6 }),
        }),
      }
    )

    /**
     * Login with 2FA backup code
     * Allows users to bypass 2FA using a one-time backup code.
     */
    .post(
      '/2fa/backup-code',
      async ({ body, user, set }) => {
        // This route does NOT require 2FA — it's the escape hatch
        const currentUser = user ? getUser({ user }) : null;
        if (!currentUser) {
          set.status = 401;
          return { error: 'Authentication required' };
        }

        const { createHash } = await import('crypto');
        const hashedInput = createHash('sha256').update(body.code.toUpperCase()).digest('hex');

        // Fetch user's backup codes
        const twoFaRecord = await db.queryOne<{ totp_backup_codes: string[]; enabled: boolean }>(
          `SELECT totp_backup_codes, enabled FROM user_2fa WHERE user_id = $1`,
          [currentUser.id]
        );

        if (!twoFaRecord) {
          set.status = 400;
          return { error: '2FA is not set up for this account' };
        }

        if (!twoFaRecord.enabled) {
          set.status = 400;
          return { error: '2FA is not enabled on this account' };
        }

        // Check if the code matches any backup code
        const codes = twoFaRecord.totp_backup_codes || [];
        const matchIndex = codes.findIndex(c => c === hashedInput);

        if (matchIndex === -1) {
          return { error: 'Invalid backup code' };
        }

        // Remove the used backup code (one-time use)
        codes.splice(matchIndex, 1);
        await db.query(
          `UPDATE user_2fa SET totp_backup_codes = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
          [JSON.stringify(codes), currentUser.id]
        );

        return { success: true, message: 'Backup code accepted. 2FA bypassed for this session.' };
      },
      {
        body: t.Object({
          code: t.String({ minLength: 8, maxLength: 8 }),
        }),
      }
    )

    /**
     * Disable 2FA
     */
    .post(
      '/2fa/disable',
      async ({ body, user, request }) => {
        const currentUser = getUser({ user });

        // First verify password
        const userRecord = await db.queryOne<{ password_hash: string }>(
          `SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL`,
          [currentUser.id]
        );

        if (!userRecord) {
          throw new Error('User not found');
        }

        let validPassword = false;
        try {
          validPassword = await Bun.password.verify(body.password, userRecord.password_hash);
        } catch {
          validPassword = false;
        }
        if (!validPassword) {
          throw new Error('Invalid password');
        }

        // Disable 2FA
        await db.execute(
          `UPDATE user_2fa
           SET enabled = false,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $1`,
          [currentUser.id]
        );

        // Update user's mfa_enabled flag
        await db.execute(
          `UPDATE users SET mfa_enabled = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [currentUser.id]
        );

        return {
          success: true,
          message: '2FA has been disabled',
        };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
        body: t.Object({
          password: t.String(),
        }),
      }
    )

    // =========================================================================
    // WITHDRAWAL WHITELIST
    // =========================================================================

    /**
     * Get whitelist settings and addresses
     */
    .get(
      '/whitelist',
      async ({ user }) => {
        const currentUser = getUser({ user });

        try {
          // Get whitelist setting
          const settings = await db.queryOne<{ whitelist_enabled: boolean }>(
            `SELECT COALESCE(
               (metadata->>'whitelist_enabled')::boolean,
               false
             ) as whitelist_enabled
             FROM users WHERE id = $1`,
            [currentUser.id]
          );

          // Get whitelisted addresses
          const addresses = await db.query(
            `SELECT id, label, address, chain, created_at
             FROM withdrawal_whitelist
             WHERE user_id = $1 AND is_active = true
             ORDER BY created_at DESC`,
            [currentUser.id]
          );

          return {
            enabled: settings?.whitelist_enabled || false,
            addresses: addresses || [],
          };
        } catch (error) {
          // If withdrawal_whitelist table doesn't exist, return empty state
          console.log('Whitelist table not available, returning empty state');
          return {
            enabled: false,
            addresses: [],
          };
        }
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    /**
     * Toggle whitelist on/off
     */
    .patch(
      '/whitelist/toggle',
      async ({ body, user }) => {
        const currentUser = getUser({ user });

        await db.execute(
          `UPDATE users
           SET metadata = jsonb_set(
             COALESCE(metadata, '{}')::jsonb,
             '{whitelist_enabled}',
             $1::jsonb
           ),
           updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [JSON.stringify(body.enabled), currentUser.id]
        );

        return {
          enabled: body.enabled,
          message: body.enabled
            ? 'Withdrawal whitelist enabled'
            : 'Withdrawal whitelist disabled',
        };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
        body: t.Object({
          enabled: t.Boolean(),
        }),
      }
    )

    /**
     * Add address to whitelist
     */
    .post(
      '/whitelist',
      async ({ body, user, set }) => {
        const currentUser = getUser({ user });

        // Check if address already exists
        const existing = await db.queryOne(
          `SELECT id FROM withdrawal_whitelist
           WHERE user_id = $1 AND address = $2 AND chain = $3 AND is_active = true`,
          [currentUser.id, body.address, body.chain]
        );

        if (existing) {
          set.status = 409;
          throw new Error('Address already whitelisted for this chain');
        }

        const result = await db.queryOne(
          `INSERT INTO withdrawal_whitelist (user_id, label, address, chain)
           VALUES ($1, $2, $3, $4)
           RETURNING id, label, address, chain, created_at`,
          [currentUser.id, body.label, body.address, body.chain]
        );

        set.status = 201;
        return {
          address: result,
          message: 'Address added to whitelist',
        };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
        body: t.Object({
          label: t.String(),
          address: t.String(),
          chain: t.String(),
        }),
      }
    )

    /**
     * Remove address from whitelist
     */
    .delete(
      '/whitelist/:id',
      async ({ params, user }) => {
        const currentUser = getUser({ user });

        await db.execute(
          `UPDATE withdrawal_whitelist
           SET is_active = false, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND user_id = $2`,
          [params.id, currentUser.id]
        );

        return { message: 'Address removed from whitelist' };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    );
}
