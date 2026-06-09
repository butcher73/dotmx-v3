'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import ImageUpload from '@/components/ImageUpload';
import { Plus, X, Search, RefreshCw, Edit2, Trash2, Loader2, Link2, CheckCircle, XCircle, ArrowUpCircle, ArrowDownCircle, AlertCircle } from 'lucide-react';
import { useTokens } from '@/hooks/useTokens';
import { useChains } from '@/hooks/useChains';
import type { Token, CreateTokenParams, AddTokenChainParams } from '@/services/tokens';

// Chain type config for address formats and defaults
const CHAIN_TYPE_CONFIG: Record<string, { 
  label: string; 
  color: string;
  defaultDecimals: number;
  addressPlaceholder: string;
  addressLabel: string;
  supportsContracts: boolean;
}> = {
  EVM: { 
    label: 'EVM', 
    color: 'bg-blue-950/30 text-blue-400 border-blue-900/50',
    defaultDecimals: 18, 
    addressPlaceholder: '0x... (leave empty for native)',
    addressLabel: 'Contract Address',
    supportsContracts: true,
  },
  SOL: { 
    label: 'Solana', 
    color: 'bg-purple-950/30 text-purple-400 border-purple-900/50',
    defaultDecimals: 9, 
    addressPlaceholder: 'Token mint address (e.g., EPjFWdd5...)',
    addressLabel: 'Token Mint Address',
    supportsContracts: true,
  },
  TRON: { 
    label: 'TRON', 
    color: 'bg-red-950/30 text-red-400 border-red-900/50',
    defaultDecimals: 6, 
    addressPlaceholder: 'T... (TRC20 contract, leave empty for native)',
    addressLabel: 'Contract Address',
    supportsContracts: true,
  },
  BTC: { 
    label: 'Bitcoin', 
    color: 'bg-orange-950/30 text-orange-400 border-orange-900/50',
    defaultDecimals: 8, 
    addressPlaceholder: 'N/A — Bitcoin is always native',
    addressLabel: 'Contract Address',
    supportsContracts: false,
  },
  DOGE: { 
    label: 'Dogecoin', 
    color: 'bg-yellow-950/30 text-yellow-400 border-yellow-900/50',
    defaultDecimals: 8, 
    addressPlaceholder: 'N/A — Dogecoin is always native',
    addressLabel: 'Contract Address',
    supportsContracts: false,
  },
};

// Status Badge Component
function StatusBadge({ 
  status, 
  label 
}: { 
  status: boolean; 
  label: React.ReactNode;
}) {
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
      status 
        ? 'bg-green-950/30 text-green-400 border border-green-900/50' 
        : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
    }`}>
      {status ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      {label}
    </div>
  );
}

// Chain Type Badge Component
function ChainTypeBadge({ chainType }: { chainType: string }) {
  const config = CHAIN_TYPE_CONFIG[chainType] || CHAIN_TYPE_CONFIG.EVM;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${config.color}`}>
      {config.label}
    </span>
  );
}

// Toggle Switch Component
function ToggleSwitch({ 
  enabled, 
  onChange, 
  loading = false,
  size = 'md',
  label
}: { 
  enabled: boolean; 
  onChange: () => void;
  loading?: boolean;
  size?: 'sm' | 'md';
  label?: string;
}) {
  const sizeClasses = size === 'sm' ? 'w-9 h-5' : 'w-11 h-6';
  const dotSizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const translateClasses = size === 'sm' ? 'translate-x-4' : 'translate-x-5';

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!loading) onChange();
      }}
      disabled={loading}
      className={`relative inline-flex items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${
        enabled ? 'bg-green-600' : 'bg-zinc-700'
      }`}
      title={label}
    >
      <span
        className={`inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ${dotSizeClasses} ${
          enabled ? translateClasses : 'translate-x-0.5'
        }`}
      >
        {loading && (
          <Loader2 className="w-full h-full animate-spin text-zinc-500 p-0.5" />
        )}
      </span>
    </button>
  );
}

