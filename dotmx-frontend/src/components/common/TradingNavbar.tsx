"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function TradingNavbar() {
  const [isMarketsOpen, setIsMarketsOpen] = useState(false);
  const [isTradeOpen, setIsTradeOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[#23345C] bg-linear-to-r from-[#0A0F1C] to-[#111827] backdrop-blur-sm">
      <div className="px-4">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/logo-color-light.svg"
                alt="dotmx logo"
                width={100}
                height={25}
                priority
                unoptimized
                className="h-6 w-auto"
              />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="hidden items-center space-x-1 md:flex">
            {/* Markets Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsMarketsOpen(!isMarketsOpen)}
                className="rounded-md px-3 py-2 text-sm font-medium text-[#A3B8D9] transition-colors hover:bg-[#23345C]/50 hover:text-[#4F90FF]"
              >
                Markets
              </button>
              {isMarketsOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 rounded-md border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] shadow-lg">
                  <Link
                    href="/trade/perp"
                    className="block px-4 py-2 text-sm text-[#A3B8D9] hover:bg-[#23345C]/50 hover:text-[#4F90FF]"
                  >
                    Perp Trading
                  </Link>
                  <div className="cursor-not-allowed px-4 py-2 text-sm text-[#6B7898]">
                    Futures{" "}
                    <span className="ml-2 text-xs text-[#4F90FF]">Soon</span>
                  </div>
                  <div className="cursor-not-allowed px-4 py-2 text-sm text-[#6B7898]">
                    Options{" "}
                    <span className="ml-2 text-xs text-[#4F90FF]">Soon</span>
                  </div>
                </div>
              )}
            </div>

            {/* Trade Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsTradeOpen(!isTradeOpen)}
                className="rounded-md px-3 py-2 text-sm font-medium text-[#A3B8D9] transition-colors hover:bg-[#23345C]/50 hover:text-[#4F90FF]"
              >
                Trade
              </button>
              {isTradeOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 rounded-md border border-[#23345C] bg-linear-to-br from-[#122347] to-[#1A2E57] shadow-lg">
                  <Link
                    href="/trade/perp"
                    className="block px-4 py-2 text-sm text-[#A3B8D9] hover:bg-[#23345C]/50 hover:text-[#4F90FF]"
                  >
                    Perp
                  </Link>
                  <div className="cursor-not-allowed px-4 py-2 text-sm text-[#6B7898]">
                    Margin{" "}
                    <span className="ml-2 text-xs text-[#4F90FF]">Soon</span>
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/analytics"
              className="rounded-md px-3 py-2 text-sm font-medium text-[#A3B8D9] transition-colors hover:bg-[#23345C]/50 hover:text-[#4F90FF]"
            >
              Analytics
            </Link>

            <Link
              href="/portal/portfolio"
              className="rounded-md px-3 py-2 text-sm font-medium text-[#A3B8D9] transition-colors hover:bg-[#23345C]/50 hover:text-[#4F90FF]"
            >
              Portfolio
            </Link>

            <Link
              href="/portal/lp"
              className="rounded-md px-3 py-2 text-sm font-medium text-[#A3B8D9] transition-colors hover:bg-[#23345C]/50 hover:text-[#4F90FF]"
            >
              Liquidity
            </Link>
          </nav>

          {/* Right side actions */}
          <div className="flex items-center space-x-3">
            {/* User Icon */}
            <button className="p-2 text-[#A3B8D9] transition-colors hover:text-[#4F90FF]">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </button>

            {/* Notifications */}
            <button className="relative p-2 text-[#A3B8D9] transition-colors hover:text-[#4F90FF]">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#4F90FF]"></span>
            </button>

            {/* Global Settings */}
            <button className="p-2 text-[#A3B8D9] transition-colors hover:text-[#4F90FF]">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
