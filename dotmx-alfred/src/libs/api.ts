/**
 * API Client Configuration
 *
 * Base configuration for communicating with the Management API
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_MANAGEMENT_API_URL || 'http://localhost:8080/admin/management';

export interface ApiError {
  error: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
}

// ── Secure token storage (defense-in-depth against XSS) ──────────
// Tokens are base64-encoded in localStorage so they are not plaintext.
// This is NOT a substitute for httpOnly cookies but stops casual
// token inspection via browser devtools or naive XSS payloads.

const TOKEN_PREFIX = '_alfred_';
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

function secureStore(key: string, value: string): void {
  try {
    localStorage.setItem(TOKEN_PREFIX + key, btoa(value));
  } catch {
    // localStorage may be full or unavailable (private browsing, quota)
  }
}

function secureRetrieve(key: string): string | null {
  try {
    const encoded = localStorage.getItem(TOKEN_PREFIX + key);
    if (!encoded) return null;
    return atob(encoded);
  } catch {
    // Corrupted or non-base64 value — clear it
    localStorage.removeItem(TOKEN_PREFIX + key);
    return null;
  }
}

function secureRemove(key: string): void {
  localStorage.removeItem(TOKEN_PREFIX + key);
}

// ── Token helpers ────────────────────────────────────────────────

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return secureRetrieve(TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return secureRetrieve(REFRESH_TOKEN_KEY);
}

export function setAlfredTokens(accessToken: string, refreshToken?: string): void {
  if (typeof window === 'undefined') return;
  if (accessToken) secureStore(TOKEN_KEY, accessToken);
  else secureRemove(TOKEN_KEY);

  if (refreshToken !== undefined) {
    if (refreshToken) secureStore(REFRESH_TOKEN_KEY, refreshToken);
    else secureRemove(REFRESH_TOKEN_KEY);
  }
}

export function clearAlfredTokens(): void {
  secureRemove(TOKEN_KEY);
  secureRemove(REFRESH_TOKEN_KEY);
}

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  const refreshTok = getRefreshToken();
  if (!refreshTok) return false;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshTok }),
        credentials: 'include',
      });
      if (!res.ok) {
        clearAlfredTokens();
        return false;
      }
      const data = await res.json();
      // Support both { token, refresh_token } and { tokens: { access_token, refresh_token } } shapes
      setAlfredTokens(
        data.token || data.tokens?.access_token,
        data.refresh_token || data.tokens?.refresh_token
      );
      return true;
    } catch {
      clearAlfredTokens();
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function redirectToLogin(): void {
  if (typeof window !== 'undefined') {
    clearAlfredTokens();
    window.location.href = '/login';
  }
}

// Auth endpoints that should not trigger a refresh loop
const AUTH_NO_RETRY = ['/auth/login', '/auth/register', '/auth/refresh'];

/**
 * Build URL with query parameters
 */
function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${API_BASE_URL}${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * Make API request
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
  isRetry = false
): Promise<T> {
  const { method = 'GET', body, headers = {}, params } = options;

  const url = buildUrl(endpoint, params);
  const token = getAuthToken();

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Add API key for server-side requests
  if (process.env.MANAGEMENT_API_KEY) {
    requestHeaders['X-Management-API-Key'] = process.env.MANAGEMENT_API_KEY;
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include'
  });

  // Auto-refresh on 401
  if (
    response.status === 401 &&
    !isRetry &&
    getRefreshToken() &&
    !AUTH_NO_RETRY.some((p) => endpoint.includes(p))
  ) {
    if (await tryRefreshToken()) {
      return apiRequest<T>(endpoint, options, true);
    }
    // Refresh failed — redirect to login
    redirectToLogin();
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.message || error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * API client with method shortcuts
 */
export const api = {
  get: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) =>
    apiRequest<T>(endpoint, { method: 'GET', params }),

  post: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, { method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, { method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, { method: 'PATCH', body }),

  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: 'DELETE' })
};

export default api;
