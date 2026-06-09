'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  analyticsService, 
  type AnalyticsData,
  type AnalyticsStats,
  type UserGrowthDataPoint,
  type AssetDistribution,
  type TopTradingPair,
  type RevenueBreakdown,
  type SystemHealthMetric,
} from '@/services/analytics';

interface UseAnalyticsState {
  stats: AnalyticsStats | null;
  userGrowth: UserGrowthDataPoint[];
  assetDistribution: AssetDistribution[];
  topTradingPairs: TopTradingPair[];
  revenue: RevenueBreakdown | null;
  systemHealth: SystemHealthMetric[];
  isLoading: boolean;
  error: string | null;
}

export function useAnalytics() {
  const [state, setState] = useState<UseAnalyticsState>({
    stats: null,
    userGrowth: [],
    assetDistribution: [],
    topTradingPairs: [],
    revenue: null,
    systemHealth: [],
    isLoading: true,
    error: null,
  });

  const fetchAnalytics = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const data = await analyticsService.getAllAnalytics();
      
      setState({
        stats: data.stats,
        userGrowth: data.userGrowth,
        assetDistribution: data.assetDistribution,
        topTradingPairs: data.topTradingPairs,
        revenue: data.revenue,
        systemHealth: data.systemHealth,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics data',
      }));
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    ...state,
    refetch: fetchAnalytics,
  };
}

export function useAnalyticsStats() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await analyticsService.getStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, error, refetch: fetchStats };
}

export function useUserGrowth(months: number = 7) {
  const [userGrowth, setUserGrowth] = useState<UserGrowthDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserGrowth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await analyticsService.getUserGrowth(months);
      setUserGrowth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user growth');
    } finally {
      setIsLoading(false);
    }
  }, [months]);

  useEffect(() => {
    fetchUserGrowth();
  }, [fetchUserGrowth]);

  return { userGrowth, isLoading, error, refetch: fetchUserGrowth };
}

export function useAssetDistribution() {
  const [assetDistribution, setAssetDistribution] = useState<AssetDistribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssetDistribution = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await analyticsService.getAssetDistribution();
      setAssetDistribution(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch asset distribution');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssetDistribution();
  }, [fetchAssetDistribution]);

  return { assetDistribution, isLoading, error, refetch: fetchAssetDistribution };
}

export function useRevenueBreakdown() {
  const [revenue, setRevenue] = useState<RevenueBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRevenue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await analyticsService.getRevenueBreakdown();
      setRevenue(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch revenue breakdown');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  return { revenue, isLoading, error, refetch: fetchRevenue };
}

export function useSystemHealth() {
  const [systemHealth, setSystemHealth] = useState<SystemHealthMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSystemHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await analyticsService.getSystemHealth();
      setSystemHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch system health');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSystemHealth();
  }, [fetchSystemHealth]);

  return { systemHealth, isLoading, error, refetch: fetchSystemHealth };
}
