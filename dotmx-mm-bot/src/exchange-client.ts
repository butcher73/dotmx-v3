/**
 * Exchange API Client
 *
 * Typed HTTP client for the DotMX exchange API.
 * Supports both JWT and API key authentication.
 */

import { CONFIG } from "./config";

// ─── Types ─────────────────────────────────────────────────────────────

export interface OrderRequest {
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET" | "STOP_LIMIT" | "STOP_MARKET";
  quantity: number;
  price?: number;
  timeInForce?: "GTC" | "IOC" | "FOK" | "POST_ONLY";
  clientOrderId?: string;
}

export interface OrderResponse {
  orderId: string;
  symbol: string;
  side: string;
  type: string;
  price: number | null;
  quantity: number;
  timeInForce: string;
  status: string;
}

export interface CancelResponse {
  orderId: string;
  status: string;
}

export interface OrderbookResponse {
  symbol: string;
  bids: [number, number, number][];
  asks: [number, number, number][];
  timestamp: number;
}

export interface TickerResponse {
  symbol: string;
  lastPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  priceChange: number;
  priceChangePercent: number;
}

export interface BalanceEntry {
  asset_id: string;
  symbol: string;
  name: string;
  available: string;
  locked: string;
  pending: string;
  total: string;
}

export interface OpenOrder {
  orderId: string;
  symbol: string;
  side: string;
  type: string;
  price: number;
  quantity: number;
  status: string;
  createdAt: string;
  clientOrderId?: string;
}

export interface BatchOrderRequest {
  orders: OrderRequest[];
}

export interface BatchOrderResponse {
  results: { index: number; success: boolean; orderId?: string; error?: string }[];
}

// ─── Client ────────────────────────────────────────────────────────────

export class ExchangeClient {
  private baseUrl: string;
  private apiKey: string | null = null;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt = 0;

  /** Tracks request counts for rate limiting awareness */
  private requestCount = 0;
  private requestWindowStart = Date.now();

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || CONFIG.apiBaseUrl;
  }

  // ── Auth ──

  /** Authenticate with API key (preferred for bots) */
  setApiKey(key: string) {
    this.apiKey = key;
    this.accessToken = null;
  }

  /** Authenticate with email/password (falls back for key generation) */
  async login(email: string, password: string): Promise<void> {
    const res = await this.rawFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      throw new Error(`Login failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    this.accessToken = data.tokens.access_token;
    this.refreshToken = data.tokens.refresh_token;
    this.tokenExpiresAt = Date.now() + data.tokens.expires_in * 1000 - 30_000; // 30s buffer
  }

  /** Refresh JWT when close to expiry */
  private async ensureAuth(): Promise<void> {
    if (this.apiKey) return; // API keys don't expire

    if (!this.accessToken) {
      throw new Error("Not authenticated. Call login() or setApiKey() first.");
    }

    if (Date.now() > this.tokenExpiresAt && this.refreshToken) {
      const res = await this.rawFetch("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (res.ok) {
        const data = await res.json();
        this.accessToken = data.tokens.access_token;
        this.refreshToken = data.tokens.refresh_token;
        this.tokenExpiresAt =
          Date.now() + data.tokens.expires_in * 1000 - 30_000;
      }
    }
  }

  private authHeaders(): Record<string, string> {
    if (this.apiKey) {
      return { "X-API-Key": this.apiKey };
    }
    if (this.accessToken) {
      return { Authorization: `Bearer ${this.accessToken}` };
    }
    return {};
  }

  // ── Trading ──

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    return this.authedRequest<OrderResponse>("POST", "/v1/orders", order);
  }

  async placeBatchOrders(orders: OrderRequest[]): Promise<BatchOrderResponse> {
    return this.authedRequest<BatchOrderResponse>("POST", "/v1/orders/batch", {
      orders,
    });
  }

  async cancelOrder(orderId: string): Promise<CancelResponse> {
    return this.authedRequest<CancelResponse>(
      "DELETE",
      `/v1/orders/${orderId}`
    );
  }

  async cancelAllOrders(symbol?: string): Promise<void> {
    // Cancel all open orders for a symbol (or all symbols)
    const openOrders = await this.getOpenOrders(symbol);
    await Promise.all(
      openOrders.map((o) => this.cancelOrder(o.orderId).catch(() => {}))
    );
  }

  async getOpenOrders(symbol?: string): Promise<OpenOrder[]> {
    const qs = symbol ? `?symbol=${symbol}&limit=200` : "?limit=200";
    const result = await this.authedRequest<{ orders: OpenOrder[] } | OpenOrder[]>(
      "GET",
      `/v1/openOrders${qs}`
    );
    return Array.isArray(result) ? result : result.orders || [];
  }

  // ── Market Data (public, no auth) ──

  async getOrderbook(
    symbol: string,
    limit = 20
  ): Promise<OrderbookResponse> {
    return this.publicRequest<OrderbookResponse>(
      `/v1/market/depth?symbol=${symbol}&limit=${limit}`
    );
  }

  async getTicker(symbol: string): Promise<TickerResponse> {
    return this.publicRequest<TickerResponse>(
      `/v1/market/ticker/24hr?symbol=${symbol}`
    );
  }

  async getSymbols(): Promise<{ symbols: { symbol: string; baseAsset: string; quoteAsset: string; status: string }[] }> {
    return this.publicRequest("/symbols");
  }

  // ── Account ──

  async getBalances(): Promise<{ balances: BalanceEntry[] }> {
    return this.authedRequest("GET", "/assets/balances");
  }

  // ── Internal ──

  private async authedRequest<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    await this.ensureAuth();
    this.trackRequest();

    const res = await this.rawFetch(path, {
      method,
      headers: {
        ...this.authHeaders(),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`);
    }

    return res.json() as Promise<T>;
  }

  private async publicRequest<T>(path: string): Promise<T> {
    this.trackRequest();
    const res = await this.rawFetch(path);
    if (!res.ok) {
      throw new Error(
        `API GET ${path} failed: ${res.status} ${await res.text()}`
      );
    }
    return res.json() as Promise<T>;
  }

  private rawFetch(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...((init?.headers as Record<string, string>) || {}),
      },
    });
  }

  private trackRequest() {
    const now = Date.now();
    if (now - this.requestWindowStart > 60_000) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }
    this.requestCount++;
  }

  get requestsPerMinute(): number {
    return this.requestCount;
  }
}
