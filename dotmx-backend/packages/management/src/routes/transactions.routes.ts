/**
 * Transactions Management Routes
 */

import { Elysia, t } from 'elysia';
import type { DatabaseService } from '@dotmx/shared';
import type { TransactionListItem, PaginatedResponse } from '../types';

export function createTransactionsRoutes(db: DatabaseService) {
  return new Elysia({ prefix: '/transactions' })
    .get(
      '/',
      async ({ query }) => {
        const page = query.page || 1;
        const pageSize = query.pageSize || 20;
        const offset = (page - 1) * pageSize;
        
        try {
          let whereClause = 'WHERE 1=1';
          const params: (string | number)[] = [];
          let paramIndex = 1;
          
          if (query.type) {
            whereClause += ` AND bt.tx_type = $${paramIndex}`;
            params.push(query.type);
            paramIndex++;
          }
          
          if (query.status) {
            whereClause += ` AND bt.status = $${paramIndex}`;
            params.push(query.status);
            paramIndex++;
          }
          
          if (query.userId) {
            whereClause += ` AND bt.user_id = $${paramIndex}`;
            params.push(query.userId);
            paramIndex++;
          }
          
          if (query.currency) {
            whereClause += ` AND sa.symbol = $${paramIndex}`;
            params.push(query.currency);
            paramIndex++;
          }
          
          if (query.fromDate) {
            whereClause += ` AND bt.created_at >= $${paramIndex}`;
            params.push(query.fromDate);
            paramIndex++;
          }
          
          if (query.toDate) {
            whereClause += ` AND bt.created_at <= $${paramIndex}`;
            params.push(query.toDate);
            paramIndex++;
          }
          
          // Get total count
          const countResult = await db.queryOne<{ count: string }>(
            `SELECT COUNT(*) as count 
             FROM balance_transactions bt
             LEFT JOIN supported_assets sa ON bt.asset_id = sa.id
             ${whereClause}`,
            params
          );
          const totalItems = parseInt(countResult?.count || '0', 10);
          
          // Get transactions with proper joins
          const transactions = await db.query<{
            id: string;
            user_id: string;
            user_email: string;
            tx_type: string;
            currency: string;
            amount: string;
            status: string;
            tx_hash: string | null;
            created_at: string;
            confirmed_at: string | null;
          }>(
            `SELECT 
               bt.id, 
               bt.user_id, 
               u.email as user_email,
               bt.tx_type,
               sa.symbol as currency,
               bt.amount, 
               bt.status,
               bt.tx_hash, 
               bt.created_at, 
               bt.confirmed_at
             FROM balance_transactions bt
             JOIN users u ON bt.user_id = u.id
             LEFT JOIN supported_assets sa ON bt.asset_id = sa.id
             ${whereClause}
             ORDER BY bt.created_at DESC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, pageSize, offset]
          );
          
          // Map tx_type to simplified type for frontend
          const mapTxType = (txType: string): TransactionListItem['type'] => {
            if (txType.includes('deposit')) return 'deposit';
            if (txType.includes('withdrawal')) return 'withdrawal';
            if (txType.includes('trade')) return 'trade';
            if (txType.includes('fee') || txType === 'funding_fee') return 'fee';
            return 'transfer';
          };
          
          const response: PaginatedResponse<TransactionListItem> = {
            data: transactions.map(t => ({
              id: t.id,
              userId: t.user_id,
              userEmail: t.user_email,
              type: mapTxType(t.tx_type),
              currency: t.currency || 'UNKNOWN',
              amount: parseFloat(t.amount),
              status: t.status as TransactionListItem['status'],
              txHash: t.tx_hash,
              createdAt: t.created_at,
              completedAt: t.confirmed_at
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
          console.error('[Transactions] Failed to fetch:', error);
          return {
            data: [],
            pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }
          };
        }
      },
      {
        query: t.Object({
          page: t.Optional(t.Number({ minimum: 1 })),
          pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
          type: t.Optional(t.String()),
          status: t.Optional(t.String()),
          userId: t.Optional(t.String()),
          currency: t.Optional(t.String()),
          fromDate: t.Optional(t.String()),
          toDate: t.Optional(t.String())
        }),
        detail: {
          tags: ['transactions'],
          summary: 'List transactions',
          description: 'Get paginated list of transactions with filters'
        }
      }
    )
    .get(
      '/:transactionId',
      async ({ params }) => {
        try {
          const transaction = await db.queryOne<{
            id: string;
            user_id: string;
            user_email: string;
            tx_type: string;
            currency: string;
            amount: string;
            fee: string | null;
            status: string;
            tx_hash: string | null;
            to_address: string | null;
            from_address: string | null;
            network_code: string | null;
            description: string | null;
            created_at: string;
            confirmed_at: string | null;
            metadata: Record<string, unknown>;
          }>(
            `SELECT 
               bt.id, 
               bt.user_id, 
               u.email as user_email,
               bt.tx_type,
               sa.symbol as currency, 
               bt.amount, 
               bt.fee, 
               bt.status,
               bt.tx_hash, 
               bt.to_address, 
               bt.from_address, 
               sn.code as network_code,
               bt.description,
               bt.created_at, 
               bt.confirmed_at, 
               bt.metadata
             FROM balance_transactions bt
             JOIN users u ON bt.user_id = u.id
             LEFT JOIN supported_assets sa ON bt.asset_id = sa.id
             LEFT JOIN supported_networks sn ON bt.network_id = sn.id
             WHERE bt.id = $1`,
            [params.transactionId]
          );
          
          if (!transaction) {
            return { error: 'Transaction not found' };
          }
          
          return {
            id: transaction.id,
            userId: transaction.user_id,
            userEmail: transaction.user_email,
            type: transaction.tx_type,
            currency: transaction.currency || 'UNKNOWN',
            amount: parseFloat(transaction.amount),
            fee: transaction.fee ? parseFloat(transaction.fee) : null,
            status: transaction.status,
            txHash: transaction.tx_hash,
            address: transaction.to_address || transaction.from_address,
            network: transaction.network_code,
            memo: transaction.description,
            createdAt: transaction.created_at,
            completedAt: transaction.confirmed_at,
            metadata: transaction.metadata || {}
          };
        } catch (error) {
          console.error('[Transactions] Failed to fetch:', error);
          return { error: 'Failed to fetch transaction' };
        }
      },
      {
        params: t.Object({
          transactionId: t.String()
        }),
        detail: {
          tags: ['transactions'],
          summary: 'Get transaction details',
          description: 'Get detailed information about a specific transaction'
        }
      }
    )
    .patch(
      '/:transactionId/status',
      async ({ params, body }) => {
        try {
          const updates: string[] = ['status = $1'];
          const values: (string | null)[] = [body.status];
          
          if (body.status === 'completed') {
            updates.push('confirmed_at = NOW()');
          }
          
          await db.query(
            `UPDATE balance_transactions SET ${updates.join(', ')} WHERE id = $${updates.length}`,
            [...values, params.transactionId]
          );
          
          return { success: true };
        } catch (error) {
          console.error('[Transactions] Failed to update status:', error);
          return { error: 'Failed to update transaction status' };
        }
      },
      {
        params: t.Object({
          transactionId: t.String()
        }),
        body: t.Object({
          status: t.Union([
            t.Literal('pending'),
            t.Literal('completed'),
            t.Literal('failed'),
            t.Literal('cancelled')
          ])
        }),
        detail: {
          tags: ['transactions'],
          summary: 'Update transaction status',
          description: 'Manually update the status of a transaction'
        }
      }
    );
}
