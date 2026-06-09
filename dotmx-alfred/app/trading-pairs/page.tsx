'use client';

import { useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import DataTable from '@/components/DataTable';
import { Plus, Power, TrendingUp, TrendingDown, X, Search, RefreshCw, Edit2, Trash2, Sparkles, Loader2, ChevronDown, ArrowRightLeft, Percent, DollarSign, Settings2, LayoutGrid, List, AlertTriangle, Zap, Shield, Server, CheckCircle2, XCircle } from 'lucide-react';
import { useTradingPairs } from '@/hooks/useTradingPairs';
import { useTokens } from '@/hooks/useTokens';
import { useEngineStatus } from '@/hooks/useEngineStatus';
import type { TradingPair, CreateTradingPairParams } from '@/services/trading-pairs';

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

// Status dropdown component for inline status changes
function StatusDropdown({ 
  status, 
  onChange, 
  loading = false 
}: { 
  status: string; 
  onChange: (newStatus: string) => void;
  loading?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const statusConfig: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    active: { bg: 'bg-success/10', text: 'text-success', label: 'Active', icon: <Zap className="w-3 h-3" /> },
    inactive: { bg: 'bg-border-subtle', text: 'text-text-tertiary', label: 'Inactive', icon: <Power className="w-3 h-3" /> },
    maintenance: { bg: 'bg-warning/10', text: 'text-warning', label: 'Maintenance', icon: <AlertTriangle className="w-3 h-3" /> }
  };
  
  const currentConfig = statusConfig[status] || statusConfig.inactive;
  
  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!loading) setIsOpen(!isOpen);
        }}
        disabled={loading}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${currentConfig.bg} ${currentConfig.text} hover:opacity-80 disabled:opacity-50`}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <>
            {currentConfig.icon}
            {currentConfig.label}
            <ChevronDown className="w-3 h-3" />
          </>
        )}
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute top-full left-0 mt-1 z-20 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-32">
            {Object.entries(statusConfig).map(([key, config]) => (
              <button
                key={key}
                onClick={(e) => {
                  e.stopPropagation();
                  if (key !== status) {
                    onChange(key);
                  }
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-hover transition-colors flex items-center gap-2 ${
                  key === status ? 'bg-hover' : ''
                } ${config.text}`}
              >
                {config.icon}
                {config.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Trading Pair Card Component for card view
function TradingPairCard({ 
  pair, 
  onEdit, 
  onDelete, 
  onStatusChange, 
  isToggling,
  getSymbolStatus
}: { 
  pair: TradingPair; 
  onEdit: () => void; 
  onDelete: () => void;
  onStatusChange: (status: string) => void;
  isToggling: boolean;
  getSymbolStatus: (symbol: string) => any;
}) {
  const shardStatus = getSymbolStatus(pair.symbol);
  const isEngineActive = shardStatus?.status === 'active';
  
  return (
    <div className="bg-surface border border-border rounded-xl p-5 hover:border-border-subtle transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">{pair.symbol}</h3>
            <p className="text-xs text-text-tertiary">{pair.baseCurrency} / {pair.quoteCurrency}</p>
          </div>
        </div>
        <StatusDropdown
          status={pair.status}
          onChange={onStatusChange}
          loading={isToggling}
        />
      </div>

      {/* Order Size Limits */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-background rounded-lg p-3">
          <p className="text-xs text-text-tertiary mb-1">Min Order</p>
          <p className="text-sm font-medium text-text-primary">{pair.minOrderSize?.toFixed(6) ?? '—'}</p>
        </div>
        <div className="bg-background rounded-lg p-3">
          <p className="text-xs text-text-tertiary mb-1">Max Order</p>
          <p className="text-sm font-medium text-text-primary">{pair.maxOrderSize?.toLocaleString() ?? '—'}</p>
        </div>
      </div>

      {/* Fees */}
      <div className="flex items-center gap-4 mb-4 py-3 border-t border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-success/10 flex items-center justify-center">
            <Percent className="w-3 h-3 text-success" />
          </div>
          <div>
            <p className="text-xs text-text-tertiary">Maker</p>
            <p className="text-sm font-medium text-success">{(pair.makerFee != null ? pair.makerFee * 100 : 0).toFixed(2)}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-warning/10 flex items-center justify-center">
            <Percent className="w-3 h-3 text-warning" />
          </div>
          <div>
            <p className="text-xs text-text-tertiary">Taker</p>
            <p className="text-sm font-medium text-warning">{(pair.takerFee != null ? pair.takerFee * 100 : 0).toFixed(2)}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="w-6 h-6 rounded bg-info/10 flex items-center justify-center">
            <DollarSign className="w-3 h-3 text-info" />
          </div>
          <div>
            <p className="text-xs text-text-tertiary">Tick Size</p>
            <p className="text-sm font-medium text-info">{pair.tickSize?.toFixed(6) ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Engine Status */}
      <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-background rounded-lg">
        <Server className="w-4 h-4 text-text-tertiary" />
        <span className="text-xs text-text-tertiary">Engine:</span>
        {isEngineActive ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-xs text-success font-medium">Running</span>
          </>
        ) : (
          <>
            <XCircle className="w-4 h-4 text-text-tertiary" />
            <span className="text-xs text-text-tertiary">Offline</span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-hover transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          Configure
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-text-secondary hover:text-error hover:bg-error/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Price suggestion types
interface PriceSuggestion {
  minOrderSize: number;
  maxOrderSize: number;
  tickSize: number;
  currentPrice: number;
  high24h: number;
  low24h: number;
}

// Common coin ID mappings for CoinGecko
const COINGECKO_IDS: Record<string, string> = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'SOL': 'solana',
  'DOT': 'polkadot',
  'MATIC': 'matic-network',
  'LTC': 'litecoin',
  'SHIB': 'shiba-inu',
  'TRX': 'tron',
  'AVAX': 'avalanche-2',
  'LINK': 'chainlink',
  'ATOM': 'cosmos',
  'UNI': 'uniswap',
  'XMR': 'monero',
  'ETC': 'ethereum-classic',
  'XLM': 'stellar',
  'BCH': 'bitcoin-cash',
  'APT': 'aptos',
  'FIL': 'filecoin',
  'LDO': 'lido-dao',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'NEAR': 'near',
  'VET': 'vechain',
  'ALGO': 'algorand',
  'ICP': 'internet-computer',
  'GRT': 'the-graph',
  'FTM': 'fantom',
  'SAND': 'the-sandbox',
  'MANA': 'decentraland',
  'AAVE': 'aave',
  'THETA': 'theta-token',
  'AXS': 'axie-infinity',
  'EOS': 'eos',
  'FLOW': 'flow',
  'MKR': 'maker',
  'SNX': 'synthetix-network-token',
  'XTZ': 'tezos',
  'NEO': 'neo',
  'KLAY': 'klay-token',
  'CHZ': 'chiliz',
  'CRV': 'curve-dao-token',
  'RUNE': 'thorchain',
  'ZEC': 'zcash',
  'DASH': 'dash',
  'COMP': 'compound-governance-token',
  'ENJ': 'enjincoin',
  'BAT': 'basic-attention-token',
  'CAKE': 'pancakeswap-token',
  'STX': 'blockstack',
  'KAVA': 'kava',
  'GALA': 'gala',
  'ONE': 'harmony',
  'ZIL': 'zilliqa',
  'ENS': 'ethereum-name-service',
  'GMT': 'stepn',
  'APE': 'apecoin',
  'LUNC': 'terra-luna',
  'CRO': 'crypto-com-chain',
  'QNT': 'quant-network',
  'EGLD': 'elrond-erd-2',
  'FXS': 'frax-share',
  'IMX': 'immutable-x',
  'RPL': 'rocket-pool',
  'GMX': 'gmx',
  'INJ': 'injective-protocol',
  'RNDR': 'render-token',
  'SUI': 'sui',
  'SEI': 'sei-network',
  'TIA': 'celestia',
  'JUP': 'jupiter-exchange-solana',
  'WIF': 'dogwifcoin',
  'PEPE': 'pepe',
  'BONK': 'bonk',
  'FLOKI': 'floki',
  'MON': 'mon-protocol',
  'HYPE': 'hyperliquid',
  'BASE': 'base-protocol',
  'VIRTUAL': 'virtual-protocol',
  'AI16Z': 'ai16z',
  'FARTCOIN': 'fartcoin',
  'GRIFFAIN': 'griffain',
  'ZEREBRO': 'zerebro',
  'ARC': 'arc-2',
  'AIXBT': 'aixbt',
  'GOAT': 'goatseus-maximus',
  'PENGU': 'pudgy-penguins',
  'TRUMP': 'official-trump',
  'MELANIA': 'melania-meme',
  'ANIME': 'anime',
  'BERA': 'berachain-bera',
  'IP': 'story-2',
  'KAITO': 'kaito',
  'TST': 'tst',
  'LAYER': 'layer-2',
};

// Fetch price data from CoinGecko API (CORS-friendly)
async function fetchPriceData(base: string, quote: string): Promise<PriceSuggestion | null> {
  try {
    const coinId = COINGECKO_IDS[base.toUpperCase()];
    
    if (!coinId) {
      console.warn(`No CoinGecko ID mapping for ${base}, trying search...`);
      // Try to search for the coin
      const searchResponse = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${base.toLowerCase()}`
      );
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.coins && searchData.coins.length > 0) {
          const foundId = searchData.coins[0].id;
          return await fetchCoinGeckoPrice(foundId, quote);
        }
      }
      return null;
    }
    
    return await fetchCoinGeckoPrice(coinId, quote);
  } catch (error) {
    console.error('Failed to fetch price data:', error);
    return null;
  }
}

// Fetch from CoinGecko market data
async function fetchCoinGeckoPrice(coinId: string, quote: string): Promise<PriceSuggestion | null> {
  try {
    // Determine the vs_currency (CoinGecko uses lowercase)
    const vsCurrency = quote.toLowerCase() === 'usdt' || quote.toLowerCase() === 'usdc' 
      ? 'usd' 
      : quote.toLowerCase();
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`
    );
    
    if (!response.ok) {
      console.error('CoinGecko API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    const marketData = data.market_data;
    
    if (!marketData) {
      return null;
    }
    
    const currentPrice = marketData.current_price?.usd || 0;
    const high24h = marketData.high_24h?.usd || currentPrice;
    const low24h = marketData.low_24h?.usd || currentPrice;
    
    if (currentPrice === 0) {
      return null;
    }
    
    return calculateSuggestion(currentPrice, high24h, low24h);
  } catch (error) {
    console.error('CoinGecko fetch error:', error);
    return null;
  }
}

// Calculate suggested order sizes based on price
function calculateSuggestion(currentPrice: number, high24h: number, low24h: number): PriceSuggestion {
  // Determine tick size based on price magnitude
  let tickSize: number;
  if (currentPrice >= 10000) {
    tickSize = 0.01;      // BTC-like: $0.01 precision
  } else if (currentPrice >= 1000) {
    tickSize = 0.01;      // ETH-like: $0.01 precision
  } else if (currentPrice >= 100) {
    tickSize = 0.001;     // SOL-like: $0.001 precision
  } else if (currentPrice >= 10) {
    tickSize = 0.0001;    // Mid-cap: $0.0001 precision
  } else if (currentPrice >= 1) {
    tickSize = 0.00001;   // Low price: $0.00001 precision
  } else if (currentPrice >= 0.01) {
    tickSize = 0.000001;  // Very low: $0.000001 precision
  } else {
    tickSize = 0.00000001; // Micro: 8 decimal precision
  }
  
  // Calculate min order size: ~$10 worth
  const targetMinValue = 10; // $10 USD minimum order
  let minOrderSize = targetMinValue / currentPrice;
  
  // Round to nice numbers
  if (minOrderSize >= 1) {
    minOrderSize = Math.ceil(minOrderSize);
  } else {
    // Find appropriate decimal places
    const magnitude = Math.floor(Math.log10(minOrderSize));
    const factor = Math.pow(10, -magnitude);
    minOrderSize = Math.ceil(minOrderSize * factor) / factor;
  }
  
  // Calculate max order size: ~$1M worth (or adjust based on liquidity)
  const targetMaxValue = 1000000; // $1M USD max order
  let maxOrderSize = targetMaxValue / currentPrice;
  
  // Round to nice numbers
  if (maxOrderSize >= 1000) {
    maxOrderSize = Math.floor(maxOrderSize / 1000) * 1000;
  } else if (maxOrderSize >= 100) {
    maxOrderSize = Math.floor(maxOrderSize / 100) * 100;
  } else if (maxOrderSize >= 10) {
    maxOrderSize = Math.floor(maxOrderSize / 10) * 10;
  } else {
    maxOrderSize = Math.floor(maxOrderSize);
  }
  
  return {
    minOrderSize,
    maxOrderSize,
    tickSize,
    currentPrice,
    high24h,
    low24h
  };
}

export default function TradingPairsPage() {
  const { 
    tradingPairs, 
    pagination, 
    isLoading, 
    error, 
    refetch, 
    setSearch, 
    setStatus,
    setPage,
    createPair,
    updatePair,
    deletePair 
  } = useTradingPairs();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPair, setSelectedPair] = useState<TradingPair | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingPairs, setTogglingPairs] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  
  // Price suggestion state
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState<PriceSuggestion | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<CreateTradingPairParams>({
    symbol: '',
    baseCurrency: '',
    quoteCurrency: '',
    status: 'inactive',
    minOrderSize: 0.0001,
    maxOrderSize: 10000,
    tickSize: 0.01,
    makerFee: 0.001,
    takerFee: 0.002
  });

  // Tokens for selecting base/quote when creating pairs
  const { tokens: availableTokens = [], isLoading: tokensLoading } = useTokens();
  const selectableTokens = availableTokens.filter(t => Array.isArray(t.chains) && t.chains.some(c => c.isActive));
  
  // Engine status for matching engine info
  const { health: engineHealth, getSymbolStatus } = useEngineStatus();

  // Fetch price suggestion from CoinGecko
  const handleFetchPriceSuggestion = useCallback(async () => {
    if (!formData.baseCurrency || !formData.quoteCurrency) {
      setPriceError('Please enter both base and quote currencies first');
      return;
    }
    
    setIsFetchingPrice(true);
    setPriceError(null);
    setPriceSuggestion(null);
    
    try {
      const suggestion = await fetchPriceData(formData.baseCurrency, formData.quoteCurrency);
      
      if (suggestion) {
        setPriceSuggestion(suggestion);
        // Auto-apply the suggestion to form
        setFormData(prev => ({
          ...prev,
          minOrderSize: suggestion.minOrderSize,
          maxOrderSize: suggestion.maxOrderSize,
          tickSize: suggestion.tickSize
        }));
      } else {
        setPriceError(`Could not find price data for ${formData.baseCurrency}/${formData.quoteCurrency}`);
      }
    } catch (error) {
      setPriceError('Failed to fetch price data');
    } finally {
      setIsFetchingPrice(false);
    }
  }, [formData.baseCurrency, formData.quoteCurrency]);

  // Apply suggested values to form
  const applySuggestion = useCallback(() => {
    if (priceSuggestion) {
      setFormData(prev => ({
        ...prev,
        minOrderSize: priceSuggestion.minOrderSize,
        maxOrderSize: priceSuggestion.maxOrderSize,
        tickSize: priceSuggestion.tickSize
      }));
    }
  }, [priceSuggestion]);

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setStatus(status || undefined);
  };

  // Quick status change handler for inline updates
  const handleQuickStatusChange = async (pair: TradingPair, newStatus: string) => {
    setTogglingPairs(prev => new Set(prev).add(pair.id));
    
    try {
      await updatePair(pair.id, { status: newStatus });
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update trading pair status');
    } finally {
      setTogglingPairs(prev => {
        const next = new Set(prev);
        next.delete(pair.id);
        return next;
      });
    }
  };

  const handleCreatePair = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createPair(formData);
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      alert('Failed to create trading pair');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPair) return;
    setIsSubmitting(true);
    try {
      await updatePair(selectedPair.id, {
        status: formData.status,
        minOrderSize: formData.minOrderSize,
        maxOrderSize: formData.maxOrderSize,
        tickSize: formData.tickSize,
        makerFee: formData.makerFee,
        takerFee: formData.takerFee
      });
      setShowEditModal(false);
      setSelectedPair(null);
      resetForm();
    } catch (err) {
      alert('Failed to update trading pair');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePair = async (pair: TradingPair) => {
    if (!confirm(`Are you sure you want to delete ${pair.symbol}?`)) return;
    try {
      await deletePair(pair.id);
    } catch (err) {
      alert('Failed to delete trading pair');
    }
  };

  const openEditModal = (pair: TradingPair) => {
    setSelectedPair(pair);
    setFormData({
      symbol: pair.symbol,
      baseCurrency: pair.baseCurrency,
      quoteCurrency: pair.quoteCurrency,
      status: pair.status,
      minOrderSize: pair.minOrderSize ?? 0,
      maxOrderSize: pair.maxOrderSize ?? 0,
      tickSize: pair.tickSize ?? 0,
      makerFee: pair.makerFee ?? 0,
      takerFee: pair.takerFee ?? 0
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      symbol: '',
      baseCurrency: '',
      quoteCurrency: '',
      status: 'inactive',
      minOrderSize: 0.0001,
      maxOrderSize: 10000,
      tickSize: 0.01,
      makerFee: 0.001,
      takerFee: 0.002
    });
    setPriceSuggestion(null);
    setPriceError(null);
  };

  const columns = [
    { 
      key: 'symbol', 
      label: 'Trading Pair',
      render: (value: string, row: TradingPair) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-medium text-text-primary">{value}</p>
            <p className="text-xs text-text-tertiary">{row.baseCurrency} / {row.quoteCurrency}</p>
          </div>
        </div>
      )
    },
    { 
      key: 'orderLimits', 
      label: 'Order Limits',
      render: (_: unknown, row: TradingPair) => (
        <div className="text-sm">
          <div className="flex items-center gap-1">
            <span className="text-text-tertiary">Min:</span>
            <span className="text-text-primary font-medium">
              {row.minOrderSize != null ? row.minOrderSize.toFixed(4) : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-text-tertiary">Max:</span>
            <span className="text-text-primary font-medium">
              {row.maxOrderSize != null ? row.maxOrderSize.toLocaleString() : '—'}
            </span>
          </div>
        </div>
      )
    },
    { 
      key: 'tickSize', 
      label: 'Tick Size',
      render: (value: number) => (
        <span className="text-text-primary font-mono text-sm">{value?.toFixed(8)}</span>
      )
    },
    { 
      key: 'fees', 
      label: 'Fees',
      render: (_: unknown, row: TradingPair) => (
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-xs text-text-tertiary">Maker</p>
            <p className="text-sm font-medium text-success">
              {row.makerFee != null ? `${(row.makerFee * 100).toFixed(2)}%` : '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-text-tertiary">Taker</p>
            <p className="text-sm font-medium text-warning">
              {row.takerFee != null ? `${(row.takerFee * 100).toFixed(2)}%` : '—'}
            </p>
          </div>
        </div>
      )
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (_value: string, row: TradingPair) => (
        <StatusDropdown
          status={row.status}
          onChange={(newStatus) => handleQuickStatusChange(row, newStatus)}
          loading={togglingPairs.has(row.id)}
        />
      )
    },
    { 
      key: 'engineStatus', 
      label: 'Engine',
      render: (_: unknown, row: TradingPair) => {
        const shardStatus = getSymbolStatus(row.symbol);
        const isActive = shardStatus?.status === 'active';
        
        return (
          <div className="flex items-center gap-2">
            {isActive ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span className="text-xs text-success font-medium">Running</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-text-tertiary" />
                <span className="text-xs text-text-tertiary">Offline</span>
              </>
            )}
          </div>
        );
      }
    },
    {
      key: 'actions',
      label: '',
      render: (_: unknown, row: TradingPair) => (
        <div className="flex gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); openEditModal(row); }}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-hover transition-colors"
            title="Edit Configuration"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleDeletePair(row); }}
            className="p-2 rounded-lg text-text-secondary hover:text-error hover:bg-error/10 transition-colors"
            title="Delete Pair"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const activePairs = tradingPairs.filter(p => p.status === 'active').length;
  const inactivePairs = tradingPairs.filter(p => p.status === 'inactive').length;
  const maintenancePairs = tradingPairs.filter(p => p.status === 'maintenance').length;
  
  // Calculate average fees
  const avgMakerFee = tradingPairs.length > 0 
    ? tradingPairs.reduce((acc, p) => acc + (p.makerFee ?? 0), 0) / tradingPairs.length * 100
    : 0;
  const avgTakerFee = tradingPairs.length > 0 
    ? tradingPairs.reduce((acc, p) => acc + (p.takerFee ?? 0), 0) / tradingPairs.length * 100
    : 0;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1">
        <Header />
        
        <main className="p-8">
          {/* Stats Row */}
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="bg-surface rounded-xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs uppercase tracking-wider text-text-tertiary">Total Pairs</p>
              </div>
              <p className="text-3xl font-semibold tracking-tight text-text-primary">
                {pagination?.totalItems || tradingPairs.length}
              </p>
            </div>
            
            <div className="bg-surface rounded-xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-success" />
                </div>
                <p className="text-xs uppercase tracking-wider text-text-tertiary">Active</p>
              </div>
              <p className="text-3xl font-semibold tracking-tight text-success">{activePairs}</p>
            </div>
            
            <div className="bg-surface rounded-xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-border-subtle flex items-center justify-center">
                  <Power className="w-5 h-5 text-text-tertiary" />
                </div>
                <p className="text-xs uppercase tracking-wider text-text-tertiary">Inactive</p>
              </div>
              <p className="text-3xl font-semibold tracking-tight text-text-tertiary">{inactivePairs}</p>
            </div>
            
            <div className="bg-surface rounded-xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
                <p className="text-xs uppercase tracking-wider text-text-tertiary">Maintenance</p>
              </div>
              <p className="text-3xl font-semibold tracking-tight text-warning">{maintenancePairs}</p>
            </div>
            
            <div className="bg-surface rounded-xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <Percent className="w-5 h-5 text-info" />
                </div>
                <p className="text-xs uppercase tracking-wider text-text-tertiary">Avg Fees</p>
              </div>
              <div className="flex items-baseline gap-3">
                <div>
                  <span className="text-lg font-semibold text-success">{avgMakerFee.toFixed(2)}%</span>
                  <span className="text-xs text-text-tertiary ml-1">maker</span>
                </div>
                <div>
                  <span className="text-lg font-semibold text-warning">{avgTakerFee.toFixed(2)}%</span>
                  <span className="text-xs text-text-tertiary ml-1">taker</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => { resetForm(); setShowCreateModal(true); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Trading Pair
              </button>
              
              {/* Search */}
              <div className="flex items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-tertiary" />
                  <input
                    type="text"
                    placeholder="Search pairs..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-56"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="px-3 py-2 bg-secondary border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-secondary border border-border rounded-lg p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'table' ? 'bg-hover text-text-primary' : 'text-text-tertiary hover:text-text-primary'
                  }`}
                  title="Table View"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'cards' ? 'bg-hover text-text-primary' : 'text-text-tertiary hover:text-text-primary'
                  }`}
                  title="Card View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
              
              <button 
                onClick={refetch}
                className="flex items-center gap-2 px-4 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-hover text-sm transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 bg-error/10 border border-error/30 rounded-xl text-error flex items-center gap-3">
              <AlertTriangle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-8 h-8 text-text-tertiary animate-spin" />
            </div>
          ) : (
            <>
              {/* Card View */}
              {viewMode === 'cards' ? (
                <div className="grid grid-cols-3 gap-4">
                  {tradingPairs.map(pair => (
                    <TradingPairCard
                      key={pair.id}
                      pair={pair}
                      onEdit={() => openEditModal(pair)}
                      onDelete={() => handleDeletePair(pair)}
                      onStatusChange={(status) => handleQuickStatusChange(pair, status)}
                      isToggling={togglingPairs.has(pair.id)}
                      getSymbolStatus={getSymbolStatus}
                    />
                  ))}
                  {tradingPairs.length === 0 && (
                    <div className="col-span-3 text-center py-16 text-text-tertiary">
                      <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No trading pairs found</p>
                      <p className="text-sm mt-1">Add a new trading pair to get started</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Table View */
                <DataTable 
                  columns={columns} 
                  data={tradingPairs} 
                  onRowClick={(pair) => openEditModal(pair as TradingPair)} 
                />
              )}

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => setPage(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg text-text-secondary hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-text-tertiary text-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg text-text-secondary hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">Add Trading Pair</h2>
                  <p className="text-sm text-text-tertiary">Configure a new trading pair for your exchange</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-hover transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreatePair} className="p-6 space-y-6">
              {/* Currency Selection */}
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4" />
                  Currency Pair
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">Base Currency</label>
                    <select
                      value={formData.baseCurrency}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        baseCurrency: e.target.value,
                        symbol: `${e.target.value}/${prev.quoteCurrency}`
                      }))}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      required
                    >
                      <option value="">Select base token</option>
                      {selectableTokens.map(t => (
                        <option key={t.id} value={t.symbol}>{t.symbol} - {t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">Quote Currency</label>
                    <select
                      value={formData.quoteCurrency}
                      onChange={(e) => setFormData(prev => ({
                      ...prev,
                      quoteCurrency: e.target.value,
                      symbol: `${prev.baseCurrency}/${e.target.value}`
                    }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-text-secondary transition-colors"
                    required
                  >
                    <option value="">Select quote token</option>
                    {selectableTokens.map(t => (
                      <option key={t.id} value={t.symbol}>{t.symbol} - {t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              </div>

              {/* Symbol Preview */}
              {formData.baseCurrency && formData.quoteCurrency && (
                <div className="flex items-center justify-center p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="text-center">
                    <p className="text-xs text-text-tertiary mb-1">Trading Pair Symbol</p>
                    <p className="text-2xl font-bold text-primary">{formData.symbol}</p>
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                  <Power className="w-4 h-4" />
                  Initial Status
                </h3>
                <div className="flex gap-3">
                  {['inactive', 'active', 'maintenance'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, status }))}
                      className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        formData.status === status
                          ? status === 'active' 
                            ? 'bg-success/10 border-success text-success' 
                            : status === 'maintenance'
                              ? 'bg-warning/10 border-warning text-warning'
                              : 'bg-border border-border-subtle text-text-secondary'
                          : 'bg-background border-border text-text-tertiary hover:bg-hover'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Suggestion Section */}
              <div className="border border-border rounded-xl p-4 bg-background">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-warning" />
                    <span className="text-sm font-medium text-text-primary">Auto-Suggest Sizes</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchPriceSuggestion}
                    disabled={isFetchingPrice || !formData.baseCurrency || !formData.quoteCurrency}
                    className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-text-secondary rounded-lg hover:bg-hover text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFetchingPrice ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        Fetch from CoinGecko
                      </>
                    )}
                  </button>
                </div>
                
                {priceError && (
                  <p className="text-xs text-error mb-2">{priceError}</p>
                )}
                
                {priceSuggestion && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-surface rounded-lg p-2 border border-border">
                        <p className="text-text-tertiary">Current Price</p>
                        <p className="text-text-primary font-medium">${priceSuggestion.currentPrice.toLocaleString()}</p>
                      </div>
                      <div className="bg-surface rounded-lg p-2 border border-border">
                        <p className="text-text-tertiary">24h High</p>
                        <p className="text-success font-medium">${priceSuggestion.high24h.toLocaleString()}</p>
                      </div>
                      <div className="bg-surface rounded-lg p-2 border border-border">
                        <p className="text-text-tertiary">24h Low</p>
                        <p className="text-error font-medium">${priceSuggestion.low24h.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="bg-black/50 rounded-lg p-3">
                      <p className="text-xs text-text-muted mb-2">Suggested Values (auto-applied):</p>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <p className="text-text-tertiary">Min Order</p>
                          <p className="text-text-primary font-mono">{priceSuggestion.minOrderSize}</p>
                          <p className="text-text-muted text-xs">~$10 worth</p>
                        </div>
                        <div>
                          <p className="text-text-tertiary">Max Order</p>
                          <p className="text-text-primary font-mono">{priceSuggestion.maxOrderSize.toLocaleString()}</p>
                          <p className="text-text-muted text-xs">~$1M worth</p>
                        </div>
                        <div>
                          <p className="text-text-tertiary">Tick Size</p>
                          <p className="text-text-primary font-mono">{priceSuggestion.tickSize}</p>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-xs text-success text-center">
                      ✓ Values applied to form below. You can still edit them manually.
                    </p>
                  </div>
                )}
                
                {!priceSuggestion && !priceError && (
                  <p className="text-xs text-text-tertiary">
                    Enter base/quote currencies and click "Fetch from CoinGecko" to get suggested order sizes based on 24h price data.
                  </p>
                )}
              </div>

              {/* Order Configuration */}
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Order Limits
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">Min Order Size</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.minOrderSize ?? ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, minOrderSize: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">Max Order Size</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.maxOrderSize ?? ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxOrderSize: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">Tick Size</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.tickSize ?? ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, tickSize: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Fee Configuration */}
              <div>
                <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  Trading Fees
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">Maker Fee</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={formData.makerFee ?? ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, makerFee: parseFloat(e.target.value) }))}
                        className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 pr-16"
                        required
                      />
                      <span className="absolute right-3 top-2.5 text-sm text-success">{((formData.makerFee ?? 0) * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">Taker Fee</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={formData.takerFee ?? ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, takerFee: parseFloat(e.target.value) }))}
                        className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 pr-16"
                        required
                      />
                      <span className="absolute right-3 top-2.5 text-sm text-warning">{((formData.takerFee ?? 0) * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-hover text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? 'Creating...' : 'Create Trading Pair'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedPair && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <Settings2 className="w-5 h-5 text-info" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">Edit {selectedPair.symbol}</h2>
                  <p className="text-sm text-text-tertiary">Configure trading pair settings</p>
                </div>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-hover transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form id="editForm" onSubmit={handleEditPair} className="p-6 space-y-6">
              {/* Pair Info */}
              <div className="flex items-center justify-center p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-text-tertiary mb-1">Trading Pair</p>
                  <p className="text-2xl font-bold text-primary">{selectedPair.symbol}</p>
                  <p className="text-sm text-text-secondary mt-1">{selectedPair.baseCurrency} / {selectedPair.quoteCurrency}</p>
                </div>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Status</label>
                <div className="grid grid-cols-4 gap-2">
                  {['inactive', 'active', 'maintenance', 'delisted'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, status }))}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium capitalize transition-all ${
                        formData.status === status
                          ? status === 'active' 
                            ? 'bg-success/20 text-success border-2 border-success'
                            : status === 'maintenance'
                            ? 'bg-warning/20 text-warning border-2 border-warning'
                            : status === 'delisted'
                            ? 'bg-error/20 text-error border-2 border-error'
                            : 'bg-text-secondary/20 text-text-secondary border-2 border-text-secondary'
                          : 'bg-surface border border-border text-text-secondary hover:bg-hover'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Limits Section */}
              <div className="pt-4 border-t border-border">
                <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-text-secondary" />
                  Order Limits
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1.5">Min Order Size</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.minOrderSize ?? ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, minOrderSize: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-text-secondary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1.5">Max Order Size</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.maxOrderSize ?? ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxOrderSize: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-text-secondary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1.5">Tick Size</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.tickSize ?? ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, tickSize: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-text-secondary transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Trading Fees Section */}
              <div className="pt-4 border-t border-border">
                <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-text-secondary" />
                  Trading Fees
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-secondary mb-1.5">Maker Fee</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={formData.makerFee ?? ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, makerFee: parseFloat(e.target.value) }))}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-text-secondary transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">
                        {((formData.makerFee ?? 0) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1.5">Taker Fee</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={formData.takerFee ?? ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, takerFee: parseFloat(e.target.value) }))}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-text-secondary transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">
                        {((formData.takerFee ?? 0) * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="flex gap-3 p-5 border-t border-border">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-surface text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="editForm"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 bg-accent text-white rounded-xl hover:bg-accent/90 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Update Trading Pair'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
