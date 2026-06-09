"use client";

import { useMemo } from "react";
import { Bubble } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { type UserBalance, type SupportedAsset } from "@/services/ApiClient";
import { AssetIcon } from "./AssetIcon";

// Register Chart.js components
ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

// Modern gradient color palette
const COLOR_PAIRS = [
  { bg: "rgba(250, 95, 26, 0.85)", border: "#fa5f1a" },
  { bg: "rgba(249, 115, 22, 0.85)", border: "#f97316" },
  { bg: "rgba(251, 146, 60, 0.85)", border: "#fb923c" },
  { bg: "rgba(251, 191, 36, 0.85)", border: "#fbbf24" },
  { bg: "rgba(34, 197, 94, 0.85)", border: "#22c55e" },
  { bg: "rgba(59, 130, 246, 0.85)", border: "#3b82f6" },
  { bg: "rgba(168, 85, 247, 0.85)", border: "#a855f7" },
  { bg: "rgba(236, 72, 153, 0.85)", border: "#ec4899" },
] as const;

interface AssetsChartProps {
  balances: UserBalance[];
  assets: SupportedAsset[];
}

export function AssetsChart({ balances, assets }: AssetsChartProps) {
  const chartData = useMemo(() => {
    const validBalances = balances.filter(
      (b) => parseFloat(b.total || "0") > 0
    );

    if (validBalances.length === 0) {
      return null;
    }

    const totalValue = validBalances.reduce(
      (sum, b) => sum + parseFloat(b.total || "0"),
      0
    );

    // Create bubble data with better distribution
    const bubbleData = validBalances.map((balance, index) => {
      const value = parseFloat(balance.total || "0");
      const percentage = (value / totalValue) * 100;

      // Use golden angle for better distribution
      const angle = index * 2.4; // Golden angle in radians
      const radius = 20 + (index % 3) * 15;

      return {
        x: 50 + Math.cos(angle) * radius,
        y: 50 + Math.sin(angle) * radius,
        r: Math.max(20, Math.min(45, 15 + percentage * 2.5)), // Dynamic bubble size
        label: balance.asset_symbol,
        value,
        percentage,
      };
    });

    return {
      datasets: bubbleData.map((bubble, index) => {
        const colorIndex = index % COLOR_PAIRS.length;
        const colors = COLOR_PAIRS[colorIndex]!; // Non-null assertion since modulo ensures valid index

        return {
          label: bubble.label,
          data: [{ x: bubble.x, y: bubble.y, r: bubble.r }],
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 3,
          hoverBackgroundColor: colors.border,
          hoverBorderColor: "#fff",
          hoverBorderWidth: 4,
          metadata: {
            value: bubble.value,
            percentage: bubble.percentage,
          },
        };
      }),
    };
  }, [balances]);

  const options: ChartOptions<"bubble"> = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.2,
    animation: {
      duration: 1000,
      easing: "easeInOutQuart",
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(26, 26, 26, 0.95)",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "#fa5f1a",
        borderWidth: 2,
        padding: 16,
        displayColors: false,
        titleFont: {
          size: 14,
          weight: "bold",
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          title: (context) => {
            const firstContext = context[0];
            return firstContext?.dataset.label || "";
          },
          label: (context) => {
            const dataset = context.dataset as {
              metadata?: { value: number; percentage: number };
            };
            const value = dataset.metadata?.value || 0;
            const percentage = dataset.metadata?.percentage || 0;
            return [
              `Value: $${value.toFixed(2)}`,
              `Share: ${percentage.toFixed(1)}%`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        display: false,
        min: 0,
        max: 100,
      },
      y: {
        display: false,
        min: 0,
        max: 100,
      },
    },
  };

  if (!chartData) {
    return (
      <div className="flex h-[400px] items-center justify-center text-sm text-gray-400">
        No assets with balance
      </div>
    );
  }

  // Get all assets for modern legend
  const sortedBalances = balances
    .filter((b) => parseFloat(b.total || "0") > 0)
    .sort((a, b) => parseFloat(b.total || "0") - parseFloat(a.total || "0"));

  const totalValue = sortedBalances.reduce(
    (sum, b) => sum + parseFloat(b.total || "0"),
    0
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Chart Container */}
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-zinc-900/80 via-zinc-900/50 to-zinc-900/80 p-8 shadow-2xl backdrop-blur-xl">
          <div className="relative w-full" style={{ height: "500px" }}>
            <Bubble data={chartData} options={options} />
          </div>
        </div>
      </div>

      {/* Modern Asset Legend */}
      <div className="lg:w-96">
        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-zinc-900/80 via-zinc-900/50 to-zinc-900/80 p-6 shadow-2xl backdrop-blur-xl">
          <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-white">
            <span className="h-6 w-1 rounded-full bg-linear-to-b from-orange-500 to-orange-600"></span>
            Asset Distribution
          </h3>

          <div className="space-y-4">
            {sortedBalances.map((balance, index) => {
              const asset = assets.find(
                (a) => a.symbol === balance.asset_symbol
              );
              const value = parseFloat(balance.total || "0");
              const percentage = (value / totalValue) * 100;
              const colorIndex = index % COLOR_PAIRS.length;
              const colors = COLOR_PAIRS[colorIndex]!; // Non-null assertion since modulo ensures valid index

              return (
                <div
                  key={`${balance.asset_symbol}-${index}`}
                  className="group relative"
                >
                  {/* Asset Row */}
                  <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-zinc-800/30 p-3 transition-all duration-300 hover:border-white/10 hover:bg-zinc-800/50">
                    {/* Color Indicator */}
                    <div
                      className="h-4 w-4 rounded-full shadow-lg transition-transform duration-300 group-hover:scale-110"
                      style={{
                        backgroundColor: colors.border,
                        boxShadow: `0 0 15px ${colors.border}40`,
                      }}
                    />

                    {/* Asset Icon */}
                    <AssetIcon
                      iconUrl={asset?.icon_url}
                      symbol={balance.asset_symbol}
                      size={32}
                    />

                    {/* Asset Info */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-white">
                          {asset?.name || balance.asset_symbol}
                        </span>
                        <span className="font-mono text-xs text-gray-400">
                          {balance.asset_symbol}
                        </span>
                      </div>

                      {/* Value and Percentage */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-300">
                          ${value.toFixed(2)}
                        </span>
                        <span
                          className="rounded-md px-2 py-1 text-xs font-bold"
                          style={{
                            color: colors.border,
                            backgroundColor: `${colors.border}15`,
                          }}
                        >
                          {percentage.toFixed(1)}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-700/50">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${percentage}%`,
                            background: `linear-gradient(90deg, ${colors.border}, ${colors.bg})`,
                            boxShadow: `0 0 10px ${colors.border}40`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Value Footer */}
          <div className="mt-6 border-t border-white/10 pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-400">
                Total Portfolio Value
              </span>
              <span className="text-lg font-bold text-white">
                ${totalValue.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
