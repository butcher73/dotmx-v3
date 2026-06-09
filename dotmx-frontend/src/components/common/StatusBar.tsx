"use client";

import { useState, useEffect } from "react";
import { Server, TrendingUp } from "lucide-react";

interface StatusBarProps {
  bitgetConnectionStatus?: {
    isConnected: boolean;
    connectionState?: string;
    latency: number;
    reconnectAttempts?: number;
    messagesReceived?: number;
    lastUpdate?: number;
    error?: string | null;
    symbol?: string;
  };
}

// Helper to get status color based on connection and latency
const getStatusColor = (isConnected: boolean, latency?: number) => {
  if (!isConnected) return "bg-negative";
  if (!latency || latency === 0) return "bg-yellow-500";
  if (latency < 150) return "bg-positive";
  if (latency < 300) return "bg-yellow-500";
  return "bg-negative";
};

// Status indicator component
const StatusIndicator = ({
  icon: Icon,
  label,
  isConnected,
  latency,
}: {
  icon: typeof Server;
  label: string;
  isConnected: boolean;
  latency?: number;
}) => (
  <div className="flex items-center gap-1.5">
    <div
      className={`h-1.5 w-1.5 rounded-full ${getStatusColor(isConnected, latency)}`}
    />
    <Icon className="h-3 w-3" />
    <span className="text-foreground-subtle">
      {isConnected ? label : `${label} Offline`}
      {isConnected && latency && latency > 0 && (
        <span className="text-foreground-muted ml-1">({latency}ms)</span>
      )}
    </span>
  </div>
);

export default function StatusBar({ bitgetConnectionStatus }: StatusBarProps) {
  const [mounted, setMounted] = useState(false);
  const [apiStatus, setApiStatus] = useState({
    isConnected: false,
    latency: 0,
  });

  useEffect(() => {
    setMounted(true);

    const checkHealth = async () => {
      const start = performance.now();
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api"}/health`,
          { signal: controller.signal, cache: "no-store" }
        );

        setApiStatus({
          isConnected: response.ok,
          latency: Math.round(performance.now() - start),
        });
      } catch {
        setApiStatus({ isConnected: false, latency: 0 });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <div className="border-border bg-background-elevated border-t px-4 py-1.5">
      <div className="text-foreground-muted flex items-center justify-between text-xs">
        <StatusIndicator
          icon={Server}
          label="API"
          isConnected={apiStatus.isConnected}
          latency={apiStatus.latency}
        />
        {bitgetConnectionStatus && (
          <StatusIndicator
            icon={TrendingUp}
            label="Market Feed"
            isConnected={bitgetConnectionStatus.isConnected}
            latency={bitgetConnectionStatus.latency}
          />
        )}
      </div>
    </div>
  );
}
