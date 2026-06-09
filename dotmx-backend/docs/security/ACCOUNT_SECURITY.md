# Account Security System

Comprehensive security system with 2FA, device tracking, account lockout, and activity monitoring for the DotMX trading platform.

---

## Overview

The account security system provides enterprise-grade protection with:

- **Two-Factor Authentication (2FA)** - TOTP, SMS, Email, Authenticator apps
- **Login Attempt Tracking** - Monitor and block suspicious login attempts
- **Trusted Device Management** - Remember and trust user devices
- **IP Access Control** - Whitelist/blacklist IPs with CIDR support
- **Account Lockout** - Auto-lock after failed attempts
- **Security Activity Logs** - Complete audit trail of all security events
- **Password Security** - Strength validation, history tracking, secure reset
- **Security Alerts** - Real-time notifications for suspicious activity
- **Risk Scoring** - Calculate risk scores (0-100) for login attempts
- **Session Management** - Track active sessions across devices

---

## Database Tables

### 1. `user_2fa` - Two-Factor Authentication
Manages 2FA settings and backup codes for users.

**Key Fields:**
- `method`: totp | sms | email | authenticator
- `enabled`: Whether 2FA is active
- `totp_secret`: Encrypted TOTP secret
- `totp_backup_codes`: Array of hashed backup codes
- `phone_number`: For SMS 2FA
- `is_mandatory`: Force 2FA for this account
- `failed_attempts`: Track 2FA failures

### 2. `login_attempts` - Login Tracking
Records every login attempt with risk assessment.

**Key Fields:**
- `attempt_type`: password | wallet | 2fa | api_key
- `success`: Whether attempt succeeded
- `failure_reason`: Why it failed
- `ip_address`, `user_agent`, `device_fingerprint`
- `is_suspicious`: Flagged as suspicious
- `risk_score`: 0-100 calculated risk
- `blocked_by_rule`: Which security rule blocked it

### 3. `trusted_devices` - Device Management
Tracks and manages trusted devices.

**Key Fields:**
- `device_fingerprint`: Unique device ID
- `device_name`: User-friendly name
- `device_type`: desktop | mobile | tablet
- `trusted`: Whether device is trusted
- `trust_expires_at`: When trust expires
- `login_count`: Number of logins from this device
- `revoked`: Device trust revoked

### 4. `ip_access_control` - IP Whitelist/Blacklist
Manage IP-based access control.

**Key Fields:**
- `ip_address`: Single IP or CIDR range
- `access_type`: whitelist | blacklist
- `scope`: user | global
- `enabled`: Whether rule is active
- `expires_at`: Temporary rules
- `hit_count`: Number of times rule was triggered

### 5. `account_lockout` - Account Protection
Tracks failed attempts and manages account locks.

**Key Fields:**
- `is_locked`: Account lockout status
- `locked_until`: Auto-unlock timestamp
- `lock_reason`: Why account was locked
- `failed_login_attempts`: Login failure count
- `failed_2fa_attempts`: 2FA failure count
- `auto_unlock_enabled`: Allow auto-unlock
- `unlock_after_minutes`: Duration of lockout

### 6. `security_activity_logs` - Audit Trail
Complete log of all security-related activities.

**Key Fields:**
- `activity_type`: login | logout | password_change | 2fa_enabled, etc.
- `activity_category`: authentication | account_change | security_setting | financial
- `severity`: info | warning | critical
- `risk_score`: 0-100
- `is_anomaly`: Flagged as unusual
- `old_value`, `new_value`: Track changes

### 7. `password_history` - Password Tracking
Prevents password reuse and tracks changes.

**Key Fields:**
- `password_hash`: Historical hash
- `change_reason`: user_requested | expired | compromised | admin_forced
- `strength_score`: 0-100 at time of change
- `had_uppercase`, `had_lowercase`, `had_numbers`, `had_special_chars`

### 8. `password_reset_tokens` - Secure Password Reset
Manage password reset tokens with security.

**Key Fields:**
- `token`: Plain token (sent to user)
- `token_hash`: Hashed for storage
- `expires_at`: Token validity
- `used`: Whether token was used
- `attempt_count`: Failed verification attempts
- `max_attempts`: Maximum attempts allowed

