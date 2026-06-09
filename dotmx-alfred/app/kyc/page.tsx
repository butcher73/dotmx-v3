'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import DataTable from '@/components/DataTable';
import { CheckCircle, XCircle, Clock, FileText, RefreshCw, Loader2 } from 'lucide-react';
import { useKycApplications } from '@/hooks/useKyc';

export default function KYCPage() {
  const { applications, pagination, isLoading, error, refetch, setPage, setStatus } = useKycApplications({ pageSize: 20 });
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Handle filter change
  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter);
    if (filter === 'all') {
      setStatus(undefined);
    } else if (filter === 'pending') {
      setStatus('pending');
    } else if (filter === 'approved') {
      setStatus('approved');
    } else if (filter === 'rejected') {
      setStatus('rejected');
    } else if (filter === 'under_review') {
      setStatus('under_review');
    }
  };

  // Transform applications for table display
  const tableData = applications.map(app => ({
    id: app.id.slice(0, 8),
    user: app.userEmail,
    level: `Level ${app.level}`,
    documentType: app.documentType,
    status: app.status,
    submitted: formatDate(app.submittedAt),
    reviewedBy: app.reviewedBy || 'Unassigned',
  }));

  const columns = [
    { key: 'id', label: 'Application ID' },
    { key: 'user', label: 'User Email' },
    { key: 'level', label: 'KYC Level' },
    { key: 'documentType', label: 'Document Type' },
    { 
      key: 'status', 
      label: 'Status',
      render: (value: string) => {
        let color = 'bg-zinc-100 text-zinc-700';
        let Icon = Clock;
        let displayText = value.replace(/_/g, ' ');
        
        if (value === 'approved') {
          color = 'bg-green-100 text-green-700';
          Icon = CheckCircle;
        } else if (value === 'rejected') {
          color = 'bg-red-100 text-red-700';
          Icon = XCircle;
        } else if (value === 'pending' || value === 'under_review') {
          color = 'bg-yellow-100 text-yellow-700';
          Icon = Clock;
        }
        
        return (
          <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium capitalize ${color}`}>
            <Icon className="w-3 h-3" />
            {displayText}
          </span>
        );
      }
    },
    { key: 'submitted', label: 'Submitted' },
    { key: 'reviewedBy', label: 'Reviewer' },
  ];

  // Calculate stats from current data
  const pendingCount = applications.filter(a => a.status === 'pending' || a.status === 'under_review').length;
  const approvedCount = applications.filter(a => a.status === 'approved').length;
  const rejectedCount = applications.filter(a => a.status === 'rejected').length;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1">
        <Header />
        
        <main className="p-8">
          <div className="mb-10">
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">KYC Management</h1>
            <p className="text-text-tertiary text-sm mt-1.5">Review and manage user verification applications</p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-3 mb-10">
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs uppercase tracking-wider text-text-tertiary">Total Applications</p>
              <p className="text-3xl font-semibold tracking-tight text-text-primary mt-1">
                {isLoading ? '...' : pagination?.totalItems.toLocaleString() || '0'}
              </p>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs uppercase tracking-wider text-text-tertiary">Pending Review</p>
              <p className="text-3xl font-semibold tracking-tight text-accent-yellow mt-1">
                {isLoading ? '...' : pendingCount}
              </p>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs uppercase tracking-wider text-text-tertiary">Approved</p>
              <p className="text-3xl font-semibold tracking-tight text-accent-green mt-1">
                {isLoading ? '...' : approvedCount}
              </p>
            </div>
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs uppercase tracking-wider text-text-tertiary">Rejected</p>
              <p className="text-3xl font-semibold tracking-tight text-accent-red mt-1">
                {isLoading ? '...' : rejectedCount}
              </p>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-3">
              <button 
                onClick={() => handleFilterChange('all')}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  selectedFilter === 'all' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-transparent border border-border text-text-secondary hover:bg-hover'
                }`}
              >
                All Applications
              </button>
              <button 
                onClick={() => handleFilterChange('pending')}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  selectedFilter === 'pending' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-transparent border border-border text-text-secondary hover:bg-hover'
                }`}
              >
                Pending Review
              </button>
              <button 
                onClick={() => handleFilterChange('approved')}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  selectedFilter === 'approved' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-transparent border border-border text-text-secondary hover:bg-hover'
                }`}
              >
                Approved
              </button>
              <button 
                onClick={() => handleFilterChange('rejected')}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  selectedFilter === 'rejected' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-transparent border border-border text-text-secondary hover:bg-hover'
                }`}
              >
                Rejected
              </button>
            </div>

            <button 
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-hover transition-all duration-200 text-sm"
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
              {/* KYC Applications Table */}
              <DataTable columns={columns} data={tableData} onRowClick={(app) => console.log('Application:', app)} />

              {/* Pagination */}
              {pagination && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-text-tertiary">
                    Showing {((pagination.page - 1) * pagination.pageSize) + 1}-{Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems.toLocaleString()} applications
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
