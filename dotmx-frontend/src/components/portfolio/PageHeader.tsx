"use client";

import { BarChart3 } from "lucide-react";

interface PageHeaderProps {
  mounted: boolean;
}

export function PageHeader({ mounted }: PageHeaderProps) {
  if (!mounted) return null;

  return (
    <div className="space-y-3">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-1.5 text-xs">
        <span className="text-foreground-subtle font-medium">DotMX</span>
        <svg
          className="text-foreground-disabled h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <span className="text-foreground-muted font-medium">Portal</span>
        <svg
          className="text-foreground-disabled h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <span className="text-accent font-medium">Portfolio</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-3">
          <div className="bg-accent flex h-9 w-9 items-center justify-center rounded">
            <BarChart3 className="text-foreground h-4 w-4" />
          </div>

          <div className="space-y-0.5">
            <h1 className="text-foreground text-xl font-bold tracking-tight">
              Portfolio Dashboard
            </h1>
            <p className="text-foreground-muted text-sm">
              Monitor positions, track performance, and manage your trading
              portfolio
            </p>
          </div>
        </div>

        {/* Live market status indicator */}
        <div className="flex items-center space-x-2 pt-1">
          <div className="flex items-center space-x-1.5">
            <div className="bg-positive h-1.5 w-1.5 animate-pulse rounded-full" />
            <span className="text-positive text-xs font-medium">
              Markets Live
            </span>
          </div>
          <div className="bg-border-accent h-1 w-1 rounded-full" />
          <span className="text-foreground-subtle text-xs font-medium">
            Last updated:{" "}
            {new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
