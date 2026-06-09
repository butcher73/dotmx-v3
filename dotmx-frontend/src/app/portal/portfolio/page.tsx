"use client";

import {
  TabNavigation,
  OverviewTab,
  PositionsList,
  TransactionsTab,
  AnalyticsTab,
} from "@/components/portfolio";
import { useState } from "react";
import { useAccount } from "@/hooks/useAuth";
import { useBalance } from "@/hooks/useTrading";
import {
  usePortfolioChart,
  usePositionsData,
  useTransactionHistory,
} from "@/hooks";
import { formatPnL } from "@/utils/formatting";
import {
  PortalPageLayout,
  PortalPageHeader,
  PortalCard,
  PortalCardContent,
} from "@/components/ui";
const staticData = {
  trendingTokens: [
    {
      symbol: "BTC",
      name: "Bitcoin",
      logo: "/img/token/btc.svg",
      pair: "BTC-PERP",
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      logo: "/img/token/eth.svg",
      pair: "ETH-PERP",
    },
    {
      symbol: "SOL",
      name: "Solana",
      logo: "/img/token/sol.svg",
      pair: "SOL-PERP",
    },
  ],
  announcements: [
    {
      date: "10/09/2024",
      title: "DotMX Protocol v2 launched with enhanced trading features",
    },
    {
      date: "10/09/2024",
      title: "New BTC-USD perpetual futures now available",
    },
    {
      date: "10/09/2024",
      title: "Reduced trading fees for high-volume traders",
    },
    {
      date: "10/09/2024",
      title: "Enhanced liquidation protection mechanisms implemented",
    },
    {
      date: "10/09/2024",
      title: "New risk management tools added to trading interface",
    },
    {
      date: "10/09/2024",
      title: "Partnership with leading DeFi protocols announced",
    },
    { date: "10/09/2024", title: "Mobile trading app beta now available" },
  ],
};

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState("Overview");
  const {
    data: chartData,
    isLoading: chartLoading,
    error: chartError,
  } = usePortfolioChart("1D");

  const { isConnected } = useAccount();
  const { balance: apiBalance, isLoading: balanceLoading } = useBalance();

  // Fetch transactions from backend API database
  const {
    transactions,
    isLoading: transactionsLoading,
    error: transactionsError,
  } = useTransactionHistory(100);

  // Fetch recent transactions from backend API database
  const { transactions: recentTransactions } = useTransactionHistory(5);

  const {
    orders: positionsData,
    isLoading: positionsDataLoading,
    error: positionsDataError,
  } = usePositionsData();

  const isCorrectNetwork = true;
  const protocolBalance = apiBalance?.total ?? 0;
  const positionsLoading = positionsDataLoading;

  const formatBalance = () => {
    if (!isConnected) return "Log In";
    if (balanceLoading) return "Loading...";
    if (!protocolBalance) return "$0.00";
    const balance = protocolBalance.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `$${balance}`;
  };

  const formatPnLPercentage = (value: number) => {
    if (transactionsLoading || positionsDataLoading) return "Loading...";
    if (transactionsError || positionsDataError) return "Error";
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const calculatePortfolioMetrics = () => {
    let totalMargin = 0;
    let positionCount = 0;
    let unrealizedPnl = 0;
    let realizedPnl = 0;
    let winningTrades = 0;
    let totalClosedTrades = 0;

    if (
      positionsData &&
      Array.isArray(positionsData) &&
      positionsData.length > 0
    ) {
      positionsData.forEach((position) => {
        if (position && position.margin) {
          totalMargin += Number(position.margin);
          positionCount++;
        }
        if (position && position.pnl !== undefined) {
          unrealizedPnl += Number(position.pnl);
        }
      });
    }

    if (transactions && Array.isArray(transactions)) {
      transactions.forEach((transaction) => {
        if (
          transaction &&
          transaction.pnl !== undefined &&
          transaction.pnl !== 0
        ) {
          realizedPnl += transaction.pnl;
          totalClosedTrades++;
          if (transaction.pnl > 0) winningTrades++;
        }
      });
    }

    const totalPnl = unrealizedPnl + realizedPnl;
    const pnlPercentage = totalMargin > 0 ? (totalPnl / totalMargin) * 100 : 0;
    const winRate =
      totalClosedTrades > 0 ? (winningTrades / totalClosedTrades) * 100 : 0;

    return {
      totalValue: totalMargin,
      pnl: totalPnl,
      positionCount,
      pnlPercentage,
      unrealizedPnl,
      realizedPnl,
      winRate,
    };
  };

  const portfolioMetrics = calculatePortfolioMetrics();
  const tabs = ["Overview", "Positions", "Transactions", "Analytics"];

  return (
    <PortalPageLayout>
      <PortalPageHeader
        title="Portfolio"
        description="Track your trading performance and positions"
      />

      {/* Key Metrics */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {/* Total Value */}
        <PortalCard>
          <PortalCardContent>
            <div className="text-foreground-muted mb-2 text-xs font-medium uppercase">
              Total Value
            </div>
            <div className="text-foreground mb-1 text-3xl font-bold">
              {formatBalance()}
            </div>
            <div className="text-foreground-subtle text-sm">USD</div>
          </PortalCardContent>
        </PortalCard>

        {/* Unrealized P&L */}
        <PortalCard>
          <PortalCardContent>
            <div className="text-foreground-muted mb-2 text-xs font-medium uppercase">
              Unrealized P&L
            </div>
            <div
              className={`mb-1 text-3xl font-bold ${
                portfolioMetrics.pnl >= 0 ? "text-positive" : "text-negative"
              }`}
            >
              {formatPnL(portfolioMetrics.pnl)}
            </div>
            <div
              className={`text-sm font-medium ${
                portfolioMetrics.pnl >= 0 ? "text-positive" : "text-negative"
              }`}
            >
              {formatPnLPercentage(portfolioMetrics.pnlPercentage)}
            </div>
          </PortalCardContent>
        </PortalCard>

        {/* Open Positions */}
        <PortalCard>
          <PortalCardContent>
            <div className="text-foreground-muted mb-2 text-xs font-medium uppercase">
              Open Positions
            </div>
            <div className="text-foreground mb-1 text-3xl font-bold">
              {portfolioMetrics.positionCount}
            </div>
            <div className="text-foreground-subtle text-sm">Active trades</div>
          </PortalCardContent>
        </PortalCard>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "Overview" && (
          <OverviewTab
            chartData={chartData}
            chartLoading={chartLoading}
            chartError={chartError}
            recentTransactions={recentTransactions.map((tx) => ({
              id: tx.id,
              timestamp: new Date(tx.timestamp * 1000).toISOString(),
              time: tx.time,
              market: tx.pair,
              pair: tx.pair,
              size: tx.amount.toString(),
              amount: tx.amount,
              price: tx.price.toString(),
              margin: tx.margin,
              fee: tx.fee,
              total: tx.total,
              pnl: tx.pnl || 0,
              isLong: tx.side === "Long",
              side: tx.side,
              leverage: tx.leverage,
              type: tx.type,
              txHash: tx.txHash,
              orderId: tx.orderId,
              orderType: tx.orderType,
              status: tx.status,
            }))}
            transactionsLoading={transactionsLoading}
            transactionsError={transactionsError}
            isConnected={isConnected}
            isCorrectNetwork={isCorrectNetwork}
            staticData={staticData}
          />
        )}

        {activeTab === "Positions" && (
          <PositionsList
            isConnected={isConnected}
            isCorrectNetwork={isCorrectNetwork}
            positionsLoading={positionsLoading}
            positionsDataLoading={positionsDataLoading}
            userPositions={[]}
            positionsData={positionsData?.map((pos, index) => ({
              id: `${pos.symbol}-${index}`,
              symbol: pos.symbol,
              side: pos.side === "LONG" ? "long" : "short",
              sizeUSD: pos.size,
              entryPrice: pos.entryPrice,
              marketPrice: pos.currentPrice,
              unrealizedPnl: pos.pnl,
              leverage: 1,
            }))}
            portfolioMetrics={portfolioMetrics}
          />
        )}

        {activeTab === "Transactions" && (
          <TransactionsTab
            transactions={transactions || []}
            isLoading={transactionsLoading}
            error={transactionsError}
            isConnected={isConnected}
            isCorrectNetwork={isCorrectNetwork}
          />
        )}

        {activeTab === "Analytics" && <AnalyticsTab />}
      </div>
    </PortalPageLayout>
  );
}
