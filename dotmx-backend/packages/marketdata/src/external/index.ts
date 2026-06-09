/**
 * External Price Feed Service
 *
 * Fetches market data from external exchanges (Binance, Bitget)
 * to provide mark price, index price, and ticker data when
 * internal order book has low liquidity.
 *
 * Use Cases:
 * - Mark price for liquidation calculations
 * - Index price for funding rate calculation
 * - Ticker data to make UI look professional
 * - Reference prices when orderbook is thin
 */

import { EventEmitter } from "events";

// =============================================================================
// TYPES
// =============================================================================

export interface ExternalTicker {
  symbol: string;
  exchange: string;
  lastPrice: number;
  markPrice: number;
  indexPrice: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  volumeQuote24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  fundingRate: number;
  nextFundingTime: number;
  timestamp: number;
}

export interface ExternalOrderbook {
  symbol: string;
  exchange: string;
  bids: [number, number][]; // [price, quantity]
  asks: [number, number][];
  timestamp: number;
}

export interface ExternalKline {
  symbol: string;
  exchange: string;
  interval: string;
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  trades: number;
}

export interface ExternalTrade {
  symbol: string;
  exchange: string;
  tradeId: string;
  price: number;
  quantity: number;
  side: "buy" | "sell";
  timestamp: number;
}

export type PriceFeedHandler = (ticker: ExternalTicker) => void;
export type OrderbookHandler = (orderbook: ExternalOrderbook) => void;
export type TradeHandler = (trade: ExternalTrade) => void;
export type KlineHandler = (kline: ExternalKline) => void;

export interface ExternalPriceFeed {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Subscribe to streams
  subscribeTicker(symbol: string): void;
  subscribeOrderbook(symbol: string): void;
  subscribeTrades(symbol: string): void;
  subscribeKlines(symbol: string, interval: string): void;

  unsubscribe(symbol: string): void;

  // Event handlers
  onTicker(handler: PriceFeedHandler): void;
  onOrderbook(handler: OrderbookHandler): void;
  onTrade(handler: TradeHandler): void;
  onKline(handler: KlineHandler): void;

  // REST fallback
  fetchTicker(symbol: string): Promise<ExternalTicker>;
  fetchOrderbook(symbol: string, limit?: number): Promise<ExternalOrderbook>;
  fetchKlines(symbol: string, interval: string, limit?: number): Promise<ExternalKline[]>;
}

export interface PriceFeedConfig {
  pollIntervalMs: number;
  wsReconnectDelayMs: number;
  maxReconnectAttempts: number;
}

export const defaultPriceFeedConfig: PriceFeedConfig = {
  pollIntervalMs: 1000,
  wsReconnectDelayMs: 5000,
  maxReconnectAttempts: 10,
};

// =============================================================================
// SYMBOL MAPPING
// =============================================================================

/**
 * Map internal symbols to exchange-specific symbols
 */
export interface SymbolMapping {
  internal: string; // e.g., "BTC-USDT"
  binance: string; // e.g., "BTCUSDT"
  bitget: string; // e.g., "BTCUSDT"
}

export const DEFAULT_SYMBOL_MAPPINGS: SymbolMapping[] = [
  { internal: "BTC-USDT", binance: "BTCUSDT", bitget: "BTCUSDT" },
  { internal: "ETH-USDT", binance: "ETHUSDT", bitget: "ETHUSDT" },
  { internal: "BNB-USDT", binance: "BNBUSDT", bitget: "BNBUSDT" },
  { internal: "SOL-USDT", binance: "SOLUSDT", bitget: "SOLUSDT" },
  { internal: "ARB-USDT", binance: "ARBUSDT", bitget: "ARBUSDT" },
  { internal: "DOGE-USDT", binance: "DOGEUSDT", bitget: "DOGEUSDT" },
  { internal: "XRP-USDT", binance: "XRPUSDT", bitget: "XRPUSDT" },
  { internal: "AVAX-USDT", binance: "AVAXUSDT", bitget: "AVAXUSDT" },
  { internal: "LINK-USDT", binance: "LINKUSDT", bitget: "LINKUSDT" },
  { internal: "MATIC-USDT", binance: "MATICUSDT", bitget: "MATICUSDT" },
  { internal: "OP-USDT", binance: "OPUSDT", bitget: "OPUSDT" },
];

