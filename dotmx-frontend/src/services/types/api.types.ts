// ==================== AUTH TYPES ====================

export interface LoginRequest {
  email: string;
  password: string;
  device_name?: string;
  device_fingerprint?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface AuthResponse {
  user: User;
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetVerify {
  token: string;
  new_password: string;
}

export interface PasswordChangeRequest {
  old_password: string;
  new_password: string;
}

export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  username?: string;
  avatar_url?: string;
}

export interface User {
  id: string;
  email: string;
  email_verified: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  avatar_url?: string;
  role: string;
  status: string;
  kyc_status?: "none" | "pending" | "verified" | "rejected";
  country?: string;
  fee_tier?: number;
}

// ==================== SESSION & API KEY TYPES ====================

export interface Session {
  id: string;
  device_name?: string;
  device_fingerprint?: string;
  ip_address?: string;
  user_agent?: string;
  browser?: string;
  os?: string;
  device_type?: string;
  location?: string;
  is_current?: boolean;
  last_activity_at: string;
  expires_at: string;
  revoked: boolean;
  created_at: string;
}

export interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  rate_limit_per_minute?: number;
  expires_in_days?: number;
}

export interface CreateApiKeyResponse {
  api_key: string;
  key: ApiKey;
  message: string;
}

// ==================== TWO-FACTOR AUTHENTICATION TYPES ====================

export interface TwoFactorStatus {
  enabled: boolean;
  method: "totp" | "sms" | "email" | null;
  setup_completed: boolean;
  last_used_at?: string;
  total_uses?: number;
}

export interface TwoFactorSetupResponse {
  secret: string;
  qr_code_url: string;
  uri: string;
  backup_codes: string[];
  message: string;
}

// ==================== WITHDRAWAL WHITELIST TYPES ====================

export interface WhitelistAddress {
  id: string;
  label: string;
  address: string;
  chain: string;
  created_at: string;
}

export interface WhitelistResponse {
  enabled: boolean;
  addresses: WhitelistAddress[];
}

export interface AddWhitelistAddressRequest {
  label: string;
  address: string;
  chain: string;
}

// ==================== TRADING TYPES ====================

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface Transaction {
  id: string;
  tx_type: string;
  amount: string;
  fee: string;
  price: string;
  margin: string;
  asset_symbol?: string;
  market?: string;
  is_long?: boolean;
  order_type?: number;
  order_id?: string;
  reference_id?: string;
  liquidation_price?: string;
  position_margin?: string;
  position_size?: string;
  position_price?: string;
  liquidator_fee?: string;
  keeper_fee?: string;
  funding_fee?: string;
  pnl?: string;
  is_reduce_only?: boolean;
  status?: string;
  block_number?: number;
  created_at: string;
}

export interface OrderRequest {
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET" | "STOP_LIMIT" | "STOP_MARKET";
  price?: number | undefined;
  quantity: number;
  timeInForce?: "GTC" | "IOC" | "FOK" | "POST_ONLY" | undefined;
  clientOrderId?: string | undefined;
  stopPrice?: number | undefined;
  takeProfit?: number | undefined;
  stopLoss?: number | undefined;
}

export interface Order {
  orderId: string;
  status: string;
  symbol: string;
  side: string;
  type: string;
  price?: number;
  quantity: number;
  filledQuantity?: number;
  createdAt?: string;
}

export interface Position {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  margin: number;
  liquidationPrice: number;
}

export interface Balance {
  total: number;
  available: number;
  margin: number;
  pnl: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: string;
  price: number;
  quantity: number;
  timestamp: string;
}

// ==================== ASSET TYPES ====================

export interface SupportedNetwork {
  code: string;
  name: string;
  chain_id: string;
  is_active: boolean;
  confirmations_required: number;
  deposit_enabled: boolean;
  withdrawal_enabled: boolean;
}

export interface NetworkInfo {
  network_code: string;
  network_name: string;
  contract_address: string | null;
  decimal_places: number;
  min_deposit: string;
  min_withdrawal: string;
  withdrawal_fee: string;
  deposit_enabled: boolean;
  withdrawal_enabled: boolean;
}

export interface SupportedAsset {
  symbol: string;
  name: string;
  asset_type: string;
  icon_url: string | null;
  decimal_places: number;
  is_active: boolean;
  is_stablecoin?: boolean;
  networks: NetworkInfo[];
}

export interface NewListedAsset {
  id: string;
  symbol: string;
  name: string;
  asset_type: string;
  icon_url: string | null;
  listed_at: string;
  networks: Array<{
    network_code: string;
    network_name: string;
    chain_type: string;
    deposit_enabled: boolean;
    withdrawal_enabled: boolean;
  }>;
}

export interface UserBalance {
  asset_symbol: string;
  asset_name: string;
  asset_type?: string;
  is_stablecoin?: boolean;
  icon_url: string | null;
  available: string;
  locked: string;
  pending: string;
  total: string;
  updated_at: string;
}

export interface DepositAddress {
  id: string;
  asset_symbol: string;
  network_code: string;
  network_name: string;
  address: string;
  qr_data: string;
  memo?: string;
  vault_id?: string;
  created_at: string;
  token_contract_address?: string | null;
  is_native_token?: boolean;
  explorer_url?: string;
}

export type WithdrawalStatus =
  | "pending_approval"
  | "approved"
  | "processing"
  | "confirming"
  | "completed"
  | "failed"
  | "cancelled";

export interface WithdrawalRequest {
  id: string;
  asset_symbol: string;
  network_code: string;
  amount: string;
  fee: string;
  net_amount: string;
  destination_address: string;
  memo?: string;
  tx_hash?: string;
  status: WithdrawalStatus;
  failure_reason?: string;
  created_at: string;
  processed_at?: string;
  completed_at?: string;
}

export interface CreateWithdrawalRequest {
  asset_symbol: string;
  network_code: string;
  amount: string;
  destination_address: string;
  memo?: string;
}

export type AssetTransactionType =
  | "deposit"
  | "withdrawal"
  | "trade_buy"
  | "trade_sell"
  | "fee"
  | "transfer_in"
  | "transfer_out"
  | "adjustment";

export interface AssetTransaction {
  id: string;
  asset_symbol: string;
  tx_type: AssetTransactionType;
  amount: string;
  fee: string;
  balance_before: string;
  balance_after: string;
  reference_type?: string;
  reference_id?: string;
  description?: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

// ==================== CAREER TYPES ====================

export type JobType = "full-time" | "part-time" | "contract" | "internship";
export type JobLocation = "remote" | "hybrid" | "onsite";
export type JobStatus = "active" | "inactive" | "filled";

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: JobLocation;
  location_details?: string;
  type: JobType;
  description: string;
  requirements?: string[];
  benefits?: string[];
  salary_range?: string;
  application_url?: string;
  status: JobStatus;
  created_at: string;
  updated_at?: string;
}

export interface JobApplicationRequest {
  job_id: string;
  name: string;
  email: string;
  phone?: string;
  resume_url?: string;
  cover_letter?: string;
  linkedin_url?: string;
  portfolio_url?: string;
}

// ==================== ERROR TYPES ====================

export interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
}
