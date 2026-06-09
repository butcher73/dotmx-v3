import {
  DatafeedConfiguration,
  LibrarySymbolInfo,
  ResolutionString,
  HistoryCallback,
  PeriodParams,
  SearchSymbolsCallback,
  ResolveCallback,
  SubscribeBarsCallback,
  Timezone,
  Bar,
  SearchSymbolResultItem,
} from "@/libs/charting_library";

import {
  getMarketDataWs,
  type MarketDataTickerUpdate,
  type MarketDataKlineUpdate,
} from "./websocket/MarketDataWebSocketService";
import { getPerpConfig } from "@/config/perps";

// ── Constants ───────────────────────────────────────────────────────────────

const MARKETDATA_API_URL =
  process.env.NEXT_PUBLIC_MARKETDATA_URL || "http://localhost:8080/marketdata";

// Convert TradingView resolution to our server granularity format
const RESOLUTION_TO_GRANULARITY: Record<string, string> = {
  "1": "1min",
  "5": "5min",
  "15": "15min",
  "30": "30min",
  "60": "1h",
  "240": "4h",
  "1D": "1day",
  "1W": "1week",
  "1M": "1month",
};

// Map to kline WS interval format
const RESOLUTION_TO_WS_INTERVAL: Record<string, string> = {
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1H",
  "240": "4H",
  "1D": "1D",
  "1W": "1W",
  "1M": "1M",
};

// Convert internal symbol to Bitget-format for our server
const convertToBitgetSymbol = (symbol: string): string => {
  const config = getPerpConfig(symbol);
  return config.bitgetSymbol || symbol;
};

// ── UI Events ───────────────────────────────────────────────────────────────

const dispatchDataUpdate = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("ws-data-update", { detail: { timestamp: Date.now() } })
    );
  }
};

const dispatchConnectionStatus = (connected: boolean) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("ws-connection-status", { detail: { connected } })
    );
  }
};

// ── TradingViewDatafeed ─────────────────────────────────────────────────────

interface SubscriptionInfo {
  subscriberUID: string;
  resolution: ResolutionString;
  onRealtimeCallback: SubscribeBarsCallback;
  lastBar: Bar | null;
  symbol: string;
  bitgetSymbol: string;
}

class TradingViewDatafeed {
  private subscribedSymbols = new Map<string, SubscriptionInfo>();
  private lastBarsCache = new Map<string, Bar>();
  private wsConnected = false;

  // requestAnimationFrame – based smooth update queue
  private pendingTickerUpdates = new Map<string, MarketDataTickerUpdate>();
  private rafId: number | null = null;

  // Unsubscribe functions from MarketDataWebSocketService
  private unsubFns = new Map<string, Array<() => void>>();

  private config: DatafeedConfiguration = {
    supported_resolutions: [
      "1",
      "5",
      "15",
      "30",
      "60",
      "240",
      "1D",
      "1W",
      "1M",
    ] as ResolutionString[],
    exchanges: [{ value: "DotMX", name: "DotMX", desc: "DotMX Exchange" }],
    symbols_types: [{ name: "crypto", value: "crypto" }],
    supports_marks: false,
    supports_timescale_marks: false,
    supports_time: true,
  };

  // ── onReady ──

  onReady(callback: (configuration: DatafeedConfiguration) => void): void {
    setTimeout(() => callback(this.config), 0);
  }

  // ── searchSymbols ──

