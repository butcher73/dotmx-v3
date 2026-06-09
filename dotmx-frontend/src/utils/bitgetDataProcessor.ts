/**
 * Utility functions for processing Bitget WebSocket data
 */

import { BitgetTradeData } from "@/hooks";
import { groupOrderBookByPrice, getPriceGroupingConfig } from "./priceGrouping";

export interface ProcessedOrderBookEntry {
  price: number;
  amount: number;
  total: number;
  percentage: number;
}

export interface ProcessedOrderBook {
  bids: ProcessedOrderBookEntry[];
  asks: ProcessedOrderBookEntry[];
  spread: number;
  spreadPercentage: number;
}

export interface ProcessedTrade {
  id: string;
  time: string;
  price: number;
  amount: number;
  side: "buy" | "sell";
  total: number;
  timestamp: number;
}

/**
 * Process raw order book data from Bitget WebSocket with price grouping
 */
export function processOrderBook(
  bids: [string, string][],
  asks: [string, string][],
  maxLevels: number = 20,
  currentPrice?: number,
  symbol?: string,
  groupSize?: number
): ProcessedOrderBook {
  // Convert raw data to processed format
  const rawBids = bids.map(([priceStr, quantityStr]) => ({
    price: parseFloat(priceStr),
    amount: parseFloat(quantityStr),
  }));

  const rawAsks = asks.map(([priceStr, quantityStr]) => ({
    price: parseFloat(priceStr),
    amount: parseFloat(quantityStr),
  }));

  // Get grouping configuration
  const groupingConfig = currentPrice
    ? getPriceGroupingConfig(currentPrice)
    : null;

  const effectiveGroupSize = groupSize || groupingConfig?.defaultGroup || 1;

  // Group orders if grouping is enabled and we have a valid group size
  let processedBids: ProcessedOrderBookEntry[];
  let processedAsks: ProcessedOrderBookEntry[];

  if (
    groupingConfig &&
    effectiveGroupSize > 0 &&
    (effectiveGroupSize !== 1 || groupingConfig.precision === 0)
  ) {
    // Use grouping for better visualization
    processedBids = groupOrderBookByPrice(
      rawBids,
      effectiveGroupSize,
      false
    ).slice(0, maxLevels);
    processedAsks = groupOrderBookByPrice(
      rawAsks,
      effectiveGroupSize,
      true
    ).slice(0, maxLevels);
  } else {
    // Use original processing without grouping
    processedBids = rawBids
      .slice(0, maxLevels)
      .map(({ price, amount }) => ({
        price,
        amount,
        total: 0,
        percentage: 0,
      }))
      .sort((a, b) => b.price - a.price);

    processedAsks = rawAsks
      .slice(0, maxLevels)
      .map(({ price, amount }) => ({
        price,
        amount,
        total: 0,
        percentage: 0,
      }))
      .sort((a, b) => a.price - b.price);

    // Calculate cumulative totals and percentages for non-grouped data
    let bidCumulative = 0;
    const maxBidTotal = processedBids.reduce((sum, bid) => sum + bid.amount, 0);

    processedBids.forEach((bid) => {
      bidCumulative += bid.amount;
      bid.total = bidCumulative;
      bid.percentage =
        maxBidTotal > 0 ? (bidCumulative / maxBidTotal) * 100 : 0;
    });

    let askCumulative = 0;
    const maxAskTotal = processedAsks.reduce((sum, ask) => sum + ask.amount, 0);

    processedAsks.forEach((ask) => {
      askCumulative += ask.amount;
      ask.total = askCumulative;
      ask.percentage =
        maxAskTotal > 0 ? (askCumulative / maxAskTotal) * 100 : 0;
    });
  }

  // Calculate spread
  const bestBid = processedBids[0]?.price || 0;
  const bestAsk = processedAsks[0]?.price || 0;
  const spread = bestAsk - bestBid;
  const spreadPercentage = bestBid > 0 ? (spread / bestBid) * 100 : 0;

  return {
    bids: processedBids,
    asks: processedAsks,
    spread,
    spreadPercentage,
  };
}

/**
 * Process raw trade data from Bitget WebSocket
 */
export function processTrades(
  trades: BitgetTradeData[],
  maxTrades: number = 50
): ProcessedTrade[] {
  return trades
    .slice(0, maxTrades)
    .map((trade) => ({
      id: trade.id,
      time: formatTradeTime(trade.timestamp),
      price: trade.price,
      amount: trade.quantity,
      side: trade.isBuyerMaker ? "sell" : ("buy" as "buy" | "sell"), // If buyer is maker, it's a sell order being filled
      total: trade.price * trade.quantity,
      timestamp: trade.timestamp,
    }))
    .sort((a, b) => b.timestamp - a.timestamp); // Most recent first
}

/**
 * Format trade timestamp to HH:MM:SS format
 */
function formatTradeTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Format price with appropriate decimal places
 */
export function formatPrice(price: number, decimals: number = 2): string {
  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format quantity/amount with appropriate decimal places
 */
export function formatQuantity(quantity: number, decimals: number = 5): string {
  return quantity.toFixed(decimals);
}

/**
 * Format total value with appropriate decimal places
 */
export function formatTotal(total: number, decimals: number = 2): string {
  return total.toFixed(decimals);
}

/**
 * Get price precision based on the price value
 */
export function getPricePrecision(price: number): number {
  if (price >= 1000) return 2;
  if (price >= 100) return 3;
  if (price >= 10) return 4;
  if (price >= 1) return 5;
  return 8;
}

/**
 * Get quantity precision based on the asset
 */
export function getQuantityPrecision(asset: string): number {
  // Common cryptocurrency precision mapping
  if (["BTC", "ETH"].includes(asset)) return 5;
  // Medium value cryptos (typically $10-$500)
  if (["ADA", "DOT", "LINK", "UNI"].includes(asset)) return 3;
  // Lower value cryptos and others
  return 2;
}
