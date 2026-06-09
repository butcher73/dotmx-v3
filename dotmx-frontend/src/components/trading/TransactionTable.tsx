"use client";

import { useState, useEffect } from "react";
import { formatSizeUSD } from "@/utils/formatting";

interface Transaction {
  id: string;
  time: string;
  pair: string;
  side: "Long" | "Short";
  leverage: number;
  price: number;
  amount: number;
  total: number;
  initialMargin?: number | undefined;
  markPrice?: number | undefined;
  liquidPrice?: number | undefined;
  fee: number;
  pnl?: number | undefined;
  pnlPercentage?: number | undefined;
  type: string;
  txHash: string;
  orderId: string;
  orderType: number;
  market: string;
  isLong: boolean;
  size: number;
  margin: number;
  positionMargin?: number | undefined;
  positionSize?: number | undefined;
  positionPrice?: number | undefined;
  liquidationPrice?: number | undefined;
  liquidatorFee?: number | undefined;
  keeperFee?: number | undefined;
  fundingFee?: number | undefined;
  isReduceOnly: boolean;
  status: string;
  timestamp: number;
  blockNumber: number;
}

interface TransactionTableProps {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
}

export function TransactionTable({
  transactions,
  isLoading,
  error,
  isConnected,
  isCorrectNetwork,
}: TransactionTableProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatStatus = (status?: string) => {
    if (!status) return "N/A";
    switch (status.toLowerCase()) {
      case "executed":
        return (
          <span className="border-positive/30 bg-positive/20 text-positive rounded-full border px-2 py-1 text-xs font-semibold">
            Executed
          </span>
        );
      case "active":
        return (
          <span className="border-warning/30 bg-warning/20 text-warning rounded-full border px-2 py-1 text-xs font-semibold">
            Active
          </span>
        );
      case "cancelled":
        return (
          <span className="border-negative/30 bg-negative/20 text-negative rounded-full border px-2 py-1 text-xs font-semibold">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="border-border bg-background-elevated text-foreground-muted rounded-full border px-2 py-1 text-xs font-semibold">
            {status}
          </span>
        );
    }
  };

  const formatCurrency = (value: number | undefined, decimals: number = 2) => {
    if (value === undefined || value === null || isNaN(value)) {
      return "0.00";
    }
    return value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatPnL = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) {
      return "$0.00";
    }
    const sign = value >= 0 ? "+" : "-";
    return `${sign}$${Math.abs(value).toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-2">
            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-[var(--accent)]"></div>
            <span className="text-[var(--muted)]">Loading transactions...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
        <div className="text-negative py-8 text-center">
          Error loading transactions: {error}
        </div>
      </div>
    );
  }

  // Show loading state until component is mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-2">
            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-[var(--accent)]"></div>
            <span className="text-[var(--muted)]">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
        <div className="py-8 text-center text-[var(--muted)]">
          Log in to view transactions
        </div>
      </div>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
        <div className="py-8 text-center text-[var(--muted)]">
          Switch to Arbitrum network to view transactions
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
        <div className="py-8 text-center text-[var(--muted)]">
          No transactions found
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-bg)]">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--background)]/30">
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="p-3 font-medium">Market & Side</th>
              <th className="p-3 font-medium">Size</th>
              <th className="p-3 font-medium">Price</th>
              <th className="p-3 font-medium">Margin</th>
              <th className="p-3 font-medium">PnL & Fee</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, index) => (
              <tr
                key={tx.id || index}
                className="group border-b border-[var(--border)]/20 text-sm transition-all duration-300 hover:bg-linear-to-r hover:from-[var(--accent)]/5 hover:to-transparent"
              >
                {/* Market & Side */}
                <td className="p-3">
                  <div className="flex flex-col space-y-1">
                    <span className="text-foreground text-sm font-medium">
                      {tx.market || tx.pair}
                    </span>
                    <span
                      className={`w-fit rounded px-2 py-0.5 text-xs font-semibold ${
                        tx.isLong
                          ? "border-positive/30 bg-positive/20 text-positive border"
                          : "border-negative/30 bg-negative/20 text-negative border"
                      }`}
                    >
                      {tx.isLong ? "Long" : "Short"}
                    </span>
                  </div>
                </td>

                {/* Size */}
                <td className="p-3">
                  <div className="flex flex-col space-y-1">
                    <span className="mono-font text-foreground text-sm font-medium">
                      ${formatSizeUSD(tx.size)}
                    </span>
                  </div>
                </td>

                {/* Price */}
                <td className="p-3">
                  <span className="mono-font text-foreground text-sm font-medium">
                    ${formatCurrency(tx.price)}
                  </span>
                </td>

                {/* Margin */}
                <td className="p-3">
                  <span className="mono-font text-foreground text-sm font-medium">
                    ${formatCurrency(tx.margin)}
                  </span>
                </td>

                {/* PnL & Fee */}
                <td className="p-3">
                  <div className="flex flex-col space-y-1">
                    {tx.pnl !== undefined ? (
                      <span
                        className={`mono-font text-sm font-medium ${
                          tx.pnl >= 0 ? "text-positive" : "text-negative"
                        }`}
                      >
                        {formatPnL(tx.pnl)}
                        {tx.pnlPercentage !== undefined && (
                          <span className="ml-1 text-xs">
                            ({tx.pnlPercentage >= 0 ? "+" : ""}
                            {tx.pnlPercentage.toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-sm text-[var(--muted)]">
                        No PnL
                      </span>
                    )}
                    <span className="mono-font text-xs text-[var(--muted)]">
                      Fee: ${formatCurrency(tx.fee, 4)}
                    </span>
                  </div>
                </td>

                {/* Status */}
                <td className="p-3">{formatStatus(tx.status)}</td>

                {/* Time */}
                <td className="p-3">
                  <span className="mono-font group-hover:text-foreground text-xs text-[var(--muted)] transition-colors duration-200">
                    {tx.time}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
