"use client";

import React from "react";
import { useTradingVolume } from "@/hooks";
import { formatVolume, formatPercentage1 } from "@/utils/formatting";
import { TrendingUp, BarChart3, Activity, Calculator } from "lucide-react";

interface VolumeMetricsProps {
  className?: string;
}

export function VolumeMetrics({ className = "" }: VolumeMetricsProps) {
  const { volumeMetrics, isLoading, error } = useTradingVolume();

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-[#23345C] bg-[#122347] p-6"
            >
              <div className="mb-2 h-4 rounded bg-[#23345C]"></div>
              <div className="h-8 rounded bg-[#23345C]"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`${className} rounded-xl border border-red-500/30 bg-red-500/10 p-6`}
      >
        <p className="text-red-400">
          Error loading volume data: {error.message}
        </p>
      </div>
    );
  }

  if (!volumeMetrics) {
    return (
      <div
        className={`${className} rounded-xl border border-[#23345C] bg-[#122347] p-6`}
      >
        <p className="text-gray-400">No volume data available</p>
      </div>
    );
  }

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Volume Overview Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="group rounded-xl border-2 border-[#3A8DFF] bg-linear-to-br from-[#122347] to-[#1A2E57] p-6 shadow-lg transition-all duration-300 hover:border-[#3A8DFF]/70 hover:shadow-[#3A8DFF]/20">
          <div className="mb-3 flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-[#3A8DFF]" />
            <div className="text-sm font-medium text-[#A3B8D9]">
              24h Trading Volume
            </div>
          </div>
          <div className="text-3xl font-bold text-white">
            {formatVolume(volumeMetrics.totalVolume24h)}
          </div>
          <div className="mt-1 text-xs font-medium text-[#3A8DFF]">
            Protocol Data
          </div>
        </div>

        <div className="group rounded-xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-6 shadow-lg transition-all duration-300 hover:border-[#3A8DFF]/50">
          <div className="mb-3 flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-[#00D1FF]" />
            <div className="text-sm font-medium text-[#A3B8D9]">
              Total Volume
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatVolume(volumeMetrics.totalVolumeAll)}
          </div>
          <div className="mt-1 text-xs text-[#A3B8D9]">All Time</div>
        </div>

        <div className="group rounded-xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-6 shadow-lg transition-all duration-300 hover:border-[#3A8DFF]/50">
          <div className="mb-3 flex items-center space-x-2">
            <Activity className="h-5 w-5 text-[#00FF88]" />
            <div className="text-sm font-medium text-[#A3B8D9]">24h Trades</div>
          </div>
          <div className="text-2xl font-bold text-white">
            {volumeMetrics.tradeCount24h.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-[#A3B8D9]">Transactions</div>
        </div>

        <div className="group rounded-xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-6 shadow-lg transition-all duration-300 hover:border-[#3A8DFF]/50">
          <div className="mb-3 flex items-center space-x-2">
            <Calculator className="h-5 w-5 text-[#FF6B6B]" />
            <div className="text-sm font-medium text-[#A3B8D9]">
              Avg Trade Size
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatVolume(volumeMetrics.avgTradeSize)}
          </div>
          <div className="mt-1 text-xs text-[#A3B8D9]">Per Trade</div>
        </div>
      </div>

      {/* Volume by Market */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Top Volume Markets (External) */}
        <div className="rounded-xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-6 shadow-lg">
          <h3 className="mb-6 text-xl font-bold text-white">
            Top Volume Markets (24h)
          </h3>
          <div className="space-y-4">
            {volumeMetrics.topVolumeMarkets.map((market, index) => (
              <div
                key={market.symbol}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3A8DFF]/20 text-sm font-bold text-[#3A8DFF]">
                    {index + 1}
                  </div>
                  <span className="font-medium text-white">
                    {market.symbol}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-white">
                    {formatVolume(market.volume)}
                  </div>
                  <div className="text-xs text-[#A3B8D9]">
                    {formatPercentage1(market.percentage)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Protocol Volume by Market */}
        <div className="rounded-xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-6 shadow-lg">
          <h3 className="mb-6 text-xl font-bold text-white">
            Protocol Volume by Market
          </h3>
          <div className="space-y-4">
            {volumeMetrics.volumeByMarket.slice(0, 5).map((market, index) => (
              <div
                key={market.market}
                className="flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00D1FF]/20 text-sm font-bold text-[#00D1FF]">
                    {index + 1}
                  </div>
                  <span className="font-medium text-white">
                    {market.market}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-white">
                    {formatVolume(market.volume)}
                  </div>
                  <div className="text-xs text-[#A3B8D9]">
                    {market.trades} trades
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Volume Chart Placeholder */}
      <div className="rounded-xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-6 shadow-lg">
        <h3 className="mb-6 text-xl font-bold text-white">
          24h Volume Distribution
        </h3>
        <div className="space-y-4">
          {volumeMetrics.volumeByHour.slice(-12).map((hour) => (
            <div key={hour.hour} className="flex items-center space-x-4">
              <div className="w-12 text-xs text-[#A3B8D9]">{hour.hour}</div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <div
                    className="h-2 rounded-full bg-linear-to-r from-[#3A8DFF] to-[#00D1FF]"
                    style={{
                      width: `${Math.max(2, (hour.volume / Math.max(...volumeMetrics.volumeByHour.map((h) => h.volume))) * 100)}%`,
                    }}
                  ></div>
                  <span className="text-xs text-white">
                    {formatVolume(hour.volume)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
