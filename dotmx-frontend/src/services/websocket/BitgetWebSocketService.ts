/**
 * @deprecated LEGACY — Direct Bitget WebSocket Service
 *
 * This service connects DIRECTLY to wss://ws.bitget.com, bypassing the DotMX backend.
 * It should NOT be used in production. All market data should flow through:
 *   MarketDataWebSocketService → DotMX Backend → Exchange
 *
 * This file is kept for reference only. Use MarketDataWebSocketService instead.
 * See: packages/marketdata/src/datasource.ts for the multi-source architecture.
 */

import {
  WebSocketManager,
  WebSocketState,
  WebSocketMessage,
} from "./WebSocketManager";

export interface BitgetStreamConfig {
  symbol: string;
  streams: BitgetStreamType[];
  timeFrame?: string; // For candlestick data: '1m', '5m', '15m', '30m', '1H', '4H', '1D', etc.
  autoReconnect?: boolean;
  enableLogging?: boolean;
}

export enum BitgetStreamType {
  TICKER = "ticker",
  DEPTH = "depth",
  TRADE = "trade",
  BOOKS5 = "books5",
  BOOKS15 = "books15",
  CANDLESTICK = "candlestick",
}

// Raw Bitget WebSocket message interfaces
interface BitgetRawTickerData {
  instId: string;
  lastPr: string; // Current price (was 'last')
  open24h: string;
  high24h: string;
  low24h: string;
  change24h: string; // 24h price change amount
  bidPr?: string; // Best bid price
  askPr?: string; // Best ask price
  bidSz?: string; // Best bid size
  askSz?: string; // Best ask size
  baseVolume: string; // Base volume (was 'volume24h')
  quoteVolume: string; // Quote volume (was 'quoteVolume24h')
  usdtVolume?: string; // USDT volume
  ts: string;
  openUtc?: string; // UTC 0 open price
  changeUtc24h?: string; // UTC 24h change
  chgUtc?: string; // UTC change percentage
}

interface BitgetRawDepthData {
  instId: string;
  asks: [string, string][];
  bids: [string, string][];
  checksum: number;
  seq: number;
  ts: string;
}

interface BitgetRawTradeData {
  instId: string;
  tradeId: string;
  px: string;
  sz: string;
  side: string;
  ts: string;
}

interface BitgetRawCandlestickData {
  instId: string;
  data: [string, string, string, string, string, string, string, string][];
  channel: string;
  action: "snapshot" | "update";
  ts: string;
}

// Processed data interfaces
export interface BitgetTickerData {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
  timestamp: number;
}

export interface BitgetTradeData {
  id: string;
  symbol: string;
  price: number;
  quantity: number;
  isBuyerMaker: boolean;
  timestamp: number;
}

export interface BitgetCandlestickData {
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  usdtVolume: number;
  interval: string;
}

export interface BitgetOrderBookData {
  symbol: string;
  bids: [string, string][];
  asks: [string, string][];
  timestamp: number;
  checksum?: number;
  sequence?: number;
}

export interface BitgetMessage {
  action: "snapshot" | "update";
  arg: {
    instType: string;
    channel: string;
    instId: string;
  };
  data:
    | BitgetRawDepthData[]
    | BitgetRawTradeData[]
    | BitgetRawTickerData[]
    | BitgetRawCandlestickData[];
  ts: number;
  event?: string; // For subscription confirmations
}

export interface BitgetSubscriptionPayload {
  op: string;
  args: {
    instType: string;
    channel: string;
    instId: string;
  }[];
}

export class BitgetWebSocketService {
  private wsManager: WebSocketManager | null = null;
  private config: BitgetStreamConfig;
  private onMessage?: (data: BitgetMessage) => void;
  private onStateChange?: (state: WebSocketState) => void;
  private onError?: (error: string) => void;

  // Data handlers
  private onTickerData?: (data: BitgetTickerData) => void;
  private onOrderBookData?: (data: BitgetOrderBookData) => void;
  private onTradeData?: (data: BitgetTradeData) => void;
  private onCandlestickData?: (data: BitgetCandlestickData[]) => void;

  // Order book state management
  private orderBookSnapshot: {
    bids: [string, string][];
    asks: [string, string][];
  } | null = null;
  private lastOrderBookUpdate = 0;

