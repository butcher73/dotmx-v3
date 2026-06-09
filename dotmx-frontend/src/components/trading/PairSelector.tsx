"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Search, ChevronDown, RefreshCw } from "lucide-react";
import { useTradePair } from "@/contexts/TradePairContext";

/** Resolve an asset ticker to its token logo path */
function getTokenLogo(asset: string): string {
  return `/img/token/${asset.toLowerCase()}.svg`;
}

/**
 * PairSelector
 *
 * Dropdown that lists all available perpetual trading pairs fetched from the
 * backend API (via `useTradePair` context). Provides search, loading, error,
 * and retry states.
 */
export default function PairSelector({
  className = "",
}: {
  className?: string;
}) {
  const {
    currentPair,
    pairs,
    isPairsLoading,
    pairsError,
    selectPair,
    refreshPairs,
    searchPairs,
  } = useTradePair();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search when opening
  useEffect(() => {
    if (isOpen) searchRef.current?.focus();
  }, [isOpen]);

  const filteredPairs = query.trim() ? searchPairs(query) : pairs;

  const handleSelect = useCallback(
    (pair: typeof currentPair) => {
      selectPair(pair);
      setIsOpen(false);
      setQuery("");
    },
    [selectPair]
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="bg-background-card hover:bg-background-elevated border-border group flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors"
      >
        {/* Token icon */}
        <div className="bg-background-elevated flex h-7 w-7 items-center justify-center overflow-hidden rounded-full">
          <Image
            src={getTokenLogo(currentPair.asset)}
            alt={currentPair.asset}
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              e.preventDefault();
              const img = e.currentTarget;
              if (img && img.parentElement) {
                img.style.display = "none";
                const parent = img.parentElement;
                const assetName = currentPair?.asset || "?";
                parent.style.backgroundColor = "#f0b90b";
                parent.textContent = "";
                const span = document.createElement("span");
                span.className = "text-white font-medium text-xs";
                span.textContent = assetName.charAt(0);
                parent.appendChild(span);
              }
            }}
          />
        </div>

        {/* Pair label */}
        <span className="text-foreground text-lg font-semibold">
          {currentPair.asset}
        </span>
        <span className="text-foreground-muted text-sm">
          /{currentPair.collateral}
        </span>
        <span className="bg-accent/20 text-accent rounded px-1.5 py-0.5 text-[10px] font-medium uppercase">
          Perp
        </span>

        {/* Spinner or chevron */}
        {isPairsLoading ? (
          <div className="border-accent h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent" />
        ) : (
          <ChevronDown
            className={`text-foreground-muted group-hover:text-foreground h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="border-border bg-background-card absolute top-full left-0 z-50 mt-2 min-w-[300px] overflow-hidden rounded-lg border shadow-xl">
          {/* Search bar */}
          <div className="border-border border-b px-3 py-2">
            <div className="bg-background-elevated border-border flex items-center gap-2 rounded-md border px-2 py-1.5">
              <Search className="text-foreground-muted h-3.5 w-3.5 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search pairs…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="text-foreground placeholder-foreground-muted w-full bg-transparent text-xs outline-none"
              />
            </div>
          </div>

          {/* Error banner */}
          {pairsError && (
            <div className="border-negative/20 bg-negative/5 mx-2 my-2 flex items-center justify-between rounded border px-3 py-2">
              <p className="text-negative text-xs">Failed to load pairs</p>
              <button
                onClick={refreshPairs}
                className="text-negative hover:text-negative/80 flex items-center gap-1 text-xs underline"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          )}

          {/* List */}
          <div className="max-h-80 overflow-y-auto py-1">
            {/* Loading skeleton */}
            {isPairsLoading && pairs.length === 0 && (
              <div className="flex items-center justify-center py-6">
                <div className="border-accent h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
                <span className="text-foreground-muted ml-2 text-xs">
                  Loading pairs…
                </span>
              </div>
            )}

            {/* Pair items */}
            {filteredPairs.map((pair) => {
              const isSelected = currentPair.bitgetSymbol === pair.bitgetSymbol;
              return (
                <button
                  key={pair.bitgetSymbol}
                  onClick={() => handleSelect(pair)}
                  className={`group hover:bg-background-hover flex w-full items-center justify-between px-3 py-2.5 transition-colors ${isSelected ? "bg-background-elevated" : ""
                    }`}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Token icon */}
                    <div className="bg-background-elevated flex h-6 w-6 items-center justify-center overflow-hidden rounded-full">
                      <Image
                        src={getTokenLogo(pair.asset)}
                        alt={pair.asset}
                        width={16}
                        height={16}
                        className="h-4 w-4 object-contain"
                        onError={(
                          e: React.SyntheticEvent<HTMLImageElement>
                        ) => {
                          e.preventDefault();
                          const img = e.currentTarget;
                          if (img && img.parentElement) {
                            img.style.display = "none";
                            const parent = img.parentElement;
                            const assetName = pair?.asset || "?";
                            parent.style.backgroundColor = "#f0b90b";
                            parent.textContent = "";
                            const span = document.createElement("span");
                            span.className = "text-white font-medium text-[10px]";
                            span.textContent = assetName.charAt(0);
                            parent.appendChild(span);
                          }
                        }}
                      />
                    </div>

                    {/* Pair name */}
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-sm font-medium ${isSelected ? "text-accent" : "text-foreground"}`}
                      >
                        {pair.asset}
                      </span>
                      <span className="text-foreground-muted text-xs">
                        /{pair.collateral}
                      </span>
                    </div>

                    {/* Display name */}
                    <span className="text-foreground-subtle text-[10px]">
                      {pair.displayName}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="bg-accent h-1.5 w-1.5 rounded-full" />
                  )}
                </button>
              );
            })}

            {/* Empty search */}
            {!isPairsLoading && filteredPairs.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-foreground-muted text-xs">
                  {query
                    ? "No pairs match your search"
                    : "No markets available"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
