'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  listChains,
  getChain,
  createChain,
  updateChain,
  deleteChain,
  type Chain,
  type ChainsListParams,
  type CreateChainParams,
  type UpdateChainParams
} from '@/services/chains';
import type { PaginatedResponse } from '@/libs/api';

export function useChains(initialParams: ChainsListParams = {}) {
  const [data, setData] = useState<PaginatedResponse<Chain> | null>(null);
  const [params, setParams] = useState(initialParams);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChains = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await listChains(params);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chains');
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchChains();
  }, [fetchChains]);

  const setPage = (page: number) => {
    setParams(prev => ({ ...prev, page }));
  };

  const setSearch = (search: string) => {
    setParams(prev => ({ ...prev, search, page: 1 }));
  };

  const setIsActive = (isActive: boolean | undefined) => {
    setParams(prev => ({ ...prev, isActive, page: 1 }));
  };

  const create = async (data: CreateChainParams) => {
    try {
      const result = await createChain(data);
      await fetchChains();
      return result;
    } catch (err) {
      throw err;
    }
  };

  const update = async (id: string, updateData: UpdateChainParams) => {
    // Optimistic update for better UX
    const previousData = data;
    
    if (data) {
      setData({
        ...data,
        data: data.data.map(chain => 
          chain.id === id ? { ...chain, ...updateData } : chain
        )
      });
    }

    try {
      await updateChain(id, updateData);
      // Refetch to ensure data consistency
      await fetchChains();
    } catch (err) {
      // Revert on error
      if (previousData) {
        setData(previousData);
      }
      throw err;
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteChain(id);
      await fetchChains();
    } catch (err) {
      throw err;
    }
  };

  return {
    chains: data?.data || [],
    pagination: data?.pagination,
    isLoading,
    error,
    refetch: fetchChains,
    setPage,
    setSearch,
    setIsActive,
    create,
    update,
    remove
  };
}
