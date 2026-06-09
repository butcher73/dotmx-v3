/**
 * Trading Pairs Management Routes
 */

import { Elysia, t } from 'elysia';
import type { DatabaseService } from '@dotmx/shared';
import type { TradingPair, PaginatedResponse } from '../types';

export function createTradingPairsRoutes(db: DatabaseService) {
  return new Elysia({ prefix: '/trading-pairs' })
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
          
          if (query.status) {
            whereClause += ` AND status = $${paramIndex}`;
            params.push(query.status);
            paramIndex++;
          }
          
          if (query.search) {
            whereClause += ` AND (symbol ILIKE $${paramIndex} OR base_currency ILIKE $${paramIndex} OR quote_currency ILIKE $${paramIndex})`;
            params.push(`%${query.search}%`);
            paramIndex++;
          }
          
          // Get total count
          const countResult = await db.queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM trading_pairs ${whereClause}`,
            params
          );
          const totalItems = parseInt(countResult?.count || '0', 10);
          
          // Get trading pairs
          const pairs = await db.query<{
            id: string;
            symbol: string;
            base_currency: string;
            quote_currency: string;
            status: string;
            min_order_size: string;
            max_order_size: string;
            tick_size: string;
            maker_fee: string;
            taker_fee: string;
            created_at: string;
            updated_at: string;
          }>(
            `SELECT *
             FROM trading_pairs
             ${whereClause}
             ORDER BY symbol ASC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, pageSize, offset]
          );
          
          const response: PaginatedResponse<TradingPair> = {
            data: pairs.map(p => ({
              id: p.id,
              symbol: p.symbol,
              baseCurrency: p.base_currency,
              quoteCurrency: p.quote_currency,
              status: p.status as TradingPair['status'],
              minOrderSize: parseFloat(p.min_order_size),
              maxOrderSize: parseFloat(p.max_order_size),
              tickSize: parseFloat(p.tick_size),
              makerFee: parseFloat(p.maker_fee),
              takerFee: parseFloat(p.taker_fee),
              createdAt: p.created_at,
              updatedAt: p.updated_at
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
          console.error('[TradingPairs] Failed to fetch:', error);
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
          status: t.Optional(t.String()),
          search: t.Optional(t.String())
        }),
        detail: {
          tags: ['trading-pairs'],
          summary: 'List trading pairs',
          description: 'Get paginated list of trading pairs'
        }
      }
    )
    .post(
      '/',
      async ({ body }) => {
        try {
          const result = await db.queryOne<{ id: string }>(
            `INSERT INTO trading_pairs 
             (symbol, base_currency, quote_currency, status, min_order_size, max_order_size, tick_size, maker_fee, taker_fee)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [
              body.symbol,
              body.baseCurrency,
              body.quoteCurrency,
              body.status || 'inactive',
              body.minOrderSize,
              body.maxOrderSize,
              body.tickSize,
              body.makerFee,
              body.takerFee
            ]
          );
          
          return { success: true, id: result?.id };
        } catch (error) {
          console.error('[TradingPairs] Failed to create:', error);
          return { error: 'Failed to create trading pair' };
        }
      },
      {
        body: t.Object({
          symbol: t.String(),
          baseCurrency: t.String(),
          quoteCurrency: t.String(),
          status: t.Optional(t.String()),
          minOrderSize: t.Number(),
          maxOrderSize: t.Number(),
          tickSize: t.Number(),
          makerFee: t.Number(),
          takerFee: t.Number()
        }),
        detail: {
          tags: ['trading-pairs'],
          summary: 'Create trading pair',
          description: 'Add a new trading pair to the platform'
        }
      }
    )
    .patch(
      '/:pairId',
      async ({ params, body }) => {
        try {
          const updates: string[] = [];
          const values: (string | number)[] = [];
          let paramIndex = 1;
          
          if (body.status !== undefined) {
            updates.push(`status = $${paramIndex}`);
            values.push(body.status);
            paramIndex++;
          }
          
          if (body.minOrderSize !== undefined) {
            updates.push(`min_order_size = $${paramIndex}`);
            values.push(body.minOrderSize);
            paramIndex++;
          }
          
          if (body.maxOrderSize !== undefined) {
            updates.push(`max_order_size = $${paramIndex}`);
            values.push(body.maxOrderSize);
            paramIndex++;
          }
          
          if (body.tickSize !== undefined) {
            updates.push(`tick_size = $${paramIndex}`);
            values.push(body.tickSize);
            paramIndex++;
          }
          
          if (body.makerFee !== undefined) {
            updates.push(`maker_fee = $${paramIndex}`);
            values.push(body.makerFee);
            paramIndex++;
          }
          
          if (body.takerFee !== undefined) {
            updates.push(`taker_fee = $${paramIndex}`);
            values.push(body.takerFee);
            paramIndex++;
          }
          
          updates.push('updated_at = NOW()');
          
          await db.query(
            `UPDATE trading_pairs SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            [...values, params.pairId]
          );
          
          return { success: true };
        } catch (error) {
          console.error('[TradingPairs] Failed to update:', error);
          return { error: 'Failed to update trading pair' };
        }
      },
      {
        params: t.Object({
          pairId: t.String()
        }),
        body: t.Object({
          status: t.Optional(t.String()),
          minOrderSize: t.Optional(t.Number()),
          maxOrderSize: t.Optional(t.Number()),
          tickSize: t.Optional(t.Number()),
          makerFee: t.Optional(t.Number()),
          takerFee: t.Optional(t.Number())
        }),
        detail: {
          tags: ['trading-pairs'],
          summary: 'Update trading pair',
          description: 'Update trading pair configuration'
        }
      }
    )
    .delete(
      '/:pairId',
      async ({ params }) => {
        try {
          await db.query(
            `DELETE FROM trading_pairs WHERE id = $1`,
            [params.pairId]
          );
          
          return { success: true };
        } catch (error) {
          console.error('[TradingPairs] Failed to delete:', error);
          return { error: 'Failed to delete trading pair' };
        }
      },
      {
        params: t.Object({
          pairId: t.String()
        }),
        detail: {
          tags: ['trading-pairs'],
          summary: 'Delete trading pair',
          description: 'Remove a trading pair from the platform'
        }
      }
    );
}
