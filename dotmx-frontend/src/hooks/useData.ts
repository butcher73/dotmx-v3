/**
 * Market Data Hooks - Comprehensive Data Management
 *
 * This file contains all market data related hooks merged for better maintainability:
 * - Bitget WebSocket connections (ticker, orderbook, trades, candlesticks)
 * - Market data aggregation and formatting
 * - Symbol management and conversion
 * - Store contract integration
 * - Real-time price feeds and volume analysis
 */

"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAccount } from "@/hooks/useAuth";
import {
  BitgetWebSocketService,
  BitgetStreamConfig,
  BitgetStreamType,
  BitgetTickerData,
  BitgetTradeData,
  BitgetCandlestickData,
} from "@/services/websocket/BitgetWebSocketService";
import { WebSocketState } from "@/services/websocket/WebSocketManager";
import { BitgetApiService } from "@/services/BitgetApiService";
import { MarketDataItem, KLineData } from "@/config/types";
import {
  TOKEN_LOGOS,
  formatMarketPrice as formatPrice,
  formatVolume,
  formatChangePercent,
  calculateChangePercent,
} from "@/utils/formatting";
import { apiClient } from "@/services/ApiClient";

// =============================================================================
// TYPES
// =============================================================================

// Re-export types for external use
export type {
  BitgetTickerData,
  BitgetTradeData,
  BitgetCandlestickData,
} from "@/services/websocket/BitgetWebSocketService";

export type { MarketDataItem, KLineData } from "@/config/types";

export interface PerpSymbol {
  symbol: string;
  displayName: string;
  asset: string;
  collateral: string;
  bitgetSymbol: string;
  isActive: boolean;
}

export interface StoreMarket {
  symbol: string; // e.g., "ETH-USDT" (canonical dash format)
  asset: string; // e.g., "ETH"
  collateral: string; // e.g., "USDT"
  displayName: string; // e.g., "Ethereum"
  bitgetSymbol: string; // e.g., "ETHUSDT" (flat exchange format)
  isActive: boolean;
}

export interface BitgetWebSocketState {
  // Connection state
  isConnected: boolean;
  connectionState: WebSocketState;
  error: string | null;
  latency: number;
  connectionId: string;

  // Market data
  ticker: BitgetTickerData | null;
  orderBook: { bids: [string, string][]; asks: [string, string][] };
  trades: BitgetTradeData[];

  // Statistics
  reconnectAttempts: number;
  lastUpdate: number;
  messagesReceived: number;

  // Symbol transition state
  currentSymbol: string;
  isTransitioning: boolean;
  symbolChangeTimestamp: number;
}

export interface BitgetWebSocketActions {
  reconnect: () => Promise<void>;
  disconnect: () => void;
  updateSymbol: (symbol: string) => Promise<void>;
  clearTrades: () => void;
}

export interface CandlestickOptions {
  symbol?: string;
  timeFrame?: string;
  autoStart?: boolean;
  enableLogging?: boolean;
}

export interface CandlestickReturn {
  data: KLineData[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  updateTimeFrame: (timeFrame: string) => void;
}

// Fallback symbols for when Store contract is not available
// Note: bitgetSymbol uses USDT suffix as Bitget API requires USDT pairs
export const FALLBACK_SYMBOLS: PerpSymbol[] = [
  {
    symbol: "BTC-USDT",
    asset: "BTC",
    collateral: "USDT",
    displayName: "Bitcoin",
    bitgetSymbol: "BTCUSDT",
    isActive: true,
  },
  {
    symbol: "ETH-USDT",
    asset: "ETH",
    collateral: "USDT",
    displayName: "Ethereum",
    bitgetSymbol: "ETHUSDT",
    isActive: true,
  },
  {
    symbol: "BNB-USDT",
    asset: "BNB",
    collateral: "USDT",
    displayName: "BNB",
    bitgetSymbol: "BNBUSDT",
    isActive: true,
  },
  {
    symbol: "XRP-USDT",
    asset: "XRP",
    collateral: "USDT",
    displayName: "Ripple",
    bitgetSymbol: "XRPUSDT",
    isActive: true,
  },
  {
    symbol: "SOL-USDT",
    asset: "SOL",
    collateral: "USDT",
    displayName: "Solana",
    bitgetSymbol: "SOLUSDT",
    isActive: true,
  },
];

// =============================================================================
// STORE MARKETS HOOK
// =============================================================================

// Backend API URL for marketdata
const MARKETDATA_API_URL =
  process.env.NEXT_PUBLIC_MARKETDATA_URL || "http://localhost:8080/marketdata";

// Display names for assets
const ASSET_DISPLAY_NAMES: { [key: string]: string } = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  BNB: "BNB",
  SOL: "Solana",
  XRP: "Ripple",
  ADA: "Cardano",
  DOT: "Polkadot",
  MATIC: "Polygon",
  AVAX: "Avalanche",
  LINK: "Chainlink",
  ARB: "Arbitrum",
  OP: "Optimism",
  DAI: "Dai",
  DMX: "DotMX",
  WBTC: "Wrapped BTC",
  USDC: "USD Coin",
  USDT: "Tether",
};

interface BackendSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  minOrderSize?: number;
  maxOrderSize?: number;
  tickSize?: number;
  makerFee?: number;
  takerFee?: number;
}

