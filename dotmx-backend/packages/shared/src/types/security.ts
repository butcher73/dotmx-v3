/**
 * Account Security Types & Interfaces
 * Comprehensive security features including 2FA, device tracking, and activity monitoring
 */

// ============================================================================
// TWO-FACTOR AUTHENTICATION (2FA)
// ============================================================================

export type TwoFactorMethod = 'totp' | 'sms' | 'email' | 'authenticator';

export interface User2FA {
  id: string;
  user_id: string;
  method: TwoFactorMethod;
  enabled: boolean;
  
  // TOTP settings
  totp_secret: string | null;
  totp_backup_codes: string[] | null;
  totp_backup_codes_used: number;
  
  // SMS settings
  phone_number: string | null;
  phone_verified: boolean;
  
  // Configuration
  is_mandatory: boolean;
  grace_period_until: Date | null;
  
  // Usage tracking
  last_used_at: Date | null;
  total_uses: number;
  failed_attempts: number;
  last_failed_at: Date | null;
  
  // Setup
  setup_completed_at: Date | null;
  setup_by_ip: string | null;
  
  created_at: Date;
  updated_at: Date;
}

export interface TwoFactorSetupData {
  method: TwoFactorMethod;
  secret?: string;
  qr_code?: string;
  backup_codes?: string[];
  phone_number?: string;
}

export interface TwoFactorVerificationData {
  code: string;
  backup_code?: boolean;
}

// ============================================================================
// LOGIN ATTEMPTS & TRACKING
// ============================================================================

export type LoginAttemptType = 'password' | 'wallet' | '2fa' | 'api_key';

export interface LoginAttempt {
  id: string;
  user_id: string | null;
  
  // Attempt details
  email: string | null;
  username: string | null;
  attempt_type: LoginAttemptType;
  
  // Result
  success: boolean;
  failure_reason: string | null;
  
  // Location & Device
  ip_address: string;
  user_agent: string | null;
  device_fingerprint: string | null;
  country_code: string | null;
  city: string | null;
  
  // Security context
  is_suspicious: boolean;
  risk_score: number;
  blocked_by_rule: string | null;
  
  created_at: Date;
}

export interface LoginAttemptSummary {
  total_attempts: number;
  failed_attempts: number;
  success_rate: number;
  suspicious_attempts: number;
  last_attempt_at: Date;
  unique_ips: number;
  unique_devices: number;
}

// ============================================================================
// TRUSTED DEVICES
// ============================================================================

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface TrustedDevice {
  id: string;
  user_id: string;
  
  // Device identification
  device_fingerprint: string;
  device_name: string | null;
  device_type: DeviceType;
  
  // Device details
  browser: string | null;
  os: string | null;
  user_agent: string | null;
  
  // Trust status
  trusted: boolean;
  trust_expires_at: Date | null;
  
  // Location
  first_ip: string | null;
  last_ip: string | null;
  country_code: string | null;
  city: string | null;
  
  // Activity
  first_seen_at: Date;
  last_seen_at: Date;
  login_count: number;
  
  // Revocation
  revoked: boolean;
  revoked_at: Date | null;
  revoked_reason: string | null;
  
  created_at: Date;
  updated_at: Date;
}

export interface DeviceInfo {
  fingerprint: string;
  name?: string;
  type: DeviceType;
  browser?: string;
  os?: string;
  user_agent: string;
  ip_address: string;
}

// ============================================================================
// IP ACCESS CONTROL
// ============================================================================

export type IPAccessType = 'whitelist' | 'blacklist';
export type IPAccessScope = 'user' | 'global';

export interface IPAccessControl {
  id: string;
  user_id: string | null;
  
  // IP or CIDR range
  ip_address: string;
  ip_range_cidr: string | null;
  
  // Access control
  access_type: IPAccessType;
  scope: IPAccessScope;
  
  // Details
  reason: string | null;
  added_by_user_id: string | null;
  
  // Effectiveness
  enabled: boolean;
  expires_at: Date | null;
  
  // Statistics
  hit_count: number;
  last_hit_at: Date | null;
  
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// ACCOUNT LOCKOUT
// ============================================================================

export interface AccountLockout {
  id: string;
  user_id: string;
  
  // Lockout status
  is_locked: boolean;
  locked_at: Date | null;
  locked_until: Date | null;
  lock_reason: string | null;
  
  // Failed attempts tracking
  failed_login_attempts: number;
  failed_2fa_attempts: number;
  last_failed_attempt_at: Date | null;
  
  // Auto-unlock
  auto_unlock_enabled: boolean;
  unlock_after_minutes: number;
  
  // Manual unlock
  unlocked_by_user_id: string | null;
  unlocked_at: Date | null;
  unlock_reason: string | null;
  
  // Lockout history count
  total_lockouts: number;
  