  constructor(config: BitgetStreamConfig) {
    this.config = config;

    // Use real WebSocket service
    this.wsManager = new WebSocketManager(
      {
        url: this.buildWebSocketUrl(),
        maxReconnectAttempts: 10,
        reconnectInterval: 1000,
        maxReconnectInterval: 30000,
        reconnectDecay: 1.5,
        heartbeatInterval: 25000, // Match our heartbeat implementation (25 seconds)
        connectionTimeout: 15000, // Increased timeout for better reliability
      },
      {
        onMessage: this.handleWebSocketMessage.bind(this),
        onStateChange: this.handleStateChange.bind(this),
        onError: this.handleError.bind(this),
      }
    );
  }

  private buildWebSocketUrl(): string {
    // Official Bitget WebSocket URL for v2 API - Public channels
    const url = "wss://ws.bitget.com/v2/ws/public";

    return url;
  }

  private buildSubscriptionPayload(): BitgetSubscriptionPayload {
    const symbol = this.config.symbol;
    const timeFrame = this.config.timeFrame || "1m";
    const args: { instType: string; channel: string; instId: string }[] = [];

    // Helper to push unique channels - use mc (mix contract) for futures market
    // instId should be the base symbol without suffix (e.g., BTCUSDT not BTCUSDT_UMCBL)
    const instId = symbol.replace(/_UMCBL$|_DMCBL$|_CMCBL$/i, "");

    const push = (channel: string) => {
      args.push({ instType: "mc", channel, instId });
    };

    for (const stream of this.config.streams) {
      switch (stream) {
        case BitgetStreamType.TICKER:
          push("ticker");
          break;
        case BitgetStreamType.DEPTH:
          // Use books5 (top 5 levels) by default; could be made configurable
          push("books5");
          break;
        case BitgetStreamType.TRADE:
          push("trade");
          break;
        case BitgetStreamType.CANDLESTICK: {
          // Bitget candle channel format: candle{interval}
          // Convert our interval format to Bitget WebSocket format
          const intervalMap: { [key: string]: string } = {
            "1min": "1m",
            "5min": "5m",
            "15min": "15m",
            "30min": "30m",
            "1h": "1H",
            "4h": "4H",
            "1day": "1D",
            "1week": "1W",
            "1month": "1M",
          };
          const wsInterval = intervalMap[timeFrame] || timeFrame;
          push(`candle${wsInterval}`);
          break;
        }
        case BitgetStreamType.BOOKS5:
          push("books5");
          break;
        case BitgetStreamType.BOOKS15:
          push("books15");
          break;
        default:
          break;
      }
    }

    return {
      op: "subscribe",
      args,
    };
  }

  private handleWebSocketMessage(message: WebSocketMessage): void {
    try {
      const data = message.data as unknown; // Use unknown initially to handle different message types

      // Handle error messages (type check first)
      if (typeof data === "object" && data !== null && "event" in data) {
        const eventData = data as {
          event: string;
          code?: string;
          msg?: string;
          message?: string;
          arg?: unknown;
        };

        if (eventData.event === "error" || eventData.code) {
          const errorMsg =
            eventData.msg || eventData.message || "Unknown error";

          if (this.onError) {
            this.onError(`Subscription error: ${errorMsg}`);
          }
          return;
        }

        // Handle subscription confirmation
        if (eventData.event === "subscribe") {
          return;
        }
      }

      // Handle data messages (cast to proper type now)
      const typedData = data as BitgetMessage;
      if (
        typedData &&
        typeof typedData === "object" &&
        "arg" in typedData &&
        "data" in typedData
      ) {
        this.handleDataMessage(typedData);
      }

      // Notify general message handler
      if (this.onMessage) {
        this.onMessage(typedData);
      }
    } catch (error) {
      if (this.onError) {
        this.onError(`Message processing error: ${error}`);
      }
    }
  }

  private handleStateChange(state: WebSocketState): void {
    if (state === WebSocketState.CONNECTED) {
      // Subscribe to streams after connection
      this.subscribe();
    }

    if (this.onStateChange) {
      this.onStateChange(state);
    }
  }

  private handleError(error: Event | Error): void {
    let errorMessage: string;

    if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      // For Event objects, check if they have meaningful information
      if (error.type) {
        errorMessage = `WebSocket ${error.type} error`;
      } else {
        // Skip logging for empty error events to reduce noise
        return;
      }
    }

    // Don't treat heartbeat timeouts as critical errors
    if (errorMessage.includes("Heartbeat timeout")) {
      return; // Don't propagate heartbeat timeouts as critical errors
    }

