/**
 * Account Security Service
 * Comprehensive security management including 2FA, device tracking, and activity monitoring
 */

import type { PostgresDB } from '../db/postgres-client';
import type {
  User2FA,
  TwoFactorMethod,
  TwoFactorSetupData,
  LoginAttempt,
  LoginAttemptType,
  TrustedDevice,
  DeviceInfo,
  IPAccessControl,
  IPAccessType,
  AccountLockout,
  SecurityActivityLog,
  SecurityActivityType,
  SecurityActivityCategory,
  SecuritySeverity,
  PasswordHistory,
  PasswordResetToken,
  UserSecuritySettings,
  ActiveSession,
  SecurityAlert,
  SecurityAlertType,
  AlertSeverity,
} from '../types/security';
import { calculatePasswordStrength, calculateRiskScore } from '../types/security';
import { generateTOTPSecret, generateBackupCodes, hashBackupCodes } from '../utils/security.utils';

export class AccountSecurityService {
  private db: PostgresDB;

  constructor(db: PostgresDB) {
    this.db = db;
  }

  // ============================================================================
  // TWO-FACTOR AUTHENTICATION (2FA)
  // ============================================================================

  /**
   * Initialize 2FA for user (creates record but not enabled yet)
   */
  async initialize2FA(userId: string, method: TwoFactorMethod = 'totp'): Promise<User2FA> {
    const query = `
      INSERT INTO user_2fa (user_id, method, enabled)
      VALUES ($1, $2, false)
      ON CONFLICT (user_id) DO UPDATE SET method = excluded.method
      RETURNING *
    `;

    const result = await this.db.queryOne(query, [userId, method]);
    return this.mapToUser2FA(result);
  }

  /**
   * Setup TOTP (Google Authenticator, Authy, etc.)
   * Note: For hashed storage, pass already-hashed backup codes
   */
  async setupTOTP(userId: string, secret: string, backupCodes: string[]): Promise<User2FA> {
    const query = `
      UPDATE user_2fa
      SET 
        totp_secret = $1,
        totp_backup_codes = $2,
        setup_completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $3
      RETURNING *
    `;

    // Pass array directly - pg driver converts to PostgreSQL array format
    const result = await this.db.queryOne(query, [secret, backupCodes, userId]);
    return this.mapToUser2FA(result);
  }

  /**
   * Generate complete 2FA setup (secret + backup codes + QR code)
   * Returns everything needed for user to set up 2FA
   */
  async generateTOTPSetup(userId: string, userEmail: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    uri: string;
    backupCodes: string[];
    hashedBackupCodes: string[];
  }> {
    // Generate TOTP secret
    const { secret, uri, qrCodeUrl } = generateTOTPSecret('DotMX', userEmail);
    
    // Generate backup codes (plain text for user to save)
    const backupCodes = generateBackupCodes(10);
    
    // Hash backup codes for database storage
    const hashedBackupCodes = hashBackupCodes(backupCodes);
    
    return {
      secret,
      qrCodeUrl,
      uri,
      backupCodes, // Show to user once
      hashedBackupCodes, // Store in database
    };
  }

  /**
   * Enable 2FA after verification
   */
  async enable2FA(userId: string, setupByIp?: string): Promise<User2FA> {
    const query = `
      UPDATE user_2fa
      SET 
        enabled = true,
        setup_by_ip = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
      RETURNING *
    `;

    const result = await this.db.queryOne(query, [setupByIp || null, userId]);
    
    // Log security activity
    await this.logSecurityActivity(userId, '2fa_enabled', 'security_setting', {
      description: 'Two-factor authentication enabled',
      severity: 'info',
      ip_address: setupByIp,
    });

    return this.mapToUser2FA(result);
  }

  /**
   * Disable 2FA
   */
  async disable2FA(userId: string, reason: string): Promise<User2FA> {
    const query = `
      UPDATE user_2fa
      SET enabled = false, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `;

    const result = await this.db.queryOne(query, [userId]);

    await this.logSecurityActivity(userId, '2fa_disabled', 'security_setting', {
      description: `Two-factor authentication disabled: ${reason}`,
      severity: 'warning',
    });

    return this.mapToUser2FA(result);
  }

