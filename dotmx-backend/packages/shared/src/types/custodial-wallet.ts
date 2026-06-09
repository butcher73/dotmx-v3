/**
 * Custodial Wallet Types
 * Types for deposit addresses, deposits, withdrawals, and balances
 */

// ============================================
// Chain Configuration
// ============================================

export interface ChainConfig {
  chain_code: string;
  chain_id: number;
  coin_type: number; // BIP-44 coin type
  name: string;
  native_symbol: string;
  rpc_url: string;
  explorer_url: string;
  confirmations_required: number;
  is_evm: boolean;
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  ETH: {
    chain_code: 'ETH',
    chain_id: 1,
    coin_type: 60,
    name: 'Ethereum',
    native_symbol: 'ETH',
    rpc_url: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
    explorer_url: 'https://etherscan.io',
    confirmations_required: 12,
    is_evm: true,
  },
  MATIC: {
    chain_code: 'MATIC',
    chain_id: 137,
    coin_type: 966,
    name: 'Polygon',
    native_symbol: 'MATIC',
    rpc_url: process.env.MATIC_RPC_URL || 'https://polygon-rpc.com',
    explorer_url: 'https://polygonscan.com',
    confirmations_required: 128,
    is_evm: true,
  },
  BSC: {
    chain_code: 'BSC',
    chain_id: 56,
    coin_type: 9006,
    name: 'BNB Chain',
    native_symbol: 'BNB',
    rpc_url: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    explorer_url: 'https://bscscan.com',
    confirmations_required: 15,
    is_evm: true,
  },
  ARB: {
    chain_code: 'ARB',
    chain_id: 42161,
    coin_type: 60,
    name: 'Arbitrum One',
    native_symbol: 'ETH',
    rpc_url: process.env.ARB_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    explorer_url: 'https://arbiscan.io',
    confirmations_required: 12,
    is_evm: true,
  },
  OP: {
    chain_code: 'OP',
    chain_id: 10,
    coin_type: 60,
    name: 'Optimism',
    native_symbol: 'ETH',
    rpc_url: process.env.OP_RPC_URL || 'https://mainnet.optimism.io',
    explorer_url: 'https://optimistic.etherscan.io',
    confirmations_required: 12,
    is_evm: true,
  },
  BASE: {
    chain_code: 'BASE',
    chain_id: 8453,
    coin_type: 60,
    name: 'Base',
    native_symbol: 'ETH',
    rpc_url: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    explorer_url: 'https://basescan.org',
    confirmations_required: 12,
    is_evm: true,
  },
  SEP: {
    chain_code: 'SEP',
    chain_id: 11155111,
    coin_type: 60,
    name: 'Ethereum Sepolia',
    native_symbol: 'ETH',
    rpc_url: process.env.SEP_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    explorer_url: 'https://sepolia.etherscan.io',
    confirmations_required: 12,
    is_evm: true,
  },
};

// ============================================
// Deposit Address
// ============================================

export interface DepositAddress {
  id: string;
  user_id: string;
  network_id: string;
  address: string;
  derivation_index: number;
  derivation_path: string | null;
  is_active: boolean;
  total_deposits: string;
  last_deposit_at: Date | null;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
  // Common JOIN alias
  chain_code?: string;
}

export interface CreateDepositAddressRequest {
  user_id: string;
  chain_code: string;
}

// ============================================
// Deposits
// ============================================

export type DepositStatus = 'pending' | 'confirming' | 'confirmed' | 'swept' | 'failed';

export interface Deposit {
  id: string;
  user_id: string;
  deposit_address_id: string | null;
  network_id: string;
  asset_id: string;
  amount: string;
  tx_hash: string;
  from_address: string | null;
  to_address: string | null;
  block_number: number;
  confirmations: number;
  required_confirmations: number;
  status: DepositStatus;
  sweep_operation_id: string | null;
  balance_transaction_id: string | null;
  detected_at: Date;
  confirmed_at: Date | null;
  credited_at: Date | null;
  swept_at: Date | null;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
  // Common JOIN aliases
  chain_code?: string;
  token_symbol?: string;
  token_address?: string | null;
}

// ============================================
// User Balances
// ============================================

