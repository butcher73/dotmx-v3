'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import DataTable from '@/components/DataTable';
import { 
  Download, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowDownLeft, 
  ArrowUpRight,
  Zap,
  Activity,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  depositsWithdrawalsService, 
  type Deposit, 
  type Withdrawal, 
  type SweepOperation,
  type DepositsWithdrawalsStats,
  type SweeperStatus
} from '@/services/deposits-withdrawals';

// =============================================================================
// CONSTANTS
// =============================================================================

const CHAIN_EXPLORERS: Record<string, string> = {
  ETH: 'https://etherscan.io',
  SEP: 'https://sepolia.etherscan.io',
  POLYGON: 'https://polygonscan.com',
  BSC: 'https://bscscan.com',
  ARB: 'https://arbiscan.io',
  OP: 'https://optimistic.etherscan.io',
  AVAX: 'https://snowtrace.io',
  BASE: 'https://basescan.org',
  ARBITRUM: 'https://arbiscan.io',
  SOL: 'https://solscan.io',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const formatAmount = (amount: string, symbol: string) => {
  const num = parseFloat(amount);
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M ${symbol}`;
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K ${symbol}`;
  return `${num.toFixed(6)} ${symbol}`;
};

const formatUSD = (value: string) => {
  const num = parseFloat(value);
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

const truncateAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const truncateTxHash = (hash: string) => {
  if (!hash) return '';
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
};

const getExplorerTxUrl = (chainCode: string, txHash: string) => {
  const base = CHAIN_EXPLORERS[chainCode] || CHAIN_EXPLORERS.ETH;
  return `${base}/tx/${txHash}`;
};

const getExplorerAddressUrl = (chainCode: string, address: string) => {
  const base = CHAIN_EXPLORERS[chainCode] || CHAIN_EXPLORERS.ETH;
  return `${base}/address/${address}`;
};

// =============================================================================
// COMPONENTS
// =============================================================================

const StatusBadge = ({ status }: { status: string }) => {
  const statusColors: Record<string, string> = {
    // Deposits
    pending: 'bg-yellow-100 text-yellow-700',
    confirming: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-green-100 text-green-700',
    swept: 'bg-purple-100 text-purple-700',
    // Withdrawals
    pending_approval: 'bg-orange-100 text-orange-700',
    approved: 'bg-blue-100 text-blue-700',
    processing: 'bg-blue-100 text-blue-700',
    broadcasted: 'bg-purple-100 text-purple-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-700',
    rejected: 'bg-red-100 text-red-700',
    // Sweeps
    gas_sent: 'bg-yellow-100 text-yellow-700',
    broadcasting: 'bg-blue-100 text-blue-700',
    // Common
    failed: 'bg-red-100 text-red-700',
  };

  const displayText = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-700'}`}>
      {displayText}
    </span>
  );
};

const Tab = ({ 
  active, 
  onClick, 
  children, 
  count 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode; 
  count?: number;
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
      active 
        ? 'bg-white text-black' 
        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
    }`}
  >
    {children}
    {count !== undefined && count > 0 && (
      <span className={`px-1.5 py-0.5 rounded text-xs ${active ? 'bg-zinc-200' : 'bg-zinc-800'}`}>
        {count}
      </span>
    )}
  </button>
);

const Pagination = ({ 
  page, 
  totalPages, 
  onPageChange 
}: { 
  page: number; 
  totalPages: number; 
  onPageChange: (page: number) => void; 
}) => (
  <div className="flex items-center justify-between mt-4 text-sm">
    <span className="text-zinc-500">Page {page} of {totalPages}</span>
    <div className="flex gap-2">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function DepositsWithdrawalsPage() {
  // State
  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals' | 'sweeps'>('deposits');
  const [stats, setStats] = useState<DepositsWithdrawalsStats | null>(null);
  const [sweeperStatus, setSweeperStatus] = useState<SweeperStatus | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [sweeps, setSweeps] = useState<SweepOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [depositsPage, setDepositsPage] = useState(1);
  const [withdrawalsPage, setWithdrawalsPage] = useState(1);
  const [sweepsPage, setSweepsPage] = useState(1);
  const [depositsTotalPages, setDepositsTotalPages] = useState(1);
  const [withdrawalsTotalPages, setWithdrawalsTotalPages] = useState(1);
  const [sweepsTotalPages, setSweepsTotalPages] = useState(1);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [chainFilter, setChainFilter] = useState<string>('');
  
  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  const fetchStats = useCallback(async () => {
    try {
      const data = await depositsWithdrawalsService.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchSweeperStatus = useCallback(async () => {
    try {
      const data = await depositsWithdrawalsService.getSweeperStatus();
      setSweeperStatus(data);
    } catch (err) {
      console.error('Failed to fetch sweeper status:', err);
    }
  }, []);

  const fetchDeposits = useCallback(async () => {
    try {
      const response = await depositsWithdrawalsService.getDeposits({
        page: depositsPage,
        pageSize: 20,
        status: statusFilter || undefined,
        chainCode: chainFilter || undefined,
      });
      setDeposits(response.data);
      setDepositsTotalPages(response.pagination.totalPages);
    } catch (err) {
      console.error('Failed to fetch deposits:', err);
      setError('Failed to load deposits');
    }
  }, [depositsPage, statusFilter, chainFilter]);

  const fetchWithdrawals = useCallback(async () => {
    try {
      const response = await depositsWithdrawalsService.getWithdrawals({
        page: withdrawalsPage,
        pageSize: 20,
        status: statusFilter || undefined,
        chainCode: chainFilter || undefined,
      });
      setWithdrawals(response.data);
      setWithdrawalsTotalPages(response.pagination.totalPages);
    } catch (err) {
      console.error('Failed to fetch withdrawals:', err);
      setError('Failed to load withdrawals');
    }
  }, [withdrawalsPage, statusFilter, chainFilter]);

  const fetchSweeps = useCallback(async () => {
    try {
      const response = await depositsWithdrawalsService.getSweeps({
        page: sweepsPage,
        pageSize: 20,
        status: statusFilter || undefined,
        chainCode: chainFilter || undefined,
      });
      setSweeps(response.data);
      setSweepsTotalPages(response.pagination.totalPages);
    } catch (err) {
      console.error('Failed to fetch sweeps:', err);
      setError('Failed to load sweep operations');
    }
  }, [sweepsPage, statusFilter, chainFilter]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchSweeperStatus()]);
      setLoading(false);
    };
    loadData();
  }, [fetchStats, fetchSweeperStatus]);

  // Load tab-specific data
  useEffect(() => {
    const loadTabData = async () => {
      setLoading(true);
      setError(null);
      
      switch (activeTab) {
        case 'deposits':
          await fetchDeposits();
          break;
        case 'withdrawals':
          await fetchWithdrawals();
          break;
        case 'sweeps':
          await fetchSweeps();
          break;
      }
      
      setLoading(false);
    };
    loadTabData();
  }, [activeTab, fetchDeposits, fetchWithdrawals, fetchSweeps]);

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchStats(),
      fetchSweeperStatus(),
      activeTab === 'deposits' ? fetchDeposits() : null,
      activeTab === 'withdrawals' ? fetchWithdrawals() : null,
      activeTab === 'sweeps' ? fetchSweeps() : null,
    ]);
    setRefreshing(false);
  };

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  const handleApproveWithdrawal = async (id: string) => {
    setActionLoading(id);
    try {
      await depositsWithdrawalsService.approveWithdrawal(id);
      await fetchWithdrawals();
      await fetchStats();
    } catch (err) {
      console.error('Failed to approve withdrawal:', err);
      setError('Failed to approve withdrawal');
    }
    setActionLoading(null);
  };

  const handleRejectWithdrawal = async (id: string) => {
    const reason = prompt('Enter rejection reason (optional):');
    setActionLoading(id);
    try {
      await depositsWithdrawalsService.rejectWithdrawal(id, reason || undefined);
      await fetchWithdrawals();
      await fetchStats();
    } catch (err) {
      console.error('Failed to reject withdrawal:', err);
      setError('Failed to reject withdrawal');
    }
    setActionLoading(null);
  };

  // ==========================================================================
  // COLUMN DEFINITIONS
  // ==========================================================================

  const depositColumns = [
    { 
      key: 'id', 
      label: 'ID',
      render: (value: string) => (
        <span className="font-mono text-xs text-zinc-400">{value.slice(0, 8)}...</span>
      )
    },
    { key: 'userEmail', label: 'User' },
    { 
      key: 'chainCode', 
      label: 'Chain',
      render: (value: string) => (
        <span className="px-2 py-1 rounded bg-zinc-800 text-xs font-medium">{value}</span>
      )
    },
    { 
      key: 'tokenSymbol', 
      label: 'Amount',
      render: (value: string, row: Deposit) => (
        <span className="font-medium">{formatAmount(row.amount, value)}</span>
      )
    },
    { 
      key: 'txHash', 
      label: 'Tx Hash', 
      render: (value: string, row: Deposit) => (
        <a 
          href={getExplorerTxUrl(row.chainCode, value)} 
          target="_blank" 
          rel="noopener noreferrer"
          className="font-mono text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          {truncateTxHash(value)}
          <ExternalLink className="w-3 h-3" />
        </a>
      )
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (value: string) => <StatusBadge status={value} />
    },
    { 
      key: 'confirmations', 
      label: 'Confirmations',
      render: (value: number, row: Deposit) => (
        <span className={`text-sm ${value >= row.requiredConfirmations ? 'text-green-400' : 'text-yellow-400'}`}>
          {value}/{row.requiredConfirmations}
        </span>
      )
    },
    { 
      key: 'detectedAt', 
      label: 'Detected',
      render: (value: string) => (
        <span className="text-xs text-zinc-400">{formatDate(value)}</span>
      )
    },
  ];

  const withdrawalColumns = [
    { 
      key: 'id', 
      label: 'ID',
      render: (value: string) => (
        <span className="font-mono text-xs text-zinc-400">{value.slice(0, 8)}...</span>
      )
    },
    { key: 'userEmail', label: 'User' },
    { 
      key: 'chainCode', 
      label: 'Chain',
      render: (value: string) => (
        <span className="px-2 py-1 rounded bg-zinc-800 text-xs font-medium">{value}</span>
      )
    },
    { 
      key: 'tokenSymbol', 
      label: 'Amount',
      render: (value: string, row: Withdrawal) => (
        <div>
          <span className="font-medium">{formatAmount(row.amount, value)}</span>
          <span className="text-xs text-zinc-500 block">Fee: {formatAmount(row.feeAmount, value)}</span>
        </div>
      )
    },
    { 
      key: 'destinationAddress', 
      label: 'Destination', 
      render: (value: string, row: Withdrawal) => (
        <a 
          href={getExplorerAddressUrl(row.chainCode, value)} 
          target="_blank" 
          rel="noopener noreferrer"
          className="font-mono text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          {truncateAddress(value)}
          <ExternalLink className="w-3 h-3" />
        </a>
      )
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (value: string) => <StatusBadge status={value} />
    },
    { 
      key: 'txHash', 
      label: 'Tx Hash',
      render: (value: string | null, row: Withdrawal) => value ? (
        <a 
          href={getExplorerTxUrl(row.chainCode, value)} 
          target="_blank" 
          rel="noopener noreferrer"
          className="font-mono text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          {truncateTxHash(value)}
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className="text-xs text-zinc-500">Pending</span>
      )
    },
    { 
      key: 'createdAt', 
      label: 'Created',
      render: (value: string) => (
        <span className="text-xs text-zinc-400">{formatDate(value)}</span>
      )
    },
    { 
      key: 'actions', 
      label: 'Actions',
      render: (_: unknown, row: Withdrawal) => {
        if (row.status !== 'pending_approval') return null;
        return (
          <div className="flex gap-2">
            <button 
              onClick={() => handleApproveWithdrawal(row.id)}
              disabled={actionLoading === row.id}
              className="p-1.5 rounded bg-green-900/50 text-green-400 hover:bg-green-900 disabled:opacity-50"
              title="Approve"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
            <button 
              onClick={() => handleRejectWithdrawal(row.id)}
              disabled={actionLoading === row.id}
              className="p-1.5 rounded bg-red-900/50 text-red-400 hover:bg-red-900 disabled:opacity-50"
              title="Reject"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        );
      }
    },
  ];

  const sweepColumns = [
    { 
      key: 'id', 
      label: 'ID',
      render: (value: string) => (
        <span className="font-mono text-xs text-zinc-400">{value.slice(0, 8)}...</span>
      )
    },
    { 
      key: 'chainCode', 
      label: 'Chain',
      render: (value: string) => (
        <span className="px-2 py-1 rounded bg-zinc-800 text-xs font-medium">{value}</span>
      )
    },
    { 
      key: 'tokenSymbol', 
      label: 'Amount',
      render: (value: string, row: SweepOperation) => (
        <span className="font-medium">{formatAmount(row.amount, value)}</span>
      )
    },
    { 
      key: 'fromAddress', 
      label: 'From', 
      render: (value: string, row: SweepOperation) => (
        <a 
          href={getExplorerAddressUrl(row.chainCode, value)} 
          target="_blank" 
          rel="noopener noreferrer"
          className="font-mono text-xs text-blue-400 hover:text-blue-300"
        >
          {truncateAddress(value)}
        </a>
      )
    },
    { 
      key: 'toAddress', 
      label: 'To (Hot Wallet)', 
      render: (value: string, row: SweepOperation) => (
        <a 
          href={getExplorerAddressUrl(row.chainCode, value)} 
          target="_blank" 
          rel="noopener noreferrer"
          className="font-mono text-xs text-green-400 hover:text-green-300"
        >
          {truncateAddress(value)}
        </a>
      )
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (value: string) => <StatusBadge status={value} />
    },
    { 
      key: 'txHash', 
      label: 'Tx Hash',
      render: (value: string | null, row: SweepOperation) => value ? (
        <a 
          href={getExplorerTxUrl(row.chainCode, value)} 
          target="_blank" 
          rel="noopener noreferrer"
          className="font-mono text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          {truncateTxHash(value)}
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className="text-xs text-zinc-500">-</span>
      )
    },
    { 
      key: 'totalGasCost', 
      label: 'Gas Cost',
      render: (value: string | null) => (
        <span className="text-xs text-zinc-400">{value ? `${parseFloat(value).toFixed(6)}` : '-'}</span>
      )
    },
    { 
      key: 'scheduledAt', 
      label: 'Scheduled',
      render: (value: string) => (
        <span className="text-xs text-zinc-400">{formatDate(value)}</span>
      )
    },
  ];

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar />
      
      <div className="flex-1">
        <Header />
        
        <main className="p-8">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Deposits & Withdrawals</h1>
              <p className="text-zinc-500 text-sm mt-1.5">Monitor and manage deposits, withdrawals, and sweep operations</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            <div className="bg-zinc-950 rounded-2xl border border-zinc-900 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-green-900/30">
                  <ArrowDownLeft className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Deposits Today</p>
              </div>
              <p className="text-2xl font-semibold tracking-tight text-green-500">
                {stats?.totalDepositsToday || 0}
              </p>
              <p className="text-xs text-zinc-500 mt-1">{stats ? formatUSD(stats.totalDepositsValueToday) : '$0'}</p>
            </div>
            
            <div className="bg-zinc-950 rounded-2xl border border-zinc-900 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-900/30">
                  <ArrowUpRight className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Withdrawals Today</p>
              </div>
              <p className="text-2xl font-semibold tracking-tight text-blue-500">
                {stats?.totalWithdrawalsToday || 0}
              </p>
              <p className="text-xs text-zinc-500 mt-1">{stats ? formatUSD(stats.totalWithdrawalsValueToday) : '$0'}</p>
            </div>
            
            <div className="bg-zinc-950 rounded-2xl border border-zinc-900 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-yellow-900/30">
                  <Clock className="w-5 h-5 text-yellow-500" />
                </div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Pending</p>
              </div>
              <div className="flex items-baseline gap-3">
                <div>
                  <p className="text-xl font-semibold text-yellow-500">{stats?.pendingDeposits || 0}</p>
                  <p className="text-xs text-zinc-500">Deposits</p>
                </div>
                <div>
                  <p className="text-xl font-semibold text-orange-500">{stats?.pendingApprovals || 0}</p>
                  <p className="text-xs text-zinc-500">Approvals</p>
                </div>
              </div>
            </div>
            
            <div className="bg-zinc-950 rounded-2xl border border-zinc-900 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-purple-900/30">
                  <Zap className="w-5 h-5 text-purple-500" />
                </div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Sweeps</p>
              </div>
              <p className="text-2xl font-semibold tracking-tight text-purple-500">
                {stats?.pendingSweeps || 0}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Pending sweeps</p>
            </div>
            
            <div className="bg-zinc-950 rounded-2xl border border-zinc-900 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-purple-900/30">
                  {parseFloat(stats?.netFlowToday || '0') >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-purple-500" />
                  )}
                </div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Net Flow</p>
              </div>
              <p className={`text-2xl font-semibold tracking-tight ${
                parseFloat(stats?.netFlowToday || '0') >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {stats ? (parseFloat(stats.netFlowToday) >= 0 ? '+' : '') + formatUSD(stats.netFlowToday) : '$0'}
              </p>
            </div>
          </div>

          {/* Sweeper Status Card */}
          <div className="bg-zinc-950 rounded-2xl border border-zinc-900 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${sweeperStatus?.isRunning ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                  <Zap className={`w-5 h-5 ${sweeperStatus?.isRunning ? 'text-green-500' : 'text-red-500'}`} />
                </div>
                <div>
                  <p className="font-medium text-white">Sweeper Service</p>
                  <p className="text-xs text-zinc-500">
                    {sweeperStatus?.isRunning ? 'Running' : 'Stopped'} • 
                    Last run: {sweeperStatus?.lastRunAt ? formatDate(sweeperStatus.lastRunAt) : 'Never'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">{sweeperStatus?.pendingToSweep || 0}</p>
                  <p className="text-xs text-zinc-500">To Sweep</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-green-500">{sweeperStatus?.operationsCompleted24h || 0}</p>
                  <p className="text-xs text-zinc-500">Completed (24h)</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-red-500">{sweeperStatus?.operationsFailed24h || 0}</p>
                  <p className="text-xs text-zinc-500">Failed (24h)</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">{sweeperStatus?.totalSwept24h || '0'}</p>
                  <p className="text-xs text-zinc-500">Total Swept (24h)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Approval Alert */}
          {stats && stats.pendingApprovals > 0 && (
            <div className="bg-yellow-950/30 border border-yellow-900/50 rounded-2xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-400">Pending Approval Required</p>
                <p className="text-sm text-yellow-500/80 mt-1">
                  {stats.pendingApprovals} withdrawal{stats.pendingApprovals > 1 ? 's' : ''} require manual approval
                </p>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-4 mb-6 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-400">Error</p>
                <p className="text-sm text-red-500/80 mt-1">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-500 hover:text-red-400">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-6 bg-zinc-950 rounded-xl p-1.5 border border-zinc-900 w-fit">
            <Tab 
              active={activeTab === 'deposits'} 
              onClick={() => setActiveTab('deposits')}
              count={stats?.pendingDeposits}
            >
              <ArrowDownLeft className="w-4 h-4" />
              Deposits
            </Tab>
            <Tab 
              active={activeTab === 'withdrawals'} 
              onClick={() => setActiveTab('withdrawals')}
              count={stats?.pendingApprovals}
            >
              <ArrowUpRight className="w-4 h-4" />
              Withdrawals
            </Tab>
            <Tab 
              active={activeTab === 'sweeps'} 
              onClick={() => setActiveTab('sweeps')}
              count={stats?.pendingSweeps}
            >
              <Activity className="w-4 h-4" />
              Sweep Operations
            </Tab>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-6">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-zinc-700"
            >
              <option value="">All Statuses</option>
              {activeTab === 'deposits' && (
                <>
                  <option value="pending">Pending</option>
                  <option value="confirming">Confirming</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="swept">Swept</option>
                  <option value="failed">Failed</option>
                </>
              )}
              {activeTab === 'withdrawals' && (
                <>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="processing">Processing</option>
                  <option value="broadcasted">Broadcasted</option>
                  <option value="confirming">Confirming</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="rejected">Rejected</option>
                  <option value="failed">Failed</option>
                </>
              )}
              {activeTab === 'sweeps' && (
                <>
                  <option value="pending">Pending</option>
                  <option value="gas_sent">Gas Sent</option>
                  <option value="broadcasting">Broadcasting</option>
                  <option value="confirming">Confirming</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </>
              )}
            </select>

            <select
              value={chainFilter}
              onChange={(e) => setChainFilter(e.target.value)}
              className="px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:outline-none focus:border-zinc-700"
            >
              <option value="">All Chains</option>
              <option value="ETH">Ethereum</option>
              <option value="SEP">Sepolia</option>
              <option value="POLYGON">Polygon</option>
              <option value="BSC">BNB Chain</option>
              <option value="ARBITRUM">Arbitrum</option>
              <option value="BASE">Base</option>
              <option value="SOL">Solana</option>
            </select>

            <button className="flex items-center gap-2 px-4 py-2.5 border border-zinc-800 text-zinc-400 rounded-xl hover:bg-zinc-900 text-sm transition-colors ml-auto">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

          {/* Data Table */}
          <div className="bg-zinc-950 rounded-2xl border border-zinc-900">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                <span className="ml-3 text-zinc-500">Loading...</span>
              </div>
            ) : (
              <>
                {activeTab === 'deposits' && (
                  <>
                    <DataTable columns={depositColumns} data={deposits} />
                    {depositsTotalPages > 1 && (
                      <div className="px-6 pb-4">
                        <Pagination 
                          page={depositsPage} 
                          totalPages={depositsTotalPages}
                          onPageChange={setDepositsPage}
                        />
                      </div>
                    )}
                  </>
                )}
                
                {activeTab === 'withdrawals' && (
                  <>
                    <DataTable columns={withdrawalColumns} data={withdrawals} />
                    {withdrawalsTotalPages > 1 && (
                      <div className="px-6 pb-4">
                        <Pagination 
                          page={withdrawalsPage} 
                          totalPages={withdrawalsTotalPages}
                          onPageChange={setWithdrawalsPage}
                        />
                      </div>
                    )}
                  </>
                )}
                
                {activeTab === 'sweeps' && (
                  <>
                    <DataTable columns={sweepColumns} data={sweeps} />
                    {sweepsTotalPages > 1 && (
                      <div className="px-6 pb-4">
                        <Pagination 
                          page={sweepsPage} 
                          totalPages={sweepsTotalPages}
                          onPageChange={setSweepsPage}
                        />
                      </div>
                    )}
                  </>
                )}
                
                {/* Empty state */}
                {((activeTab === 'deposits' && deposits.length === 0) ||
                  (activeTab === 'withdrawals' && withdrawals.length === 0) ||
                  (activeTab === 'sweeps' && sweeps.length === 0)) && !loading && (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                    <Activity className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No {activeTab} found</p>
                    <p className="text-sm mt-1">Try adjusting your filters or check back later</p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
