/**
 * Trading Hooks - Backend API integration for trading operations
 */

"use client";

import { useState, useEffect } from "react";
import {
  apiClient,
  type OrderRequest,
  type Order as ApiOrder,
  type Position,
} from "@/services/ApiClient";
import { useAuth } from "@/hooks/useAuth";
import { useAsyncAction } from "@/hooks/useAsyncAction";

// =============================================================================
// TYPES
// =============================================================================

export interface Order {
  id: string;
  time: string;
  symbol: string;
  side: "buy" | "sell" | "long" | "short";
  type: "limit" | "market" | "stop";
  amount: number;
  price: number;
  status: "active" | "cancelled" | "executed" | "liquidated";
  leverage?: number | undefined;
  fee?: number | undefined;
  fundingFee?: number | undefined;
  pnl?: number | undefined;
}

// =============================================================================
// TRADING HOOKS - Backend API Integration
// =============================================================================

export function usePlaceOrder() {
  const {
    execute: placeOrder,
    isLoading,
    error,
  } = useAsyncAction(
    (order: OrderRequest) => apiClient.placeOrder(order),
    "Failed to place order"
  );
  return { placeOrder, isLoading, error };
}

export function useCancelOrder() {
  const {
    execute: cancelOrder,
    isLoading,
    error,
  } = useAsyncAction(
    (orderId: string) => apiClient.cancelOrder(orderId),
    "Failed to cancel order"
  );
  return { cancelOrder, isLoading, error };
}

/**
 * Fetches open orders. Call `refetch` to load/reload.
 */
export function useOrders(symbol?: string) {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const {
    execute: fetchOrders,
    isLoading,
    error,
  } = useAsyncAction(async () => {
    const result = await apiClient.getOpenOrders(symbol);
    setOrders(result.orders);
  }, "Failed to fetch orders");
  return { orders, isLoading, error, refetch: fetchOrders };
}

/**
 * Fetches user positions. Call `refresh` to load/reload.
 */
export function usePositionsData() {
  const [positions, setPositions] = useState<Position[]>([]);
  const {
    execute: fetchPositions,
    isLoading,
    error,
  } = useAsyncAction(async () => {
    const result = await apiClient.getPositions();
    setPositions(result.positions || []);
  }, "Failed to fetch positions");
  return {
    orders: positions, // backwards compatibility alias
    isLoading,
    error: error?.message ?? null,
    positions,
    refresh: fetchPositions,
  };
}

export function useClosePosition() {
  const {
    execute: closePosition,
    isLoading,
    error,
  } = useAsyncAction(
    (positionId: string) => apiClient.closePosition(positionId),
    "Failed to close position"
  );
  return { closePosition, isLoading, error };
}

/**
 * Fetches account balance. Auto-fetches when the user is authenticated.
 */
export function useBalance() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [balance, setBalance] = useState<{
    total: number;
    available: number;
    margin: number;
    pnl: number;
  } | null>(null);

  const {
    execute: fetchBalance,
    isLoading,
    error,
  } = useAsyncAction(async () => {
    if (!apiClient.getAuthToken()) return;
    const result = await apiClient.getBalance();
    setBalance(result);
  }, "Failed to fetch balance");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchBalance();
    }
  }, [authLoading, isAuthenticated, fetchBalance]);

  return { balance, isLoading, error, refetch: fetchBalance };
}

export function useAccountMetrics() {
  const [metrics, setMetrics] = useState<{
    totalValue: number;
    availableBalance: number;
    totalMargin: number;
    totalPnl: number;
  } | null>(null);

  const {
    execute: fetchMetrics,
    isLoading,
    error,
  } = useAsyncAction(async () => {
    const result = await apiClient.getAccountMetrics();
    setMetrics(result);
  }, "Failed to fetch metrics");

  return { metrics, isLoading, error, refetch: fetchMetrics };
}
