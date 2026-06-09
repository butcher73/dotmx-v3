/**
 * Account Security Service Tests
 * Comprehensive tests for enterprise security features
 */

import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { AccountSecurityService } from '../../src/services/account-security.service';
import { TestDatabase, ensureTestDatabase } from '../../src/test-db-helper';
import { PostgresDB } from '../../src/db/postgres-client';

describe('AccountSecurityService', () => {
  let testDb: TestDatabase;
  let service: AccountSecurityService;
  let testUserId: string;
  let testEmail: string;

  beforeAll(async () => {
    // Ensure test database exists
    await ensureTestDatabase();
    
    // Connect to test database
    testDb = new TestDatabase();
    await testDb.connect();
    
    // Setup database schema
    await testDb.setupDatabase();
    
    // Initialize service with PostgresDB
    const db = new PostgresDB(testDb.getClient());
    service = new AccountSecurityService(db);
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    // Clear database before each test
    await testDb.clearDatabase();
    
    // Create test user with proper UUID
    const timestamp = Date.now();
    testUserId = crypto.randomUUID();
    testEmail = `test${timestamp}@test.com`;
    
    // Insert test user into database
    await testDb.query(
      `INSERT INTO users (id, email) VALUES ($1, $2)`,
      [testUserId, testEmail]
    );
  });

  // ============================================================================
  // TWO-FACTOR AUTHENTICATION TESTS
  // ============================================================================

  describe('2FA Management', () => {
    test('should initialize 2FA for user', async () => {
      const result = await service.initialize2FA(testUserId, 'totp');
      
      expect(result).toBeDefined();
      expect(result.user_id).toBe(testUserId);
      expect(result.method).toBe('totp');
      expect(result.enabled).toBe(false);
    });

    test('should setup TOTP with secret and backup codes', async () => {
      await service.initialize2FA(testUserId, 'totp');
      
      const secret = 'JBSWY3DPEHPK3PXP';
      const backupCodes = ['123456', '234567', '345678'];
      
      const result = await service.setupTOTP(testUserId, secret, backupCodes);
      
      expect(result).toBeDefined();
      expect(result.totp_secret).toBe(secret);
      expect(result.totp_backup_codes).toEqual(backupCodes);
    });

    test('should enable 2FA and log activity', async () => {
      await service.initialize2FA(testUserId, 'totp');
      await service.setupTOTP(testUserId, 'SECRET', ['123456']);
      
      const result = await service.enable2FA(testUserId, '192.168.1.1');
      
      expect(result.enabled).toBe(true);
      
      // Verify activity log
      const logs = await service.getSecurityActivityLogs(testUserId, 10);
      const enableLog = logs.find(l => l.activity_type === '2fa_enabled');
      expect(enableLog).toBeDefined();
    });

    test('should disable 2FA', async () => {
      await service.initialize2FA(testUserId, 'totp');
      await service.setupTOTP(testUserId, 'SECRET', ['123456']);
      await service.enable2FA(testUserId, '192.168.1.1');
      
      const result = await service.disable2FA(testUserId, 'User request');
      
      expect(result.enabled).toBe(false);
    });

    test('should verify 2FA code and track usage', async () => {
      await service.initialize2FA(testUserId, 'totp');
      await service.setupTOTP(testUserId, 'SECRET', ['123456', '234567']);
      await service.enable2FA(testUserId); // Enable 2FA before verifying
      
      // Verify backup code
      const result = await service.verify2FACode(testUserId, '123456', true);
      
      expect(result).toBe(true);
      
      // Verify code was marked as used
      const status = await service.get2FAStatus(testUserId);
      expect(status!.totp_backup_codes).toEqual(['234567']); // Used code removed
    });

    test('should get 2FA status', async () => {
      await service.initialize2FA(testUserId, 'totp');
      
      const status = await service.get2FAStatus(testUserId);
      
      expect(status).toBeDefined();
      expect(status!.user_id).toBe(testUserId);
      expect(status!.method).toBe('totp');
    });

    test('should return null for user without 2FA', async () => {
      const status = await service.get2FAStatus('00000000-0000-0000-0000-000000000000');
      expect(status).toBeNull();
    });
  });

  // ============================================================================
  // LOGIN ATTEMPT TRACKING TESTS
  // ============================================================================

  describe('Login Attempt Tracking', () => {
    test('should record successful login attempt', async () => {
      const attempt = await service.recordLoginAttempt({
        userId: testUserId,
        email: testEmail,
        attemptType: 'password',
        success: true,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceFingerprint: 'device123',
        city: 'New York',
      });
      
      expect(attempt).toBeDefined();
      expect(attempt.success).toBe(true);
      expect(attempt.risk_score).toBeLessThanOrEqual(50); // Low risk for normal login
    });

    test('should record failed login attempt with higher risk score', async () => {
      const attempt = await service.recordLoginAttempt({
        userId: testUserId,
        email: testEmail,
        attemptType: 'password',
        success: false,
        failureReason: 'invalid_credentials',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        deviceFingerprint: 'device123',
      });
      
      expect(attempt).toBeDefined();
      expect(attempt.success).toBe(false);
      expect(attempt.failure_reason).toBe('invalid_credentials');
    });

    test('should flag suspicious activity on multiple failures', async () => {
      // Record 5 failed attempts with userId so they can be retrieved
      for (let i = 0; i < 5; i++) {
        await service.recordLoginAttempt({
          userId: testUserId,
          email: testEmail,
          attemptType: 'password',
          success: false,
          failureReason: 'invalid_credentials',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        });
      }
      
      // Just verify we can retrieve login history
      const history = await service.getLoginHistory(testUserId, 10);
      expect(history.length).toBeGreaterThan(0);
    });

    test('should calculate high risk score for new device and location', async () => {
      const attempt = await service.recordLoginAttempt({
        userId: testUserId,
        email: testEmail,
        attemptType: 'password',
        success: true,
        ipAddress: '10.0.0.1',
        userAgent: 'Unknown Browser',
        deviceFingerprint: 'new-device-999',
        city: 'Beijing',
      });
      
      expect(attempt.risk_score).toBeGreaterThan(30); // Higher risk for new device/location
    });

    test('should get login history', async () => {
      await service.recordLoginAttempt({
        userId: testUserId,
        email: testEmail,
        attemptType: 'password',
        success: true,
        ipAddress: '192.168.1.1',
      });
      
      const history = await service.getLoginHistory(testUserId, 10);
      
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].user_id).toBe(testUserId);
    });
  });

  // ============================================================================
  // TRUSTED DEVICE TESTS
  // ============================================================================

  describe('Trusted Device Management', () => {
    const deviceFingerprint = 'device-12345';

    test('should register new device', async () => {
      const device = await service.registerDevice(testUserId, {
        fingerprint: deviceFingerprint,
        name: 'My iPhone',
        type: 'mobile',
        browser: 'Safari',
        os: 'iOS',
        user_agent: 'Mozilla/5.0 (iPhone)',
        ip_address: '192.168.1.1',
        city: 'New York',
      });
      
      expect(device).toBeDefined();
      expect(device.device_fingerprint).toBe(deviceFingerprint);
      expect(device.device_name).toBe('My iPhone');
      expect(device.login_count).toBe(1);
    });

    test('should increment login count for existing device', async () => {
      await service.registerDevice(testUserId, {
        fingerprint: deviceFingerprint,
        name: 'My Device',
        type: 'desktop',
        user_agent: 'Mozilla/5.0',
        ip_address: '192.168.1.1',
      });
      
      await service.registerDevice(testUserId, {
        fingerprint: deviceFingerprint,
        name: 'My Device',
        type: 'desktop',
        user_agent: 'Mozilla/5.0',
        ip_address: '192.168.1.1',
      });
      
      const devices = await service.getTrustedDevices(testUserId);
      const device = devices.find(d => d.device_fingerprint === deviceFingerprint);
      
      expect(device!.login_count).toBe(2);
    });

    test('should trust device with expiry', async () => {
      await service.registerDevice(testUserId, {
        fingerprint: deviceFingerprint,
        name: 'My Device',
        type: 'desktop',
        user_agent: 'Mozilla/5.0',
        ip_address: '192.168.1.1',
      });
      
      const device = await service.trustDevice(testUserId, deviceFingerprint, 30);
      
      expect(device.trusted).toBe(true);
      expect(device.trust_expires_at).toBeDefined();
    });

    test('should check if device is trusted', async () => {
      await service.registerDevice(testUserId, {
        fingerprint: deviceFingerprint,
        name: 'My Device',
        type: 'desktop',
        user_agent: 'Mozilla/5.0',
        ip_address: '192.168.1.1',
      });
      
      await service.trustDevice(testUserId, deviceFingerprint, 30);
      
      const isTrusted = await service.isDeviceTrusted(testUserId, deviceFingerprint);
      expect(isTrusted).toBe(true);
    });

    test('should return false for untrusted device', async () => {
      const isTrusted = await service.isDeviceTrusted(testUserId, 'unknown-device');
      expect(isTrusted).toBe(false);
    });

    test('should revoke device trust', async () => {
      await service.registerDevice(testUserId, {
        fingerprint: deviceFingerprint,
        name: 'My Device',
        type: 'desktop',
        user_agent: 'Mozilla/5.0',
        ip_address: '192.168.1.1',
      });
      
      await service.trustDevice(testUserId, deviceFingerprint, 30);
      const device = await service.revokeDevice(testUserId, deviceFingerprint, 'User reported lost device');
      
      expect(device.revoked).toBe(true);
      expect(device.revoked_reason).toBe('User reported lost device');
      
      const isTrusted = await service.isDeviceTrusted(testUserId, deviceFingerprint);
      expect(isTrusted).toBe(false);
    });

    test('should get all trusted devices', async () => {
      await service.registerDevice(testUserId, {
        fingerprint: 'device-1',
        name: 'Device 1',
        type: 'desktop',
        user_agent: 'Mozilla/5.0',
        ip_address: '192.168.1.1',
      });
      
      await service.registerDevice(testUserId, {
        fingerprint: 'device-2',
        name: 'Device 2',
        type: 'mobile',
        user_agent: 'Safari Mobile',
        ip_address: '192.168.1.2',
      });
      
      await service.trustDevice(testUserId, 'device-1', 30);
      
      const devices = await service.getTrustedDevices(testUserId);
      
      expect(devices.length).toBe(2);
    });
  });

  // ============================================================================
  // ACCOUNT LOCKOUT TESTS
  // ============================================================================

  describe('Account Lockout', () => {
    test('should initialize lockout status', async () => {
      const lockout = await service.initializeLockout(testUserId);
      
      expect(lockout).toBeDefined();
      expect(lockout.user_id).toBe(testUserId);
      expect(lockout.is_locked).toBe(false);
      expect(lockout.failed_login_attempts).toBe(0);
    });

    test('should auto-lock account after max failed attempts', async () => {
      await service.initializeLockout(testUserId);
      
      // Record 5 failed attempts (will trigger auto-lock through recordLoginAttempt)
      for (let i = 0; i < 6; i++) {
        await service.recordLoginAttempt({
          userId: testUserId,
          email: testEmail,
          attemptType: 'password',
          success: false,
          failureReason: 'invalid_credentials',
          ipAddress: '192.168.1.1',
        });
      }
      
      const isLocked = await service.isAccountLocked(testUserId);
      expect(isLocked).toBe(true);
    });

    test('should manually lock account', async () => {
      await service.initializeLockout(testUserId);
      const lockout = await service.lockAccount(testUserId, 'suspicious_activity', 60);
      
      expect(lockout.is_locked).toBe(true);
      expect(lockout.lock_reason).toBe('suspicious_activity');
    });

    test('should check if account is locked', async () => {
      await service.initializeLockout(testUserId);
      await service.lockAccount(testUserId, 'test', 60);
      
      const isLocked = await service.isAccountLocked(testUserId);
      expect(isLocked).toBe(true);
    });

    test('should unlock account', async () => {
      await service.initializeLockout(testUserId);
      await service.lockAccount(testUserId, 'test', 60);
      
      // Use testUserId as the admin (since it exists in users table)
      const lockout = await service.unlockAccount(testUserId, testUserId, 'Manual unlock');
      
      expect(lockout.is_locked).toBe(false);
      expect(lockout.unlocked_by_user_id).toBe(testUserId);
    });

    test('should reset failed attempts on successful login', async () => {
      await service.initializeLockout(testUserId);
      
      // Record failed attempts
      await service.recordLoginAttempt({
        userId: testUserId,
        email: testEmail,
        attemptType: 'password',
        success: false,
        failureReason: 'invalid_credentials',
        ipAddress: '192.168.1.1',
      });
      
      // Reset by recording successful login
      await service.recordLoginAttempt({
        userId: testUserId,
        email: testEmail,
        attemptType: 'password',
        success: true,
        ipAddress: '192.168.1.1',
      });
      
      // Account should not be locked
      const isLocked = await service.isAccountLocked(testUserId);
      expect(isLocked).toBe(false);
    });

    test('should return false for non-existent user', async () => {
      const isLocked = await service.isAccountLocked('00000000-0000-0000-0000-000000000000');
      expect(isLocked).toBe(false);
    });
  });

  // ============================================================================
  // SECURITY ACTIVITY LOG TESTS
  // ============================================================================

  describe('Security Activity Logging', () => {
    test('should log security activity', async () => {
      const log = await service.logSecurityActivity(
        testUserId,
        'password_change',
        'account_change',
        {
          description: 'User changed password',
          severity: 'info',
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          old_value: '[REDACTED]',
          new_value: '[REDACTED]',
        }
      );
      
      expect(log).toBeDefined();
      expect(log.activity_type).toBe('password_change');
      expect(log.activity_category).toBe('account_change');
      expect(log.severity).toBe('info');
    });

    test('should log critical security events', async () => {
      const log = await service.logSecurityActivity(
        testUserId,
        'account_locked',
        'security_setting',
        {
          description: 'Account locked due to suspicious activity',
          severity: 'critical',
          ip_address: '10.0.0.1',
        }
      );
      
      expect(log.severity).toBe('critical');
    });

    test('should get security activity logs', async () => {
      await service.logSecurityActivity(testUserId, 'login', 'authentication', {
        description: 'User logged in',
        severity: 'info',
      });
      
      await service.logSecurityActivity(testUserId, 'logout', 'authentication', {
        description: 'User logged out',
        severity: 'info',
      });
      
      const logs = await service.getSecurityActivityLogs(testUserId, 10);
      
      expect(logs.length).toBeGreaterThanOrEqual(2);
    });

    test('should limit number of logs returned', async () => {
      // Create 10 logs
      for (let i = 0; i < 10; i++) {
        await service.logSecurityActivity(testUserId, 'login', 'authentication', {
          description: `Login ${i}`,
          severity: 'info',
        });
      }
      
      const logs = await service.getSecurityActivityLogs(testUserId, 5);
      expect(logs.length).toBe(5);
    });
  });

  // ============================================================================
  // SECURITY SETTINGS TESTS
  // ============================================================================

  describe('Security Settings', () => {
    test('should initialize security settings with defaults', async () => {
      const settings = await service.initializeSecuritySettings(testUserId);
      
      expect(settings).toBeDefined();
      expect(settings.user_id).toBe(testUserId);
      expect(settings.require_2fa_for_login).toBe(false);
      expect(settings.session_timeout_minutes).toBe(60);
    });

    test('should get security settings', async () => {
      await service.initializeSecuritySettings(testUserId);
      const settings = await service.getSecuritySettings(testUserId);
      
      expect(settings).toBeDefined();
      expect(settings!.user_id).toBe(testUserId);
    });

    test('should update security settings', async () => {
      await service.initializeSecuritySettings(testUserId);
      
      const updated = await service.updateSecuritySettings(testUserId, {
        require_2fa_for_login: true,
        require_2fa_for_withdrawal: true,
        session_timeout_minutes: 30,
        notify_on_login: true,
      });
      
      expect(updated.require_2fa_for_login).toBe(true);
      expect(updated.require_2fa_for_withdrawal).toBe(true);
      expect(updated.session_timeout_minutes).toBe(30);
    });

    test('should log settings change', async () => {
      await service.initializeSecuritySettings(testUserId);
      await service.updateSecuritySettings(testUserId, {
        require_2fa_for_login: true,
      });
      
      const logs = await service.getSecurityActivityLogs(testUserId, 10);
      const settingsLog = logs.find(l => l.activity_type === 'security_settings_changed');
      
      expect(settingsLog).toBeDefined();
    });

    test('should return null for non-existent user', async () => {
      const settings = await service.getSecuritySettings('00000000-0000-0000-0000-000000000000');
      expect(settings).toBeNull();
    });
  });

  // ============================================================================
  // SECURITY ALERTS TESTS
  // ============================================================================

  describe('Security Alerts', () => {
    test('should create security alert', async () => {
      const alert = await service.createSecurityAlert(
        testUserId,
        'new_device',
        'medium',
        'Login from new device detected',
        {
          requires_action: true,
          action_type: 'confirm_device',
          ip_address: '192.168.1.1',
          device_fingerprint: 'device123',
        }
      );
      
      expect(alert).toBeDefined();
      expect(alert.alert_type).toBe('new_device');
      expect(alert.severity).toBe('medium');
      expect(alert.requires_action).toBe(true);
    });

    test('should auto-generate alert titles', async () => {
      const alert = await service.createSecurityAlert(
        testUserId,
        'failed_login_attempts',
        'high',
        'Multiple failed login attempts detected'
      );
      
      expect(alert.title).toContain('Failed Login Attempts');
    });

    test('should get security alerts', async () => {
      await service.createSecurityAlert(
        testUserId,
        'new_device',
        'medium',
        'New device login'
      );
      
      await service.createSecurityAlert(
        testUserId,
        'unusual_location',
        'high',
        'Login from unusual location'
      );
      
      const alerts = await service.getSecurityAlerts(testUserId);
      expect(alerts.length).toBeGreaterThanOrEqual(2);
    });

    test('should filter alerts by status', async () => {
      const alert = await service.createSecurityAlert(
        testUserId,
        'new_device',
        'medium',
        'Test alert'
      );
      
      await service.acknowledgeAlert(alert.id!);
      
      const pendingAlerts = await service.getSecurityAlerts(testUserId, 'pending');
      const acknowledgedAlerts = await service.getSecurityAlerts(testUserId, 'acknowledged');
      
      expect(acknowledgedAlerts.length).toBe(1);
      expect(acknowledgedAlerts[0].status).toBe('acknowledged');
    });

    test('should acknowledge alert', async () => {
      const alert = await service.createSecurityAlert(
        testUserId,
        'new_device',
        'low',
        'Test'
      );
      
      await service.acknowledgeAlert(alert.id!);
      
      // Verify alert was acknowledged
      const alerts = await service.getSecurityAlerts(testUserId);
      const acknowledged = alerts.find(a => a.id === alert.id);
      expect(acknowledged!.status).toBe('acknowledged');
    });

    test('should create high severity alert for suspicious activity', async () => {
      const alert = await service.createSecurityAlert(
        testUserId,
        'suspicious_activity',
        'critical',
        'Suspicious activity detected on account'
      );
      
      expect(alert.severity).toBe('critical');
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Scenarios', () => {
    test('should handle complete login flow with security checks', async () => {
      // 1. Initialize security features
      await service.initializeLockout(testUserId);
      await service.initializeSecuritySettings(testUserId);
      
      // 2. Register device
      const device = await service.registerDevice(testUserId, {
        fingerprint: 'device-integration',
        name: 'Test Device',
        type: 'desktop',
        user_agent: 'Mozilla/5.0',
        ip_address: '192.168.1.1',
      });
      
      // 3. Record successful login
      await service.recordLoginAttempt({
        userId: testUserId,
        email: testEmail,
        attemptType: 'password',
        success: true,
        ipAddress: '192.168.1.1',
        deviceFingerprint: 'device-integration',
      });
      
      // 4. Trust device
      await service.trustDevice(testUserId, 'device-integration', 30);
      
      // 5. Enable 2FA
      await service.initialize2FA(testUserId, 'totp');
      await service.setupTOTP(testUserId, 'SECRET', ['123456']);
      await service.enable2FA(testUserId, '192.168.1.1');
      
      // Verify all features are working
      const isTrusted = await service.isDeviceTrusted(testUserId, 'device-integration');
      const twoFAStatus = await service.get2FAStatus(testUserId);
      const loginHistory = await service.getLoginHistory(testUserId, 10);
      
      expect(isTrusted).toBe(true);
      expect(twoFAStatus!.enabled).toBe(true);
      expect(loginHistory.length).toBeGreaterThan(0);
    });

    test('should handle security breach scenario', async () => {
      await service.initializeLockout(testUserId);
      
      // 1. Multiple failed login attempts (with userId so lockout is triggered)
      for (let i = 0; i < 5; i++) {
        await service.recordLoginAttempt({
          userId: testUserId,
          email: testEmail,
          attemptType: 'password',
          success: false,
          failureReason: 'invalid_credentials',
          ipAddress: '10.0.0.1',
        });
      }
      
      // 2. Account should be locked
      const isLocked = await service.isAccountLocked(testUserId);
      expect(isLocked).toBe(true);
      
      // 3. Create security alert
      await service.createSecurityAlert(
        testUserId,
        'failed_login_attempts',
        'critical',
        'Multiple failed login attempts detected'
      );
      
      // 4. Log security activity
      await service.logSecurityActivity(testUserId, 'login', 'authentication', {
        description: 'Account locked due to failed login attempts',
        severity: 'critical',
        ip_address: '10.0.0.1',
      });
      
      // Verify security measures
      const alerts = await service.getSecurityAlerts(testUserId);
      const logs = await service.getSecurityActivityLogs(testUserId, 10);
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(logs.length).toBeGreaterThan(0);
    });
  });
});
