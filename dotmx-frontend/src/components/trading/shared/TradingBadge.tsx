"use client";

import React from "react";
import { getSideColor, getStatusColor } from "@/utils/formatting";

type StatusType = "executed" | "cancelled" | "liquidated" | "active";
type SideType = "long" | "short";

interface TradingBadgeProps {
  children: React.ReactNode;
  variant?: "default" | "side" | "status";
  colorType?: SideType | StatusType;
  className?: string;
}

interface SideBadgeProps {
  side: string;
  className?: string;
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

// Base badge component
export function TradingBadge({
  children,
  variant = "default",
  colorType,
  className = "",
}: TradingBadgeProps) {
  const baseClasses =
    "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold";

  let variantClasses = "";

  if (variant === "side") {
    const isLong = colorType === "long";
    variantClasses = isLong
      ? "bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-600/30"
      : "bg-red-600/20 text-red-400 ring-1 ring-red-600/30";
  } else if (variant === "status") {
    switch (colorType) {
      case "executed":
        variantClasses =
          "bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-600/30";
        break;
      case "cancelled":
        variantClasses =
          "bg-background-elevated text-foreground-muted ring-1 ring-border";
        break;
      case "liquidated":
        variantClasses = "bg-red-600/20 text-red-400 ring-1 ring-red-600/30";
        break;
      case "active":
        variantClasses = "bg-blue-600/20 text-blue-400 ring-1 ring-blue-600/30";
        break;
      default:
        variantClasses = "bg-blue-600/20 text-blue-400 ring-1 ring-blue-600/30";
    }
  }

  return (
    <span className={`${baseClasses} ${variantClasses} ${className}`}>
      {children}
    </span>
  );
}

// Specialized side badge
export function SideBadge({ side, className = "" }: SideBadgeProps) {
  const isLong = side.toLowerCase() === "long";

  return (
    <TradingBadge
      variant="side"
      colorType={isLong ? "long" : "short"}
      className={`${getSideColor(side)} ${className}`}
    >
      {side.toUpperCase()}
    </TradingBadge>
  );
}

// Specialized status badge
export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  return (
    <TradingBadge
      variant="status"
      colorType={status as StatusType}
      className={`capitalize ${getStatusColor(status)} ${className}`}
    >
      {status}
    </TradingBadge>
  );
}
