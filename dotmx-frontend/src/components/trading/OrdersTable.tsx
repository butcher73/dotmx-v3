"use client";

/**
 * OrdersTable Component - Perpetual Futures Trading
 *
 * Tabs: Positions | Open Orders | Trade History
 * Auto-refresh every 10s, manual refresh, consistent design.
 */

import { useState, useEffect } from "react";
import ActiveOrdersTable from "./ActiveOrdersTable";
import PositionsTable from "./PositionsTable";
import TradeHistoryTable from "./TradeHistoryTable";
import { useTradingOperations } from "@/hooks";
import { Layers, ListOrdered, History, RefreshCw } from "lucide-react";

// Types
type TabKey = "positions" | "orders" | "history";

interface TabDef {
  key: TabKey;
  label: string;
  count: number;
  icon: React.ElementType;
}

// ── Tab Button ──────────────────────────────────────────────────
function TabButton({
  tab,
  isActive,
  onClick,
}: {
  tab: TabDef;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors select-none ${
        isActive
          ? "text-foreground"
          : "text-foreground-muted hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{tab.label}</span>
      {tab.count > 0 && (
        <span
          className={`ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded px-1 text-[10px] leading-none font-semibold ${
            isActive
              ? "bg-accent/15 text-accent"
              : "bg-background-elevated text-foreground-muted"
          }`}
        >
          {tab.count > 99 ? "99+" : tab.count}
        </span>
      )}
      {/* Active indicator line */}
      {isActive && (
        <span className="bg-accent absolute right-3 bottom-0 left-3 h-[2px] rounded-full" />
      )}
    </button>
  );
}

// ── Main Component ──────────────────────────────────────────────
export default function OrdersTable() {
  const [activeTab, setActiveTab] = useState<TabKey>("positions");
  const [isMounted, setIsMounted] = useState(false);

  const { orders, positions, isRefreshingPnl, manualRefresh } =
    useTradingOperations();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-refresh on new trades
  useEffect(() => {
    const handler = () => manualRefresh();
    window.addEventListener("newTradeSuccess", handler);
    return () => window.removeEventListener("newTradeSuccess", handler);
  }, [manualRefresh]);

  const tabs: TabDef[] = [
    {
      key: "positions",
      label: "Positions",
      count: positions.length,
      icon: Layers,
    },
    {
      key: "orders",
      label: "Open Orders",
      count: orders.length,
      icon: ListOrdered,
    },
    { key: "history", label: "Trade History", count: 0, icon: History },
  ];

  if (!isMounted) return null;

  return (
    <div className="border-border bg-background flex h-full flex-col overflow-hidden border">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="border-border flex items-center justify-between border-b px-1">
        <div className="flex">
          {tabs.map((tab) => (
            <TabButton
              key={tab.key}
              tab={tab}
              isActive={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>

        <button
          onClick={() => manualRefresh()}
          disabled={isRefreshingPnl}
          className="text-foreground-muted hover:text-foreground mr-2 p-1.5 transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefreshingPnl ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {activeTab === "positions" && <PositionsTable />}
        {activeTab === "orders" && <ActiveOrdersTable />}
        {activeTab === "history" && <TradeHistoryTable />}
      </div>
    </div>
  );
}
