/**
 * Users API Service
 */

import { api, type PaginatedResponse } from '@/libs/api';

export interface UserListItem {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: 'active' | 'suspended' | 'banned' | 'deleted';
  kycStatus: 'none' | 'pending' | 'approved' | 'rejected';
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserBalance {
  currency: string;
  available: number;
  locked: number;
  total: number;
}

export interface UserDetail extends UserListItem {
  avatarUrl: string | null;
  mfaEnabled: boolean;
  metadata: Record<string, unknown>;
  balances: UserBalance[];
  recentTransactions: Array<{
    id: string;
    userId: string;
    userEmail: string;
    type: string;
    currency: string;
    amount: number;
    status: string;
    txHash: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
}

export interface UsersListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  role?: string;
  [key: string]: string | number | boolean | undefined;
}

export const usersService = {
  /**
   * Get paginated list of users
   */
  getUsers: (params: UsersListParams = {}) =>
    api.get<PaginatedResponse<UserListItem>>('/users', params),

  /**
   * Get user details
   */
  getUser: (userId: string) =>
    api.get<UserDetail>(`/users/${userId}`),

  /**
   * Update user status
   */
  updateStatus: (userId: string, status: UserListItem['status']) =>
    api.patch<{ success: boolean }>(`/users/${userId}/status`, { status }),

  /**
   * Update user role
   */
  updateRole: (userId: string, role: string) =>
    api.patch<{ success: boolean }>(`/users/${userId}/role`, { role }),

  /**
   * Update user profile information
   */
  updateUser: (userId: string, data: {
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  }) =>
    api.patch<{ success: boolean; user: UserDetail }>(`/users/${userId}`, data),

  /**
   * Change user password (admin)
   */
  changePassword: (userId: string, newPassword: string) =>
    api.patch<{ success: boolean }>(`/users/${userId}/password`, { newPassword })
};
