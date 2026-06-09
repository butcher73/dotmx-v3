/**
 * Audit Log Routes
 */

import { Elysia, t } from 'elysia';
import type { DatabaseService } from '@dotmx/shared';
import type { AuditLogEntry, PaginatedResponse } from '../types';

export function createAuditLogRoutes(db: DatabaseService) {
  return new Elysia({ prefix: '/audit-logs' })
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
          
          if (query.action) {
            whereClause += ` AND a.action = $${paramIndex}`;
            params.push(query.action);
            paramIndex++;
          }
          
          if (query.resource) {
            whereClause += ` AND a.resource = $${paramIndex}`;
            params.push(query.resource);
            paramIndex++;
          }
          
          if (query.userId) {
            whereClause += ` AND a.user_id = $${paramIndex}`;
            params.push(query.userId);
            paramIndex++;
          }
          
          if (query.fromDate) {
            whereClause += ` AND a.created_at >= $${paramIndex}`;
            params.push(query.fromDate);
            paramIndex++;
          }
          
          if (query.toDate) {
            whereClause += ` AND a.created_at <= $${paramIndex}`;
            params.push(query.toDate);
            paramIndex++;
          }
          
          // Get total count
          const countResult = await db.queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM audit_logs a ${whereClause}`,
            params
          );
          const totalItems = parseInt(countResult?.count || '0', 10);
          
          // Get audit logs
          const logs = await db.query<{
            id: string;
            user_id: string | null;
            user_email: string | null;
            action: string;
            resource: string;
            resource_id: string | null;
            details: Record<string, unknown>;
            ip_address: string | null;
            user_agent: string | null;
            created_at: string;
          }>(
            `SELECT 
               a.id, a.user_id, u.email as user_email,
               a.action, a.resource, a.resource_id,
               a.details, a.ip_address, a.user_agent, a.created_at
             FROM audit_logs a
             LEFT JOIN users u ON a.user_id = u.id
             ${whereClause}
             ORDER BY a.created_at DESC
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, pageSize, offset]
          );
          
          const response: PaginatedResponse<AuditLogEntry> = {
            data: logs.map(l => ({
              id: l.id,
              userId: l.user_id,
              userEmail: l.user_email,
              action: l.action,
              resource: l.resource,
              resourceId: l.resource_id,
              details: l.details || {},
              ipAddress: l.ip_address,
              userAgent: l.user_agent,
              createdAt: l.created_at
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
          console.error('[AuditLogs] Failed to fetch:', error);
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
          action: t.Optional(t.String()),
          resource: t.Optional(t.String()),
          userId: t.Optional(t.String()),
          fromDate: t.Optional(t.String()),
          toDate: t.Optional(t.String())
        }),
        detail: {
          tags: ['audit-logs'],
          summary: 'List audit logs',
          description: 'Get paginated list of audit log entries with filters'
        }
      }
    )
    .get(
      '/actions',
      async () => {
        try {
          const actions = await db.query<{ action: string }>(
            `SELECT DISTINCT action FROM audit_logs ORDER BY action`
          );
          return actions.map(a => a.action);
        } catch (error) {
          return ['login', 'logout', 'create', 'update', 'delete', 'approve', 'reject'];
        }
      },
      {
        detail: {
          tags: ['audit-logs'],
          summary: 'Get available actions',
          description: 'Get list of distinct action types for filtering'
        }
      }
    )
    .get(
      '/resources',
      async () => {
        try {
          const resources = await db.query<{ resource: string }>(
            `SELECT DISTINCT resource FROM audit_logs ORDER BY resource`
          );
          return resources.map(r => r.resource);
        } catch (error) {
          return ['user', 'transaction', 'kyc', 'trading_pair', 'setting', 'order'];
        }
      },
      {
        detail: {
          tags: ['audit-logs'],
          summary: 'Get available resources',
          description: 'Get list of distinct resource types for filtering'
        }
      }
    );
}