    // Only propagate meaningful errors
    if (this.onError && errorMessage && errorMessage !== "WebSocket error") {
      this.onError(errorMessage);
    }
  }

  private handleDataMessage(message: BitgetMessage): void {
    const { arg, data, action } = message;

    switch (arg.channel) {
      case "books5":
      case "books15":
      case "books":
        this.handleOrderBookMessage(data as BitgetRawDepthData[], action);
        break;
      case "trade":
        this.handleTradeMessage(data as BitgetRawTradeData[]);
        break;
      case "ticker":
        this.handleTickerMessage(data as BitgetRawTickerData[]);
        break;
      default:
        // Check if it's a candlestick channel (starts with 'candle')
        if (arg.channel.startsWith("candle")) {
          // Bitget candlestick data can come in different formats:
          // Format 1: Direct array of arrays [[ts, open, high, low, close, vol, quotevol, usdtvol], ...]
          // Format 2: Wrapped in object with data property: { data: [[...]], ... }
          try {
            if (Array.isArray(data) && data.length > 0) {
              const firstItem = data[0];
              if (Array.isArray(firstItem) && firstItem.length >= 8) {
                // Format 1: Direct array of candle arrays
                this.handleCandlestickMessage(
                  data as unknown as [
                    string,
                    string,
                    string,
                    string,
                    string,
                    string,
                    string,
                    string,
                  ][],
                  arg.channel
                );
              } else if (
                firstItem &&
                typeof firstItem === "object" &&
                "data" in firstItem
              ) {
                // Format 2: Wrapped format
                const wrappedData = firstItem as BitgetRawCandlestickData;
                this.handleCandlestickMessage(wrappedData.data, arg.channel);
              }
            }
          } catch {
            // Silent fail for candlestick parsing errors
          }
        }
    }
  }

  private handleOrderBookMessage(
    data: BitgetRawDepthData[],
    action: string
  ): void {
    if (!data || data.length === 0) return;

    const rawOrderBook = data[0];
    if (!rawOrderBook) return; // Add null check

    // Bitget always sends snapshots for books5/books15
    if (action === "snapshot") {
      this.orderBookSnapshot = {
        bids: rawOrderBook.bids || [],
        asks: rawOrderBook.asks || [],
      };
    }

    const processedData: BitgetOrderBookData = {
      symbol: rawOrderBook.instId,
      bids: rawOrderBook.bids || [],
      asks: rawOrderBook.asks || [],
      timestamp: parseInt(rawOrderBook.ts),
      checksum: rawOrderBook.checksum,
      sequence: rawOrderBook.seq,
    };

    this.lastOrderBookUpdate = Date.now();

    if (this.onOrderBookData) {
      this.onOrderBookData(processedData);
    }
  }

  private handleTradeMessage(data: BitgetRawTradeData[]): void {
    if (!data || data.length === 0) return;

    data.forEach((trade) => {
      const processedTrade: BitgetTradeData = {
        id: trade.tradeId,
        symbol: trade.instId,
        price: parseFloat(trade.px),
        quantity: parseFloat(trade.sz),
        isBuyerMaker: trade.side === "sell", // In Bitget, 'sell' means market sell (taker sell)
        timestamp: parseInt(trade.ts),
      };

      if (this.onTradeData) {
        this.onTradeData(processedTrade);
      }
    });
  }

  private handleTickerMessage(data: BitgetRawTickerData[]): void {
    if (!data || data.length === 0) return;

    const ticker = data[0];
    if (!ticker) return; // Add null check

    // Add safety checks for undefined/null values
    const lastPrice = ticker.lastPr ? parseFloat(ticker.lastPr) : 0;
    const openPrice = ticker.open24h ? parseFloat(ticker.open24h) : 0;

    // Calculate the actual price change and percentage
    // Bitget's change24h appears to be the change amount, not percentage
    const actualPriceChange = lastPrice - openPrice;
    const changePercent =
      openPrice !== 0 ? (actualPriceChange / openPrice) * 100 : 0;

    const processedTicker: BitgetTickerData = {
      symbol: ticker.instId || "",
      price: lastPrice,
      priceChange: actualPriceChange,
      priceChangePercent: changePercent,
      open: openPrice,
      high: ticker.high24h ? parseFloat(ticker.high24h) : 0,
      low: ticker.low24h ? parseFloat(ticker.low24h) : 0,
      volume: ticker.baseVolume ? parseFloat(ticker.baseVolume) : 0,
      quoteVolume: ticker.quoteVolume ? parseFloat(ticker.quoteVolume) : 0,
      timestamp: ticker.ts ? parseInt(ticker.ts) : Date.now(),
    };

    // Validate processed data and log any issues
    const hasValidData =
      processedTicker.price > 0 &&
      !isNaN(processedTicker.price) &&
      !isNaN(processedTicker.open) &&
      !isNaN(processedTicker.high) &&
      !isNaN(processedTicker.low);

    if (!hasValidData) {
      return;
    }

    if (this.onTickerData) {
      this.onTickerData(processedTicker);
    }
  }

  private handleCandlestickMessage(
    data: [string, string, string, string, string, string, string, string][],
    channel: string
  ): void {
    if (!data || data.length === 0) return;

    // Extract interval from channel name (e.g., 'candle1m' -> '1m')
    const interval = channel.replace("candle", "");

    const processedCandles: BitgetCandlestickData[] = data.map((candle) => ({
      symbol: this.config.symbol,
      timestamp: parseInt(candle[0]),
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
      quoteVolume: parseFloat(candle[6]),
      usdtVolume: parseFloat(candle[7]),
      interval,
    }));

    if (this.onCandlestickData) {
      this.onCandlestickData(processedCandles);
    }
  }

  private async subscribe(): Promise<void> {
    if (!this.wsManager) {
      return;
    }

    // Build the subscription payload using the configured streams
    const payload = this.buildSubscriptionPayload();

    try {
      await this.wsManager.send(payload);
    } catch (error) {
      console.error("[BitgetWebSocketService] Subscription error:", error);
      // Subscription error handled by error callback
    }
  }

  // Public API
  public async connect(): Promise<void> {
    // Test basic network connectivity to Bitget (optional diagnostic)
    if (this.config.enableLogging && typeof fetch !== "undefined") {
      try {
        await fetch("https://api.bitget.com/api/v2/public/time", {
          method: "GET",
          mode: "cors",
        });
      } catch {
        // Connectivity test failed - continue anyway
      }
    }

    if (this.wsManager) {
      await this.wsManager.connect();
      // Subscribe to channels after connection
      setTimeout(() => {
        this.subscribe();
      }, 1000);
    } else {
      throw new Error("No WebSocket manager available");
    }
  }

  public async disconnect(): Promise<void> {
    if (this.wsManager) {
      await this.wsManager.disconnect();
    }
  }

  public async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  public getState(): WebSocketState {
    return this.wsManager?.getState() ?? WebSocketState.DISCONNECTED;
  }

  public getLatency(): number {
    return this.wsManager?.getLatency() ?? 0;
  }

  public getConnectionId(): string {
    return this.wsManager?.getConnectionId() ?? "";
  }

  public getCurrentSymbol(): string {
    return this.config.symbol;
  }

  public async updateSymbol(symbol: string): Promise<void> {
    this.config.symbol = symbol;

    // Clear existing order book data
    this.orderBookSnapshot = null;
    this.lastOrderBookUpdate = 0;

    // Reconnect with new symbol
    if (this.getState() === WebSocketState.CONNECTED) {
      await this.disconnect();
      await this.connect();
    }
  }

  // Event handlers
  public setOnMessage(handler: (data: BitgetMessage) => void): void {
    this.onMessage = handler;
  }

  public setOnStateChange(handler: (state: WebSocketState) => void): void {
    this.onStateChange = handler;
  }

  public setOnError(handler: (error: string) => void): void {
    this.onError = handler;
  }

  public setOnTickerData(handler: (data: BitgetTickerData) => void): void {
    this.onTickerData = handler;
  }

  public setOnOrderBookData(
    handler: (data: BitgetOrderBookData) => void
  ): void {
    this.onOrderBookData = handler;
  }

  public setOnTradeData(handler: (data: BitgetTradeData) => void): void {
    this.onTradeData = handler;
  }

  public setOnCandlestickData(
    handler: (data: BitgetCandlestickData[]) => void
  ): void {
    this.onCandlestickData = handler;
  }

  // Utility methods
  public getCurrentOrderBook(): {
    bids: [string, string][];
    asks: [string, string][];
  } | null {
    return this.orderBookSnapshot;
  }

  public getLastOrderBookUpdate(): number {
    return this.lastOrderBookUpdate;
  }

  public isOrderBookStale(maxAgeMs: number = 10000): boolean {
    if (!this.lastOrderBookUpdate) return true;
    return Date.now() - this.lastOrderBookUpdate > maxAgeMs;
  }

  // Stats
  public getStats() {
    return {
      connectionState: this.getState(),
      latency: this.getLatency(),
      connectionId: this.getConnectionId(),
      lastOrderBookUpdate: this.lastOrderBookUpdate,
      isOrderBookStale: this.isOrderBookStale(),
      orderBookDepth: this.orderBookSnapshot
        ? {
            bids: this.orderBookSnapshot.bids.length,
            asks: this.orderBookSnapshot.asks.length,
          }
        : null,
    };
  }
}

export default BitgetWebSocketService;
