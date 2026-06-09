'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import DataTable from '@/components/DataTable';
import { Download, RefreshCw, Loader2 } from 'lucide-react';
import { useTransactions } from '@/hooks/useTransactions';

export default function TransactionsPage() {
  const { transactions, pagination, isLoading, error, refetch, setPage, setType, setStatus } = useTransactions({ pageSize: 20 });
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Transform transactions for table display
  const tableData = transactions.map(tx => ({
    id: tx.id.slice(0, 8),
    user: tx.userEmail,
    type: tx.type,
    currency: tx.currency,
    amount: tx.amount.toFixed(4),
    status: tx.status,
    txHash: tx.txHash ? `${tx.txHash.slice(0, 10)}...` : '-',
    timestamp: formatDate(tx.createdAt),
  }));

  const columns = [
    { key: 'id', label: 'Transaction ID' },
    { key: 'user', label: 'User' },
    { 
      key: 'type', 
      label: 'Type',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value === 'deposit' ? 'bg-green-100 text-green-700' : 
          value === 'withdrawal' ? 'bg-red-100 text-red-700' :
          value === 'trade' ? 'bg-blue-100 text-blue-700' :
          'bg-zinc-100 text-zinc-700'
        }`}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      )
    },
    { key: 'currency', label: 'Currency' },
    { key: 'amount', label: 'Amount' },
    { 
      key: 'status', 
      label: 'Status',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          value === 'completed' ? 'bg-green-100 text-green-700' :
          value === 'pending' ? 'bg-yellow-100 text-yellow-700' :
          value === 'failed' ? 'bg-red-100 text-red-700' :
          'bg-zinc-100 text-zinc-700'
        }`}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      )
    },
    { key: 'txHash', label: 'TX Hash' },
    { key: 'timestamp', label: 'Timestamp' },
  ];

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setType(type || undefined);
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setStatus(status || undefined);
  };

  // Calculate stats from current data
  const completedCount = transactions.filter(t => t.status === 'completed').length;
  const pendingCount = transactions.filter(t => t.status === 'pending').length;
  const failedCount = transactions.filter(t => t.status === 'failed').length;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1">
        <Header />
        
        <main className="p-8">
          <div className="mb-10">
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Transactions</h1>
            <p className="text-text-tertiary mt-1.5 text-sm">Monitor all trading activities in real-time</p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Total Transactions</p>
              <p className="text-3xl font-semibold text-text-primary mt-3 tracking-tight">
                {isLoading ? '...' : pagination?.totalItems.toLocaleString() || '0'}
              </p>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Completed</p>
              <p className="text-3xl font-semibold text-accent-green mt-3 tracking-tight">
                {isLoading ? '...' : completedCount}
              </p>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Pending</p>
              <p className="text-3xl font-semibold text-accent-yellow mt-3 tracking-tight">
                {isLoading ? '...' : pendingCount}
              </p>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Failed</p>
              <p className="text-3xl font-semibold text-accent-red mt-3 tracking-tight">
                {isLoading ? '...' : failedCount}
              </p>
            </div>
          </div>

          {/* Filters & Actions Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <select
                value={selectedType}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="px-4 py-2.5 border border-border rounded-xl bg-surface text-text-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Types</option>
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="trade">Trade</option>
                <option value="fee">Fee</option>
                <option value="transfer">Transfer</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-4 py-2.5 border border-border rounded-xl bg-surface text-text-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <button 
                onClick={() => refetch()}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-hover transition-all duration-200 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all duration-200 text-sm font-medium">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
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
              {/* Transactions Table */}
              <DataTable columns={columns} data={tableData} onRowClick={(tx) => console.log('Transaction:', tx)} />

              {/* Pagination */}
              {pagination && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-text-tertiary">
                    Showing {((pagination.page - 1) * pagination.pageSize) + 1}-{Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems.toLocaleString()} transactions
                  </p>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setPage(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="px-3 py-1.5 border border-border text-text-secondary rounded-lg hover:bg-hover text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                      {pagination.page}
                    </span>
                    <button 
                      onClick={() => setPage(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-3 py-1.5 border border-border text-text-secondary rounded-lg hover:bg-hover text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