### 9. `user_security_settings` - User Preferences
Per-user security configuration.

**Key Fields:**
- `require_2fa_for_login`: Force 2FA on login
- `require_2fa_for_withdrawal`: Require 2FA for withdrawals
- `session_timeout_minutes`: Session expiry
- `remember_device_days`: Device trust duration
- `max_concurrent_sessions`: Session limit
- `notify_on_login`: Email notifications
- `restrict_to_whitelisted_ips`: IP restriction

### 10. `active_sessions` - Session Tracking
Monitor active user sessions across devices.

**Key Fields:**
- `session_token`, `refresh_token`
- `device_fingerprint`
- `is_active`: Session state
- `last_activity_at`: Last action timestamp
- `is_trusted_device`: Device trust status
- `risk_score`: Session risk
- `termination_reason`: Why session ended

### 11. `security_alerts` - User Notifications
Alert users to security events.

**Key Fields:**
- `alert_type`: new_device | unusual_location | failed_login_attempts, etc.
- `severity`: low | medium | high | critical
- `status`: pending | acknowledged | resolved | dismissed
- `requires_action`: User must take action
- `action_type`: confirm_device | reset_password | contact_support
- `notification_sent`: Whether notification was sent

---

## TypeScript Interfaces

### Core Security Types

```typescript
// 2FA
interface User2FA {
  user_id: string;
  method: 'totp' | 'sms' | 'email' | 'authenticator';
  enabled: boolean;
  totp_secret: string | null;
  totp_backup_codes: string[] | null;
  phone_number: string | null;
  is_mandatory: boolean;
  failed_attempts: number;
}

// Login Attempt
interface LoginAttempt {
  user_id: string | null;
  email: string | null;
  attempt_type: 'password' | 'wallet' | '2fa' | 'api_key';
  success: boolean;
  failure_reason: string | null;
  ip_address: string;
  device_fingerprint: string | null;
  is_suspicious: boolean;
  risk_score: number; // 0-100
}

// Trusted Device
interface TrustedDevice {
  user_id: string;
  device_fingerprint: string;
  device_name: string | null;
  device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  trusted: boolean;
  trust_expires_at: Date | null;
  login_count: number;
  revoked: boolean;
}

// Account Lockout
interface AccountLockout {
  user_id: string;
  is_locked: boolean;
  locked_until: Date | null;
  lock_reason: string | null;
  failed_login_attempts: number;
  failed_2fa_attempts: number;
  auto_unlock_enabled: boolean;
}

// Security Settings
interface UserSecuritySettings {
  user_id: string;
  require_2fa_for_login: boolean;
  require_2fa_for_withdrawal: boolean;
  session_timeout_minutes: number;
  remember_device_days: number;
  max_concurrent_sessions: number;
  notify_on_login: boolean;
  notify_on_new_device: boolean;
  restrict_to_whitelisted_ips: boolean;
}
```

---

## Service Methods

### AccountSecurityService

#### Two-Factor Authentication

```typescript
// Initialize 2FA
await securityService.initialize2FA(userId, 'totp');

// Setup TOTP (Google Authenticator)
await securityService.setupTOTP(userId, secret, backupCodes);

// Enable 2FA after verification
await securityService.enable2FA(userId, ipAddress);

// Disable 2FA
await securityService.disable2FA(userId, reason);

// Verify 2FA code
const isValid = await securityService.verify2FACode(userId, code, isBackupCode);

// Get 2FA status
const status = await securityService.get2FAStatus(userId);
```

#### Login Attempt Tracking

```typescript
// Record login attempt
await securityService.recordLoginAttempt({
  userId: 'uuid',
  email: 'user@example.com',
  attemptType: 'password',
  success: false,
  failureReason: 'invalid_credentials',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  deviceFingerprint: 'fingerprint123',
});

// Get login history
const history = await securityService.getLoginHistory(userId, 50);
```

#### Trusted Device Management

```typescript
// Register device
await securityService.registerDevice(userId, {
  fingerprint: 'device123',
  name: 'My iPhone',
  type: 'mobile',
  browser: 'Safari',
  os: 'iOS',
  user_agent: 'Mozilla/5.0...',
  ip_address: '192.168.1.1',
});

// Trust a device
await securityService.trustDevice(userId, deviceFingerprint, 30); // 30 days

// Revoke device
await securityService.revokeDevice(userId, deviceFingerprint, 'User reported lost');

// Check if device is trusted
const isTrusted = await securityService.isDeviceTrusted(userId, deviceFingerprint);

// Get all trusted devices
const devices = await securityService.getTrustedDevices(userId);
```

