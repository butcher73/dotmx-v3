"use client";

import React, { useEffect, useState } from "react";
import { Activity, WifiOff, Wifi } from "lucide-react";

interface WebSocketIndicatorProps {
  className?: string;
}

export const WebSocketIndicator: React.FC<WebSocketIndicatorProps> = ({
  className = "",
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    // Listen for WebSocket data feed events
    const handleDataFeed = () => {
      setIsConnected(true);
      setLastUpdate(new Date());
      setUpdateCount((prev) => prev + 1);

      // Flash indicator on update
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 200);
    };

    const handleConnection = (event: Event) => {
      const customEvent = event as CustomEvent<{ connected: boolean }>;
      setIsConnected(customEvent.detail.connected);
    };

    // Add event listeners
    window.addEventListener("ws-data-update", handleDataFeed);
    window.addEventListener("ws-connection-status", handleConnection);

    return () => {
      window.removeEventListener("ws-data-update", handleDataFeed);
      window.removeEventListener("ws-connection-status", handleConnection);
    };
  }, []);

  // Format time ago
  const getTimeAgo = () => {
    if (!lastUpdate) return "No data";

    const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);

    if (seconds < 1) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-2 text-xs backdrop-blur-sm ${className}`}
    >
      {/* Connection Status Icon */}
      <div className="relative">
        {isConnected ? (
          <Wifi className="h-4 w-4 text-emerald-400" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-400" />
        )}

        {/* Pulse animation when connected */}
        {isConnected && (
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        )}
      </div>

      {/* Activity Indicator */}
      <Activity
        className={`h-4 w-4 transition-all duration-200 ${
          isFlashing
            ? "scale-125 text-blue-400"
            : isConnected
              ? "text-slate-400"
              : "text-slate-600"
        }`}
      />

      {/* Status Text */}
      <div className="flex flex-col">
        <span
          className={`font-medium ${
            isConnected ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {isConnected ? "Live" : "Disconnected"}
        </span>
        {isConnected && (
          <span className="text-[10px] text-slate-500">{getTimeAgo()}</span>
        )}
      </div>

      {/* Update Counter */}
      {isConnected && updateCount > 0 && (
        <div className="ml-2 flex items-center gap-1 text-slate-400">
          <span className="text-[10px]">{updateCount.toLocaleString()}</span>
          <span className="text-[10px]">updates</span>
        </div>
      )}
    </div>
  );
};

export default WebSocketIndicator;
