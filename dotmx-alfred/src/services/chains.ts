/**
 * Chains API Service
 */

import { api, type PaginatedResponse } from '@/libs/api';

export interface Chain {
  id: string;
  code: string;
  name: string;
  chainType: 'EVM' | 'SOL' | 'TRON' | 'BTC' | 'DOGE';
  chainId: number | null;
  networkType: 'mainnet' | 'testnet';
  rpcUrl: string | null;
  explorerUrl: string | null;
  nativeCurrencySymbol: string;
  nativeCurrencyDecimals: number;
  isActive: boolean;
  depositEnabled: boolean;
  withdrawalEnabled: boolean;
  minConfirmations: number;
  avgBlockTimeSeconds: number;
  iconUrl: string | null;
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ChainsListParams {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
  search?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface CreateChainParams {
  code: string;
  name: string;
  chainType?: 'EVM' | 'SOL' | 'TRON' | 'BTC' | 'DOGE';
  chainId?: number;
  networkType?: 'mainnet' | 'testnet';
  rpcUrl?: string;
  explorerUrl?: string;
  nativeCurrencySymbol: string;
  nativeCurrencyDecimals?: number;
  isActive?: boolean;
  depositEnabled?: boolean;
  withdrawalEnabled?: boolean;
  minConfirmations?: number;
  avgBlockTimeSeconds?: number;
  iconUrl?: string;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateChainParams {
  name?: string;
  chainType?: 'EVM' | 'SOL' | 'TRON' | 'BTC' | 'DOGE';
  chainId?: number;
  networkType?: 'mainnet' | 'testnet';
  rpcUrl?: string;
  explorerUrl?: string;
  nativeCurrencySymbol?: string;
  nativeCurrencyDecimals?: number;
  isActive?: boolean;
  depositEnabled?: boolean;
  withdrawalEnabled?: boolean;
  minConfirmations?: number;
  avgBlockTimeSeconds?: number;
  iconUrl?: string;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

/**
 * List chains with pagination
 */
export async function listChains(params?: ChainsListParams): Promise<PaginatedResponse<Chain>> {
  return api.get('/chains', params);
}

/**
 * Get single chain by ID
 */
export async function getChain(id: string): Promise<Chain> {
  return api.get(`/chains/${id}`);
}

/**
 * Create new chain
 */
export async function createChain(data: CreateChainParams): Promise<{ success: boolean; id?: string; error?: string }> {
  return api.post('/chains', data);
}

/**
 * Update existing chain
 */
export async function updateChain(id: string, data: UpdateChainParams): Promise<{ success: boolean; error?: string }> {
  return api.patch(`/chains/${id}`, data);
}

/**
 * Delete chain
 */
export async function deleteChain(id: string): Promise<{ success: boolean; error?: string }> {
  return api.delete(`/chains/${id}`);
}
