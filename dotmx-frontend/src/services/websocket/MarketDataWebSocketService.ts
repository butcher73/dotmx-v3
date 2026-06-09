/**
 * MarketDataWebSocketService
 *
 * Connects to our own Market Data server WebSocket instead of Bitget directly.
 * The marketdata server proxies Bitget data combined with internal exchange data.
 *
 * This replaces BitgetWebSocketService for all real-time data needs.
 */

export interface MarketDataTickerUpdate {
  symbol: string;
  lastPr: string;
  open24h: string;
  high24h: string;
  low24h: string;
  baseVolume: string;
  quoteVolume: string;
  change24h: string;
  changeUtc24h: string;
  markPrice: string;
  indexPrice: string;
  fundingRate: string;
  nextFundingTime: string;
  bidPr: string;
  askPr: string;
  ts: string;
}

export interface MarketDataKlineUpdate {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataTradeUpdate {
  tradeId: string;
  price: string;
  size: string;
  side: "buy" | "sell";
  ts: string;
}

export interface MarketDataOrderbookUpdate {
  bids: [string, string][];
  asks: [string, string][];
  ts: string;
}

export type TickerHandler = (data: MarketDataTickerUpdate) => void;
export type KlineHandler = (data: MarketDataKlineUpdate) => void;
export type TradeHandler = (data: MarketDataTradeUpdate) => void;
export type OrderbookHandler = (data: MarketDataOrderbookUpdate) => void;
export type ConnectionHandler = (connected: boolean) => void;

export interface MarketDataWsConfig {
  /** WebSocket URL for our marketdata server */
  url?: string;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Max reconnect attempts */
  maxReconnectAttempts?: number;
  /** Reconnect delay in ms */
  reconnectDelayMs?: number;
  /** Enable debug logging */
  enableLogging?: boolean;
}

const DEFAULT_CONFIG: Required<MarketDataWsConfig> = {
  url: getMarketDataWsUrl(),
  autoReconnect: true,
  maxReconnectAttempts: 20,
  reconnectDelayMs: 3000,
  enableLogging: false,
};

function getMarketDataWsUrl(): string {
  if (typeof window !== "undefined") {
    // Client-side: use env var or derive from API URL
    const mdUrl = process.env.NEXT_PUBLIC_MARKETDATA_WS_URL;
    if (mdUrl) return mdUrl;

    const apiUrl = process.env.NEXT_PUBLIC_MARKETDATA_URL;
    if (apiUrl) {
      // Convert http://host:port -> ws://host:port/ws
      const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
      return `${apiUrl.replace(/^https?/, wsProtocol).replace(/\/$/, "")}/ws`;
    }

    // Default: derive from page protocol
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    return `${wsProtocol}//${host}:8080/marketdata/ws`;
  }

  // SSR fallback: use secure protocol by default
  return "wss://localhost:8080/marketdata/ws";
}

export class MarketDataWebSocketService {
  private ws: WebSocket | null = null;
  private config: Required<MarketDataWsConfig>;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;
  private destroyed = false;

  // Subscriptions
  private subscriptions = new Set<string>();

  // Event handlers
  private tickerHandlers = new Map<string, Set<TickerHandler>>();
  private klineHandlers = new Map<string, Set<KlineHandler>>();
  private tradeHandlers = new Map<string, Set<TradeHandler>>();
  private orderbookHandlers = new Map<string, Set<OrderbookHandler>>();
  private connectionHandlers = new Set<ConnectionHandler>();

  constructor(config?: MarketDataWsConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Connection Management ──────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.connected || this.destroyed) return;

