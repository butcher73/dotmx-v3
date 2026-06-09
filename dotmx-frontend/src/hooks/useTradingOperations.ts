/**
 * Trading Operations Hook
 * Fetches real trading data from the backend API
 */

import { useState, useCallback, useEffect } from "react";
import { useInterval } from "@/hooks/useInterval";
import { Order, Position } from "@/config/types";
import { useAccount } from "@/hooks/useAuth";
import { apiClient, type Order as ApiOrder } from "@/services/ApiClient";

interface UseTradingOperationsResult {
  orders: Order[];
  positions: Position[];
  loadingActions: Record<string, boolean>;
  isLoading: boolean;
  error: Error | null;
  handleClosePosition: (position: Position) => Promise<void>;
  handleCancelOrder: (orderId: string) => Promise<void>;
  refetch: () => Promise<void>;
  autoRefresh: boolean;
  isRefreshingPnl: boolean;
  setAutoRefresh: (value: boolean) => void;
  manualRefresh: () => void;
}

/**
 * Transform API order to the Order type used by the UI
 */
function transformApiOrder(apiOrder: ApiOrder): Order {
  return {
    id: apiOrder.orderId,
    time: apiOrder.createdAt || new Date().toISOString(),
    symbol: apiOrder.symbol,
    side: apiOrder.side === "BUY" ? "long" : "short",
    type:
      (apiOrder.type?.toLowerCase() as "limit" | "market" | "stop") || "market",
    amount: apiOrder.quantity,
    price: apiOrder.price || 0,
    status: mapOrderStatus(apiOrder.status),
    leverage: undefined,
    fee: undefined,
    entryPrice: apiOrder.price,
    sizeUSD: (apiOrder.quantity || 0) * (apiOrder.price || 0),
  };
}

function mapOrderStatus(status: string): Order["status"] {
  switch (status?.toUpperCase()) {
    case "NEW":
    case "PARTIALLY_FILLED":
      return "active";
    case "FILLED":
      return "executed";
    case "CANCELLED":
    case "CANCELED":
    case "REJECTED":
    case "EXPIRED":
      return "cancelled";
    case "LIQUIDATED":
      return "liquidated";
    default:
      return "active";
  }
}

/**
 * Hook for trading operations (orders, positions management)
 * Fetches real data from the backend API
 */
export function useTradingOperations(): UseTradingOperationsResult {
  const { isConnected } = useAccount();
  const [orders, setOrders] = useState<Order[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshingPnl, setIsRefreshingPnl] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isConnected) {
      setOrders([]);
      setPositions([]);
      return;
    }

    setIsRefreshingPnl(true);
    try {
      // Fetch open orders and positions in parallel
      const [ordersResult, positionsResult] = await Promise.allSettled([
        apiClient.getOpenOrders(),
        apiClient.getPositions(),
      ]);

      if (ordersResult.status === "fulfilled") {
        const apiOrders = ordersResult.value.orders || [];
        setOrders(apiOrders.map(transformApiOrder));
      }

      if (positionsResult.status === "fulfilled") {
        const apiPositions = positionsResult.value.positions || [];
        // Map API positions to config Position type
        setPositions(
          apiPositions.map(
            (p: {
              symbol: string;
              size: number;
              margin: number;
              entryPrice: number;
              side: string;
              pnl: number;
            }) => ({
              market: p.symbol,
              size: BigInt(Math.round(p.size * 1e6)),
              margin: BigInt(Math.round(p.margin * 1e6)),
              leverage:
                p.entryPrice > 0
                  ? Math.round((p.size * p.entryPrice) / p.margin)
                  : 1,
              isLong: p.side === "LONG",
              price: BigInt(Math.round(p.entryPrice * 1e6)),
              funding: BigInt(0),
              upl: BigInt(Math.round(p.pnl * 1e6)),
              user: "",
              timestamp: Date.now(),
            })
          )
        );
      }

      setError(null);
    } catch (err) {
      console.error("Error fetching trading data:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to fetch trading data")
      );
    } finally {
      setIsLoading(false);
      setIsRefreshingPnl(false);
    }
  }, [isConnected]);

  // Initial fetch
  useEffect(() => {
    if (isConnected) {
      setIsLoading(true);
      fetchData();
    }
  }, [isConnected, fetchData]);

  // Auto-refresh every 10 seconds when connected
  useInterval(fetchData, autoRefresh && isConnected ? 10_000 : null);

  const handleClosePosition = useCallback(
    async (position: Position) => {
      const positionId = `${position.market}-${position.timestamp}`;
      setLoadingActions((prev) => ({ ...prev, [positionId]: true }));

      try {
        await apiClient.closePosition(positionId);
        // Refetch data after closing
        await fetchData();
      } catch (err) {
        console.error("Failed to close position:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to close position")
        );
      } finally {
        setLoadingActions((prev) => ({ ...prev, [positionId]: false }));
      }
    },
    [fetchData]
  );

  const handleCancelOrder = useCallback(
    async (orderId: string) => {
      setLoadingActions((prev) => ({ ...prev, [orderId]: true }));

      try {
        await apiClient.cancelOrder(orderId);
        // Refetch data after cancelling
        await fetchData();
      } catch (err) {
        console.error("Failed to cancel order:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to cancel order")
        );
      } finally {
        setLoadingActions((prev) => ({ ...prev, [orderId]: false }));
      }
    },
    [fetchData]
  );

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const manualRefresh = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  return {
    orders,
    positions,
    loadingActions,
    isLoading,
    error,
    handleClosePosition,
    handleCancelOrder,
    refetch,
    autoRefresh,
    isRefreshingPnl,
    setAutoRefresh,
    manualRefresh,
  };
}
