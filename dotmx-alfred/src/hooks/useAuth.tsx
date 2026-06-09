'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authService, type User, type LoginCredentials } from '@/services/auth';
import { setAlfredTokens, clearAlfredTokens } from '@/libs/api';

// ── Secure user profile cache ────────────────────────────────────
// The user profile is not a secret (unlike tokens) but we still
// encode it to avoid casual inspection and to be consistent.

const USER_CACHE_KEY = '_alfred__user';

function cacheUser(user: User | null): void {
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, btoa(JSON.stringify(user)));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {
    // Silently fail — profile can be re-fetched from the API
  }
}

function loadCachedUser(): User | null {
  try {
    const encoded = localStorage.getItem(USER_CACHE_KEY);
    if (!encoded) return null;
    return JSON.parse(atob(encoded));
  } catch {
    localStorage.removeItem(USER_CACHE_KEY);
    return null;
  }
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Load user from localStorage on mount
    const cachedUser = loadCachedUser();
    if (cachedUser) {
      setUser(cachedUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await authService.login(credentials);
      // Store tokens securely (via api layer)
      setAlfredTokens(response.token, (response as unknown as Record<string, unknown>).refresh_token as string);
      cacheUser(response.user);
      setUser(response.user);
      router.push('/');
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAlfredTokens();
      cacheUser(null);
      setUser(null);
      router.push('/login');
    }
  };

  const refreshProfile = async () => {
    try {
      const profile = await authService.getProfile();
      cacheUser(profile);
      setUser(profile);
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