export function useStoreMarkets() {
  const [markets, setMarkets] = useState<StoreMarket[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Transform backend symbol data to StoreMarket format
  const transformMarketData = useCallback(
    (backendSymbols: BackendSymbol[]): StoreMarket[] => {
      if (!backendSymbols || !Array.isArray(backendSymbols)) {
        return [];
      }

      return backendSymbols
        .filter((s) => {
          const status = s.status?.toUpperCase();
          return status === "TRADING" || status === "ACTIVE";
        })
        .map((s) => {
          const asset = s.baseAsset;
          const collateral = s.quoteAsset;

          if (!asset || !collateral) {
            return null;
          }

          // Normalize to canonical format: "BTC/USDT" → "BTC-USDT"
          const normalizedSymbol = s.symbol.replace("/", "-");

          return {
            symbol: normalizedSymbol,
            asset,
            collateral,
            displayName: ASSET_DISPLAY_NAMES[asset] || asset,
            // Flat exchange format for Bitget/WS: "BTCUSDT"
            bitgetSymbol: `${asset}USDT`,
            isActive: true,
          };
        })
        .filter((market): market is StoreMarket => market !== null);
    },
    []
  );

  // Fetch markets from backend API
  const fetchMarkets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // MARKETDATA_API_URL = http://localhost:8080/marketdata
      // Backend has /api/symbols endpoint
      const response = await fetch(`${MARKETDATA_API_URL}/api/symbols`);

      if (!response.ok) {
        throw new Error(`Failed to fetch markets: ${response.statusText}`);
      }

      const data = await response.json();
      const transformedMarkets = transformMarketData(data.symbols || []);
      setMarkets(transformedMarkets);
    } catch (err) {
      console.error("Error fetching markets from backend:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to fetch markets")
      );
      // Keep existing markets on error (if any)
    } finally {
      setIsLoading(false);
    }
  }, [transformMarketData]);

  // Fetch markets on mount
  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return {
    markets,
    isLoading,
    error,
    refetch: fetchMarkets,
  };
}

// =============================================================================
// PERP SYMBOLS HOOK
// =============================================================================

export function usePerpSymbols(defaultSymbol?: string) {
  // Fetch symbols from backend API
  const {
    markets: storeMarkets,
    isLoading,
    error,
    refetch,
  } = useStoreMarkets();

  // Convert StoreMarket to PerpSymbol and manage symbols state
  const [symbols, setSymbols] = useState<PerpSymbol[]>(FALLBACK_SYMBOLS);
  const [currentSymbol, setCurrentSymbolState] = useState<PerpSymbol>(() => {
    if (defaultSymbol) {
      const found = FALLBACK_SYMBOLS.find(
        (s) => s.bitgetSymbol === defaultSymbol
      );
      if (found) return found;
    }
    // Default to BTC-USD - guaranteed to exist since we define it above
    return FALLBACK_SYMBOLS[0]!;
  });

  // Update symbols when store markets are loaded
  useEffect(() => {
    if (storeMarkets && storeMarkets.length > 0) {
      // Convert StoreMarket to PerpSymbol
      const convertedSymbols: PerpSymbol[] = storeMarkets.map(
        (market: StoreMarket) => ({
          symbol: market.symbol,
          displayName: market.displayName,
          asset: market.asset,
          collateral: market.collateral,
          bitgetSymbol: market.bitgetSymbol,
          isActive: market.isActive,
        })
      );

      setSymbols(convertedSymbols);

      // Update current symbol if it exists in the new symbols
      if (defaultSymbol) {
        const found = convertedSymbols.find(
          (s) => s.bitgetSymbol === defaultSymbol
        );
        if (found && found.bitgetSymbol !== currentSymbol.bitgetSymbol) {
          setCurrentSymbolState(found);
        }
      } else if (convertedSymbols.length > 0) {
        // If no default symbol and we have new symbols, use the first one
        setCurrentSymbolState(convertedSymbols[0]!);
      }
    } else if (error) {
      // On error, fall back to predefined symbols
      setSymbols(FALLBACK_SYMBOLS);
    }
  }, [storeMarkets, error, defaultSymbol, currentSymbol.bitgetSymbol]);

  const setCurrentSymbol = useCallback((symbol: PerpSymbol) => {
    setCurrentSymbolState(symbol);
  }, []);

  // Update current symbol when defaultSymbol changes
  useEffect(() => {
    if (!defaultSymbol) return;

    const found = symbols.find((s) => s.bitgetSymbol === defaultSymbol);

    // Only update if we found a valid symbol and it's different from current
    if (found && found.bitgetSymbol !== currentSymbol.bitgetSymbol) {
      setCurrentSymbolState(found);
    }
  }, [defaultSymbol, currentSymbol.bitgetSymbol, symbols]);

  const searchSymbols = useCallback(
    (query: string): PerpSymbol[] => {
      if (!query.trim()) return symbols;

      const lowercaseQuery = query.toLowerCase();
      return symbols.filter(
        (symbol) =>
          symbol.symbol.toLowerCase().includes(lowercaseQuery) ||
          symbol.asset.toLowerCase().includes(lowercaseQuery) ||
          symbol.displayName.toLowerCase().includes(lowercaseQuery)
      );
    },
    [symbols]
  );

  const getSymbolByBitgetSymbol = useCallback(
    (bitgetSymbol: string): PerpSymbol | undefined => {
      return symbols.find((s) => s.bitgetSymbol === bitgetSymbol);
    },
    [symbols]
  );

  return {
    symbols,
    currentSymbol,
    setCurrentSymbol,
    searchSymbols,
    getSymbolByBitgetSymbol,
    isLoading,
    error,
    refetch,
  };
}

// =============================================================================
// BITGET WEBSOCKET HOOK
// =============================================================================

export interface UseBitgetWebSocketOptions {
  symbol: string;
  enableTicker?: boolean;
  enableOrderBook?: boolean;
  enableTrades?: boolean;
  autoReconnect?: boolean;
  enableLogging?: boolean;
}

const INITIAL_WS_STATE: BitgetWebSocketState = {
  isConnected: false,
  connectionState: WebSocketState.DISCONNECTED,
  error: null,
  latency: 0,
  connectionId: "",
  ticker: null,
  orderBook: { bids: [], asks: [] },
  trades: [],
  reconnectAttempts: 0,
  lastUpdate: 0,
  messagesReceived: 0,
  currentSymbol: "",
  isTransitioning: false,
  symbolChangeTimestamp: 0,
};

/**
 * @deprecated Use MarketDataWebSocketService directly instead.
 * This hook creates a direct connection to wss://ws.bitget.com, bypassing the backend.
 */
