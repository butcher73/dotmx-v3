'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import DataTable from '@/components/DataTable';
import EditUserModal from '@/components/EditUserModal';
import { Download, UserPlus, Search, Loader2, RefreshCw, Edit2 } from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { usersService, type UserDetail } from '@/services/users';

export default function UsersPage() {
  const { users, pagination, isLoading, error, refetch, setPage, setSearch, setStatus } = useUsers({ pageSize: 20 });
  const [searchInput, setSearchInput] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format relative time
  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return formatDate(dateString);
  };

  // Transform users for table display
  const tableData = users.map(user => ({
    id: user.id, // Keep full ID for lookups
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || '-',
    status: user.status,
    kyc: user.kycStatus,
    role: user.role,
    registered: formatDate(user.createdAt),
    lastActive: formatRelativeTime(user.lastLoginAt),
  }));

  const columns = [
    {
      key: 'id',
      label: 'ID',
      render: (value: string) => value.slice(0, 8) // Only display first 8 chars
    },
    { key: 'email', label: 'Email' },
    { key: 'name', label: 'Name' },
    {
      key: 'role', label: 'Role',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${value === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-zinc-100 text-zinc-700'
          }`}>
          {value}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${value === 'active' ? 'bg-green-100 text-green-700' :
          value === 'suspended' ? 'bg-red-100 text-red-700' :
            value === 'banned' ? 'bg-red-200 text-red-800' :
              value === 'deleted' ? 'bg-gray-200 text-gray-600' :
                'bg-zinc-100 text-zinc-700'
          }`}>
          {value}
        </span>
      )
    },
    {
      key: 'kyc',
      label: 'KYC Status',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${value === 'approved' ? 'bg-blue-100 text-blue-700' :
          value === 'pending' ? 'bg-yellow-100 text-yellow-700' :
            value === 'rejected' ? 'bg-red-100 text-red-700' :
              'bg-zinc-100 text-zinc-700'
          }`}>
          {value === 'none' ? 'Not Started' : value}
        </span>
      )
    },
    { key: 'registered', label: 'Registered' },
    { key: 'lastActive', label: 'Last Active' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEditUser(row.id); // Use full ID from row
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" />
          Edit
        </button>
      )
    },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setStatus(status || undefined);
  };

  const handleEditUser = async (userId: string) => {
    setIsLoadingUser(true);
    try {
      const userDetail = await usersService.getUser(userId);
      setSelectedUser(userDetail);
      setIsEditModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch user details:', err);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const handleModalClose = () => {
    setIsEditModalOpen(false);
    setSelectedUser(null);
  };

  const handleUpdateSuccess = () => {
    refetch();
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex-1">
        <Header />

        <main className="p-8">
          <div className="mb-10">
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Users</h1>
            <p className="text-text-tertiary mt-1.5 text-sm">Manage and monitor platform users</p>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-64 border border-border rounded-xl bg-surface text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </form>

              <select
                value={selectedStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-4 py-2.5 border border-border rounded-xl bg-surface text-text-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
                <option value="deleted">Deleted</option>
              </select>

              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 px-4 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-hover transition-all duration-200 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all duration-200 text-sm font-medium">
                <UserPlus className="w-4 h-4" />
                Add User
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-hover transition-all duration-200 text-sm">
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
              {/* Users Table */}
              <DataTable
                columns={columns}
                data={tableData}
                onRowClick={(user) => console.log('User clicked:', user)}
              />

              {/* Pagination */}
              {pagination && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-xs text-text-tertiary font-medium">
                    Showing {((pagination.page - 1) * pagination.pageSize) + 1}-{Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems.toLocaleString()} users
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="px-3 py-1.5 border border-border text-text-secondary rounded-lg hover:bg-hover text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${pagination.page === pageNum
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border text-text-secondary hover:bg-hover'
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setPage(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-3 py-1.5 border border-border text-text-secondary rounded-lg hover:bg-hover text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Edit User Modal */}
      {selectedUser && (
        <EditUserModal
          key={selectedUser.id}
          user={selectedUser}
          isOpen={isEditModalOpen}
          onClose={handleModalClose}
          onSuccess={handleUpdateSuccess}
        />
      )}
    </div>
  );
}
