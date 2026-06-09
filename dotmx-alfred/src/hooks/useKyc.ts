'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  kycService,
  type KycApplication,
  type KycApplicationDetail,
  type KycListParams
} from '@/services/kyc';
import type { PaginatedResponse } from '@/libs/api';

export function useKycApplications(initialParams: KycListParams = {}) {
  const [data, setData] = useState<PaginatedResponse<KycApplication> | null>(null);
  const [params, setParams] = useState(initialParams);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await kycService.getApplications(params);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch KYC applications');
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const setPage = (page: number) => {
    setParams(prev => ({ ...prev, page }));
  };

  const setStatus = (status: string | undefined) => {
    setParams(prev => ({ ...prev, status, page: 1 }));
  };

  const setLevel = (level: number | undefined) => {
    setParams(prev => ({ ...prev, level, page: 1 }));
  };

  return {
    applications: data?.data || [],
    pagination: data?.pagination,
    isLoading,
    error,
    refetch: fetchApplications,
    setPage,
    setStatus,
    setLevel,
    params
  };
}

export function useKycApplication(applicationId: string | null) {
  const [application, setApplication] = useState<KycApplicationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApplication = useCallback(async () => {
    if (!applicationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await kycService.getApplication(applicationId);
      setApplication(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch KYC application');
    } finally {
      setIsLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  const reviewApplication = async (
    status: 'approved' | 'rejected' | 'in_review',
    notes?: string
  ) => {
    if (!applicationId) return;

    try {
      await kycService.reviewApplication(applicationId, status, notes);
      await fetchApplication();
    } catch (err) {
      throw err;
    }
  };

  return { application, isLoading, error, refetch: fetchApplication, reviewApplication };
}
