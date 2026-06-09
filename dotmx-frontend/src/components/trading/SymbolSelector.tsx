"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { type PerpSymbol } from "@/hooks";

interface SymbolSelectorProps {
  currentSymbol: PerpSymbol;
  symbols: PerpSymbol[];
  onSymbolChange: (symbol: PerpSymbol) => void;
  className?: string;
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
}

export default function SymbolSelector({
  currentSymbol,
  symbols,
  onSymbolChange,
  className = "",
  isLoading = false,
  error = null,
  onRefresh,
}: SymbolSelectorProps) {
  const [showSymbolSelector, setShowSymbolSelector] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        selectorRef.current &&
        !selectorRef.current.contains(event.target as Node)
      ) {
        setShowSymbolSelector(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Get token logo path
  const getTokenLogo = (asset: string) => {
    const assetLower = asset.toLowerCase();
    const assetMap: { [key: string]: string } = {
      bnb: "bnb",
    };
    const fileName = assetMap[assetLower] || assetLower;
    return `/img/token/${fileName}.svg`;
  };

  return (
    <div className={`relative ${className}`} ref={selectorRef}>
      {/* Symbol Button - Compact Professional Style */}
      <button
        onClick={() => setShowSymbolSelector(!showSymbolSelector)}
        className="bg-background-card hover:bg-background-elevated border-border group flex items-center space-x-2 rounded-lg border px-3 py-1.5 transition-colors"
      >
        {/* Token Icon */}
        <div className="bg-background-elevated flex h-7 w-7 items-center justify-center overflow-hidden rounded-full">
          <Image
            src={getTokenLogo(currentSymbol.asset)}
            alt={currentSymbol.asset}
            width={20}
            height={20}
            className="h-5 w-5 object-contain"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              e.preventDefault();
              const img = e.currentTarget;
              if (img && img.parentElement) {
                img.style.display = "none";
                const parent = img.parentElement;
                const assetName = currentSymbol?.asset || "?";
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

        {/* Symbol Name */}
        <span className="text-foreground text-lg font-semibold">
          {currentSymbol.asset}
        </span>
        <span className="text-foreground-muted text-sm">/USDC</span>
        <span className="bg-accent/20 text-accent rounded px-1.5 py-0.5 text-[10px] font-medium uppercase">
          Perp
        </span>

        {/* Dropdown Arrow */}
        {isLoading ? (
          <div className="border-accent h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent" />
        ) : (
          <svg
            className={`text-foreground-muted group-hover:text-foreground h-4 w-4 transition-transform ${showSymbolSelector ? "rotate-180" : ""
              }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Dropdown */}
      {showSymbolSelector && (
        <div className="absolute top-full left-0 z-50 mt-2 min-w-[260px] overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-lg">
          {/* Header */}
          <div className="border-b border-gray-700 bg-gray-800 px-3 py-2">
            <span className="text-foreground-muted text-xs font-medium tracking-wider uppercase">
              Select Market
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {/* Error State */}
            {error && (
              <div className="border-negative/20 bg-negative/5 mx-2 my-2 rounded border px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-negative text-xs">Failed to load</p>
                  {onRefresh && (
                    <button
                      onClick={onRefresh}
                      className="text-negative hover:text-negative/80 text-xs underline"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && symbols.length === 0 && (
              <div className="flex items-center justify-center py-6">
                <div className="border-accent h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
                <span className="text-foreground-muted ml-2 text-xs">
                  Loading...
                </span>
              </div>
            )}

            {/* Symbols List */}
            {symbols.length > 0 &&
              symbols.map((symbol) => {
                const isSelected =
                  currentSymbol.bitgetSymbol === symbol.bitgetSymbol;
                return (
                  <button
                    key={symbol.bitgetSymbol}
                    className={`group hover:bg-background-hover flex w-full items-center justify-between px-3 py-2.5 transition-colors ${isSelected ? "bg-background-elevated" : ""
                      }`}
                    onClick={() => {
                      onSymbolChange(symbol);
                      setShowSymbolSelector(false);
                    }}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="bg-background-elevated flex h-6 w-6 items-center justify-center overflow-hidden rounded-full">
                        <Image
                          src={getTokenLogo(symbol.asset)}
                          alt={symbol.asset}
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
                              const assetName = symbol?.asset || "?";
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
                      <div className="flex items-center space-x-1">
                        <span
                          className={`text-sm font-medium ${isSelected ? "text-accent" : "text-foreground"}`}
                        >
                          {symbol.asset}
                        </span>
                        <span className="text-foreground-muted text-sm">
                          /USDC
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="bg-accent h-1.5 w-1.5 rounded-full" />
                    )}
                  </button>
                );
              })}

            {/* Empty State */}
            {!isLoading && symbols.length === 0 && !error && (
              <div className="py-6 text-center">
                <p className="text-foreground-muted text-xs">
                  No markets available
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
