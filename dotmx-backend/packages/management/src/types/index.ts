/**
 * Management API Types
 */

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalVolume24h: number;
  totalBalance: number;
  activeTrades: number;
  pendingKyc: number;
  pendingWithdrawals: number;
}

export interface UserListItem {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  kycStatus: 'none' | 'pending' | 'approved' | 'rejected';
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserDetail extends UserListItem {
  avatarUrl: string | null;
  mfaEnabled: boolean;
  metadata: Record<string, unknown>;
  balances: UserBalance[];
  recentTransactions: TransactionListItem[];
}

export interface UserBalance {
  currency: string;
  available: number;
  locked: number;
  total: number;
}

export interface TransactionListItem {
  id: string;
  userId: string;
  userEmail: string;
  type: 'deposit' | 'withdrawal' | 'trade' | 'fee' | 'transfer';
  currency: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  txHash: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface KycApplication {
  id: string;
  userId: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'rejected' | 'under_review';
  level: 1 | 2 | 3;
  documentType: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  notes: string | null;
}

export interface TradingPair {
  id: string;
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  status: 'active' | 'inactive' | 'maintenance';
  minOrderSize: number;
  maxOrderSize: number;
  tickSize: number;
  makerFee: number;
  takerFee: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ManagementApiConfig {
  allowedOrigins: string[];
  isDevelopment: boolean;
  apiKey?: string;
}

export interface Chain {
  id: string;
  code: string;
  name: string;
  chainType: 'EVM' | 'SOL' | 'TRON' | 'BTC' | 'DOGE';
  chainId: number | null;
  networkType: 'mainnet' | 'testnet';
  rpcUrl: string | null;
  explorerUrl: string | null;
  nativeSymbol: string;
  nativeDecimals: number;
  isActive: boolean;
  depositEnabled: boolean;
  withdrawalEnabled: boolean;
  minConfirmations: number;
  avgBlockTimeSeconds: number;
  iconUrl: string | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Token {
  id: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  coingeckoId: string | null;
  isStablecoin: boolean;
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TokenChain {
  id: string;
  code: string;
  name: string;
  chainType: 'EVM' | 'SOL' | 'TRON' | 'BTC' | 'DOGE';
  contractAddress: string | null;
  decimals: number;
  isNative: boolean;
  isActive: boolean;
  depositEnabled: boolean;
  withdrawalEnabled: boolean;
  minDeposit: number;
  maxDeposit: number | null;
  minWithdrawal: number;
  maxWithdrawal: number | null;
  withdrawalFee: number;
  withdrawalFeeType: 'fixed' | 'percentage';
}

export interface TokenWithChains extends Token {
  chains: TokenChain[];
}