export default function TokensPage() {
  const { tokens, pagination, isLoading, error, refetch, setPage, setSearch, create, update, remove, addChain, updateChain, removeChain } = useTokens({ pageSize: 20 });
  const { chains: allChains } = useChains({ pageSize: 100 });
  
  const [searchInput, setSearchInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showChainsModal, setShowChainsModal] = useState(false);
  const [editingToken, setEditingToken] = useState<Token | null>(null);
  const [managingToken, setManagingToken] = useState<Token | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingChains, setTogglingChains] = useState<Record<string, string[]>>({});
  const [togglingTokens, setTogglingTokens] = useState<Set<string>>(new Set());
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  // Form state
  const [tokenFormData, setTokenFormData] = useState<CreateTokenParams>({
    symbol: '',
    name: '',
    logoUrl: '',
    coingeckoId: '',
    isStablecoin: false,
    sortOrder: 0,
    chains: []
  });

  const [chainFormData, setChainFormData] = useState<AddTokenChainParams>({
    chainId: '',
    contractAddress: '',
    decimals: 18,
    isNative: false,
    isActive: true,
    depositEnabled: true,
    withdrawalEnabled: true,
    minDeposit: 0,
    minWithdrawal: 0,
    withdrawalFee: 0,
    withdrawalFeeType: 'fixed'
  });

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const openCreateModal = () => {
    setEditingToken(null);
    setTokenFormData({
      symbol: '',
      name: '',
      logoUrl: '',
      coingeckoId: '',
      isStablecoin: false,
      sortOrder: 0,
      chains: []
    });
    setShowCreateModal(true);
  };

  const openEditModal = (token: Token) => {
    setEditingToken(token);
    setTokenFormData({
      symbol: token.symbol,
      name: token.name,
      logoUrl: token.logoUrl || '',
      coingeckoId: token.coingeckoId || '',
      isStablecoin: token.isStablecoin,
      sortOrder: token.sortOrder
    });
    setShowEditModal(true);
  };

  const openChainsModal = (token: Token) => {
    setManagingToken(token);
    setModalSuccess(null);
    setChainFormData({
      chainId: '',
      contractAddress: '',
      decimals: 18,
      isNative: false,
      isActive: true,
      depositEnabled: true,
      withdrawalEnabled: true,
      minDeposit: 0,
      minWithdrawal: 0,
      withdrawalFee: 0,
      withdrawalFeeType: 'fixed'
    });
    setShowChainsModal(true);
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingToken) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { symbol, chains, ...updateData } = tokenFormData;
        await update(editingToken.id, updateData);
        setSaveSuccess(editingToken ? 'Token updated successfully!' : 'Token created successfully!');
        setTimeout(() => setSaveSuccess(null), 3000);
        setShowEditModal(false);
        setEditingToken(null);
      } else {
        await create(tokenFormData);
        setSaveSuccess('Token created successfully!');
        setTimeout(() => setSaveSuccess(null), 3000);
        setShowCreateModal(false);
      }
      await refetch();
    } catch (err) {
      console.error('Failed to save token:', err);
      alert(err instanceof Error ? err.message : 'Failed to save token');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddChainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingToken) return;
    
    const chainName = allChains.find(c => c.id === chainFormData.chainId)?.name || 'Chain';
    const selectedChain = allChains.find(c => c.id === chainFormData.chainId);
    setIsSubmitting(true);
    setModalSuccess(null);
    
    try {
      await addChain(managingToken.id, chainFormData);
      
      // Optimistically update the modal immediately
      if (selectedChain) {
        const newChain = {
          id: chainFormData.chainId,
          code: selectedChain.code,
          name: selectedChain.name,
          chainType: selectedChain.chainType || 'EVM' as const,
          contractAddress: chainFormData.contractAddress || '',
          decimals: chainFormData.decimals || 18,
          isNative: chainFormData.isNative || false,
          isActive: chainFormData.isActive || true,
          depositEnabled: chainFormData.depositEnabled || true,
          withdrawalEnabled: chainFormData.withdrawalEnabled || true,
          minDeposit: chainFormData.minDeposit || 0,
          minWithdrawal: chainFormData.minWithdrawal || 0,
          maxDeposit: null,
          maxWithdrawal: null,
          withdrawalFee: chainFormData.withdrawalFee || 0,
          withdrawalFeeType: chainFormData.withdrawalFeeType || 'fixed'
        };
        
        setManagingToken({
          ...managingToken,
          chains: [...managingToken.chains, newChain]
        });
      }
      
      setModalSuccess(`✓ ${chainName} added successfully!`);
      setTimeout(() => setModalSuccess(null), 3000);
      
      // Refetch in background to sync with server
      refetch();
      
      // Reset form
      setChainFormData({
        chainId: '',
        contractAddress: '',
        decimals: 18,
        isNative: false,
        isActive: true,
        depositEnabled: true,
        withdrawalEnabled: true,
        minDeposit: 0,
        minWithdrawal: 0,
        withdrawalFee: 0,
        withdrawalFeeType: 'fixed'
      });
    } catch (err) {
      console.error('Failed to add chain:', err);
      setModalSuccess(`✗ Failed to add ${chainName}`);
      setTimeout(() => setModalSuccess(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveChain = async (tokenId: string, chainId: string) => {
    const chain = managingToken?.chains.find(c => c.id === chainId);
    const chainName = chain?.code || 'Chain';
    
    if (!confirm(`Are you sure you want to remove ${chainName} from this token?`)) return;
    
    setModalSuccess(null);
    try {
      await removeChain(tokenId, chainId);
      
      // Optimistically update the modal immediately
      if (managingToken) {
        setManagingToken({
          ...managingToken,
          chains: managingToken.chains.filter(c => c.id !== chainId)
        });
      }
      
      setModalSuccess(`✓ ${chainName} removed successfully!`);
      setTimeout(() => setModalSuccess(null), 3000);
      
      // Refetch in background to sync with server
      refetch();
    } catch (err) {
      console.error('Failed to remove chain:', err);
      setModalSuccess(`✗ Failed to remove ${chainName}`);
      setTimeout(() => setModalSuccess(null), 3000);
    }
  };

  const handleToggleChainStatus = async (
    tokenId: string, 
    chainId: string, 
    field: 'isActive' | 'depositEnabled' | 'withdrawalEnabled',
    currentValue: boolean
  ) => {
    const toggleKey = `${tokenId}-${chainId}`;
    
    setTogglingChains(prev => ({
      ...prev,
      [toggleKey]: [...(prev[toggleKey] || []), field]
    }));

    try {
      await updateChain(tokenId, chainId, { [field]: !currentValue });
    } catch (err) {
      console.error(`Failed to toggle ${field}:`, err);
      alert('Failed to update chain status');
    } finally {
      setTogglingChains(prev => ({
        ...prev,
        [toggleKey]: (prev[toggleKey] || []).filter(f => f !== field)
      }));
    }
  };

  const isChainToggling = (tokenId: string, chainId: string, field: string) => {
    const toggleKey = `${tokenId}-${chainId}`;
    return togglingChains[toggleKey]?.includes(field) || false;
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this token?')) return;
    
    try {
      await remove(id);
      setSaveSuccess('Token deleted successfully!');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to delete token:', err);
      alert('Failed to delete token');
    }
  };

  const handleToggleTokenActive = async (tokenId: string, enable: boolean) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token || token.chains.length === 0) return;

    setTogglingTokens(prev => new Set(prev).add(tokenId));
    
    try {
      // Toggle isActive status for all chains
      await Promise.all(
        token.chains.map(chain => 
          updateChain(tokenId, chain.id, { isActive: enable })
        )
      );
      await refetch();
      setSaveSuccess(`Token ${enable ? 'activated' : 'deactivated'} successfully!`);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to toggle token active status:', err);
      alert('Failed to update token active status');
    } finally {
      setTogglingTokens(prev => {
        const next = new Set(prev);
        next.delete(tokenId);
        return next;
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar />
      
      <div className="flex-1">
        <Header />
        
        <main className="p-8">
          {/* Header Section */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-white">Token Management</h1>
            <p className="text-zinc-500 text-sm mt-1.5">
              Configure tokens, manage chain support, and control deposit/withdrawal status
            </p>
          </div>

          {/* Header Actions */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search tokens..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-80 pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-transparent transition-all"
                />
                <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-600" />
              </div>
              <button
                onClick={refetch}
                disabled={isLoading}
                className="p-2.5 border border-zinc-900 text-zinc-400 rounded-xl hover:bg-zinc-900 transition-all duration-200"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-black rounded-xl hover:bg-zinc-100 transition-all duration-200 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Token
            </button>
          </div>

          {/* Success Message */}
          {saveSuccess && (
            <div className="mb-6 bg-green-950/20 border border-green-900/50 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                <p className="text-sm font-medium text-green-100">{saveSuccess}</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mb-6 bg-red-950/20 border border-red-900/50 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-100">Error loading tokens</p>
                  <p className="text-xs text-red-200/80 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tokens List */}
          <div className="bg-zinc-950 rounded-2xl border border-zinc-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-black border-b border-zinc-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Token
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Chains
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Status Overview
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Active Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {isLoading && tokens.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-zinc-600 mx-auto" />
                        <p className="text-sm text-zinc-500 mt-2">Loading tokens...</p>
                      </td>
                    </tr>
                  ) : tokens.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <p className="text-sm text-zinc-500">No tokens found</p>
                        <button
                          onClick={openCreateModal}
                          className="mt-3 text-sm text-white hover:text-zinc-300 underline"
                        >
                          Create your first token
                        </button>
                      </td>
                    </tr>
                  ) : (
                    tokens.map((token) => {
                      const activeChains = token.chains.filter(c => c.isActive).length;
                      const depositsEnabled = token.chains.filter(c => c.depositEnabled).length;
                      const withdrawalsEnabled = token.chains.filter(c => c.withdrawalEnabled).length;
                      const isTokenEnabled = activeChains > 0;

                      return (
                        <tr 
                          key={token.id} 
                          className="hover:bg-zinc-900/50 transition-colors"
                        >
                          {/* Token Info */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {token.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={token.logoUrl}
                                  alt={token.symbol}
                                  className="w-10 h-10 rounded-xl object-contain bg-zinc-900 border border-zinc-800 p-1"
                                  onError={(e) => {
                                    // Fallback to initials on image load error
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <div className={`w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white font-semibold border border-zinc-800 ${token.logoUrl ? 'hidden' : ''}`}>
                                {token.symbol.substring(0, 2)}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-white">{token.symbol}</div>
                                <div className="text-xs text-zinc-500">{token.name}</div>
                              </div>
                            </div>
                          </td>

                          {/* Type */}
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                              token.isStablecoin 
                                ? 'bg-blue-950/30 text-blue-400 border border-blue-900/50' 
                                : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                            }`}>
                              {token.isStablecoin ? 'Stablecoin' : 'Token'}
                            </span>
                          </td>

                          {/* Chains */}
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="text-sm text-white font-medium">
                                {token.chains.length} {token.chains.length === 1 ? 'Chain' : 'Chains'}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {token.chains.length > 0 
                                  ? token.chains.map(c => c.code).join(', ')
                                  : 'No chains configured'}
                              </div>
                            </div>
                          </td>

                          {/* Status Overview */}
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              <StatusBadge 
                                status={activeChains > 0} 
                                label={`${activeChains} Active`} 
                              />
                              <StatusBadge 
                                status={depositsEnabled > 0} 
                                label={<span className="flex items-center gap-1">
                                  <ArrowDownCircle className="w-3 h-3" />
                                  {depositsEnabled} Deposits
                                </span>} 
                              />
                              <StatusBadge 
                                status={withdrawalsEnabled > 0} 
                                label={<span className="flex items-center gap-1">
                                  <ArrowUpCircle className="w-3 h-3" />
                                  {withdrawalsEnabled} Withdrawals
                                </span>} 
                              />
                            </div>
                          </td>

                          {/* Active Status Toggle */}
                          <td className="px-6 py-4">
                            {token.chains.length > 0 ? (
                              <div className="flex items-center gap-2">
                                <ToggleSwitch
                                  enabled={isTokenEnabled}
                                  onChange={() => handleToggleTokenActive(token.id, !isTokenEnabled)}
                                  loading={togglingTokens.has(token.id)}
                                  size="md"
                                  label={isTokenEnabled ? 'Deactivate token' : 'Activate token'}
                                />
                                <span className={`text-xs font-medium ${isTokenEnabled ? 'text-green-400' : 'text-zinc-600'}`}>
                                  {isTokenEnabled ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-600">No chains</span>
                            )}
                          </td>

                          {/* />
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openChainsModal(token)}
                                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
                                title="Manage Chains"
                              >
                                <Link2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openEditModal(token)}
                                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
                                title="Edit Token"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(token.id)}
                                className="p-2 rounded-lg hover:bg-red-950/30 text-zinc-400 hover:text-red-400 transition-all"
                                title="Delete Token"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalItems > pagination.pageSize && (
              <div className="px-6 py-4 border-t border-zinc-900 flex items-center justify-between bg-black">
                <div className="text-sm text-zinc-500">
                  Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems} tokens
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1.5 border border-zinc-900 text-zinc-400 rounded-lg hover:bg-zinc-900 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1.5 border border-zinc-900 text-zinc-400 rounded-lg hover:bg-zinc-900 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Create/Edit Token Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-zinc-950 border-b border-zinc-900 p-6 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">
                {editingToken ? 'Edit Token' : 'Add New Token'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setEditingToken(null);
                }}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTokenSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Symbol <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={tokenFormData.symbol}
                    onChange={(e) => setTokenFormData({...tokenFormData, symbol: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-transparent"
                    required
                    disabled={!!editingToken}
                    maxLength={20}
                    placeholder="e.g., BTC, ETH, USDT"
                  />
                  {editingToken && (
                    <p className="text-xs text-zinc-600 mt-1">Symbol cannot be changed</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={tokenFormData.name}
                    onChange={(e) => setTokenFormData({...tokenFormData, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-transparent"
                    required
                    placeholder="e.g., Bitcoin, Ethereum"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-white mb-2">Token Icon</label>
                  <ImageUpload
                    value={tokenFormData.logoUrl}
                    onChange={(url) => setTokenFormData({...tokenFormData, logoUrl: url})}
                    placeholder="Upload token icon"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-zinc-600 mt-2">
                    Or enter URL manually:
                  </p>
                  <input
                    type="url"
                    value={tokenFormData.logoUrl}
                    onChange={(e) => setTokenFormData({...tokenFormData, logoUrl: e.target.value})}
                    className="w-full mt-1 px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-transparent"
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">CoinGecko ID</label>
                  <input
                    type="text"
                    value={tokenFormData.coingeckoId}
                    onChange={(e) => setTokenFormData({...tokenFormData, coingeckoId: e.target.value})}
                    className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-transparent"
                    placeholder="e.g., bitcoin"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Sort Order</label>
                  <input
                    type="number"
                    value={tokenFormData.sortOrder}
                    onChange={(e) => setTokenFormData({...tokenFormData, sortOrder: parseInt(e.target.value) || 0})}
                    className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-transparent"
                    min={0}
                  />
                </div>

                <div className="col-span-2 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tokenFormData.isStablecoin}
                      onChange={(e) => setTokenFormData({...tokenFormData, isStablecoin: e.target.checked})}
                      className="w-4 h-4 rounded border-zinc-800 bg-black text-white focus:ring-2 focus:ring-zinc-800"
                    />
                    <span className="text-sm font-medium text-white">Mark as Stablecoin</span>
                  </label>
                  <p className="text-xs text-zinc-600 mt-1 ml-7">Enable this if the token is pegged to a stable asset (e.g., USD)</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setEditingToken(null);
                  }}
                  className="px-4 py-2.5 border border-zinc-900 text-zinc-400 rounded-xl hover:bg-zinc-900 transition-all duration-200 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white text-black rounded-xl hover:bg-zinc-100 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingToken ? 'Update Token' : 'Create Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Chains Modal */}
      {showChainsModal && managingToken && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-zinc-950 border-b border-zinc-900 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-white">Manage Chains for {managingToken.symbol}</h2>
                <p className="text-sm text-zinc-500 mt-1">{managingToken.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowChainsModal(false);
                  setManagingToken(null);
                }}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Success/Error Message */}
              {modalSuccess && (
                <div className={`p-4 rounded-xl border ${
                  modalSuccess.startsWith('✓') 
                    ? 'bg-green-950/30 border-green-900/50 text-green-400' 
                    : 'bg-red-950/30 border-red-900/50 text-red-400'
                } flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300`}>
                  <span className="font-medium">{modalSuccess}</span>
                </div>
              )}

              {/* Current Chains */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-4">
                  Supported Chains ({managingToken.chains.length})
                </h3>
                <div className="space-y-3">
                  {managingToken.chains.map(chain => (
                    <div key={chain.id} className="p-4 bg-black rounded-xl border border-zinc-900">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-white">{chain.code}</span>
                          <span className="text-sm text-zinc-500">{chain.name}</span>
                          <ChainTypeBadge chainType={chain.chainType || 'EVM'} />
                          {chain.isNative && (
                            <span className="px-2 py-0.5 rounded-lg text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">
                              Native
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveChain(managingToken.id, chain.id)}
                          className="p-2 rounded-lg hover:bg-red-950/30 text-zinc-500 hover:text-red-400 transition-all"
                          title="Remove Chain"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Inline Toggle Controls */}
                      <div className="flex items-center gap-6 py-3 border-t border-zinc-900/50">
                        <div className="flex items-center gap-2">
                          <ToggleSwitch
                            enabled={chain.isActive}
                            onChange={() => handleToggleChainStatus(managingToken.id, chain.id, 'isActive', chain.isActive)}
                            loading={isChainToggling(managingToken.id, chain.id, 'isActive')}
                            size="sm"
                            label={chain.isActive ? 'Active' : 'Inactive'}
                          />
                          <span className={`text-xs font-medium ${chain.isActive ? 'text-green-400' : 'text-zinc-600'}`}>
                            {chain.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <ArrowDownCircle className="w-4 h-4 text-zinc-600" />
                          <ToggleSwitch
                            enabled={chain.depositEnabled}
                            onChange={() => handleToggleChainStatus(managingToken.id, chain.id, 'depositEnabled', chain.depositEnabled)}
                            loading={isChainToggling(managingToken.id, chain.id, 'depositEnabled')}
                            size="sm"
                            label={chain.depositEnabled ? 'Deposits enabled' : 'Deposits disabled'}
                          />
                          <span className={`text-xs ${chain.depositEnabled ? 'text-white' : 'text-zinc-600'}`}>
                            Deposits
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <ArrowUpCircle className="w-4 h-4 text-zinc-600" />
                          <ToggleSwitch
                            enabled={chain.withdrawalEnabled}
                            onChange={() => handleToggleChainStatus(managingToken.id, chain.id, 'withdrawalEnabled', chain.withdrawalEnabled)}
                            loading={isChainToggling(managingToken.id, chain.id, 'withdrawalEnabled')}
                            size="sm"
                            label={chain.withdrawalEnabled ? 'Withdrawals enabled' : 'Withdrawals disabled'}
                          />
                          <span className={`text-xs ${chain.withdrawalEnabled ? 'text-white' : 'text-zinc-600'}`}>
                            Withdrawals
                          </span>
                        </div>
                      </div>
                      
                      {/* Chain Details */}
                      <div className="text-xs text-zinc-600 mt-2 pt-2 border-t border-zinc-900/50">
                        <span className="font-mono">{chain.contractAddress || 'Native Token'}</span>
                        {' • '}{chain.decimals} decimals
                        {' • '}Min Deposit: {chain.minDeposit}
                        {' • '}Min Withdrawal: {chain.minWithdrawal}
                        {' • '}Fee: {chain.withdrawalFee} ({chain.withdrawalFeeType})
                      </div>
                    </div>
                  ))}
                  {managingToken.chains.length === 0 && (
                    <div className="text-center py-12 bg-black rounded-xl border border-zinc-900">
                      <AlertCircle className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                      <p className="text-sm text-zinc-500">No chains configured yet</p>
                      <p className="text-xs text-zinc-600 mt-1">Add a chain below to enable deposits and withdrawals</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Add Chain Form */}
              <div className="border-t border-zinc-900 pt-6">
                <h3 className="text-sm font-semibold text-white mb-4">Add Chain</h3>
                <form onSubmit={handleAddChainSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Chain <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={chainFormData.chainId}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          const selectedChain = allChains.find(c => c.id === selectedId);
                          const chainType = selectedChain?.chainType || 'EVM';
                          const config = CHAIN_TYPE_CONFIG[chainType] || CHAIN_TYPE_CONFIG.EVM;
                          setChainFormData({
                            ...chainFormData, 
                            chainId: selectedId,
                            decimals: config.defaultDecimals,
                            isNative: !config.supportsContracts,
                            contractAddress: !config.supportsContracts ? '' : chainFormData.contractAddress,
                          });
                        }}
                        className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-transparent"
                        required
                      >
                        <option value="">Select a chain</option>
                        {allChains
                          .filter(c => c.isActive && !managingToken.chains.find(tc => tc.id === c.id))
                          .map(chain => (
                            <option key={chain.id} value={chain.id}>{chain.code} - {chain.name} ({chain.chainType || 'EVM'})</option>
                          ))}
                      </select>
                    </div>

                    {(() => {
                      const selectedChain = allChains.find(c => c.id === chainFormData.chainId);
                      const chainType = selectedChain?.chainType || 'EVM';
                      const config = CHAIN_TYPE_CONFIG[chainType] || CHAIN_TYPE_CONFIG.EVM;
                      return (
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">
                            {config.addressLabel}
                            {!config.supportsContracts && (
                              <span className="ml-2 text-xs text-zinc-500 font-normal">Not applicable</span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={chainFormData.contractAddress}
                            onChange={(e) => setChainFormData({...chainFormData, contractAddress: e.target.value})}
                            className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-transparent disabled:opacity-40 disabled:cursor-not-allowed"
                            placeholder={config.addressPlaceholder}
                            disabled={!config.supportsContracts}
                          />
                          {chainType === 'SOL' && (
                            <p className="text-xs text-zinc-600 mt-1">Base58 encoded SPL token mint address</p>
                          )}
                          {chainType === 'TRON' && (
                            <p className="text-xs text-zinc-600 mt-1">TRC20 contract address starting with T</p>
                          )}
                        </div>
                      );
                    })()}

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Decimals <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        value={chainFormData.decimals}
                        onChange={(e) => setChainFormData({...chainFormData, decimals: parseInt(e.target.value) || 0})}
                        className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-transparent"
                        required
                        min={0}
                        max={18}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Min Deposit</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={chainFormData.minDeposit}
                        onChange={(e) => setChainFormData({...chainFormData, minDeposit: parseFloat(e.target.value) || 0})}
                        className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-transparent"
                        min={0}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Min Withdrawal</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={chainFormData.minWithdrawal}
                        onChange={(e) => setChainFormData({...chainFormData, minWithdrawal: parseFloat(e.target.value) || 0})}
                        className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-transparent"
                        min={0}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Withdrawal Fee</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={chainFormData.withdrawalFee}
                        onChange={(e) => setChainFormData({...chainFormData, withdrawalFee: parseFloat(e.target.value) || 0})}
                        className="w-full px-4 py-2.5 bg-black border border-zinc-900 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-transparent"
                        min={0}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chainFormData.isNative}
                        onChange={(e) => setChainFormData({...chainFormData, isNative: e.target.checked})}
                        className="w-4 h-4 rounded border-zinc-800 bg-black"
                      />
                      <span className="text-sm font-medium text-white">Is Native</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chainFormData.depositEnabled}
                        onChange={(e) => setChainFormData({...chainFormData, depositEnabled: e.target.checked})}
                        className="w-4 h-4 rounded border-zinc-800 bg-black"
                      />
                      <span className="text-sm font-medium text-white">Deposits Enabled</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chainFormData.withdrawalEnabled}
                        onChange={(e) => setChainFormData({...chainFormData, withdrawalEnabled: e.target.checked})}
                        className="w-4 h-4 rounded border-zinc-800 bg-black"
                      />
                      <span className="text-sm font-medium text-white">Withdrawals Enabled</span>
                    </label>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white text-black rounded-xl hover:bg-zinc-100 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      Add Chain
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