export function useBitgetWebSocket(
  options: UseBitgetWebSocketOptions
): [BitgetWebSocketState, BitgetWebSocketActions] {
  const [state, setState] = useState<BitgetWebSocketState>(INITIAL_WS_STATE);
  const serviceRef = useRef<BitgetWebSocketService | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isInitializedRef = useRef(false);

  // Build stream configuration
  const buildStreamConfig = useCallback(
    (symbol: string): BitgetStreamConfig => {
      const streams: BitgetStreamType[] = [];

      if (options.enableTicker) streams.push(BitgetStreamType.TICKER);
      if (options.enableOrderBook) streams.push(BitgetStreamType.BOOKS5);
      if (options.enableTrades) streams.push(BitgetStreamType.TRADE);

      // Default to order book if no streams specified
      if (streams.length === 0) {
        streams.push(BitgetStreamType.BOOKS5);
      }

      return {
        symbol,
        streams,
        autoReconnect: options.autoReconnect !== false,
        enableLogging: options.enableLogging || false,
      };
    },
    [
      options.enableTicker,
      options.enableOrderBook,
      options.enableTrades,
      options.autoReconnect,
      options.enableLogging,
    ]
  );

  // Initialize or update WebSocket service
  const initializeService = useCallback(
    (symbol: string) => {
      // Cleanup existing service
      if (serviceRef.current) {
        serviceRef.current.disconnect();
      }

      const config = buildStreamConfig(symbol);
      const service = new BitgetWebSocketService(config);

      // Set up event handlers
      service.setOnStateChange((connectionState) => {
        setState((prev) => ({
          ...prev,
          connectionState,
          isConnected: connectionState === WebSocketState.CONNECTED,
          isTransitioning: connectionState === WebSocketState.CONNECTING,
        }));

        if (connectionState === WebSocketState.CONNECTED) {
          reconnectAttemptsRef.current = 0;
        }
      });

      service.setOnError((error) => {
        setState((prev) => ({
          ...prev,
          error,
          isTransitioning: false,
        }));
      });

      service.setOnTickerData((ticker) => {
        setState((prev) => ({
          ...prev,
          ticker,
          lastUpdate: Date.now(),
          messagesReceived: prev.messagesReceived + 1,
          error: null,
        }));
      });

      service.setOnOrderBookData((orderBook) => {
        setState((prev) => ({
          ...prev,
          orderBook,
          lastUpdate: Date.now(),
          messagesReceived: prev.messagesReceived + 1,
          error: null,
        }));
      });

      service.setOnTradeData((tradesArray) => {
        setState((prev) => ({
          ...prev,
          trades: Array.isArray(tradesArray) ? tradesArray : [tradesArray],
          lastUpdate: Date.now(),
          messagesReceived: prev.messagesReceived + 1,
          error: null,
        }));
      });

      serviceRef.current = service;
      return service;
    },
    [buildStreamConfig]
  );

  // Initialize on mount and symbol change
  useEffect(() => {
    if (!isInitializedRef.current) {
      const service = initializeService(options.symbol);
      service.connect();
      isInitializedRef.current = true;

      setState((prev) => ({
        ...prev,
        currentSymbol: options.symbol,
      }));
    }

    return () => {
      if (serviceRef.current) {
        serviceRef.current.disconnect();
      }
    };
  }, [options.symbol, initializeService]);

  // Actions
  const actions: BitgetWebSocketActions = useMemo(
    () => ({
      reconnect: async () => {
        if (serviceRef.current) {
          reconnectAttemptsRef.current++;
          setState((prev) => ({
            ...prev,
            reconnectAttempts: reconnectAttemptsRef.current,
            isTransitioning: true,
            error: null,
          }));

          await serviceRef.current.reconnect();
        }
      },

      disconnect: () => {
        if (serviceRef.current) {
          serviceRef.current.disconnect();
          setState((prev) => ({
            ...prev,
            isConnected: false,
            connectionState: WebSocketState.DISCONNECTED,
            isTransitioning: false,
          }));
        }
      },

      updateSymbol: async (symbol: string) => {
        setState((prev) => ({
          ...prev,
          isTransitioning: true,
          symbolChangeTimestamp: Date.now(),
        }));

        const service = initializeService(symbol);
        await service.connect();

        setState((prev) => ({
          ...prev,
          currentSymbol: symbol,
        }));
      },

      clearTrades: () => {
        setState((prev) => ({
          ...prev,
          trades: [],
        }));
      },
    }),
    [initializeService]
  );

  return [state, actions];
}

// =============================================================================
// CANDLESTICK DATA HOOK
// =============================================================================

