"use client";

import { TransactionTable } from "@/components/trading/TransactionTable";

interface ProcessedTransaction {
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

interface TransactionsTabProps {
  transactions: ProcessedTransaction[];
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
}

export function TransactionsTab({
  transactions,
  isLoading,
  error,
  isConnected,
  isCorrectNetwork,
}: TransactionsTabProps) {
  return (
    <div
      className="bg-background-card rounded-xl p-6 shadow-sm"
      style={{ border: "1px solid #333" }}
    >
      <h3 className="text-foreground mb-4 text-lg font-semibold">
        All Transactions
      </h3>
      <TransactionTable
        transactions={transactions || []}
        isLoading={isLoading}
        error={error}
        isConnected={isConnected}
        isCorrectNetwork={isCorrectNetwork}
      />
    </div>
  );
}
