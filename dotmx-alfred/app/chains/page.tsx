'use client';

import { useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import DataTable from '@/components/DataTable';
import { Plus, X, Search, RefreshCw, Edit2, Trash2, Loader2, Download, Globe, Zap, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { useChains } from '@/hooks/useChains';
import type { Chain, CreateChainParams } from '@/services/chains';

// Pagination Component
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
    <span className="text-text-tertiary">Page {page} of {totalPages}</span>
    <div className="flex gap-2">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="p-2 rounded-lg border border-border text-text-secondary hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="p-2 rounded-lg border border-border text-text-secondary hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);

// Chainlist data interface
interface ChainlistChain {
  name: string;
  chain: string;
  chainId: number;
  networkId: number;
  shortName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpc: string[];
  explorers?: Array<{
    name: string;
    url: string;
    standard: string;
  }>;
  infoURL?: string;
  icon?: string;
  title?: string;
}

// Toggle Switch Component for inline status toggling
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
  const sizeClasses = size === 'sm' 
    ? 'w-9 h-5' 
    : 'w-11 h-6';
  const dotSizeClasses = size === 'sm'
    ? 'w-4 h-4'
    : 'w-5 h-5';
  const translateClasses = size === 'sm'
    ? 'translate-x-4'
    : 'translate-x-5';

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!loading) onChange();
      }}
      disabled={loading}
      className={`relative inline-flex items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${
        enabled ? 'bg-success' : 'bg-border-subtle'
      }`}
      title={label}
    >
      <span
        className={`inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ${dotSizeClasses} ${
          enabled ? translateClasses : 'translate-x-0.5'
        }`}
      >
        {loading && (
          <Loader2 className="w-full h-full animate-spin text-text-tertiary p-0.5" />
        )}
      </span>
    </button>
  );
}

