'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  usersService, 
  type UserListItem, 
  type UserDetail,
  type UsersListParams 
} from '@/services/users';
import type { PaginatedResponse } from '@/libs/api';

export function useUsers(initialParams: UsersListParams = {}) {
  const [data, setData] = useState<PaginatedResponse<UserListItem> | null>(null);
  const [params, setParams] = useState(initialParams);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await usersService.getUsers(params);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const setPage = (page: number) => {
    setParams(prev => ({ ...prev, page }));
  };

  const setSearch = (search: string) => {
    setParams(prev => ({ ...prev, search, page: 1 }));
  };

  const setStatus = (status: string | undefined) => {
    setParams(prev => ({ ...prev, status, page: 1 }));
  };

  const setRole = (role: string | undefined) => {
    setParams(prev => ({ ...prev, role, page: 1 }));
  };

  return {
    users: data?.data || [],
    pagination: data?.pagination,
    isLoading,
    error,
    refetch: fetchUsers,
    setPage,
    setSearch,
    setStatus,
    setRole,
    params
  };
}

export function useUser(userId: string | null) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await usersService.getUser(userId);
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const updateStatus = async (status: UserListItem['status']) => {
    if (!userId) return;
    
    try {
      await usersService.updateStatus(userId, status);
      await fetchUser();
    } catch (err) {
      throw err;
    }
  };

  const updateRole = async (role: string) => {
    if (!userId) return;
    
    try {
      await usersService.updateRole(userId, role);
      await fetchUser();
    } catch (err) {
      throw err;
    }
  };

  return { user, isLoading, error, refetch: fetchUser, updateStatus, updateRole };
}
