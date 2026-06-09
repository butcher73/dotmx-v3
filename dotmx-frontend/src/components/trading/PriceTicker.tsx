"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import SymbolSelector from "./SymbolSelector";
import TradingData from "./TradingData";
import { type PerpSymbol } from "@/hooks";
import {
  User,
  Wallet,
  History,
  Settings,
  LogOut,
  LogIn,
  ChevronDown,
} from "lucide-react";

interface PriceTickerProps {
  currentSymbol: PerpSymbol;
  symbols: PerpSymbol[];
  tradingData: {
    currentPrice: number;
    priceChangePercent: number;
    high24h: number;
    low24h: number;
    volume24h: string;
    total24h: string;
    symbol: string;
    asset: string;
  };
  isLoadingSymbols?: boolean;
  symbolsError?: Error | null;
  onRefreshSymbols?: () => void;
  fundingRate?: number;
  nextFundingTime?: string;
  openInterest?: number;
}

function PriceTicker({
  currentSymbol,
  symbols,
  tradingData,
  isLoadingSymbols = false,
  symbolsError = null,
  onRefreshSymbols,
  fundingRate,
  nextFundingTime,
  openInterest,
}: PriceTickerProps) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="border-border bg-background sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b px-6">
      {/* Left: Logo and Symbol */}
      <div className="flex items-center gap-8">
        {/* Logo */}
        <Link href="/" className="block shrink-0">
          <Image
            src="/logo-color-light.svg"
            alt="DotMX"
            width={80}
            height={20}
            priority
            unoptimized
            className="h-5 w-auto cursor-pointer transition-opacity hover:opacity-80"
          />
        </Link>

        {/* Symbol Selector */}
        <div className="flex items-center gap-6">
          <SymbolSelector
            currentSymbol={currentSymbol}
            symbols={symbols}
            onSymbolChange={(sym) => {
              router.push(`/trade/perp?symbol=${sym.bitgetSymbol}`);
            }}
            isLoading={isLoadingSymbols}
            error={symbolsError}
            onRefresh={onRefreshSymbols || (() => {})}
          />

          {/* Market Data */}
          <div className="hidden lg:block">
            <TradingData
              tradingData={tradingData}
              fundingRate={fundingRate}
              nextFundingTime={nextFundingTime}
              openInterest={openInterest}
            />
          </div>
        </div>
      </div>

      {/* Right: User Menu */}
      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="bg-background-card hover:bg-background-elevated border-border text-foreground-muted hover:text-foreground flex items-center gap-2 rounded-lg border px-3.5 py-2 transition-colors"
            >
              <div className="bg-accent/15 flex h-5 w-5 items-center justify-center rounded-full">
                <User className="text-accent h-3 w-3" />
              </div>
              <span className="hidden text-xs font-medium sm:inline">
                {user?.username ||
                  user?.email?.split("@")[0] ||
                  user?.first_name ||
                  "Account"}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showUserMenu ? "rotate-180" : ""}`}
              />
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div
                className="border-border absolute top-full right-0 z-50 mt-1.5 w-52 overflow-hidden rounded-lg border"
                style={{ backgroundColor: "#1a1a1a" }}
              >
                {/* User Info */}
                <div
                  className="border-border border-b px-4 py-2.5"
                  style={{ backgroundColor: "#252525" }}
                >
                  <p className="truncate text-xs font-semibold text-white">
                    {user?.username ||
                      user?.email ||
                      user?.first_name ||
                      "User"}
                  </p>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <Link
                    href="/portal/portfolio"
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-white transition-colors hover:bg-white/10"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    <span>Portfolio</span>
                  </Link>
                  <Link
                    href="/portal/orders"
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-white transition-colors hover:bg-white/10"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>Trade History</span>
                  </Link>
                  <Link
                    href="/portal/profile"
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-white transition-colors hover:bg-white/10"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>Settings</span>
                  </Link>
                </div>

                {/* Logout */}
                <div className="border-border border-t py-1">
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-xs text-white transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="bg-accent hover:bg-accent/90 active:bg-accent/80 inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Login</span>
          </Link>
        )}
      </div>
    </header>
  );
}

export default React.memo(PriceTicker);
