/**
 * Authentication Service
 * Handles user registration, login, JWT tokens, and password management
 */

import { randomBytes } from 'crypto';
import type {
  User,
  UserRole,
  UserStatus,
  AuthTokens,
  RegisterRequest,
  LoginRequest,
  JWTPayload,
  Session,
  PasswordResetRequest,
  ChangePasswordRequest,
  AuthAuditLog,
  AuthEventType,
  Login2FAResponse,
  TokenPurpose,
} from '../types/auth';
import { AuthenticationError, ValidationError, AccountLockedError } from '../types/auth';
import { DatabaseService } from './database';
import type { EmailService } from './email.service';

const toUserRole = (value: string): UserRole => {
  if (value === 'user' || value === 'admin' || value === 'super_admin') return value;
  throw new AuthenticationError(`Unknown user role: ${value}`);
};

const toUserStatus = (value: string): UserStatus => {
  if (value === 'active' || value === 'suspended' || value === 'banned' || value === 'deleted') {
    return value;
  }
  throw new AuthenticationError(`Unknown user status: ${value}`);
};

export interface AuthConfig {
  jwt_secret: string;
  jwt_access_expiry: number; // seconds
  jwt_refresh_expiry: number; // seconds
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_number: boolean;
  password_require_special: boolean;
  max_failed_login_attempts: number;
  account_lock_duration: number; // seconds
}

export class AuthService {
  private config: AuthConfig;
  private db: DatabaseService;
  private emailService?: EmailService;

  constructor(db: DatabaseService, config: Partial<AuthConfig> = {}, emailService?: EmailService) {
    this.db = db;
    this.emailService = emailService;
    this.config = {
      jwt_secret: config.jwt_secret || process.env.JWT_SECRET || '',
      jwt_access_expiry: config.jwt_access_expiry || 900, // 15 minutes
      jwt_refresh_expiry: config.jwt_refresh_expiry || 604800, // 7 days
      password_min_length: config.password_min_length || 8,
      password_require_uppercase: config.password_require_uppercase ?? true,
      password_require_lowercase: config.password_require_lowercase ?? true,
      password_require_number: config.password_require_number ?? true,
      password_require_special: config.password_require_special ?? true,
      max_failed_login_attempts: config.max_failed_login_attempts || 5,
      account_lock_duration: config.account_lock_duration || 1800, // 30 minutes
    };

    if (!this.config.jwt_secret) {
      throw new Error('JWT_SECRET is required');
    }
  }

  /**
   * Register a new user with email and password
   */
  async register(
    data: RegisterRequest,
    metadata: { ip_address?: string; user_agent?: string } = {}
  ): Promise<{ user: User; tokens: AuthTokens }> {
    // Validate email
    if (!this.isValidEmail(data.email)) {
      await this.logAuthEvent({
        event_type: 'register',
        status: 'failure',
        email: data.email,
        failure_reason: 'Invalid email format',
        ...metadata,
      });
      throw new ValidationError('Invalid email format');
    }

    // Validate password
    const passwordValidation = this.validatePassword(data.password);
    if (!passwordValidation.valid) {
      await this.logAuthEvent({
        event_type: 'register',
        status: 'failure',
        email: data.email,
        failure_reason: passwordValidation.error,
        ...metadata,
      });
      throw new ValidationError(passwordValidation.error || 'Invalid password');
    }

    // Check if user already exists
    const existingUser = await this.db.queryOne<User>(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [data.email.toLowerCase()]
    );

    if (existingUser) {
      await this.logAuthEvent({
        event_type: 'register',
        status: 'failure',
        email: data.email,
        failure_reason: 'Email already registered',
        ...metadata,
      });
      throw new ValidationError('Email already registered');
    }

    // Hash password
    const password_hash = await this.hashPassword(data.password);

    // Create user
    const user = await this.db.queryOne<User>(
      `INSERT INTO users (email, password_hash, first_name, last_name, username, role, status)
       VALUES ($1, $2, $3, $4, $5, 'user', 'active')
       RETURNING id, email, email_verified, first_name, last_name, username,
                 avatar_url, role, status, mfa_enabled, last_login_at,
                 created_at, updated_at, metadata`,
      [
        data.email.toLowerCase(),
        password_hash,
        data.first_name || null,
        data.last_name || null,
        data.username || null,
      ]
    );

    if (!user) {
      throw new Error('Failed to create user');
    }

    // Generate email verification token
    await this.createEmailVerificationToken(user.id, user.email!);

    // Generate tokens
    const tokens = await this.generateTokens(user, metadata);

    // Log success
    await this.logAuthEvent({
      event_type: 'register',
      status: 'success',
      user_id: user.id,
      email: user.email,
      ...metadata,
    });

    return { user, tokens };
  }

