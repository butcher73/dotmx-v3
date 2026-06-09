/**
 * Tokens Management Routes
 */

import { Elysia, t } from 'elysia';
import type { DatabaseService } from '@dotmx/shared';
import type { Token, TokenChain, TokenWithChains, PaginatedResponse } from '../types';

export function createTokensRoutes(db: DatabaseService) {
  console.log('🔧 [Tokens] Routes initialized');
  return new Elysia({ prefix: '/tokens' })
    // List all tokens with their chains
    .get(
      '/',
      async ({ query }) => {
        const page = query.page || 1;
        const pageSize = query.pageSize || 50;
        const offset = (page - 1) * pageSize;
        
        try {
          let whereClause = 'WHERE 1=1';
          const params: (string | number)[] = [];
          let paramIndex = 1;
          
          if (query.search) {
            whereClause += ` AND (t.symbol ILIKE $${paramIndex} OR t.name ILIKE $${paramIndex})`;
            params.push(`%${query.search}%`);
            paramIndex++;
          }
          
          // Get total count
          const countResult = await db.queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM assets t ${whereClause}`,
            params
          );
          const totalItems = parseInt(countResult?.count || '0', 10);
          
          // Get tokens
          const tokens = await db.query<{
            id: string;
            symbol: string;
            name: string;
            logo_url: string | null;
            coingecko_id: string | null;
            is_stablecoin: boolean;
            sort_order: number;
            metadata: Record<string, unknown>;
            created_at: string;
            updated_at: string;
          }>(
            `SELECT *
             FROM assets t
             ${whereClause}
             ORDER BY sort_order ASC, symbol ASC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, pageSize, offset]
          );
          
          // Get chains for each token
          const tokenIds = tokens.map(t => t.id);
          let chains: Array<{
            token_id: string;
            chain_id: string;
            chain_code: string;
            chain_name: string;
            chain_type: string;
            contract_address: string | null;
            decimals: number;
            is_native: boolean;
            is_active: boolean;
            deposit_enabled: boolean;
            withdrawal_enabled: boolean;
            min_deposit: string;
            max_deposit: string | null;
            min_withdrawal: string;
            max_withdrawal: string | null;
            withdrawal_fee: string;
            withdrawal_fee_type: string;
          }> = [];
          
          if (tokenIds.length > 0) {
            const placeholders = tokenIds.map((_, i) => `$${i + 1}`).join(',');
            chains = await db.query(
              `SELECT 
                tc.id as id,
                tc.asset_id as token_id,
                tc.network_id as chain_id,
                c.code as chain_code,
                c.name as chain_name,
                c.chain_type,
                tc.contract_address,
                tc.decimals,
                tc.is_native,
                tc.is_active,
                tc.deposit_enabled,
                tc.withdrawal_enabled,
                tc.min_deposit,
                tc.max_deposit,
                tc.min_withdrawal,
                tc.max_withdrawal,
                tc.withdrawal_fee,
                tc.withdrawal_fee_type
              FROM asset_networks tc
              JOIN networks c ON tc.network_id = c.id
              WHERE tc.asset_id IN (${placeholders})
              ORDER BY c.sort_order ASC`,
              tokenIds
            );
          }
          
          const tokensWithChains: TokenWithChains[] = tokens.map(t => ({
            id: t.id,
            symbol: t.symbol,
            name: t.name,
            logoUrl: t.logo_url,
            coingeckoId: t.coingecko_id,
            isStablecoin: t.is_stablecoin,
            sortOrder: t.sort_order,
            metadata: t.metadata,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            chains: chains
              .filter(c => c.token_id === t.id)
              .map(c => ({
                id: c.chain_id,
                code: c.chain_code,
                name: c.chain_name,
                chainType: (c.chain_type || 'EVM') as TokenChain['chainType'],
                contractAddress: c.contract_address,
                decimals: c.decimals,
                isNative: c.is_native,
                isActive: c.is_active,
                depositEnabled: c.deposit_enabled,
                withdrawalEnabled: c.withdrawal_enabled,
                minDeposit: parseFloat(c.min_deposit),
                maxDeposit: c.max_deposit ? parseFloat(c.max_deposit) : null,
                minWithdrawal: parseFloat(c.min_withdrawal),
                maxWithdrawal: c.max_withdrawal ? parseFloat(c.max_withdrawal) : null,
                withdrawalFee: parseFloat(c.withdrawal_fee),
                withdrawalFeeType: c.withdrawal_fee_type as 'fixed' | 'percentage'
              }))
          }));
          
          const response: PaginatedResponse<TokenWithChains> = {
            data: tokensWithChains,
            pagination: {
              page,
              pageSize,
              totalItems,
              totalPages: Math.ceil(totalItems / pageSize)
            }
          };
          
          return response;
        } catch (error) {
          console.error('[Tokens] Failed to fetch:', error);
          return {
            data: [],
            pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 }
          };
        }
      },
      {
        query: t.Object({
          page: t.Optional(t.Number({ minimum: 1 })),
          pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
          search: t.Optional(t.String())
        }),
        detail: {
          tags: ['tokens'],
          summary: 'List tokens',
          description: 'Get paginated list of tokens with their chain configurations'
        }
      }
    )
    
    // Get single token with chains
    .get(
      '/:id',
      async ({ params }) => {
        try {
          const token = await db.queryOne<{
            id: string;
            symbol: string;
            name: string;
            logo_url: string | null;
            coingecko_id: string | null;
            is_stablecoin: boolean;
            sort_order: number;
            metadata: Record<string, unknown>;
            created_at: string;
            updated_at: string;
          }>(
            `SELECT * FROM assets WHERE id = $1`,
            [params.id]
          );
          
          if (!token) {
            return { error: 'Token not found' };
          }
          
          // Get chains for token
          const chains = await db.query<{
            id: string;
            chain_id: string;
            chain_code: string;
            chain_name: string;
            chain_type: string;
            contract_address: string | null;
            decimals: number;
            is_native: boolean;
            is_active: boolean;
            deposit_enabled: boolean;
            withdrawal_enabled: boolean;
            min_deposit: string;
            max_deposit: string | null;
            min_withdrawal: string;
            max_withdrawal: string | null;
            withdrawal_fee: string;
            withdrawal_fee_type: string;
          }>(
            `SELECT 
              tc.id,
              tc.network_id as chain_id,
              c.code as chain_code,
              c.name as chain_name,
              c.chain_type,
              tc.contract_address,
              tc.decimals,
              tc.is_native,
              tc.is_active,
              tc.deposit_enabled,
              tc.withdrawal_enabled,
              tc.min_deposit,
              tc.max_deposit,
              tc.min_withdrawal,
              tc.max_withdrawal,
              tc.withdrawal_fee,
              tc.withdrawal_fee_type
            FROM asset_networks tc
            JOIN networks c ON tc.network_id = c.id
            WHERE tc.asset_id = $1
            ORDER BY c.sort_order ASC`,
            [params.id]
          );
          
          return {
            id: token.id,
            symbol: token.symbol,
            name: token.name,
            logoUrl: token.logo_url,
            coingeckoId: token.coingecko_id,
            isStablecoin: token.is_stablecoin,
            sortOrder: token.sort_order,
            metadata: token.metadata,
            createdAt: token.created_at,
            updatedAt: token.updated_at,
            chains: chains.map(c => ({
              id: c.chain_id,
              code: c.chain_code,
              name: c.chain_name,
              chainType: (c.chain_type || 'EVM') as TokenChain['chainType'],
              contractAddress: c.contract_address,
              decimals: c.decimals,
              isNative: c.is_native,
              isActive: c.is_active,
              depositEnabled: c.deposit_enabled,
              withdrawalEnabled: c.withdrawal_enabled,
              minDeposit: parseFloat(c.min_deposit),
              maxDeposit: c.max_deposit ? parseFloat(c.max_deposit) : null,
              minWithdrawal: parseFloat(c.min_withdrawal),
              maxWithdrawal: c.max_withdrawal ? parseFloat(c.max_withdrawal) : null,
              withdrawalFee: parseFloat(c.withdrawal_fee),
              withdrawalFeeType: c.withdrawal_fee_type as 'fixed' | 'percentage'
            }))
          };
        } catch (error) {
          console.error('[Tokens] Failed to fetch token:', error);
          return { error: 'Failed to fetch token' };
        }
      },
      {
        params: t.Object({
          id: t.String()
        }),
        detail: {
          tags: ['tokens'],
          summary: 'Get token',
          description: 'Get details of a specific token with all chain configurations'
        }
      }
    )
    
    // Create new token
    .post(
      '/',
      async ({ body }) => {
        try {
          // Start transaction
          const token = await db.queryOne<{ id: string }>(
            `INSERT INTO assets (
              symbol, name, logo_url, coingecko_id, is_stablecoin, sort_order, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`,
            [
              body.symbol,
              body.name,
              body.logoUrl || null,
              body.coingeckoId || null,
              body.isStablecoin || false,
              body.sortOrder || 0,
              body.metadata || {}
            ]
          );
          
          if (!token?.id) {
            return { success: false, error: 'Failed to create token' };
          }
          
          // Add chains if provided
          if (body.chains && body.chains.length > 0) {
            for (const chain of body.chains) {
              await db.execute(
                `INSERT INTO asset_networks (
                  asset_id, network_id, contract_address, decimals, is_native,
                  is_active, deposit_enabled, withdrawal_enabled,
                  min_deposit, max_deposit, min_withdrawal, max_withdrawal,
                  withdrawal_fee, withdrawal_fee_type
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [
                  token.id,
                  chain.chainId,
                  chain.contractAddress || null,
                  chain.decimals || 18,
                  chain.isNative || false,
                  chain.isActive !== undefined ? chain.isActive : true,
                  chain.depositEnabled !== undefined ? chain.depositEnabled : true,
                  chain.withdrawalEnabled !== undefined ? chain.withdrawalEnabled : true,
                  chain.minDeposit || 0,
                  chain.maxDeposit || null,
                  chain.minWithdrawal || 0,
                  chain.maxWithdrawal || null,
                  chain.withdrawalFee || 0,
                  chain.withdrawalFeeType || 'fixed'
                ]
              );
            }
          }
          
          return { success: true, id: token.id };
        } catch (error) {
          console.error('[Tokens] Failed to create:', error);
          return { success: false, error: 'Failed to create token' };
        }
      },
      {
        body: t.Object({
          symbol: t.String({ minLength: 1, maxLength: 20 }),
          name: t.String({ minLength: 1, maxLength: 100 }),
          logoUrl: t.Optional(t.String()),
          coingeckoId: t.Optional(t.String()),
          isStablecoin: t.Optional(t.Boolean()),
          sortOrder: t.Optional(t.Number()),
          metadata: t.Optional(t.Record(t.String(), t.Any())),
          chains: t.Optional(t.Array(t.Object({
            chainId: t.String(),
            contractAddress: t.Optional(t.String()),
            decimals: t.Optional(t.Number()),
            isNative: t.Optional(t.Boolean()),
            isActive: t.Optional(t.Boolean()),
            depositEnabled: t.Optional(t.Boolean()),
            withdrawalEnabled: t.Optional(t.Boolean()),
            minDeposit: t.Optional(t.Number()),
            maxDeposit: t.Optional(t.Number()),
            minWithdrawal: t.Optional(t.Number()),
            maxWithdrawal: t.Optional(t.Number()),
            withdrawalFee: t.Optional(t.Number()),
            withdrawalFeeType: t.Optional(t.Union([t.Literal('fixed'), t.Literal('percentage')]))
          })))
        }),
        detail: {
          tags: ['tokens'],
          summary: 'Create token',
          description: 'Add a new token with optional chain configurations'
        }
      }
    )
    
    // Update token
    .patch(
      '/:id',
      async ({ params, body }) => {
        try {
          const updates: string[] = [];
          const values: unknown[] = [];
          let paramIndex = 1;
          
          if (body.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(body.name);
          }
          if (body.logoUrl !== undefined) {
            updates.push(`logo_url = $${paramIndex++}`);
            values.push(body.logoUrl);
          }
          if (body.coingeckoId !== undefined) {
            updates.push(`coingecko_id = $${paramIndex++}`);
            values.push(body.coingeckoId);
          }
          if (body.isStablecoin !== undefined) {
            updates.push(`is_stablecoin = $${paramIndex++}`);
            values.push(body.isStablecoin);
          }
          if (body.sortOrder !== undefined) {
            updates.push(`sort_order = $${paramIndex++}`);
            values.push(body.sortOrder);
          }
          if (body.metadata !== undefined) {
            updates.push(`metadata = $${paramIndex++}`);
            values.push(JSON.stringify(body.metadata));
          }
          
          updates.push(`updated_at = NOW()`);
          
          values.push(params.id);
          
          await db.execute(
            `UPDATE assets SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            values
          );
          
          return { success: true };
        } catch (error) {
          console.error('[Tokens] Failed to update:', error);
          return { success: false, error: 'Failed to update token' };
        }
      },
      {
        params: t.Object({
          id: t.String()
        }),
        body: t.Object({
          name: t.Optional(t.String()),
          logoUrl: t.Optional(t.String()),
          coingeckoId: t.Optional(t.String()),
          isStablecoin: t.Optional(t.Boolean()),
          sortOrder: t.Optional(t.Number()),
          metadata: t.Optional(t.Record(t.String(), t.Any()))
        }),
        detail: {
          tags: ['tokens'],
          summary: 'Update token',
          description: 'Update token information'
        }
      }
    )
    
    // Delete token
    .delete(
      '/:id',
      async ({ params }) => {
        try {
          await db.execute(
            `DELETE FROM assets WHERE id = $1`,
            [params.id]
          );
          
          return { success: true };
        } catch (error) {
          console.error('[Tokens] Failed to delete:', error);
          return { success: false, error: 'Failed to delete token' };
        }
      },
      {
        params: t.Object({
          id: t.String()
        }),
        detail: {
          tags: ['tokens'],
          summary: 'Delete token',
          description: 'Remove a token and all its chain configurations'
        }
      }
    )
    
    // Add chain to token
    .post(
      '/:id/chains',
      async ({ params, body }) => {
        try {
          await db.execute(
            `INSERT INTO asset_networks (
              asset_id, network_id, contract_address, decimals, is_native,
              is_active, deposit_enabled, withdrawal_enabled,
              min_deposit, max_deposit, min_withdrawal, max_withdrawal,
              withdrawal_fee, withdrawal_fee_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              params.id,
              body.chainId,
              body.contractAddress || null,
              body.decimals || 18,
              body.isNative || false,
              body.isActive !== undefined ? body.isActive : true,
              body.depositEnabled !== undefined ? body.depositEnabled : true,
              body.withdrawalEnabled !== undefined ? body.withdrawalEnabled : true,
              body.minDeposit || 0,
              body.maxDeposit || null,
              body.minWithdrawal || 0,
              body.maxWithdrawal || null,
              body.withdrawalFee || 0,
              body.withdrawalFeeType || 'fixed'
            ]
          );
          
          return { success: true };
        } catch (error) {
          console.error('[Tokens] Failed to add chain:', error);
          return { success: false, error: 'Failed to add chain to token' };
        }
      },
      {
        params: t.Object({
          id: t.String()
        }),
        body: t.Object({
          chainId: t.String(),
          contractAddress: t.Optional(t.String()),
          decimals: t.Optional(t.Number()),
          isNative: t.Optional(t.Boolean()),
          isActive: t.Optional(t.Boolean()),
          depositEnabled: t.Optional(t.Boolean()),
          withdrawalEnabled: t.Optional(t.Boolean()),
          minDeposit: t.Optional(t.Number()),
          maxDeposit: t.Optional(t.Number()),
          minWithdrawal: t.Optional(t.Number()),
          maxWithdrawal: t.Optional(t.Number()),
          withdrawalFee: t.Optional(t.Number()),
          withdrawalFeeType: t.Optional(t.Union([t.Literal('fixed'), t.Literal('percentage')]))
        }),
        detail: {
          tags: ['tokens'],
          summary: 'Add chain to token',
          description: 'Add a new chain configuration to a token'
        }
      }
    )
    
    // Update token chain configuration
    .patch(
      '/:id/chains/:chainId',
      async ({ params, body }) => {
        try {
          const updates: string[] = [];
          const values: unknown[] = [];
          let paramIndex = 1;
          
          if (body.contractAddress !== undefined) {
            updates.push(`contract_address = $${paramIndex++}`);
            values.push(body.contractAddress);
          }
          if (body.decimals !== undefined) {
            updates.push(`decimals = $${paramIndex++}`);
            values.push(body.decimals);
          }
          if (body.isNative !== undefined) {
            updates.push(`is_native = $${paramIndex++}`);
            values.push(body.isNative);
          }
          if (body.isActive !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            values.push(body.isActive);
          }
          if (body.depositEnabled !== undefined) {
            updates.push(`deposit_enabled = $${paramIndex++}`);
            values.push(body.depositEnabled);
          }
          if (body.withdrawalEnabled !== undefined) {
            updates.push(`withdrawal_enabled = $${paramIndex++}`);
            values.push(body.withdrawalEnabled);
          }
          if (body.minDeposit !== undefined) {
            updates.push(`min_deposit = $${paramIndex++}`);
            values.push(body.minDeposit);
          }
          if (body.maxDeposit !== undefined) {
            updates.push(`max_deposit = $${paramIndex++}`);
            values.push(body.maxDeposit);
          }
          if (body.minWithdrawal !== undefined) {
            updates.push(`min_withdrawal = $${paramIndex++}`);
            values.push(body.minWithdrawal);
          }
          if (body.maxWithdrawal !== undefined) {
            updates.push(`max_withdrawal = $${paramIndex++}`);
            values.push(body.maxWithdrawal);
          }
          if (body.withdrawalFee !== undefined) {
            updates.push(`withdrawal_fee = $${paramIndex++}`);
            values.push(body.withdrawalFee);
          }
          if (body.withdrawalFeeType !== undefined) {
            updates.push(`withdrawal_fee_type = $${paramIndex++}`);
            values.push(body.withdrawalFeeType);
          }
          
          updates.push(`updated_at = NOW()`);
          
          values.push(params.id, params.chainId);
          
          await db.execute(
            `UPDATE asset_networks SET ${updates.join(', ')} 
             WHERE asset_id = $${paramIndex} AND network_id = $${paramIndex + 1}`,
            values
          );
          
          return { success: true };
        } catch (error) {
          console.error('[Tokens] Failed to update chain config:', error);
          return { success: false, error: 'Failed to update chain configuration' };
        }
      },
      {
        params: t.Object({
          id: t.String(),
          chainId: t.String()
        }),
        body: t.Object({
          contractAddress: t.Optional(t.String()),
          decimals: t.Optional(t.Number()),
          isNative: t.Optional(t.Boolean()),
          isActive: t.Optional(t.Boolean()),
          depositEnabled: t.Optional(t.Boolean()),
          withdrawalEnabled: t.Optional(t.Boolean()),
          minDeposit: t.Optional(t.Number()),
          maxDeposit: t.Optional(t.Number()),
          minWithdrawal: t.Optional(t.Number()),
          maxWithdrawal: t.Optional(t.Number()),
          withdrawalFee: t.Optional(t.Number()),
          withdrawalFeeType: t.Optional(t.Union([t.Literal('fixed'), t.Literal('percentage')]))
        }),
        detail: {
          tags: ['tokens'],
          summary: 'Update token chain config',
          description: 'Update chain-specific configuration for a token'
        }
      }
    )
    
    // Remove chain from token
    .delete(
      '/:id/chains/:chainId',
      async ({ params }) => {
        try {
          await db.execute(
            `DELETE FROM asset_networks WHERE asset_id = $1 AND network_id = $2`,
            [params.id, params.chainId]
          );
          
          return { success: true };
        } catch (error) {
          console.error('[Tokens] Failed to remove chain:', error);
          return { success: false, error: 'Failed to remove chain from token' };
        }
      },
      {
        params: t.Object({
          id: t.String(),
          chainId: t.String()
        }),
        detail: {
          tags: ['tokens'],
          summary: 'Remove chain from token',
          description: 'Remove a chain configuration from a token'
        }
      }
    );
}
