/**
 * Dashboard API Service
 */

import { api } from '@/libs/api';

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalVolume24h: number;
  totalBalance: number;
  activeTrades: number;
  pendingKyc: number;
  pendingWithdrawals: number;
}

export interface VolumeDataPoint {
  date: string;
  volume: number;
}

export interface RecentTransaction {
  id: string;
  userEmail: string;
  type: string;
  currency: string;
  amount: number;
  status: string;
  createdAt: string;
}

export const dashboardService = {
  /**
   * Get dashboard statistics
   */
  getStats: () => api.get<DashboardStats>('/dashboard/stats'),
  
  /**
   * Get volume chart data
   */
  getVolumeChart: (days: number = 7) => 
    api.get<VolumeDataPoint[]>('/dashboard/volume-chart', { days }),
  
  /**
   * Get recent transactions
   */
  getRecentTransactions: (limit: number = 10) =>
    api.get<RecentTransaction[]>('/dashboard/recent-transactions', { limit })
};