  /**
   * Verify 2FA code
   */
  async verify2FACode(userId: string, code: string, isBackupCode: boolean = false): Promise<boolean> {
    const user2fa = await this.get2FAStatus(userId);
    if (!user2fa || !user2fa.enabled) {
      return false;
    }

    let isValid = false;

    if (isBackupCode) {
      // Verify backup code
      const backupCodes = user2fa.totp_backup_codes || [];
      isValid = backupCodes.includes(code);

      if (isValid) {
        // Remove used backup code
        const updatedCodes = backupCodes.filter(c => c !== code);
        await this.db.execute(
          `UPDATE user_2fa SET totp_backup_codes = $1, totp_backup_codes_used = totp_backup_codes_used + 1 WHERE user_id = $2`,
          [updatedCodes, userId]
        );
      }
    } else {
      // Verify TOTP code
      if (user2fa.totp_secret) {
        try {
          // Use otpauth library for production TOTP verification
          const { TOTP } = await import('otpauth');
          const totp = new TOTP({
            secret: user2fa.totp_secret,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
          });
          
          // Validate with window of ±1 period (30 seconds) to account for clock drift
          const delta = totp.validate({ token: code, window: 1 });
          isValid = delta !== null;
        } catch (error) {
          console.error('TOTP verification error:', error);
          isValid = false;
        }
      }
    }

    if (isValid) {
      // Update success stats
      await this.db.execute(
        `UPDATE user_2fa SET total_uses = total_uses + 1, last_used_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
        [userId]
      );

      return true;
    } else {
      // Update failure stats
      await this.db.execute(
        `UPDATE user_2fa SET failed_attempts = failed_attempts + 1, last_failed_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
        [userId]
      );

      return false;
    }
  }

  /**
   * Get 2FA status for user
   */
  async get2FAStatus(userId: string): Promise<User2FA | null> {
    const query = `SELECT * FROM user_2fa WHERE user_id = $1`;
    const result = await this.db.queryOne(query, [userId]);
    return result ? this.mapToUser2FA(result) : null;
  }

  // ============================================================================
  // LOGIN ATTEMPTS TRACKING
  // ============================================================================

  /**
   * Record login attempt
   */
  async recordLoginAttempt(data: {
    userId?: string;
    email?: string;
    username?: string;
    attemptType: LoginAttemptType;
    success: boolean;
    failureReason?: string;
    ipAddress: string;
    userAgent?: string;
    deviceFingerprint?: string;
    countryCode?: string;
    city?: string;
  }): Promise<LoginAttempt> {
    // Calculate risk score
    const recentFailures = await this.getRecentFailedAttempts(data.email || data.username || '', data.ipAddress);
    
    // Check if device is new (not in trusted devices)
    let isNewDevice = true;
    if (data.userId && data.deviceFingerprint) {
      const deviceQuery = `SELECT id FROM trusted_devices WHERE user_id = $1 AND device_fingerprint = $2`;
      const existingDevice = await this.db.queryOne(deviceQuery, [data.userId, data.deviceFingerprint]);
      isNewDevice = !existingDevice;
    }
    
    // Check if location is new (simplified - check last login from same city)
    let isNewLocation = true;
    if (data.userId && data.city) {
      const locationQuery = `SELECT id FROM login_attempts WHERE user_id = $1 AND city = $2 LIMIT 1`;
      const existingLocation = await this.db.queryOne(locationQuery, [data.userId, data.city]);
      isNewLocation = !existingLocation;
    }
    
    const riskScore = calculateRiskScore({
      failed_attempts: recentFailures,
      is_new_device: isNewDevice,
      is_new_location: isNewLocation,
      is_vpn: false, // Would need VPN detection service
      time_since_last_login_hours: 0,
    });

    const query = `
      INSERT INTO login_attempts (
        user_id, email, username, attempt_type, success, failure_reason,
        ip_address, user_agent, device_fingerprint, country_code, city,
        is_suspicious, risk_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const result = await this.db.queryOne(query, [
      data.userId || null,
      data.email || null,
      data.username || null,
      data.attemptType,
      data.success,
      data.failureReason || null,
      data.ipAddress,
      data.userAgent || null,
      data.deviceFingerprint || null,
      data.countryCode || null,
      data.city || null,
      riskScore > 50,
      riskScore,
    ]);

    // Check for account lockout
    if (!data.success && data.userId) {
      await this.incrementFailedAttempts(data.userId, data.attemptType === '2fa');
    }

    return this.mapToLoginAttempt(result);
  }

  /**
   * Get recent failed attempts count
   */
  private async getRecentFailedAttempts(identifier: string, ipAddress: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const query = `
      SELECT COUNT(*) as count
      FROM login_attempts
      WHERE (email = $1 OR username = $2 OR ip_address = $3)
        AND success = false
        AND created_at > $4
    `;

    const result = await this.db.queryOne<{ count: string }>(query, [identifier, identifier, ipAddress, oneHourAgo]);
    return parseInt(result?.count || '0', 10);
  }

  /**
   * Get login history for user
   */
  async getLoginHistory(userId: string, limit: number = 50): Promise<LoginAttempt[]> {
    const query = `
      SELECT * FROM login_attempts
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const results = await this.db.queryAll(query, [userId, limit]);
    return results.map((r: any) => this.mapToLoginAttempt(r));
  }

