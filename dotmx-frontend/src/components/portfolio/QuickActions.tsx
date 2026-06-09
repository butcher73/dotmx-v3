"use client";

import { Button } from "@/components/ui";
import Image from "next/image";
import Link from "next/link";

interface TrendingToken {
  symbol: string;
  pair: string;
  name: string;
  logo: string;
  price?: number;
  change?: number;
}

interface Announcement {
  title: string;
  date: string;
}

interface StaticData {
  trendingTokens: TrendingToken[];
  announcements: Announcement[];
}

interface QuickActionsProps {
  staticData: StaticData;
}

export function QuickActions({ staticData }: QuickActionsProps) {
  return (
    <div className="space-y-5">
      {/* Quick Actions */}
      <div
        className="bg-background-card rounded-lg p-4"
        style={{ border: "1px solid #333" }}
      >
        <h3 className="text-foreground mb-4 text-sm font-semibold">
          Quick Actions
        </h3>
        <div className="space-y-2">
          <Link href="/trade">
            <Button className="bg-accent text-foreground hover:bg-accent-hover w-full">
              Start Trading
            </Button>
          </Link>
          <Link href="/portal/lp">
            <Button
              variant="outline"
              className="border-border text-foreground hover:bg-border w-full"
            >
              Add Liquidity
            </Button>
          </Link>
        </div>
      </div>

      {/* Trending Pairs */}
      <div className="border-border bg-background-card rounded-lg border p-4">
        <h3 className="text-foreground mb-3 text-sm font-semibold">
          Trending Pairs
        </h3>
        <div className="space-y-2">
          {staticData.trendingTokens.map((token, index) => (
            <div
              key={index}
              className="group hover:bg-border flex items-center justify-between rounded p-2 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <div className="bg-background flex h-6 w-6 items-center justify-center rounded-full">
                  <Image
                    src={token.logo}
                    alt={token.symbol}
                    width={16}
                    height={16}
                    className="rounded-full"
                  />
                </div>
                <div>
                  <div className="text-foreground text-xs font-medium">
                    {token.pair}
                  </div>
                  <div className="text-foreground-subtle text-2xs">
                    {token.name}
                  </div>
                </div>
              </div>
              <Link href={`/trade/perp?symbol=${token.symbol}`}>
                <Button
                  size="sm"
                  className="bg-accent text-foreground hover:bg-accent-hover relative z-10 px-3 py-1 text-xs transition-transform group-hover:scale-105"
                >
                  Trade
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Announcements */}
      <div
        className="bg-background-card rounded-lg p-4 shadow-sm"
        style={{ border: "1px solid #333" }}
      >
        <h3 className="text-foreground mb-3 text-sm font-semibold">
          Announcements
        </h3>
        <div className="space-y-2">
          {staticData.announcements.slice(0, 5).map((announcement, index) => (
            <div
              key={index}
              className="border-border bg-background rounded border p-2"
            >
              <p className="text-foreground-subtle text-2xs">
                {announcement.date}
              </p>
              <p className="text-foreground-muted text-xs">
                {announcement.title}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
