/**
 * Tokens API Service
 */

import { api, type PaginatedResponse } from '@/libs/api';

export interface TokenChain {
  id: string;
  code: string;
  name: string;
  chainType: 'EVM' | 'SOL' | 'TRON' | 'BTC' | 'DOGE';
  contractAddress: string | null;
  decimals: number;
  isNative: boolean;
  isActive: boolean;
  depositEnabled: boolean;
  withdrawalEnabled: boolean;
  minDeposit: number;
  maxDeposit: number | null;
  minWithdrawal: number;
  maxWithdrawal: number | null;
  withdrawalFee: number;
  withdrawalFeeType: 'fixed' | 'percentage';
}

export interface Token {
  id: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  coingeckoId: string | null;
  isStablecoin: boolean;
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  chains: TokenChain[];
}

export interface TokensListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface CreateTokenParams {
  symbol: string;
  name: string;
  logoUrl?: string;
  coingeckoId?: string;
  isStablecoin?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
  chains?: AddTokenChainParams[];
}

export interface UpdateTokenParams {
  name?: string;
  logoUrl?: string;
  coingeckoId?: string;
  isStablecoin?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export interface AddTokenChainParams {
  chainId: string;
  contractAddress?: string;
  decimals?: number;
  isNative?: boolean;
  isActive?: boolean;
  depositEnabled?: boolean;
  withdrawalEnabled?: boolean;
  minDeposit?: number;
  maxDeposit?: number;
  minWithdrawal?: number;
  maxWithdrawal?: number;
  withdrawalFee?: number;
  withdrawalFeeType?: 'fixed' | 'percentage';
}

export interface UpdateTokenChainParams {
  contractAddress?: string;
  decimals?: number;
  isNative?: boolean;
  isActive?: boolean;
  depositEnabled?: boolean;
  withdrawalEnabled?: boolean;
  minDeposit?: number;
  maxDeposit?: number;
  minWithdrawal?: number;
  maxWithdrawal?: number;
  withdrawalFee?: number;
  withdrawalFeeType?: 'fixed' | 'percentage';
}

/**
 * List tokens with pagination and their chains
 */
export async function listTokens(params?: TokensListParams): Promise<PaginatedResponse<Token>> {
  return api.get('/tokens', params);
}

/**
 * Get single token by ID with chains
 */
export async function getToken(id: string): Promise<Token> {
  return api.get(`/tokens/${id}`);
}

/**
 * Create new token
 */
export async function createToken(data: CreateTokenParams): Promise<{ success: boolean; id?: string; error?: string }> {
  return api.post('/tokens', data);
}

/**
 * Update existing token
 */
export async function updateToken(id: string, data: UpdateTokenParams): Promise<{ success: boolean; error?: string }> {
  return api.patch(`/tokens/${id}`, data);
}

/**
 * Delete token
 */
export async function deleteToken(id: string): Promise<{ success: boolean; error?: string }> {
  return api.delete(`/tokens/${id}`);
}

/**
 * Add chain to token
 */
export async function addTokenChain(tokenId: string, data: AddTokenChainParams): Promise<{ success: boolean; error?: string }> {
  return api.post(`/tokens/${tokenId}/chains`, data);
}

/**
 * Update token chain configuration
 */
export async function updateTokenChain(tokenId: string, chainId: string, data: UpdateTokenChainParams): Promise<{ success: boolean; error?: string }> {
  return api.patch(`/tokens/${tokenId}/chains/${chainId}`, data);
}

/**
 * Remove chain from token
 */
export async function removeTokenChain(tokenId: string, chainId: string): Promise<{ success: boolean; error?: string }> {
  return api.delete(`/tokens/${tokenId}/chains/${chainId}`);
}