export function getSymbolMapping(internalSymbol: string): SymbolMapping | undefined {
  // Normalize slash (DB format) and flat (exchange format) to dash (internal format) for lookup
  const normalized = internalSymbol.replace(/\//g, "-");
  const found = DEFAULT_SYMBOL_MAPPINGS.find((m) => m.internal === internalSymbol || m.internal === normalized);
  if (found) return found;
  // Also try matching by exchange symbol (e.g., "BTCUSDT")
  return DEFAULT_SYMBOL_MAPPINGS.find((m) => m.bitget === internalSymbol || m.binance === internalSymbol);
}

export function toBinanceSymbol(internalSymbol: string): string {
  return getSymbolMapping(internalSymbol)?.binance ?? internalSymbol.replace(/[-\/]/g, "");
}

export function toBitgetSymbol(internalSymbol: string): string {
  return getSymbolMapping(internalSymbol)?.bitget ?? internalSymbol.replace(/[-\/]/g, "");
}

export function fromBinanceSymbol(binanceSymbol: string): string {
  const mapping = DEFAULT_SYMBOL_MAPPINGS.find((m) => m.binance === binanceSymbol);
  if (mapping) return mapping.internal;
  // Derive internal format for unmapped symbols: "BNBUSDT" → "BNB-USDT"
  const KNOWN_QUOTES = ["USDT", "USDC", "BTC", "ETH", "USD"];
  for (const q of KNOWN_QUOTES) {
    if (binanceSymbol.endsWith(q) && binanceSymbol.length > q.length) {
      return `${binanceSymbol.slice(0, -q.length)}-${q}`;
    }
  }
  return binanceSymbol;
}

export function fromBitgetSymbol(bitgetSymbol: string): string {
  const mapping = DEFAULT_SYMBOL_MAPPINGS.find((m) => m.bitget === bitgetSymbol);
  if (mapping) return mapping.internal;
  // Derive internal format for unmapped symbols: "BNBUSDT" → "BNB-USDT"
  const KNOWN_QUOTES = ["USDT", "USDC", "BTC", "ETH", "USD"];
  for (const q of KNOWN_QUOTES) {
    if (bitgetSymbol.endsWith(q) && bitgetSymbol.length > q.length) {
      return `${bitgetSymbol.slice(0, -q.length)}-${q}`;
    }
  }
  return bitgetSymbol;
}

// =============================================================================
// BINANCE FUTURES PRICE FEED
// =============================================================================

export interface BinanceFuturesConfig extends PriceFeedConfig {
  baseUrl: string;
  wsUrl: string;
}

export const defaultBinanceConfig: BinanceFuturesConfig = {
  ...defaultPriceFeedConfig,
  baseUrl: "https://fapi.binance.com",
  wsUrl: "wss://fstream.binance.com",
};

/**
 * Binance Futures price feed
 * Uses WebSocket for real-time data, REST for snapshots
 */
export function createBinanceFeed(
  config: Partial<BinanceFuturesConfig> = {}
): ExternalPriceFeed {
  const cfg = { ...defaultBinanceConfig, ...config };
  const emitter = new EventEmitter();
  let ws: WebSocket | null = null;
  let connected = false;
  let reconnectAttempts = 0;
  const subscriptions = new Set<string>();

  async function connect(): Promise<void> {
    if (connected) return;

    return new Promise((resolve, reject) => {
      try {
        const streams = Array.from(subscriptions).join("/");
        const url = streams
          ? `${cfg.wsUrl}/stream?streams=${streams}`
          : `${cfg.wsUrl}/ws`;

        ws = new WebSocket(url);

        ws.onopen = () => {
          console.log("🔗 Binance WebSocket connected");
          connected = true;
          reconnectAttempts = 0;
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data.toString());
            handleBinanceMessage(data);
          } catch (e) {
            console.error("Failed to parse Binance message:", e);
          }
        };

        ws.onerror = (error) => {
          console.error("Binance WebSocket error:", error);
        };

        ws.onclose = () => {
          console.log("🔌 Binance WebSocket disconnected");
          connected = false;
          scheduleReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= cfg.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached for Binance");
      return;
    }
    reconnectAttempts++;
    setTimeout(() => {
      console.log(`Reconnecting to Binance (attempt ${reconnectAttempts})...`);
      connect().catch(console.error);
    }, cfg.wsReconnectDelayMs);
  }

  function handleBinanceMessage(data: Record<string, unknown>) {
    const stream = data.stream as string | undefined;
    const payload = (data.data ?? data) as Record<string, unknown>;

    if (stream?.includes("@markPrice")) {
      // Mark price stream
      emitter.emit("ticker", parseBinanceMarkPrice(payload));
    } else if (stream?.includes("@ticker")) {
      // 24h ticker
      emitter.emit("ticker", parseBinanceTicker(payload));
    } else if (stream?.includes("@depth")) {
      // Orderbook depth
      emitter.emit("orderbook", parseBinanceOrderbook(payload));
    } else if (stream?.includes("@trade")) {
      // Trades
      emitter.emit("trade", parseBinanceTrade(payload));
    } else if (stream?.includes("@kline")) {
      // Klines
      emitter.emit("kline", parseBinanceKline(payload));
    }
  }

  function parseBinanceMarkPrice(data: Record<string, unknown>): ExternalTicker {
    const symbol = fromBinanceSymbol(data.s as string);
    return {
      symbol,
      exchange: "binance",
      lastPrice: parseFloat(data.p as string),
      markPrice: parseFloat(data.p as string),
      indexPrice: parseFloat(data.i as string ?? data.p as string),
      bid: 0,
      ask: 0,
      high24h: 0,
      low24h: 0,
      volume24h: 0,
      volumeQuote24h: 0,
      priceChange24h: 0,
      priceChangePercent24h: 0,
      fundingRate: parseFloat(data.r as string ?? "0"),
      nextFundingTime: parseInt(data.T as string ?? "0", 10),
      timestamp: parseInt(data.E as string, 10),
    };
  }

  function parseBinanceTicker(data: Record<string, unknown>): ExternalTicker {
    const symbol = fromBinanceSymbol(data.s as string);
    return {
      symbol,
      exchange: "binance",
      lastPrice: parseFloat(data.c as string),
      markPrice: parseFloat(data.c as string),
      indexPrice: parseFloat(data.c as string),
      bid: parseFloat(data.b as string ?? "0"),
      ask: parseFloat(data.a as string ?? "0"),
      high24h: parseFloat(data.h as string),
      low24h: parseFloat(data.l as string),
      volume24h: parseFloat(data.v as string),
      volumeQuote24h: parseFloat(data.q as string),
      priceChange24h: parseFloat(data.p as string),
      priceChangePercent24h: parseFloat(data.P as string),
      fundingRate: 0,
      nextFundingTime: 0,
      timestamp: parseInt(data.E as string, 10),
    };
  }

  function parseBinanceOrderbook(data: Record<string, unknown>): ExternalOrderbook {
    const symbol = fromBinanceSymbol(data.s as string);
    return {
      symbol,
      exchange: "binance",
      bids: ((data.b ?? data.bids) as string[][]).map((b) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: ((data.a ?? data.asks) as string[][]).map((a) => [parseFloat(a[0]), parseFloat(a[1])]),
      timestamp: parseInt((data.E ?? data.T ?? Date.now()) as string, 10),
    };
  }

  function parseBinanceTrade(data: Record<string, unknown>): ExternalTrade {
    const symbol = fromBinanceSymbol(data.s as string);
    return {
      symbol,
      exchange: "binance",
      tradeId: (data.t ?? data.a)?.toString() ?? "",
      price: parseFloat(data.p as string),
      quantity: parseFloat(data.q as string),
      side: data.m ? "sell" : "buy",
      timestamp: parseInt(data.T as string, 10),
    };
  }

  function parseBinanceKline(data: Record<string, unknown>): ExternalKline {
    const k = data.k as Record<string, unknown>;
    const symbol = fromBinanceSymbol(k.s as string);
    return {
      symbol,
      exchange: "binance",
      interval: k.i as string,
      openTime: parseInt(k.t as string, 10),
      open: parseFloat(k.o as string),
      high: parseFloat(k.h as string),
      low: parseFloat(k.l as string),
      close: parseFloat(k.c as string),
      volume: parseFloat(k.v as string),
      closeTime: parseInt(k.T as string, 10),
      trades: parseInt(k.n as string, 10),
    };
  }

  async function disconnect(): Promise<void> {
    if (ws) {
      ws.close();
      ws = null;
    }
    connected = false;
  }

  function sendSubscribe(streams: string[]) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        method: "SUBSCRIBE",
        params: streams,
        id: Date.now(),
      })
    );

    for (const s of streams) {
      subscriptions.add(s);
    }
  }

  return {
    name: "binance",

    connect,
    disconnect,
    isConnected: () => connected,

    subscribeTicker(symbol: string) {
      const binanceSymbol = toBinanceSymbol(symbol).toLowerCase();
      sendSubscribe([`${binanceSymbol}@ticker`, `${binanceSymbol}@markPrice`]);
    },

    subscribeOrderbook(symbol: string) {
      const binanceSymbol = toBinanceSymbol(symbol).toLowerCase();
      sendSubscribe([`${binanceSymbol}@depth20@100ms`]);
    },

    subscribeTrades(symbol: string) {
      const binanceSymbol = toBinanceSymbol(symbol).toLowerCase();
      sendSubscribe([`${binanceSymbol}@trade`]);
    },

    subscribeKlines(symbol: string, interval: string) {
      const binanceSymbol = toBinanceSymbol(symbol).toLowerCase();
      sendSubscribe([`${binanceSymbol}@kline_${interval}`]);
    },

    unsubscribe(symbol: string) {
      const binanceSymbol = toBinanceSymbol(symbol).toLowerCase();
      const streamsToRemove = Array.from(subscriptions).filter((s) =>
        s.startsWith(binanceSymbol)
      );

      if (ws && ws.readyState === WebSocket.OPEN && streamsToRemove.length > 0) {
        ws.send(
          JSON.stringify({
            method: "UNSUBSCRIBE",
            params: streamsToRemove,
            id: Date.now(),
          })
        );
      }

      for (const s of streamsToRemove) {
        subscriptions.delete(s);
      }
    },

    onTicker(handler: PriceFeedHandler) {
      emitter.on("ticker", handler);
    },
    onOrderbook(handler: OrderbookHandler) {
      emitter.on("orderbook", handler);
    },
    onTrade(handler: TradeHandler) {
      emitter.on("trade", handler);
    },
    onKline(handler: KlineHandler) {
      emitter.on("kline", handler);
    },

    // REST API fallbacks
    async fetchTicker(symbol: string): Promise<ExternalTicker> {
      const binanceSymbol = toBinanceSymbol(symbol);
      const [tickerRes, markPriceRes] = await Promise.all([
        fetch(`${cfg.baseUrl}/fapi/v1/ticker/24hr?symbol=${binanceSymbol}`),
        fetch(`${cfg.baseUrl}/fapi/v1/premiumIndex?symbol=${binanceSymbol}`),
      ]);

      const ticker = await tickerRes.json() as Record<string, string>;
      const markPrice = await markPriceRes.json() as Record<string, string>;

      return {
        symbol,
        exchange: "binance",
        lastPrice: parseFloat(ticker.lastPrice),
        markPrice: parseFloat(markPrice.markPrice),
        indexPrice: parseFloat(markPrice.indexPrice ?? markPrice.markPrice),
        bid: parseFloat(ticker.bidPrice ?? "0"),
        ask: parseFloat(ticker.askPrice ?? "0"),
        high24h: parseFloat(ticker.highPrice),
        low24h: parseFloat(ticker.lowPrice),
        volume24h: parseFloat(ticker.volume),
        volumeQuote24h: parseFloat(ticker.quoteVolume),
        priceChange24h: parseFloat(ticker.priceChange),
        priceChangePercent24h: parseFloat(ticker.priceChangePercent),
        fundingRate: parseFloat(markPrice.lastFundingRate ?? "0"),
        nextFundingTime: parseInt(markPrice.nextFundingTime ?? "0", 10),
        timestamp: Date.now(),
      };
    },

    async fetchOrderbook(symbol: string, limit = 20): Promise<ExternalOrderbook> {
      const binanceSymbol = toBinanceSymbol(symbol);
      const res = await fetch(
        `${cfg.baseUrl}/fapi/v1/depth?symbol=${binanceSymbol}&limit=${limit}`
      );
      const data = await res.json() as { bids: string[][]; asks: string[][] };

      return {
        symbol,
        exchange: "binance",
        bids: data.bids.map((b) => [parseFloat(b[0]), parseFloat(b[1])]),
        asks: data.asks.map((a) => [parseFloat(a[0]), parseFloat(a[1])]),
        timestamp: Date.now(),
      };
    },

    async fetchKlines(symbol: string, interval: string, limit = 100): Promise<ExternalKline[]> {
      const binanceSymbol = toBinanceSymbol(symbol);
      const res = await fetch(
        `${cfg.baseUrl}/fapi/v1/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`
      );
      const data = await res.json() as (string | number)[][];

      return data.map((k) => ({
        symbol,
        exchange: "binance",
        interval,
        openTime: k[0] as number,
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
        closeTime: k[6] as number,
        trades: k[8] as number,
      }));
    },
  };
}

