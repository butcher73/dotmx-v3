/**
 * Reference Price Feed
 *
 * Streams real-time prices from Binance to use as reference mid prices.
 * Falls back to internal orderbook midpoint when Binance feed unavailable.
 */

import WebSocket from "ws";
import { CONFIG } from "./config";
import { log } from "./logger";

export type PriceCallback = (symbol: string, price: number) => void;

export class PriceFeed {
  private prices = new Map<string, number>();
  private ws: WebSocket | null = null;
  private callbacks: PriceCallback[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  /**
   * Subscribe to price updates for given DotMX symbols.
   * Maps them to Binance stream names and opens a single combined WS.
   */
  start(symbols: string[]) {
    this.running = true;

    if (CONFIG.priceSource === "internal") {
      log.info("PriceFeed", "Using internal orderbook as price source");
      return;
    }

    // Map DotMX symbols to Binance stream names
    const streams = symbols
      .map((s) => CONFIG.symbolMap[s])
      .filter((s): s is string => s !== null && s !== undefined)
      .map((s) => `${s}@miniTicker`);

    if (streams.length === 0) {
      log.warn("PriceFeed", "No Binance mappings found for given symbols");
      return;
    }

    const url = `${CONFIG.binanceWsUrl}/${streams.join("/")}`;
    log.info("PriceFeed", `Connecting to Binance: ${streams.length} streams`);
    this.connect(url);
  }

  stop() {
    this.running = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /** Get the latest reference price for a DotMX symbol */
  getPrice(symbol: string): number | undefined {
    return this.prices.get(symbol);
  }

  /** Register a callback for price updates */
  onPrice(cb: PriceCallback) {
    this.callbacks.push(cb);
  }

  /** Set price from internal source (orderbook midpoint) */
  setInternalPrice(symbol: string, price: number) {
    this.prices.set(symbol, price);
    for (const cb of this.callbacks) cb(symbol, price);
  }

  private connect(url: string) {
    if (this.ws) this.ws.close();

    const ws = new WebSocket(url);

    ws.on("open", () => {
      log.info("PriceFeed", "Binance WS connected");
    });

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        // miniTicker: { "e":"24hrMiniTicker", "s":"BTCUSDT", "c":"50000.00", ... }
        if (msg.e === "24hrMiniTicker" && msg.s && msg.c) {
          const binanceSymbol = msg.s.toLowerCase();
          const price = parseFloat(msg.c);

          // Reverse-map Binance symbol → DotMX symbol
          const dotmxSymbol = this.reverseLookup(binanceSymbol);
          if (dotmxSymbol && price > 0) {
            this.prices.set(dotmxSymbol, price);
            for (const cb of this.callbacks) cb(dotmxSymbol, price);
          }
        }
      } catch {
        // Ignore parse errors
      }
    });

    ws.on("close", () => {
      log.warn("PriceFeed", "Binance WS disconnected");
      this.scheduleReconnect(url);
    });

    ws.on("error", (err) => {
      log.error("PriceFeed", `Binance WS error: ${err.message}`);
      ws.close();
    });

    this.ws = ws;
  }

  private scheduleReconnect(url: string) {
    if (!this.running) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      log.info("PriceFeed", "Reconnecting to Binance...");
      this.connect(url);
    }, 5000);
  }

  /** Reverse map: "btcusdt" → "BTC-USDT" */
  private reverseLookup(binanceSymbol: string): string | undefined {
    for (const [dotmx, binance] of Object.entries(CONFIG.symbolMap)) {
      if (binance === binanceSymbol) return dotmx;
    }
    return undefined;
  }
}