export interface UserBalance {
  id: string;
  user_id: string;
  asset_id: string;
  available: string;
  locked: string;
  pending: string;
  total_deposited: string;
  total_withdrawn: string;
  last_updated_at: Date;
  created_at: Date;
  // Common JOIN alias
  token_symbol?: string;
}

export interface BalanceUpdate {
  user_id: string;
  asset_id: string;
  amount: string;
  tx_type: string;
  description?: string;
  tx_hash?: string;
  network_id?: string;
  metadata?: Record<string, any>;
}

export type BalanceOperation =
  | 'deposit'
  | 'withdrawal'
  | 'withdrawal_lock'
  | 'withdrawal_unlock'
  | 'withdrawal_complete'
  | 'fee'
  | 'trade'
  | 'adjustment'
  | 'sweep';

// ============================================
// Withdrawals
// ============================================

export type WithdrawalStatus =
  | 'pending_approval'
  | 'approved'
  | 'processing'
  | 'broadcasted'
  | 'confirming'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'rejected';

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  network_id: string;
  asset_id: string;
  amount: string;
  fee: string;
  net_amount: string;
  to_address: string;
  status: WithdrawalStatus;
  tx_hash: string | null;
  confirmations: number;
  batch_id: string | null;
  error_message: string | null;
  requires_2fa: boolean;
  is_2fa_verified: boolean;
  ip_address: string | null;
  user_agent: string | null;
  approved_at: Date | null;
  approved_by: string | null;
  broadcasted_at: Date | null;
  completed_at: Date | null;
  failed_at: Date | null;
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, any>;
  // Common JOIN aliases
  chain_code?: string;
  token_symbol?: string;
  token_address?: string | null;
}

export interface CreateWithdrawalRequest {
  user_id: string;
  chain_code: string;
  token_symbol: string;
  amount: string;
  destination_address: string;
  ip_address?: string;
  user_agent?: string;
  /** Set to true by the route layer after TOTP/2FA code is verified */
  is_2fa_verified?: boolean;
}

export interface WithdrawalBatch {
  id: string;
  network_id: string;
  status: 'pending' | 'exported' | 'signed' | 'broadcast' | 'completed' | 'failed';
  total_amount: string;
  transaction_count: number;
  unsigned_tx_data: object | null;
  signed_tx_data: object | null;
  tx_hash: string | null;
  exported_at: Date | null;
  signed_at: Date | null;
  broadcast_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // Common JOIN alias
  chain_code?: string;
}

// ============================================
// Sweep Transactions
// ============================================

export type SweepStatus = 'pending' | 'gas_sent' | 'broadcasting' | 'confirming' | 'completed' | 'failed';

