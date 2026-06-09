/**
 * Audit Logs API Service
 */

import { api, type PaginatedResponse } from '@/libs/api';

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogsListParams {
  page?: number;
  pageSize?: number;
  action?: string;
  resource?: string;
  userId?: string;
  fromDate?: string;
  toDate?: string;
  [key: string]: string | number | boolean | undefined;
}

export const auditLogsService = {
  /**
   * Get paginated list of audit logs
   */
  getLogs: (params: AuditLogsListParams = {}) =>
    api.get<PaginatedResponse<AuditLogEntry>>('/audit-logs', params),
  
  /**
   * Get available action types
   */
  getActions: () =>
    api.get<string[]>('/audit-logs/actions'),
  
  /**
   * Get available resource types
   */
  getResources: () =>
    api.get<string[]>('/audit-logs/resources')
};
