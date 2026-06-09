"use client";

import { TransactionTable } from "@/components/trading/TransactionTable";
import Link from "next/link";

interface ProcessedTransaction {
  id: string;
  timestamp: string;
  market: string;
  size: string;
  price: string;
  pnl?: number;
  isLong: boolean;
}

interface RecentTransactionsSectionProps {
  recentTransactions: ProcessedTransaction[];
  transactionsLoading: boolean;
  transactionsError: string | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
}

export function RecentTransactionsSection({
  recentTransactions,
  transactionsLoading,
  transactionsError,
  isConnected,
  isCorrectNetwork,
}: RecentTransactionsSectionProps) {
  return (
    <div
      className="bg-background-card rounded-lg p-4 shadow-sm"
      style={{ border: "1px solid #333" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">
          Recent Transactions
        </h3>
        <Link
          href="/portal/portfolio"
          className="text-accent hover:text-accent-hover text-sm transition-colors"
        >
          View All
        </Link>
      </div>

      <TransactionTable
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transactions={(recentTransactions as any) || []}
        isLoading={transactionsLoading}
        error={transactionsError}
        isConnected={isConnected}
        isCorrectNetwork={isCorrectNetwork}
      />
    </div>
  );
}
