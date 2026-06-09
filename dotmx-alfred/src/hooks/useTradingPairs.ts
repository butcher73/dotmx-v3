'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  tradingPairsService, 
  type TradingPair,
  type TradingPairsListParams,
  type CreateTradingPairParams,
  type UpdateTradingPairParams
} from '@/services/trading-pairs';
import type { PaginatedResponse } from '@/libs/api';

export function useTradingPairs(initialParams: TradingPairsListParams = {}) {
  const [data, setData] = useState<PaginatedResponse<TradingPair> | null>(null);
  const [params, setParams] = useState(initialParams);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTradingPairs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await tradingPairsService.getTradingPairs(params);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trading pairs');
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchTradingPairs();
  }, [fetchTradingPairs]);

  const setPage = (page: number) => {
    setParams(prev => ({ ...prev, page }));
  };

  const setSearch = (search: string) => {
    setParams(prev => ({ ...prev, search, page: 1 }));
  };

  const setStatus = (status: string | undefined) => {
    setParams(prev => ({ ...prev, status, page: 1 }));
  };

  const createPair = async (data: CreateTradingPairParams) => {
    try {
      const result = await tradingPairsService.createTradingPair(data);
      await fetchTradingPairs();
      return result;
    } catch (err) {
      throw err;
    }
  };

  const updatePair = async (pairId: string, updateData: UpdateTradingPairParams) => {
    // Optimistic update for better UX
    const previousData = data;
    
    if (data) {
      setData({
        ...data,
        data: data.data.map(pair => 
          pair.id === pairId ? { ...pair, ...updateData } as TradingPair : pair
        )
      });
    }

    try {
      await tradingPairsService.updateTradingPair(pairId, updateData);
      // Refetch to ensure data consistency
      await fetchTradingPairs();
    } catch (err) {
      // Revert on error
      if (previousData) {
        setData(previousData);
      }
      throw err;
    }
  };

  const deletePair = async (pairId: string) => {
    try {
      await tradingPairsService.deleteTradingPair(pairId);
      await fetchTradingPairs();
    } catch (err) {
      throw err;
    }
  };

  return {
    tradingPairs: data?.data || [],
    pagination: data?.pagination,
    isLoading,
    error,
    refetch: fetchTradingPairs,
    setPage,
    setSearch,
    setStatus,
    createPair,
    updatePair,
    deletePair,
    params
  };
}
