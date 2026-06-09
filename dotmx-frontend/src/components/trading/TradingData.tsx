"use client";

import React from "react";
import {
  formatMarketPrice,
  formatChangePercent,
  getPnLColor,
} from "@/utils/formatting";

interface TradingDataProps {
  tradingData: {
    currentPrice: number;
    priceChangePercent: number;
    high24h: number;
    low24h: number;
  };
  fundingRate?: number | undefined;
  nextFundingTime?: string | undefined;
  openInterest?: number | undefined;
  className?: string;
}

function TradingData({
  tradingData,
  fundingRate,
  nextFundingTime,
  openInterest,
  className = "",
}: TradingDataProps) {
  const isPositive = tradingData.priceChangePercent >= 0;

  // Format countdown to next funding
  const formatFundingCountdown = (nextTime?: string) => {
    if (!nextTime) return "";
    const diff = new Date(nextTime).getTime() - Date.now();
    if (diff <= 0) return "Now";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className={`flex items-center space-x-8 ${className}`}>
      {/* Mark Price - Primary focus */}
      <div className="flex flex-col">
        <span
          className={`font-mono text-xl font-semibold tabular-nums ${isPositive ? "text-positive" : "text-negative"}`}
        >
          {formatMarketPrice(tradingData.currentPrice)}
        </span>
        <span className="text-foreground-subtle text-[10px] tracking-wider uppercase">
          Mark Price
        </span>
      </div>

      {/* 24h Change */}
      <div className="flex flex-col">
        <span
          className={`font-mono text-sm font-medium tabular-nums ${getPnLColor(tradingData.priceChangePercent)}`}
        >
          {formatChangePercent(tradingData.priceChangePercent)}
        </span>
        <span className="text-foreground-subtle text-[10px] tracking-wider uppercase">
          24h Change
        </span>
      </div>

      {/* 24h High */}
      <div className="flex flex-col">
        <span className="text-foreground font-mono text-sm tabular-nums">
          {formatMarketPrice(tradingData.high24h)}
        </span>
        <span className="text-foreground-subtle text-[10px] tracking-wider uppercase">
          24h High
        </span>
      </div>

      {/* 24h Low */}
      <div className="flex flex-col">
        <span className="text-foreground font-mono text-sm tabular-nums">
          {formatMarketPrice(tradingData.low24h)}
        </span>
        <span className="text-foreground-subtle text-[10px] tracking-wider uppercase">
          24h Low
        </span>
      </div>

      {/* Funding Rate */}
      {fundingRate !== undefined && (
        <div className="flex flex-col">
          <span
            className={`font-mono text-sm font-medium tabular-nums ${fundingRate >= 0 ? "text-positive" : "text-negative"}`}
          >
            {fundingRate >= 0 ? "+" : ""}
            {(fundingRate * 100).toFixed(4)}%
          </span>
          <span className="text-foreground-subtle text-[10px] tracking-wider uppercase">
            Funding{" "}
            {nextFundingTime ? formatFundingCountdown(nextFundingTime) : ""}
          </span>
        </div>
      )}

      {/* Open Interest */}
      {openInterest !== undefined && openInterest > 0 && (
        <div className="flex flex-col">
          <span className="text-foreground font-mono text-sm tabular-nums">
            {openInterest >= 1e6
              ? `$${(openInterest / 1e6).toFixed(2)}M`
              : openInterest >= 1e3
                ? `$${(openInterest / 1e3).toFixed(1)}K`
                : `$${openInterest.toLocaleString()}`}
          </span>
          <span className="text-foreground-subtle text-[10px] tracking-wider uppercase">
            Open Interest
          </span>
        </div>
      )}
    </div>
  );
}

// Custom comparison function to prevent unnecessary re-renders
function arePropsEqual(
  prevProps: TradingDataProps,
  nextProps: TradingDataProps
) {
  const prev = prevProps.tradingData;
  const next = nextProps.tradingData;

  return (
    prev.currentPrice === next.currentPrice &&
    prev.priceChangePercent === next.priceChangePercent &&
    prev.high24h === next.high24h &&
    prev.low24h === next.low24h &&
    prevProps.fundingRate === nextProps.fundingRate &&
    prevProps.nextFundingTime === nextProps.nextFundingTime &&
    prevProps.openInterest === nextProps.openInterest &&
    prevProps.className === nextProps.className
  );
}

export default React.memo(TradingData, arePropsEqual);
