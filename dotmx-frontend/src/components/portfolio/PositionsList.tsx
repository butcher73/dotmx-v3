"use client";

import { Button } from "@/components/ui";
import Link from "next/link";
import {
  formatErrorAmount,
  formatPrice,
  formatPnL,
  formatLeverageValue,
} from "@/utils/formatting";

function formatUnits(value: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const wholePart = value / divisor;
  const fractionalPart = value % divisor;
  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  return `${wholePart}.${fractionalStr}`;
}

interface Position {
  isLong: boolean;
  timestamp: bigint;
  user: string;
  market: string;
  fundingTracker: bigint;
  price: bigint;
  margin: bigint;
  size: bigint;
}

interface PositionData {
  id?: string;
  symbol?: string;
  side: string;
  sizeUSD?: number;
  entryPrice?: number;
  marketPrice?: number;
  unrealizedPnl?: number;
  leverage?: number;
}

interface PortfolioMetrics {
  positionCount: number;
  totalValue: number;
  unrealizedPnl?: number;
}

interface PositionsListProps {
  isConnected: boolean;
  isCorrectNetwork: boolean;
  positionsLoading: boolean;
  positionsDataLoading: boolean;
  userPositions?: Position[][];
  positionsData?: PositionData[];
  portfolioMetrics: PortfolioMetrics;
}

export function PositionsList({
  isConnected,
  isCorrectNetwork,
  positionsLoading,
  positionsDataLoading,
  userPositions,
  positionsData,
  portfolioMetrics,
}: PositionsListProps) {
  const hasNoPositions =
    (!userPositions ||
      (Array.isArray(userPositions) &&
        userPositions.length === 2 &&
        userPositions[0]?.length === 0)) &&
    (!positionsData || positionsData.length === 0);

  const hasPositions =
    (positionsData && positionsData.length > 0) ||
    (userPositions && Array.isArray(userPositions) && userPositions.length > 0);

  if (positionsLoading || positionsDataLoading) {
    return (
      <div className="py-12 text-center">
        <div className="border-accent mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        <div className="text-foreground-muted">Loading positions...</div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="py-12 text-center">
        <div className="text-foreground-muted mb-4">
          Log in to view your trading positions
        </div>
        <Button className="bg-accent text-foreground hover:bg-accent-hover">
          Log In
        </Button>
      </div>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <div className="py-12 text-center">
        <div className="text-negative mb-4">
          Please switch to Arbitrum network to view your positions
        </div>
        <div className="text-foreground-muted text-sm">
          Current network is not supported
        </div>
      </div>
    );
  }

  if (hasNoPositions) {
    return (
      <div className="py-12 text-center">
        <div className="mb-2 text-6xl opacity-20">📊</div>
        <div className="text-foreground-muted mb-4 text-lg font-medium">
          No open positions
        </div>
        <div className="text-foreground-subtle mb-6 text-sm">
          Start trading to see your positions here
        </div>
        <div className="flex justify-center gap-4">
          <Link href="/trade">
            <Button className="bg-accent text-foreground hover:bg-accent-hover">
              Start Trading
            </Button>
          </Link>
          <Link href="/docs/trading">
            <Button
              variant="outline"
              className="border-border text-foreground hover:bg-border"
            >
              Learn Trading
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {positionsData && positionsData.length > 0 ? (
        <div className="space-y-2">
          <div
            className="text-foreground-muted grid grid-cols-6 gap-3 pb-2 text-xs font-medium"
            style={{ borderBottom: "1px solid #333" }}
          >
            <div>Market</div>
            <div>Side</div>
            <div>Size (USD)</div>
            <div>Entry Price</div>
            <div>Mark Price</div>
            <div>PnL</div>
          </div>
          {positionsData.map((position, index) => (
            <div
              key={position.id || index}
              className="grid grid-cols-6 gap-3 rounded p-3 text-sm transition-colors"
              style={{ border: "1px solid #333" }}
            >
              <div className="text-foreground text-xs font-medium">
                {position.symbol || "Unknown Market"}
              </div>
              <div
                className={`font-medium ${
                  position.side === "long" ? "text-positive" : "text-negative"
                }`}
              >
                {position.side === "long" ? "Long" : "Short"}
              </div>
              <div className="text-foreground">
                $
                {position.sizeUSD
                  ? formatErrorAmount(position.sizeUSD)
                  : "0.00"}
              </div>
              <div className="text-foreground">
                $
                {position.entryPrice
                  ? formatPrice(position.entryPrice)
                  : "0.00"}
              </div>
              <div className="text-foreground">
                $
                {position.marketPrice
                  ? formatPrice(position.marketPrice)
                  : "Loading..."}
              </div>
              <div
                className={`font-medium ${
                  (position.unrealizedPnl || 0) >= 0
                    ? "text-positive"
                    : "text-negative"
                }`}
              >
                {formatPnL(position.unrealizedPnl || 0)}
                {position.leverage && (
                  <div className="text-foreground-subtle mt-1 text-xs">
                    {formatLeverageValue(position.leverage)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : userPositions &&
        Array.isArray(userPositions) &&
        userPositions.length > 0 ? (
        <div className="space-y-4">
          <div
            className="text-foreground-muted grid grid-cols-5 gap-4 pb-3 text-sm font-medium"
            style={{ borderBottom: "1px solid #333" }}
          >
            <div>Market</div>
            <div>Side</div>
            <div>Size</div>
            <div>Entry Price</div>
            <div>Margin</div>
          </div>
          {userPositions.flat().map((position: Position, index) => (
            <div
              key={`${position.user}-${position.market}-${index}`}
              className="grid grid-cols-5 gap-4 rounded-lg p-4 transition-colors"
              style={{ border: "1px solid #333" }}
            >
              <div className="text-foreground font-medium">
                {position.market || "Unknown Market"}
              </div>
              <div
                className={`font-medium ${
                  position.isLong ? "text-positive" : "text-negative"
                }`}
              >
                {position.isLong ? "Long" : "Short"}
              </div>
              <div className="text-foreground">
                {parseFloat(formatUnits(position.size, 18)).toFixed(4)}
              </div>
              <div className="text-foreground">
                ${parseFloat(formatUnits(position.price, 18)).toFixed(2)}
              </div>
              <div className="text-foreground">
                ${parseFloat(formatUnits(position.margin, 6)).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center">
          <div className="text-foreground-muted">
            Unable to load position data
          </div>
        </div>
      )}

      {hasPositions && (
        <div
          className="bg-background-card mt-8 grid grid-cols-1 gap-4 rounded-lg p-4 shadow-sm md:grid-cols-3"
          style={{ border: "1px solid #333" }}
        >
          <div className="text-center">
            <div className="text-foreground-muted text-sm">Total Positions</div>
            <div className="text-foreground text-lg font-semibold">
              {portfolioMetrics.positionCount}
            </div>
          </div>
          <div className="text-center">
            <div className="text-foreground-muted text-sm">Total Margin</div>
            <div className="text-foreground text-lg font-semibold">
              ${portfolioMetrics.totalValue.toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-foreground-muted text-sm">Unrealized PnL</div>
            <div
              className={`text-lg font-semibold ${
                (portfolioMetrics.unrealizedPnl || 0) >= 0
                  ? "text-positive"
                  : "text-negative"
              }`}
            >
              {formatPnL(portfolioMetrics.unrealizedPnl || 0)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
