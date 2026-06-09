"use client";

interface PortfolioMetrics {
  totalValue: number;
  pnl: number;
  positionCount: number;
  pnlPercentage: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
  winRate: number;
}

interface AccountBalanceCardProps {
  formatBalance: () => string;
  portfolioMetrics: PortfolioMetrics;
  formatPnL: (value: number) => string;
  formatPnLPercentage: (value: number) => string;
  formatPnLDisplay: (value: number, showSign?: boolean) => string;
}

export function AccountBalanceCard({
  formatBalance,
  portfolioMetrics,
  formatPnL,
  formatPnLPercentage,
  formatPnLDisplay,
}: AccountBalanceCardProps) {
  return (
    <div
      className="bg-background-card relative overflow-hidden rounded-lg p-5 shadow-sm"
      style={{ border: "1px solid #333" }}
    >
      <div className="relative z-10">
        <div className="flex flex-col space-y-6 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          {/* Main Balance Section */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <h2 className="text-foreground-muted text-xs font-medium tracking-wide uppercase">
                Total Portfolio Value
              </h2>
              <div className="bg-border-accent h-1 w-1 rounded-full" />
              <span className="text-foreground-subtle text-xs font-medium uppercase">
                USD
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-foreground text-3xl font-bold tracking-tight lg:text-4xl">
                {formatBalance()}
              </div>

              <div className="flex items-center space-x-3">
                <span
                  className={`inline-flex items-center space-x-1 text-xs font-semibold lg:text-sm ${
                    portfolioMetrics.pnl >= 0
                      ? "text-positive"
                      : "text-negative"
                  }`}
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      portfolioMetrics.pnl >= 0 ? "bg-positive" : "bg-negative"
                    }`}
                  />
                  <span>
                    {formatPnL(portfolioMetrics.pnl)} (
                    {formatPnLPercentage(portfolioMetrics.pnlPercentage)})
                  </span>
                </span>
                <span className="text-foreground-subtle text-sm font-medium">
                  24H
                </span>
              </div>
            </div>
          </div>

          {/* Portfolio Metrics Grid */}
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-4">
            {/* Open Positions */}
            <div className="space-y-1 text-center lg:text-left">
              <div className="text-foreground-muted text-2xs font-medium tracking-wide uppercase">
                Active Positions
              </div>
              <div className="text-foreground text-xl font-bold lg:text-lg">
                {portfolioMetrics.positionCount}
              </div>
              <div className="text-foreground-subtle text-2xs font-medium">
                Open Trades
              </div>
            </div>

            {/* Total P&L */}
            <div className="space-y-1 text-center lg:text-left">
              <div className="text-foreground-muted text-2xs font-medium tracking-wide uppercase">
                Total P&L
              </div>
              <div
                className={`text-xl font-bold lg:text-lg ${
                  portfolioMetrics.pnl >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {formatPnL(portfolioMetrics.pnl)}
              </div>
              {(portfolioMetrics.realizedPnl || 0) !== 0 &&
                (portfolioMetrics.unrealizedPnl || 0) !== 0 && (
                  <div className="space-y-1">
                    <div className="text-foreground-subtle text-xs font-medium">
                      R:{" "}
                      {formatPnLDisplay(
                        portfolioMetrics.realizedPnl || 0,
                        false
                      )}
                    </div>
                    <div className="text-foreground-subtle text-xs font-medium">
                      U:{" "}
                      {formatPnLDisplay(
                        portfolioMetrics.unrealizedPnl || 0,
                        false
                      )}
                    </div>
                  </div>
                )}
            </div>

            {/* Unrealized P&L */}
            <div className="space-y-1 text-center lg:text-left">
              <div className="text-foreground-muted text-2xs font-medium tracking-wide uppercase">
                Unrealized P&L
              </div>
              <div
                className={`text-xl font-bold lg:text-lg ${
                  (portfolioMetrics.unrealizedPnl || 0) >= 0
                    ? "text-positive"
                    : "text-negative"
                }`}
              >
                {formatPnL(portfolioMetrics.unrealizedPnl || 0)}
              </div>
              <div className="text-foreground-subtle text-xs font-medium">
                Mark-to-Market
              </div>
            </div>

            {/* Win Rate */}
            <div className="space-y-1 text-center lg:text-left">
              <div className="text-foreground-muted text-2xs font-medium tracking-wide uppercase">
                Win Rate
              </div>
              <div className="text-foreground text-xl font-bold lg:text-lg">
                {Math.round(portfolioMetrics.winRate || 0)}%
              </div>
              <div className="text-foreground-subtle text-xs font-medium">
                Success Rate
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