  // ============================================================================
  // TRUSTED DEVICES
  // ============================================================================

  /**
   * Register or update device
   */
  async registerDevice(userId: string, deviceInfo: DeviceInfo): Promise<TrustedDevice> {
    const query = `
      INSERT INTO trusted_devices (
        user_id, device_fingerprint, device_name, device_type,
        browser, os, user_agent, first_ip, last_ip, country_code, city
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id, device_fingerprint) 
      DO UPDATE SET
        last_ip = excluded.last_ip,
        last_seen_at = CURRENT_TIMESTAMP,
        login_count = trusted_devices.login_count + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await this.db.queryOne(query, [
      userId,
      deviceInfo.fingerprint,
      deviceInfo.name || null,
      deviceInfo.type,
      deviceInfo.browser || null,
      deviceInfo.os || null,
      deviceInfo.user_agent,
      deviceInfo.ip_address,
      deviceInfo.ip_address,
      null,
      null,
    ]);

    return this.mapToTrustedDevice(result);
  }

  /**
   * Trust a device
   */
  async trustDevice(userId: string, deviceFingerprint: string, daysValid: number = 30): Promise<TrustedDevice> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysValid);

    const query = `
      UPDATE trusted_devices
      SET trusted = true, trust_expires_at = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2 AND device_fingerprint = $3
      RETURNING *
    `;

    const result = await this.db.queryOne(query, [expiresAt.toISOString(), userId, deviceFingerprint]);

    await this.logSecurityActivity(userId, 'device_trusted', 'access_control', {
      description: 'Device marked as trusted',
      severity: 'info',
      device_fingerprint: deviceFingerprint,
    });

    return this.mapToTrustedDevice(result);
  }

  /**
   * Revoke device trust
   */
  async revokeDevice(userId: string, deviceFingerprint: string, reason: string): Promise<TrustedDevice> {
    const query = `
      UPDATE trusted_devices
      SET 
        trusted = false,
        revoked = true,
        revoked_at = CURRENT_TIMESTAMP,
        revoked_reason = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2 AND device_fingerprint = $3
      RETURNING *
    `;

    const result = await this.db.queryOne(query, [reason, userId, deviceFingerprint]);

    await this.logSecurityActivity(userId, 'device_revoked', 'access_control', {
      description: `Device revoked: ${reason}`,
      severity: 'warning',
      device_fingerprint: deviceFingerprint,
    });

    return this.mapToTrustedDevice(result);
  }

  /**
   * Get trusted devices for user
   */
  async getTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    const query = `
      SELECT * FROM trusted_devices
      WHERE user_id = $1 AND revoked = false
      ORDER BY last_seen_at DESC
    `;

    const results = await this.db.queryAll(query, [userId]);
    return results.map((r: any) => this.mapToTrustedDevice(r));
  }

  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(userId: string, deviceFingerprint: string): Promise<boolean> {
    const query = `
      SELECT trusted, trust_expires_at
      FROM trusted_devices
      WHERE user_id = $1 AND device_fingerprint = $2 AND revoked = false
    `;

    const result = await this.db.queryOne<any>(query, [userId, deviceFingerprint]);
    
    if (!result || !result.trusted) {
      return false;
    }

    // Check if trust expired
    if (result.trust_expires_at) {
      const expiresAt = new Date(result.trust_expires_at);
      if (expiresAt < new Date()) {
        return false;
      }
    }

    return true;
  }

  // ============================================================================
  // ACCOUNT LOCKOUT
  // ============================================================================

  /**
   * Initialize lockout settings for user
   */
  async initializeLockout(userId: string): Promise<AccountLockout> {
    const query = `
      INSERT INTO account_lockout (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
      RETURNING *
    `;

    const result = await this.db.queryOne(query, [userId]);
    
    // If conflict occurred (user already exists), fetch the existing record
    if (!result) {
      const existingQuery = `SELECT * FROM account_lockout WHERE user_id = $1`;
      const existing = await this.db.queryOne(existingQuery, [userId]);
      return this.mapToAccountLockout(existing);
    }
    
    return this.mapToAccountLockout(result);
  }

  /**
   * Increment failed login attempts
   */
  private async incrementFailedAttempts(userId: string, is2FA: boolean = false): Promise<void> {
    await this.initializeLockout(userId);

    const field = is2FA ? 'failed_2fa_attempts' : 'failed_login_attempts';
    const maxAttempts = 5;

    const query = `
      UPDATE account_lockout
      SET 
        ${field} = ${field} + 1,
        last_failed_attempt_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING ${field}
    `;

    const result = await this.db.queryOne<any>(query, [userId]);
    const attempts = result?.[field] || 0;

    // Lock account if max attempts reached
    if (attempts >= maxAttempts) {
      await this.lockAccount(userId, 'too_many_attempts');
    }
  }

  /**
   * Lock user account
   */
  async lockAccount(userId: string, reason: string, durationMinutes: number = 30): Promise<AccountLockout> {
    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + durationMinutes);

    const query = `
      UPDATE account_lockout
      SET 
        is_locked = true,
        locked_at = CURRENT_TIMESTAMP,
        locked_until = $1,
        lock_reason = $2,
        total_lockouts = total_lockouts + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $3
      RETURNING *
    `;

    const result = await this.db.queryOne(query, [lockedUntil.toISOString(), reason, userId]);

    await this.logSecurityActivity(userId, 'login', 'authentication', {
      description: `Account locked: ${reason}`,
      severity: 'critical',
    });

    await this.createSecurityAlert(userId, 'account_locked', 'high', `Your account has been locked due to: ${reason}`);

    return this.mapToAccountLockout(result);
  }

  /**
   * Unlock user account
   */
  async unlockAccount(userId: string, unlockedBy: string, reason: string): Promise<AccountLockout> {
    const query = `
      UPDATE account_lockout
      SET 
        is_locked = false,
        locked_until = NULL,
        failed_login_attempts = 0,
        failed_2fa_attempts = 0,
        unlocked_by_user_id = $1,
        unlocked_at = CURRENT_TIMESTAMP,
        unlock_reason = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $3
      RETURNING *
    `;

    const result = await this.db.queryOne(query, [unlockedBy, reason, userId]);

    await this.logSecurityActivity(userId, 'login', 'authentication', {
      description: `Account unlocked: ${reason}`,
      severity: 'info',
    });

    return this.mapToAccountLockout(result);
  }

  /**
   * Check if account is locked
   */
  async isAccountLocked(userId: string): Promise<boolean> {
    const query = `
      SELECT is_locked, locked_until, auto_unlock_enabled
      FROM account_lockout
      WHERE user_id = $1
    `;

    const result = await this.db.queryOne<any>(query, [userId]);
    
    if (!result || !result.is_locked) {
      return false;
    }

    // Check if auto-unlock time has passed
    if (result.auto_unlock_enabled && result.locked_until) {
      const lockedUntil = new Date(result.locked_until);
      if (lockedUntil < new Date()) {
        // Auto-unlock
        await this.unlockAccount(userId, 'system', 'auto_unlock_timeout');
        return false;
      }
    }

    return true;
  }

  /**
   * Reset failed attempts (on successful login)
   */
  async resetFailedAttempts(userId: string): Promise<void> {
    const query = `
      UPDATE account_lockout
      SET 
        failed_login_attempts = 0,
        failed_2fa_attempts = 0,
        last_failed_attempt_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;

    await this.db.execute(query, [userId]);
  }

  // ============================================================================
  // SECURITY ACTIVITY LOGGING
  // ============================================================================

  /**
   * Log security activity
   */
  async logSecurityActivity(
    userId: string,
    activityType: SecurityActivityType,
    category: SecurityActivityCategory,
    data: {
      description?: string;
      severity?: SecuritySeverity;
      ip_address?: string;
      user_agent?: string;
      device_fingerprint?: string;
      old_value?: string;
      new_value?: string;
      risk_score?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<SecurityActivityLog> {
    const query = `
      INSERT INTO security_activity_logs (
        user_id, activity_type, activity_category, description, severity,
        ip_address, user_agent, device_fingerprint, old_value, new_value,
        risk_score, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const result = await this.db.queryOne(query, [
      userId,
      activityType,
      category,
      data.description || null,
      data.severity || 'info',
      data.ip_address || null,
      data.user_agent || null,
      data.device_fingerprint || null,
      data.old_value || null,
      data.new_value || null,
      data.risk_score || 0,
      JSON.stringify(data.metadata || {}),
    ]);

    return this.mapToSecurityActivityLog(result);
  }

  /**
   * Get security activity logs
   */
  async getSecurityActivityLogs(userId: string, limit: number = 100): Promise<SecurityActivityLog[]> {
    const query = `
      SELECT * FROM security_activity_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const results = await this.db.queryAll(query, [userId, limit]);
    return results.map((r: any) => this.mapToSecurityActivityLog(r));
  }

  // ============================================================================
  // SECURITY SETTINGS
  // ============================================================================

  /**
   * Initialize security settings for user
   */
  async initializeSecuritySettings(userId: string): Promise<UserSecuritySettings> {
    const query = `
      INSERT INTO user_security_settings (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
      RETURNING *
    `;

    const result = await this.db.queryOne(query, [userId]);
    
    // If conflict occurred (user already exists), fetch the existing record
    if (!result) {
      const existingQuery = `SELECT * FROM user_security_settings WHERE user_id = $1`;
      const existing = await this.db.queryOne(existingQuery, [userId]);
      return this.mapToUserSecuritySettings(existing);
    }
    
    return this.mapToUserSecuritySettings(result);
  }

  /**
   * Get security settings
   */
  async getSecuritySettings(userId: string): Promise<UserSecuritySettings | null> {
    const query = `SELECT * FROM user_security_settings WHERE user_id = $1`;
    const result = await this.db.queryOne(query, [userId]);
    return result ? this.mapToUserSecuritySettings(result) : null;
  }

  /**
   * Update security settings
   */
  async updateSecuritySettings(userId: string, settings: Partial<UserSecuritySettings>): Promise<UserSecuritySettings> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(settings).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'user_id' && key !== 'created_at' && key !== 'updated_at') {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const query = `
      UPDATE user_security_settings
      SET ${updates.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.queryOne(query, values);
    
    await this.logSecurityActivity(userId, 'security_settings_changed', 'security_setting', {
      description: 'Security settings updated',
      severity: 'info',
    });

    return this.mapToUserSecuritySettings(result);
  }

  // ============================================================================
  // SECURITY ALERTS
  // ============================================================================

  /**
   * Create security alert
   */
  async createSecurityAlert(
    userId: string,
    alertType: SecurityAlertType,
    severity: AlertSeverity,
    message: string,
    options: {
      requires_action?: boolean;
      action_type?: string;
      ip_address?: string;
      device_fingerprint?: string;
    } = {}
  ): Promise<SecurityAlert> {
    const title = this.getAlertTitle(alertType);

    const query = `
      INSERT INTO security_alerts (
        user_id, alert_type, severity, title, message,
        requires_action, action_type, ip_address, device_fingerprint
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await this.db.queryOne(query, [
      userId,
      alertType,
      severity,
      title,
      message,
      options.requires_action || false,
      options.action_type || null,
      options.ip_address || null,
      options.device_fingerprint || null,
    ]);

    return this.mapToSecurityAlert(result);
  }

  /**
   * Get security alerts for user
   */
  async getSecurityAlerts(userId: string, status?: string): Promise<SecurityAlert[]> {
    let query = `
      SELECT * FROM security_alerts
      WHERE user_id = $1
    `;

    const params: any[] = [userId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    const results = await this.db.queryAll(query, params);
    return results.map((r: any) => this.mapToSecurityAlert(r));
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    const query = `
      UPDATE security_alerts
      SET status = 'acknowledged', acknowledged_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await this.db.execute(query, [alertId]);
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getAlertTitle(alertType: SecurityAlertType): string {
    const titles: Record<SecurityAlertType, string> = {
      new_device: 'New Device Login Detected',
      unusual_location: 'Login from Unusual Location',
      failed_login_attempts: 'Multiple Failed Login Attempts',
      withdrawal_attempt: 'Withdrawal Attempt Detected',
      api_key_usage: 'API Key Used',
      password_change: 'Password Changed',
      account_locked: 'Account Locked',
      suspicious_activity: 'Suspicious Activity Detected',
    };

    return titles[alertType] || 'Security Alert';
  }

  // Mapping functions
  private mapToUser2FA(row: any): User2FA {
    return {
      id: row.id,
      user_id: row.user_id,
      method: row.method,
      enabled: row.enabled,
      totp_secret: row.totp_secret,
      totp_backup_codes: row.totp_backup_codes ? (typeof row.totp_backup_codes === 'string' ? JSON.parse(row.totp_backup_codes) : row.totp_backup_codes) : null,
      totp_backup_codes_used: row.totp_backup_codes_used,
      phone_number: row.phone_number,
      phone_verified: row.phone_verified,
      is_mandatory: row.is_mandatory,
      grace_period_until: row.grace_period_until ? new Date(row.grace_period_until) : null,
      last_used_at: row.last_used_at ? new Date(row.last_used_at) : null,
      total_uses: row.total_uses,
      failed_attempts: row.failed_attempts,
      last_failed_at: row.last_failed_at ? new Date(row.last_failed_at) : null,
      setup_completed_at: row.setup_completed_at ? new Date(row.setup_completed_at) : null,
      setup_by_ip: row.setup_by_ip,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  private mapToLoginAttempt(row: any): LoginAttempt {
    return {
      id: row.id,
      user_id: row.user_id,
      email: row.email,
      username: row.username,
      attempt_type: row.attempt_type,
      success: row.success,
      failure_reason: row.failure_reason,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      device_fingerprint: row.device_fingerprint,
      country_code: row.country_code,
      city: row.city,
      is_suspicious: row.is_suspicious,
      risk_score: row.risk_score,
      blocked_by_rule: row.blocked_by_rule,
      created_at: new Date(row.created_at),
    };
  }

  private mapToTrustedDevice(row: any): TrustedDevice {
    return {
      id: row.id,
      user_id: row.user_id,
      device_fingerprint: row.device_fingerprint,
      device_name: row.device_name,
      device_type: row.device_type,
      browser: row.browser,
      os: row.os,
      user_agent: row.user_agent,
      trusted: row.trusted,
      trust_expires_at: row.trust_expires_at ? new Date(row.trust_expires_at) : null,
      first_ip: row.first_ip,
      last_ip: row.last_ip,
      country_code: row.country_code,
      city: row.city,
      first_seen_at: new Date(row.first_seen_at),
      last_seen_at: new Date(row.last_seen_at),
      login_count: row.login_count,
      revoked: row.revoked,
      revoked_at: row.revoked_at ? new Date(row.revoked_at) : null,
      revoked_reason: row.revoked_reason,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  private mapToAccountLockout(row: any): AccountLockout {
    return {
      id: row.id,
      user_id: row.user_id,
      is_locked: row.is_locked,
      locked_at: row.locked_at ? new Date(row.locked_at) : null,
      locked_until: row.locked_until ? new Date(row.locked_until) : null,
      lock_reason: row.lock_reason,
      failed_login_attempts: row.failed_login_attempts,
      failed_2fa_attempts: row.failed_2fa_attempts,
      last_failed_attempt_at: row.last_failed_attempt_at ? new Date(row.last_failed_attempt_at) : null,
      auto_unlock_enabled: row.auto_unlock_enabled,
      unlock_after_minutes: row.unlock_after_minutes,
      unlocked_by_user_id: row.unlocked_by_user_id,
      unlocked_at: row.unlocked_at ? new Date(row.unlocked_at) : null,
      unlock_reason: row.unlock_reason,
      total_lockouts: row.total_lockouts,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  private mapToSecurityActivityLog(row: any): SecurityActivityLog {
    return {
      id: row.id,
      user_id: row.user_id,
      activity_type: row.activity_type,
      activity_category: row.activity_category,
      description: row.description,
      severity: row.severity,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      device_fingerprint: row.device_fingerprint,
      country_code: row.country_code,
      city: row.city,
      old_value: row.old_value,
      new_value: row.new_value,
      risk_score: row.risk_score,
      is_anomaly: row.is_anomaly,
      user_notified: row.user_notified,
      notification_sent_at: row.notification_sent_at ? new Date(row.notification_sent_at) : null,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {},
      created_at: new Date(row.created_at),
    };
  }

  private mapToUserSecuritySettings(row: any): UserSecuritySettings {
    return {
      id: row.id,
      user_id: row.user_id,
      require_2fa_for_login: row.require_2fa_for_login,
      require_2fa_for_withdrawal: row.require_2fa_for_withdrawal,
      require_2fa_for_api_key: row.require_2fa_for_api_key,
      require_2fa_for_settings_change: row.require_2fa_for_settings_change,
      session_timeout_minutes: row.session_timeout_minutes,
      remember_device_days: row.remember_device_days,
      max_concurrent_sessions: row.max_concurrent_sessions,
      allow_password_login: row.allow_password_login,
      allow_wallet_login: row.allow_wallet_login,
      restrict_to_whitelisted_ips: row.restrict_to_whitelisted_ips,
      notify_on_login: row.notify_on_login,
      notify_on_new_device: row.notify_on_new_device,
      notify_on_withdrawal: row.notify_on_withdrawal,
      notify_on_api_key_usage: row.notify_on_api_key_usage,
      notify_on_password_change: row.notify_on_password_change,
      notify_on_suspicious_activity: row.notify_on_suspicious_activity,
      notification_email: row.notification_email,
      require_device_confirmation: row.require_device_confirmation,
      auto_logout_on_ip_change: row.auto_logout_on_ip_change,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  private mapToSecurityAlert(row: any): SecurityAlert {
    return {
      id: row.id,
      user_id: row.user_id,
      alert_type: row.alert_type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      trigger_event_id: row.trigger_event_id,
      ip_address: row.ip_address,
      device_fingerprint: row.device_fingerprint,
      status: row.status,
      acknowledged_at: row.acknowledged_at ? new Date(row.acknowledged_at) : null,
      resolved_at: row.resolved_at ? new Date(row.resolved_at) : null,
      requires_action: row.requires_action,
      action_type: row.action_type,
      action_url: row.action_url,
      action_taken: row.action_taken,
      action_taken_at: row.action_taken_at ? new Date(row.action_taken_at) : null,
      notification_sent: row.notification_sent,
      notification_channels: row.notification_channels ? (typeof row.notification_channels === 'string' ? JSON.parse(row.notification_channels) : row.notification_channels) : null,
      notification_sent_at: row.notification_sent_at ? new Date(row.notification_sent_at) : null,
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {},
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}
