"use client";

import { useState, useMemo } from "react";
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
  value: number;
  pnl: number;
  date: string;
}

interface ChartData {
  points: ChartPoint[];
  totalChange: number;
  totalChangePercent: number;
  minValue: number;
  maxValue: number;
}

interface ProcessedTransaction {
  id: string;
  timestamp: string;
  time: string;
  market: string;
  pair: string;
  size: string;
  amount: number;
  price: string;
  margin?: number;
  fee?: number;
  total?: number;
  pnl?: number;
  isLong: boolean;
  side: "Long" | "Short";
  leverage?: number;
  type: string;
  txHash: string;
  orderId: string;
  orderType: number;
  status?: string;
}

interface OverviewTabProps {
  chartData: ChartData;
  chartLoading: boolean;
  chartError: string | null;
  recentTransactions: ProcessedTransaction[];
  transactionsLoading: boolean;
  transactionsError: string | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  staticData: {
    trendingTokens: Array<{
      symbol: string;
      name: string;
      logo: string;
      pair: string;
    }>;
    announcements: Array<{
      date: string;
      title: string;
    }>;
  };
  portfolioInsights?: {
    riskLevel?: string;
    diversificationScore?: number;
    volatilityScore?: number;
  };
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
              <span className="text-foreground-subtle text-2xs">
                Portfolio Value
              </span>
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

export function OverviewTab({
  chartData,
  chartLoading,
  chartError,
  recentTransactions,
}: OverviewTabProps) {
  const [period, setPeriod] = useState<"1D" | "1W" | "1M" | "ALL">("ALL");

  const filteredChartData = useMemo(() => {
    let points: ChartPoint[] = [];

    if (chartData && chartData.points && chartData.points.length > 0) {
      points = chartData.points.filter(
        (p) => p && typeof p.value === "number" && !isNaN(p.value) && p.date
      );
    }

    if (
      points.length <= 2 &&
      recentTransactions &&
      recentTransactions.length > 0
    ) {
      const transactionPoints: ChartPoint[] = [];
      const lastPoint = points.length > 0 ? points[points.length - 1] : null;
      let runningValue = lastPoint ? lastPoint.value : 1000;

      const sortedTransactions = [...recentTransactions]
        .filter((tx) => tx.timestamp && tx.pnl !== undefined)
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
        .slice(-10);

      sortedTransactions.forEach((tx, index) => {
        if (index === 0 && points.length === 0) {
          runningValue = Math.abs(tx.total || tx.amount || 1000);
        } else {
          runningValue += tx.pnl || 0;
        }

        transactionPoints.push({
          value: Math.max(0, runningValue),
          pnl: tx.pnl || 0,
          date: tx.timestamp,
        });
      });

      if (transactionPoints.length > 0) {
        points = [...points, ...transactionPoints];
      }
    }

    if (points.length === 0) {
      return {
        points: [],
        totalChange: 0,
        totalChangePercent: 0,
        minValue: 0,
        maxValue: 0,
      };
    }

    points.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let filtered = points;

    if (period !== "ALL") {
      const lastPoint = points[points.length - 1];
      if (lastPoint) {
        const lastDate = new Date(lastPoint.date).getTime();
        const days = period === "1D" ? 1 : period === "1W" ? 7 : 30;
        const cutoff = lastDate - days * 24 * 60 * 60 * 1000;
        filtered = points.filter((p) => new Date(p.date).getTime() >= cutoff);
      }
    }

    if (filtered.length < 10 && points.length > filtered.length) {
      const recentCount = Math.min(10, points.length);
      filtered = points.slice(-recentCount);
    }

    if (filtered.length === 0) {
      filtered = points.slice(-Math.min(5, points.length));
    }

    const first = filtered[0];
    const last = filtered[filtered.length - 1];

    if (!first || !last) {
      return {
        points: [],
        totalChange: 0,
        totalChangePercent: 0,
        minValue: 0,
        maxValue: 0,
      };
    }

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
    };
  }, [chartData, period, recentTransactions]);

  return (
    <div
      className="bg-background-card rounded-lg shadow-sm"
      style={{ border: "1px solid #333" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b p-6"
        style={{ borderColor: "#333" }}
      >
        <h3 className="text-foreground text-lg font-semibold">
          Portfolio Performance
        </h3>

        {/* Period selector */}
        <div className="flex items-center gap-2">
          {(["1D", "1W", "1M", "ALL"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
                period === p
                  ? "bg-accent text-foreground"
                  : "text-foreground-muted hover:bg-background-elevated hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Area */}
      <div className="p-6">
        {chartLoading ? (
          <div className="flex h-80 items-center justify-center">
            <div className="space-y-4 text-center">
              <Loader2 className="text-accent mx-auto h-12 w-12 animate-spin" />
              <p className="text-foreground-muted text-sm font-medium">
                Loading portfolio data...
              </p>
            </div>
          </div>
        ) : chartError ? (
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
        ) : filteredChartData.points.length === 0 ? (
          <div className="flex h-80 items-center justify-center">
            <div className="space-y-4 text-center">
              <div className="bg-border mx-auto flex h-16 w-16 items-center justify-center rounded-full">
                <BarChart3 className="text-foreground-subtle h-8 w-8" />
              </div>
              <div>
                <p className="text-foreground-muted mb-1 text-sm font-semibold">
                  {period === "ALL"
                    ? "No Trading Activity"
                    : `No Data for ${period}`}
                </p>
                <p className="text-foreground-subtle text-xs">
                  Start trading to see your portfolio transactions
                </p>
              </div>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart
              data={filteredChartData.points.map((point) => {
                const date = new Date(point.date);
                const formattedDate = date.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return { ...point, formattedDate };
              })}
              margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
            >
              <defs>
                <linearGradient
                  id="portfolioGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={
                      filteredChartData.totalChange >= 0 ? "#00D897" : "#FF6B6B"
                    }
                    stopOpacity={0.5}
                  />
                  <stop
                    offset="100%"
                    stopColor={
                      filteredChartData.totalChange >= 0 ? "#00D897" : "#FF6B6B"
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
                tickMargin={12}
                interval="preserveStartEnd"
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
                stroke={
                  filteredChartData.totalChange >= 0 ? "#00D897" : "#FF6B6B"
                }
                strokeWidth={2}
                fill="url(#portfolioGradient)"
                dot={{
                  r: 4,
                  fill:
                    filteredChartData.totalChange >= 0 ? "#00D897" : "#FF6B6B",
                  stroke: "#0a0a0a",
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill:
                    filteredChartData.totalChange >= 0 ? "#00D897" : "#FF6B6B",
                  stroke: "#0a0a0a",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
