"use client";

import React from "react";
import { AlertCircle, Loader2, FileText } from "lucide-react";
import { TableStateProps } from "../../config/types";

// Check if error is auth-related
const isAuthError = (error: string): boolean => {
  const errorText = error.toLowerCase();
  const patterns = [
    "unauthorized",
    "unauthenticated",
    "not authenticated",
    "login",
    "token",
    "session expired",
    "401",
    "403",
  ];
  return patterns.some((pattern) => errorText.includes(pattern));
};

export default function TableState<T = unknown>({
  orders,
  error,
  isLoading,
  children,
  className = "",
}: TableStateProps<T>) {
  const containerClass = `flex flex-col items-center justify-center p-8 text-center ${className}`;

  // Error state
  if (error) {
    const isAuth = isAuthError(error);

    return (
      <div className={containerClass}>
        {isAuth ? (
          <div className="flex flex-col items-center justify-center rounded-lg bg-yellow-600/10 p-6 ring-1 ring-yellow-600/20">
            <div className="flex items-center space-x-2 text-yellow-400">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Please log in</span>
            </div>
            <p className="mt-2 text-sm text-yellow-300">
              Please log in to view your trading activity
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg bg-red-600/10 p-6 ring-1 ring-red-600/20">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Error loading orders</span>
            </div>
            <p className="mt-2 text-sm text-red-300">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={containerClass}>
        <div className="flex items-center space-x-3">
          <Loader2 className="text-accent h-6 w-6 animate-spin" />
          <span className="text-foreground-muted text-sm font-medium">
            Loading orders...
          </span>
        </div>
        <div className="mt-4 flex space-x-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-background-elevated h-2 w-2 animate-pulse rounded-full"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (orders.length === 0) {
    return (
      <div className={containerClass}>
        <div className="flex flex-col items-center space-y-3">
          <FileText className="text-foreground-muted h-8 w-8" />
          <div className="space-y-1">
            <h3 className="text-foreground text-sm font-medium">
              No orders found
            </h3>
            <p className="text-foreground-muted text-sm">
              Log in to start trading and view your activity here
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