export interface SweepTransaction {
  id: string;
  deposit_id: string | null;
  from_address: string;
  to_address: string;
  network_id: string;
  asset_id: string;
  amount: string;
  tx_hash: string | null;
  gas_tx_hash: string | null;
  gas_used: string | null;
  gas_price: string | null;
  total_gas_cost: string | null;
  status: SweepStatus;
  failure_reason: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: Date | null;
  block_number: number | null;
  confirmations: number;
  scheduled_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// Warm Wallet
// ============================================

export type WarmWalletType = 'gnosis_safe' | 'custom_multisig' | 'eoa';

export interface WarmWallet {
  id: string;
  network_id: string;
  address: string;
  wallet_type: WarmWalletType;
  required_signatures: number;
  total_signers: number;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  // Common JOIN alias
  chain_code?: string;
}

// ============================================
// Supported Tokens
// ============================================

export interface SupportedToken {
  id: string;
  asset_id: string;
  network_id: string;
  contract_address: string | null;
  decimals: number;
  is_native: boolean;
  is_active: boolean;
  deposit_enabled: boolean;
  withdrawal_enabled: boolean;
  min_deposit: string;
  max_deposit: string | null;
  min_withdrawal: string;
  max_withdrawal: string | null;
  withdrawal_fee: string;
  withdrawal_fee_type: string;
  created_at: Date;
  updated_at: Date;
  // Common JOIN aliases
  chain_code?: string;
  token_symbol?: string;
  token_name?: string;
  token_address?: string | null;
}

// ============================================
// Balance Transaction (formerly Balance Audit Log)
// ============================================

export interface BalanceTransaction {
  id: string;
  user_id: string;
  asset_id: string;
  tx_type: string;
  amount: string;
  fee: string;
  balance_before: string;
  balance_after: string;
  network_id: string | null;
  tx_hash: string | null;
  from_address: string | null;
  to_address: string | null;
  order_id: string | null;
  withdrawal_request_id: string | null;
  status: string;
  description: string | null;
  created_at: Date;
  confirmed_at: Date | null;
  metadata: Record<string, any>;
}

/** @deprecated Use BalanceTransaction instead */
export type BalanceAuditLog = BalanceTransaction;

// ============================================
// Master Key (encrypted seed storage)
// ============================================

export interface WalletMasterKey {
  id: string;
  key_name: string;
  encrypted_dek: Buffer;
  encrypted_seed: Buffer;
  kms_key_resource_name: string;
  algorithm: string;
  version: number;
  is_active: boolean;
  created_at: Date;
  rotated_at: Date | null;
}

// ============================================
// Export Types (for offline signing)
// ============================================

export interface WithdrawalExport {
  batch_id: string;
  created_at: string;
  chain_code: string;
  chain_id: number;
  warm_wallet: string;
  warm_wallet_type: WarmWalletType;
  required_signatures: number;
  transactions: WithdrawalExportTransaction[];
  total_amount: string;
  estimated_gas: string;
}

export interface WithdrawalExportTransaction {
  id: string;
  to: string;
  value: string;
  token_address: string | null;
  token_symbol: string;
  data: string;
  nonce?: number;
}

export interface SignedWithdrawalImport {
  batch_id: string;
  signed_tx: string;
  signatures?: string[];
}

// ============================================
// GCP KMS Types
// ============================================

export interface GCPKMSConfig {
  project_id: string;
  location: string;
  key_ring: string;
  key_name: string;
}

export interface EncryptedData {
  ciphertext: Buffer;
  iv: Buffer;
  auth_tag: Buffer;
}

// ============================================
// API Response Types
// ============================================

export interface DepositAddressResponse {
  address: string;
  chain_code: string;
  chain_id: number;
  chain_name: string;
  qr_code?: string;
}

export interface BalanceResponse {
  token_symbol: string;
  chain_code: string;
  available: string;
  locked: string;
  total: string;
}

export interface WithdrawalResponse {
  id: string;
  status: WithdrawalStatus;
  amount: string;
  fee: string;
  destination_address: string;
  token_symbol: string;
  chain_code: string;
  tx_hash: string | null;
  created_at: Date;
}

// ============================================
// Errors
// ============================================

export class CustodialWalletError extends Error {
  constructor(
    message: string,
    public code: string = 'CUSTODIAL_WALLET_ERROR',
    public status: number = 500
  ) {
    super(message);
    this.name = 'CustodialWalletError';
  }
}

export class InsufficientBalanceError extends CustodialWalletError {
  constructor(message: string = 'Insufficient balance') {
    super(message, 'INSUFFICIENT_BALANCE', 400);
    this.name = 'InsufficientBalanceError';
  }
}

export class WithdrawalLimitError extends CustodialWalletError {
  constructor(message: string = 'Withdrawal limit exceeded') {
    super(message, 'WITHDRAWAL_LIMIT_EXCEEDED', 400);
    this.name = 'WithdrawalLimitError';
  }
}

export class InvalidAddressError extends CustodialWalletError {
  constructor(message: string = 'Invalid address') {
    super(message, 'INVALID_ADDRESS', 400);
    this.name = 'InvalidAddressError';
  }
}

export class UnsupportedChainError extends CustodialWalletError {
  constructor(chain_code: string) {
    super(`Unsupported chain: ${chain_code}`, 'UNSUPPORTED_CHAIN', 400);
    this.name = 'UnsupportedChainError';
  }
}

export class UnsupportedTokenError extends CustodialWalletError {
  constructor(token_symbol: string, chain_code: string) {
    super(`Unsupported token: ${token_symbol} on ${chain_code}`, 'UNSUPPORTED_TOKEN', 400);
    this.name = 'UnsupportedTokenError';
  }
}

export class KMSError extends CustodialWalletError {
  constructor(message: string) {
    super(message, 'KMS_ERROR', 500);
    this.name = 'KMSError';
  }
}
