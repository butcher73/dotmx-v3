'use client';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import DataTable from '@/components/DataTable';
import { Users, TrendingUp, DollarSign, Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useDashboard } from '@/hooks/useDashboard';

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

function formatCurrency(num: number): string {
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(1)}K`;
  }
  return `$${num.toFixed(2)}`;
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
  return `${Math.floor(diffMins / 1440)} days ago`;
}

export default function Home() {
  const { stats, volumeData, recentTransactions, isLoading, error, refetch } = useDashboard();

  const columns = [
    { key: 'id', label: 'Transaction ID' },
    { key: 'userEmail', label: 'User' },
    { key: 'type', label: 'Type', render: (value: string) => (
      <span className={`px-2 py-1 rounded text-xs font-medium ${
        value === 'deposit' || value === 'trade' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}>
        {value.charAt(0).toUpperCase() + value.slice(1)}
      </span>
    )},
    { key: 'currency', label: 'Currency' },
    { key: 'amount', label: 'Amount', render: (value: number) => value.toFixed(4) },
    { key: 'status', label: 'Status', render: (value: string) => (
      <span className={`px-2 py-1 rounded text-xs font-medium ${
        value === 'completed' ? 'bg-blue-100 text-blue-700' : 
        value === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
        'bg-red-100 text-red-700'
      }`}>
        {value.charAt(0).toUpperCase() + value.slice(1)}
      </span>
    )},
    { key: 'createdAt', label: 'Time', render: (value: string) => formatTimeAgo(value) },
  ];

  // Format volume data for chart
  const chartData = volumeData.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    volume: item.volume
  }));

  if (error) {
    return (
      <div className="flex min-h-screen bg-black">
        <Sidebar />
        <div className="flex-1">
          <Header />
          <main className="p-8">
            <div className="flex flex-col items-center justify-center h-[60vh]">
              <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Failed to load dashboard</h2>
              <p className="text-zinc-500 mb-4">{error}</p>
              <button 
                onClick={refetch}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar />
      
      <div className="flex-1">
        <Header />
        
        <main className="p-8">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">Overview</h1>
              <p className="text-zinc-500 mt-1.5 text-sm">Monitor your exchange performance and activities</p>
            </div>
            <button 
              onClick={refetch}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Users"
              value={isLoading ? '...' : (stats?.totalUsers.toLocaleString() || '0')}
              change={stats?.activeUsers ? `${stats.activeUsers.toLocaleString()} active` : ''}
              changeType="positive"
              icon={Users}
            />
            <StatCard
              title="24h Volume"
              value={isLoading ? '...' : formatCurrency(stats?.totalVolume24h || 0)}
              change="Last 24 hours"
              changeType="positive"
              icon={TrendingUp}
            />
            <StatCard
              title="Total Balance"
              value={isLoading ? '...' : formatCurrency(stats?.totalBalance || 0)}
              change="Platform total"
              changeType="positive"
              icon={DollarSign}
            />
            <StatCard
              title="Active Trades"
              value={isLoading ? '...' : (stats?.activeTrades.toLocaleString() || '0')}
              change={stats?.pendingKyc ? `${stats.pendingKyc} pending KYC` : ''}
              changeType="neutral"
              icon={Activity}
            />
          </div>

          {/* Trading Volume Chart */}
          <div className="bg-surface rounded-2xl border border-border p-6 mb-8">
            <h2 className="text-base font-semibold text-text-primary mb-6">Trading Volume (7 Days)</h2>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-zinc-500 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" />
                  <YAxis stroke="#71717a" tickFormatter={(value) => formatNumber(value)} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value: number | undefined) => [formatCurrency(value || 0), 'Volume']}
                  />
                  <Line type="monotone" dataKey="volume" stroke="#06b6d4" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Recent Transactions */}
          <div>
            <h2 className="text-base font-semibold text-text-primary mb-6">Recent Transactions</h2>
            {isLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-zinc-500 animate-spin" />
              </div>
            ) : (
              <DataTable columns={columns} data={recentTransactions} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