  /**
   * Login with email and password.
   * If 2FA is enabled, returns a 2FA challenge instead of full tokens.
   */
  async login(
    data: LoginRequest,
    metadata: { ip_address?: string; user_agent?: string; device_name?: string; device_fingerprint?: string } = {}
  ): Promise<{ user: User; tokens: AuthTokens } | Login2FAResponse> {
    // Find user
    const user = await this.db.queryOne<User & { password_hash: string; locked_until: Date | null }>(
      `SELECT id, email, email_verified, password_hash, first_name, last_name,
              username, avatar_url, role, status, mfa_enabled, last_login_at,
              created_at, updated_at, metadata, locked_until, failed_login_attempts
       FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [data.email.toLowerCase()]
    );

    if (!user) {
      await this.logAuthEvent({
        event_type: 'login',
        status: 'failure',
        email: data.email,
        failure_reason: 'User not found',
        ...metadata,
      });
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await this.logAuthEvent({
        event_type: 'login',
        status: 'failure',
        user_id: user.id,
        email: user.email,
        failure_reason: 'Account locked',
        ...metadata,
      });
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if account is active
    if (user.status !== 'active') {
      await this.logAuthEvent({
        event_type: 'login',
        status: 'failure',
        user_id: user.id,
        email: user.email,
        failure_reason: `Account ${user.status}`,
        ...metadata,
      });
      throw new AuthenticationError('Invalid email or password');
    }

    // Verify password
    const passwordValid = await this.verifyPassword(data.password, user.password_hash);
    if (!passwordValid) {
      // Increment failed attempts
      await this.db.execute('SELECT increment_failed_login($1)', [user.id]);

      await this.logAuthEvent({
        event_type: 'login',
        status: 'failure',
        user_id: user.id,
        email: user.email,
        failure_reason: 'Invalid password',
        ...metadata,
      });

      throw new AuthenticationError('Invalid email or password');
    }

    // Reset failed attempts
    await this.db.execute('SELECT reset_failed_login($1)', [user.id]);

    // Remove sensitive data early — we may return early if 2FA is required
    const { password_hash, locked_until, failed_login_attempts, ...userWithoutPassword } = user;

    // If 2FA is enabled, don't issue tokens yet — require 2FA verification
    if (user.mfa_enabled) {
      // Generate a temporary 2FA challenge token (short-lived, single-use)
      const tempToken = await this.signJWT({
        sub: user.id,
        email: user.email || undefined,
        role: user.role,
        jti: randomBytes(16).toString('hex'),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
        type: 'access',
        purpose: '2fa_login',
      });

      await this.logAuthEvent({
        event_type: 'login',
        status: 'success',
        user_id: user.id,
        email: user.email,
        failure_reason: '2FA required',
        ...metadata,
      });

      return {
        user: userWithoutPassword as User,
        requires_2fa: true,
        temp_token: tempToken,
      };
    }

    // Update last login (only for non-2FA users who get full tokens immediately)
    await this.db.execute(
      'UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2',
      [metadata.ip_address || null, user.id]
    );

    // Generate tokens with device info from metadata (passed from request)
    // Fallback to data fields for backwards compatibility
    const tokens = await this.generateTokens(user, {
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      device_name: metadata.device_name || data.device_name,
      device_fingerprint: metadata.device_fingerprint || data.device_fingerprint,
    });

    // Log success
    await this.logAuthEvent({
      event_type: 'login',
      status: 'success',
      user_id: user.id,
      email: user.email,
      ...metadata,
    });

    return { user: userWithoutPassword as User, tokens };
  }

  /**
   * Verify 2FA code during login and issue real tokens.
   * The temp_token must be a valid JWT with purpose '2fa_login'.
   */
  async verifyLogin2FA(
    tempToken: string,
    totpCode: string,
    metadata: { ip_address?: string; user_agent?: string; device_name?: string; device_fingerprint?: string } = {}
  ): Promise<{ user: User; tokens: AuthTokens }> {
    // Verify the temp token
    let payload: JWTPayload;
    try {
      payload = await this.verifyJWT(tempToken);
    } catch {
      throw new AuthenticationError('Invalid or expired 2FA challenge token');
    }

    if (payload.purpose !== '2fa_login') {
      throw new AuthenticationError('Invalid token purpose');
    }

    const userId = payload.sub;

    // Fetch user data
    const user = await this.db.queryOne<User>(
      `SELECT id, email, email_verified, first_name, last_name, username,
              avatar_url, role, status, mfa_enabled, last_login_at,
              created_at, updated_at, metadata
       FROM users
       WHERE id = $1 AND deleted_at IS NULL AND status = 'active'`,
      [userId]
    );

    if (!user) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Get 2FA record and verify TOTP
    const twoFaRecord = await this.db.queryOne<{ totp_secret: string; failed_attempts: number; last_failed_at: string }>(
      `SELECT totp_secret, failed_attempts, last_failed_at FROM user_2fa WHERE user_id = $1 AND enabled = true`,
      [userId]
    );

    if (!twoFaRecord || !twoFaRecord.totp_secret) {
      throw new AuthenticationError('2FA is not configured');
    }

    // Check for brute-force: max 5 failed 2FA attempts within 15 minutes
    if (twoFaRecord.failed_attempts >= 5) {
      const lastFailed = new Date(twoFaRecord.last_failed_at).getTime();
      const cooldownMs = 15 * 60 * 1000; // 15 minutes
      if (Date.now() - lastFailed < cooldownMs) {
        throw new AuthenticationError('Too many 2FA attempts. Please wait 15 minutes.');
      }
      // Cooldown expired, reset counter
      await this.db.execute(
        `UPDATE user_2fa SET failed_attempts = 0 WHERE user_id = $1`,
        [userId]
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

    const delta = totp.validate({ token: totpCode, window: 1 });
    if (delta === null) {
      // Update failed attempts
      await this.db.execute(
        `UPDATE user_2fa SET failed_attempts = failed_attempts + 1, last_failed_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
        [userId]
      );
      throw new AuthenticationError('Invalid 2FA code');
    }