export function useBitgetCandlestick({
  symbol = "BTCUSDC",
  timeFrame = "1m",
  autoStart = true,
  enableLogging = false,
}: CandlestickOptions = {}): CandlestickReturn {
  const [data, setData] = useState<KLineData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsServiceRef = useRef<BitgetWebSocketService | null>(null);
  const currentTimeFrameRef = useRef(timeFrame);

  // Convert BitgetCandlestickData to KLineData format with enhanced validation
  const convertToKLineData = useCallback(
    (candlesticks: BitgetCandlestickData[]): KLineData[] => {
      return candlesticks
        .map((candle) => {
          // Helper function to safely convert numbers and handle NaN
          const safeNumber = (value: number, fallback: number = 0): number => {
            return typeof value === "number" && !isNaN(value)
              ? value
              : fallback;
          };

          return {
            timestamp: candle.timestamp || Date.now(),
            open: safeNumber(candle.open),
            high: safeNumber(candle.high),
            low: safeNumber(candle.low),
            close: safeNumber(candle.close),
            volume: safeNumber(candle.volume),
          };
        })
        .filter((candle) => {
          // Filter out invalid candles where price data is missing
          return (
            candle.open > 0 &&
            candle.high > 0 &&
            candle.low > 0 &&
            candle.close > 0
          );
        });
    },
    []
  );

  // Initialize WebSocket service
  const initializeService = useCallback(() => {
    if (wsServiceRef.current) {
      wsServiceRef.current.disconnect();
    }

    const service = new BitgetWebSocketService({
      symbol,
      streams: [BitgetStreamType.CANDLESTICK],
      timeFrame: currentTimeFrameRef.current,
      autoReconnect: true,
      enableLogging,
    });

    // Set up event handlers
    service.setOnStateChange((state) => {
      setIsConnected(state === WebSocketState.CONNECTED);
      if (state === WebSocketState.CONNECTED) {
        setIsLoading(false);
        setError(null);
      } else if (state === WebSocketState.CONNECTING) {
        setIsLoading(true);
      } else if (state === WebSocketState.DISCONNECTED) {
        setIsLoading(false);
      }
    });

    service.setOnError((errorMsg) => {
      setError(errorMsg);
      setIsLoading(false);
    });

    service.setOnCandlestickData((candlesticks) => {
      const klineData = convertToKLineData(candlesticks);

      if (klineData.length === 1) {
        // Single candle update - either update existing or append new
        const newCandle = klineData[0];
        if (!newCandle) return; // Guard against undefined

        setData((prevData: KLineData[]): KLineData[] => {
          const existingIndex = prevData.findIndex(
            (candle) => candle.timestamp === newCandle.timestamp
          );

          if (existingIndex >= 0) {
            // Check if the candle has actually changed before updating
            const existingCandle = prevData[existingIndex];
            if (
              existingCandle &&
              existingCandle.close === newCandle.close &&
              existingCandle.high === newCandle.high &&
              existingCandle.low === newCandle.low &&
              existingCandle.volume === newCandle.volume
            ) {
              // No change, return same reference to prevent re-renders
              return prevData;
            }

            // Update existing candle
            const updatedData = [...prevData];
            updatedData[existingIndex] = newCandle;
            return updatedData;
          } else {
            // Append new candle and keep only last 1000 candles for performance
            const updatedData: KLineData[] = [...prevData, newCandle].slice(
              -1000
            );
            return updatedData.sort((a, b) => a.timestamp - b.timestamp);
          }
        });
      } else {
        // Full dataset (initial load)
        setData((prevData) => {
          // Check if the data has actually changed
          if (prevData.length === klineData.length) {
            const lastPrev = prevData[prevData.length - 1];
            const lastNew = klineData[klineData.length - 1];

            if (
              lastPrev &&
              lastNew &&
              lastPrev.timestamp === lastNew.timestamp &&
              lastPrev.close === lastNew.close &&
              lastPrev.high === lastNew.high &&
              lastPrev.low === lastNew.low &&
              lastPrev.volume === lastNew.volume
            ) {
              // No meaningful change, return same reference
              return prevData;
            }
          }

          return klineData;
        });
      }
    });

    wsServiceRef.current = service;
    return service;
  }, [symbol, enableLogging, convertToKLineData]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!wsServiceRef.current) {
        initializeService();
      }

      // Add connection timeout to ensure we get data
      const connectionPromise = wsServiceRef.current?.connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Connection timeout after 10 seconds"));
        }, 10000);
      });

      try {
        await Promise.race([connectionPromise, timeoutPromise]);
      } catch {
        // Don't throw here, let the service handle fallback
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Connection failed";
      setError(errorMsg);
      setIsLoading(false);
    }
  }, [initializeService]);

  // Disconnect from WebSocket
  const disconnect = useCallback(async () => {
    try {
      await wsServiceRef.current?.disconnect();
      wsServiceRef.current = null;
    } catch {
      // Disconnect error - fail silently
    }
  }, []);

  // Update time frame
  const updateTimeFrame = useCallback(
    (newTimeFrame: string) => {
      currentTimeFrameRef.current = newTimeFrame;

      // Reconnect with new timeframe
      if (isConnected) {
        disconnect().then(() => {
          // Reinitialize with new timeframe
          initializeService();
          connect();
        });
      } else {
        // Just reinitialize if not connected
        initializeService();
      }
    },
    [isConnected, disconnect, connect, initializeService]
  );

  // Auto-start connection
  useEffect(() => {
    let isMounted = true;

    if (autoStart) {
      const connectAsync = async () => {
        try {
          setIsLoading(true);
          setError(null);

          if (!wsServiceRef.current) {
            const service = initializeService();
            wsServiceRef.current = service;
          }

          if (isMounted) {
            await wsServiceRef.current.connect();
          }
        } catch (err) {
          if (isMounted) {
            const errorMsg =
              err instanceof Error ? err.message : "Connection failed";
            setError(errorMsg);
            setIsLoading(false);
          }
        }
      };

      connectAsync();
    }

    return () => {
      isMounted = false;
      if (wsServiceRef.current) {
        wsServiceRef.current.disconnect();
      }
    };
  }, [autoStart, initializeService]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsServiceRef.current) {
        wsServiceRef.current.disconnect();
      }
    };
  }, []);

  return {
    data,
    isConnected,
    isLoading,
    error,
    connect,
    disconnect,
    updateTimeFrame,
  };
}

// =============================================================================
// UNIFIED MARKET DATA HOOK
// =============================================================================

interface UseMarketDataReturn {
  marketData: MarketDataItem[];
  isLoading: boolean;
  error: string | null;
  topGainers: MarketDataItem[];
  topLosers: MarketDataItem[];
  highestVolume: MarketDataItem[];
  refreshData: () => void;
}

// Extended symbol list - Limited to perpetuals market assets only
const EXTENDED_SYMBOLS: PerpSymbol[] = FALLBACK_SYMBOLS;

