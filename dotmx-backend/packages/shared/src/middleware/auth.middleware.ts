/**
 * Authentication Middleware for Elysia
 * JWT verification and authorization
 */

import { Elysia } from 'elysia';
import { createHmac } from 'crypto';
import type { JWTPayload, User, ApiKey } from '../types/auth';
import { AuthenticationError, AuthorizationError } from '../types/auth';
import { AuthService } from '../services/auth.service';
import { DatabaseService } from '../services/database';

export interface AuthContext {
  user: User;
  jwt: JWTPayload;
}

export interface ApiKeyContext {
  user: User;
  api_key: ApiKey;
}

/**
 * Create authentication plugin for Elysia
 */
export function authPlugin(db: DatabaseService, authService: AuthService) {
  return new Elysia({ name: 'auth' })
    .decorate('db', db)
    .decorate('authService', authService)
    .derive(async ({ headers, db }) => {
      // Try to extract JWT from Authorization header
      const authHeader = headers.authorization || headers.Authorization;

      if (!authHeader) {
        return { user: null, jwt: null };
      }

      // Check for Bearer token
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = await authService.verifyToken(token);
          const user = await db.queryOne<User>(
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
    .macro(({ onBeforeHandle }) => ({
      /**
       * Require authentication
       */
      requireAuth(enabled: boolean) {
        if (!enabled) return;

        onBeforeHandle(({ user, jwt, set }: any) => {
          if (!user || !jwt) {
            set.status = 401;
            throw new AuthenticationError('Authentication required');
          }
        });
      },

      /**
       * Require specific role
       */
      requireRole(roles: string | string[]) {
        const roleArray = Array.isArray(roles) ? roles : [roles];

        onBeforeHandle(({ user, set }: any) => {
          if (!user) {
            set.status = 401;
            throw new AuthenticationError('Authentication required');
          }

          if (!roleArray.includes(user.role)) {
            set.status = 403;
            throw new AuthorizationError(
              `Required role: ${roleArray.join(' or ')}`
            );
          }
        });
      },

      /**
       * Require email verification
       */
      requireEmailVerified(enabled: boolean) {
        if (!enabled) return;

        onBeforeHandle(({ user, set }: any) => {
          if (!user) {
            set.status = 401;
            throw new AuthenticationError('Authentication required');
          }

          if (!user.email_verified && user.email) {
            set.status = 403;
            throw new AuthorizationError('Email verification required');
          }
        });
      },
    }));
}

/**
 * Create API key authentication plugin
 */
export function apiKeyPlugin(db: DatabaseService) {
  return new Elysia({ name: 'apiKey' })
    .decorate('db', db)
    .derive(async ({ headers, db, request }) => {
      // Check for API key in headers or query params
      const apiKey =
        headers['x-api-key'] ||
        headers['X-API-Key'] ||
        new URL(request.url).searchParams.get('apikey');

      if (!apiKey) {
        return { api_key_user: null, api_key_info: null };
      }

      try {
        // HMAC-SHA256 the API key for deterministic, fast lookup
        const secret = process.env.API_KEY_HMAC_SECRET || process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('API_KEY_HMAC_SECRET or JWT_SECRET must be set');
        }
        const keyHash = createHmac('sha256', secret).update(apiKey).digest('hex');

        // Find API key
        const keyInfo = await db.queryOne<
          ApiKey & { user: User }
        >(
          `SELECT ak.id, ak.user_id, ak.key_prefix, ak.name, ak.scopes,
                  ak.rate_limit_per_minute, ak.is_active, ak.expires_at,
                  ak.last_used_at, ak.created_at,
                  u.id as user_id, u.email, u.role, u.status, u.email_verified,
                  u.first_name, u.last_name, u.username, u.avatar_url,
                  u.mfa_enabled, u.last_login_at, u.created_at, u.updated_at, u.metadata
           FROM api_keys ak
           JOIN users u ON ak.user_id = u.id
           WHERE ak.key_hash = $1 AND ak.is_active = TRUE
             AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
             AND u.deleted_at IS NULL AND u.status = 'active'`,
          [keyHash]
        );

        if (!keyInfo) {
          return { api_key_user: null, api_key_info: null };
        }

        // Update last used
        await db.execute(
          'UPDATE api_keys SET last_used_at = NOW(), last_used_ip = $1 WHERE id = $2',
          [request.headers.get('x-forwarded-for') || null, keyInfo.id]
        );

        return {
          api_key_user: keyInfo.user,
          api_key_info: keyInfo,
        };
      } catch (error) {
        return { api_key_user: null, api_key_info: null };
      }
    })
    .macro(({ onBeforeHandle }) => ({
      /**
       * Require API key
       */
      requireApiKey(enabled: boolean) {
        if (!enabled) return;

        onBeforeHandle(({ api_key_user, api_key_info, set }: any) => {
          if (!api_key_user || !api_key_info) {
            set.status = 401;
            throw new AuthenticationError('Valid API key required');
          }
        });
      },

      /**
       * Require API key scope
       */
      requireScope(scopes: string | string[]) {
        const scopeArray = Array.isArray(scopes) ? scopes : [scopes];

        onBeforeHandle(({ api_key_user, api_key_info, set }: any) => {
          if (!api_key_user || !api_key_info) {
            set.status = 401;
            throw new AuthenticationError('Valid API key required');
          }

          const hasScope = scopeArray.some((scope) =>
            api_key_info.scopes.includes(scope)
          );

          if (!hasScope) {
            set.status = 403;
            throw new AuthorizationError(
              `Required scope: ${scopeArray.join(' or ')}`
            );
          }
        });
      },
    }));
}

/**
 * Get user from request context
 */
export function getUser(context: any): User {
  if (context.user) {
    return context.user;
  }
  if (context.api_key_user) {
    return context.api_key_user;
  }
  throw new AuthenticationError('User not authenticated');
}

/**
 * Check if user has role
 */
export function hasRole(user: User, roles: string | string[]): boolean {
  const roleArray = Array.isArray(roles) ? roles : [roles];
  return roleArray.includes(user.role);
}

/**
 * Check if user has permission
 */
export function hasPermission(
  context: any,
  permission: string
): boolean {
  // Check API key scopes
  if (context.api_key_info) {
    return context.api_key_info.scopes.includes(permission);
  }

  // Check user role permissions
  const user = getUser(context);

  // Super admin has all permissions
  if (user.role === 'super_admin') {
    return true;
  }

  // Admin has most permissions
  if (user.role === 'admin') {
    return !permission.includes('super_admin');
  }

  return false;
}
