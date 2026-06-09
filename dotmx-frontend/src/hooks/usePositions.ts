/**
 * usePositions Hook
 * Easy-to-use React hook for managing trading positions on the chart
 */

import { useCallback } from "react";
import { positionService, type Position } from "@/services/PositionService";

export function usePositions() {
  /**
   * Add or update a position on the chart
   */
  const addPosition = useCallback((position: Position) => {
    positionService.addPosition(position);
  }, []);

  /**
   * Remove a position from the chart
   */
  const removePosition = useCallback((positionId: string) => {
    positionService.removePosition(positionId);
  }, []);

  /**
   * Update an existing position
   */
  const updatePosition = useCallback(
    (positionId: string, updates: Partial<Position>) => {
      positionService.updatePosition(positionId, updates);
    },
    []
  );

  /**
   * Get all positions
   */
  const getPositions = useCallback((): Position[] => {
    return positionService.getPositions();
  }, []);

  /**
   * Clear all positions
   */
  const clearAllPositions = useCallback(() => {
    positionService.clearAll();
  }, []);

  return {
    addPosition,
    removePosition,
    updatePosition,
    getPositions,
    clearAllPositions,
  };
}

// Export Position type for convenience
export type { Position } from "@/services/PositionService";
