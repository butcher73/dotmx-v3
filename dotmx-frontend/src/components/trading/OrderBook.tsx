import React, {
  useState,
  useLayoutEffect,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import {
  getMarketDataWs,
  type MarketDataOrderbookUpdate,
  type MarketDataTradeUpdate,
  type MarketDataTickerUpdate,
} from "@/services/websocket/MarketDataWebSocketService";
import { processOrderBook, formatQuantity } from "@/utils/bitgetDataProcessor";
import {
  getPriceGroupingConfig,
  formatGroupedPrice,
} from "@/utils/priceGrouping";
import { getPerpConfig } from "@/config";

const MARKETDATA_API_URL =
  process.env.NEXT_PUBLIC_MARKETDATA_URL || "http://localhost:8080/marketdata";

interface MarketTrade {
  id: string;
  price: number;
  amount: number;
  total: number;
  side: "buy" | "sell";
  timestamp: Date;
}

interface OrderBookProps {
  symbol: string;
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
}

export default function OrderBook({ symbol }: OrderBookProps) {
  const [activeTab, setActiveTab] = useState<"orderbook" | "trades">(
    "orderbook"
  );
  const [groupSizeIndex, setGroupSizeIndex] = useState(0);
  const [marketTrades, setMarketTrades] = useState<MarketTrade[]>([]);
  const [maxRows, setMaxRows] = useState({ orderBook: 50, trades: 20 });

  // WS state
  const [isConnected, setIsConnected] = useState(false);
  const [orderBookData, setOrderBookData] = useState<{
    bids: [string, string][];
    asks: [string, string][];
  }>({ bids: [], asks: [] });
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChangePercent, setPriceChangePercent] = useState(0);
  const [previousPrice, setPreviousPrice] = useState(0);
  const [priceDirection, setPriceDirection] = useState<"up" | "down" | "same">(
    "same"
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const tradeIdRef = useRef(0);

  // Get perp configuration
  const pairConfig = getPerpConfig(symbol);

  // ── MarketData WebSocket subscriptions ──────────────────────────────
  useEffect(() => {
    const ws = getMarketDataWs({ enableLogging: false });
    const unsubs: Array<() => void> = [];

    // Connection state
    const unsubConn = ws.onConnection((connected) => {
      setIsConnected(connected);
    });
    unsubs.push(unsubConn);

    // Orderbook
    const unsubOB = ws.subscribeOrderbook(
      symbol,
      (data: MarketDataOrderbookUpdate) => {
        setOrderBookData({ bids: data.bids, asks: data.asks });
      }
    );
    unsubs.push(unsubOB);

    // Trades
    const unsubTrade = ws.subscribeTrade(
      symbol,
      (data: MarketDataTradeUpdate) => {
        const trade: MarketTrade = {
          id: data.tradeId || `t-${++tradeIdRef.current}`,
          price: parseFloat(data.price),
          amount: parseFloat(data.size),
          total: parseFloat(data.price) * parseFloat(data.size),
          side: data.side,
          timestamp: new Date(parseInt(data.ts) || Date.now()),
        };
        setMarketTrades((prev) => [trade, ...prev].slice(0, 100));
      }
    );
    unsubs.push(unsubTrade);

    // Ticker (for price display)
    const unsubTicker = ws.subscribeTicker(
      symbol,
      (data: MarketDataTickerUpdate) => {
        const price = parseFloat(data.lastPr);
        if (price && !isNaN(price)) {
          setCurrentPrice((prev) => {
            if (prev !== price) {
              setPreviousPrice(prev);
              setPriceDirection(
                price > prev ? "up" : price < prev ? "down" : "same"
              );
            }
            return price;
          });
          const change = parseFloat(data.change24h);
          if (!isNaN(change)) setPriceChangePercent(change);
        }
      }
    );
    unsubs.push(unsubTicker);

    // Connect if not already connected
    if (!ws.isConnected()) {
      ws.connect().catch((err) => {
        console.error("[OrderBook] WS connect error:", err);
      });
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [symbol]);

  // ── REST polling for deep orderbook data ────────────────────────────
  // WS books15 only sends 15 levels. REST gives us 100+ levels for a
  // proper orderbook display. Poll every 2s for depth data.
  const wsHasTicker = useRef(false);

  useEffect(() => {
    wsHasTicker.current = currentPrice > 0;
  }, [currentPrice]);

  const fetchOrderbookRest = useCallback(async () => {
    try {
      // Always fetch deep orderbook via REST (100 levels)
      const obRes = await fetch(
        `${MARKETDATA_API_URL}/orderbook/${symbol}?depth=100`
      );
      if (obRes.ok) {
        const obData = await obRes.json();
        if (obData.bids?.length || obData.asks?.length) {
          setOrderBookData({
            bids: obData.bids.map((b: [number, number]) => [
              b[0].toString(),
              b[1].toString(),
            ]),
            asks: obData.asks.map((a: [number, number]) => [
              a[0].toString(),
              a[1].toString(),
            ]),
          });
        }
      }

      // Ticker fallback (only when WS hasn't provided one)
      if (!wsHasTicker.current) {
        const tickerRes = await fetch(
          `${MARKETDATA_API_URL}/v1/market/ticker/24hr?symbol=${symbol}`
        );
        if (tickerRes.ok) {
          const t = await tickerRes.json();
          const price = parseFloat(t.lastPrice);
          if (price && !isNaN(price)) {
            setCurrentPrice(price);
            const change = parseFloat(t.priceChangePercent);
            if (!isNaN(change)) setPriceChangePercent(change);
          }
        }
      }
    } catch {
      // REST errors are non-critical
    }
  }, [symbol]);

  useEffect(() => {
    // Fetch immediately on mount
    fetchOrderbookRest();

    // Poll every 2s for fresh orderbook depth
    const interval = setInterval(fetchOrderbookRest, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchOrderbookRest]);

  // Calculate available space and determine max rows
  useLayoutEffect(() => {
    const calculateMaxRows = () => {
      if (!containerRef.current) return;

      const containerHeight = containerRef.current.clientHeight;
      const headerHeight = headerRef.current?.clientHeight || 0;

      if (activeTab === "orderbook") {
        const priceDisplayHeight = 36; // Compact price display
        const footerHeight = 26; // Compact footer
        const tableHeaderHeight = 22; // Compact table header
        const spreadIndicatorHeight = 22; // Spread indicator between asks/bids

        // Available height for order book content
        const availableHeight =
          containerHeight -
          headerHeight -
          priceDisplayHeight -
          footerHeight -
          tableHeaderHeight -
          spreadIndicatorHeight;

        // Row height for order book - ultra compact
        const rowHeight = 18; // Very tight spacing for maximum density

        // Calculate rows per side (asks and bids each get half)
        const totalOrderBookRows = Math.floor(availableHeight / rowHeight);
        const rowsPerSide = Math.max(
          10,
          Math.min(50, Math.floor(totalOrderBookRows / 2))
        ); // Increased cap from 15 to 50 for more orders

        setMaxRows((prev) => ({ ...prev, orderBook: rowsPerSide }));
      } else {
        const footerHeight = 26; // Compact footer for trades
        const tableHeaderHeight = 28; // Slightly taller header for trades

        // Available height for trades content
        const availableHeight =
          containerHeight - headerHeight - footerHeight - tableHeaderHeight;

        // Row height for trades
        const rowHeight = 18; // Same compact spacing as order book

        // Calculate max trade rows to fill available space
        const maxTradeRows = Math.max(
          5,
          Math.min(25, Math.floor(availableHeight / rowHeight))
        ); // Dynamic cap

        setMaxRows((prev) => ({ ...prev, trades: maxTradeRows }));
      }
    };

    calculateMaxRows();

    // Recalculate on window resize
    const handleResize = () => {
      setTimeout(calculateMaxRows, 100);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeTab]);

  // Get price grouping configuration based on current price and symbol
  const groupingConfig = useMemo(() => {
    return getPriceGroupingConfig(currentPrice);
  }, [currentPrice]);

  // Get current group size
  const currentGroupSize =
    groupingConfig.groupSizes[groupSizeIndex] || groupingConfig.defaultGroup;

  // Process order book data using utility functions with price grouping
  const processedOrderBook = useMemo(() => {
    if (
      !orderBookData ||
      !orderBookData.bids.length ||
      !orderBookData.asks.length
    ) {
      // Return empty data if no WebSocket data available
      return {
        bids: [],
        asks: [],
        spread: 0,
        spreadPercentage: 0,
      };
    }

    // Convert the format to match what processOrderBook expects
    return processOrderBook(
      orderBookData.bids,
      orderBookData.asks,
      100, // Use a fixed higher limit to show more levels regardless of display space
      currentPrice,
      symbol,
      currentGroupSize
    );
  }, [orderBookData, currentPrice, symbol, currentGroupSize]);

  // Show loading state only when we have no data from ANY source (WS or REST)
  const isLoadingData =
    processedOrderBook.bids.length === 0 &&
    processedOrderBook.asks.length === 0;

  // Extract order data for rendering
  const sellOrders = processedOrderBook.asks;
  const buyOrders = processedOrderBook.bids;

  const formatOrderPrice = (price: number) => {
    return formatGroupedPrice(price, groupingConfig);
  };

  const formatOrderAmount = (amount: number) => {
    return formatQuantity(amount, 3);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <>
      <style jsx>{`
        .order-row {
          transition: background 3.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          will-change: background;
          backface-visibility: hidden;
        }

        .price-cell {
          transition:
            color 0.8s ease-out,
            font-weight 0.8s ease-out;
          will-change: color, font-weight;
        }

        .amount-cell {
          transition: color 0.8s ease-out;
          will-change: color;
        }

        .current-price {
          transition: color 1.2s ease-out;
          will-change: color;
        }

        .tab-button {
          transition: all 0.4s ease-out;
          will-change: transform, color;
        }

        .tab-indicator {
          transition: opacity 0.6s ease-out;
          will-change: opacity;
        }
      `}</style>
      <div
        ref={containerRef}
        className="border-border bg-background-card flex h-full flex-col border-r"
      >
        {/* Header with Tabs */}
        <div
          ref={headerRef}
          className="border-border bg-background-elevated flex items-center justify-between border-b px-3 py-1.5"
        >
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab("orderbook")}
              className={`tab-button relative px-1 py-1 text-[11px] font-medium ${
                activeTab === "orderbook"
                  ? "text-accent"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              Order Book
              {activeTab === "orderbook" && (
                <div className="tab-indicator bg-accent absolute right-0 -bottom-1.5 left-0 h-0.5" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("trades")}
              className={`tab-button relative px-1 py-1 text-[11px] font-medium ${
                activeTab === "trades"
                  ? "text-accent"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              Recent Trades
              {activeTab === "trades" && (
                <div className="tab-indicator bg-accent absolute right-0 -bottom-1.5 left-0 h-0.5" />
              )}
            </button>
          </div>

          {activeTab === "orderbook" && (
            <div className="flex items-center space-x-1.5">
              <select
                value={groupSizeIndex}
                onChange={(e) => setGroupSizeIndex(Number(e.target.value))}
                className="tab-button border-border bg-background text-foreground-muted focus:border-accent min-w-[45px] rounded border px-1.5 py-0.5 text-[10px] focus:outline-none"
              >
                {groupingConfig.groupSizes.map((size, index) => (
                  <option key={index} value={index}>
                    {size >= 1 ? size.toString() : size.toFixed(5)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {activeTab === "orderbook" ? (
          <>
            {/* Order Book Table */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Sell Orders (Asks) */}
              {/* Sell Orders (Asks) */}
              <div className="flex-1 overflow-y-auto">
                <table className="h-full w-full">
                  <thead className="border-border bg-background-elevated sticky top-0 z-10 border-b">
                    <tr className="text-foreground-muted">
                      <th className="w-[45%] px-2 py-0.5 text-left text-[9px] font-normal tracking-wider uppercase">
                        Price({pairConfig.displayCollateral})
                      </th>
                      <th className="w-[27%] px-2 py-0.5 text-right text-[9px] font-normal tracking-wider uppercase">
                        Amount({pairConfig.asset})
                      </th>
                      <th className="w-[28%] px-2 py-0.5 text-right text-[9px] font-normal tracking-wider uppercase">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingData ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="py-8 text-center text-[10px] text-[#6B8DC7]"
                        >
                          <div className="flex items-center justify-center space-x-2">
                            <div className="h-2 w-2 animate-pulse rounded-full bg-[#4F90FF]"></div>
                            <span>Loading orderbook data...</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      sellOrders
                        .slice(0, maxRows.orderBook)
                        .reverse()
                        .map((order) => (
                          <tr
                            key={`ask-${order.price}`}
                            className="group order-row border-border/20 hover:bg-negative/5 relative cursor-pointer border-b"
                            style={{
                              background: `linear-gradient(to right, rgba(255, 107, 107, 0.08) 0%, rgba(255, 107, 107, 0.08) ${order.percentage}%, transparent ${order.percentage}%, transparent 100%)`,
                            }}
                          >
                            <td className="price-cell text-negative group-hover:text-negative/90 relative z-10 w-[45%] px-2 py-0.5 font-mono text-[10px] leading-none font-medium">
                              {formatOrderPrice(order.price)}
                            </td>
                            <td className="amount-cell text-foreground group-hover:text-foreground relative z-10 w-[27%] px-2 py-0.5 text-right font-mono text-[10px] leading-none">
                              {formatOrderAmount(order.amount)}
                            </td>
                            <td className="amount-cell text-foreground-muted group-hover:text-foreground-subtle relative z-10 w-[28%] px-2 py-0.5 text-right font-mono text-[10px] leading-none">
                              {formatOrderAmount(order.total)}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Current Price Display - Middle Position with Color Coding */}
              <div className="border-border bg-background shrink-0 border-y px-3 py-1.5">
                <div className="flex items-center justify-between">
                  <div
                    className={`current-price font-mono text-sm leading-tight font-bold ${
                      priceDirection === "up"
                        ? "text-positive"
                        : priceDirection === "down"
                          ? "text-negative"
                          : "text-foreground"
                    }`}
                  >
                    ${formatGroupedPrice(currentPrice, groupingConfig)}
                  </div>
                  <div className="flex items-center space-x-2">
                    <div
                      className={`current-price text-[10px] font-medium ${
                        priceChangePercent >= 0
                          ? "text-positive"
                          : "text-negative"
                      }`}
                    >
                      {priceChangePercent >= 0 ? "+" : ""}
                      {priceChangePercent.toFixed(2)}%
                    </div>
                    <div
                      className={`current-price text-[9px] ${
                        priceDirection === "up"
                          ? "text-green-500"
                          : priceDirection === "down"
                            ? "text-red-500"
                            : "text-[#848e9c]"
                      }`}
                    >
                      {priceDirection === "up"
                        ? "↗"
                        : priceDirection === "down"
                          ? "↘"
                          : "→"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Buy Orders (Bids) */}
              <div className="flex-1 overflow-y-auto">
                <table className="h-full w-full">
                  <tbody>
                    {isLoadingData ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="text-foreground-muted py-8 text-center text-[10px]"
                        >
                          <div className="flex items-center justify-center space-x-2">
                            <div className="bg-accent h-2 w-2 animate-pulse rounded-full"></div>
                            <span>Loading orderbook data...</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      buyOrders.slice(0, maxRows.orderBook).map((order) => (
                        <tr
                          key={`bid-${order.price}`}
                          className="group order-row border-border/20 hover:bg-positive/5 relative cursor-pointer border-b"
                          style={{
                            background: `linear-gradient(to right, rgba(0, 216, 151, 0.08) 0%, rgba(0, 216, 151, 0.08) ${order.percentage}%, transparent ${order.percentage}%, transparent 100%)`,
                          }}
                        >
                          <td className="price-cell text-positive group-hover:text-positive/90 relative z-10 w-[45%] px-2 py-0.5 font-mono text-[10px] leading-none font-medium">
                            {formatOrderPrice(order.price)}
                          </td>
                          <td className="amount-cell text-foreground group-hover:text-foreground relative z-10 w-[27%] px-2 py-0.5 text-right font-mono text-[10px] leading-none">
                            {formatOrderAmount(order.amount)}
                          </td>
                          <td className="amount-cell text-foreground-muted group-hover:text-foreground-subtle relative z-10 w-[28%] px-2 py-0.5 text-right font-mono text-[10px] leading-none">
                            {formatOrderAmount(order.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Order Book Footer - Compact */}
            <div className="border-border bg-background-elevated shrink-0 border-t px-3 py-0.5">
              <div className="flex items-center justify-between text-[9px]">
                <div className="flex items-center space-x-3">
                  <span className="text-positive">{buyOrders.length} bids</span>
                  <span className="text-negative">
                    {sellOrders.length} asks
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <div
                    className={`h-1 w-1 rounded-full ${
                      isConnected ? "bg-accent animate-pulse" : "bg-negative"
                    }`}
                  ></div>
                  <span className="text-foreground-muted">
                    {isConnected ? "Live" : "Connecting..."}
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Market Trades Table */}
            <div className="flex-1 overflow-hidden">
              <table className="h-full w-full">
                <thead className="border-border bg-background sticky top-0 z-10 border-b">
                  <tr className="text-foreground-muted">
                    <th className="w-[45%] px-2 py-1 text-left text-[9px] font-normal tracking-wider uppercase">
                      Price({pairConfig.displayCollateral})
                    </th>
                    <th className="w-[27%] px-2 py-1 text-right text-[9px] font-normal tracking-wider uppercase">
                      Qty({pairConfig.asset})
                    </th>
                    <th className="w-[28%] px-2 py-1 text-right text-[9px] font-normal tracking-wider uppercase">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {marketTrades.map((trade) => (
                    <tr
                      key={trade.id}
                      className="order-row group border-border/10 hover:bg-background-hover border-b"
                    >
                      <td
                        className={`price-cell w-[45%] px-2 py-0.5 font-mono text-[10px] leading-none font-medium ${
                          trade.side === "buy"
                            ? "text-positive"
                            : "text-negative"
                        }`}
                      >
                        {formatOrderPrice(trade.price)}
                      </td>
                      <td className="amount-cell text-foreground group-hover:text-foreground w-[27%] px-2 py-0.5 text-right font-mono text-[10px] leading-none">
                        {formatOrderAmount(trade.amount)}
                      </td>
                      <td className="amount-cell text-foreground-muted w-[28%] px-2 py-0.5 text-right font-mono text-[9px] leading-none">
                        {formatTime(trade.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Market Trades Footer */}
            <div className="border-border bg-background-elevated shrink-0 border-t px-3 py-0.5">
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-foreground-muted">
                  {marketTrades.length} recent
                </span>
                <div className="flex items-center space-x-1">
                  <div
                    className={`h-1 w-1 rounded-full ${
                      isConnected ? "bg-accent animate-pulse" : "bg-negative"
                    }`}
                  ></div>
                  <span className="text-foreground-muted">
                    {isConnected ? "Live" : "Connecting..."}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
