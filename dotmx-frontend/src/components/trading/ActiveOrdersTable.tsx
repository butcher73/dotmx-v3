"use client";

import React, { useCallback } from "react";
import { useTradingOperations } from "@/hooks";
import OrderRow from "./OrderRow";
import { ActiveOrdersTableProps, Order } from "../../config/types";
import {
  TradingTable,
  TradingTableHeader,
  TradingTableHeaderCell,
  TradingTableBody,
} from "./shared/TradingTable";
import { ListOrdered } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "./shared";

export default function ActiveOrdersTable({
  className = "",
}: ActiveOrdersTableProps) {
  const { orders, isLoading, error, refetch } = useTradingOperations();

  const handleOrderCancelled = useCallback(() => {
    refetch?.();
  }, [refetch]);

  if (error) return <ErrorState message={error.message} />;
  if (isLoading) return <LoadingState label="Loading orders…" />;
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={ListOrdered}
        title="No open orders"
        subtitle="Your pending orders will appear here"
      />
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <TradingTable>
        <TradingTableHeader>
          <tr>
            <TradingTableHeaderCell>Time</TradingTableHeaderCell>
            <TradingTableHeaderCell>Pair</TradingTableHeaderCell>
            <TradingTableHeaderCell>Side</TradingTableHeaderCell>
            <TradingTableHeaderCell>Type</TradingTableHeaderCell>
            <TradingTableHeaderCell>Size</TradingTableHeaderCell>
            <TradingTableHeaderCell>Price</TradingTableHeaderCell>
            <TradingTableHeaderCell>Status</TradingTableHeaderCell>
            <TradingTableHeaderCell align="right">
              Actions
            </TradingTableHeaderCell>
          </tr>
        </TradingTableHeader>
        <TradingTableBody>
          {orders.map((order: Order) => (
            <OrderRow
              key={order.id}
              order={order}
              onCancelled={handleOrderCancelled}
            />
          ))}
        </TradingTableBody>
      </TradingTable>
    </div>
  );
}
