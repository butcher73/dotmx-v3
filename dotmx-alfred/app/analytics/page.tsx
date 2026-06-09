'use client';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, DollarSign, Activity, RefreshCw, Loader2 } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { useAnalytics } from '@/hooks/useAnalytics';

// Helper function to format currency
const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(0)}K`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatNumber = (value: number): string => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toLocaleString();
};

export default function AnalyticsPage() {
  const { 
    stats, 
    userGrowth, 
    assetDistribution, 
    topTradingPairs, 
    revenue, 
    systemHealth, 
    isLoading, 
    error,
    refetch 
  } = useAnalytics();
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1">
        <Header />
        
        <main className="p-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Analytics</h1>
              <p className="text-text-tertiary text-sm mt-1.5">Comprehensive insights into exchange performance</p>
            </div>
            <button 
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-hover text-sm transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
                <StatCard
                  title="Monthly Revenue"
                  value={stats ? formatCurrency(stats.monthlyRevenue) : '$0'}
                  change={stats ? `${stats.revenueChange >= 0 ? '+' : ''}${stats.revenueChange}% from last month` : ''}
                  changeType={stats && stats.revenueChange >= 0 ? 'positive' : 'negative'}
                  icon={DollarSign}
                />
                <StatCard
                  title="Total Trades"
                  value={stats ? formatNumber(stats.totalTrades) : '0'}
                  change={stats ? `${stats.tradesChange >= 0 ? '+' : ''}${stats.tradesChange}% from last month` : ''}
                  changeType={stats && stats.tradesChange >= 0 ? 'positive' : 'negative'}
                  icon={Activity}
                />
                <StatCard
                  title="Active Users"
                  value={stats ? formatNumber(stats.activeUsers) : '0'}
                  change={stats ? `${stats.usersChange >= 0 ? '+' : ''}${stats.usersChange}% from last month` : ''}
                  changeType={stats && stats.usersChange >= 0 ? 'positive' : 'negative'}
                  icon={Users}
                />
                <StatCard
                  title="Avg Trade Value"
                  value={stats ? formatCurrency(stats.avgTradeValue) : '$0'}
                  change={stats ? `${stats.avgTradeChange >= 0 ? '+' : ''}${stats.avgTradeChange}% from last month` : ''}
                  changeType={stats && stats.avgTradeChange >= 0 ? 'positive' : 'negative'}
                  icon={TrendingUp}
                />
              </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-10">
            {/* User Growth Chart */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h2 className="text-base font-semibold text-text-primary mb-6">User Growth (7 Months)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--text-tertiary)" />
                  <YAxis stroke="var(--text-tertiary)" />
                  <Tooltip />
                  <Bar dataKey="users" fill="var(--primary)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Asset Distribution */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h2 className="text-base font-semibold text-text-primary mb-6">Asset Distribution by Volume</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={assetDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {assetDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h3 className="text-base font-semibold text-text-primary mb-6">Top Trading Pairs by Volume</h3>
              <div className="space-y-3">
                {topTradingPairs.map((item, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-text-secondary">{item.pair}</span>
                      <span className="text-text-tertiary">{item.volume}</span>
                    </div>
                    <div className="w-full bg-hover rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-border p-6">
              <h3 className="text-base font-semibold text-text-primary mb-6">Revenue by Fee Type</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-tertiary">Trading Fees</span>
                  <span className="text-lg font-semibold text-text-primary">
                    {revenue ? formatCurrency(revenue.tradingFees) : '$0'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-tertiary">Withdrawal Fees</span>
                  <span className="text-lg font-semibold text-text-primary">
                    {revenue ? formatCurrency(revenue.withdrawalFees) : '$0'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-tertiary">Listing Fees</span>
                  <span className="text-lg font-semibold text-text-primary">
                    {revenue ? formatCurrency(revenue.listingFees) : '$0'}
                  </span>
                </div>
                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-text-primary">Total Revenue</span>
                    <span className="text-xl font-semibold text-text-primary">
                      {revenue ? formatCurrency(revenue.totalRevenue) : '$0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface rounded-2xl border border-border p-6">
              <h3 className="text-base font-semibold text-text-primary mb-6">System Health</h3>
              <div className="space-y-4">
                {systemHealth.map((metric, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text-secondary">{metric.name}</span>
                      <span className={`font-medium ${
                        metric.status === 'healthy' ? 'text-green-600' : 
                        metric.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
                      }`}>{metric.value}%</span>
                    </div>
                    <div className="w-full bg-hover rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          metric.status === 'healthy' ? 'bg-green-600' : 
                          metric.status === 'warning' ? 'bg-yellow-600' : 'bg-red-600'
                        }`}
                        style={{ width: `${metric.value}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
