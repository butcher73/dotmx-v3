/**
 * Admin Authentication Middleware
 *
 * Validates admin user sessions for management API access
 */

import { Elysia } from 'elysia';
import type { DatabaseService } from '@dotmx/shared';

export interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'super_admin' | 'support';
  permissions: string[];
}

export interface AdminAuthContext {
  adminUser: AdminUser | null;
}

/**
 * Admin Authentication Plugin
 *
 * Validates admin JWT tokens and enforces role-based access
 */
export function adminAuthPlugin(db: DatabaseService, jwtSecret: string) {
  return new Elysia({ name: 'adminAuth' })
    .decorate('db', db)
    .derive(async ({ request, db }) => {
      const authHeader = request.headers.get('authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { adminUser: null };
      }

      const token = authHeader.substring(7);

      try {
        // Verify JWT token
        const parts = token.split('.');
        if (parts.length !== 3) {
          return { adminUser: null };
        }
        const [headerB64, payloadB64, signature] = parts;

        // Verify HMAC-SHA256 signature
        const signatureInput = `${headerB64}.${payloadB64}`;
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(jwtSecret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign', 'verify']
        );

        const computedSig = await crypto.subtle.sign(
          'HMAC',
          key,
          encoder.encode(signatureInput)
        );

        // Encode using the same method as generateJWT (btoa with base64url transform)
        let computedB64 = btoa(String.fromCharCode(...new Uint8Array(computedSig)));
        // Convert to base64url: '+' -> '-', '/' -> '_', strip '='
        computedB64 = computedB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        // Timing-safe comparison using hex encoding
        const computedHex = Array.from(new Uint8Array(computedSig))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        const providedBytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        const providedHex = Array.from(providedBytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        if (computedHex.length !== providedHex.length) {
          return { adminUser: null };
        }

        let mismatch = 0;
        for (let i = 0; i < computedHex.length; i++) {
          mismatch |= computedHex.charCodeAt(i) ^ providedHex.charCodeAt(i);
        }
        if (mismatch !== 0) {
          return { adminUser: null };
        }

        // Decode payload (only after signature is verified)
        const payload = JSON.parse(atob(payloadB64));

        // Check if token is expired
        if (payload.exp && payload.exp < Date.now() / 1000) {
          return { adminUser: null };
        }

        // Fetch admin user from database
        const user = await db.queryOne<{
          id: string;
          email: string;
          role: string;
          status: string;
          metadata: Record<string, unknown>;
        }>(
          `SELECT id, email, role, status, metadata
           FROM users
           WHERE id = $1
             AND deleted_at IS NULL
             AND status = 'active'
             AND role IN ('admin', 'super_admin', 'support')`,
          [payload.sub]
        );

        if (!user) {
          return { adminUser: null };
        }

        const permissions = (user.metadata?.permissions as string[]) || getDefaultPermissions(user.role);

        return {
          adminUser: {
            id: user.id,
            email: user.email,
            role: user.role as AdminUser['role'],
            permissions
          }
        };
      } catch (error) {
        console.error('[AdminAuth] Token verification failed:', error);
        return { adminUser: null };
      }
    })
    .macro(({ onBeforeHandle }) => ({
      /**
       * Require admin authentication
       */
      requireAdmin(enabled: boolean) {
        if (!enabled) return;

        onBeforeHandle(({ adminUser, set }: { adminUser: AdminUser | null; set: any }) => {
          if (!adminUser) {
            set.status = 401;
            return {
              error: 'Unauthorized',
              message: 'Admin authentication required'
            };
          }
        });
      },

      /**
       * Require specific admin role
       */
      requireAdminRole(roles: string | string[]) {
        const roleArray = Array.isArray(roles) ? roles : [roles];

        onBeforeHandle(({ adminUser, set }: { adminUser: AdminUser | null; set: any }) => {
          if (!adminUser) {
            set.status = 401;
            return {
              error: 'Unauthorized',
              message: 'Admin authentication required'
            };
          }

          if (!roleArray.includes(adminUser.role)) {
            set.status = 403;
            return {
              error: 'Forbidden',
              message: `Required role: ${roleArray.join(' or ')}`
            };
          }
        });
      },

      /**
       * Require specific permission
       */
      requirePermission(permission: string) {
        onBeforeHandle(({ adminUser, set }: { adminUser: AdminUser | null; set: any }) => {
          if (!adminUser) {
            set.status = 401;
            return {
              error: 'Unauthorized',
              message: 'Admin authentication required'
            };
          }

          if (!adminUser.permissions.includes(permission) && !adminUser.permissions.includes('*')) {
            set.status = 403;
            return {
              error: 'Forbidden',
              message: `Missing permission: ${permission}`
            };
          }
        });
      }
    }));
}

/**
 * Get default permissions based on role
 */
function getDefaultPermissions(role: string): string[] {
  switch (role) {
    case 'super_admin':
      return ['*']; // All permissions
    case 'admin':
      return [
        'users:read',
        'users:write',
        'transactions:read',
        'kyc:read',
        'kyc:write',
        'trading_pairs:read',
        'audit_logs:read',
        'settings:read'
      ];
    case 'support':
      return [
        'users:read',
        'transactions:read',
        'kyc:read',
        'audit_logs:read'
      ];
    default:
      return [];
  }
}
