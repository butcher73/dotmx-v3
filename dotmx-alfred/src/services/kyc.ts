/**
 * KYC API Service
 */

import { api, type PaginatedResponse } from '@/libs/api';

export interface KycApplication {
  id: string;
  userId: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_review';
  level: 1 | 2 | 3;
  documentType: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  notes: string | null;
}

export interface KycApplicationDetail extends KycApplication {
  documentNumber: string;
  documentCountry: string;
  documentExpiry: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address: Record<string, unknown>;
  documents: Array<{
    type: string;
    url: string;
    status: string;
  }>;
}

export interface KycListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  level?: number;
  [key: string]: string | number | boolean | undefined;
}

export const kycService = {
  /**
   * Get paginated list of KYC applications
   */
  getApplications: (params: KycListParams = {}) =>
    api.get<PaginatedResponse<KycApplication>>('/kyc', params),

  /**
   * Get KYC application details
   */
  getApplication: (applicationId: string) =>
    api.get<KycApplicationDetail>(`/kyc/${applicationId}`),

  /**
   * Review KYC application (approve/reject)
   */
  reviewApplication: (
    applicationId: string,
    status: 'approved' | 'rejected' | 'in_review',
    notes?: string
  ) =>
    api.patch<{ success: boolean }>(`/kyc/${applicationId}/review`, { status, notes })
};