#### Account Lockout

```typescript
// Check if account is locked
const isLocked = await securityService.isAccountLocked(userId);

// Lock account manually
await securityService.lockAccount(userId, 'suspicious_activity', 60); // 60 minutes

// Unlock account
await securityService.unlockAccount(userId, adminId, 'Verified with user');

// Reset failed attempts (on successful login)
await securityService.resetFailedAttempts(userId);
```

#### Security Activity Logging

```typescript
// Log security activity
await securityService.logSecurityActivity(userId, 'password_change', 'account_change', {
  description: 'User changed password',
  severity: 'info',
  ip_address: '192.168.1.1',
  old_value: '[REDACTED]',
  new_value: '[REDACTED]',
});

// Get activity logs
const logs = await securityService.getSecurityActivityLogs(userId, 100);
```

#### Security Settings

```typescript
// Initialize security settings (default values)
await securityService.initializeSecuritySettings(userId);

// Get settings
const settings = await securityService.getSecuritySettings(userId);

// Update settings
await securityService.updateSecuritySettings(userId, {
  require_2fa_for_login: true,
  require_2fa_for_withdrawal: true,
  session_timeout_minutes: 30,
  notify_on_login: true,
});
```

#### Security Alerts

```typescript
// Create alert
await securityService.createSecurityAlert(
  userId,
  'new_device',
  'medium',
  'New device login detected from unknown location',
  {
    requires_action: true,
    action_type: 'confirm_device',
    ip_address: '192.168.1.1',
  }
);

// Get alerts
const alerts = await securityService.getSecurityAlerts(userId);

// Acknowledge alert
await securityService.acknowledgeAlert(alertId);
```

---

## Helper Functions

### Password Strength Calculation

```typescript
import { calculatePasswordStrength, isPasswordStrong } from '../types/security';

const strength = calculatePasswordStrength('MyP@ssw0rd123!');
// Returns:
// {
//   score: 85,
//   has_uppercase: true,
//   has_lowercase: true,
//   has_numbers: true,
//   has_special_chars: true,
//   length: 14,
//   is_common: false,
//   feedback: []
// }

const isStrong = isPasswordStrong('MyP@ssw0rd123!'); // true
```

### Risk Score Calculation

```typescript
import { calculateRiskScore } from '../types/security';

const riskScore = calculateRiskScore({
  failed_attempts: 3,
  is_new_device: true,
  is_new_location: true,
  is_vpn: false,
  time_since_last_login_hours: 720, // 30 days
});
// Returns: 75 (high risk)
```

### Security Recommendations

```typescript
import { getSecurityRecommendations } from '../types/security';

const recommendations = getSecurityRecommendations(user2fa, settings, lockout);
// Returns: ['Enable two-factor authentication', 'Reduce session timeout', ...]
```

---

## Security Configuration

### Default Settings

```typescript
export const DEFAULT_SECURITY_CONFIG = {
  max_login_attempts_per_hour: 10,
  max_failed_login_attempts: 5,
  lockout_duration_minutes: 30,
  session_timeout_minutes: 60,
  max_concurrent_sessions: 5,
  enforce_2fa_for_vip: true,
  enforce_2fa_for_high_value: true,
  min_password_length: 12,
  require_uppercase: true,
  require_lowercase: true,
  require_numbers: true,
  require_special_chars: true,
  password_expiry_days: 90,
  prevent_password_reuse_count: 5,
  remember_device_days: 30,
  max_trusted_devices: 10,
  suspicious_activity_threshold: 50,
  high_risk_threshold: 75,
};
```

---

## Integration Examples

### Login Flow with Security Checks