// =============================================================================
// BITGET FUTURES PRICE FEED
// =============================================================================

export interface BitgetFuturesConfig extends PriceFeedConfig {
  baseUrl: string;
  wsUrl: string;
}

export const defaultBitgetConfig: BitgetFuturesConfig = {
  ...defaultPriceFeedConfig,
  baseUrl: "https://api.bitget.com",
  wsUrl: "wss://ws.bitget.com/v2/ws/public",
};

/**
 * Bitget Futures price feed
 */
export function createBitgetFeed(
  config: Partial<BitgetFuturesConfig> = {}
): ExternalPriceFeed {
  const cfg = { ...defaultBitgetConfig, ...config };
  const emitter = new EventEmitter();
  let ws: WebSocket | null = null;
  let connected = false;
  let reconnectAttempts = 0;
  const subscriptions = new Set<string>();
  let pingInterval: Timer | null = null;

  async function connect(): Promise<void> {
    if (connected) return;

    return new Promise((resolve, reject) => {
      try {
        ws = new WebSocket(cfg.wsUrl);

        ws.onopen = () => {
          console.log("🔗 Bitget WebSocket connected");
          connected = true;
          reconnectAttempts = 0;

          // Start ping
          pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send("ping");
            }
          }, 30000);

          // Resubscribe to previous subscriptions
          for (const sub of subscriptions) {
            const [channel, symbol] = sub.split(":");
            sendSubscribe(channel, symbol);
          }

          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const msg = event.data.toString();
            if (msg === "pong") return;

            const data = JSON.parse(msg);
            handleBitgetMessage(data);
          } catch (e) {
            console.error("Failed to parse Bitget message:", e);
          }
        };

        ws.onerror = (error) => {
          console.error("Bitget WebSocket error:", error);
        };

        ws.onclose = () => {
          console.log("🔌 Bitget WebSocket disconnected");
          connected = false;
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }
          scheduleReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= cfg.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached for Bitget");
      return;
    }
    reconnectAttempts++;
    setTimeout(() => {
      console.log(`Reconnecting to Bitget (attempt ${reconnectAttempts})...`);
      connect().catch(console.error);
    }, cfg.wsReconnectDelayMs);
  }

  function handleBitgetMessage(data: Record<string, unknown>) {
    const action = data.action as string | undefined;
    const arg = data.arg as Record<string, string> | undefined;
    const dataArr = data.data as Record<string, unknown>[] | undefined;

    if (!arg || !dataArr) return;

    const channel = arg.channel;
    const instId = arg.instId;

    for (const item of dataArr) {
      if (channel === "ticker") {
        emitter.emit("ticker", parseBitgetTicker(instId, item));
      } else if (channel === "books15") {
        emitter.emit("orderbook", parseBitgetOrderbook(instId, item));
      } else if (channel === "trade") {
        emitter.emit("trade", parseBitgetTrade(instId, item));
      } else if (channel?.startsWith("candle")) {
        emitter.emit("kline", parseBitgetKline(instId, channel, item));
      }
    }
  }

  function parseBitgetTicker(instId: string, data: Record<string, unknown>): ExternalTicker {
    const symbol = fromBitgetSymbol(instId);
    return {
      symbol,
      exchange: "bitget",
      lastPrice: parseFloat(data.lastPr as string ?? data.last as string ?? "0"),
      markPrice: parseFloat(data.markPrice as string ?? data.lastPr as string ?? "0"),
      indexPrice: parseFloat(data.indexPrice as string ?? data.lastPr as string ?? "0"),
      bid: parseFloat(data.bidPr as string ?? data.bid1 as string ?? "0"),
      ask: parseFloat(data.askPr as string ?? data.ask1 as string ?? "0"),
      high24h: parseFloat(data.high24h as string ?? "0"),
      low24h: parseFloat(data.low24h as string ?? "0"),
      volume24h: parseFloat(data.baseVolume as string ?? data.vol24h as string ?? "0"),
      volumeQuote24h: parseFloat(data.quoteVolume as string ?? "0"),
      priceChange24h: parseFloat(data.change24h as string ?? "0"),
      priceChangePercent24h: parseFloat(data.changeUtc24h as string ?? "0") * 100,
      fundingRate: parseFloat(data.fundingRate as string ?? "0"),
      nextFundingTime: parseInt(data.nextFundingTime as string ?? "0", 10),
      timestamp: parseInt(data.ts as string ?? Date.now().toString(), 10),
    };
  }

  function parseBitgetOrderbook(instId: string, data: Record<string, unknown>): ExternalOrderbook {
    const symbol = fromBitgetSymbol(instId);
    return {
      symbol,
      exchange: "bitget",
      bids: (data.bids as string[][]).map((b) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: (data.asks as string[][]).map((a) => [parseFloat(a[0]), parseFloat(a[1])]),
      timestamp: parseInt(data.ts as string ?? Date.now().toString(), 10),
    };
  }

  function parseBitgetTrade(instId: string, data: Record<string, unknown>): ExternalTrade {
    const symbol = fromBitgetSymbol(instId);
    return {
      symbol,
      exchange: "bitget",
      tradeId: (data.tradeId ?? "")?.toString(),
      price: parseFloat(data.price as string ?? data.px as string ?? "0"),
      quantity: parseFloat(data.size as string ?? data.sz as string ?? "0"),
      side: (data.side as string)?.toLowerCase() === "buy" ? "buy" : "sell",
      timestamp: parseInt(data.ts as string ?? Date.now().toString(), 10),
    };
  }

  function parseBitgetKline(instId: string, channel: string, data: Record<string, unknown>): ExternalKline {
    const symbol = fromBitgetSymbol(instId);
    const interval = channel.replace("candle", "");
    const arr = data as unknown as string[];
    return {
      symbol,
      exchange: "bitget",
      interval,
      openTime: parseInt(arr[0], 10),
      open: parseFloat(arr[1]),
      high: parseFloat(arr[2]),
      low: parseFloat(arr[3]),
      close: parseFloat(arr[4]),
      volume: parseFloat(arr[5] ?? "0"),
      closeTime: parseInt(arr[0], 10) + getIntervalMs(interval),
      trades: 0,
    };
  }

  function getIntervalMs(interval: string): number {
    const map: Record<string, number> = {
      "1m": 60000,
      "5m": 300000,
      "15m": 900000,
      "30m": 1800000,
      "1H": 3600000,
      "4H": 14400000,
      "1D": 86400000,
    };
    return map[interval] ?? 60000;
  }

  async function disconnect(): Promise<void> {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    connected = false;
  }

  function sendSubscribe(channel: string, instId: string) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        op: "subscribe",
        args: [
          {
            instType: "USDT-FUTURES",
            channel,
            instId,
          },
        ],
      })
    );

    subscriptions.add(`${channel}:${instId}`);
  }

  function sendUnsubscribe(channel: string, instId: string) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(
      JSON.stringify({
        op: "unsubscribe",
        args: [
          {
            instType: "USDT-FUTURES",
            channel,
            instId,
          },
        ],
      })
    );

    subscriptions.delete(`${channel}:${instId}`);
  }

  return {
    name: "bitget",

    connect,
    disconnect,
    isConnected: () => connected,

    subscribeTicker(symbol: string) {
      const bitgetSymbol = toBitgetSymbol(symbol);
      sendSubscribe("ticker", bitgetSymbol);
    },

    subscribeOrderbook(symbol: string) {
      const bitgetSymbol = toBitgetSymbol(symbol);
      sendSubscribe("books15", bitgetSymbol);
    },

    subscribeTrades(symbol: string) {
      const bitgetSymbol = toBitgetSymbol(symbol);
      sendSubscribe("trade", bitgetSymbol);
    },

    subscribeKlines(symbol: string, interval: string) {
      const bitgetSymbol = toBitgetSymbol(symbol);
      sendSubscribe(`candle${interval}`, bitgetSymbol);
    },

    unsubscribe(symbol: string) {
      const bitgetSymbol = toBitgetSymbol(symbol);
      for (const sub of subscriptions) {
        if (sub.endsWith(`:${bitgetSymbol}`)) {
          const [channel] = sub.split(":");
          sendUnsubscribe(channel, bitgetSymbol);
        }
      }
    },

    onTicker(handler: PriceFeedHandler) {
      emitter.on("ticker", handler);
    },
    onOrderbook(handler: OrderbookHandler) {
      emitter.on("orderbook", handler);
    },
    onTrade(handler: TradeHandler) {
      emitter.on("trade", handler);
    },
    onKline(handler: KlineHandler) {
      emitter.on("kline", handler);
    },

    // REST API fallbacks
    async fetchTicker(symbol: string): Promise<ExternalTicker> {
      const bitgetSymbol = toBitgetSymbol(symbol);
      const res = await fetch(
        `${cfg.baseUrl}/api/v2/mix/market/ticker?symbol=${bitgetSymbol}&productType=USDT-FUTURES`
      );
      const response = await res.json() as { code?: string; data: Record<string, string>[] | Record<string, string> };
      // Bitget V2 API returns data as an array — extract the first element
      const data = Array.isArray(response.data) ? response.data[0] : response.data;
      if (!data) {
        throw new Error(`No ticker data returned for ${bitgetSymbol}`);
      }

      return {
        symbol,
        exchange: "bitget",
        lastPrice: parseFloat(data.lastPr ?? "0"),
        markPrice: parseFloat(data.markPrice ?? data.lastPr ?? "0"),
        indexPrice: parseFloat(data.indexPrice ?? data.lastPr ?? "0"),
        bid: parseFloat(data.bidPr ?? "0"),
        ask: parseFloat(data.askPr ?? "0"),
        high24h: parseFloat(data.high24h ?? "0"),
        low24h: parseFloat(data.low24h ?? "0"),
        volume24h: parseFloat(data.baseVolume ?? "0"),
        volumeQuote24h: parseFloat(data.quoteVolume ?? "0"),
        priceChange24h: parseFloat(data.change24h ?? "0"),
        priceChangePercent24h: parseFloat(data.changeUtc24h ?? "0") * 100,
        fundingRate: parseFloat(data.fundingRate ?? "0"),
        nextFundingTime: parseInt(data.nextFundingTime ?? "0", 10),
        timestamp: Date.now(),
      };
    },

    async fetchOrderbook(symbol: string, limit = 20): Promise<ExternalOrderbook> {
      const bitgetSymbol = toBitgetSymbol(symbol);
      const res = await fetch(
        `${cfg.baseUrl}/api/v2/mix/market/merge-depth?symbol=${bitgetSymbol}&productType=USDT-FUTURES&limit=${limit}`
      );
      const response = await res.json() as { data: { bids: string[][]; asks: string[][]; ts: string } };
      const data = response.data;

      return {
        symbol,
        exchange: "bitget",
        bids: data.bids.map((b) => [parseFloat(b[0]), parseFloat(b[1])]),
        asks: data.asks.map((a) => [parseFloat(a[0]), parseFloat(a[1])]),
        timestamp: parseInt(data.ts, 10),
      };
    },

    async fetchKlines(symbol: string, interval: string, limit = 100): Promise<ExternalKline[]> {
      const bitgetSymbol = toBitgetSymbol(symbol);
      const res = await fetch(
        `${cfg.baseUrl}/api/v2/mix/market/candles?symbol=${bitgetSymbol}&productType=USDT-FUTURES&granularity=${interval}&limit=${limit}`
      );
      const response = await res.json() as { data: string[][] };

      return response.data.map((k) => ({
        symbol,
        exchange: "bitget",
        interval,
        openTime: parseInt(k[0], 10),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5] ?? "0"),
        closeTime: parseInt(k[0], 10) + getIntervalMs(interval),
        trades: 0,
      }));
    },
  };
}

