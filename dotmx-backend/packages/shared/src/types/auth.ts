/**
 * Authentication Types
 */

export interface User {
  id: string;
  email: string | null;
  email_verified: boolean;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  mfa_enabled: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
}

export type UserRole = 'user' | 'admin' | 'super_admin';
export type UserStatus = 'active' | 'suspended' | 'banned' | 'deleted';

export interface UserProfile extends User {
  wallets: WalletLink[];
  api_keys_count: number;
}

export interface WalletLink {
  id: string;
  user_id: string;
  wallet_address: string;
  chain_code: string;
  chain_id: number | null;
  wallet_type: string;
  is_primary: boolean;
  verified: boolean;
  last_used_at: Date | null;
  created_at: Date;
  metadata: Record<string, any>;
}

export interface Session {
  id: string;
  user_id: string;
  refresh_token: string;
  access_token_jti: string | null;
  device_name: string | null;
  device_fingerprint: string | null;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: Date;
  last_activity_at: Date;
  revoked: boolean;
  created_at: Date;
}

export interface ApiKey {
  id: string;
  user_id: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  rate_limit_per_minute: number;
  is_active: boolean;
  expires_at: Date | null;
  last_used_at: Date | null;
  created_at: Date;
}

export type TokenPurpose = 'access' | 'refresh' | '2fa_login' | '2fa_action' | 'email_verify' | 'password_reset';

export interface JWTPayload {
  sub: string; // user_id
  email?: string;
  role: UserRole;
  jti: string; // JWT ID
  iat: number; // issued at
  exp: number; // expires at
  type: 'access' | 'refresh';
  purpose?: TokenPurpose; // Extended purpose for single-use tokens
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  device_name?: string;
  device_fingerprint?: string;
}

export interface WalletAuthChallengeRequest {
  wallet_address: string;
  chain_code: string;
}

export interface WalletAuthChallenge {
  challenge_message: string;
  nonce: string;
  expires_at: Date;
}

export interface WalletAuthVerifyRequest {
  wallet_address: string;
  chain_code: string;
  nonce: string;
  signature: string;
  device_name?: string;
  device_fingerprint?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface Login2FAResponse {
  user: User;
  requires_2fa: true;
  temp_token: string;
}

export interface Login2FAVerifyRequest {
  temp_token: string;
  code: string;
}

export interface PasswordResetVerify {
  token: string;
  new_password: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

export interface LinkWalletRequest {
  wallet_address: string;
  chain_code: string;
  chain_id?: number;
  wallet_type?: string;
  signature: string;
  nonce: string;
  is_primary?: boolean;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  rate_limit_per_minute?: number;
  expires_in_days?: number;
}

export interface CreateApiKeyResponse {
  api_key: string; // Full key shown only once
  key: ApiKey;
}

export interface AuthAuditLog {
  id: string;
  user_id: string | null;
  event_type: AuthEventType;
  status: 'success' | 'failure';
  ip_address: string | null;
  user_agent: string | null;
  email: string | null;
  wallet_address: string | null;
  failure_reason: string | null;
  metadata: Record<string, any>;
  created_at: Date;
}

export type AuthEventType =
  | 'register'
  | 'login'
  | 'logout'
  | 'refresh_token'
  | 'password_change'
  | 'password_reset_request'
  | 'password_reset_verify'
  | 'wallet_link'
  | 'wallet_unlink'
  | 'wallet_login'
  | 'api_key_create'
  | 'api_key_delete'
  | 'email_verify'
  | 'mfa_enable'
  | 'mfa_disable'
  | 'account_lock'
  | 'account_unlock';

// Error types
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: string = 'AUTHENTICATION_ERROR',
    public status: number = 401
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: string = 'AUTHORIZATION_ERROR',
    public status: number = 403
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public code: string = 'VALIDATION_ERROR',
    public status: number = 400,
    public fields?: Record<string, string>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AccountLockedError extends AuthenticationError {
  constructor(public locked_until: Date) {
    super(
      `Account is locked until ${locked_until.toISOString()}`,
      'ACCOUNT_LOCKED',
      403
    );
    this.name = 'AccountLockedError';
  }
}
