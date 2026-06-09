'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import DataTable from '@/components/DataTable';
import { TrendingUp, TrendingDown, Activity, Database, RefreshCw, Server } from 'lucide-react';
import { useMarketData } from '@/hooks';
import { marketDataService, type Ticker24h } from '@/services/market-data';

export default function MarketDataPage() {
  const { health, symbols, isLoading, error, refetch } = useMarketData();
  const [tickers, setTickers] = useState<Map<string, Ticker24h>>(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch tickers for all symbols
  useEffect(() => {
    if (!symbols.length) return;

    const fetchAllTickers = async () => {
      const tickerMap = new Map<string, Ticker24h>();
      
      await Promise.allSettled(
        symbols.map(async (s) => {
          try {
            const ticker = await marketDataService.getTicker(s.symbol);
            tickerMap.set(s.symbol, ticker);
          } catch (err) {
            console.warn(`Failed to fetch ticker for ${s.symbol}:`, err);
          }
        })
      );
      
      setTickers(tickerMap);
    };

    fetchAllTickers();
    
    // Refresh tickers every 5 seconds
    const interval = setInterval(fetchAllTickers, 5000);
    return () => clearInterval(interval);
  }, [symbols]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const formatNumber = (value: string | number, decimals: number = 2) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '—';
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    });
  };

  const formatVolume = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '—';
    
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const columns = [
    {
      key: 'symbol',
      label: 'Symbol',
      sortable: true,
      render: (_value: unknown, item: Ticker24h) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-text-primary">{item.symbol}</span>
        </div>
      ),
    },
    {
      key: 'lastPrice',
      label: 'Last Price',
      sortable: true,
      render: (_value: unknown, item: Ticker24h) => (
        <span className="font-mono text-text-primary">
          ${formatNumber(item.lastPrice, 4)}
        </span>
      ),
    },
    {
      key: 'priceChange',
      label: '24h Change',
      sortable: true,
      render: (_value: unknown, item: Ticker24h) => {
        const change = parseFloat(item.priceChangePercent);
        const isPositive = change >= 0;
        
        return (
          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-success" />
            ) : (
              <TrendingDown className="w-4 h-4 text-error" />
            )}
            <span className={`font-semibold ${isPositive ? 'text-success' : 'text-error'}`}>
              {isPositive ? '+' : ''}{change.toFixed(2)}%
            </span>
          </div>
        );
      },
    },
    {
      key: 'high',
      label: '24h High',
      sortable: true,
      render: (_value: unknown, item: Ticker24h) => (
        <span className="font-mono text-success">${formatNumber(item.high, 4)}</span>
      ),
    },
    {
      key: 'low',
      label: '24h Low',
      sortable: true,
      render: (_value: unknown, item: Ticker24h) => (
        <span className="font-mono text-error">${formatNumber(item.low, 4)}</span>
      ),
    },
    {
      key: 'volume',
      label: '24h Volume',
      sortable: true,
      render: (_value: unknown, item: Ticker24h) => (
        <span className="font-mono text-text-secondary">{formatVolume(item.volume)}</span>
      ),
    },
    {
      key: 'quoteVolume',
      label: '24h Quote Vol',
      sortable: true,
      render: (_value: unknown, item: Ticker24h) => (
        <span className="font-mono text-text-secondary">${formatVolume(item.quoteVolume)}</span>
      ),
    },
    {
      key: 'bid',
      label: 'Bid',
      sortable: true,
      render: (_value: unknown, item: Ticker24h) => (
        <span className="font-mono text-success">${formatNumber(item.bid, 4)}</span>
      ),
    },
    {
      key: 'ask',
      label: 'Ask',
      sortable: true,
      render: (_value: unknown, item: Ticker24h) => (
        <span className="font-mono text-error">${formatNumber(item.ask, 4)}</span>
      ),
    },
  ];

  const tickerData = Array.from(tickers.values());

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <Header />
        
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-text-primary mb-2">Market Data</h1>
              <p className="text-text-secondary">Real-time market data for all trading pairs</p>
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-hover transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Health Status */}
          {health && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-surface border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-text-tertiary">Service Status</span>
                  <Server className="w-4 h-4 text-text-tertiary" />
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${health.status === 'ok' ? 'bg-success' : 'bg-warning'}`} />
                  <span className="text-lg font-semibold text-text-primary capitalize">
                    {health.status}
                  </span>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-text-tertiary">Data Sources</span>
                  <Database className="w-4 h-4 text-text-tertiary" />
                </div>
                <div className="text-lg font-semibold text-text-primary">
                  {Object.values(health.sources).filter(connected => connected).length} / {Object.keys(health.sources).length}
                  <span className="text-sm font-normal text-text-tertiary ml-2">connected</span>
                </div>
                <div className="flex gap-2 mt-3">
                  {Object.entries(health.sources).map(([name, connected]) => (
                    <div key={name} className="flex items-center gap-1.5 text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success' : 'bg-error'}`} />
                      <span className="text-text-secondary capitalize">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Service Unavailable State */}
          {isLoading && !error && !health && !symbols.length && (
            <div className="bg-warning/10 border border-warning/20 rounded-xl p-6 mb-6">
              <p className="text-sm text-warning">
                <strong>Connecting to market data service...</strong> Make sure the market data server is running (NGINX gateway on port 8080).
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-error/10 border border-error/20 rounded-xl p-4 mb-6">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Data Table */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {tickerData.length > 0 ? (
              <DataTable
                columns={columns}
                data={tickerData}
              />
            ) : (
              <div className="p-12 text-center text-text-tertiary">
                {isLoading ? 'Loading market data...' : 'No market data available'}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
