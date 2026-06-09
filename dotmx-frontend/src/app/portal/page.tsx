"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useBalance, usePositionsData, useTransactionHistory } from "@/hooks";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { formatUSD, formatPnL } from "@/utils/formatting";
import {
  PortalPageLayout,
  PortalPageHeader,
  PortalCard,
  PortalCardContent,
  StatsBox,
  List,
  ListItem,
  ListEmptyState,
  Loader,
} from "@/components/ui";

export default function PortalDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { balance, isLoading: balanceLoading } = useBalance();
  const { orders: positions, isLoading: positionsLoading } = usePositionsData();

  // Fetch transactions from backend API database
  const { transactions, isLoading: transactionsLoading } =
    useTransactionHistory(5);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return (
      <PortalPageLayout>
        <div className="mb-6">
          <div className="bg-border mb-1.5 h-6 w-32 animate-pulse rounded" />
          <div className="bg-border h-4 w-48 animate-pulse rounded" />
        </div>
        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-background-card h-24 animate-pulse rounded-xl border border-[#333]"
            />
          ))}
        </div>
      </PortalPageLayout>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const totalBalance = balance?.total ?? 0;
  const availableBalance = balance?.available ?? 0;
  const unrealizedPnL =
    positions?.reduce((sum, pos) => sum + (pos.pnl || 0), 0) || 0;
  const openPositions = positions?.length || 0;

  return (
    <PortalPageLayout>
      <PortalPageHeader
        title="Dashboard"
        description="Overview of your trading activity"
      />

      {/* Balance Cards Grid */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {balanceLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-zinc-800/50 bg-zinc-900"
            />
          ))
        ) : (
          <>
            <StatsBox
              label="Total Balance"
              value={formatUSD(totalBalance)}
              icon={Wallet}
              variant="default"
            />
            <StatsBox
              label="Available"
              value={formatUSD(availableBalance)}
              icon={Wallet}
              variant="default"
            />
            <StatsBox
              label="Unrealized P&L"
              value={formatPnL(unrealizedPnL)}
              icon={unrealizedPnL >= 0 ? TrendingUp : TrendingDown}
              variant={unrealizedPnL >= 0 ? "success" : "danger"}
            />
            <StatsBox
              label="Open Positions"
              value={openPositions.toString()}
              icon={Activity}
              variant="default"
            />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Link
          href="/trade/perp"
          className="group flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 transition-all hover:border-blue-500/50 hover:bg-blue-500/20"
        >
          <span className="text-sm font-semibold text-white">
            Start Trading
          </span>
          <ArrowUpRight className="h-4 w-4 text-blue-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
        <Link
          href="/portal/deposit"
          className="group flex items-center justify-between rounded-xl border border-zinc-800/50 bg-zinc-900 px-5 py-4 transition-all hover:border-zinc-700/50 hover:bg-zinc-800/50"
        >
          <span className="text-sm font-medium text-white">Deposit</span>
          <ArrowUpRight className="h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
        <Link
          href="/portal/portfolio"
          className="group flex items-center justify-between rounded-xl border border-zinc-800/50 bg-zinc-900 px-5 py-4 transition-all hover:border-zinc-700/50 hover:bg-zinc-800/50"
        >
          <span className="text-sm font-medium text-white">Portfolio</span>
          <ArrowUpRight className="h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>

      {/* Open Positions Table */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-foreground text-sm font-semibold uppercase">
            Open Positions
          </h2>
          <Link
            href="/portal/portfolio"
            className="text-accent hover:text-accent/80 text-xs font-medium transition-colors"
          >
            View all →
          </Link>
        </div>

        {positionsLoading ? (
          <PortalCard>
            <PortalCardContent>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-border h-12 animate-pulse rounded"
                  />
                ))}
              </div>
            </PortalCardContent>
          </PortalCard>
        ) : positions && positions.length > 0 ? (
          <PortalCard className="overflow-hidden">
            {/* Table Header */}
            <div className="bg-background-elevated border-border grid grid-cols-5 gap-4 border-b px-4 py-2.5">
              <div className="text-foreground-muted text-xs font-medium uppercase">
                Market
              </div>
              <div className="text-foreground-muted text-xs font-medium uppercase">
                Side
              </div>
              <div className="text-foreground-muted text-right text-xs font-medium uppercase">
                Size
              </div>
              <div className="text-foreground-muted text-right text-xs font-medium uppercase">
                Entry
              </div>
              <div className="text-foreground-muted text-right text-xs font-medium uppercase">
                P&L
              </div>
            </div>

            {/* Table Rows */}
            <div className="divide-border divide-y">
              {positions.slice(0, 5).map((position, index) => (
                <div
                  key={index}
                  className="hover:bg-background-elevated grid grid-cols-5 gap-4 px-4 py-3 transition-colors"
                >
                  <div className="text-foreground text-sm font-medium">
                    {position.symbol}
                  </div>
                  <div>
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${position.side === "LONG" ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"}`}
                    >
                      {position.side}
                    </span>
                  </div>
                  <div className="text-foreground text-right text-sm">
                    {position.size.toFixed(4)}
                  </div>
                  <div className="text-foreground-muted text-right text-sm">
                    {formatUSD(position.entryPrice)}
                  </div>
                  <div
                    className={`text-right text-sm font-medium ${(position.pnl || 0) >= 0 ? "text-positive" : "text-negative"}`}
                  >
                    {formatPnL(position.pnl || 0)}
                  </div>
                </div>
              ))}
            </div>
          </PortalCard>
        ) : (
          <PortalCard>
            <PortalCardContent className="py-12 text-center">
              <Activity className="text-foreground-muted mx-auto mb-3 h-10 w-10 opacity-40" />
              <p className="text-foreground-muted mb-2 text-sm">
                No open positions
              </p>
              <Link
                href="/trade/perp"
                className="text-accent hover:text-accent/80 text-sm font-medium transition-colors"
              >
                Start trading →
              </Link>
            </PortalCardContent>
          </PortalCard>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-foreground text-sm font-semibold uppercase">
            Recent Activity
          </h2>
          <Link
            href="/portal/transactions"
            className="text-accent hover:text-accent/80 text-xs font-medium transition-colors"
          >
            View all →
          </Link>
        </div>

        {transactionsLoading ? (
          <PortalCard>
            <PortalCardContent>
              <Loader size="md" text="Loading transactions..." />
            </PortalCardContent>
          </PortalCard>
        ) : transactions && transactions.length > 0 ? (
          <PortalCard className="overflow-hidden">
            <PortalCardContent className="p-0">
              <List>
                {transactions.slice(0, 5).map((tx, index) => (
                  <ListItem
                    key={index}
                    icon={Activity}
                    iconColor={
                      tx.type.includes("Buy") || tx.type.includes("Long")
                        ? "text-emerald-400"
                        : "text-red-400"
                    }
                    title={tx.type}
                    description={new Date(tx.timestamp * 1000).toLocaleString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                    metadata={
                      <div className="text-right">
                        <div
                          className={`text-sm font-medium ${
                            tx.type.includes("Buy") || tx.type.includes("Long")
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {formatUSD(tx.amount)}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {tx.market || tx.pair}
                        </div>
                      </div>
                    }
                  />
                ))}
              </List>
            </PortalCardContent>
          </PortalCard>
        ) : (
          <PortalCard>
            <PortalCardContent>
              <ListEmptyState
                icon={Activity}
                title="No recent activity"
                description="Your trading activity will appear here"
              />
            </PortalCardContent>
          </PortalCard>
        )}
      </div>
    </PortalPageLayout>
  );
}