  created_at: Date;
  updated_at: Date;
}

export interface LockoutSettings {
  max_login_attempts: number;
  max_2fa_attempts: number;
  lockout_duration_minutes: number;
  auto_unlock_enabled: boolean;
}

// ============================================================================
// SECURITY ACTIVITY LOGS
// ============================================================================

export type SecurityActivityType =
  | 'login'
  | 'logout'
  | 'password_change'
  | '2fa_enabled'
  | '2fa_disabled'
  | 'email_change'
  | 'withdrawal'
  | 'api_key_created'
  | 'api_key_deleted'
  | 'device_trusted'
  | 'device_revoked'
  | 'ip_whitelisted'
  | 'ip_blacklisted'
  | 'security_settings_changed'
  | 'session_terminated';

export type SecurityActivityCategory =
  | 'authentication'
  | 'account_change'
  | 'security_setting'
  | 'financial'
  | 'access_control';

export type SecuritySeverity = 'info' | 'warning' | 'critical';

export interface SecurityActivityLog {
  id: string;
  user_id: string;
  
  // Activity type
  activity_type: SecurityActivityType;
  activity_category: SecurityActivityCategory;
  
  // Activity details
  description: string | null;
  severity: SecuritySeverity;
  
  // Context
  ip_address: string | null;
  user_agent: string | null;
  device_fingerprint: string | null;
  country_code: string | null;
  city: string | null;
  
  // Changes (for audit)
  old_value: string | null;
  new_value: string | null;
  
  // Risk assessment
  risk_score: number;
  is_anomaly: boolean;
  
  // Notification
  user_notified: boolean;
  notification_sent_at: Date | null;
  
  // Additional data
  metadata: Record<string, any>;
  
  created_at: Date;
}

export interface SecurityActivitySummary {
  total_activities: number;
  by_type: Record<SecurityActivityType, number>;
  by_category: Record<SecurityActivityCategory, number>;
  by_severity: Record<SecuritySeverity, number>;
  anomalies: number;
  critical_events: number;
  last_activity: Date;
}

// ============================================================================
// PASSWORD SECURITY
// ============================================================================

export interface PasswordHistory {
  id: string;
  user_id: string;
  password_hash: string;
  
  // Context
  changed_from_ip: string | null;
  changed_by_admin_id: string | null;
  change_reason: string | null;
  
  // Password strength at time of change
  strength_score: number | null;
  had_uppercase: boolean | null;
  had_lowercase: boolean | null;
  had_numbers: boolean | null;
  had_special_chars: boolean | null;
  length: number | null;
  
  created_at: Date;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  token_hash: string;
  
  // Validity
  expires_at: Date;
  used: boolean;
  used_at: Date | null;
  
  // Request context
  request_ip: string | null;
  request_user_agent: string | null;
  
  // Usage context
  used_ip: string | null;
  used_user_agent: string | null;
  
  // Security
  attempt_count: number;
  max_attempts: number;
  
  created_at: Date;
}

export interface PasswordStrength {
  score: number; // 0-100
  has_uppercase: boolean;
  has_lowercase: boolean;
  has_numbers: boolean;
  has_special_chars: boolean;
  length: number;
  is_common: boolean;
  feedback: string[];
}

// ============================================================================
// SECURITY SETTINGS
// ============================================================================

export interface UserSecuritySettings {
  id: string;
  user_id: string;
  
  // 2FA Settings
  require_2fa_for_login: boolean;
  require_2fa_for_withdrawal: boolean;
  require_2fa_for_api_key: boolean;
  require_2fa_for_settings_change: boolean;
  
  // Session Settings
  session_timeout_minutes: number;
  remember_device_days: number;
  max_concurrent_sessions: number;
  
  // Login Security
  allow_password_login: boolean;
  allow_wallet_login: boolean;
  restrict_to_whitelisted_ips: boolean;
  
  // Notification Preferences
  notify_on_login: boolean;
  notify_on_new_device: boolean;
  notify_on_withdrawal: boolean;
  notify_on_api_key_usage: boolean;
  notify_on_password_change: boolean;
  notify_on_suspicious_activity: boolean;
  
  // Email notifications
  notification_email: string | null;
  
  // Advanced Security
  require_device_confirmation: boolean;
  auto_logout_on_ip_change: boolean;
  
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// ACTIVE SESSIONS
// ============================================================================

export interface ActiveSession {
  id: string;
  user_id: string;
  
  // Session identification
  session_token: string;
  refresh_token: string | null;
  device_fingerprint: string | null;
  
  // Device details
  device_type: string | null;
  browser: string | null;
  os: string | null;
  user_agent: string | null;
  
  // Location
  ip_address: string;
  country_code: string | null;
  city: string | null;
  
  // Session state
  is_active: boolean;
  last_activity_at: Date;
  
  // Security
  is_trusted_device: boolean;
  risk_score: number;
  
  // Expiry
  expires_at: Date;
  
  // Termination
  terminated_at: Date | null;
  termination_reason: string | null;
  
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// SECURITY ALERTS
// ============================================================================

export type SecurityAlertType =
  | 'new_device'
  | 'unusual_location'
  | 'failed_login_attempts'
  | 'withdrawal_attempt'
  | 'api_key_usage'
  | 'password_change'
  | 'account_locked'
  | 'suspicious_activity';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'pending' | 'acknowledged' | 'resolved' | 'dismissed';

export interface SecurityAlert {
  id: string;
  user_id: string;
  
