"use client";

import React, { useState, useRef, useEffect, memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import PairSelector from "./PairSelector";
import MarketStatsBar from "./MarketStatsBar";
import {
  User,
  Wallet,
  History,
  Settings,
  LogOut,
  LogIn,
  ChevronDown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// User menu dropdown (extracted for clarity)
// ---------------------------------------------------------------------------

function UserMenu() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!isAuthenticated) {
    return (
      <Link
        href="/login"
        className="bg-accent hover:bg-accent/90 active:bg-accent/80 inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
      >
        <LogIn className="h-3.5 w-3.5" />
        <span>Login</span>
      </Link>
    );
  }

  const displayName =
    user?.username ||
    user?.email?.split("@")[0] ||
    user?.first_name ||
    "Account";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="bg-background-card hover:bg-background-elevated border-border text-foreground-muted hover:text-foreground flex items-center gap-2 rounded-lg border px-3.5 py-2 transition-colors"
      >
        <div className="bg-accent/15 flex h-5 w-5 items-center justify-center rounded-full">
          <User className="text-accent h-3 w-3" />
        </div>
        <span className="hidden text-xs font-medium sm:inline">
          {displayName}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="border-border absolute top-full right-0 z-50 mt-1.5 w-52 overflow-hidden rounded-lg border"
          style={{ backgroundColor: "#1a1a1a" }}
        >
          <div
            className="border-border border-b px-4 py-2.5"
            style={{ backgroundColor: "#252525" }}
          >
            <p className="truncate text-xs font-semibold text-white">
              {user?.username || user?.email || user?.first_name || "User"}
            </p>
          </div>

          <div className="py-1">
            {[
              { href: "/portal/portfolio", icon: Wallet, label: "Portfolio" },
              { href: "/portal/orders", icon: History, label: "Trade History" },
              { href: "/portal/profile", icon: Settings, label: "Settings" },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-4 py-2 text-xs text-white transition-colors hover:bg-white/10"
                onClick={() => setOpen(false)}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </Link>
            ))}
          </div>

          <div className="border-border border-t py-1">
            <button
              onClick={() => {
                logout();
                setOpen(false);
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
  );
}

// ---------------------------------------------------------------------------
// TradeHeader — top bar of the trading page
// ---------------------------------------------------------------------------

function TradeHeader() {
  return (
    <header className="border-border bg-background sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b px-6">
      {/* Left: logo + pair selector + market stats */}
      <div className="flex items-center gap-8">
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

        <div className="flex items-center gap-6">
          <PairSelector />
          <div className="hidden lg:block">
            <MarketStatsBar />
          </div>
        </div>
      </div>

      {/* Right: user menu */}
      <div className="flex items-center gap-4">
        <UserMenu />
      </div>
    </header>
  );
}

export default memo(TradeHeader);
