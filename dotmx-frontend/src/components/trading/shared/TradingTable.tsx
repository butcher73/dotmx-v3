"use client";

import React from "react";

interface TradingTableProps {
  children: React.ReactNode;
  className?: string;
}

interface TradingTableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface TradingTableHeaderCellProps {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}

interface TradingTableBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface TradingTableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

interface TradingTableCellProps {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}

// Main table wrapper
export function TradingTable({ children, className = "" }: TradingTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">{children}</table>
    </div>
  );
}

// Table header wrapper
export function TradingTableHeader({
  children,
  className = "",
}: TradingTableHeaderProps) {
  return (
    <thead
      className={`border-border bg-background-card sticky top-0 z-10 border-b backdrop-blur-sm ${className}`}
    >
      {children}
    </thead>
  );
}

// Header cell component
export function TradingTableHeaderCell({
  children,
  className = "",
  align = "left",
}: TradingTableHeaderCellProps) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align];

  return (
    <th
      className={`px-3 py-2.5 ${alignClass} text-foreground-muted text-xs font-semibold tracking-wide uppercase ${className}`}
    >
      {children}
    </th>
  );
}

// Table body wrapper
export function TradingTableBody({
  children,
  className = "",
}: TradingTableBodyProps) {
  return (
    <tbody className={`divide-y divide-gray-800/40 ${className}`}>
      {children}
    </tbody>
  );
}

// Table row component
export function TradingTableRow({
  children,
  className = "",
  onClick,
}: TradingTableRowProps) {
  return (
    <tr
      className={`hover:bg-background-hover transition-colors duration-150 ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

// Table cell component
export function TradingTableCell({
  children,
  className = "",
  align = "left",
}: TradingTableCellProps) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align];

  return <td className={`px-3 py-3 ${alignClass} ${className}`}>{children}</td>;
}
