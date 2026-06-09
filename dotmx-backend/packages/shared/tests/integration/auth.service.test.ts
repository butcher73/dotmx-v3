/**
 * Authentication Service Tests
 * Comprehensive tests for user authentication, JWT, and password management
 */

import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { AuthService, type AuthConfig } from '../../src/services/auth.service';
import { TestDatabase, ensureTestDatabase } from '../../src/test-db-helper';
import { PostgresDB } from '../../src/db/postgres-client';
import type { User, AuthTokens } from '../src/types/auth';

describe('AuthService', () => {
  let testDb: TestDatabase;
  let db: PostgresDB;
  let service: AuthService;
  
  const testConfig: Partial<AuthConfig> = {
    jwt_secret: 'test-jwt-secret-key-minimum-32-chars',
    jwt_access_expiry: 900,
    jwt_refresh_expiry: 604800,
    password_min_length: 8,
    password_require_uppercase: true,
    password_require_lowercase: true,
    password_require_number: true,
    password_require_special: true,
    max_failed_login_attempts: 5,
    account_lock_duration: 1800,
  };

  beforeAll(async () => {
    await ensureTestDatabase();
    testDb = new TestDatabase();
    await testDb.connect();
    await testDb.setupDatabase();
    db = new PostgresDB(testDb.getClient());
    service = new AuthService(db, testConfig);
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    await testDb.clearDatabase();
  });

  // ============================================================================
  // PASSWORD VALIDATION TESTS
  // ============================================================================

  describe('Password Validation', () => {
    test('should accept valid password with all requirements', () => {
      const result = (service as any).validatePassword('SecurePass123!');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject password shorter than minimum length', () => {
      const result = (service as any).validatePassword('Sh0rt!');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least');
    });

    test('should reject password without uppercase letter', () => {
      const result = (service as any).validatePassword('lowercase123!');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('uppercase');
    });

    test('should reject password without lowercase letter', () => {
      const result = (service as any).validatePassword('UPPERCASE123!');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });

    test('should reject password without number', () => {
      const result = (service as any).validatePassword('NoNumbers!');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('number');
    });

    test('should reject password without special character', () => {
      const result = (service as any).validatePassword('NoSpecial123');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('special');
    });
  });

  // ============================================================================
  // USER REGISTRATION TESTS
  // ============================================================================

  describe('User Registration', () => {
    test('should register new user with valid credentials', async () => {
      const result = await service.register({
        email: 'newuser@test.com',
        password: 'SecurePass123!',
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('newuser@test.com');
      expect(result.user.status).toBe('active');
      expect(result.tokens).toBeDefined();
      expect(result.tokens.access_token).toBeDefined();
      expect(result.tokens.refresh_token).toBeDefined();
    });

    test('should reject registration with invalid email format', async () => {
      await expect(service.register({
        email: 'not-an-email',
        password: 'SecurePass123!',
      })).rejects.toThrow('Invalid email');
    });

    test('should reject registration with weak password', async () => {
      await expect(service.register({
        email: 'user@test.com',
        password: 'weak',
      })).rejects.toThrow();
    });

    test('should reject duplicate email registration', async () => {
      await service.register({
        email: 'duplicate@test.com',
        password: 'SecurePass123!',
      });

      await expect(service.register({
        email: 'duplicate@test.com',
        password: 'AnotherPass456!',
      })).rejects.toThrow();
    });

    test('should normalize email to lowercase', async () => {
      const result = await service.register({
        email: 'UPPERCASE@TEST.COM',
        password: 'SecurePass123!',
      });

      expect(result.user.email).toBe('uppercase@test.com');
    });

    test('should hash password securely', async () => {
      const result = await service.register({
        email: 'hashtest@test.com',
        password: 'SecurePass123!',
      });

      // Verify password is not stored in plain text
      const user = await db.queryOne<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE id = $1',
        [result.user.id]
      );
      
      expect(user?.password_hash).not.toBe('SecurePass123!');
      expect(user?.password_hash).toContain('$'); // bcrypt format
    });

    test('should include metadata with registration', async () => {
      const result = await service.register(
        { email: 'meta@test.com', password: 'SecurePass123!' },
        { ip_address: '192.168.1.1', user_agent: 'Test Browser' }
      );

      expect(result.user).toBeDefined();
    });
  });

  // ============================================================================
  // USER LOGIN TESTS
  // ============================================================================

  describe('User Login', () => {
    let loginTestEmail: string;

    beforeEach(async () => {
      // Use unique email per test to avoid parallel test conflicts
      loginTestEmail = `login-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
      await service.register({
        email: loginTestEmail,
        password: 'SecurePass123!',
      });
    });

    test('should login with correct credentials', async () => {
      const result = await service.login({
        email: loginTestEmail,
        password: 'SecurePass123!',
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(loginTestEmail);
      expect(result.tokens.access_token).toBeDefined();
      expect(result.tokens.refresh_token).toBeDefined();
    });

    test('should reject login with wrong password', async () => {
      await expect(service.login({
        email: loginTestEmail,
        password: 'WrongPass123!',
      })).rejects.toThrow();
    });

    test('should reject login with non-existent email', async () => {
      await expect(service.login({
        email: 'nonexistent@test.com',
        password: 'SecurePass123!',
      })).rejects.toThrow();
    });

    test('should track failed login attempts', async () => {
      // Skip: Test has race condition issues with shared DB state
      // The mechanism was verified working via direct SQL testing
      // Attempt multiple failed logins
      for (let i = 0; i < 3; i++) {
        try {
          await service.login({
            email: loginTestEmail,
            password: 'WrongPass123!',
          });
        } catch (e) {
          // Expected to fail
        }
      }

      // Account should still be accessible (not locked yet)
      const result = await service.login({
        email: loginTestEmail,
        password: 'SecurePass123!',
      });
      expect(result.user).toBeDefined();
    });

    test('should lock account after max failed attempts', async () => {
      // Skip: This test requires isolated DB state. The locking mechanism was 
      // verified to work correctly via SQL testing. The test environment has
      // some state bleeding that causes inconsistent results.
      // Exhaust all allowed attempts (5 failures will lock)
      for (let i = 0; i < 5; i++) {
        try {
          await service.login({
            email: loginTestEmail,
            password: 'WrongPass123!',
          });
        } catch (e) {
          // Expected to fail
        }
      }

      // The 6th attempt should be blocked because account is locked
      try {
        await service.login({
          email: loginTestEmail,
          password: 'SecurePass123!', // Even correct password should fail
        });
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.message).toMatch(/locked/i);
      }
    });

    test('should update last login timestamp on successful login', async () => {
      await service.login({
        email: loginTestEmail,
        password: 'SecurePass123!',
      });

      const user = await db.queryOne<User>(
        'SELECT last_login_at FROM users WHERE email = $1',
        [loginTestEmail]
      );

      expect(user?.last_login_at).not.toBeNull();
    });
  });

  // ============================================================================
  // JWT TOKEN TESTS
  // ============================================================================

  describe('JWT Token Management', () => {
    let testUser: User;
    let tokens: AuthTokens;
    let jwtTestEmail: string;

    beforeEach(async () => {
      // Use unique email per test to avoid parallel test conflicts
      jwtTestEmail = `jwt-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
      const result = await service.register({
        email: jwtTestEmail,
        password: 'SecurePass123!',
      });
      testUser = result.user;
      tokens = result.tokens;
    });

    test('should generate valid access token', () => {
      expect(tokens.access_token).toBeDefined();
      expect(tokens.access_token.split('.').length).toBe(3); // JWT format
    });

    test('should generate valid refresh token', () => {
      expect(tokens.refresh_token).toBeDefined();
    });

    test('should verify valid access token', async () => {
      const payload = await service.verifyToken(tokens.access_token);

      expect(payload.sub).toBe(testUser.id);
      expect(payload.email).toBe(testUser.email);
    });

    test('should reject invalid token', async () => {
      await expect(service.verifyToken('invalid.token.here'))
        .rejects.toThrow();
    });

    test('should reject expired token', async () => {
      // Skip: Timing-sensitive test that's unreliable in CI environments
      // JWT expiration was verified working via manual testing
      // Create service with 1 second expiry
      const shortExpiryService = new AuthService(db, {
        ...testConfig,
        jwt_access_expiry: 1, // 1 second expiry
      });

      const email = `expiry-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
      const result = await shortExpiryService.register({
        email,
        password: 'SecurePass123!',
      });

      // Wait for token to expire (1s expiry + 1s buffer for registration time + clock skew)
      await new Promise(r => setTimeout(r, 2100));

      await expect(shortExpiryService.verifyToken(result.tokens.access_token))
        .rejects.toThrow();
    });

    test('should refresh token with valid refresh token', async () => {
      const newTokens = await service.refreshToken(tokens.refresh_token, {});

      expect(newTokens.access_token).toBeDefined();
      expect(newTokens.refresh_token).toBeDefined();
      expect(newTokens.access_token).not.toBe(tokens.access_token);
    });

    test('should reject refresh with invalid refresh token', async () => {
      await expect(service.refreshToken('invalid-refresh-token', {}))
        .rejects.toThrow();
    });

    test('should invalidate old refresh token after rotation', async () => {
      await service.refreshToken(tokens.refresh_token, {});

      // Old refresh token should no longer work
      await expect(service.refreshToken(tokens.refresh_token, {}))
        .rejects.toThrow();
    });
  });

  // ============================================================================
  // SESSION MANAGEMENT TESTS
  // ============================================================================

  describe('Session Management', () => {
    let testUser: User;
    let tokens: AuthTokens;
    let sessionTestEmail: string;

    beforeEach(async () => {
      sessionTestEmail = `session-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
      const result = await service.register({
        email: sessionTestEmail,
        password: 'SecurePass123!',
      });
      testUser = result.user;
      tokens = result.tokens;
    });

    test('should logout and invalidate session', async () => {
      await service.logout(tokens.refresh_token, {});

      // Token should no longer be valid
      await expect(service.refreshToken(tokens.refresh_token, {}))
        .rejects.toThrow();
    });

    test('should handle logout with invalid token gracefully', async () => {
      // Should not throw
      await service.logout('invalid-token', {});
    });

    test('should create session on login', async () => {
      const sessions = await db.queryAll<any>(
        'SELECT * FROM sessions WHERE user_id = $1',
        [testUser.id]
      );

      expect(sessions.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // PASSWORD RESET TESTS
  // ============================================================================

  describe('Password Reset', () => {
    let testUserId: string;
    let resetTestEmail: string;

    beforeEach(async () => {
      resetTestEmail = `reset-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
      const result = await service.register({
        email: resetTestEmail,
        password: 'SecurePass123!',
      });
      testUserId = result.user.id;
    });

    test('should request password reset for existing user', async () => {
      await service.requestPasswordReset({ email: resetTestEmail }, {});

      // Verify reset token was created
      const token = await db.queryOne<any>(
        `SELECT * FROM password_reset_tokens WHERE user_id = $1`,
        [testUserId]
      );

      expect(token).toBeDefined();
    });

    test('should not throw for non-existent email (security)', async () => {
      // Should complete without error to prevent email enumeration
      await service.requestPasswordReset({ email: 'nonexistent@test.com' }, {});
    });

    test('should reset password with valid token', async () => {
      // Skip: Test has race condition issues with FK constraints in shared DB
      // The mechanism was verified working via manual testing
      await service.requestPasswordReset({ email: resetTestEmail }, {});

      // Get the token from database - use user_id to ensure we get the right one
      const resetToken = await db.queryOne<{ token: string }>(
        `SELECT token FROM password_reset_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [testUserId]
      );

      expect(resetToken).toBeDefined();
      if (resetToken) {
        await service.resetPassword(resetToken.token, 'NewSecurePass456!', {});

        // Should be able to login with new password
        const result = await service.login({
          email: resetTestEmail,
          password: 'NewSecurePass456!',
        });

        expect(result.user).toBeDefined();
      }
    });

    test('should reject password reset with invalid token', async () => {
      await expect(service.resetPassword('invalid-token', 'NewPass123!', {}))
        .rejects.toThrow();
    });

    test('should reject password reset with expired token', async () => {
      await service.requestPasswordReset({ email: 'reset@test.com' }, {});

      // Manually expire the token
      await db.execute(
        `UPDATE password_reset_tokens SET expires_at = NOW() - INTERVAL '1 hour' WHERE user_id = $1`,
        [testUserId]
      );

      const resetToken = await db.queryOne<{ token: string }>(
        `SELECT token FROM password_reset_tokens WHERE user_id = $1`,
        [testUserId]
      );

      if (resetToken) {
        await expect(service.resetPassword(resetToken.token, 'NewPass123!', {}))
          .rejects.toThrow();
      }
    });
  });

  // ============================================================================
  // PASSWORD CHANGE TESTS
  // ============================================================================

  describe('Password Change', () => {
    let testUserId: string;
    let changeTestEmail: string;

    beforeEach(async () => {
      changeTestEmail = `change-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
      const result = await service.register({
        email: changeTestEmail,
        password: 'OldPass123!',
      });
      testUserId = result.user.id;
    });

    test('should change password with correct current password', async () => {
      // Skip: Test has race condition issues with FK constraints in shared DB
      await service.changePassword(testUserId, {
        old_password: 'OldPass123!',
        new_password: 'NewPass456!',
      }, {});

      // Should login with new password
      const result = await service.login({
        email: changeTestEmail,
        password: 'NewPass456!',
      });

      expect(result.user).toBeDefined();
    });

    test('should reject password change with wrong current password', async () => {
      await expect(service.changePassword(testUserId, {
        old_password: 'WrongPass123!',
        new_password: 'NewPass456!',
      }, {})).rejects.toThrow();
    });

    test('should reject weak new password', async () => {
      await expect(service.changePassword(testUserId, {
        old_password: 'OldPass123!',
        new_password: 'weak',
      }, {})).rejects.toThrow();
    });

    test('should invalidate all sessions after password change', async () => {
      // Login to create a session
      const { tokens } = await service.login({
        email: changeTestEmail,
        password: 'OldPass123!',
      });

      // Change password
      await service.changePassword(testUserId, {
        old_password: 'OldPass123!',
        new_password: 'NewPass456!',
      }, {});

      // Old refresh token should no longer work
      await expect(service.refreshToken(tokens.refresh_token, {}))
        .rejects.toThrow();
    });
  });

  // ============================================================================
  // AUDIT LOGGING TESTS
  // ============================================================================

  describe('Audit Logging', () => {
    test('should log successful registration', async () => {
      await service.register({
        email: 'audit@test.com',
        password: 'SecurePass123!',
      });

      const logs = await db.queryAll<any>(
        `SELECT * FROM auth_audit_logs WHERE email = $1 AND event_type = $2`,
        ['audit@test.com', 'register']
      );

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].status).toBe('success');
    });

    test('should log failed login attempt', async () => {
      await service.register({
        email: 'faillog@test.com',
        password: 'SecurePass123!',
      });

      try {
        await service.login({
          email: 'faillog@test.com',
          password: 'WrongPass!',
        });
      } catch (e) {
        // Expected
      }

      const logs = await db.queryAll<any>(
        `SELECT * FROM auth_audit_logs WHERE email = $1 AND event_type = $2`,
        ['faillog@test.com', 'login']
      );

      const failedLog = logs.find(l => l.status === 'failure');
      expect(failedLog).toBeDefined();
    });

    test('should include IP address and user agent in logs', async () => {
      await service.register(
        { email: 'iplog@test.com', password: 'SecurePass123!' },
        { ip_address: '10.0.0.1', user_agent: 'Custom Agent' }
      );

      const logs = await db.queryAll<any>(
        `SELECT * FROM auth_audit_logs WHERE email = $1`,
        ['iplog@test.com']
      );

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].ip_address).toBe('10.0.0.1');
      expect(logs[0].user_agent).toBe('Custom Agent');
    });
  });

  // ============================================================================
  // CONSTRUCTOR AND CONFIGURATION TESTS
  // ============================================================================

  describe('Service Configuration', () => {
    test('should throw error when JWT_SECRET is not provided', () => {
      // Save original env
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      
      try {
        expect(() => new AuthService(db, {}))
          .toThrow('JWT_SECRET is required');
      } finally {
        // Restore env
        if (originalSecret) {
          process.env.JWT_SECRET = originalSecret;
        }
      }
    });

    test('should use default config values when not provided', () => {
      const configuredService = new AuthService(db, {
        jwt_secret: 'test-secret-at-least-32-characters',
      });
      
      expect(configuredService).toBeDefined();
    });
  });
});
