'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  auditLogsService, 
  type AuditLogEntry,
  type AuditLogsListParams 
} from '@/services/audit-logs';
import type { PaginatedResponse } from '@/libs/api';

export function useAuditLogs(initialParams: AuditLogsListParams = {}) {
  const [data, setData] = useState<PaginatedResponse<AuditLogEntry> | null>(null);
  const [params, setParams] = useState(initialParams);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await auditLogsService.getLogs(params);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const setPage = (page: number) => {
    setParams(prev => ({ ...prev, page }));
  };

  const setAction = (action: string | undefined) => {
    setParams(prev => ({ ...prev, action, page: 1 }));
  };

  const setResource = (resource: string | undefined) => {
    setParams(prev => ({ ...prev, resource, page: 1 }));
  };

  const setDateRange = (fromDate: string | undefined, toDate: string | undefined) => {
    setParams(prev => ({ ...prev, fromDate, toDate, page: 1 }));
  };

  return {
    logs: data?.data || [],
    pagination: data?.pagination,
    isLoading,
    error,
    refetch: fetchLogs,
    setPage,
    setAction,
    setResource,
    setDateRange,
    params
  };
}

export function useAuditLogFilters() {
  const [actions, setActions] = useState<string[]>([]);
  const [resources, setResources] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [actionsData, resourcesData] = await Promise.all([
          auditLogsService.getActions(),
          auditLogsService.getResources()
        ]);
        setActions(actionsData);
        setResources(resourcesData);
      } catch (err) {
        console.error('Failed to fetch audit log filters:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilters();
  }, []);

  return { actions, resources, isLoading };
}
