"use client";

import React, { useEffect } from "react";
import { useOrderHistory } from "@/hooks";
import { SideBadge, StatusBadge } from "./shared/TradingBadge";
import {
  formatPrice2DecimalsWithCommas,
  formatUSD,
  formatPnL,
  getPnLColor,
} from "@/utils/formatting";
import { History } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "./shared";

interface TradeHistoryTableProps {
  className?: string;
}

export default function TradeHistoryTable({
  className = "",
}: TradeHistoryTableProps) {
  const { orders, isLoading, error, refetch } = useOrderHistory(50);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener("newTradeSuccess", handler);
    return () => window.removeEventListener("newTradeSuccess", handler);
  }, [refetch]);

  if (error) return <ErrorState message={error} />;
  if (isLoading) return <LoadingState label="Loading history…" />;
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No trade history"
        subtitle="Your completed trades will appear here"
      />
    );
  }

  const headers = [
    "Market",
    "Type",
    "Side",
    "Size",
    "Price",
    "Fee",
    "PnL",
    "Status",
  ];

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead className="border-border sticky top-0 z-10 border-b">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="text-foreground-muted px-3 py-2 text-left text-[11px] font-medium tracking-wider uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {orders.map((order) => {
            const sideKey = order.side === "Long" ? "long" : "short";
            const statusKey = order.status?.toLowerCase() || "executed";

            return (
              <tr
                key={order.id || order.orderId}
                className="hover:bg-background-hover transition-colors"
              >
                <td className="text-foreground px-3 py-2.5 text-xs font-semibold">
                  {order.market}
                </td>
                <td className="text-foreground-muted px-3 py-2.5 text-xs capitalize">
                  {order.orderType}
                </td>
                <td className="px-3 py-2.5">
                  <SideBadge side={sideKey} />
                </td>
                <td className="text-foreground px-3 py-2.5 font-mono text-xs">
                  {order.size.toFixed(4)}
                </td>
                <td className="text-foreground px-3 py-2.5 font-mono text-xs">
                  ${formatPrice2DecimalsWithCommas(order.price)}
                </td>
                <td className="text-foreground-muted px-3 py-2.5 font-mono text-xs">
                  {formatUSD(order.fee)}
                </td>
                <td
                  className={`px-3 py-2.5 font-mono text-xs ${
                    order.pnl !== undefined
                      ? getPnLColor(order.pnl)
                      : "text-foreground-muted"
                  }`}
                >
                  {order.pnl !== undefined ? formatPnL(order.pnl) : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={statusKey} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