    return new Promise((resolve, reject) => {
      try {
        if (this.config.enableLogging) {
          console.warn(`[MarketData WS] Connecting to ${this.config.url}...`);
        }

        this.ws = new WebSocket(this.config.url);

        const timeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.ws.close();
            reject(new Error("Connection timeout"));
          }
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.connected = true;
          this.reconnectAttempts = 0;

          if (this.config.enableLogging) {
            console.warn("[MarketData WS] Connected");
          }

          // Start ping keepalive
          this.startPing();

          // Resubscribe to all channels
          this.resubscribe();

          // Notify connection handlers
          this.notifyConnection(true);

          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error("[MarketData WS] Error:", error);
        };

        this.ws.onclose = () => {
          clearTimeout(timeout);
          this.connected = false;
          this.stopPing();
          this.notifyConnection(false);

          if (this.config.enableLogging) {
            console.warn("[MarketData WS] Disconnected");
          }

          if (!this.destroyed && this.config.autoReconnect) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.destroyed = true;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ── Subscription Management ────────────────────────────────────────

  subscribeTicker(symbol: string, handler: TickerHandler): () => void {
    const key = `ticker:${symbol}`;
    if (!this.tickerHandlers.has(symbol)) {
      this.tickerHandlers.set(symbol, new Set());
    }
    this.tickerHandlers.get(symbol)!.add(handler);

    if (!this.subscriptions.has(key)) {
      this.subscriptions.add(key);
      this.sendSubscribe([{ channel: "ticker", instId: symbol }]);
    }

    return () => {
      this.tickerHandlers.get(symbol)?.delete(handler);
    };
  }

  subscribeKline(
    symbol: string,
    interval: string,
    handler: KlineHandler
  ): () => void {
    const key = `kline:${symbol}:${interval}`;
    const handlerKey = `${symbol}:${interval}`;
    if (!this.klineHandlers.has(handlerKey)) {
      this.klineHandlers.set(handlerKey, new Set());
    }
    this.klineHandlers.get(handlerKey)!.add(handler);

    if (!this.subscriptions.has(key)) {
      this.subscriptions.add(key);
      this.sendSubscribe([{ channel: "kline", instId: symbol, interval }]);
    }

    return () => {
      this.klineHandlers.get(handlerKey)?.delete(handler);
    };
  }

  subscribeTrade(symbol: string, handler: TradeHandler): () => void {
    const key = `trade:${symbol}`;
    if (!this.tradeHandlers.has(symbol)) {
      this.tradeHandlers.set(symbol, new Set());
    }
    this.tradeHandlers.get(symbol)!.add(handler);

    if (!this.subscriptions.has(key)) {
      this.subscriptions.add(key);
      this.sendSubscribe([{ channel: "trade", instId: symbol }]);
    }

    return () => {
      this.tradeHandlers.get(symbol)?.delete(handler);
    };
  }

  subscribeOrderbook(symbol: string, handler: OrderbookHandler): () => void {
    const key = `orderbook:${symbol}`;
    if (!this.orderbookHandlers.has(symbol)) {
      this.orderbookHandlers.set(symbol, new Set());
    }
    this.orderbookHandlers.get(symbol)!.add(handler);

    if (!this.subscriptions.has(key)) {
      this.subscriptions.add(key);
      this.sendSubscribe([{ channel: "orderbook", instId: symbol }]);
    }

    return () => {
      this.orderbookHandlers.get(symbol)?.delete(handler);
    };
  }

  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    // Immediately notify current state
    handler(this.connected);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  /** Update the symbol — clears old subscriptions and subscribes to new ones */
  updateSymbol(oldSymbol: string, newSymbol: string): void {
    // Remove old subscriptions
    const toRemove: string[] = [];
    for (const sub of this.subscriptions) {
      if (sub.includes(`:${oldSymbol}`)) {
        toRemove.push(sub);
      }
    }
    for (const sub of toRemove) {
      this.subscriptions.delete(sub);
    }

    // Move handlers
    const tickerH = this.tickerHandlers.get(oldSymbol);
    if (tickerH) {
      this.tickerHandlers.set(newSymbol, tickerH);
      this.tickerHandlers.delete(oldSymbol);
    }

    // Re-subscribe with new symbol
    const newSubs: Array<{
      channel: string;
      instId: string;
      interval?: string;
    }> = [];
    for (const sub of toRemove) {
      const parts = sub.split(":");
      const channel = parts[0]!;
      const interval = parts[2];
      const newKey = interval
        ? `${channel}:${newSymbol}:${interval}`
        : `${channel}:${newSymbol}`;
      this.subscriptions.add(newKey);
      const entry: { channel: string; instId: string; interval?: string } = {
        channel,
        instId: newSymbol,
      };
      if (interval) entry.interval = interval;
      newSubs.push(entry);
    }

    if (newSubs.length > 0) {
      this.sendSubscribe(newSubs);
    }
  }

  // ── Private Methods ────────────────────────────────────────────────

  private handleMessage(raw: string | ArrayBuffer | Blob): void {
    try {
      const text = typeof raw === "string" ? raw : "";
      if (!text || text === '"pong"' || text === "pong") return;

      const msg = JSON.parse(text);
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case "ticker": {
          const symbol = msg.symbol;
          const handlers = this.tickerHandlers.get(symbol);
          if (handlers) {
            const data = msg.data as MarketDataTickerUpdate;
            for (const handler of handlers) {
              try {
                handler(data);
              } catch (e) {
                console.error("[MarketData WS] Ticker handler error:", e);
              }
            }
          }
          break;
        }

        case "kline": {
          const symbol = msg.symbol;
          const interval = msg.interval;
          const key = `${symbol}:${interval}`;
          const handlers = this.klineHandlers.get(key);
          if (handlers) {
            const data = msg.data as MarketDataKlineUpdate;
            for (const handler of handlers) {
              try {
                handler(data);
              } catch (e) {
                console.error("[MarketData WS] Kline handler error:", e);
              }
            }
          }
          break;
        }

        case "trade": {
          const symbol = msg.symbol;
          const handlers = this.tradeHandlers.get(symbol);
          if (handlers) {
            const data = msg.data as MarketDataTradeUpdate;
            for (const handler of handlers) {
              try {
                handler(data);
              } catch (e) {
                console.error("[MarketData WS] Trade handler error:", e);
              }
            }
          }
          break;
        }

        case "orderbook": {
          const symbol = msg.symbol;
          const handlers = this.orderbookHandlers.get(symbol);
          if (handlers) {
            const data = msg.data as MarketDataOrderbookUpdate;
            for (const handler of handlers) {
              try {
                handler(data);
              } catch (e) {
                console.error("[MarketData WS] Orderbook handler error:", e);
              }
            }
          }
          break;
        }

        case "subscribed":
        case "unsubscribed":
          // Acknowledgement — no-op
          break;

        default:
          if (this.config.enableLogging) {
            console.warn("[MarketData WS] Unknown message type:", msg.type);
          }
      }
    } catch {
      // Parse error — ignore non-JSON messages
    }
  }

  private sendSubscribe(
    args: Array<{ channel: string; instId: string; interval?: string }>
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        action: "subscribe",
        args,
      })
    );
  }

  private resubscribe(): void {
    if (this.subscriptions.size === 0) return;

    const args: Array<{ channel: string; instId: string; interval?: string }> =
      [];
    for (const sub of this.subscriptions) {
      const parts = sub.split(":");
      const entry: { channel: string; instId: string; interval?: string } = {
        channel: parts[0]!,
        instId: parts[1]!,
      };
      if (parts[2]) entry.interval = parts[2];
      args.push(entry);
    }

    this.sendSubscribe(args);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error("[MarketData WS] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectDelayMs * Math.pow(1.5, this.reconnectAttempts - 1),
      30000
    );

    if (this.config.enableLogging) {
      console.warn(
        `[MarketData WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`
      );
    }

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((err) => {
        console.error("[MarketData WS] Reconnect failed:", err);
      });
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify("ping"));
      }
    }, 25000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private notifyConnection(connected: boolean): void {
    for (const handler of this.connectionHandlers) {
      try {
        handler(connected);
      } catch {
        /* */
      }
    }

    // Also dispatch DOM event for UI indicators
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ws-connection-status", { detail: { connected } })
      );
    }
  }
}

// Singleton instance for the entire app
let _instance: MarketDataWebSocketService | null = null;

export function getMarketDataWs(
  config?: MarketDataWsConfig
): MarketDataWebSocketService {
  if (!_instance) {
    _instance = new MarketDataWebSocketService(config);
  }
  return _instance;
}

export function resetMarketDataWs(): void {
  if (_instance) {
    _instance.disconnect();
    _instance = null;
  }
}