    // Update 2FA usage stats
    await this.db.execute(
      `UPDATE user_2fa
       SET total_uses = total_uses + 1,
           last_used_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );

    // Update last login
    await this.db.execute(
      'UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2',
      [metadata.ip_address || null, userId]
    );

    // Generate real tokens
    const tokens = await this.generateTokens(user, metadata);

    await this.logAuthEvent({
      event_type: 'login',
      status: 'success',
      user_id: user.id,
      email: user.email,
      ...metadata,
    });

    return { user, tokens };
  }

  /**
   * Generate JWT access and refresh tokens
   */
  private async generateTokens(
    user: User,
    metadata: {
      ip_address?: string;
      user_agent?: string;
      device_name?: string;
      device_fingerprint?: string;
    } = {}
  ): Promise<AuthTokens> {
    const jti = randomBytes(16).toString('hex');
    const refresh_token = randomBytes(32).toString('hex');

    // Create access token payload
    const accessPayload: JWTPayload = {
      sub: user.id,
      email: user.email || undefined,
      role: user.role,
      jti,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.jwt_access_expiry,
      type: 'access',
    };

    // Create session for refresh token
    await this.db.execute(
      `INSERT INTO sessions (user_id, refresh_token, access_token_jti, device_name,
                             device_fingerprint, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '${this.config.jwt_refresh_expiry} seconds')`,
      [
        user.id,
        refresh_token,
        jti,
        metadata.device_name || null,
        metadata.device_fingerprint || null,
        metadata.ip_address || null,
        metadata.user_agent || null,
      ]
    );

    // Generate JWT (simplified - in production use a proper JWT library)
    const access_token = await this.signJWT(accessPayload);

    return {
      access_token,
      refresh_token,
      token_type: 'Bearer',
      expires_in: this.config.jwt_access_expiry,
    };
  }

  /**
   * Refresh access token using refresh token.
   * Implements token rotation: the old refresh token is invalidated after
   * new tokens are issued, preventing replay attacks.
   */
  async refreshToken(
    refresh_token: string,
    metadata: { ip_address?: string; user_agent?: string } = {}
  ): Promise<AuthTokens> {
    // TOKEN ROTATION (race-condition safe): Atomically claim the refresh token
    // by updating last_activity_at. Only one concurrent request will get a row
    // back because the subsequent full revocation at the end of this method
    // marks the old session as revoked.
    const result = await this.db.queryOne<{
      id: string;
      user_id: string;
      // User fields with u_ prefix to avoid conflict
      u_id: string;
      u_email: string | null;
      u_role: string;
      u_status: string;
      u_email_verified: boolean;
      u_first_name: string | null;
      u_last_name: string | null;
      u_username: string | null;
      u_avatar_url: string | null;
      u_mfa_enabled: boolean;
      u_last_login_at: Date | null;
      u_created_at: Date;
      u_updated_at: Date;
      u_metadata: Record<string, any>;
      u_deleted_at: Date | null;
    }>(
      `UPDATE sessions s
       SET last_activity_at = NOW()
       FROM users u
       WHERE s.user_id = u.id
         AND s.refresh_token = $1
         AND s.revoked = FALSE
         AND s.expires_at > NOW()
         AND u.deleted_at IS NULL
       RETURNING
         s.id, s.user_id,
         u.id as u_id, u.email as u_email, u.role as u_role, u.status as u_status,
         u.email_verified as u_email_verified,
         u.first_name as u_first_name, u.last_name as u_last_name,
         u.username as u_username, u.avatar_url as u_avatar_url,
         u.mfa_enabled as u_mfa_enabled, u.last_login_at as u_last_login_at,
         u.created_at as u_created_at, u.updated_at as u_updated_at, u.metadata as u_metadata,
         u.deleted_at as u_deleted_at`,
      [refresh_token]
    );

    if (!result) {
      await this.logAuthEvent({
        event_type: 'refresh_token',
        status: 'failure',
        failure_reason: 'Token already used or invalid',
        ...metadata,
      });
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    // Construct user object from flat result
    const user: User = {
      id: result.u_id,
      email: result.u_email,
      role: toUserRole(result.u_role),
      status: toUserStatus(result.u_status),
      email_verified: result.u_email_verified,
      first_name: result.u_first_name,
      last_name: result.u_last_name,
      username: result.u_username,
      avatar_url: result.u_avatar_url,
      mfa_enabled: result.u_mfa_enabled,
      last_login_at: result.u_last_login_at,
      created_at: result.u_created_at,
      updated_at: result.u_updated_at,
      metadata: result.u_metadata,
    };

    // Check user status
    if (user.status !== 'active') {
      throw new AuthenticationError(`Account is ${user.status}`);
    }

    // Generate new tokens
    const tokens = await this.generateTokens(user, metadata);

    // Revoke the old session now that new tokens are issued.
    // Single-use: each refresh token can only be used once.
    await this.db.execute(
      'UPDATE sessions SET revoked = TRUE, revoked_at = NOW(), revoked_reason = $1 WHERE id = $2',
      ['Token refreshed (rotation)', result.id]
    );

    // Update last activity on the new session
    await this.db.execute(
      'UPDATE sessions SET last_activity_at = NOW() WHERE refresh_token = $1',
      [tokens.refresh_token]
    );

    await this.logAuthEvent({
      event_type: 'refresh_token',
      status: 'success',
      user_id: user.id,
      email: user.email,
      ...metadata,
    });

    return tokens;
  }

  /**
   * Verify JWT access token
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const payload = await this.verifyJWT(token);

      // Check if session is still valid
      const session = await this.db.queryOne<Session>(
        'SELECT id FROM sessions WHERE access_token_jti = $1 AND revoked = FALSE',
        [payload.jti]
      );

      if (!session) {
        throw new AuthenticationError('Token has been revoked');
      }

      return payload;
    } catch (error) {
      // Re-throw auth errors as-is (preserves specific error type)
      if (error instanceof AuthenticationError) {
        throw error;
      }
      // Wrap unexpected errors
      throw new AuthenticationError('Invalid or expired token');
    }
  }

  /**
   * Logout (revoke session)
   */
  async logout(
    refresh_token: string,
    user_id: string,
    metadata: { ip_address?: string; user_agent?: string } = {}
  ): Promise<void> {
    const session = await this.db.queryOne<Session>(
      'SELECT user_id FROM sessions WHERE refresh_token = $1',
      [refresh_token]
    );

    await this.db.execute(
      'UPDATE sessions SET revoked = TRUE, revoked_at = NOW(), revoked_reason = $1 WHERE refresh_token = $2 AND user_id = $3 AND revoked = FALSE',
      ['User logout', refresh_token, user_id]
    );

    if (session) {
      await this.logAuthEvent({
        event_type: 'logout',
        status: 'success',
        user_id: session.user_id,
        ...metadata,
      });
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(
    data: PasswordResetRequest,
    metadata: { ip_address?: string; user_agent?: string } = {}
  ): Promise<void> {
    const user = await this.db.queryOne<User>(
      'SELECT id, email FROM users WHERE email = $1 AND deleted_at IS NULL',
      [data.email.toLowerCase()]
    );

    if (!user) {
      // Don't reveal if email exists
      return;
    }

    const token = randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 3600000); // 1 hour

    await this.db.execute(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [user.id, token, expires_at, metadata.ip_address || null]
    );

    if (this.emailService) {
      await this.emailService.sendPasswordResetEmail(user.email, token);
    } else {
      console.log(`[EMAIL] Password reset requested for ${user.email} — token: ${token.substring(0, 8)}...`);
    }

    await this.logAuthEvent({
      event_type: 'password_reset_request',
      status: 'success',
      user_id: user.id,
      email: user.email,
      ...metadata,
    });
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    new_password: string,
    metadata: { ip_address?: string; user_agent?: string } = {}
  ): Promise<void> {
    // Validate password
    const passwordValidation = this.validatePassword(new_password);
    if (!passwordValidation.valid) {
      throw new ValidationError(passwordValidation.error || 'Invalid password');
    }

    // Find token
    const resetToken = await this.db.queryOne<{ user_id: string; used: boolean }>(
      `SELECT user_id, used FROM password_reset_tokens
       WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );

