'use client';

import { useState, useEffect, useCallback } from 'react';
import { engineService, type EngineHealth, type ShardStatus } from '@/services/engine';

export function useEngineStatus() {
  const [health, setHealth] = useState<EngineHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await engineService.getHealth();
      setHealth(response);
    } catch (err) {
      console.warn('Engine health check failed:', err instanceof Error ? err.message : 'Unknown error');
      // Don't set error state, just warn - engine being unavailable is not a fatal error
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    
    // Poll every 5 seconds
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const getSymbolStatus = useCallback((symbol: string): ShardStatus | null => {
    if (!health || !health.symbols) return null;
    return health.symbols.find(s => s.symbol === symbol) || null;
  }, [health]);

  return {
    health,
    isLoading,
    error,
    refetch: fetchHealth,
    getSymbolStatus,
  };
}
