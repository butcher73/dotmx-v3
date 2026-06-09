"use client";

import { useMemo, useState } from "react";
import { formatPnL, formatErrorAmount } from "@/utils/formatting";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2, AlertCircle, BarChart3 } from "lucide-react";

interface ChartPoint {
  date: string;
  value: number;
  pnl: number;
}

interface ChartData {
  points: ChartPoint[];
  totalChange: number;
  totalChangePercent: number;
  minValue: number;
  maxValue: number;
}

interface PortfolioChartProps {
  chartData: ChartData;
  chartLoading: boolean;
  chartError?: string | null;
  setActiveTab: (tab: "Positions" | "Transactions" | "Analytics") => void;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      value: number;
      pnl: number;
      date: string;
    };
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length && payload[0]) {
    const data = payload[0].payload;
    return (
      <div
        className="bg-background-card rounded p-2 shadow-sm"
        style={{ border: "1px solid #333" }}
      >
        <div className="space-y-1">
          <p className="text-foreground-muted text-2xs font-medium">{label}</p>
          <div className="space-y-0.5">
            <div className="flex items-center justify-between space-x-2">
              <span className="text-foreground-subtle text-2xs">Value</span>
              <span className="text-foreground text-xs font-bold">
                ${formatErrorAmount(data.value)}
              </span>
            </div>
            <div className="flex items-center justify-between space-x-2">
              <span className="text-foreground-subtle text-2xs">P&L</span>
              <span
                className={`text-xs font-bold ${data.pnl >= 0 ? "text-positive" : "text-negative"}`}
              >
                {formatPnL(data.pnl)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function PortfolioChart({
  chartData,
  chartLoading,
  chartError,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setActiveTab: _setActiveTab,
}: PortfolioChartProps) {
  const [period, setPeriod] = useState<"1D" | "1W" | "1M">("1W");

  const periodData = useMemo(() => {
    const points = chartData.points || [];
    if (points.length === 0) {
      return {
        points: [],
        totalChange: 0,
        totalChangePercent: 0,
        minValue: 0,
        maxValue: 0,
      } as ChartData;
    }

    const lastPoint = points[points.length - 1]!;
    const lastDate = new Date(lastPoint.date).getTime();
    const days = period === "1D" ? 1 : period === "1W" ? 7 : 30;
    const cutoff = lastDate - days * 24 * 60 * 60 * 1000;

    let filtered = points.filter((p) => new Date(p.date).getTime() >= cutoff);

    if (filtered.length === 0) {
      filtered = points.slice(-Math.min(points.length, 20));
    }

    const first = filtered[0]!;
    const last = filtered[filtered.length - 1]!;
    const totalChange = last.value - first.value;
    const totalChangePercent =
      first.value !== 0 ? (totalChange / first.value) * 100 : 0;
    const values = filtered.map((p) => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    return {
      points: filtered,
      totalChange,
      totalChangePercent,
      minValue,
      maxValue,
    } as ChartData;
  }, [chartData, period]);

  if (chartLoading) {
    return (
      <div
        className="bg-background-card rounded-xl p-6 shadow-sm"
        style={{ border: "1px solid #333" }}
      >
        <div className="flex h-80 items-center justify-center">
          <div className="space-y-4 text-center">
            <Loader2 className="text-accent mx-auto h-12 w-12 animate-spin" />
            <p className="text-foreground-muted text-sm">
              Loading chart data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (chartError) {
    return (
      <div
        className="bg-background-card rounded-xl p-6 shadow-sm"
        style={{ border: "1px solid #333" }}
      >
        <div className="flex h-80 items-center justify-center">
          <div className="space-y-4 text-center">
            <div className="bg-negative-muted mx-auto flex h-16 w-16 items-center justify-center rounded-full">
              <AlertCircle className="text-negative h-8 w-8" />
            </div>
            <div>
              <p className="text-negative mb-1 text-sm font-semibold">
                Chart Data Unavailable
              </p>
              <p className="text-foreground-subtle text-xs">{chartError}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (periodData.points.length === 0) {
    return (
      <div className="border-border bg-background-card rounded-xl border p-6">
        <div className="flex h-80 items-center justify-center">
          <div className="space-y-4 text-center">
            <div className="bg-border mx-auto flex h-16 w-16 items-center justify-center rounded-full">
              <BarChart3 className="text-foreground-subtle h-8 w-8" />
            </div>
            <div>
              <p className="text-foreground-muted mb-1 text-sm font-semibold">
                No Trading Activity
              </p>
              <p className="text-foreground-subtle text-xs">
                Start trading to see your portfolio chart
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-background-card rounded-xl p-6 shadow-sm"
      style={{ border: "1px solid #333" }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-foreground text-lg font-bold">Portfolio Value</h3>
        <div className="bg-background flex items-center space-x-1 rounded-lg p-1">
          {(["1D", "1W", "1M"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                period === p
                  ? "bg-accent text-foreground"
                  : "text-foreground-subtle hover:bg-border hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={periodData.points.map((point) => {
              const date = new Date(point.date);
              const formattedDate = date.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
              });
              return { ...point, formattedDate };
            })}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={
                    periodData.totalChange >= 0 ? "#00D897" : "#FF6B6B"
                  }
                  stopOpacity={0.5}
                />
                <stop
                  offset="100%"
                  stopColor={
                    periodData.totalChange >= 0 ? "#00D897" : "#FF6B6B"
                  }
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="1 3"
              stroke="#1a1a1a"
              opacity={0.5}
              horizontal={true}
              vertical={false}
            />
            <XAxis
              dataKey="formattedDate"
              tick={{ fontSize: 11, fill: "#666666" }}
              axisLine={{ stroke: "#1a1a1a" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#666666" }}
              axisLine={{ stroke: "#1a1a1a" }}
              tickLine={false}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={periodData.totalChange >= 0 ? "#00D897" : "#FF6B6B"}
              strokeWidth={2}
              fill="url(#chartGradient)"
              dot={{
                r: 3,
                fill: periodData.totalChange >= 0 ? "#00D897" : "#FF6B6B",
                stroke: "#0a0a0a",
                strokeWidth: 2,
              }}
              activeDot={{
                r: 5,
                fill: periodData.totalChange >= 0 ? "#00D897" : "#FF6B6B",
                stroke: "#0a0a0a",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