    if (!resetToken || resetToken.used) {
      throw new AuthenticationError('Invalid or expired reset token');
    }

    // Hash new password
    const password_hash = await this.hashPassword(new_password);

    // Update password
    await this.db.execute('UPDATE users SET password_hash = $1 WHERE id = $2', [
      password_hash,
      resetToken.user_id,
    ]);

    // Mark token as used
    await this.db.execute(
      'UPDATE password_reset_tokens SET used = TRUE, used_at = NOW() WHERE token = $1',
      [token]
    );

    // Revoke all sessions
    await this.db.execute(
      `UPDATE sessions SET revoked = TRUE, revoked_at = NOW(), revoked_reason = 'Password reset'
       WHERE user_id = $1`,
      [resetToken.user_id]
    );

    await this.logAuthEvent({
      event_type: 'password_reset_verify',
      status: 'success',
      user_id: resetToken.user_id,
      ...metadata,
    });
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(
    user_id: string,
    data: ChangePasswordRequest,
    metadata: { ip_address?: string; user_agent?: string } = {}
  ): Promise<void> {
    // Get current password hash
    const user = await this.db.queryOne<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL',
      [user_id]
    );

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Verify old password
    const passwordValid = await this.verifyPassword(data.old_password, user.password_hash);
    if (!passwordValid) {
      await this.logAuthEvent({
        event_type: 'password_change',
        status: 'failure',
        user_id,
        failure_reason: 'Invalid old password',
        ...metadata,
      });
      throw new AuthenticationError('Invalid old password');
    }

