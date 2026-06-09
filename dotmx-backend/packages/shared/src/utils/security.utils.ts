/**
 * Security Utilities
 * Helper functions for TOTP, backup codes, and security operations
 */

import { TOTP, Secret } from 'otpauth';
import crypto from 'crypto';

/**
 * Generate a new TOTP secret
 */
export function generateTOTPSecret(issuer: string = 'DotMX', accountName?: string): {
  secret: string;
  uri: string;
  qrCodeUrl: string;
} {
  // Generate a random secret
  const secret = new Secret();
  
  // Create TOTP instance
  const totp = new TOTP({
    issuer,
    label: accountName || 'User',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });
  
  // Generate URI for QR code
  const uri = totp.toString();
  
  // Generate QR code URL (using Google Charts API as fallback)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`;
  
  return {
    secret: secret.base32,
    uri,
    qrCodeUrl,
  };
}

/**
 * Verify a TOTP code against a secret
 */
export function verifyTOTPCode(secret: string, token: string, window: number = 1): boolean {
  try {
    const totp = new TOTP({
      secret: Secret.fromBase32(secret),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });
    
    // Validate with window to account for clock drift
    const delta = totp.validate({ token, window });
    return delta !== null;
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
}

/**
 * Generate backup codes for 2FA
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  
  return codes;
}

/**
 * Hash backup codes for secure storage
 */
export function hashBackupCodes(codes: string[]): string[] {
  return codes.map(code => {
    return crypto.createHash('sha256').update(code).digest('hex');
  });
}

/**
 * Verify a backup code against hashed codes
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): boolean {
  const hashedInput = crypto.createHash('sha256').update(code).digest('hex');
  return hashedCodes.includes(hashedInput);
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate device fingerprint from request data
 */
export function generateDeviceFingerprint(data: {
  userAgent?: string;
  ip?: string;
  acceptLanguage?: string;
  acceptEncoding?: string;
}): string {
  const components = [
    data.userAgent || '',
    data.ip || '',
    data.acceptLanguage || '',
    data.acceptEncoding || '',
  ];
  
  const fingerprint = components.join('|');
  return crypto.createHash('sha256').update(fingerprint).digest('hex');
}

/**
 * Parse User-Agent string to extract device info
 */
export function parseUserAgent(userAgent: string): {
  browser: string;
  os: string;
  device: string;
} {
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'desktop';
  
  // Detect browser
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  else if (userAgent.includes('Opera')) browser = 'Opera';
  
  // Detect OS
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac OS')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
  
  // Detect device type
  if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
    device = 'mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    device = 'tablet';
  }
  
  return { browser, os, device };
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0;
  
  // Length check
  if (password.length < 12) {
    issues.push('Password must be at least 12 characters long');
  } else {
    score += Math.min(password.length * 2, 40);
  }
  
  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    issues.push('Password must contain at least one uppercase letter');
  } else {
    score += 10;
  }
  
  // Lowercase check
  if (!/[a-z]/.test(password)) {
    issues.push('Password must contain at least one lowercase letter');
  } else {
    score += 10;
  }
  
  // Number check
  if (!/[0-9]/.test(password)) {
    issues.push('Password must contain at least one number');
  } else {
    score += 10;
  }
  
  // Special character check
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    issues.push('Password must contain at least one special character');
  } else {
    score += 10;
  }
  
  // Entropy bonus
  const uniqueChars = new Set(password).size;
  score += Math.min(uniqueChars * 2, 20);
  
  return {
    isValid: issues.length === 0 && score >= 80,
    score: Math.min(score, 100),
    issues,
  };
}

/**
 * Check if IP is in CIDR range
 */
export function isIPInCIDR(ip: string, cidr: string): boolean {
  // Simple implementation for IPv4
  // For production, use a library like 'ip-cidr' or 'netmask'
  
  if (!cidr.includes('/')) {
    // Exact match
    return ip === cidr;
  }
  
  const [range, bits] = cidr.split('/');
  const mask = -1 << (32 - parseInt(bits));
  
  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(range);
  
  return (ipInt & mask) === (rangeInt & mask);
}

/**
 * Convert IP address to integer
 */
function ipToInt(ip: string): number {
  const parts = ip.split('.');
  return (
    (parseInt(parts[0]) << 24) |
    (parseInt(parts[1]) << 16) |
    (parseInt(parts[2]) << 8) |
    parseInt(parts[3])
  );
}

/**
 * Rate limit check helper
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  constructor(
    private maxAttempts: number,
    private windowMs: number
  ) {}
  
  /**
   * Check if key has exceeded rate limit
   */
  isLimited(key: string): boolean {
    const now = Date.now();
    const timestamps = this.attempts.get(key) || [];
    
    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);
    
    this.attempts.set(key, validTimestamps);
    
    return validTimestamps.length >= this.maxAttempts;
  }
  
  /**
   * Record an attempt
   */
  recordAttempt(key: string): void {
    const now = Date.now();
    const timestamps = this.attempts.get(key) || [];
    timestamps.push(now);
    this.attempts.set(key, timestamps);
  }
  
  /**
   * Reset attempts for a key
   */
  reset(key: string): void {
    this.attempts.delete(key);
  }
  
  /**
   * Get remaining attempts
   */
  getRemaining(key: string): number {
    const timestamps = this.attempts.get(key) || [];
    const now = Date.now();
    const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);
    return Math.max(0, this.maxAttempts - validTimestamps.length);
  }
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars) {
    return '****';
  }
  
  const visible = data.slice(-visibleChars);
  const masked = '*'.repeat(Math.min(data.length - visibleChars, 8));
  
  return masked + visible;
}
