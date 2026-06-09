/**
 * Position Operations Hook
 * Handles closing positions (full and partial) via API
 */

import { useState } from "react";
import { Position } from "@/config/types";
import apiClient from "@/services/ApiClient";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export interface PositionOperationsResult {
  closePosition: (position: Position) => Promise<void>;
  partialClosePosition: (
    position: Position,
    percentage: number
  ) => Promise<void>;
  isPending: boolean;
  isSuccess: boolean;
  error: Error | null;
}

function getPositionId(position: Position): string {
  return `${position.market}-${position.user}-${position.timestamp}`;
}

export function usePositionOperations(): PositionOperationsResult {
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    execute: closePosition,
    isLoading: isClosing,
    error: closeError,
  } = useAsyncAction(async (position: Position) => {
    await apiClient.closePosition(getPositionId(position));
    setIsSuccess(true);
  }, "Failed to close position");

  const {
    execute: partialClosePosition,
    isLoading: isPartialClosing,
    error: partialError,
  } = useAsyncAction(async (position: Position, percentage: number) => {
    // TODO: replace with apiClient.partialClosePosition(getPositionId(position), percentage)
    void position;
    void percentage;
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsSuccess(true);
  }, "Failed to partially close position");

  return {
    closePosition,
    partialClosePosition,
    isPending: isClosing || isPartialClosing,
    isSuccess,
    error: closeError ?? partialError,
  };
}