  // Alert details
  alert_type: SecurityAlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  
  // Context
  trigger_event_id: string | null;
  ip_address: string | null;
  device_fingerprint: string | null;
  
  // Status
  status: AlertStatus;
  acknowledged_at: Date | null;
  resolved_at: Date | null;
  
  // Action required
  requires_action: boolean;
  action_type: string | null;
  action_url: string | null;
  action_taken: boolean;
  action_taken_at: Date | null;
  
  // Notification
  notification_sent: boolean;
  notification_channels: string[] | null;
  notification_sent_at: Date | null;
  
  // Metadata
  metadata: Record<string, any>;
  
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// SECURITY CONFIGURATIONS
// ============================================================================

export interface SecurityConfig {
  // Rate limiting
  max_login_attempts_per_hour: number;
  max_failed_login_attempts: number;
  lockout_duration_minutes: number;
  
  // Session settings
  session_timeout_minutes: number;
  max_concurrent_sessions: number;
  
  // 2FA
  enforce_2fa_for_vip: boolean;
  enforce_2fa_for_high_value: boolean;
  
  // Password policy
  min_password_length: number;
  require_uppercase: boolean;
  require_lowercase: boolean;
  require_numbers: boolean;
  require_special_chars: boolean;
  password_expiry_days: number;
  prevent_password_reuse_count: number;
  
  // Device management
  remember_device_days: number;
  max_trusted_devices: number;
  
  // Risk thresholds
  suspicious_activity_threshold: number;
  high_risk_threshold: number;
}

// Default security configuration
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function calculatePasswordStrength(password: string): PasswordStrength {
  const length = password.length;
  const has_uppercase = /[A-Z]/.test(password);
  const has_lowercase = /[a-z]/.test(password);
  const has_numbers = /[0-9]/.test(password);
  const has_special_chars = /[^A-Za-z0-9]/.test(password);
  
  // Common weak passwords
  const common_passwords = ['password', '123456', 'qwerty', 'admin', 'letmein'];
  const is_common = common_passwords.includes(password.toLowerCase());
  
  // Calculate score
  let score = 0;
  if (length >= 8) score += 20;
  if (length >= 12) score += 20;
  if (length >= 16) score += 10;
  if (has_uppercase) score += 15;
  if (has_lowercase) score += 15;
  if (has_numbers) score += 15;
  if (has_special_chars) score += 20;
  if (is_common) score -= 50;
  
  score = Math.max(0, Math.min(100, score));
  
  const feedback: string[] = [];
  if (length < 12) feedback.push('Use at least 12 characters');
  if (!has_uppercase) feedback.push('Add uppercase letters');
  if (!has_lowercase) feedback.push('Add lowercase letters');
  if (!has_numbers) feedback.push('Add numbers');
  if (!has_special_chars) feedback.push('Add special characters');
  if (is_common) feedback.push('Avoid common passwords');
  
  return {
    score,
    has_uppercase,
    has_lowercase,
    has_numbers,
    has_special_chars,
    length,
    is_common,
    feedback,
  };
}

export function isPasswordStrong(password: string): boolean {
  const strength = calculatePasswordStrength(password);
  return strength.score >= 80;
}

export function calculateRiskScore(context: {
  failed_attempts: number;
  is_new_device: boolean;
  is_new_location: boolean;
  is_vpn: boolean;
  time_since_last_login_hours: number;
}): number {
  let score = 0;
  
  // Failed attempts (max 30 points)
  score += Math.min(30, context.failed_attempts * 5);
  
  // New device (20 points)
  if (context.is_new_device) score += 20;
  
  // New location (15 points)
  if (context.is_new_location) score += 15;
  
  // VPN usage (10 points)
  if (context.is_vpn) score += 10;
  
  // Time since last login (max 25 points)
  if (context.time_since_last_login_hours > 720) { // 30 days
    score += 25;
  } else if (context.time_since_last_login_hours > 168) { // 7 days
    score += 15;
  } else if (context.time_since_last_login_hours > 24) { // 1 day
    score += 5;
  }
  
  return Math.min(100, score);
}

export function getSecurityRecommendations(
  user2fa: User2FA | null,
  settings: UserSecuritySettings,
  lockout: AccountLockout | null
): string[] {
  const recommendations: string[] = [];
  
  if (!user2fa || !user2fa.enabled) {
    recommendations.push('Enable two-factor authentication for enhanced security');
  }
  
  if (!settings.require_2fa_for_withdrawal) {
    recommendations.push('Require 2FA for withdrawals to protect your funds');
  }
  
  if (settings.session_timeout_minutes > 120) {
    recommendations.push('Reduce session timeout to 60 minutes or less');
  }
  
  if (!settings.notify_on_login) {
    recommendations.push('Enable login notifications to monitor account access');
  }
  
  if (lockout && lockout.failed_login_attempts > 0) {
    recommendations.push('Review recent failed login attempts for suspicious activity');
  }
  
  if (!settings.restrict_to_whitelisted_ips && settings.max_concurrent_sessions > 5) {
    recommendations.push('Consider restricting logins to whitelisted IPs for maximum security');
  }
  
  return recommendations;
}
