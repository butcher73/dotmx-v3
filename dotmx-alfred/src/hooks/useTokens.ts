'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  listTokens,
  getToken,
  createToken,
  updateToken,
  deleteToken,
  addTokenChain,
  updateTokenChain,
  removeTokenChain,
  type Token,
  type TokensListParams,
  type CreateTokenParams,
  type UpdateTokenParams,
  type AddTokenChainParams,
  type UpdateTokenChainParams
} from '@/services/tokens';
import type { PaginatedResponse } from '@/libs/api';

export function useTokens(initialParams: TokensListParams = {}) {
  const [data, setData] = useState<PaginatedResponse<Token> | null>(null);
  const [params, setParams] = useState(initialParams);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await listTokens(params);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tokens');
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const setPage = (page: number) => {
    setParams(prev => ({ ...prev, page }));
  };

  const setSearch = (search: string) => {
    setParams(prev => ({ ...prev, search, page: 1 }));
  };

  const create = async (data: CreateTokenParams) => {
    try {
      const result = await createToken(data);
      await fetchTokens();
      return result;
    } catch (err) {
      throw err;
    }
  };

  const update = async (id: string, data: UpdateTokenParams) => {
    try {
      await updateToken(id, data);
      await fetchTokens();
    } catch (err) {
      throw err;
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteToken(id);
      await fetchTokens();
    } catch (err) {
      throw err;
    }
  };

  const addChain = async (tokenId: string, data: AddTokenChainParams) => {
    try {
      await addTokenChain(tokenId, data);
      await fetchTokens();
    } catch (err) {
      throw err;
    }
  };

  const updateChain = async (tokenId: string, chainId: string, updateData: UpdateTokenChainParams) => {
    // Optimistic update for better UX
    const previousData = data;
    
    if (data) {
      setData({
        ...data,
        data: data.data.map(token => {
          if (token.id === tokenId) {
            return {
              ...token,
              chains: token.chains.map(chain => 
                chain.id === chainId ? { ...chain, ...updateData } : chain
              )
            };
          }
          return token;
        })
      });
    }

    try {
      await updateTokenChain(tokenId, chainId, updateData);
      // Refetch to ensure data consistency
      await fetchTokens();
    } catch (err) {
      // Revert on error
      if (previousData) {
        setData(previousData);
      }
      throw err;
    }
  };

  const removeChain = async (tokenId: string, chainId: string) => {
    try {
      await removeTokenChain(tokenId, chainId);
      await fetchTokens();
    } catch (err) {
      throw err;
    }
  };

  return {
    tokens: data?.data || [],
    pagination: data?.pagination,
    isLoading,
    error,
    refetch: fetchTokens,
    setPage,
    setSearch,
    create,
    update,
    remove,
    addChain,
    updateChain,
    removeChain
  };
}
