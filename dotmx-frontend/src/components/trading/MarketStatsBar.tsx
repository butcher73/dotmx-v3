"use client";

import React, { memo } from "react";
import { useTradePair } from "@/contexts/TradePairContext";
import {
  formatMarketPrice,
  formatChangePercent,
  getPnLColor,
} from "@/utils/formatting";

/**
 * MarketStatsBar — displays aggregated market stats in the header.
 * Reads everything from TradePairContext so it requires zero props.
 */
function MarketStatsBar() {
  const { market } = useTradePair();

  const isPositive = market.priceChangePercent >= 0;

  // Funding countdown
  const formatFundingCountdown = (nextTime?: string) => {
    if (!nextTime) return "";
    const diff = new Date(nextTime).getTime() - Date.now();
    if (diff <= 0) return "Now";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="flex items-center space-x-8">
      {/* Mark Price */}
      <div className="flex flex-col">
        <span
          className={`font-mono text-xl font-semibold tabular-nums ${isPositive ? "text-positive" : "text-negative"}`}
        >
          {formatMarketPrice(market.currentPrice)}
        </span>
        <span className="text-foreground-subtle text-[10px] tracking-wider uppercase">
          Mark Price
        </span>
      </div>

      {/* 24h Change */}
      <div className="flex flex-col">
        <span
          className={`font-mono text-sm font-medium tabular-nums ${getPnLColor(market.priceChangePercent)}`}
        >
          {formatChangePercent(market.priceChangePercent)}
        </span>
        <span className="text-foreground-subtle text-[10px] tracking-wider uppercase">
          24h Change
        </span>
      </div>

      {/* 24h High */}
      <div className="flex flex-col">
        <span className="text-foreground font-mono text-sm tabular-nums">
          {market.high24h > 0 ? formatMarketPrice(market.high24h) : "—"}
        </span>
        <span className="text-foreground-subtle text-[10px] tracking-wider uppercase">
          24h High
        </span>
      </div>

      {/* 24h Low */}
      <div className="flex flex-col">
        <span className="text-foreground font-mono text-sm tabular-nums">
          {market.low24h > 0 ? formatMarketPrice(market.low24h) : "—"}
        </span>
        <span className="text-foreground-subtle text-[10px] tracking-wider uppercase">
          24h Low
        </span>
      </div>

      {/* Funding Rate */}
      {market.fundingRate !== 0 && (
        <div className="flex flex-col">
          <span
            className={`font-mono text-sm font-medium tabular-nums ${market.fundingRate >= 0 ? "text-positive" : "text-negative"}`}
          >
            {market.fundingRate >= 0 ? "+" : ""}
            {(market.fundingRate * 100).toFixed(4)}%
          </span>
          <span className="text-foreground-subtle text-[10px] tracking-wider uppercase">
            Funding{" "}
            {market.nextFundingTime
              ? formatFundingCountdown(market.nextFundingTime)
              : ""}
          </span>
        </div>
      )}

      {/* Open Interest */}
      {market.openInterest > 0 && (
        <div className="flex flex-col">
          <span className="text-foreground font-mono text-sm tabular-nums">
            {market.openInterest >= 1e6
              ? `$${(market.openInterest / 1e6).toFixed(2)}M`
              : market.openInterest >= 1e3
                ? `$${(market.openInterest / 1e3).toFixed(1)}K`
                : `$${market.openInterest.toLocaleString()}`}
          </span>
          <span className="text-foreground-subtle text-[10px] tracking-wider uppercase">
            Open Interest
          </span>
        </div>
      )}
    </div>
  );
}

export default memo(MarketStatsBar);
