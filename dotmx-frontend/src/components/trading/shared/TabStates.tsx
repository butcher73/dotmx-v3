"use client";

import React from "react";
import { AlertCircle, Loader2 } from "lucide-react";

// ── Shared empty / loading / error states for all tab panels ────

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}

interface ErrorStateProps {
  message: string;
}

interface LoadingStateProps {
  label?: string;
}

const stateContainer =
  "flex flex-col items-center justify-center py-12 px-4 text-center";

export function EmptyState({ icon: Icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className={stateContainer}>
      <Icon className="text-foreground-subtle mb-3 h-7 w-7" />
      <p className="text-foreground text-sm font-medium">{title}</p>
      <p className="text-foreground-muted mt-0.5 text-xs">{subtitle}</p>
    </div>
  );
}

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className={stateContainer}>
      <div className="flex items-center gap-2 text-red-400">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm font-medium">Something went wrong</span>
      </div>
      <p className="text-foreground-muted mt-1 max-w-xs text-xs">{message}</p>
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: LoadingStateProps) {
  return (
    <div className={stateContainer}>
      <Loader2 className="text-foreground-muted mb-2 h-5 w-5 animate-spin" />
      <p className="text-foreground-muted text-xs">{label}</p>
    </div>
  );
}
