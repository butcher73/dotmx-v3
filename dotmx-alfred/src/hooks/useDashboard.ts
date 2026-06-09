'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  dashboardService, 
  type DashboardStats, 
  type VolumeDataPoint, 
  type RecentTransaction 
} from '@/services/dashboard';

interface UseDashboardState {
  stats: DashboardStats | null;
  volumeData: VolumeDataPoint[];
  recentTransactions: RecentTransaction[];
  isLoading: boolean;
  error: string | null;
}

export function useDashboard() {
  const [state, setState] = useState<UseDashboardState>({
    stats: null,
    volumeData: [],
    recentTransactions: [],
    isLoading: true,
    error: null
  });

  const fetchDashboardData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const [stats, volumeData, recentTransactions] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getVolumeChart(7),
        dashboardService.getRecentTransactions(10)
      ]);
      
      setState({
        stats,
        volumeData,
        recentTransactions,
        isLoading: false,
        error: null
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard data'
      }));
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    ...state,
    refetch: fetchDashboardData
  };
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await dashboardService.getStats();
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

export function useVolumeChart(days: number = 7) {
  const [data, setData] = useState<VolumeDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const volumeData = await dashboardService.getVolumeChart(days);
      setData(volumeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch volume data');
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

export function useRecentTransactions(limit: number = 10) {
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await dashboardService.getRecentTransactions(limit);
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { transactions, isLoading, error, refetch: fetchData };
}
