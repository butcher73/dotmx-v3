"use client";

import { formatPnL, formatPercentage } from "@/utils/formatting";

interface PortfolioMetricsData {
  totalValue: number;
  pnl: number;
  pnlPercentage: number;
  positionCount: number;
  realizedPnl?: number;
  unrealizedPnl?: number;
  winRate?: number;
}

interface PortfolioMetricsProps {
  portfolioMetrics: PortfolioMetricsData;
  formatBalance: () => string;
}

export function PortfolioMetrics({
  portfolioMetrics,
  formatBalance,
}: PortfolioMetricsProps) {
  return (
    <div
      className="bg-background-card mb-5 rounded-lg p-5 shadow-sm"
      style={{ border: "1px solid #333" }}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-foreground-muted mb-1 text-xs font-medium">
            Total Account Value
          </h2>
          <div className="text-foreground mb-0.5 text-3xl font-bold">
            {formatBalance()}
          </div>
          <div className="flex items-center space-x-4">
            <span
              className={`text-sm font-medium ${
                portfolioMetrics.pnl >= 0 ? "text-positive" : "text-negative"
              }`}
            >
              {formatPnL(portfolioMetrics.pnl)} (
              {formatPercentage(portfolioMetrics.pnlPercentage)})
            </span>
            <span className="text-foreground-subtle text-sm">24h</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 lg:mt-0 lg:grid-cols-4">
          <div className="text-center lg:text-left">
            <div className="text-foreground-muted text-2xs mb-0.5 font-medium">
              Open Positions
            </div>
            <div className="text-foreground text-lg font-semibold">
              {portfolioMetrics.positionCount}
            </div>
          </div>
          <div className="text-center lg:text-left">
            <div className="text-foreground-muted mb-1 text-xs font-medium">
              Total P&L
            </div>
            <div
              className={`text-xl font-semibold ${
                portfolioMetrics.pnl >= 0 ? "text-positive" : "text-negative"
              }`}
            >
              {formatPnL(portfolioMetrics.pnl)}
            </div>
            {(portfolioMetrics.realizedPnl || 0) !== 0 &&
              (portfolioMetrics.unrealizedPnl || 0) !== 0 && (
                <div className="text-foreground-subtle mt-1 text-xs">
                  R: {formatPnL(portfolioMetrics.realizedPnl || 0)} | U:{" "}
                  {formatPnL(portfolioMetrics.unrealizedPnl || 0)}
                </div>
              )}
          </div>
          <div className="text-center lg:text-left">
            <div className="text-foreground-muted mb-1 text-xs font-medium">
              Unrealized P&L
            </div>
            <div
              className={`text-xl font-semibold ${
                (portfolioMetrics.unrealizedPnl || 0) >= 0
                  ? "text-positive"
                  : "text-negative"
              }`}
            >
              {formatPnL(portfolioMetrics.unrealizedPnl || 0)}
            </div>
          </div>
          <div className="text-center lg:text-left">
            <div className="text-foreground-muted mb-1 text-xs font-medium">
              Win Rate
            </div>
            <div className="text-foreground text-xl font-semibold">
              {Math.round(portfolioMetrics.winRate || 0)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
