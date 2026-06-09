"use client";

import { useState, useMemo } from "react";
import { Search, ArrowUpDown, Eye, EyeOff } from "lucide-react";
import { type UserBalance, type SupportedAsset } from "@/services/ApiClient";
import { AssetIcon } from "./AssetIcon";

interface AssetTableProps {
  balances: UserBalance[];
  assets: SupportedAsset[];
  activeTab: "all" | "funding" | "trading" | "earn";
}

type SortKey = "symbol" | "available" | "locked" | "total";
type SortDirection = "asc" | "desc";

export function AssetTable({ balances, assets, activeTab }: AssetTableProps) {
  const [search, setSearch] = useState("");
  const [hideZero, setHideZero] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  // Merge balances with asset info for complete display
  const mergedAssets = useMemo(() => {
    // Build a map of balances by symbol
    const balanceMap = new Map(balances.map((b) => [b.asset_symbol, b]));

    // Build a map of assets by symbol
    const assetMap = new Map(assets.map((a) => [a.symbol, a]));

    // Get all unique symbols from both sources
    const allSymbols = new Set([
      ...balances.map((b) => b.asset_symbol),
      ...assets.map((a) => a.symbol),
    ]);

    return Array.from(allSymbols).map((symbol) => {
      const balance = balanceMap.get(symbol);
      const asset = assetMap.get(symbol);

      return {
        symbol,
        name: balance?.asset_name || asset?.name || symbol,
        icon_url: balance?.icon_url || asset?.icon_url || null,
        asset_type: asset?.asset_type || "native",
        is_stablecoin: asset?.is_stablecoin ?? false,
        available: parseFloat(balance?.available || "0"),
        locked: parseFloat(balance?.locked || "0"),
        total: parseFloat(balance?.total || "0"),
        networks: asset?.networks || [],
        is_active: asset?.is_active ?? true,
      };
    });
  }, [balances, assets]);

  // Filter and sort
  const filteredAssets = useMemo(() => {
    let filtered = mergedAssets;

    // Tab filter
    if (activeTab !== "all") {
      filtered = filtered.filter((a) => {
        if (activeTab === "funding") return a.is_stablecoin;
        if (activeTab === "trading") return !a.is_stablecoin;
        if (activeTab === "earn") return a.total > 0; // "Earn" shows assets with balance
        return true;
      });
    }

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
      );
    }

    // Hide zero balances
    if (hideZero) {
      filtered = filtered.filter((a) => a.total > 0);
    }

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "symbol") {
        cmp = a.symbol.localeCompare(b.symbol);
      } else {
        cmp = a[sortKey] - b[sortKey];
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [mergedAssets, activeTab, search, hideZero, sortKey, sortDirection]);

  const SortHeader = ({
    label,
    sortKeyName,
    align = "right",
  }: {
    label: string;
    sortKeyName: SortKey;
    align?: "left" | "right";
  }) => (
    <button
      onClick={() => handleSort(sortKeyName)}
      className={`group flex items-center gap-1 text-xs font-semibold tracking-wider uppercase transition-colors ${
        align === "right" ? "ml-auto" : ""
      } ${
        sortKey === sortKeyName
          ? "text-primary"
          : "text-foreground-muted hover:text-foreground"
      }`}
    >
      {label}
      <ArrowUpDown
        className={`h-3 w-3 transition-opacity ${
          sortKey === sortKeyName
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-50"
        }`}
      />
    </button>
  );

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex items-center justify-between gap-4">
        {/* Search */}
        <div className="relative max-w-xs flex-1">
          <Search className="text-foreground-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tokens..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-foreground bg-background-elevated border-border placeholder:text-foreground-muted focus:border-primary w-full rounded-lg border py-2 pr-3 pl-9 text-sm transition-colors outline-none"
          />
        </div>

        {/* Hide zero toggle */}
        <button
          onClick={() => setHideZero(!hideZero)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            hideZero
              ? "border-primary text-primary bg-primary/10"
              : "border-border text-foreground-muted hover:text-foreground hover:border-primary"
          }`}
        >
          {hideZero ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          Hide zero balances
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-white/5">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 bg-zinc-900/50">
              <th className="px-4 py-3 text-left">
                <SortHeader label="Token" sortKeyName="symbol" align="left" />
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="Available" sortKeyName="available" />
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="Locked" sortKeyName="locked" />
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="Total" sortKeyName="total" />
              </th>
              <th className="px-4 py-3 text-right">
                <span className="text-foreground-muted text-xs font-semibold tracking-wider uppercase">
                  Networks
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <p className="text-foreground-muted text-sm">
                    {search
                      ? "No tokens match your search"
                      : hideZero
                        ? "No tokens with balance"
                        : "No tokens available"}
                  </p>
                </td>
              </tr>
            ) : (
              filteredAssets.map((asset, index) => (
                <tr
                  key={`${asset.symbol}-${index}`}
                  className="border-b border-white/5 transition-colors last:border-0 hover:bg-zinc-800/30"
                >
                  {/* Token */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <AssetIcon
                        iconUrl={asset.icon_url}
                        symbol={asset.symbol}
                        size={32}
                      />
                      <div>
                        <p className="text-foreground text-sm font-semibold">
                          {asset.name}
                        </p>
                        <p className="text-foreground-muted text-xs">
                          {asset.symbol}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Available */}
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-mono text-sm ${
                        asset.available > 0
                          ? "text-foreground font-medium"
                          : "text-foreground-muted"
                      }`}
                    >
                      {formatBalance(asset.available, asset.symbol)}
                    </span>
                  </td>

                  {/* Locked */}
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-mono text-sm ${
                        asset.locked > 0
                          ? "font-medium text-yellow-500"
                          : "text-foreground-muted"
                      }`}
                    >
                      {formatBalance(asset.locked, asset.symbol)}
                    </span>
                  </td>

                  {/* Total */}
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-mono text-sm ${
                        asset.total > 0
                          ? "text-foreground font-semibold"
                          : "text-foreground-muted"
                      }`}
                    >
                      {formatBalance(asset.total, asset.symbol)}
                    </span>
                  </td>

                  {/* Networks */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {asset.networks.length > 0 ? (
                        asset.networks.slice(0, 3).map((net) => (
                          <span
                            key={net.network_code || net.network_name}
                            className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-400"
                          >
                            {net.network_code || net.network_name}
                          </span>
                        ))
                      ) : (
                        <span className="text-foreground-muted text-xs">—</span>
                      )}
                      {asset.networks.length > 3 && (
                        <span className="text-foreground-muted text-[10px]">
                          +{asset.networks.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between px-1">
        <p className="text-foreground-muted text-xs">
          {filteredAssets.length} token{filteredAssets.length !== 1 ? "s" : ""}
          {hideZero && ` (${mergedAssets.length} total)`}
        </p>
        <p className="text-foreground-muted text-xs">
          Total:{" "}
          <span className="text-foreground font-medium">
            {formatBalance(
              filteredAssets.reduce((sum, a) => sum + a.total, 0),
              "USD"
            )}
          </span>
        </p>
      </div>
    </div>
  );
}

function formatBalance(value: number, symbol: string): string {
  if (value === 0) return "0.00";

  const isFiat = ["USD", "MXN", "EUR"].includes(symbol);
  const isStable = ["USDT", "USDC", "DAI"].includes(symbol);

  if (isFiat || isStable) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Crypto: show up to 8 decimals, trim trailing zeros
  if (value < 0.001) {
    return value.toFixed(8).replace(/0+$/, "").replace(/\.$/, ".0");
  }
  if (value < 1) {
    return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, ".0");
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}