export function useMarketData(useRest: boolean = false): UseMarketDataReturn {
  const [marketData, setMarketData] = useState<MarketDataItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const updateCountRef = useRef(0);
  const dataMapRef = useRef<Map<string, MarketDataItem>>(new Map());
  const apiServiceRef = useRef<BitgetApiService | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize API service for REST fallback
  useEffect(() => {
    if (useRest) {
      apiServiceRef.current = new BitgetApiService();
    }
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [useRest]);

  // Initialize with default data
  useEffect(() => {
    const initialData: MarketDataItem[] = EXTENDED_SYMBOLS.map(
      (symbol, index) => ({
        symbol: symbol.asset,
        name: symbol.displayName,
        price: "$0.00",
        change: "+0.00%",
        changePercent: 0,
        volume: "$0",
        logo: TOKEN_LOGOS[symbol.asset] || "/img/token/btc.svg",
        rank: index + 1,
        lastPrice: 0,
        volume24h: 0,
      })
    );

    setMarketData(initialData);
    initialData.forEach((item) => {
      dataMapRef.current.set(item.symbol, item);
    });
  }, []);

  // Helper function to update market data for a symbol
  const updateSymbolData = useCallback(
    (symbolData: { symbol: string; ticker: BitgetTickerData }) => {
      const { symbol, ticker } = symbolData;
      // Strip quote asset to get base: "BTCUSDT" → "BTC"
      const baseSymbol = symbol.replace(/USDT$|USDC$|USD$/, "");

      if (!ticker) return;

      const existingData = dataMapRef.current.get(baseSymbol);
      if (!existingData) return;

      const price = ticker.price || 0;
      const change = ticker.priceChangePercent || 0;
      const volume = ticker.quoteVolume || 0; // Already in USD for USDC pairs

      const updatedData: MarketDataItem = {
        ...existingData,
        price: formatPrice(price),
        change: formatChangePercent(change),
        changePercent: change,
        volume: formatVolume(volume),
        lastPrice: price,
        volume24h: volume,
      };

      dataMapRef.current.set(baseSymbol, updatedData);

      // Update state with new data
      setMarketData((prevData) => {
        return prevData.map((item) =>
          item.symbol === baseSymbol ? updatedData : item
        );
      });

      setError(null);
    },
    []
  );

  // REST API data fetching functions
  const fetchSymbolDataRest = useCallback(
    async (symbol: PerpSymbol): Promise<MarketDataItem | null> => {
      try {
        if (!apiServiceRef.current) return null;

        const ticker = await apiServiceRef.current.fetchTicker(
          symbol.bitgetSymbol
        );
        if (!ticker) return null;

        const price = parseFloat(ticker.lastPr || "0");
        const open = parseFloat(ticker.open || "0");
        const changePercent = calculateChangePercent(price, open);
        const volume = parseFloat(ticker.quoteVolume || "0");

        return {
          symbol: symbol.asset,
          name: symbol.displayName,
          price: formatPrice(price),
          change: formatChangePercent(changePercent),
          changePercent,
          volume: formatVolume(volume),
          logo: TOKEN_LOGOS[symbol.asset] || "/img/token/btc.svg",
          rank: 0, // Will be set later based on sorting
          lastPrice: price,
          volume24h: volume,
        };
      } catch (error) {
        console.error(`Error fetching data for ${symbol.asset}:`, error);
        return null;
      }
    },
    []
  );

  const fetchAllMarketDataRest = useCallback(async () => {
    try {
      setError(null);

      const promises = EXTENDED_SYMBOLS.map((symbol) =>
        fetchSymbolDataRest(symbol)
      );
      const results = await Promise.all(promises);

      const validData = results.filter(
        (item): item is MarketDataItem => item !== null
      );

      if (validData.length > 0) {
        // Sort by market cap (volume as proxy) and assign ranks
        const sortedData = validData
          .sort((a, b) => b.volume24h - a.volume24h)
          .map((item, index) => ({ ...item, rank: index + 1 }));

        setMarketData(sortedData);
        setIsLoading(false);
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to fetch market data";
      setError(errorMsg);
      setIsLoading(false);
    }
  }, [fetchSymbolDataRest]);

  // REST API periodic updates
  const startDataUpdatesRest = useCallback(() => {
    fetchAllMarketDataRest();
    updateIntervalRef.current = setInterval(() => {
      fetchAllMarketDataRest();
    }, 30000);
  }, [fetchAllMarketDataRest]);

  const stopDataUpdatesRest = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  }, []);

  // WebSocket connections for multiple symbols
  const [btcState, btcActions] = useBitgetWebSocket({
    symbol: "BTCUSDC",
    enableTicker: true,
    autoReconnect: true,
  });

  const [ethState, ethActions] = useBitgetWebSocket({
    symbol: "ETHUSDC",
    enableTicker: true,
    autoReconnect: true,
  });

  const [bnbState, bnbActions] = useBitgetWebSocket({
    symbol: "BNBUSDC",
    enableTicker: true,
    autoReconnect: true,
  });

  const [xrpState, xrpActions] = useBitgetWebSocket({
    symbol: "XRPUSDC",
    enableTicker: true,
    autoReconnect: true,
  });

  const [solState, solActions] = useBitgetWebSocket({
    symbol: "SOLUSDC",
    enableTicker: true,
    autoReconnect: true,
  });

  // WebSocket data updates (only when not using REST)
  useEffect(() => {
    if (!useRest && btcState.ticker) {
      updateSymbolData({ symbol: "BTCUSDC", ticker: btcState.ticker });
    }
  }, [btcState.ticker, updateSymbolData, useRest]);

  useEffect(() => {
    if (!useRest && ethState.ticker) {
      updateSymbolData({ symbol: "ETHUSDC", ticker: ethState.ticker });
    }
  }, [ethState.ticker, updateSymbolData, useRest]);

  useEffect(() => {
    if (!useRest && bnbState.ticker) {
      updateSymbolData({ symbol: "BNBUSDC", ticker: bnbState.ticker });
    }
  }, [bnbState.ticker, updateSymbolData, useRest]);

  useEffect(() => {
    if (!useRest && xrpState.ticker) {
      updateSymbolData({ symbol: "XRPUSDC", ticker: xrpState.ticker });
    }
  }, [xrpState.ticker, updateSymbolData, useRest]);

  useEffect(() => {
    if (!useRest && solState.ticker) {
      updateSymbolData({ symbol: "SOLUSDC", ticker: solState.ticker });
    }
  }, [solState.ticker, updateSymbolData, useRest]);

  // Handle loading state for WebSocket
  useEffect(() => {
    if (!useRest) {
      const isAnyConnected =
        btcState.isConnected ||
        ethState.isConnected ||
        bnbState.isConnected ||
        solState.isConnected ||
        xrpState.isConnected;

      if (isAnyConnected) {
        setIsLoading(false);
      }
    }
  }, [
    btcState.isConnected,
    ethState.isConnected,
    bnbState.isConnected,
    solState.isConnected,
    xrpState.isConnected,
    useRest,
  ]);

  // Handle errors for WebSocket
  useEffect(() => {
    if (!useRest) {
      const errors = [
        btcState.error,
        ethState.error,
        bnbState.error,
        solState.error,
        xrpState.error,
      ].filter((error): error is string => error !== null);

      if (errors.length > 0 && errors[0]) {
        setError(errors[0]);
      }
    }
  }, [
    btcState.error,
    ethState.error,
    bnbState.error,
    solState.error,
    xrpState.error,
    useRest,
  ]);

  // Start REST updates if using REST mode
  useEffect(() => {
    if (useRest) {
      startDataUpdatesRest();
      return () => {
        stopDataUpdatesRest();
      };
    }
    // Return undefined explicitly for non-REST mode
    return undefined;
  }, [useRest, startDataUpdatesRest, stopDataUpdatesRest]);

  // Compute derived data
  const topGainers = marketData
    .filter((item) => item.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 2);

  const topLosers = marketData
    .filter((item) => item.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 2);

  const highestVolume = marketData
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, 2);

  const refreshData = useCallback(() => {
    updateCountRef.current++;
    setIsLoading(true);
    setError(null);

    if (useRest) {
      fetchAllMarketDataRest();
    } else {
      // Trigger reconnection of WebSocket services
      btcActions.reconnect().catch(console.error);
      ethActions.reconnect().catch(console.error);
      bnbActions.reconnect().catch(console.error);
      solActions.reconnect().catch(console.error);
      xrpActions.reconnect().catch(console.error);
    }
  }, [
    useRest,
    fetchAllMarketDataRest,
    btcActions,
    ethActions,
    bnbActions,
    solActions,
    xrpActions,
  ]);

  return {
    marketData,
    isLoading,
    error,
    topGainers,
    topLosers,
    highestVolume,
    refreshData,
  };
}

