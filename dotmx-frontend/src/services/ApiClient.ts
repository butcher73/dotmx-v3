/**
 * API Client for DotMX Backend
 * Handles all communication with the backend API
 */

import { buildQueryString } from "./helpers/queryParams";
import type {
  AddWhitelistAddressRequest,
  ApiError,
  ApiKey,
  AssetTransaction,
  AssetTransactionType,
  AuthResponse,
  Balance,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  CreateWithdrawalRequest,
  DepositAddress,
  JobApplicationRequest,
  JobLocation,
  JobPosting,
  JobType,
  LoginRequest,
  NewListedAsset,
  Order,
  OrderRequest,
  Pagination,
  PaginatedResponse,
  PasswordChangeRequest,
  PasswordResetRequest,
  PasswordResetVerify,
  Position,
  RegisterRequest,
  Session,
  SupportedAsset,
  SupportedNetwork,
  Trade,
  Transaction,
  TwoFactorSetupResponse,
  TwoFactorStatus,
  UpdateProfileRequest,
  User,
  UserBalance,
  WhitelistAddress,
  WhitelistResponse,
  WithdrawalRequest,
  WithdrawalStatus,
} from "./types/api.types";

// Re-export all types so existing `import { X } from '@/services/ApiClient'` still works
export * from "./types/api.types";

// Auth endpoints excluded from automatic token refresh
const AUTH_NO_RETRY = ["/auth/login", "/auth/register", "/auth/refresh"];

// ── Secure token storage (defense-in-depth against XSS) ──────────
// Tokens are base64-encoded in localStorage so they are not plaintext.
// This is NOT a substitute for httpOnly cookies but stops casual
// token inspection via browser devtools or naive XSS payloads.