  searchSymbols(
    userInput: string,
    _exchange: string,
    _symbolType: string,
    onResult: SearchSymbolsCallback
  ): void {
    const symbols: SearchSymbolResultItem[] = [
      {
        symbol: "BTCUSDT",
        description: "BTC-USDT Perpetual",
        exchange: "DotMX",
        ticker: "BTCUSDT",
        type: "crypto",
      },
      {
        symbol: "ETHUSDT",
        description: "ETH-USDT Perpetual",
        exchange: "DotMX",
        ticker: "ETHUSDT",
        type: "crypto",
      },
      {
        symbol: "BNBUSDT",
        description: "BNB-USDT Perpetual",
        exchange: "DotMX",
        ticker: "BNBUSDT",
        type: "crypto",
      },
      {
        symbol: "SOLUSDT",
        description: "SOL-USDT Perpetual",
        exchange: "DotMX",
        ticker: "SOLUSDT",
        type: "crypto",
      },
      {
        symbol: "XRPUSDT",
        description: "XRP-USDT Perpetual",
        exchange: "DotMX",
        ticker: "XRPUSDT",
        type: "crypto",
      },
    ];

    const filtered = symbols.filter(
      (s) =>
        s.symbol.toLowerCase().includes(userInput.toLowerCase()) ||
        s.description.toLowerCase().includes(userInput.toLowerCase())
    );
    setTimeout(() => onResult(filtered), 0);
  }

  // ── getPriceScale ──

  private getPriceScale(symbol: string): number {
    if (symbol.includes("BTC") || symbol.includes("ETH")) return 100;
    const smallValueTokens = ["DOGE", "SHIB", "PEPE", "XRP", "ADA", "TRX"];
    if (smallValueTokens.some((t) => symbol.includes(t))) return 1000000;
    return 10000;
  }

  /**
   * Format flat symbol (e.g. "BTCUSDT") into "BTC-USDT" display name
   */
  private formatPairName(symbol: string): string {
    const quoteAssets = ["USDT", "USDC", "USD", "BTC", "ETH"];
    for (const q of quoteAssets) {
      if (symbol.endsWith(q) && symbol.length > q.length) {
        return `${symbol.slice(0, -q.length)}-${q}`;
      }
    }
    return symbol;
  }

  // ── resolveSymbol ──

  resolveSymbol(symbolName: string, onResolve: ResolveCallback): void {
    const symbol = symbolName.includes(":")
      ? symbolName.split(":")[1]
      : symbolName;

    if (!symbol) throw new Error(`Invalid symbol name: ${symbolName}`);

    const pairName = this.formatPairName(symbol);

    const symbolInfo: LibrarySymbolInfo = {
      ticker: symbol,
      name: pairName,
      description: `${pairName} Perpetual`,
      type: "crypto",
      session: "24x7",
      timezone: "Etc/UTC" as Timezone,
      exchange: "DotMX",
      listed_exchange: "DotMX",
      minmov: 1,
      pricescale: this.getPriceScale(symbol),
      has_intraday: true,
      has_weekly_and_monthly: true,
      supported_resolutions: this.config.supported_resolutions!,
      volume_precision: 2,
      data_status: "streaming",
      format: "price",
    };

    setTimeout(() => onResolve(symbolInfo), 0);
  }

  // ── getBars – fetch historical klines from our marketdata server ──

  getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: PeriodParams,
    onResult: HistoryCallback
  ): void {
    const internalSymbol = symbolInfo.ticker || symbolInfo.name || "BTCUSDT";
    const bitgetSymbol = convertToBitgetSymbol(internalSymbol);
    const granularity = RESOLUTION_TO_GRANULARITY[resolution] || "1min";

    const fetchHistorical = async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const from = periodParams.from;
        const to = periodParams.to || now;
        const limit = Math.max(
          200,
          Math.min(1000, periodParams.countBack || 300)
        );

        const apiUrl = `${MARKETDATA_API_URL}/api/v1/klines?symbol=${bitgetSymbol}&granularity=${granularity}&limit=${limit}`;

        const resp = await fetch(apiUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!resp.ok) {
          throw new Error(`API ${resp.status}: ${resp.statusText}`);
        }

        const json = await resp.json();

        if (
          !json.success ||
          !Array.isArray(json.data) ||
          json.data.length === 0
        ) {
          onResult([], { noData: true });
          return;
        }

        const bars: Bar[] = json.data
          .map(
            (item: {
              timestamp: number;
              open: number;
              high: number;
              low: number;
              close: number;
              volume: number;
            }) => ({
              time: item.timestamp,
              open: item.open,
              high: item.high,
              low: item.low,
              close: item.close,
              volume: item.volume,
            })
          )
          .filter((bar: Bar) => {
            const barTs = Math.floor(bar.time / 1000);
            return barTs >= from && barTs <= to;
          })
          .sort((a: Bar, b: Bar) => a.time - b.time);

        if (periodParams.firstDataRequest && bars.length > 0) {
          const lastBar = bars[bars.length - 1];
          if (lastBar) this.lastBarsCache.set(internalSymbol, lastBar);
        }

        onResult(bars, { noData: bars.length === 0 });
      } catch (err) {
        console.error("[TradingViewDatafeed] Historical fetch failed:", err);
        onResult([], { noData: true });
      }
    };

    fetchHistorical();
  }

  // ── subscribeBars – real-time via MarketDataWebSocketService ──

  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onTick: SubscribeBarsCallback,
    subscriberUID: string
  ): void {
    const internalSymbol = symbolInfo.ticker || symbolInfo.name || "BTCUSDT";
    const bitgetSymbol = convertToBitgetSymbol(internalSymbol);
    const wsInterval = RESOLUTION_TO_WS_INTERVAL[resolution] || "1m";
    const lastBar = this.lastBarsCache.get(internalSymbol) || null;

    this.subscribedSymbols.set(subscriberUID, {
      subscriberUID,
      resolution,
      onRealtimeCallback: onTick,
      lastBar,
      symbol: internalSymbol,
      bitgetSymbol,
    });

    const ws = getMarketDataWs({ enableLogging: false });
    const unsubs: Array<() => void> = [];

    // Subscribe to kline updates
    const unsubKline = ws.subscribeKline(
      bitgetSymbol,
      wsInterval,
      (kline: MarketDataKlineUpdate) => {
        this.handleKlineUpdate(
          subscriberUID,
          kline,
          resolution,
          internalSymbol,
          onTick
        );
      }
    );
    unsubs.push(unsubKline);

    // Subscribe to ticker for sub-second smooth price updates
    const unsubTicker = ws.subscribeTicker(
      bitgetSymbol,
      (ticker: MarketDataTickerUpdate) => {
        // Queue ticker updates for rAF processing
        this.pendingTickerUpdates.set(subscriberUID, ticker);
        this.startAnimationLoop();
      }
    );
    unsubs.push(unsubTicker);

    // Monitor connection state
    const unsubConn = ws.onConnection((connected: boolean) => {
      this.wsConnected = connected;
      dispatchConnectionStatus(connected);
    });
    unsubs.push(unsubConn);

    this.unsubFns.set(subscriberUID, unsubs);

    // Connect if not already connected
    if (!ws.isConnected()) {
      ws.connect().catch((err) => {
        console.error("[TradingViewDatafeed] WS connection error:", err);
        dispatchConnectionStatus(false);
      });
    }
  }

  // ── unsubscribeBars ──

  unsubscribeBars(subscriberUID: string): void {
    this.subscribedSymbols.delete(subscriberUID);
    this.pendingTickerUpdates.delete(subscriberUID);

    const unsubs = this.unsubFns.get(subscriberUID);
    if (unsubs) {
      unsubs.forEach((fn) => fn());
      this.unsubFns.delete(subscriberUID);
    }

    // Stop animation loop if no more subscribers
    if (this.subscribedSymbols.size === 0) {
      this.stopAnimationLoop();
    }
  }

  // ── Kline update handler ──

  private handleKlineUpdate(
    subscriberUID: string,
    kline: MarketDataKlineUpdate,
    resolution: ResolutionString,
    internalSymbol: string,
    onTick: SubscribeBarsCallback
  ): void {
    const sub = this.subscribedSymbols.get(subscriberUID);
    if (!sub) return;

    const newBar: Bar = {
      time: kline.timestamp,
      open: kline.open,
      high: kline.high,
      low: kline.low,
      close: kline.close,
      volume: kline.volume,
    };

    // Validate
    if (!newBar.time || isNaN(newBar.open) || isNaN(newBar.close)) return;

    const lastBar = sub.lastBar;
    const nextBarTime = lastBar
      ? this.getNextBarTime(lastBar.time, resolution)
      : newBar.time;

    let bar: Bar;
    if (newBar.time >= nextBarTime) {
      bar = { ...newBar };
    } else {
      bar = { ...newBar, time: lastBar?.time || newBar.time };
    }

    sub.lastBar = bar;
    this.lastBarsCache.set(internalSymbol, { ...bar });
    dispatchDataUpdate();
    onTick({ ...bar });
  }

  // ── requestAnimationFrame loop for smooth ticker price updates ──

  private startAnimationLoop(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => this.processPendingUpdates());
  }

  private stopAnimationLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private processPendingUpdates(): void {
    this.rafId = null;

    if (this.pendingTickerUpdates.size === 0) return;

    // Process all queued ticker updates
    for (const [subscriberUID, ticker] of this.pendingTickerUpdates) {
      const sub = this.subscribedSymbols.get(subscriberUID);
      if (!sub || !sub.lastBar) continue;

      const price = parseFloat(ticker.lastPr);
      if (!price || isNaN(price)) continue;

      const currentBar = sub.lastBar;
      const currentTime = Date.now();
      const nextBarTime = this.getNextBarTime(currentBar.time, sub.resolution);

      if (currentTime < nextBarTime) {
        // Update existing bar with new ticker price
        const updatedBar: Bar = {
          time: currentBar.time,
          open: currentBar.open,
          high: Math.max(currentBar.high, price),
          low: Math.min(currentBar.low, price),
          close: price,
          volume: currentBar.volume ?? 0,
        };

        sub.lastBar = updatedBar;
        this.lastBarsCache.set(sub.symbol, { ...updatedBar });
        sub.onRealtimeCallback({ ...updatedBar });
      } else {
        // New bar period
        const newBarTime = this.getNextBarTime(currentBar.time, sub.resolution);
        const newBar: Bar = {
          time: newBarTime,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0,
        };

        sub.lastBar = newBar;
        this.lastBarsCache.set(sub.symbol, { ...newBar });
        sub.onRealtimeCallback({ ...newBar });
      }
    }

    this.pendingTickerUpdates.clear();
    dispatchDataUpdate();

    // Keep looping if there are active subscribers
    if (this.subscribedSymbols.size > 0) {
      this.rafId = requestAnimationFrame(() => this.processPendingUpdates());
    }
  }

  // ── getNextBarTime ──

  private getNextBarTime(barTime: number, resolution: string): number {
    const date = new Date(barTime);
    const interval = parseInt(resolution);

    if (resolution === "1D") {
      date.setUTCDate(date.getUTCDate() + 1);
      date.setUTCHours(0, 0, 0, 0);
    } else if (resolution === "1W") {
      date.setUTCDate(date.getUTCDate() + 7);
      date.setUTCHours(0, 0, 0, 0);
    } else if (resolution === "1M") {
      date.setUTCMonth(date.getUTCMonth() + 1);
      date.setUTCDate(1);
      date.setUTCHours(0, 0, 0, 0);
    } else if (!isNaN(interval)) {
      date.setUTCMinutes(date.getUTCMinutes() + interval);
    }

    return date.getTime();
  }

  // ── getServerTime ──

  getServerTime?(callback: (time: number) => void): void {
    callback(Math.floor(Date.now() / 1000));
  }
}

// Export singleton instance
export const tradingViewDatafeed = new TradingViewDatafeed();
