/**
 * @deprecated LEGACY — Server-side Bitget Data Service
 *
 * Fetches data from Next.js API endpoints which proxy to Bitget REST API.
 * Prefer using the DotMX backend marketdata server directly via ApiClient.
 * The backend already proxies and caches exchange data from configured sources.
 * See: packages/marketdata/src/datasource.ts for the multi-source architecture.
 */

export interface BitgetCandlestickData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  usdtVolume: number;
}

export interface BitgetTickerData {
  symbol: string;
  high24h: string;
  open: string;
  low24h: string;
  lastPr: string;
  quoteVolume: string;
  baseVolume: string;
  usdtVolume: string;
  bidPr: string;
  askPr: string;
  bidSz: string;
  askSz: string;
  openUtc: string;
  ts: string;
  changeUtc24h: string;
  change24h: string;
}

export class BitgetApiService {
  private baseUrl: string;
  private refreshInterval: NodeJS.Timeout | null = null;
  private onCandlestickUpdate?: (data: BitgetCandlestickData[]) => void;
  private onTickerUpdate?: (data: BitgetTickerData) => void;
  private onError?: (error: string) => void;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  async fetchTicker(symbol: string): Promise<BitgetTickerData | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/bitget/ticker?symbol=${symbol}`
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch ticker data");
      }

      if (result.data && result.data.length > 0) {
        return result.data[0];
      }

      return null;
    } catch (error) {
      console.error("[BitgetAPI] Error fetching ticker:", error);
      if (this.onError) {
        this.onError(error instanceof Error ? error.message : "Unknown error");
      }
      return null;
    }
  }

  async fetchCandlesticks(
    symbol: string,
    granularity: string = "1m",
    limit: number = 200
  ): Promise<BitgetCandlestickData[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/bitget/candlestick?symbol=${symbol}&granularity=${granularity}&limit=${limit}`
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch candlestick data");
      }

      return result.data;
    } catch (error) {
      console.error("[BitgetAPI] Error fetching candlesticks:", error);
      if (this.onError) {
        this.onError(error instanceof Error ? error.message : "Unknown error");
      }
      return [];
    }
  }

  startLiveUpdates(
    symbol: string,
    granularity: string = "1m",
    intervalMs: number = 5000
  ): void {
    // Clear any existing interval
    this.stopLiveUpdates();

    // Initial fetch
    this.fetchInitialData(symbol, granularity);

    // Set up regular updates
    this.refreshInterval = setInterval(async () => {
      try {
        // Fetch latest candlestick data
        const candlesticks = await this.fetchCandlesticks(
          symbol,
          granularity,
          1
        );
        if (candlesticks.length > 0 && this.onCandlestickUpdate) {
          this.onCandlestickUpdate(candlesticks);
        }

        // Fetch ticker data
        const ticker = await this.fetchTicker(symbol);
        if (ticker && this.onTickerUpdate) {
          this.onTickerUpdate(ticker);
        }
      } catch (error) {
        console.error("[BitgetAPI] Error in live update:", error);
      }
    }, intervalMs);
  }

  private async fetchInitialData(
    symbol: string,
    granularity: string
  ): Promise<void> {
    try {
      // Fetch historical data
      const candlesticks = await this.fetchCandlesticks(
        symbol,
        granularity,
        200
      );
      if (candlesticks.length > 0 && this.onCandlestickUpdate) {
        this.onCandlestickUpdate(candlesticks);
      }

      // Fetch ticker data
      const ticker = await this.fetchTicker(symbol);
      if (ticker && this.onTickerUpdate) {
        this.onTickerUpdate(ticker);
      }
    } catch (error) {
      console.error("[BitgetAPI] Error fetching initial data:", error);
    }
  }

  stopLiveUpdates(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  setOnCandlestickUpdate(
    callback: (data: BitgetCandlestickData[]) => void
  ): void {
    this.onCandlestickUpdate = callback;
  }

  setOnTickerUpdate(callback: (data: BitgetTickerData) => void): void {
    this.onTickerUpdate = callback;
  }

  setOnError(callback: (error: string) => void): void {
    this.onError = callback;
  }
}