// =============================================================================
// AGGREGATED PRICE FEED MANAGER
// =============================================================================

export interface AggregatedPriceData {
  symbol: string;
  markPrice: number;
  indexPrice: number;
  lastPrice: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  sources: string[];
  timestamp: number;
}

export interface PriceFeedManager {
  addFeed(feed: ExternalPriceFeed): void;
  removeFeed(name: string): void;
  start(symbols: string[]): Promise<void>;
  stop(): Promise<void>;

  getMarkPrice(symbol: string): number;
  getIndexPrice(symbol: string): number;
  getTicker(symbol: string): ExternalTicker | null;
  getAggregatedPrice(symbol: string): AggregatedPriceData | null;

  onPriceUpdate(handler: (data: AggregatedPriceData) => void): void;
}

export function createPriceFeedManager(): PriceFeedManager {
  const feeds = new Map<string, ExternalPriceFeed>();
  const tickers = new Map<string, Map<string, ExternalTicker>>(); // symbol -> exchange -> ticker
  const aggregated = new Map<string, AggregatedPriceData>();
  const handlers = new Set<(data: AggregatedPriceData) => void>();

  function updateAggregated(symbol: string) {
    const symbolTickers = tickers.get(symbol);
    if (!symbolTickers || symbolTickers.size === 0) return;

    const tickerList = Array.from(symbolTickers.values());

    // Calculate median mark price (more robust than average)
    const markPrices = tickerList.map((t) => t.markPrice).filter((p) => p > 0).sort((a, b) => a - b);
    const indexPrices = tickerList.map((t) => t.indexPrice).filter((p) => p > 0).sort((a, b) => a - b);
    const lastPrices = tickerList.map((t) => t.lastPrice).filter((p) => p > 0).sort((a, b) => a - b);

    const median = (arr: number[]) => {
      if (arr.length === 0) return 0;
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
    };

    const bestBid = Math.max(...tickerList.map((t) => t.bid).filter((p) => p > 0), 0);
    const bestAsk = Math.min(...tickerList.map((t) => t.ask).filter((p) => p > 0), Infinity);

    const data: AggregatedPriceData = {
      symbol,
      markPrice: median(markPrices),
      indexPrice: median(indexPrices),
      lastPrice: median(lastPrices),
      bestBid,
      bestAsk: bestAsk === Infinity ? 0 : bestAsk,
      spread: bestAsk !== Infinity && bestBid > 0 ? (bestAsk - bestBid) / bestBid : 0,
      sources: Array.from(symbolTickers.keys()),
      timestamp: Date.now(),
    };

    aggregated.set(symbol, data);

    // Notify handlers
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (e) {
        console.error("Price update handler error:", e);
      }
    }
  }

  return {
    addFeed(feed: ExternalPriceFeed) {
      feeds.set(feed.name, feed);

      feed.onTicker((ticker) => {
        let symbolTickers = tickers.get(ticker.symbol);
        if (!symbolTickers) {
          symbolTickers = new Map();
          tickers.set(ticker.symbol, symbolTickers);
        }
        symbolTickers.set(ticker.exchange, ticker);
        updateAggregated(ticker.symbol);
      });
    },

    removeFeed(name: string) {
      const feed = feeds.get(name);
      if (feed) {
        feed.disconnect();
        feeds.delete(name);
      }
    },

    async start(symbols: string[]) {
      for (const feed of feeds.values()) {
        await feed.connect();
        for (const symbol of symbols) {
          feed.subscribeTicker(symbol);
        }
      }
    },

    async stop() {
      for (const feed of feeds.values()) {
        await feed.disconnect();
      }
    },

    getMarkPrice(symbol: string): number {
      return aggregated.get(symbol)?.markPrice ?? 0;
    },

    getIndexPrice(symbol: string): number {
      return aggregated.get(symbol)?.indexPrice ?? 0;
    },

    getTicker(symbol: string): ExternalTicker | null {
      const symbolTickers = tickers.get(symbol);
      if (!symbolTickers || symbolTickers.size === 0) return null;
      // Return first available
      return symbolTickers.values().next().value ?? null;
    },

    getAggregatedPrice(symbol: string): AggregatedPriceData | null {
      return aggregated.get(symbol) ?? null;
    },

    onPriceUpdate(handler: (data: AggregatedPriceData) => void) {
      handlers.add(handler);
    },
  };
}
