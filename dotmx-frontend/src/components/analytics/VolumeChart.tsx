"use client";

import React from "react";
import { useTradingVolume } from "@/hooks";
import { formatVolume } from "@/utils/formatting";

interface VolumeChartProps {
  className?: string;
  height?: number;
}

export function VolumeChart({
  className = "",
  height = 300,
}: VolumeChartProps) {
  const { volumeMetrics, isLoading, error } = useTradingVolume();

  if (isLoading) {
    return (
      <div
        className={`${className} rounded-xl border border-[#23345C] bg-[#122347] p-6`}
      >
        <div className="animate-pulse">
          <div className="mb-4 h-6 w-48 rounded bg-[#23345C]"></div>
          <div className="h-64 rounded bg-[#23345C]"></div>
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
          Error loading volume chart: {error.message}
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

  const maxVolume = Math.max(...volumeMetrics.hourlyData.map((h) => h.volume));
  const chartHeight = height - 80; // Account for padding and labels

  return (
    <div
      className={`${className} rounded-xl border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] p-6 shadow-lg`}
    >
      <h3 className="mb-6 text-xl font-bold text-white">24h Volume Chart</h3>

      <div className="relative" style={{ height: `${height}px` }}>
        {/* Y-axis labels */}
        <div className="absolute top-0 left-0 flex h-full flex-col justify-between text-xs text-[#A3B8D9]">
          <span>{formatVolume(maxVolume)}</span>
          <span>{formatVolume(maxVolume * 0.75)}</span>
          <span>{formatVolume(maxVolume * 0.5)}</span>
          <span>{formatVolume(maxVolume * 0.25)}</span>
          <span>$0</span>
        </div>

        {/* Chart area */}
        <div className="ml-16 h-full">
          <div className="flex h-full items-end justify-between space-x-1">
            {volumeMetrics.hourlyData.map((hour, index) => {
              const barHeight =
                maxVolume > 0 ? (hour.volume / maxVolume) * chartHeight : 0;

              return (
                <div
                  key={hour.hour}
                  className="group relative flex flex-col items-center"
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block">
                    <div className="rounded-lg border border-[#3A8DFF] bg-[#0A1733] px-3 py-2 text-xs text-white shadow-lg">
                      <div className="font-semibold">{hour.hour}:00</div>
                      <div className="text-[#A3B8D9]">
                        {formatVolume(hour.volume)}
                      </div>
                    </div>
                  </div>

                  {/* Bar */}
                  <div
                    className="w-4 bg-linear-to-t from-[#3A8DFF] to-[#00D1FF] transition-all duration-200 hover:from-[#4A9DFF] hover:to-[#10E1FF]"
                    style={{ height: `${barHeight}px` }}
                  ></div>

                  {/* X-axis label */}
                  <div className="mt-2 text-xs text-[#A3B8D9]">
                    {index % 4 === 0 ? hour.hour : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grid lines */}
        <div className="pointer-events-none absolute inset-0 ml-16">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-full border-t border-[#23345C]/50"
              style={{ top: `${(i / 4) * 100}%` }}
            ></div>
          ))}
        </div>
      </div>

      {/* Chart summary */}
      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-[#23345C] pt-4">
        <div className="text-center">
          <div className="text-sm font-medium text-[#A3B8D9]">Peak Hour</div>
          <div className="text-lg font-bold text-white">
            {
              volumeMetrics.hourlyData.reduce((max, hour) =>
                hour.volume > max.volume ? hour : max
              ).hour
            }
            :00
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-medium text-[#A3B8D9]">Peak Volume</div>
          <div className="text-lg font-bold text-white">
            {formatVolume(maxVolume)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-medium text-[#A3B8D9]">Avg/Hour</div>
          <div className="text-lg font-bold text-white">
            {formatVolume(
              volumeMetrics.hourlyData.reduce(
                (sum, hour) => sum + hour.volume,
                0
              ) / volumeMetrics.hourlyData.length
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
