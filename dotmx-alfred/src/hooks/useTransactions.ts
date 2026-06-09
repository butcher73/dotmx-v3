'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  transactionsService, 
  type TransactionListItem, 
  type TransactionDetail,
  type TransactionsListParams 
} from '@/services/transactions';
import type { PaginatedResponse } from '@/libs/api';

export function useTransactions(initialParams: TransactionsListParams = {}) {
  const [data, setData] = useState<PaginatedResponse<TransactionListItem> | null>(null);
  const [params, setParams] = useState(initialParams);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await transactionsService.getTransactions(params);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const setPage = (page: number) => {
    setParams(prev => ({ ...prev, page }));
  };

  const setType = (type: string | undefined) => {
    setParams(prev => ({ ...prev, type, page: 1 }));
  };

  const setStatus = (status: string | undefined) => {
    setParams(prev => ({ ...prev, status, page: 1 }));
  };

  const setDateRange = (fromDate: string | undefined, toDate: string | undefined) => {
    setParams(prev => ({ ...prev, fromDate, toDate, page: 1 }));
  };

  return {
    transactions: data?.data || [],
    pagination: data?.pagination,
    isLoading,
    error,
    refetch: fetchTransactions,
    setPage,
    setType,
    setStatus,
    setDateRange,
    params
  };
}

export function useTransaction(transactionId: string | null) {
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransaction = useCallback(async () => {
    if (!transactionId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await transactionsService.getTransaction(transactionId);
      setTransaction(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transaction');
    } finally {
      setIsLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    fetchTransaction();
  }, [fetchTransaction]);

  const updateStatus = async (status: TransactionListItem['status']) => {
    if (!transactionId) return;
    
    try {
      await transactionsService.updateStatus(transactionId, status);
      await fetchTransaction();
    } catch (err) {
      throw err;
    }
  };

  return { transaction, isLoading, error, refetch: fetchTransaction, updateStatus };
}