// =============================================================================
// PORTFOLIO CHART HOOKS
// =============================================================================

interface ChartDataPoint {
  timestamp: number;
  value: number;
  pnl: number;
  date: string;
  time: string;
}

interface PortfolioChartData {
  points: ChartDataPoint[];
  totalChange: number;
  totalChangePercent: number;
  minValue: number;
  maxValue: number;
}

// Utility function to aggregate data points by time intervals for smoother charting
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function aggregatePointsByInterval(
  points: ChartDataPoint[],
  timeFilter: string
): ChartDataPoint[] {
  if (points.length === 0) return [];

  // Determine interval based on time filter
  const getInterval = () => {
    switch (timeFilter) {
      case "1D":
        return 60 * 60; // 1 hour intervals
      case "1W":
        return 4 * 60 * 60; // 4 hour intervals
      case "1M":
        return 24 * 60 * 60; // 1 day intervals
      case "6M":
        return 7 * 24 * 60 * 60; // 1 week intervals
      default:
        return 24 * 60 * 60; // 1 day intervals for "All Time"
    }
  };

  const intervalSeconds = getInterval();
  const aggregated: ChartDataPoint[] = [];

  // Group points by intervals
  const intervalMap = new Map<number, ChartDataPoint[]>();

  points.forEach((point) => {
    const intervalStart =
      Math.floor(point.timestamp / intervalSeconds) * intervalSeconds;
    if (!intervalMap.has(intervalStart)) {
      intervalMap.set(intervalStart, []);
    }
    intervalMap.get(intervalStart)!.push(point);
  });

  // Aggregate each interval
  intervalMap.forEach((intervalPoints, intervalStart) => {
    if (intervalPoints.length === 0) return;

    // Use the last point in the interval for most accurate value
    const lastPoint = intervalPoints[intervalPoints.length - 1];

    if (lastPoint) {
      aggregated.push({
        timestamp: intervalStart,
        value: lastPoint.value,
        pnl: lastPoint.pnl,
        date: lastPoint.date,
        time: lastPoint.time,
      });
    }
  });

  return aggregated.sort((a, b) => a.timestamp - b.timestamp);
}

// =============================================================================
// PORTFOLIO CHART HOOK (API-based)
// =============================================================================

interface ChartDataPoint {
  timestamp: number;
  value: number;
  pnl: number;
  date: string;
  time: string;
}

interface PortfolioChartData {
  points: ChartDataPoint[];
  totalChange: number;
  totalChangePercent: number;
  minValue: number;
  maxValue: number;
}

