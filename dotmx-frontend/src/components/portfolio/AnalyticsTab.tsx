"use client";

import { BarChart3 } from "lucide-react";

export function AnalyticsTab() {
  return (
    <div
      className="bg-background-card rounded-xl p-6 shadow-sm"
      style={{ border: "1px solid #333" }}
    >
      <h3 className="text-foreground mb-4 text-lg font-semibold">
        Portfolio Analytics
      </h3>
      <div className="py-12 text-center">
        <BarChart3 className="text-border-accent mx-auto mb-4 h-12 w-12" />
        <div className="text-foreground-muted mb-2">Analytics coming soon</div>
        <div className="text-foreground-subtle text-sm">
          Advanced portfolio analytics and insights will be available here
        </div>
      </div>
    </div>
  );
}
