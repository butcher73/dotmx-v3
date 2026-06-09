"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  usePerpSymbols,
  useBackendTicker,
  useFundingRate,
  useOpenInterest,
  type PerpSymbol,
  type BackendTickerData,
  type FundingRateData,
  type OpenInterestData,
} from "@/hooks";
import {
  getMarketDataWs,
  type MarketDataTickerUpdate,
} from "@/services/websocket/MarketDataWebSocketService";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Unified market statistics consumed by the whole trade page */
export interface MarketStats {
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: string;
  total24h: string;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  nextFundingTime: string;
  openInterest: number;
  longOpenInterest: number;
  shortOpenInterest: number;
}

/** Real-time WebSocket state exposed to consumers */
export interface WsConnectionState {
  isConnected: boolean;
  ticker: MarketDataTickerUpdate | null;
}

/** Actions exposed to consumers */
export interface WsConnectionActions {
  reconnect: () => Promise<void>;
  disconnect: () => void;
  updateSymbol: (symbol: string) => void;
}

export interface TradePairContextValue {
  // ── Pair selection ────────────────────────────────────────────────────
  /** Currently active trading pair */
  currentPair: PerpSymbol;
  /** All available trading pairs from the backend API */
  pairs: PerpSymbol[];
  /** True while the pair list is loading from API */
  isPairsLoading: boolean;
  /** Error loading pairs from API */
  pairsError: Error | null;
  /** Navigate to a different trading pair */
  selectPair: (pair: PerpSymbol) => void;
  /** Reload pair list from API */
  refreshPairs: () => void;
  /** Search / filter pairs */
  searchPairs: (query: string) => PerpSymbol[];

  // ── Market data ───────────────────────────────────────────────────────
  /** Aggregated market statistics (WS + backend) */
  market: MarketStats;
  /** Backend ticker data (polled) */
  backendTicker: BackendTickerData | null;
  /** Funding rate data from backend */
  fundingRateData: FundingRateData | null;
  /** Open interest data from backend */
  openInterestData: OpenInterestData | null;

  // ── WebSocket connection ──────────────────────────────────────────────
  wsState: WsConnectionState;
  wsActions: WsConnectionActions;
}

