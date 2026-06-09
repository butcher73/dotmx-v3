/**
 * Trading Pairs API Service
 */

import { api, type PaginatedResponse } from '@/libs/api';

export interface TradingPair {
  id: string;
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  status: 'active' | 'inactive' | 'maintenance';
  minOrderSize: number | null;
  maxOrderSize: number | null;
  tickSize: number | null;
  makerFee: number | null;
  takerFee: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradingPairsListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface CreateTradingPairParams {
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  status?: string;
  minOrderSize: number;
  maxOrderSize: number;
  tickSize: number;
  makerFee: number;
  takerFee: number;
}

export interface UpdateTradingPairParams {
  status?: string;
  minOrderSize?: number;
  maxOrderSize?: number;
  tickSize?: number;
  makerFee?: number;
  takerFee?: number;
}

export const tradingPairsService = {
  /**
   * Get paginated list of trading pairs
   */
  getTradingPairs: (params: TradingPairsListParams = {}) =>
    api.get<PaginatedResponse<TradingPair>>('/trading-pairs', params),
  
  /**
   * Create a new trading pair
   */
  createTradingPair: (data: CreateTradingPairParams) =>
    api.post<{ success: boolean; id: string }>('/trading-pairs', data),
  
  /**
   * Update trading pair
   */
  updateTradingPair: (pairId: string, data: UpdateTradingPairParams) =>
    api.patch<{ success: boolean }>(`/trading-pairs/${pairId}`, data),
  
  /**
   * Delete trading pair
   */
  deleteTradingPair: (pairId: string) =>
    api.delete<{ success: boolean }>(`/trading-pairs/${pairId}`)
};
