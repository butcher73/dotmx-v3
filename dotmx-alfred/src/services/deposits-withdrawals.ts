/**
 * Deposits & Withdrawals API Service
 * 
 * Proper architecture:
 * - deposits: Track incoming on-chain deposits
 * - withdrawal_requests: Track withdrawal lifecycle  
 * - sweep_operations: Track sweeping to hot/warm wallets
 * - sweeper_status: Track sweeper service status
 */

import { api, PaginatedResponse } from '@/libs/api';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface Deposit {
  id: string;
  userId: string;
  userEmail: string;
  chainCode: string;
  tokenSymbol: string;
  amount: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  status: 'pending' | 'confirming' | 'confirmed' | 'swept' | 'failed';
  confirmations: number;
  requiredConfirmations: number;
  detectedAt: string;
  confirmedAt: string | null;
  creditedAt: string | null;
  sweptAt: string | null;
  sweepOperationId: string | null;
  blockNumber: number | null;
}

export interface Withdrawal {
  id: string;
  userId: string;
  userEmail: string;
  chainCode: string;
  tokenSymbol: string;
  amount: string;
  feeAmount: string;
  netAmount: string;
  destinationAddress: string;
  status: 'pending_approval' | 'approved' | 'processing' | 'broadcasted' | 'confirming' | 'completed' | 'failed' | 'cancelled' | 'rejected';
  txHash: string | null;
  confirmations: number;
  approvedAt: string | null;
  broadcastedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface SweepOperation {
  id: string;
  chainCode: string;
  tokenSymbol: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  txHash: string | null;
  gasTxHash: string | null;
  gasUsed: string | null;
  totalGasCost: string | null;
  status: 'pending' | 'gas_sent' | 'broadcasting' | 'confirming' | 'completed' | 'failed';
  scheduledAt: string;
  completedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  retryCount: number;
  blockNumber: number | null;
}

export interface DepositsWithdrawalsStats {
  totalDepositsToday: number;
  totalDepositsValueToday: string;
  totalWithdrawalsToday: number;
  totalWithdrawalsValueToday: string;
  pendingDeposits: number;
  pendingWithdrawals: number;
  pendingApprovals: number;
  pendingSweeps: number;
  netFlowToday: string;
}

export interface SweeperStatus {
  isRunning: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  totalSwept24h: string;
  operationsCompleted24h: number;
  operationsFailed24h: number;
  pendingToSweep: number;
  activeChains: Array<{
    chainCode: string;
    pendingDeposits: number;
  }>;
}

// =============================================================================
// FILTER TYPES
// =============================================================================

export interface DepositsFilter {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  pageSize?: number;
  status?: string;
  chainCode?: string;
  userId?: string;
  tokenSymbol?: string;
}

export interface WithdrawalsFilter {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  pageSize?: number;
  status?: string;
  chainCode?: string;
  userId?: string;
  tokenSymbol?: string;
}

export interface SweepsFilter {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  pageSize?: number;
  status?: string;
  chainCode?: string;
}

// =============================================================================
// API SERVICE
// =============================================================================

export const depositsWithdrawalsService = {
  // Statistics
  getStats: () => 
    api.get<DepositsWithdrawalsStats>('/deposits-withdrawals/stats'),

  // Deposits
  getDeposits: (filters?: DepositsFilter) =>
    api.get<PaginatedResponse<Deposit>>('/deposits-withdrawals/deposits', filters),

  getDeposit: (id: string) => 
    api.get<Deposit>(`/deposits-withdrawals/deposits/${id}`),

  // Withdrawals
  getWithdrawals: (filters?: WithdrawalsFilter) =>
    api.get<PaginatedResponse<Withdrawal>>('/deposits-withdrawals/withdrawals', filters),

  getWithdrawal: (id: string) => 
    api.get<Withdrawal>(`/deposits-withdrawals/withdrawals/${id}`),

  approveWithdrawal: (id: string) =>
    api.post<{ success: boolean; id: string; status: string }>(
      `/deposits-withdrawals/withdrawals/${id}/approve`
    ),

  rejectWithdrawal: (id: string, reason?: string) =>
    api.post<{ success: boolean; message: string }>(
      `/deposits-withdrawals/withdrawals/${id}/reject`, 
      { reason }
    ),

  // Sweep Operations
  getSweeps: (filters?: SweepsFilter) =>
    api.get<PaginatedResponse<SweepOperation>>('/deposits-withdrawals/sweeps', filters),

  // Sweeper Status
  getSweeperStatus: () => 
    api.get<SweeperStatus>('/deposits-withdrawals/sweeper/status'),
};
