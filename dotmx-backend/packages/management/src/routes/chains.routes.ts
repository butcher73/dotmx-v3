/**
 * Chains Management Routes
 */

import { Elysia, t } from 'elysia';
import type { DatabaseService } from '@dotmx/shared';
import type { Chain, PaginatedResponse } from '../types';

export function createChainsRoutes(db: DatabaseService) {
  console.log('🔧 [Chains] Routes initialized');
  return new Elysia({ prefix: '/chains' })
    // List all chains
    .get(
      '/',
      async ({ query }) => {
        const page = query.page || 1;
        const pageSize = query.pageSize || 50;
        const offset = (page - 1) * pageSize;
        
        try {
          let whereClause = 'WHERE 1=1';
          const params: (string | number | boolean)[] = [];
          let paramIndex = 1;
          
          if (query.isActive !== undefined) {
            whereClause += ` AND is_active = $${paramIndex}`;
            params.push(query.isActive);
            paramIndex++;
          }
          
          if (query.search) {
            whereClause += ` AND (name ILIKE $${paramIndex} OR code ILIKE $${paramIndex})`;
            params.push(`%${query.search}%`);
            paramIndex++;
          }
          
          // Get total count
          const countResult = await db.queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM networks ${whereClause}`,
            params
          );
          const totalItems = parseInt(countResult?.count || '0', 10);
          
          // Get chains
          const chains = await db.query<{
            id: string;
            code: string;
            name: string;
            chain_type: string;
            chain_id: number | null;
            network_type: string;
            rpc_url: string | null;
            explorer_url: string | null;
            native_symbol: string;
            native_decimals: number;
            is_active: boolean;
            deposit_enabled: boolean;
            withdrawal_enabled: boolean;
            min_confirmations: number;
            avg_block_time_seconds: number;
            icon_url: string | null;
            sort_order: number;
            metadata: Record<string, unknown>;
            created_at: string;
            updated_at: string;
          }>(
            `SELECT *
             FROM networks
             ${whereClause}
             ORDER BY sort_order ASC, name ASC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, pageSize, offset]
          );
          
          const response: PaginatedResponse<Chain> = {
            data: chains.map(c => ({
              id: c.id,
              code: c.code,
              name: c.name,
              chainType: (c.chain_type || 'EVM') as Chain['chainType'],
              chainId: c.chain_id,
              networkType: c.network_type as Chain['networkType'],
              rpcUrl: c.rpc_url,
              explorerUrl: c.explorer_url,
              nativeSymbol: c.native_symbol,
              nativeDecimals: c.native_decimals,
              isActive: c.is_active,
              depositEnabled: c.deposit_enabled,
              withdrawalEnabled: c.withdrawal_enabled,
              minConfirmations: c.min_confirmations,
              avgBlockTimeSeconds: c.avg_block_time_seconds,
              iconUrl: c.icon_url,
              sortOrder: c.sort_order,
              metadata: c.metadata,
              createdAt: c.created_at,
              updatedAt: c.updated_at
            })),
            pagination: {
              page,
              pageSize,
              totalItems,
              totalPages: Math.ceil(totalItems / pageSize)
            }
          };
          
          return response;
        } catch (error) {
          console.error('[Chains] Failed to fetch:', error);
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
          isActive: t.Optional(t.Boolean()),
          search: t.Optional(t.String())
        }),
        detail: {
          tags: ['chains'],
          summary: 'List chains',
          description: 'Get paginated list of blockchain networks'
        }
      }
    )
    
    // Get single chain
    .get(
      '/:id',
      async ({ params }) => {
        try {
          const chain = await db.queryOne<{
            id: string;
            code: string;
            name: string;
            chain_type: string;
            chain_id: number | null;
            network_type: string;
            rpc_url: string | null;
            explorer_url: string | null;
            native_symbol: string;
            native_decimals: number;
            is_active: boolean;
            deposit_enabled: boolean;
            withdrawal_enabled: boolean;
            min_confirmations: number;
            avg_block_time_seconds: number;
            icon_url: string | null;
            sort_order: number;
            metadata: Record<string, unknown>;
            created_at: string;
            updated_at: string;
          }>(
            `SELECT * FROM networks WHERE id = $1`,
            [params.id]
          );
          
          if (!chain) {
            return { error: 'Chain not found' };
          }
          
          return {
            id: chain.id,
            code: chain.code,
            name: chain.name,
            chainType: (chain.chain_type || 'EVM') as Chain['chainType'],
            chainId: chain.chain_id,
            networkType: chain.network_type as Chain['networkType'],
            rpcUrl: chain.rpc_url,
            explorerUrl: chain.explorer_url,
            nativeSymbol: chain.native_symbol,
            nativeDecimals: chain.native_decimals,
            isActive: chain.is_active,
            depositEnabled: chain.deposit_enabled,
            withdrawalEnabled: chain.withdrawal_enabled,
            minConfirmations: chain.min_confirmations,
            avgBlockTimeSeconds: chain.avg_block_time_seconds,
            iconUrl: chain.icon_url,
            sortOrder: chain.sort_order,
            metadata: chain.metadata,
            createdAt: chain.created_at,
            updatedAt: chain.updated_at
          };
        } catch (error) {
          console.error('[Chains] Failed to fetch chain:', error);
          return { error: 'Failed to fetch chain' };
        }
      },
      {
        params: t.Object({
          id: t.String()
        }),
        detail: {
          tags: ['chains'],
          summary: 'Get chain',
          description: 'Get details of a specific blockchain network'
        }
      }
    )
    
    // Create new chain
    .post(
      '/',
      async ({ body }) => {
        try {
          const chain = await db.queryOne<{ id: string }>(
            `INSERT INTO networks (
              code, name, chain_type, chain_id, network_type, rpc_url, explorer_url,
              native_symbol, native_decimals, is_active,
              deposit_enabled, withdrawal_enabled, min_confirmations,
              avg_block_time_seconds, icon_url, sort_order, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING id`,
            [
              body.code,
              body.name,
              body.chainType || 'EVM',
              body.chainId || null,
              body.networkType || 'mainnet',
              body.rpcUrl || null,
              body.explorerUrl || null,
              body.nativeCurrencySymbol,
              body.nativeCurrencyDecimals || 18,
              body.isActive !== undefined ? body.isActive : true,
              body.depositEnabled !== undefined ? body.depositEnabled : true,
              body.withdrawalEnabled !== undefined ? body.withdrawalEnabled : true,
              body.minConfirmations || 12,
              body.avgBlockTimeSeconds || 12,
              body.iconUrl || null,
              body.sortOrder || 0,
              body.metadata || {}
            ]
          );
          
          return { success: true, id: chain?.id };
        } catch (error) {
          console.error('[Chains] Failed to create:', error);
          return { success: false, error: 'Failed to create chain' };
        }
      },
      {
        body: t.Object({
          code: t.String({ minLength: 1, maxLength: 10 }),
          name: t.String({ minLength: 1, maxLength: 100 }),
          chainType: t.Optional(t.Union([t.Literal('EVM'), t.Literal('SOL'), t.Literal('TRON'), t.Literal('BTC'), t.Literal('DOGE')])),
          chainId: t.Optional(t.Number()),
          networkType: t.Optional(t.Union([t.Literal('mainnet'), t.Literal('testnet')])),
          rpcUrl: t.Optional(t.String()),
          explorerUrl: t.Optional(t.String()),
          nativeCurrencySymbol: t.String({ minLength: 1, maxLength: 10 }),
          nativeCurrencyDecimals: t.Optional(t.Number()),
          isActive: t.Optional(t.Boolean()),
          depositEnabled: t.Optional(t.Boolean()),
          withdrawalEnabled: t.Optional(t.Boolean()),
          minConfirmations: t.Optional(t.Number()),
          avgBlockTimeSeconds: t.Optional(t.Number()),
          iconUrl: t.Optional(t.String()),
          sortOrder: t.Optional(t.Number()),
          metadata: t.Optional(t.Record(t.String(), t.Any()))
        }),
        detail: {
          tags: ['chains'],
          summary: 'Create chain',
          description: 'Add a new blockchain network'
        }
      }
    )
    
    // Update chain
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
          if (body.chainType !== undefined) {
            updates.push(`chain_type = $${paramIndex++}`);
            values.push(body.chainType);
          }
          if (body.chainId !== undefined) {
            updates.push(`chain_id = $${paramIndex++}`);
            values.push(body.chainId);
          }
          if (body.networkType !== undefined) {
            updates.push(`network_type = $${paramIndex++}`);
            values.push(body.networkType);
          }
          if (body.rpcUrl !== undefined) {
            updates.push(`rpc_url = $${paramIndex++}`);
            values.push(body.rpcUrl);
          }
          if (body.explorerUrl !== undefined) {
            updates.push(`explorer_url = $${paramIndex++}`);
            values.push(body.explorerUrl);
          }
          if (body.nativeCurrencySymbol !== undefined) {
            updates.push(`native_symbol = $${paramIndex++}`);
            values.push(body.nativeCurrencySymbol);
          }
          if (body.nativeCurrencyDecimals !== undefined) {
            updates.push(`native_decimals = $${paramIndex++}`);
            values.push(body.nativeCurrencyDecimals);
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
          if (body.minConfirmations !== undefined) {
            updates.push(`min_confirmations = $${paramIndex++}`);
            values.push(body.minConfirmations);
          }
          if (body.avgBlockTimeSeconds !== undefined) {
            updates.push(`avg_block_time_seconds = $${paramIndex++}`);
            values.push(body.avgBlockTimeSeconds);
          }
          if (body.iconUrl !== undefined) {
            updates.push(`icon_url = $${paramIndex++}`);
            values.push(body.iconUrl);
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
            `UPDATE networks SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            values
          );
          
          return { success: true };
        } catch (error) {
          console.error('[Chains] Failed to update:', error);
          return { success: false, error: 'Failed to update chain' };
        }
      },
      {
        params: t.Object({
          id: t.String()
        }),
        body: t.Object({
          name: t.Optional(t.String()),
          chainType: t.Optional(t.Union([t.Literal('EVM'), t.Literal('SOL'), t.Literal('TRON'), t.Literal('BTC'), t.Literal('DOGE')])),
          chainId: t.Optional(t.Number()),
          networkType: t.Optional(t.Union([t.Literal('mainnet'), t.Literal('testnet')])),
          rpcUrl: t.Optional(t.String()),
          explorerUrl: t.Optional(t.String()),
          nativeCurrencySymbol: t.Optional(t.String()),
          nativeCurrencyDecimals: t.Optional(t.Number()),
          isActive: t.Optional(t.Boolean()),
          depositEnabled: t.Optional(t.Boolean()),
          withdrawalEnabled: t.Optional(t.Boolean()),
          minConfirmations: t.Optional(t.Number()),
          avgBlockTimeSeconds: t.Optional(t.Number()),
          iconUrl: t.Optional(t.String()),
          sortOrder: t.Optional(t.Number()),
          metadata: t.Optional(t.Record(t.String(), t.Any()))
        }),
        detail: {
          tags: ['chains'],
          summary: 'Update chain',
          description: 'Update a blockchain network configuration'
        }
      }
    )
    
    // Delete chain
    .delete(
      '/:id',
      async ({ params }) => {
        try {
          await db.execute(
            `DELETE FROM networks WHERE id = $1`,
            [params.id]
          );
          
          return { success: true };
        } catch (error) {
          console.error('[Chains] Failed to delete:', error);
          return { success: false, error: 'Failed to delete chain' };
        }
      },
      {
        params: t.Object({
          id: t.String()
        }),
        detail: {
          tags: ['chains'],
          summary: 'Delete chain',
          description: 'Remove a blockchain network'
        }
      }
    );
}
