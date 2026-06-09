'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import DataTable from '@/components/DataTable';
import { Download, RefreshCw, Loader2 } from 'lucide-react';
import { useAuditLogs } from '@/hooks/useAuditLogs';

export default function AuditLogsPage() {
  const { logs, pagination, isLoading, error, refetch, setPage, setAction, setDateRange } = useAuditLogs({ pageSize: 50 });
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

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

  // Transform logs for table display
  const tableData = logs.map(log => ({
    timestamp: formatDate(log.createdAt),
    user: log.userEmail || 'System',
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId?.slice(0, 8) || '-',
    details: JSON.stringify(log.details).slice(0, 50) + (JSON.stringify(log.details).length > 50 ? '...' : ''),
    ipAddress: log.ipAddress || '-',
  }));

  const columns = [
    { key: 'timestamp', label: 'Timestamp' },
    { key: 'user', label: 'Admin User' },
    { 
      key: 'action', 
      label: 'Action',
      render: (value: string) => (
        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
          {value}
        </span>
      )
    },
    { key: 'resource', label: 'Resource' },
    { key: 'resourceId', label: 'Resource ID' },
    { key: 'details', label: 'Details' },
    { key: 'ipAddress', label: 'IP Address', render: (value: string) => (
      <span className="font-mono text-xs">{value}</span>
    )},
  ];

  const handleActionChange = (action: string) => {
    setSelectedAction(action);
    setAction(action || undefined);
  };

  const handleApplyFilters = () => {
    setDateRange(fromDate || undefined, toDate || undefined);
  };

  const handleResetFilters = () => {
    setSelectedAction('');
    setFromDate('');
    setToDate('');
    setAction(undefined);
    setDateRange(undefined, undefined);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1">
        <Header />
        
        <main className="p-8">
          <div className="mb-10">
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Audit Logs</h1>
            <p className="text-text-tertiary text-sm mt-1.5">Track all administrative actions and system events</p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-3 mb-10">
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs uppercase tracking-wider text-text-tertiary">Total Events</p>
              <p className="text-3xl font-semibold tracking-tight text-text-primary mt-1">
                {isLoading ? '...' : pagination?.totalItems.toLocaleString() || '0'}
              </p>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs uppercase tracking-wider text-text-tertiary">Current Page</p>
              <p className="text-3xl font-semibold tracking-tight text-text-primary mt-1">
                {isLoading ? '...' : pagination?.page || 1}
              </p>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs uppercase tracking-wider text-text-tertiary">Total Pages</p>
              <p className="text-3xl font-semibold tracking-tight text-text-primary mt-1">
                {isLoading ? '...' : pagination?.totalPages || 0}
              </p>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs uppercase tracking-wider text-text-tertiary">Page Size</p>
              <p className="text-3xl font-semibold tracking-tight text-text-primary mt-1">
                {isLoading ? '...' : pagination?.pageSize || 50}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-surface rounded-2xl border border-border p-6 mb-10">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">From Date</label>
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-primary/20 text-text-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">To Date</label>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-primary/20 text-text-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Action Type</label>
                <select 
                  value={selectedAction}
                  onChange={(e) => handleActionChange(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-primary/20 text-text-primary text-sm"
                >
                  <option value="">All Actions</option>
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button 
                  onClick={handleApplyFilters}
                  className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90"
                >
                  Apply Filters
                </button>
                <button 
                  onClick={handleResetFilters}
                  className="px-4 py-2.5 border border-border text-text-secondary rounded-xl text-sm font-medium hover:bg-hover"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-hover text-sm transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-hover text-sm transition-colors">
              <Download className="w-4 h-4" />
              Export Logs
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
              {/* Audit Logs Table */}
              <DataTable columns={columns} data={tableData} />

              {/* Pagination */}
              {pagination && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-text-tertiary">
                    Showing {((pagination.page - 1) * pagination.pageSize) + 1}-{Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems.toLocaleString()} events
                  </p>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setPage(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="px-4 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-hover text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium">
                      {pagination.page}
                    </span>
                    <button 
                      onClick={() => setPage(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-4 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-hover text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
