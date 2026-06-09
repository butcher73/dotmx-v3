"use client";

import React, { Component, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error | undefined;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
}

export class TradingErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(
    error: Error,
    errorInfo: { componentStack: string }
  ) {
    console.error("TradingErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <div className="rounded-lg bg-yellow-600/10 p-6 ring-1 ring-yellow-600/20">
            <div className="flex items-center space-x-2 text-yellow-400">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Something went wrong</span>
            </div>
            <p className="mt-2 text-sm text-yellow-300">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() =>
                this.setState({ hasError: false, error: undefined })
              }
              className="mt-4 rounded-md bg-yellow-600/20 px-3 py-1.5 text-xs font-medium text-yellow-300 transition-colors hover:bg-yellow-600/30"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
