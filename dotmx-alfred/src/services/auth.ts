/**
 * Authentication API Service
 */

import { api } from '@/libs/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'viewer';
  avatar?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  expiresAt: string;
}

export interface UpdateProfileParams {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
  avatar?: string;
}

export const authService = {
  /**
   * Login with email and password
   */
  login: (credentials: LoginCredentials) =>
    api.post<LoginResponse>('/auth/login', credentials),

  /**
   * Logout current user
   */
  logout: () =>
    api.post<void>('/auth/logout', {}),

  /**
   * Get current user profile
   */
  getProfile: () =>
    api.get<User>('/auth/profile'),

  /**
   * Update user profile
   */
  updateProfile: (data: UpdateProfileParams) =>
    api.put<User>('/auth/profile', data),

  /**
   * Refresh authentication token
   */
  refreshToken: () =>
    api.post<LoginResponse>('/auth/refresh', {}),
};