export default function ChainsPage() {
  const { chains, pagination, isLoading, error, refetch, setPage, setSearch, setIsActive, create, update, remove } = useChains({ pageSize: 20 });
  const [searchInput, setSearchInput] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingChain, setEditingChain] = useState<Chain | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingChains, setTogglingChains] = useState<Record<string, string[]>>({});

  // Chainlist import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [chainlistSearch, setChainlistSearch] = useState('');
  const [chainlistResults, setChainlistResults] = useState<ChainlistChain[]>([]);
  const [isSearchingChainlist, setIsSearchingChainlist] = useState(false);
  const [chainlistError, setChainlistError] = useState<string | null>(null);
  const [importedChain, setImportedChain] = useState<ChainlistChain | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateChainParams>({
    code: '',
    name: '',
    chainType: 'EVM',
    chainId: '' as any,
    networkType: 'mainnet',
    rpcUrl: '',
    explorerUrl: '',
    nativeCurrencySymbol: '',
    nativeCurrencyDecimals: 18,
    isActive: true,
    depositEnabled: true,
    withdrawalEnabled: true,
    minConfirmations: 12,
    avgBlockTimeSeconds: 12,
    iconUrl: '',
    sortOrder: 0
  });

  const handleSearch = () => {
    setSearch(searchInput);
  };

  // Chainlist search function - fetches chain data from chainid.network
  const searchChainlist = useCallback(async (query: string) => {
    console.log('🔍 searchChainlist CALLED with query:', query);
    
    if (!query.trim()) {
      console.log('❌ Query is empty, clearing results');
      setChainlistResults([]);
      return;
    }

    console.log('✅ Query is valid, starting search...');
    setIsSearchingChainlist(true);
    setChainlistError(null);

    try {
      console.log('📡 Fetching chains from API for:', query);
      
      // Fetch chains from chainid.network (uses ethereum-lists/chains data)
      const response = await fetch('https://chainid.network/chains.json', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const allChains: ChainlistChain[] = await response.json();
      console.log('Total chains fetched:', allChains.length);
      
      // Filter chains by query (search in name, shortName, chainId)
      const queryLower = query.toLowerCase().trim();
      const isNumeric = /^\d+$/.test(query.trim());
      
      console.log('Query:', queryLower, 'Is numeric:', isNumeric);
      
      const filtered = allChains.filter(chain => {
        if (isNumeric) {
          // For numeric search, match chainId
          const match = chain.chainId.toString() === query.trim();
          return match;
        }
        // For text search, match name, shortName, or chain
        const matchName = chain.name?.toLowerCase().includes(queryLower);
        const matchShort = chain.shortName?.toLowerCase().includes(queryLower);
        const matchChain = chain.chain?.toLowerCase().includes(queryLower);
        return matchName || matchShort || matchChain;
      }).slice(0, 20); // Limit to 20 results for performance
      
      console.log('Filtered chains:', filtered.length);
      setChainlistResults(filtered);
      
      if (filtered.length === 0) {
        setChainlistError('No chains found. Try "ethereum", "polygon", "1", or "137"');
      }
    } catch (err) {
      console.error('Chainlist search error:', err);
      setChainlistError(err instanceof Error ? err.message : 'Failed to search chains. Please try again.');
      setChainlistResults([]);
    } finally {
      setIsSearchingChainlist(false);
    }
  }, []);

  // Import chain from chainlist - populate the form
  const importFromChainlist = (chain: ChainlistChain) => {
    setImportedChain(chain);
    
    // Get the first public RPC (exclude ones with API keys or variables)
    const publicRpc = chain.rpc?.find(rpc => 
      !rpc.includes('${') && 
      !rpc.includes('API_KEY') &&
      rpc.startsWith('https://')
    ) || chain.rpc?.[0] || '';
    
    // Get the first explorer URL
    const explorerUrl = chain.explorers?.[0]?.url || '';
    
    // Determine if testnet based on name or chainId patterns
    const isTestnet = chain.name.toLowerCase().includes('testnet') ||
                     chain.name.toLowerCase().includes('sepolia') ||
                     chain.name.toLowerCase().includes('goerli') ||
                     chain.name.toLowerCase().includes('mumbai') ||
                     chain.name.toLowerCase().includes('fuji') ||
                     chain.title?.toLowerCase().includes('testnet') ||
                     false;
    
    // Generate a code from shortName or chain name
    const code = (chain.shortName || chain.chain || chain.name)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
    
    setFormData({
      code: code || 'CHAIN',
      name: chain.name,
      chainType: 'EVM',
      chainId: chain.chainId,
      networkType: isTestnet ? 'testnet' : 'mainnet',
      rpcUrl: publicRpc,
      explorerUrl: explorerUrl,
      nativeCurrencySymbol: chain.nativeCurrency.symbol,
      nativeCurrencyDecimals: chain.nativeCurrency.decimals,
      isActive: true,
      depositEnabled: true,
      withdrawalEnabled: true,
      minConfirmations: isTestnet ? 6 : 12,
      avgBlockTimeSeconds: 12,
      iconUrl: '',
      sortOrder: 0
    });
    
    setShowImportModal(false);
    setShowCreateModal(true);
    setChainlistSearch('');
    setChainlistResults([]);
  };

  const openImportModal = () => {
    setChainlistSearch('');
    setChainlistResults([]);
    setChainlistError(null);
    setImportedChain(null);
    setShowImportModal(true);
  };

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status);
    if (status === 'all') {
      setIsActive(undefined);
    } else {
      setIsActive(status === 'active');
    }
  };

  const openCreateModal = () => {
    setFormData({
      code: '',
      name: '',
      chainType: 'EVM',
      chainId: '' as any,
      networkType: 'mainnet',
      rpcUrl: '',
      explorerUrl: '',
      nativeCurrencySymbol: '',
      nativeCurrencyDecimals: 18,
      isActive: true,
      depositEnabled: true,
      withdrawalEnabled: true,
      minConfirmations: 12,
      avgBlockTimeSeconds: 12,
      iconUrl: '',
      sortOrder: 0
    });
    setShowCreateModal(true);
  };

  const openEditModal = (chain: Chain) => {
    setEditingChain(chain);
    setFormData({
      code: chain.code,
      name: chain.name,
      chainType: chain.chainType || 'EVM',
      chainId: chain.chainId || '' as any,
      networkType: chain.networkType,
      rpcUrl: chain.rpcUrl || '',
      explorerUrl: chain.explorerUrl || '',
      nativeCurrencySymbol: chain.nativeCurrencySymbol,
      nativeCurrencyDecimals: chain.nativeCurrencyDecimals,
      isActive: chain.isActive,
      depositEnabled: chain.depositEnabled,
      withdrawalEnabled: chain.withdrawalEnabled,
      minConfirmations: chain.minConfirmations,
      avgBlockTimeSeconds: chain.avgBlockTimeSeconds,
      iconUrl: chain.iconUrl || '',
      sortOrder: chain.sortOrder
    });
    setShowEditModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingChain) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { code, ...updateData } = formData;
        // Convert empty string chainId to undefined for API
        const sanitized = {
          ...updateData,
          chainId: updateData.chainId || undefined
        };
        await update(editingChain.id, sanitized);
        setShowEditModal(false);
      } else {
        // Convert empty string chainId to undefined for API
        const sanitized = {
          ...formData,
          chainId: formData.chainId || undefined
        };
        await create(sanitized);
        setShowCreateModal(false);
      }
    } catch (err) {
      console.error('Failed to save chain:', err);
      alert('Failed to save chain');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this chain?')) return;
    
    try {
      await remove(id);
    } catch (err) {
      console.error('Failed to delete chain:', err);
      alert('Failed to delete chain');
    }
  };

  // Quick toggle handlers for inline status changes
  const handleToggleStatus = async (chain: Chain, field: 'isActive' | 'depositEnabled' | 'withdrawalEnabled') => {
    const chainId = chain.id;
    
    // Track which field is being toggled for this chain
    setTogglingChains(prev => ({
      ...prev,
      [chainId]: [...(prev[chainId] || []), field]
    }));

    try {
      await update(chainId, { [field]: !chain[field] });
    } catch (err) {
      console.error(`Failed to toggle ${field}:`, err);
      alert(`Failed to update chain status`);
    } finally {
      setTogglingChains(prev => ({
        ...prev,
        [chainId]: (prev[chainId] || []).filter(f => f !== field)
      }));
    }
  };

  const isToggling = (chainId: string, field: string) => {
    return togglingChains[chainId]?.includes(field) || false;
  };

  const tableData = chains.map(chain => ({
    code: chain.code,
    name: chain.name,
    chainType: chain.chainType || 'EVM',
    chainId: chain.chainId || '-',
    network: chain.networkType,
    currency: chain.nativeCurrencySymbol,
    confirmations: chain.minConfirmations,
    status: chain,
    deposits: chain,
    withdrawals: chain,
    actions: chain
  }));

  const columns = [
    { key: 'code', label: 'Code', sortable: true },
    { key: 'name', label: 'Chain Name', sortable: true },
    { key: 'chainType', label: 'Type', sortable: false },
    { key: 'chainId', label: 'Chain ID', sortable: false },
    { key: 'network', label: 'Network', sortable: false },
    { key: 'currency', label: 'Currency', sortable: false },
    { key: 'confirmations', label: 'Min Confirms', sortable: false },
    { 
      key: 'status', 
      label: 'Status', 
      sortable: false,
      render: (chain: Chain) => (
        <div className="flex items-center gap-2">
          <ToggleSwitch
            enabled={chain.isActive}
            onChange={() => handleToggleStatus(chain, 'isActive')}
            loading={isToggling(chain.id, 'isActive')}
            size="sm"
            label={chain.isActive ? 'Active - Click to deactivate' : 'Inactive - Click to activate'}
          />
          <span className={`text-xs font-medium ${
            chain.isActive ? 'text-success' : 'text-text-tertiary'
          }`}>
            {chain.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      )
    },
    { 
      key: 'deposits', 
      label: 'Deposits', 
      sortable: false,
      render: (chain: Chain) => (
        <div className="flex items-center gap-2">
          <ToggleSwitch
            enabled={chain.depositEnabled}
            onChange={() => handleToggleStatus(chain, 'depositEnabled')}
            loading={isToggling(chain.id, 'depositEnabled')}
            size="sm"
            label={chain.depositEnabled ? 'Deposits enabled - Click to disable' : 'Deposits disabled - Click to enable'}
          />
          <span className={`text-xs ${
            chain.depositEnabled ? 'text-success' : 'text-text-tertiary'
          }`}>
            {chain.depositEnabled ? 'On' : 'Off'}
          </span>
        </div>
      )
    },
    { 
      key: 'withdrawals', 
      label: 'Withdrawals', 
      sortable: false,
      render: (chain: Chain) => (
        <div className="flex items-center gap-2">
          <ToggleSwitch
            enabled={chain.withdrawalEnabled}
            onChange={() => handleToggleStatus(chain, 'withdrawalEnabled')}
            loading={isToggling(chain.id, 'withdrawalEnabled')}
            size="sm"
            label={chain.withdrawalEnabled ? 'Withdrawals enabled - Click to disable' : 'Withdrawals disabled - Click to enable'}
          />
          <span className={`text-xs ${
            chain.withdrawalEnabled ? 'text-success' : 'text-text-tertiary'
          }`}>
            {chain.withdrawalEnabled ? 'On' : 'Off'}
          </span>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (chain: Chain) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEditModal(chain)}
            className="p-1.5 rounded-lg hover:bg-hover text-text-secondary hover:text-text-primary transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(chain.id)}
            className="p-1.5 rounded-lg hover:bg-accent-red/10 text-text-secondary hover:text-accent-red transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1">
        <Header />
        
        <main className="p-8">
          {/* Header Actions */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-4">
              <div className="flex gap-2 bg-secondary/50 rounded-lg p-1">
                <button
                  onClick={() => handleStatusFilter('all')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedStatus === 'all' || !selectedStatus
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => handleStatusFilter('active')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedStatus === 'active'
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => handleStatusFilter('inactive')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedStatus === 'inactive'
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Inactive
                </button>
              </div>

              <div className="flex gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search chains..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-tertiary" />
                </div>
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-secondary border border-border rounded-lg hover:bg-hover transition-colors text-sm font-medium"
                >
                  Search
                </button>
                <button
                  onClick={refetch}
                  className="p-2 bg-secondary border border-border rounded-lg hover:bg-hover transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={openImportModal}
                className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border text-text-primary rounded-lg hover:bg-hover transition-colors font-medium"
              >
                <Download className="w-4 h-4" />
                Import from Chainlist
              </button>
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Chain
              </button>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-text-muted animate-spin" />
              <span className="ml-3 text-text-muted">Loading...</span>
            </div>
          ) : (
            <>
              <DataTable
                columns={columns}
                data={tableData}
              />
              {pagination && pagination.totalPages > 1 && (
                <div className="px-6 pb-4">
                  <Pagination 
                    page={pagination.page} 
                    totalPages={pagination.totalPages}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border p-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">{editingChain ? 'Edit Chain' : 'Add New Chain'}</h2>
                {importedChain && !editingChain && (
                  <p className="text-sm text-info mt-1 flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    Imported from Chainlist: {importedChain.name}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowEditModal(false);
                  setImportedChain(null);
                }}
                className="text-text-secondary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Imported chain info banner */}
              {importedChain && !editingChain && (
                <div className="p-3 bg-info/10 border border-info/20 rounded-lg text-sm">
                  <div className="flex items-center gap-2 text-info font-medium mb-1">
                    <Zap className="w-4 h-4" />
                    Auto-populated from Chainlist
                  </div>
                  <p className="text-text-secondary text-xs">
                    Chain ID: {importedChain.chainId} • {importedChain.rpc.filter(r => !r.includes('${')).length} public RPCs available • {importedChain.explorers?.length || 0} explorers
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                    disabled={!!editingChain}
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Chain Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Chain Type *</label>
                  <select
                    value={formData.chainType || 'EVM'}
                    onChange={(e) => {
                      const ct = e.target.value as CreateChainParams['chainType'];
                      const defaults: Record<string, { decimals: number; confirmations: number; blockTime: number }> = {
                        EVM: { decimals: 18, confirmations: 12, blockTime: 12 },
                        SOL: { decimals: 9, confirmations: 32, blockTime: 1 },
                        TRON: { decimals: 6, confirmations: 20, blockTime: 3 },
                        BTC: { decimals: 8, confirmations: 6, blockTime: 600 },
                        DOGE: { decimals: 8, confirmations: 40, blockTime: 60 },
                      };
                      const d = defaults[ct || 'EVM'] || defaults.EVM;
                      setFormData({
                        ...formData, 
                        chainType: ct,
                        nativeCurrencyDecimals: d.decimals,
                        minConfirmations: d.confirmations,
                        avgBlockTimeSeconds: d.blockTime,
                        chainId: (ct !== 'EVM') ? '' as any : formData.chainId,
                      });
                    }}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="EVM">EVM (Ethereum, BSC, Arbitrum...)</option>
                    <option value="SOL">Solana</option>
                    <option value="TRON">TRON</option>
                    <option value="BTC">Bitcoin</option>
                    <option value="DOGE">Dogecoin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Chain ID
                    {formData.chainType !== 'EVM' && <span className="text-xs text-zinc-500 ml-2">(EVM only)</span>}
                  </label>
                  <input
                    type="number"
                    value={formData.chainId || ''}
                    onChange={(e) => setFormData({...formData, chainId: e.target.value ? parseInt(e.target.value) : '' as any})}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-40"
                    disabled={formData.chainType !== 'EVM' && formData.chainType !== undefined}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Network Type *</label>
                  <select
                    value={formData.networkType}
                    onChange={(e) => setFormData({...formData, networkType: e.target.value as 'mainnet' | 'testnet'})}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="mainnet">Mainnet</option>
                    <option value="testnet">Testnet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Native Currency *</label>
                  <input
                    type="text"
                    value={formData.nativeCurrencySymbol}
                    onChange={(e) => setFormData({...formData, nativeCurrencySymbol: e.target.value.toUpperCase()})}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Currency Decimals *</label>
                  <input
                    type="number"
                    value={formData.nativeCurrencyDecimals}
                    onChange={(e) => setFormData({...formData, nativeCurrencyDecimals: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    required
                    min={0}
                    max={18}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Min Confirmations</label>
                  <input
                    type="number"
                    value={formData.minConfirmations}
                    onChange={(e) => setFormData({...formData, minConfirmations: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    min={1}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Avg Block Time (s)</label>
                  <input
                    type="number"
                    value={formData.avgBlockTimeSeconds}
                    onChange={(e) => setFormData({...formData, avgBlockTimeSeconds: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    min={1}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">RPC URL</label>
                <input
                  type="url"
                  value={formData.rpcUrl}
                  onChange={(e) => setFormData({...formData, rpcUrl: e.target.value})}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Explorer URL</label>
                <input
                  type="url"
                  value={formData.explorerUrl}
                  onChange={(e) => setFormData({...formData, explorerUrl: e.target.value})}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Icon URL</label>
                <input
                  type="url"
                  value={formData.iconUrl}
                  onChange={(e) => setFormData({...formData, iconUrl: e.target.value})}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    className="w-4 h-4 rounded border-border"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium">Active</label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="depositEnabled"
                    checked={formData.depositEnabled}
                    onChange={(e) => setFormData({...formData, depositEnabled: e.target.checked})}
                    className="w-4 h-4 rounded border-border"
                  />
                  <label htmlFor="depositEnabled" className="text-sm font-medium">Deposits Enabled</label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="withdrawalEnabled"
                    checked={formData.withdrawalEnabled}
                    onChange={(e) => setFormData({...formData, withdrawalEnabled: e.target.checked})}
                    className="w-4 h-4 rounded border-border"
                  />
                  <label htmlFor="withdrawalEnabled" className="text-sm font-medium">Withdrawals Enabled</label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                  }}
                  className="px-4 py-2 bg-secondary border border-border rounded-lg hover:bg-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingChain ? 'Update' : 'Create'} Chain
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import from Chainlist Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-info" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Import from Chainlist</h2>
                  <p className="text-sm text-text-secondary">Search and import EVM chain data from chainlist.org</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Box */}
            <div className="p-6 border-b border-border">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search by chain name or Chain ID (e.g., 'sepolia' or '11155111')"
                    value={chainlistSearch}
                    onChange={(e) => setChainlistSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchChainlist(chainlistSearch)}
                    className="w-full pl-10 pr-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                  <Search className="absolute left-3 top-3.5 w-4 h-4 text-text-tertiary" />
                </div>
                <button
                  onClick={() => searchChainlist(chainlistSearch)}
                  disabled={isSearchingChainlist || !chainlistSearch.trim()}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {isSearchingChainlist ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    'Search'
                  )}
                </button>
              </div>
              <p className="text-xs text-text-tertiary mt-2">
                Data sourced from <a href="https://chainlist.org" target="_blank" rel="noopener noreferrer" className="text-info hover:underline">chainlist.org</a>
              </p>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4">
              {chainlistError && (
                <div className="p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm mb-4">
                  {chainlistError}
                </div>
              )}

              {chainlistResults.length === 0 && !isSearchingChainlist && chainlistSearch && (
                <div className="text-center py-12 text-text-secondary">
                  <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No chains found matching &quot;{chainlistSearch}&quot;</p>
                  <p className="text-sm text-text-tertiary mt-1">Try searching by chain name or Chain ID</p>
                </div>
              )}

              {chainlistResults.length === 0 && !chainlistSearch && (
                <div className="text-center py-12 text-text-secondary">
                  <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Search for a chain to import</p>
                  <p className="text-sm text-text-tertiary mt-1">Examples: Ethereum, Sepolia, Polygon, 137, 11155111</p>
                </div>
              )}

              {chainlistResults.length > 0 && (
                <div className="space-y-2">
                  {chainlistResults.map((chain) => (
                    <div
                      key={chain.chainId}
                      className="flex items-center justify-between p-4 bg-surface border border-border rounded-lg hover:border-primary/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-text-primary truncate">{chain.name}</h3>
                          {chain.name.toLowerCase().includes('testnet') || 
                           chain.name.toLowerCase().includes('sepolia') ||
                           chain.name.toLowerCase().includes('goerli') ? (
                            <span className="px-2 py-0.5 bg-warning/10 text-warning text-xs rounded-full font-medium">
                              Testnet
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-success/10 text-success text-xs rounded-full font-medium">
                              Mainnet
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                          <span>Chain ID: <code className="bg-secondary px-1 rounded">{chain.chainId}</code></span>
                          <span>Currency: <code className="bg-secondary px-1 rounded">{chain.nativeCurrency?.symbol || 'N/A'}</code></span>
                          <span>RPCs: {chain.rpc?.filter(r => !r.includes('${')).length || 0}</span>
                        </div>
                        {chain.explorers && chain.explorers.length > 0 && (
                          <a 
                            href={chain.explorers[0].url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-info hover:underline mt-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {chain.explorers[0].url}
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => importFromChainlist(chain)}
                        className="ml-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Import
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-surface/50">
              <p className="text-xs text-text-tertiary text-center">
                Chain data is fetched from the ethereum-lists/chains repository
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
