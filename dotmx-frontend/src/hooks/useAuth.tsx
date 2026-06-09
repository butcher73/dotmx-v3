/**
 * Authentication Hooks
 * Backend API authentication via JWT tokens
 */

"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import {
  apiClient,
  type User,
  type LoginRequest,
  type RegisterRequest,
} from "@/services/ApiClient";
import { getDeviceInfo } from "@/utils/device";

// Authentication Context
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Provider Component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const token = apiClient.getAuthToken();
      if (!token) {
        setUser(null);
        return;
      }
      const profile = await apiClient.getProfile();
      setUser(profile);
    } catch (error: unknown) {
      // Only log out if it's an actual authentication error (401)
      // Silently handle expired tokens without showing errors
      const err = error as { statusCode?: number };
      if (err?.statusCode === 401) {
        setUser(null);
        apiClient.setAuthToken(null);
      } else {
        // For other errors, log but don't logout
        console.error("Failed to load profile:", error);
      }
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      await refreshProfile();
      setIsLoading(false);
    };
    initAuth();
  }, [refreshProfile]);

  const login = useCallback(async (credentials: LoginRequest) => {
    // Add device info to credentials for session tracking
    const deviceInfo = getDeviceInfo();
    const response = await apiClient.login({
      ...credentials,
      device_name: credentials.device_name || deviceInfo.device_name,
      device_fingerprint:
        credentials.device_fingerprint || deviceInfo.device_fingerprint,
    });
    setUser(response.user);
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await apiClient.register(data);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await apiClient.logout();
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access authentication state and methods
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Hook for account information
 */
export function useAccount() {
  const { user, isAuthenticated, isLoading } = useAuth();

  return {
    address: user?.id || undefined, // Use user ID as address replacement
    isConnected: isAuthenticated,
    isConnecting: isLoading,
    isDisconnected: !isAuthenticated && !isLoading,
    user,
  };
}

/**
 * Hook for connect functionality
 */
export function useConnect() {
  const { login } = useAuth();

  return {
    connect: login,
    isLoading: false,
    error: null,
  };
}
