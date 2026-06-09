'use client';

import { useState, useEffect, useCallback } from 'react';
import { marketDataService, type Ticker24h, type MarketDataHealth, type SymbolInfo } from '@/services/market-data';

export function useMarketData() {
  const [health, setHealth] = useState<MarketDataHealth | null>(null);
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const response = await marketDataService.getHealth();
      setHealth(response);
    } catch (err) {
      console.warn('Market data health check failed:', err instanceof Error ? err.message : 'Unknown error');
      // Don't set error state on health check, just warn
    }
  }, []);

  const fetchSymbols = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const symbolList = await marketDataService.getSymbols();
      setSymbols(symbolList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch symbols');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchSymbols();
    
    // Poll health every 10 seconds
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [fetchHealth, fetchSymbols]);

  return {
    health,
    symbols,
    isLoading,
    error,
    refetch: () => {
      fetchHealth();
      fetchSymbols();
    },
  };
}

export function useTicker(symbol: string | null) {
  const [ticker, setTicker] = useState<Ticker24h | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTicker = useCallback(async () => {
    if (!symbol) {
      setTicker(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await marketDataService.getTicker(symbol);
      setTicker(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ticker');
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchTicker();
    
    // Poll ticker every 2 seconds
    const interval = setInterval(fetchTicker, 2000);
    return () => clearInterval(interval);
  }, [fetchTicker]);

  return {
    ticker,
    isLoading,
    error,
    refetch: fetchTicker,
  };
}
