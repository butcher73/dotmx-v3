/**
 * Market Data API Service
 * 
 * Routes through NGINX gateway at /marketdata (goes directly to port 3002)
 */

const MARKETDATA_API_URL = process.env.NEXT_PUBLIC_MARKETDATA_URL || 'http://localhost:8080/marketdata';

/**
 * Raw ticker response from marketdata-server
 */
export interface RawTickerResponse {
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

/**
 * Normalized ticker for display
 */
export interface Ticker24h {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  high: string;
  low: string;
  volume: string;
  quoteVolume: string;
  bid: string;
  ask: string;
}

/**
 * Symbol info from the /symbols endpoint
 */
export interface SymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  minOrderSize: string;
  maxOrderSize: string;
  tickSize: string;
  lotSize: string;
  makerFee: string;
  takerFee: string;
}

export interface Orderbook {
  symbol: string;
  timestamp: number;
  bids: [string, string][];
  asks: [string, string][];
}

export interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
}

export interface MarketDataHealth {
  status: string;
  sources: Record<string, boolean>;
}

/**
 * Build URL with query parameters
 */
function buildUrl(endpoint: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(`${MARKETDATA_API_URL}${endpoint}`);
  
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
async function apiRequest<T>(endpoint: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = buildUrl(endpoint, params);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const error = await response.json();
        errorMessage = error.error || error.message || errorMessage;
      } catch {
        // Ignore JSON parse error, use statusText
      }
      throw new Error(`Market data API error: ${errorMessage}`);
    }
    
    return response.json();
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Failed to fetch market data');
  }
}

/**
 * Transform raw ticker to normalized format
 */
function transformTicker(raw: RawTickerResponse): Ticker24h {
  const changePercent = parseFloat(raw.changeUtc24h) * 100;
  return {
    symbol: raw.symbol,
    lastPrice: raw.lastPr,
    priceChange: raw.change24h,
    priceChangePercent: changePercent.toFixed(2),
    high: raw.high24h,
    low: raw.low24h,
    volume: raw.baseVolume,
    quoteVolume: raw.quoteVolume,
    bid: raw.bidPr,
    ask: raw.askPr,
  };
}

export const marketDataService = {
  /**
   * Get health status
   */
  getHealth: () =>
    apiRequest<MarketDataHealth>('/health'),
  
  /**
   * Get 24h ticker for a symbol
   */
  getTicker: async (symbol: string): Promise<Ticker24h> => {
    const response = await apiRequest<{ success: boolean; data: RawTickerResponse[] | null; error?: string }>('/api/v1/ticker', { symbol });
    if (!response.success || !response.data || !response.data.length || !response.data[0]) {
      throw new Error(response.error || 'No ticker data available');
    }
    return transformTicker(response.data[0]);
  },
  
  /**
   * Get all active symbols
   */
  getSymbols: async (): Promise<SymbolInfo[]> => {
    const response = await apiRequest<{ symbols: SymbolInfo[] }>('/symbols');
    return response.symbols || [];
  },
  
  /**
   * Get orderbook for a symbol
   */
  getOrderbook: (symbol: string, depth: number = 20) =>
    apiRequest<Orderbook>('/api/orderbook/' + symbol, { depth }),
  
  /**
   * Get klines (candlestick data)
   */
  getKlines: (symbol: string, granularity: string, limit: number = 100) =>
    apiRequest<{ source: string; data: Kline[] }>('/api/v1/klines', { symbol, granularity, limit }),
};