// Default empty context — never used at runtime
const TradePairContext = createContext<TradePairContextValue | null>(null);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const safeNumber = (value: unknown): number => {
  if (typeof value === "number" && !isNaN(value) && isFinite(value))
    return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return !isNaN(parsed) && isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const EMPTY_MARKET: MarketStats = {
  currentPrice: 0,
  priceChange: 0,
  priceChangePercent: 0,
  high24h: 0,
  low24h: 0,
  volume24h: "0",
  total24h: "0",
  markPrice: 0,
  indexPrice: 0,
  fundingRate: 0,
  nextFundingTime: "",
  openInterest: 0,
  longOpenInterest: 0,
  shortOpenInterest: 0,
};

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

interface TradePairProviderProps {
  children: ReactNode;
}

export function TradePairProvider({ children }: TradePairProviderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Resolve the symbol from the URL ──────────────────────────────────
  const symbolParam = searchParams.get("symbol") || "BTCUSDT";

  // ── Pair list from backend API ('/api/symbols') ──────────────────────
  const {
    currentSymbol: currentPair,
    symbols: pairs,
    isLoading: isPairsLoading,
    error: pairsError,
    refetch: refreshPairs,
    searchSymbols: searchPairs,
    setCurrentSymbol: setCurrentPair,
  } = usePerpSymbols(symbolParam);

  // ── Backend market data (polled) ─────────────────────────────────────
  const { ticker: backendTicker } = useBackendTicker(currentPair.symbol, 5000);
  const { fundingRate: fundingRateData } = useFundingRate(
    currentPair.symbol,
    10000
  );
  const { openInterest: openInterestData } = useOpenInterest(
    currentPair.symbol,
    15000
  );

  // ── MarketData WebSocket (real-time prices via our own server) ───────
  const [wsConnected, setWsConnected] = useState(false);
  const [wsTicker, setWsTicker] = useState<MarketDataTickerUpdate | null>(null);
  const unsubRef = useRef<Array<() => void>>([]);
  const lastValidTickerRef = useRef<MarketDataTickerUpdate | null>(null);

  // Subscribe to our marketdata WS for the current pair
  useEffect(() => {
    const ws = getMarketDataWs({ enableLogging: false });
    const symbol = currentPair.bitgetSymbol;

    // Clean up previous subscriptions
    unsubRef.current.forEach((fn) => fn());
    unsubRef.current = [];

    // Connection state
    const unsubConn = ws.onConnection((connected) => {
      setWsConnected(connected);
    });
    unsubRef.current.push(unsubConn);

    // Ticker subscription
    const unsubTicker = ws.subscribeTicker(symbol, (ticker) => {
      setWsTicker(ticker);
      lastValidTickerRef.current = ticker;
    });
    unsubRef.current.push(unsubTicker);

    // Connect if needed
    if (!ws.isConnected()) {
      ws.connect().catch((err) => {
        console.error("[TradePairContext] WS connect error:", err);
      });
    }

    return () => {
      unsubRef.current.forEach((fn) => fn());
      unsubRef.current = [];
    };
  }, [currentPair.bitgetSymbol]);

  // ── Pair selection handler → updates URL ─────────────────────────────
  const selectPair = useCallback(
    (pair: PerpSymbol) => {
      setCurrentPair(pair);
      router.push(`/trade/perp?symbol=${pair.bitgetSymbol}`);
    },
    [router, setCurrentPair]
  );

  // ── WS state & actions ──────────────────────────────────────────────
  const wsState: WsConnectionState = useMemo(
    () => ({
      isConnected: wsConnected,
      ticker: wsTicker,
    }),
    [wsConnected, wsTicker]
  );

  const wsActions: WsConnectionActions = useMemo(
    () => ({
      reconnect: async () => {
        const ws = getMarketDataWs();
        ws.disconnect();
        await ws.connect();
      },
      disconnect: () => {
        const ws = getMarketDataWs();
        ws.disconnect();
      },
      updateSymbol: (symbol: string) => {
        const ws = getMarketDataWs();
        ws.updateSymbol(currentPair.bitgetSymbol, symbol);
      },
    }),
    [currentPair.bitgetSymbol]
  );

  // ── Aggregated market data ───────────────────────────────────────────
  const market = useMemo((): MarketStats => {
    const activeTicker = wsTicker || lastValidTickerRef.current;

    // Prefer real-time WS data from our marketdata server
    if (activeTicker) {
      const price = safeNumber(activeTicker.lastPr);
      const open24h = safeNumber(activeTicker.open24h);
      const priceChange = price - open24h;
      const priceChangePercent =
        open24h > 0
          ? (priceChange / open24h) * 100
          : safeNumber(activeTicker.change24h);

      return {
        currentPrice: price,
        priceChange,
        priceChangePercent,
        high24h: safeNumber(activeTicker.high24h),
        low24h: safeNumber(activeTicker.low24h),
        volume24h: safeNumber(activeTicker.baseVolume).toLocaleString(),
        total24h: safeNumber(activeTicker.quoteVolume).toLocaleString(),
        markPrice:
          fundingRateData?.markPrice ??
          (safeNumber(activeTicker.markPrice) || price),
        indexPrice:
          fundingRateData?.indexPrice ??
          (safeNumber(activeTicker.indexPrice) || 0),
        fundingRate:
          fundingRateData?.fundingRate ??
          (safeNumber(activeTicker.fundingRate) || 0),
        nextFundingTime:
          fundingRateData?.nextFundingTime ??
          activeTicker.nextFundingTime ??
          "",
        openInterest: openInterestData?.openInterest ?? 0,
        longOpenInterest: openInterestData?.longOpenInterest ?? 0,
        shortOpenInterest: openInterestData?.shortOpenInterest ?? 0,
      };
    }

    // Fallback to backend ticker when WS unavailable
    if (backendTicker) {
      return {
        currentPrice: backendTicker.lastPrice,
        priceChange: backendTicker.priceChange,
        priceChangePercent: backendTicker.priceChangePercent,
        high24h: backendTicker.highPrice,
        low24h: backendTicker.lowPrice,
        volume24h: backendTicker.volume.toLocaleString(),
        total24h: backendTicker.quoteVolume.toLocaleString(),
        markPrice: fundingRateData?.markPrice ?? backendTicker.lastPrice,
        indexPrice: fundingRateData?.indexPrice ?? 0,
        fundingRate: fundingRateData?.fundingRate ?? 0,
        nextFundingTime: fundingRateData?.nextFundingTime ?? "",
        openInterest: openInterestData?.openInterest ?? 0,
        longOpenInterest: openInterestData?.longOpenInterest ?? 0,
        shortOpenInterest: openInterestData?.shortOpenInterest ?? 0,
      };
    }

    return EMPTY_MARKET;
  }, [wsTicker, backendTicker, fundingRateData, openInterestData]);

  // ── Build context value ──────────────────────────────────────────────
  const value = useMemo<TradePairContextValue>(
    () => ({
      currentPair,
      pairs,
      isPairsLoading,
      pairsError,
      selectPair,
      refreshPairs,
      searchPairs,
      market,
      backendTicker,
      fundingRateData,
      openInterestData,
      wsState,
      wsActions,
    }),
    [
      currentPair,
      pairs,
      isPairsLoading,
      pairsError,
      selectPair,
      refreshPairs,
      searchPairs,
      market,
      backendTicker,
      fundingRateData,
      openInterestData,
      wsState,
      wsActions,
    ]
  );

  return (
    <TradePairContext.Provider value={value}>
      {children}
    </TradePairContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useTradePair(): TradePairContextValue {
  const ctx = useContext(TradePairContext);
  if (!ctx) {
    throw new Error("useTradePair must be used within a <TradePairProvider>");
  }
  return ctx;
}
