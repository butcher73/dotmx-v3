'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  depositsWithdrawalsService, 
  type Deposit, 
  type Withdrawal,
  type SweepOperation,
  type DepositsWithdrawalsStats,
  type SweeperStatus,
  type DepositsFilter,
  type WithdrawalsFilter,
  type SweepsFilter,
} from '@/services/deposits-withdrawals';

// Pagination type from PaginatedResponse
interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// =============================================================================
// DEPOSITS HOOK
// =============================================================================

interface UseDepositsOptions {
  page?: number;
  pageSize?: number;
  status?: string;
  chainCode?: string;
}

interface UseDepositsState {
  deposits: Deposit[];
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;
}

export function useDeposits(options: UseDepositsOptions = {}) {
  const [state, setState] = useState<UseDepositsState>({
    deposits: [],
    pagination: null,
    isLoading: true,
    error: null,
  });
  
  const [filters, setFilters] = useState<DepositsFilter>({
    page: options.page || 1,
    pageSize: options.pageSize || 20,
    status: options.status,
    chainCode: options.chainCode,
  });

  const fetchDeposits = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await depositsWithdrawalsService.getDeposits(filters);
      setState({
        deposits: response.data,
        pagination: response.pagination,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch deposits',
      }));
    }
  }, [filters]);

  useEffect(() => {
    fetchDeposits();
  }, [fetchDeposits]);

  const setPage = (page: number) => setFilters(prev => ({ ...prev, page }));
  const setStatus = (status?: string) => setFilters(prev => ({ ...prev, status, page: 1 }));
  const setChainCode = (chainCode?: string) => setFilters(prev => ({ ...prev, chainCode, page: 1 }));

  return {
    ...state,
    refetch: fetchDeposits,
    setPage,
    setStatus,
    setChainCode,
  };
}

// =============================================================================
// WITHDRAWALS HOOK
// =============================================================================

interface UseWithdrawalsOptions {
  page?: number;
  pageSize?: number;
  status?: string;
  chainCode?: string;
}

interface UseWithdrawalsState {
  withdrawals: Withdrawal[];
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;
}

export function useWithdrawals(options: UseWithdrawalsOptions = {}) {
  const [state, setState] = useState<UseWithdrawalsState>({
    withdrawals: [],
    pagination: null,
    isLoading: true,
    error: null,
  });
  
  const [filters, setFilters] = useState<WithdrawalsFilter>({
    page: options.page || 1,
    pageSize: options.pageSize || 20,
    status: options.status,
    chainCode: options.chainCode,
  });

  const fetchWithdrawals = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await depositsWithdrawalsService.getWithdrawals(filters);
      setState({
        withdrawals: response.data,
        pagination: response.pagination,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch withdrawals',
      }));
    }
  }, [filters]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const setPage = (page: number) => setFilters(prev => ({ ...prev, page }));
  const setStatus = (status?: string) => setFilters(prev => ({ ...prev, status, page: 1 }));
  const setChainCode = (chainCode?: string) => setFilters(prev => ({ ...prev, chainCode, page: 1 }));

  const approveWithdrawal = async (id: string) => {
    try {
      await depositsWithdrawalsService.approveWithdrawal(id);
      await fetchWithdrawals();
    } catch (error) {
      throw error;
    }
  };

  const rejectWithdrawal = async (id: string, reason?: string) => {
    try {
      await depositsWithdrawalsService.rejectWithdrawal(id, reason);
      await fetchWithdrawals();
    } catch (error) {
      throw error;
    }
  };

  return {
    ...state,
    refetch: fetchWithdrawals,
    setPage,
    setStatus,
    setChainCode,
    approveWithdrawal,
    rejectWithdrawal,
  };
}

// =============================================================================
// SWEEPS HOOK
// =============================================================================

interface UseSweepsOptions {
  page?: number;
  pageSize?: number;
  status?: string;
  chainCode?: string;
}

interface UseSweepsState {
  sweeps: SweepOperation[];
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;
}

export function useSweeps(options: UseSweepsOptions = {}) {
  const [state, setState] = useState<UseSweepsState>({
    sweeps: [],
    pagination: null,
    isLoading: true,
    error: null,
  });
  
  const [filters, setFilters] = useState<SweepsFilter>({
    page: options.page || 1,
    pageSize: options.pageSize || 20,
    status: options.status,
    chainCode: options.chainCode,
  });

  const fetchSweeps = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await depositsWithdrawalsService.getSweeps(filters);
      setState({
        sweeps: response.data,
        pagination: response.pagination,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch sweep operations',
      }));
    }
  }, [filters]);

  useEffect(() => {
    fetchSweeps();
  }, [fetchSweeps]);

  const setPage = (page: number) => setFilters(prev => ({ ...prev, page }));
  const setStatus = (status?: string) => setFilters(prev => ({ ...prev, status, page: 1 }));
  const setChainCode = (chainCode?: string) => setFilters(prev => ({ ...prev, chainCode, page: 1 }));

  return {
    ...state,
    refetch: fetchSweeps,
    setPage,
    setStatus,
    setChainCode,
  };
}

// =============================================================================
// STATS HOOK
// =============================================================================

export function useDepositsWithdrawalsStats() {
  const [stats, setStats] = useState<DepositsWithdrawalsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await depositsWithdrawalsService.getStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, error, refetch: fetchStats };
}

// =============================================================================
// SWEEPER STATUS HOOK
// =============================================================================

export function useSweeperStatus() {
  const [status, setStatus] = useState<SweeperStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await depositsWithdrawalsService.getSweeperStatus();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sweeper status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, isLoading, error, refetch: fetchStatus };
}

// =============================================================================
// COMBINED HOOK (for convenience)
// =============================================================================

interface UseDepositsWithdrawalsOptions {
  depositsPageSize?: number;
  withdrawalsPageSize?: number;
  sweepsPageSize?: number;
}

export function useDepositsWithdrawals(options: UseDepositsWithdrawalsOptions = {}) {
  const depositsState = useDeposits({ pageSize: options.depositsPageSize || 20 });
  const withdrawalsState = useWithdrawals({ pageSize: options.withdrawalsPageSize || 20 });
  const sweepsState = useSweeps({ pageSize: options.sweepsPageSize || 20 });
  const statsState = useDepositsWithdrawalsStats();
  const sweeperState = useSweeperStatus();

  const isLoading = depositsState.isLoading || withdrawalsState.isLoading || 
                    sweepsState.isLoading || statsState.isLoading || sweeperState.isLoading;

  const refetchAll = async () => {
    await Promise.all([
      depositsState.refetch(),
      withdrawalsState.refetch(),
      sweepsState.refetch(),
      statsState.refetch(),
      sweeperState.refetch(),
    ]);
  };

  return {
    deposits: depositsState,
    withdrawals: withdrawalsState,
    sweeps: sweepsState,
    stats: statsState.stats,
    sweeperStatus: sweeperState.status,
    isLoading,
    refetchAll,
  };
}
