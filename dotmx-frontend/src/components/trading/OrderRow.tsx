"use client";

import React from "react";
import { Order } from "../../config/types";
import {
  formatPrice2DecimalsWithCommas,
  formatAmount,
} from "@/utils/formatting";
import OrderActions from "./OrderActions";
import { SideBadge, StatusBadge } from "./shared/TradingBadge";
import { TradingTableRow, TradingTableCell } from "./shared/TradingTable";

interface OrderRowProps {
  order: Order;
  onCancelled?: () => void;
  className?: string;
}

export default function OrderRow({
  order,
  onCancelled,
  className = "",
}: OrderRowProps) {
  const typeLabel = order.type.toUpperCase().replace("_", " ");

  return (
    <TradingTableRow className={className}>
      {/* Time */}
      <TradingTableCell className="text-foreground-muted font-mono text-sm">
        {order.time}
      </TradingTableCell>

      {/* Symbol */}
      <TradingTableCell className="text-foreground text-sm font-semibold">
        {order.symbol}
      </TradingTableCell>

      {/* Side */}
      <TradingTableCell>
        <SideBadge side={order.side} />
      </TradingTableCell>

      {/* Type */}
      <TradingTableCell className="text-foreground-muted text-sm">
        {typeLabel}
      </TradingTableCell>

      {/* Amount */}
      <TradingTableCell className="text-foreground font-mono text-sm">
        {formatAmount(order.amount)}
      </TradingTableCell>

      {/* Price */}
      <TradingTableCell className="text-foreground font-mono text-sm">
        {order.type === "market" ? (
          <span className="text-foreground-muted">Market</span>
        ) : (
          `$${formatPrice2DecimalsWithCommas(order.price)}`
        )}
      </TradingTableCell>

      {/* Status */}
      <TradingTableCell>
        <StatusBadge status={order.status} />
      </TradingTableCell>

      {/* Actions */}
      <TradingTableCell align="right">
        {order.status === "active" && (
          <OrderActions order={order} onCancelled={onCancelled} />
        )}
      </TradingTableCell>
    </TradingTableRow>
  );
}