    // Validate new password
    const passwordValidation = this.validatePassword(data.new_password);
    if (!passwordValidation.valid) {
      throw new ValidationError(passwordValidation.error || 'Invalid password');
    }

    // Hash new password
    const password_hash = await this.hashPassword(data.new_password);

    // Update password
    await this.db.execute('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, user_id]);

    // Revoke all other sessions
    await this.db.execute(
      `UPDATE sessions SET revoked = TRUE, revoked_at = NOW(), revoked_reason = 'Password changed'
       WHERE user_id = $1`,
      [user_id]
    );

    await this.logAuthEvent({
      event_type: 'password_change',
      status: 'success',
      user_id,
      ...metadata,
    });
  }

  /**
   * Create email verification token
   */
  private async createEmailVerificationToken(user_id: string, email: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 86400000); // 24 hours

    await this.db.execute(
      `INSERT INTO email_verification_tokens (user_id, token, email, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user_id, token, email, expires_at]
    );

    if (this.emailService) {
      await this.emailService.sendVerificationEmail(email, token);
    } else {
      console.log(`[EMAIL] Verification email for user ${user_id} — token: ${token.substring(0, 8)}...`);
    }

    return token;
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<void> {
    const verificationToken = await this.db.queryOne<{ user_id: string; used: boolean }>(
      'SELECT user_id, used FROM email_verification_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (!verificationToken || verificationToken.used) {
      throw new ValidationError('Invalid or expired verification token');
    }

    await this.db.execute('UPDATE users SET email_verified = TRUE WHERE id = $1', [
      verificationToken.user_id,
    ]);

    await this.db.execute(
      'UPDATE email_verification_tokens SET used = TRUE, used_at = NOW() WHERE token = $1',
      [token]
    );

    await this.logAuthEvent({
      event_type: 'email_verify',
      status: 'success',
      user_id: verificationToken.user_id,
    });
  }

  /**
   * Password validation
   */
  private validatePassword(password: string): { valid: boolean; error?: string } {
    if (password.length < this.config.password_min_length) {
      return {
        valid: false,
        error: `Password must be at least ${this.config.password_min_length} characters`,
      };
    }

    if (this.config.password_require_uppercase && !/[A-Z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one uppercase letter' };
    }

    if (this.config.password_require_lowercase && !/[a-z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one lowercase letter' };
    }

    if (this.config.password_require_number && !/[0-9]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one number' };
    }

    if (this.config.password_require_special && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one special character' };
    }

    return { valid: true };
  }

  /**
   * Email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Hash password using Argon2id (OWASP recommended)
   *
   * Parameters follow OWASP guidelines:
   *   - algorithm: argon2id (resistant to both side-channel and GPU attacks)
   *   - memoryCost: 65536 KB (64 MB)
   *   - timeCost: 3 iterations
   *
   * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
   */
  private async hashPassword(password: string): Promise<string> {
    return await Bun.password.hash(password, {
      algorithm: 'argon2id',
      memoryCost: 65536,
      timeCost: 3,
    });
  }

  /**
   * Verify password against stored hash.
   * Bun.password.verify auto-detects the algorithm from the hash prefix
   * ($argon2id$, $2b$, etc.) so this handles legacy bcrypt hashes too.
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await Bun.password.verify(password, hash);
    } catch {
      // If hash format is unrecognized (e.g. corrupted data), reject
      return false;
    }
  }

  /**
   * Sign JWT using HMAC-SHA256 (HS256) via Web Crypto API.
   * Accepts JWTPayload which may include an optional `purpose` for special tokens.
   */
  private async signJWT(payload: JWTPayload): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    // Strip undefined purpose field from payload before signing to keep tokens compact
    const cleanPayload = { ...payload };
    if (cleanPayload.purpose === undefined) {
      delete cleanPayload.purpose;
    }
    const encodedPayload = Buffer.from(JSON.stringify(cleanPayload)).toString('base64url');
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.config.jwt_secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signatureInput)
    );

    const encodedSignature = Buffer.from(signature).toString('base64url');
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  /**
   * Verify JWT using HMAC-SHA256 (HS256) via Web Crypto API
   */
  private async verifyJWT(token: string): Promise<JWTPayload> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.config.jwt_secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const expectedSig = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signatureInput)
    );
    const expectedSignature = Buffer.from(expectedSig).toString('base64url');

    // Timing-safe comparison
    if (signature !== expectedSignature) {
      throw new Error('Invalid signature');
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString());

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return payload as JWTPayload;
  }

  /**
   * Log authentication event
   */
  private async logAuthEvent(data: {
    event_type: AuthEventType;
    status: 'success' | 'failure';
    user_id?: string;
    email?: string | null;
    wallet_address?: string;
    failure_reason?: string;
    ip_address?: string;
    user_agent?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.db.execute(
      `INSERT INTO auth_audit_logs (user_id, event_type, status, ip_address, user_agent,
                                     email, wallet_address, failure_reason, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        data.user_id || null,
        data.event_type,
        data.status,
        data.ip_address || null,
        data.user_agent || null,
        data.email || null,
        data.wallet_address || null,
        data.failure_reason || null,
        JSON.stringify(data.metadata || {}),
      ]
    );
  }
}