```typescript
async function secureLogin(email: string, password: string, deviceInfo: DeviceInfo) {
  // 1. Check if account is locked
  const user = await getUserByEmail(email);
  const isLocked = await securityService.isAccountLocked(user.id);
  
  if (isLocked) {
    throw new Error('Account is locked due to suspicious activity');
  }

  // 2. Verify credentials
  const isValid = await verifyPassword(password, user.password_hash);
  
  if (!isValid) {
    // Record failed attempt
    await securityService.recordLoginAttempt({
      userId: user.id,
      email,
      attemptType: 'password',
      success: false,
      failureReason: 'invalid_credentials',
      ipAddress: deviceInfo.ip_address,
      userAgent: deviceInfo.user_agent,
      deviceFingerprint: deviceInfo.fingerprint,
    });
    
    throw new Error('Invalid credentials');
  }

  // 3. Check if 2FA is required
  const user2fa = await securityService.get2FAStatus(user.id);
  if (user2fa?.enabled) {
    // Require 2FA verification (return pending state)
    return { requiresF: true, userId: user.id };
  }

  // 4. Check if device is trusted
  const isTrusted = await securityService.isDeviceTrusted(user.id, deviceInfo.fingerprint);
  
  if (!isTrusted) {
    // Register device
    await securityService.registerDevice(user.id, deviceInfo);
    
    // Create security alert
    await securityService.createSecurityAlert(
      user.id,
      'new_device',
      'medium',
      'Login from new device detected',
      { requires_action: true, action_type: 'confirm_device' }
    );
  }

  // 5. Record successful login
  await securityService.recordLoginAttempt({
    userId: user.id,
    email,
    attemptType: 'password',
    success: true,
    ipAddress: deviceInfo.ip_address,
    userAgent: deviceInfo.user_agent,
    deviceFingerprint: deviceInfo.fingerprint,
  });

  // 6. Reset failed attempts
  await securityService.resetFailedAttempts(user.id);

  // 7. Log security activity
  await securityService.logSecurityActivity(user.id, 'login', 'authentication', {
    description: 'User logged in successfully',
    severity: 'info',
    ip_address: deviceInfo.ip_address,
  });

  // 8. Create session
  const session = await createSession(user.id, deviceInfo);
  
  return { success: true, session };
}
```

### 2FA Setup Flow

```typescript
async function setup2FA(userId: string) {
  // 1. Initialize 2FA
  await securityService.initialize2FA(userId, 'totp');

  // 2. Generate TOTP secret
  const secret = generateTOTPSecret(); // Use library like 'otpauth'
  const qrCode = generateQRCode(secret);
  const backupCodes = generateBackupCodes(10);

  // 3. Save to database
  await securityService.setupTOTP(userId, secret, backupCodes);

  // 4. Return setup data to user
  return {
    secret,
    qr_code: qrCode,
    backup_codes: backupCodes, // Show once, then never again
  };
}

async function verify2FASetup(userId: string, code: string, ipAddress: string) {
  // 1. Verify the code
  const isValid = await securityService.verify2FACode(userId, code);
  
  if (!isValid) {
    throw new Error('Invalid 2FA code');
  }

  // 2. Enable 2FA
  await securityService.enable2FA(userId, ipAddress);

  // 3. Create security alert
  await securityService.createSecurityAlert(
    userId,
    'password_change', // Reuse for security setting
    'info',
    'Two-factor authentication has been enabled'
  );

  return { success: true };
}
```

---

## Best Practices

### 1. Password Security
- ✅ Minimum 12 characters
- ✅ Require uppercase, lowercase, numbers, special characters
- ✅ Check against common password lists
- ✅ Prevent reuse of last 5 passwords
- ✅ Force password change every 90 days
- ✅ Hash with bcrypt (cost factor 12+)

### 2. Session Management
- ✅ Rotate session tokens on privilege escalation
- ✅ Implement sliding session expiration
- ✅ Limit concurrent sessions per user
- ✅ Terminate sessions on password change
- ✅ Store session tokens hashed in database

### 3. 2FA Implementation
- ✅ Offer multiple 2FA methods
- ✅ Provide backup codes for recovery
- ✅ Rate-limit 2FA verification attempts
- ✅ Mandatory for VIP/high-value accounts
- ✅ Mandatory for withdrawals over threshold

### 4. Device Trust
- ✅ Expire device trust after 30 days
- ✅ Allow users to revoke devices
- ✅ Limit number of trusted devices
- ✅ Notify on new device login
- ✅ Require 2FA from untrusted devices