const TOKEN_PREFIX = "_dt_";

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

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    this.baseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

    if (typeof window !== "undefined") {
      this.authToken = secureRetrieve("accessToken");
      this.refreshToken = secureRetrieve("refreshToken");
    }
  }

  // ── Token helpers ──────────────────────────────────────────────

  setAuthToken(accessToken: string | null, refreshToken?: string | null) {
    this.authToken = accessToken;
    if (refreshToken !== undefined) this.refreshToken = refreshToken;

    if (typeof window === "undefined") return;

    this.persistToken("accessToken", accessToken);
    if (refreshToken !== undefined)
      this.persistToken("refreshToken", refreshToken);
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  private persistToken(key: string, value: string | null | undefined) {
    if (value) secureStore(key, value);
    else secureRemove(key);
  }

  // ── Core request infrastructure ────────────────────────────────

  private async tryRefreshToken(): Promise<boolean> {
    if (this.isRefreshing && this.refreshPromise) return this.refreshPromise;
    if (!this.refreshToken) return false;

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: this.refreshToken }),
        });
        if (!res.ok) {
          this.setAuthToken(null, null);
          return false;
        }
        const data = await res.json();
        this.setAuthToken(data.tokens.access_token, data.tokens.refresh_token);
        return true;
      } catch {
        this.setAuthToken(null, null);
        return false;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (this.authToken) headers["Authorization"] = `Bearer ${this.authToken}`;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    // Auto-refresh on 401
    if (
      response.status === 401 &&
      !isRetry &&
      this.refreshToken &&
      !AUTH_NO_RETRY.some((p) => endpoint.includes(p))
    ) {
      if (await this.tryRefreshToken()) {
        return this.request<T>(endpoint, options, true);
      }
      // Refresh failed — clear tokens and redirect to login
      this.setAuthToken(null, null);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Session expired. Please log in again.");
    }

    if (!response.ok) await this.buildError(response, endpoint);
    return response.json();
  }

  private async buildError(
    response: Response,
    endpoint: string
  ): Promise<never> {
    let errorMessage = `HTTP ${response.status}`;
    let errorData: ApiError | null = null;

    try {
      errorData = await response.json();
      if (errorData && typeof errorData === "object") {
        if ("message" in errorData) errorMessage = errorData.message as string;
        else if ("error" in errorData) errorMessage = errorData.error as string;
      } else if (typeof errorData === "string") {
        errorMessage = errorData;
      }
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    // Friendly overrides: keep specific backend messages, but replace known generic auth text
    const hasSpecificMessage = !errorMessage.startsWith("HTTP ");
    const normalizedMessage = errorMessage.trim().toLowerCase();
    const isGenericAuthMessage =
      normalizedMessage === "unauthorized" ||
      normalizedMessage === "authentication failed" ||
      normalizedMessage === "invalid credentials";
    const shouldOverrideAuthMessage =
      response.status === 401 && (!hasSpecificMessage || isGenericAuthMessage);

    if (!hasSpecificMessage || shouldOverrideAuthMessage) {
      const statusMessages: Record<number, string | ((ep: string) => string)> =
      {
        401: (ep) =>
          ep.includes("/login")
            ? "Invalid email or password. Please try again."
            : ep.includes("/auth/me")
              ? "Session expired"
              : "Authentication failed. Please log in again.",
        403: "Access denied. Your account may be locked or suspended.",
        404: "Service not found. Please check your connection.",
      };

      const override = statusMessages[response.status];
      if (override) {
        errorMessage =
          typeof override === "function" ? override(endpoint) : override;
      } else if (response.status >= 500) {
        errorMessage = "Server error. Please try again later.";
      }
    }

    const error = new Error(errorMessage) as Error & {
      statusCode?: number;
      errorData?: unknown;
    };
    error.statusCode = response.status;
    error.errorData = errorData;
    throw error;
  }

  /** Shorthand for POST with JSON body */
  private post<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /** Shorthand for PATCH with JSON body */
  private patch<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  /** Shorthand for DELETE */
  private delete<T = void>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  // ── Authentication ─────────────────────────────────────────────

  private async authenticate(
    endpoint: string,
    data: LoginRequest | RegisterRequest
  ): Promise<AuthResponse> {
    const response = await this.post<AuthResponse>(endpoint, data);
    this.setAuthToken(
      response.tokens.access_token,
      response.tokens.refresh_token
    );
    return response;
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    return this.authenticate("/auth/register", data);
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    return this.authenticate("/auth/login", data);
  }

  async refreshAccessToken(): Promise<AuthResponse> {
    if (!this.refreshToken) throw new Error("No refresh token available");
    return this.authenticate("/auth/refresh", {
      refresh_token: this.refreshToken,
    } as unknown as LoginRequest);
  }

  async logout(): Promise<void> {
    try {
      if (this.refreshToken) {
        await this.post("/auth/logout", { refresh_token: this.refreshToken });
      }
    } finally {
      this.setAuthToken(null, null);
    }
  }

  // ── Profile ────────────────────────────────────────────────────

  async getProfile(): Promise<User> {
    return this.request<User>("/auth/me");
  }

  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    return this.patch<User>("/auth/me", data);
  }

  // ── API Keys ───────────────────────────────────────────────────

  async getApiKeys(): Promise<ApiKey[]> {
    return (await this.request<{ api_keys: ApiKey[] }>("/auth/api-keys"))
      .api_keys;
  }

  async createApiKey(data: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    return this.post<CreateApiKeyResponse>("/auth/api-keys", data);
  }

  async revokeApiKey(keyId: string): Promise<void> {
    await this.delete(`/auth/api-keys/${keyId}`);
  }

  // ── Sessions ───────────────────────────────────────────────────

  async getSessions(): Promise<Session[]> {
    return (await this.request<{ sessions: Session[] }>("/auth/sessions"))
      .sessions;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.delete(`/auth/sessions/${sessionId}`);
  }

  // ── Two-Factor Authentication ──────────────────────────────────

  async get2FAStatus(): Promise<TwoFactorStatus> {
    return this.request<TwoFactorStatus>("/auth/2fa/status");
  }

  async setup2FA(): Promise<TwoFactorSetupResponse> {
    return this.post<TwoFactorSetupResponse>("/auth/2fa/setup", {});
  }

  async verify2FA(
    code: string
  ): Promise<{ success: boolean; message: string }> {
    return this.post("/auth/2fa/verify", { code });
  }

  async disable2FA(
    password: string
  ): Promise<{ success: boolean; message: string }> {
    return this.post("/auth/2fa/disable", { password });
  }

  // ── Withdrawal Whitelist ───────────────────────────────────────

  async getWhitelist(): Promise<WhitelistResponse> {
    return this.request<WhitelistResponse>("/auth/whitelist");
  }

  async toggleWhitelist(
    enabled: boolean
  ): Promise<{ enabled: boolean; message: string }> {
    return this.patch("/auth/whitelist/toggle", { enabled });
  }

  async addWhitelistAddress(
    data: AddWhitelistAddressRequest
  ): Promise<{ address: WhitelistAddress; message: string }> {
    return this.post("/auth/whitelist", data);
  }

  async removeWhitelistAddress(addressId: string): Promise<void> {
    await this.delete(`/auth/whitelist/${addressId}`);
  }

  // ── Password Management ────────────────────────────────────────

  async requestPasswordReset(
    data: PasswordResetRequest
  ): Promise<{ message: string }> {
    return this.post("/auth/password/reset/request", data);
  }

  async resetPassword(data: PasswordResetVerify): Promise<{ message: string }> {
    return this.post("/auth/password/reset/verify", data);
  }

  async changePassword(
    data: PasswordChangeRequest
  ): Promise<{ message: string }> {
    return this.post("/auth/password/change", data);
  }

  // ── Trading ────────────────────────────────────────────────────

  async placeOrder(order: OrderRequest): Promise<Order> {
    return this.post<Order>("/v1/orders", order);
  }

  async cancelOrder(orderId: string): Promise<Order> {
    return this.delete<Order>(`/v1/orders/${orderId}`);
  }

  async getOrder(orderId: string): Promise<Order> {
    return this.request<Order>(`/v1/orders/${orderId}`);
  }

  async getOpenOrders(symbol?: string): Promise<{ orders: Order[] }> {
    return this.request(`/v1/openOrders${buildQueryString({ symbol })}`);
  }

  async getTrades(symbol?: string): Promise<{ trades: Trade[] }> {
    return this.request(`/v1/trades${buildQueryString({ symbol })}`);
  }

  async getUserOrderHistory(params?: {
    symbol?: string;
    status?: string;
    limit?: number;
    page?: number;
  }): Promise<{ orders: Order[]; pagination?: Pagination }> {
    return this.request(`/v1/trades${buildQueryString(params ?? {})}`);
  }

  async getUserTransactions(params?: {
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: Transaction[] }> {
    return this.request(
      `/assets/transactions${buildQueryString(params ?? {})}`
    );
  }

  // ── Positions ──────────────────────────────────────────────────

  async getPositions(): Promise<{ positions: Position[] }> {
    return this.request<{ positions: Position[] }>("/v1/positions");
  }

  async closePosition(positionId: string): Promise<void> {
    await this.post(`/v1/positions/${positionId}/close`, {});
  }

  // ── Account ────────────────────────────────────────────────────

  async getBalance(): Promise<Balance> {
    // Derive account-level balance from the asset balances endpoint
    const result = await this.request<{ balances: UserBalance[] }>(
      "/assets/balances"
    );
    const balances = result.balances || [];

    let total = 0;
    let available = 0;
    let locked = 0;

    for (const b of balances) {
      total += parseFloat(b.total) || 0;
      available += parseFloat(b.available) || 0;
      locked += parseFloat(b.locked) || 0;
    }

    return { total, available, margin: locked, pnl: 0 };
  }

  async getAccountMetrics(): Promise<{
    totalValue: number;
    availableBalance: number;
    totalMargin: number;
    totalPnl: number;
  }> {
    const balance = await this.getBalance();
    return {
      totalValue: balance.total,
      availableBalance: balance.available,
      totalMargin: balance.margin,
      totalPnl: balance.pnl,
    };
  }

  // ── Assets ─────────────────────────────────────────────────────

  async getSupportedAssets(): Promise<{ assets: SupportedAsset[] }> {
    return this.request("/assets/supported");
  }

  async getDepositTokens(): Promise<{ assets: SupportedAsset[] }> {
    return this.request("/assets/deposit-tokens");
  }

  async getNewListings(
    limit: number = 3
  ): Promise<{ assets: NewListedAsset[] }> {
    return this.request(`/assets/new-listings${buildQueryString({ limit })}`);
  }

  async getSupportedNetworks(): Promise<{ networks: SupportedNetwork[] }> {
    return this.request("/assets/networks");
  }

  async getAssetBalances(): Promise<{ balances: UserBalance[] }> {
    return this.request("/assets/balances");
  }

  async getAssetBalance(symbol: string): Promise<{ balance: UserBalance }> {
    return this.request(`/assets/balances/${symbol}`);
  }

  async getDepositAddress(
    assetSymbol: string,
    networkCode: string
  ): Promise<{ address: DepositAddress; is_new: boolean; message: string }> {
    return this.request(
      `/assets/${assetSymbol}/deposit-address/${networkCode}`
    );
  }

  async getAllDepositAddresses(): Promise<{ addresses: DepositAddress[] }> {
    return this.request("/assets/deposit-addresses");
  }

  async createWithdrawal(
    data: CreateWithdrawalRequest
  ): Promise<{ withdrawal: WithdrawalRequest; message: string }> {
    return this.post("/assets/withdraw", data);
  }

  async getWithdrawals(params?: {
    status?: WithdrawalStatus;
    asset_symbol?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<WithdrawalRequest>> {
    return this.request(`/assets/withdrawals${buildQueryString(params ?? {})}`);
  }

  async getAssetTransactions(params?: {
    asset_symbol?: string;
    tx_type?: AssetTransactionType;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<AssetTransaction>> {
    return this.request(
      `/assets/transactions${buildQueryString(params ?? {})}`
    );
  }

  // ── Market Data ────────────────────────────────────────────────

  private get marketDataBaseUrl(): string {
    return (
      (typeof window !== "undefined"
        ? process.env.NEXT_PUBLIC_MARKETDATA_URL
        : undefined) || "http://localhost:8080/marketdata"
    );
  }

  async getMarketTicker(symbol: string): Promise<{
    symbol: string;
    lastPrice: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
    priceChange: string;
    priceChangePercent: string;
    trades: number;
  }> {
    const url = `${this.marketDataBaseUrl}/v1/market/ticker/24hr${buildQueryString({ symbol })}`;
    const response = await fetch(url);
    if (!response.ok) await this.buildError(response, url);
    return response.json();
  }

  async getMarketDepth(
    symbol: string,
    limit?: number
  ): Promise<{
    symbol: string;
    bids: [number, number, number][];
    asks: [number, number, number][];
    timestamp: number;
  }> {
    const url = `${this.marketDataBaseUrl}/v1/market/depth${buildQueryString({ symbol, limit })}`;
    const response = await fetch(url);
    if (!response.ok) await this.buildError(response, url);
    return response.json();
  }

  async getMarketTrades(
    symbol: string,
    limit?: number
  ): Promise<{
    trades: Array<{
      id: string;
      symbol: string;
      price: number;
      quantity: number;
      side: string;
      timestamp: string;
    }>;
  }> {
    const url = `${this.marketDataBaseUrl}/v1/market/trades/recent${buildQueryString({ symbol, limit })}`;
    const response = await fetch(url);
    if (!response.ok) await this.buildError(response, url);
    return response.json();
  }

  async getFundingRate(symbol: string): Promise<{
    symbol: string;
    fundingRate: number;
    markPrice: number;
    indexPrice: number;
    nextFundingTime: string;
    timestamp: string;
  }> {
    const url = `${this.marketDataBaseUrl}/v1/market/funding-rate/${encodeURIComponent(symbol)}`;
    const response = await fetch(url);
    if (!response.ok) await this.buildError(response, url);
    return response.json();
  }

  async getAllFundingRates(): Promise<{
    rates: Array<{
      symbol: string;
      fundingRate: number;
      markPrice: number;
      indexPrice: number;
      nextFundingTime: string;
      timestamp: string;
    }>;
  }> {
    const url = `${this.marketDataBaseUrl}/v1/market/funding-rates`;
    const response = await fetch(url);
    if (!response.ok) await this.buildError(response, url);
    return response.json();
  }

  async getMarkPrice(symbol: string): Promise<{
    symbol: string;
    markPrice: number;
    indexPrice: number;
    lastFundingRate: number;
    nextFundingTime: string;
    timestamp: string;
  }> {
    const url = `${this.marketDataBaseUrl}/v1/market/mark-price/${encodeURIComponent(symbol)}`;
    const response = await fetch(url);
    if (!response.ok) await this.buildError(response, url);
    return response.json();
  }

  async getOpenInterest(symbol: string): Promise<{
    symbol: string;
    openInterest: number;
    longOpenInterest: number;
    shortOpenInterest: number;
    totalPositions: number;
    timestamp: string;
  }> {
    const url = `${this.marketDataBaseUrl}/v1/market/open-interest/${encodeURIComponent(symbol)}`;
    const response = await fetch(url);
    if (!response.ok) await this.buildError(response, url);
    return response.json();
  }

  // ── Careers ────────────────────────────────────────────────────

  async getJobPostings(params?: {
    department?: string;
    type?: JobType;
    location?: JobLocation;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<JobPosting>> {
    return this.request(`/careers/jobs${buildQueryString(params ?? {})}`);
  }

  async getJobPosting(jobId: string): Promise<{ job: JobPosting }> {
    return this.request(`/careers/jobs/${jobId}`);
  }

  async submitJobApplication(
    data: JobApplicationRequest
  ): Promise<{ application_id: string; message: string }> {
    return this.post("/careers/apply", data);
  }

  async getJobDepartments(): Promise<{ departments: string[] }> {
    return this.request("/careers/departments");
  }

  // ── Custodial Wallet ───────────────────────────────────────────

  async getWalletChains(): Promise<{
    chains: Array<{
      chain_code: string;
      chain_id: number;
      name: string;
      native_symbol: string;
      explorer_url: string;
      confirmations_required: number;
    }>;
  }> {
    return this.request("/wallet/chains");
  }

  async requestDepositAddress(chainCode: string): Promise<{
    address: string;
    chain_code: string;
    chain_id: number;
    chain_name: string;
    explorer_url: string;
    created_at: string;
  }> {
    return this.post("/wallet/deposit-address", { chain_code: chainCode });
  }

  async getWalletDepositAddresses(): Promise<{
    addresses: Array<{
      address: string;
      chain_code: string;
      chain_id: number;
      chain_name: string;
      explorer_url: string;
      created_at: string;
    }>;
  }> {
    return this.request("/wallet/deposit-addresses");
  }

  async getWalletDeposits(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    deposits: Array<{
      id: string;
      network_code: string;
      asset_symbol: string;
      amount: string;
      tx_hash: string;
      status: string;
      confirmations: number;
      detected_at: string;
      confirmed_at: string | null;
      swept_at: string | null;
      created_at: string;
    }>;
    pagination: { limit: number; offset: number; total: number };
  }> {
    return this.request(`/wallet/deposits${buildQueryString(params ?? {})}`);
  }

  async getWalletBalances(): Promise<{
    balances: Array<{
      token_symbol: string;
      chain_code: string;
      available: string;
      locked: string;
      total: string;
    }>;
  }> {
    return this.request("/wallet/balances");
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
