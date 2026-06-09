/**
 * Transactions API Service
 */

import { api, type PaginatedResponse } from '@/libs/api';

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

export interface TransactionDetail extends TransactionListItem {
  fee: number | null;
  address: string | null;
  network: string | null;
  memo: string | null;
  metadata: Record<string, unknown>;
}

export interface TransactionsListParams {
  page?: number;
  pageSize?: number;
  type?: string;
  status?: string;
  userId?: string;
  currency?: string;
  fromDate?: string;
  toDate?: string;
  [key: string]: string | number | boolean | undefined;
}

export const transactionsService = {
  /**
   * Get paginated list of transactions
   */
  getTransactions: (params: TransactionsListParams = {}) =>
    api.get<PaginatedResponse<TransactionListItem>>('/transactions', params),
  
  /**
   * Get transaction details
   */
  getTransaction: (transactionId: string) =>
    api.get<TransactionDetail>(`/transactions/${transactionId}`),
  
  /**
   * Update transaction status
   */
  updateStatus: (transactionId: string, status: TransactionListItem['status']) =>
    api.patch<{ success: boolean }>(`/transactions/${transactionId}/status`, { status })
};