### 5. Account Lockout
- ✅ Lock after 5 failed login attempts
- ✅ Auto-unlock after 30 minutes
- ✅ Manual unlock for critical accounts
- ✅ Track lockout patterns for abuse
- ✅ Alert on repeated lockouts

### 6. Activity Monitoring
- ✅ Log all security-relevant events
- ✅ Calculate risk scores for anomalies
- ✅ Alert on high-risk activities
- ✅ Retain logs for 1 year minimum
- ✅ Regular security audit reviews

### 7. IP Security
- ✅ Support CIDR ranges for whitelisting
- ✅ Temporary blacklist for brute force
- ✅ Allow user-specific IP restrictions
- ✅ Global blacklist for known bad actors
- ✅ Expire temporary rules automatically

---

## Security Metrics to Monitor

### Real-time Metrics
- Failed login attempts (last hour)
- Account lockouts (last 24 hours)
- New device logins
- High-risk login attempts
- 2FA bypass attempts
- Suspicious IP activity

### Historical Metrics
- Average risk score trend
- 2FA adoption rate
- Password strength distribution
- Most common failure reasons
- Geographic login distribution
- Device type distribution

### Alerts to Configure
- 🚨 Critical: 10+ failed logins in 1 hour
- ⚠️ Warning: 5 failed logins in 10 minutes
- ℹ️ Info: Login from new country
- 🚨 Critical: Account lockout triggered
- ⚠️ Warning: 2FA disabled by user
- 🚨 Critical: Withdrawal from new device

---

## Testing Checklist

### 2FA Tests
- [ ] Setup TOTP successfully
- [ ] Verify TOTP code
- [ ] Use backup code
- [ ] Exhaust backup codes
- [ ] Disable 2FA
- [ ] Block after failed 2FA attempts

### Login Tests
- [ ] Successful login
- [ ] Failed login (wrong password)
- [ ] Login from new device
- [ ] Login from new location
- [ ] Login during account lock
- [ ] Login with 2FA required

### Device Tests
- [ ] Register new device
- [ ] Trust device
- [ ] Revoke device trust
- [ ] Login from trusted device
- [ ] Login from revoked device
- [ ] Expire device trust

### Lockout Tests
- [ ] Lock after 5 failed attempts
- [ ] Auto-unlock after timeout
- [ ] Manual unlock by admin
- [ ] Reset attempts on success
- [ ] Lock for suspicious activity

### Security Logging Tests
- [ ] Log password change
- [ ] Log 2FA enable/disable
- [ ] Log device trust
- [ ] Log high-risk login
- [ ] Query logs by user
- [ ] Query logs by time range

---

## Production Deployment

### Prerequisites
1. Database migrations applied
2. Environment variables configured
3. TOTP library installed (`otpauth`, `speakeasy`)
4. Email/SMS service configured
5. Monitoring and alerting setup

### Environment Variables
```bash
# Security Settings
SECURITY_MAX_LOGIN_ATTEMPTS=5
SECURITY_LOCKOUT_DURATION_MINUTES=30
SECURITY_SESSION_TIMEOUT_MINUTES=60
SECURITY_2FA_REQUIRED_FOR_VIP=true
SECURITY_2FA_REQUIRED_FOR_WITHDRAWAL=true

# Password Policy
PASSWORD_MIN_LENGTH=12
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SPECIAL_CHARS=true
PASSWORD_EXPIRY_DAYS=90
PASSWORD_REUSE_PREVENTION_COUNT=5

# Device Trust
DEVICE_TRUST_DAYS=30
MAX_TRUSTED_DEVICES=10

# Risk Thresholds
SUSPICIOUS_ACTIVITY_THRESHOLD=50
HIGH_RISK_THRESHOLD=75
```

### Post-Deployment
1. ✅ Initialize security settings for existing users
2. ✅ Send email notification about new security features
3. ✅ Monitor error rates for security service
4. ✅ Set up alerts for critical security events
5. ✅ Review security logs for anomalies
6. ✅ Test 2FA enrollment flow
7. ✅ Test account lockout and recovery
8. ✅ Verify device trust expiry cron job

---

**Last Updated**: January 20, 2026  
**Version**: 1.0.0  
**Status**: Production Ready ✅
