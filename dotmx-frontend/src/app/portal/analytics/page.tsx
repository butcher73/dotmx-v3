"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useBalance, usePositionsData, useTransactionHistory } from "@/hooks";
import {
  LineChart,
  TrendingUp,
  TrendingDown,
  Target,
  Percent,
  DollarSign,
  BarChart3,
  Calendar,
} from "lucide-react";
import { formatUSD, formatPnL } from "@/utils/formatting";
import {
  PortalCard,
  PortalCardContent,
  PortalCardHeader,
  PortalCardTitle,
} from "@/components/ui";
type Period = "24h" | "7d" | "30d" | "90d" | "all";

export default function AnalyticsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { balance } = useBalance();
  const { orders: positions } = usePositionsData();

  // Fetch transactions from backend API database
  const { transactions } = useTransactionHistory(100);

  const [period, setPeriod] = useState<Period>("30d");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Calculate analytics
  const totalPnL = positions?.reduce((sum, p) => sum + (p.pnl || 0), 0) || 0;
  const totalTrades = transactions?.length || 0;
  const winningTrades =
    transactions?.filter((t) => (t.pnl || 0) > 0).length || 0;
  const losingTrades =
    transactions?.filter((t) => (t.pnl || 0) < 0).length || 0;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const totalVolume =
    transactions?.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0;

  const avgWin =
    winningTrades > 0
      ? (transactions
          ?.filter((t) => (t.pnl || 0) > 0)
          .reduce((sum, t) => sum + (t.pnl || 0), 0) || 0) / winningTrades
      : 0;
  const avgLoss =
    losingTrades > 0
      ? Math.abs(
          transactions
            ?.filter((t) => (t.pnl || 0) < 0)
            .reduce((sum, t) => sum + (t.pnl || 0), 0) || 0
        ) / losingTrades
      : 0;
  const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;

  const periods: { id: Period; label: string }[] = [
    { id: "24h", label: "24H" },
    { id: "7d", label: "7D" },
    { id: "30d", label: "30D" },
    { id: "90d", label: "90D" },
    { id: "all", label: "All" },
  ];

  if (authLoading) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-6">
          <div className="mb-6">
            <div className="bg-border mb-1.5 h-6 w-32 animate-pulse rounded" />
            <div className="bg-border h-4 w-48 animate-pulse rounded" />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-background-card h-24 animate-pulse rounded-xl border border-[#333]"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-foreground mb-1 text-xl font-bold">
              Analytics
            </h1>
            <p className="text-foreground-muted text-sm">
              Track your trading performance
            </p>
          </div>

          {/* Period Selector */}
          <div className="bg-background-card flex items-center gap-1 rounded-lg p-1 shadow-sm">
            {periods.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === p.id
                    ? "bg-accent text-foreground"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <PortalCard>
            <PortalCardContent>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-foreground-muted text-xs">Total P&L</span>
                {totalPnL >= 0 ? (
                  <TrendingUp className="text-positive h-4 w-4" />
                ) : (
                  <TrendingDown className="text-negative h-4 w-4" />
                )}
              </div>
              <div
                className={`text-lg font-bold ${totalPnL >= 0 ? "text-positive" : "text-negative"}`}
              >
                {formatPnL(totalPnL)}
              </div>
              <p className="text-foreground-subtle mt-0.5 text-xs">
                {period === "all" ? "All time" : `Last ${period}`}
              </p>
            </PortalCardContent>
          </PortalCard>

          <PortalCard>
            <PortalCardContent>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-foreground-muted text-xs">Win Rate</span>
                <Target className="text-accent h-4 w-4" />
              </div>
              <div className="text-foreground text-lg font-bold">
                {winRate.toFixed(1)}%
              </div>
              <p className="text-foreground-subtle mt-0.5 text-xs">
                {winningTrades}W / {losingTrades}L
              </p>
            </PortalCardContent>
          </PortalCard>

          <PortalCard>
            <PortalCardContent>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-foreground-muted text-xs">
                  Total Volume
                </span>
                <DollarSign className="text-info h-4 w-4" />
              </div>
              <div className="text-foreground text-lg font-bold">
                {formatUSD(totalVolume)}
              </div>
              <p className="text-foreground-subtle mt-0.5 text-xs">
                {totalTrades} trades
              </p>
            </PortalCardContent>
          </PortalCard>

          <PortalCard>
            <PortalCardContent>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-foreground-muted text-xs">
                  Profit Factor
                </span>
                <Percent className="text-warning h-4 w-4" />
              </div>
              <div className="text-foreground text-lg font-bold">
                {profitFactor.toFixed(2)}
              </div>
              <p className="text-foreground-subtle mt-0.5 text-xs">
                Avg Win/Loss Ratio
              </p>
            </PortalCardContent>
          </PortalCard>
        </div>

        {/* Charts Row */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          {/* P&L Chart */}
          <PortalCard>
            <PortalCardHeader>
              <PortalCardTitle>P&L Over Time</PortalCardTitle>
              <LineChart className="text-foreground-subtle h-4 w-4" />
            </PortalCardHeader>
            <PortalCardContent>
              <div className="flex h-48 items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="text-border-accent mx-auto mb-2 h-10 w-10" />
                  <p className="text-foreground-subtle text-xs">
                    Chart coming soon
                  </p>
                </div>
              </div>
            </PortalCardContent>
          </PortalCard>

          {/* Win/Loss Distribution */}
          <PortalCard>
            <PortalCardHeader>
              <div className="flex items-center justify-between">
                <PortalCardTitle>Win/Loss Distribution</PortalCardTitle>
                <Target className="text-foreground-subtle h-4 w-4" />
              </div>
            </PortalCardHeader>
            <PortalCardContent>
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-positive">Winning Trades</span>
                    <span className="text-foreground">{winningTrades}</span>
                  </div>
                  <div className="bg-border h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-positive h-full rounded-full"
                      style={{
                        width: `${totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-negative">Losing Trades</span>
                    <span className="text-foreground">{losingTrades}</span>
                  </div>
                  <div className="bg-border h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-negative h-full rounded-full"
                      style={{
                        width: `${totalTrades > 0 ? (losingTrades / totalTrades) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              {/* Additional Stats */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-background rounded-lg p-2 shadow-sm">
                  <div className="text-foreground-muted text-2xs">Avg Win</div>
                  <div className="text-positive text-sm font-medium">
                    {formatUSD(avgWin)}
                  </div>
                </div>
                <div className="bg-background rounded-lg p-2 shadow-sm">
                  <div className="text-foreground-muted text-2xs">Avg Loss</div>
                  <div className="text-negative text-sm font-medium">
                    -{formatUSD(avgLoss)}
                  </div>
                </div>
              </div>
            </PortalCardContent>
          </PortalCard>
        </div>

        {/* Trading Stats */}
        <PortalCard>
          <PortalCardHeader>
            <div className="flex items-center justify-between">
              <PortalCardTitle>Trading Statistics</PortalCardTitle>
              <Calendar className="text-foreground-subtle h-4 w-4" />
            </div>
          </PortalCardHeader>

          <PortalCardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div className="bg-background rounded-lg p-3 text-center shadow-sm">
                <div className="text-foreground-muted text-2xs mb-1">
                  Account Balance
                </div>
                <div className="text-foreground text-sm font-bold">
                  {formatUSD(balance?.total || 0)}
                </div>
              </div>
              <div className="bg-background rounded-lg p-3 text-center shadow-sm">
                <div className="text-foreground-muted text-2xs mb-1">
                  Available
                </div>
                <div className="text-foreground text-sm font-bold">
                  {formatUSD(balance?.available || 0)}
                </div>
              </div>
              <div className="bg-background rounded-lg p-3 text-center shadow-sm">
                <div className="text-foreground-muted text-2xs mb-1">
                  In Positions
                </div>
                <div className="text-foreground text-sm font-bold">
                  {formatUSD(balance?.margin || 0)}
                </div>
              </div>
              <div className="bg-background rounded-lg p-3 text-center shadow-sm">
                <div className="text-foreground-muted text-2xs mb-1">
                  Open Positions
                </div>
                <div className="text-foreground text-sm font-bold">
                  {positions?.length || 0}
                </div>
              </div>
              <div className="bg-background rounded-lg p-3 text-center shadow-sm">
                <div className="text-foreground-muted text-2xs mb-1">
                  Best Trade
                </div>
                <div className="text-positive text-sm font-bold">
                  {formatUSD(
                    Math.max(...(transactions?.map((t) => t.pnl || 0) || [0]))
                  )}
                </div>
              </div>
              <div className="bg-background rounded-lg p-3 text-center shadow-sm">
                <div className="text-foreground-muted text-2xs mb-1">
                  Worst Trade
                </div>
                <div className="text-negative text-sm font-bold">
                  {formatUSD(
                    Math.min(...(transactions?.map((t) => t.pnl || 0) || [0]))
                  )}
                </div>
              </div>
            </div>
          </PortalCardContent>
        </PortalCard>
      </div>
    </div>
  );
}