export function usePortfolioChart(timeFilter: string = "1W") {
  const { address, isConnected } = useAccount();
  const [data, setData] = useState<PortfolioChartData>({
    points: [],
    totalChange: 0,
    totalChangePercent: 0,
    minValue: 0,
    maxValue: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolioData = useCallback(async () => {
    if (!address || !isConnected) {
      setData({
        points: [],
        totalChange: 0,
        totalChangePercent: 0,
        minValue: 0,
        maxValue: 0,
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.getUserTransactions({ limit: 100 });
      const transactions = response.transactions || [];

      if (transactions.length === 0) {
        const now = new Date();
        setData({
          points: [
            {
              timestamp: Math.floor(now.getTime() / 1000),
              value: 1000,
              pnl: 0,
              date: now.toLocaleDateString(),
              time: now.toLocaleTimeString(),
            },
          ],
          totalChange: 0,
          totalChangePercent: 0,
          minValue: 1000,
          maxValue: 1000,
        });
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      let fromTimestamp = 0;

      switch (timeFilter) {
        case "1D":
          fromTimestamp = now - 24 * 60 * 60;
          break;
        case "1W":
          fromTimestamp = now - 7 * 24 * 60 * 60;
          break;
        case "1M":
          fromTimestamp = now - 30 * 24 * 60 * 60;
          break;
        case "6M":
          fromTimestamp = now - 180 * 24 * 60 * 60;
          break;
        default:
          fromTimestamp = 0;
      }

      const filteredTx = transactions.filter((tx) => {
        const txTime = new Date(tx.created_at).getTime() / 1000;
        return txTime >= fromTimestamp;
      });

      let runningBalance = 1000;
      const points: ChartDataPoint[] = [];

      filteredTx.forEach((tx) => {
        const timestamp = Math.floor(new Date(tx.created_at).getTime() / 1000);
        const amount = parseFloat(tx.amount || "0");
        const fee = parseFloat(tx.fee || "0");

        if (tx.tx_type === "trade_buy" || tx.tx_type === "deposit") {
          runningBalance += amount;
        } else if (tx.tx_type === "trade_sell" || tx.tx_type === "withdrawal") {
          runningBalance -= amount;
        }
        runningBalance -= fee;

        const date = new Date(timestamp * 1000);
        points.push({
          timestamp,
          value: runningBalance,
          pnl: amount - fee,
          date: date.toLocaleDateString(),
          time: date.toLocaleTimeString(),
        });
      });

      if (points.length === 0) {
        const nowDate = new Date();
        points.push({
          timestamp: Math.floor(nowDate.getTime() / 1000),
          value: runningBalance,
          pnl: 0,
          date: nowDate.toLocaleDateString(),
          time: nowDate.toLocaleTimeString(),
        });
      }

      points.sort((a, b) => a.timestamp - b.timestamp);

      const firstValue = points[0]?.value || runningBalance;
      const lastValue = points[points.length - 1]?.value || runningBalance;
      const totalChange = lastValue - firstValue;
      const totalChangePercent =
        firstValue > 0 ? (totalChange / firstValue) * 100 : 0;

      const values = points.map((p) => p.value);
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);

      setData({
        points,
        totalChange,
        totalChangePercent,
        minValue,
        maxValue,
      });
    } catch (err) {
      console.error("Error fetching portfolio data:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      // Set fallback data so UI still renders
      const now = new Date();
      setData({
        points: [
          {
            timestamp: Math.floor(now.getTime() / 1000),
            value: 0,
            pnl: 0,
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString(),
          },
        ],
        totalChange: 0,
        totalChangePercent: 0,
        minValue: 0,
        maxValue: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, timeFilter]);

  useEffect(() => {
    fetchPortfolioData();
  }, [fetchPortfolioData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchPortfolioData,
  };
}

// =============================================================================
// ORDER HISTORY HOOK (API-based)
// =============================================================================

interface ProcessedOrder {
  id: string;
  orderId: string;
  orderType: string;
  market: string;
  side: "Long" | "Short";
  size: number;
  margin: number;
  leverage: number;
  price: number;
  pnl?: number | undefined;
  fee: number;
  status: "Active" | "Cancelled" | "Executed" | "Liquidated";
  isReduceOnly: boolean;
}

export function useOrderHistory(limit: number = 50) {
  const { address, isConnected } = useAccount();
  const [orders, setOrders] = useState<ProcessedOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!address || !isConnected) {
      setOrders([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.getUserOrderHistory({ limit });
      const apiOrders = response.orders || [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const processedOrders: ProcessedOrder[] = apiOrders.map((order: any) => ({
        id: order.id || order.order_id,
        orderId: order.order_id || order.id,
        orderType: order.type || "Market",
        market: order.symbol || order.market,
        side: order.side === "buy" || order.side === "long" ? "Long" : "Short",
        size: parseFloat(order.amount || order.size || "0"),
        margin: parseFloat(order.margin || "0"),
        leverage: parseFloat(order.leverage || "1"),
        price: parseFloat(order.price || "0"),
        pnl: order.pnl ? parseFloat(order.pnl) : undefined,
        fee: parseFloat(order.fee || "0"),
        status:
          ((order.status?.charAt(0).toUpperCase() +
            order.status?.slice(1)) as ProcessedOrder["status"]) || "Executed",
        isReduceOnly: order.is_reduce_only || false,
      }));

      setOrders(processedOrders);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, limit]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    isLoading,
    error,
    refetch: fetchOrders,
  };
}

// =============================================================================
// TRANSACTION HISTORY HOOK (API-based)
// =============================================================================

interface ProcessedTransaction {
  id: string;
  time: string;
  pair: string;
  side: "Long" | "Short";
  leverage: number;
  price: number;
  amount: number;
  total: number;
  initialMargin?: number | undefined;
  markPrice?: number | undefined;
  liquidPrice?: number | undefined;
  fee: number;
  pnl?: number | undefined;
  pnlPercentage?: number | undefined;
  type: string;
  txHash: string;
  orderId: string;
  orderType: number;
  market: string;
  isLong: boolean;
  size: number;
  margin: number;
  positionMargin?: number | undefined;
  positionSize?: number | undefined;
  positionPrice?: number | undefined;
  liquidationPrice?: number | undefined;
  liquidatorFee?: number | undefined;
  keeperFee?: number | undefined;
  fundingFee?: number | undefined;
  isReduceOnly: boolean;
  status: string;
  timestamp: number;
  blockNumber: number;
}

export function useTransactionHistory(limit: number = 50) {
  const { address, isConnected } = useAccount();
  const [transactions, setTransactions] = useState<ProcessedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!address || !isConnected) {
      setTransactions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.getUserTransactions({ limit });
      const apiTransactions = response.transactions || [];

      const processedTransactions: ProcessedTransaction[] = apiTransactions.map(
        (tx) => {
          const timestamp = Math.floor(
            new Date(tx.created_at).getTime() / 1000
          );
          const amount = parseFloat(tx.amount || "0");
          const fee = parseFloat(tx.fee || "0");
          const price = parseFloat(tx.price || "0");
          const margin = parseFloat(tx.margin || "0");
          const leverage = margin > 0 ? amount / margin : 1;
          const pnl = tx.pnl ? parseFloat(tx.pnl) : undefined;
          const pnlPercentage =
            pnl && margin > 0 ? (pnl / margin) * 100 : undefined;

          return {
            id: tx.id,
            time: new Date(timestamp * 1000).toLocaleString(),
            pair: tx.asset_symbol || tx.market || "UNKNOWN",
            side: tx.tx_type?.includes("buy") || tx.is_long ? "Long" : "Short",
            leverage,
            price,
            amount,
            total: amount,
            initialMargin: margin,
            markPrice: price,
            liquidPrice: tx.liquidation_price
              ? parseFloat(tx.liquidation_price)
              : undefined,
            fee,
            pnl,
            pnlPercentage,
            type: tx.tx_type || "Trade",
            txHash: tx.reference_id || "",
            orderId: tx.order_id || tx.id,
            orderType: tx.order_type || 0,
            market: tx.asset_symbol || tx.market || "UNKNOWN",
            isLong: tx.tx_type?.includes("buy") || tx.is_long || false,
            size: amount,
            margin,
            positionMargin: tx.position_margin
              ? parseFloat(tx.position_margin)
              : undefined,
            positionSize: tx.position_size
              ? parseFloat(tx.position_size)
              : undefined,
            positionPrice: tx.position_price
              ? parseFloat(tx.position_price)
              : undefined,
            liquidationPrice: tx.liquidation_price
              ? parseFloat(tx.liquidation_price)
              : undefined,
            liquidatorFee: tx.liquidator_fee
              ? parseFloat(tx.liquidator_fee)
              : undefined,
            keeperFee: tx.keeper_fee ? parseFloat(tx.keeper_fee) : undefined,
            fundingFee: tx.funding_fee ? parseFloat(tx.funding_fee) : undefined,
            isReduceOnly: tx.is_reduce_only || false,
            status: tx.status || "Executed",
            timestamp,
            blockNumber: tx.block_number || 0,
          };
        }
      );

      setTransactions(processedTransactions);
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      // Set empty array so UI still renders
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, limit]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    isLoading,
    error,
    refetch: fetchTransactions,
  };
}

// =============================================================================
// BACKEND MARKET DATA HOOKS
// =============================================================================

export interface BackendTickerData {
  symbol: string;
  lastPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  priceChange: number;
  priceChangePercent: number;
  trades: number;
}

export interface FundingRateData {
  symbol: string;
  fundingRate: number;
  markPrice: number;
  indexPrice: number;
  nextFundingTime: string;
  timestamp: string;
}

export interface OpenInterestData {
  symbol: string;
  openInterest: number;
  longOpenInterest: number;
  shortOpenInterest: number;
  totalPositions: number;
  timestamp: string;
}

/**
 * Hook for fetching 24h ticker data from the backend API
 * Polls at a configurable interval (default 5s)
 */
export function useBackendTicker(symbol: string, pollInterval = 5000) {
  const [ticker, setTicker] = useState<BackendTickerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTicker = useCallback(async () => {
    if (!symbol) return;
    try {
      const data = await apiClient.getMarketTicker(symbol);
      setTicker({
        symbol: data.symbol,
        lastPrice: parseFloat(data.lastPrice),
        highPrice: parseFloat(data.highPrice),
        lowPrice: parseFloat(data.lowPrice),
        volume: parseFloat(data.volume),
        quoteVolume: parseFloat(data.quoteVolume),
        priceChange: parseFloat(data.priceChange),
        priceChangePercent: parseFloat(data.priceChangePercent),
        trades: data.trades,
      });
      setError(null);
    } catch (err) {
      console.error("Error fetching backend ticker:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch ticker");
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchTicker();
    const interval = setInterval(fetchTicker, pollInterval);
    return () => clearInterval(interval);
  }, [fetchTicker, pollInterval]);

  return { ticker, isLoading, error, refetch: fetchTicker };
}

/**
 * Hook for fetching funding rate data from the backend API
 */
export function useFundingRate(symbol: string, pollInterval = 10000) {
  const [fundingRate, setFundingRate] = useState<FundingRateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFundingRate = useCallback(async () => {
    if (!symbol) return;
    try {
      const data = await apiClient.getFundingRate(symbol);
      setFundingRate(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching funding rate:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch funding rate"
      );
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchFundingRate();
    const interval = setInterval(fetchFundingRate, pollInterval);
    return () => clearInterval(interval);
  }, [fetchFundingRate, pollInterval]);

  return { fundingRate, isLoading, error, refetch: fetchFundingRate };
}

/**
 * Hook for fetching open interest from the backend API
 */
export function useOpenInterest(symbol: string, pollInterval = 15000) {
  const [openInterest, setOpenInterest] = useState<OpenInterestData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOpenInterest = useCallback(async () => {
    if (!symbol) return;
    try {
      const data = await apiClient.getOpenInterest(symbol);
      setOpenInterest(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching open interest:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch open interest"
      );
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchOpenInterest();
    const interval = setInterval(fetchOpenInterest, pollInterval);
    return () => clearInterval(interval);
  }, [fetchOpenInterest, pollInterval]);

  return { openInterest, isLoading, error, refetch: fetchOpenInterest };
}

/**
 * Hook that fetches orderbook depth from the backend API
 */
export function useBackendOrderBook(
  symbol: string,
  limit = 10,
  pollInterval = 3000
) {
  const [orderBook, setOrderBook] = useState<{
    bids: [number, number, number][];
    asks: [number, number, number][];
  }>({ bids: [], asks: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderBook = useCallback(async () => {
    if (!symbol) return;
    try {
      const data = await apiClient.getMarketDepth(symbol, limit);
      setOrderBook({ bids: data.bids, asks: data.asks });
      setError(null);
    } catch (err) {
      console.error("Error fetching orderbook:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch orderbook"
      );
    } finally {
      setIsLoading(false);
    }
  }, [symbol, limit]);

  useEffect(() => {
    fetchOrderBook();
    const interval = setInterval(fetchOrderBook, pollInterval);
    return () => clearInterval(interval);
  }, [fetchOrderBook, pollInterval]);

  return { orderBook, isLoading, error, refetch: fetchOrderBook };
}

/**
 * Hook that fetches recent trades from the backend API
 */
export function useBackendTrades(
  symbol: string,
  limit = 50,
  pollInterval = 5000
) {
  const [trades, setTrades] = useState<
    Array<{
      id: string;
      symbol: string;
      price: number;
      quantity: number;
      side: string;
      timestamp: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    if (!symbol) return;
    try {
      const data = await apiClient.getMarketTrades(symbol, limit);
      setTrades(data.trades);
      setError(null);
    } catch (err) {
      console.error("Error fetching trades:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch trades");
    } finally {
      setIsLoading(false);
    }
  }, [symbol, limit]);

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, pollInterval);
    return () => clearInterval(interval);
  }, [fetchTrades, pollInterval]);

  return { trades, isLoading, error, refetch: fetchTrades };
}
