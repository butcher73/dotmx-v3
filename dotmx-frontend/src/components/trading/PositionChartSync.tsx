/**
 * PositionChartSync Component
 * Automatically syncs positions from blockchain to TradingView chart display
 */

"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "@/hooks/useAuth";
import { usePositions } from "@/hooks/usePositions";
import { usePositionsData } from "@/hooks/useTrading";
import { symbolsMatch } from "@/utils/symbol";

interface PositionChartSyncProps {
  symbol: string; // Current chart symbol (e.g., "BTCUSDT")
}

export function PositionChartSync({ symbol }: PositionChartSyncProps) {
  const { address, isConnected } = useAccount();
  const { addPosition, removePosition, clearAllPositions, getPositions } =
    usePositions();
  const { orders, isLoading, error } = usePositionsData(); // orders contains position data

  // Track current position IDs to detect removals
  const previousPositionIdsRef = useRef<Set<string>>(new Set());

  // Sync positions to chart whenever they change
  useEffect(() => {
    if (!isConnected || !address) {
      // Clear all positions when wallet disconnected
      clearAllPositions();
      previousPositionIdsRef.current.clear();
      return;
    }

    if (isLoading || error) {
      return;
    }

    if (!orders || orders.length === 0) {
      // Clear positions if none exist
      clearAllPositions();
      previousPositionIdsRef.current.clear();
      return;
    }

    // Filter positions for current symbol
    const symbolPositions = orders.filter((order) => {
      return symbolsMatch(order.symbol, symbol);
    });

    // Get current position IDs from the data
    const currentPositionIds = new Set(
      symbolPositions.map((order) => order.id)
    );

    // Remove positions that no longer exist
    const existingPositions = getPositions();
    existingPositions.forEach((pos) => {
      if (!currentPositionIds.has(pos.id)) {
        removePosition(pos.id);
      }
    });

    // Also check previousPositionIdsRef for any missed removals
    previousPositionIdsRef.current.forEach((id) => {
      if (!currentPositionIds.has(id)) {
        removePosition(id);
      }
    });

    // Add/update each position on the chart
    symbolPositions.forEach((order) => {
      try {
        // Use entryPrice directly (already a number from API)
        const entryPrice = order.entryPrice;
        const leverage = 1; // Default leverage since API doesn't provide it
        const positionId = order.id;

        // For long: liqPrice = entryPrice * (1 - 1/leverage)
        // For short: liqPrice = entryPrice * (1 + 1/leverage)
        const isLong = order.side === "LONG";
        const liqMultiplier = isLong ? 1 - 1 / leverage : 1 + 1 / leverage;
        const liquidationPrice = entryPrice * liqMultiplier;

        // Use size directly (already a number from API)
        const quantity = order.size;
        // Use pnl directly
        const pnl = order.pnl;

        addPosition({
          id: positionId,
          symbol,
          side: isLong ? "long" : "short",
          avgPrice: entryPrice,
          quantity,
          leverage,
          liquidationPrice,
          ...(pnl !== 0 && {
            unrealizedPnl: pnl,
          }),
        });
      } catch (err) {
        console.error("[PositionChartSync] Error adding position:", err, order);
      }
    });

    // Update the ref with current position IDs
    previousPositionIdsRef.current = currentPositionIds;
  }, [
    orders,
    isLoading,
    error,
    isConnected,
    address,
    symbol,
    addPosition,
    removePosition,
    clearAllPositions,
    getPositions,
  ]);

  // Clear positions when symbol changes
  useEffect(() => {
    clearAllPositions();
    previousPositionIdsRef.current.clear();
  }, [symbol, clearAllPositions]);

  // This component doesn't render anything visible
  return null;
}
