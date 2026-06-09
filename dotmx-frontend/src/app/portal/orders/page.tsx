"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { usePositionsData } from "@/hooks";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  Search,
  ArrowUpRight,
} from "lucide-react";
import { formatUSD, formatPnL } from "@/utils/formatting";
import {
  PortalPageLayout,
  PortalPageHeader,
  PortalCard,
  PortalCardContent,
} from "@/components/ui";
type OrderTab = "open" | "history" | "trades";
type OrderType = "market" | "limit" | "stop" | "take-profit";
type OrderStatus = "open" | "filled" | "cancelled" | "expired";

interface Order {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  type: OrderType;
  status: OrderStatus;
  price: number;
  size: number;
  filled: number;
  total: number;
  fee: number;
  leverage: number;
  createdAt: number;
  filledAt?: number;
}

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { orders: positions } = usePositionsData();

  const [activeTab, setActiveTab] = useState<OrderTab>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<OrderType | "all">("all");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Mock order history - in real app, fetch from API
  const mockOrders: Order[] = [
    {
      id: "1",
      symbol: "BTC/USDT",
      side: "LONG",
      type: "market",
      status: "filled",
      price: 42500,
      size: 0.1,
      filled: 0.1,
      total: 4250,
      fee: 4.25,
      leverage: 10,
      createdAt: Date.now() - 3600000,
      filledAt: Date.now() - 3590000,
    },
    {
      id: "2",
      symbol: "ETH/USDT",
      side: "SHORT",
      type: "limit",
      status: "open",
      price: 2300,
      size: 1,
      filled: 0,
      total: 2300,
      fee: 0,
      leverage: 5,
      createdAt: Date.now() - 7200000,
    },
  ];

  const openOrders = mockOrders.filter((o) => o.status === "open");
  const orderHistory = mockOrders.filter((o) => o.status !== "open");

  const tabs = [
    { id: "open", label: "Open Orders", count: openOrders.length },
    { id: "history", label: "Order History", count: orderHistory.length },
    { id: "trades", label: "Trade History", count: positions?.length || 0 },
  ];

  if (authLoading) {
    return (
      <PortalPageLayout>
        <div className="mb-6">
          <div className="bg-border mb-1.5 h-6 w-32 animate-pulse rounded" />
          <div className="bg-border h-4 w-48 animate-pulse rounded" />
        </div>
        <div className="bg-background-card h-96 animate-pulse rounded-xl border border-[#333]" />
      </PortalPageLayout>
    );
  }

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case "open":
        return <Clock className="text-warning h-3.5 w-3.5" />;
      case "filled":
        return <CheckCircle className="text-positive h-3.5 w-3.5" />;
      case "cancelled":
      case "expired":
        return <XCircle className="text-negative h-3.5 w-3.5" />;
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case "open":
        return "text-warning bg-warning-muted";
      case "filled":
        return "text-positive bg-positive-muted";
      case "cancelled":
      case "expired":
        return "text-negative bg-negative-muted";
    }
  };

  return (
    <PortalPageLayout>
      <PortalPageHeader
        title="Orders"
        description="Manage your open orders and view order history"
      />

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-[#333]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as OrderTab)}
            className={`flex items-center gap-2.5 border-b-2 px-5 py-3 text-sm font-semibold transition-all duration-200 ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "text-foreground-muted hover:text-foreground hover:border-border border-transparent"
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-foreground"
                  : "bg-background-elevated text-foreground-muted"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6">
        <PortalCard>
          <PortalCardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative max-w-xs min-w-[240px] flex-1">
                <Search className="text-foreground-muted absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by symbol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-background text-foreground placeholder:text-foreground-muted focus:border-primary focus:ring-primary/20 border-border w-full rounded-lg border py-2.5 pr-4 pl-10 text-sm font-medium transition-all focus:ring-1 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <Filter className="text-foreground-muted h-4 w-4" />
                <select
                  value={filterType}
                  onChange={(e) =>
                    setFilterType(e.target.value as OrderType | "all")
                  }
                  className="bg-background text-foreground focus:border-primary focus:ring-primary/20 border-border cursor-pointer rounded-lg border px-4 py-2.5 text-sm font-medium transition-all focus:ring-1 focus:outline-none"
                >
                  <option value="all">All Types</option>
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                  <option value="stop">Stop</option>
                  <option value="take-profit">Take Profit</option>
                </select>
              </div>
            </div>
          </PortalCardContent>
        </PortalCard>
      </div>

      {/* Orders Table */}
      <PortalCard className="overflow-hidden">
        {/* Table Header */}
        <div className="bg-background-elevated border-b border-[#333] px-6 py-4">
          <div className="text-foreground-muted grid grid-cols-8 gap-4 text-xs font-bold tracking-wider uppercase">
            <div>Time</div>
            <div>Symbol</div>
            <div>Side</div>
            <div>Type</div>
            <div className="text-right">Price</div>
            <div className="text-right">Size</div>
            <div className="text-right">Total</div>
            <div className="text-center">Status</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="divide-border divide-y">
          {activeTab === "open" && openOrders.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="text-border-accent mx-auto mb-2 h-8 w-8" />
              <p className="text-foreground-subtle text-sm">No open orders</p>
              <Link
                href="/trade/perp"
                className="text-accent mt-2 inline-flex items-center gap-1 text-xs hover:underline"
              >
                Start Trading <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          )}

          {activeTab === "history" && orderHistory.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="text-border-accent mx-auto mb-2 h-8 w-8" />
              <p className="text-foreground-subtle text-sm">No order history</p>
            </div>
          )}

          {activeTab === "trades" && (!positions || positions.length === 0) && (
            <div className="py-12 text-center">
              <FileText className="text-border-accent mx-auto mb-2 h-8 w-8" />
              <p className="text-foreground-subtle text-sm">No trade history</p>
            </div>
          )}

          {activeTab === "open" &&
            openOrders.map((order) => (
              <div
                key={order.id}
                className="hover:bg-background-elevated grid grid-cols-8 gap-4 border-b border-[#222] px-6 py-4 transition-all duration-150 last:border-0"
              >
                <div className="text-foreground-muted text-xs font-medium">
                  {new Date(order.createdAt).toLocaleString()}
                </div>
                <div className="text-foreground font-semibold">
                  {order.symbol}
                </div>
                <div>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      order.side === "LONG"
                        ? "bg-positive-muted text-positive"
                        : "bg-negative-muted text-negative"
                    }`}
                  >
                    {order.side}
                  </span>
                </div>
                <div className="text-foreground-muted text-sm font-medium capitalize">
                  {order.type}
                </div>
                <div className="text-foreground text-right font-semibold">
                  {formatUSD(order.price)}
                </div>
                <div className="text-foreground text-right font-medium">
                  {order.size}
                </div>
                <div className="text-foreground text-right font-semibold">
                  {formatUSD(order.total)}
                </div>
                <div className="flex justify-center">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}
                  >
                    {getStatusIcon(order.status)}
                    <span className="capitalize">{order.status}</span>
                  </span>
                </div>
              </div>
            ))}

          {activeTab === "history" &&
            orderHistory.map((order) => (
              <div
                key={order.id}
                className="hover:bg-background-elevated grid grid-cols-8 gap-3 px-4 py-3 text-sm transition-colors"
              >
                <div className="text-foreground-subtle text-xs">
                  {new Date(order.createdAt).toLocaleString()}
                </div>
                <div className="text-foreground font-medium">
                  {order.symbol}
                </div>
                <div>
                  <span
                    className={`text-2xs rounded px-1.5 py-0.5 font-medium ${
                      order.side === "LONG"
                        ? "bg-positive-muted text-positive"
                        : "bg-negative-muted text-negative"
                    }`}
                  >
                    {order.side}
                  </span>
                </div>
                <div className="text-foreground-muted capitalize">
                  {order.type}
                </div>
                <div className="text-foreground text-right">
                  {formatUSD(order.price)}
                </div>
                <div className="text-foreground text-right">{order.size}</div>
                <div className="text-foreground text-right">
                  {formatUSD(order.total)}
                </div>
                <div className="flex justify-center">
                  <span
                    className={`text-2xs inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${getStatusColor(order.status)}`}
                  >
                    {getStatusIcon(order.status)}
                    {order.status}
                  </span>
                </div>
              </div>
            ))}

          {activeTab === "trades" &&
            positions?.map((position, index) => (
              <div
                key={index}
                className="hover:bg-background-elevated grid grid-cols-8 gap-3 px-4 py-3 text-sm transition-colors"
              >
                <div className="text-foreground-subtle text-xs">
                  {new Date().toLocaleString()}
                </div>
                <div className="text-foreground font-medium">
                  {position.symbol}
                </div>
                <div>
                  <span
                    className={`text-2xs rounded px-1.5 py-0.5 font-medium ${
                      position.side === "LONG"
                        ? "bg-positive-muted text-positive"
                        : "bg-negative-muted text-negative"
                    }`}
                  >
                    {position.side}
                  </span>
                </div>
                <div className="text-foreground-muted">Market</div>
                <div className="text-foreground text-right">
                  {formatUSD(position.entryPrice)}
                </div>
                <div className="text-foreground text-right">
                  {position.size.toFixed(4)}
                </div>
                <div className="text-foreground text-right">
                  {formatUSD(position.size * position.entryPrice)}
                </div>
                <div className="text-right">
                  <span
                    className={`text-sm font-medium ${
                      (position.pnl || 0) >= 0
                        ? "text-positive"
                        : "text-negative"
                    }`}
                  >
                    {formatPnL(position.pnl || 0)}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </PortalCard>
    </PortalPageLayout>
  );
}
