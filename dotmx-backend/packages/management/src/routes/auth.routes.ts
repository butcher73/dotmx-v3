/**
 * Management API Authentication Routes
 */

import { Elysia, t } from 'elysia';
import type { DatabaseService } from '@dotmx/shared';

export function createAuthRoutes(db: DatabaseService, jwtSecret: string) {
  return new Elysia({ prefix: '/auth' })
    .post(
      '/login',
      async ({ body, set }) => {
        const { email, password } = body;

        try {
          // Find admin user
          const user = await db.queryOne<{
            id: string;
            email: string;
            password_hash: string;
            role: string;
            status: string;
            first_name: string | null;
            last_name: string | null;
          }>(
            `SELECT id, email, password_hash, role, status, first_name, last_name
             FROM users 
             WHERE email = $1 
               AND deleted_at IS NULL
               AND role IN ('admin', 'super_admin', 'support')`,
            [email.toLowerCase()]
          );

          if (!user) {
            set.status = 401;
            return {
              error: 'Unauthorized',
              message: 'Invalid credentials'
            };
          }

          if (user.status !== 'active') {
            set.status = 403;
            return {
              error: 'Forbidden',
              message: 'Account is not active'
            };
          }

          // Verify password (auto-detects argon2id / bcrypt from hash prefix)
          let isValid = false;
          try {
            isValid = await Bun.password.verify(password, user.password_hash);
          } catch {
            isValid = false;
          }
          if (!isValid) {
            set.status = 401;
            return {
              error: 'Unauthorized',
              message: 'Invalid credentials'
            };
          }

          // Generate JWT token
          const now = Math.floor(Date.now() / 1000);
          const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            iat: now,
            exp: now + (8 * 60 * 60) // 8 hours
          };

          const token = await generateJWT(payload, jwtSecret);

          // Update last login
          await db.execute(
            'UPDATE users SET last_login_at = NOW() WHERE id = $1',
            [user.id]
          );

          return {
            success: true,
            token,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              name: [user.first_name, user.last_name].filter(Boolean).join(' ') || null
            }
          };
        } catch (error) {
          console.error('[Auth] Login error:', error);
          set.status = 500;
          return {
            error: 'InternalServerError',
            message: 'Login failed'
          };
        }
      },
      {
        body: t.Object({
          email: t.String({ format: 'email' }),
          password: t.String({ minLength: 1 })
        }),
        detail: {
          tags: ['auth'],
          summary: 'Admin login',
          description: 'Authenticate admin user and receive JWT token'
        }
      }
    );
}

/**
 * Generate JWT token
 */
async function generateJWT(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signatureInput)
  );
  
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${signatureInput}.${encodedSignature}`;
}
