/**
 * Position Service
 * Manages trading positions and displays them on the TradingView chart
 */

export interface Position {
  id: string;
  symbol: string;
  side: "long" | "short";
  avgPrice: number;
  quantity: number;
  leverage: number;
  unrealizedPnl?: number;
  liquidationPrice?: number;
}

export class PositionService {
  private positions: Map<string, Position> = new Map();
  private positionLines: Map<string, any> = new Map(); // eslint-disable-line @typescript-eslint/no-explicit-any
  private chart: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  private pendingPositions: Map<string, Position> = new Map(); // Queue for positions added before chart init

  /**
   * Check if the chart is initialized
   */
  isChartReady(): boolean {
    return this.chart !== null;
  }

  /**
   * Initialize the position service with a TradingView chart instance
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialize(chart: any) {
    this.chart = chart;

    // Draw any pending positions that were added before chart initialization
    if (this.pendingPositions.size > 0) {
      this.pendingPositions.forEach((position) => {
        this.drawPositionLine(position);
      });
      this.pendingPositions.clear();
    }
  }

  /**
   * Add or update a position
   */
  addPosition(position: Position): void {
    this.positions.set(position.id, position);

    // If chart is not ready, queue the position for later
    if (!this.chart) {
      this.pendingPositions.set(position.id, position);
      return;
    }

    this.drawPositionLine(position);
  }

  /**
   * Remove a position
   */
  removePosition(positionId: string): void {
    // Remove the visual line
    const shapeId = this.positionLines.get(positionId);
    if (shapeId && this.chart) {
      try {
        this.chart.removeEntity(shapeId);
      } catch (e) {
        console.error("[PositionService] Error removing line:", e);
      }
      this.positionLines.delete(positionId);
    }

    // Remove from positions map
    this.positions.delete(positionId);
    this.pendingPositions.delete(positionId);
  }

  /**
   * Draw a position line on the chart
   */
  private async drawPositionLine(position: Position): Promise<void> {
    if (!this.chart) {
      // Chart not ready - position is already queued in pendingPositions
      return;
    }

    try {
      // Remove existing line if any
      const existingLine = this.positionLines.get(position.id);
      if (existingLine) {
        try {
          this.chart.removeEntity(existingLine);
        } catch {
          // Ignore removal errors
        }
      }

      // Create a horizontal line at the position entry price
      const lineColor = position.side === "long" ? "#10B981" : "#EF4444";

      // Format quantity for readability
      const formatQuantity = (qty: number): string => {
        if (qty >= 1_000_000) {
          return `${(qty / 1_000_000).toFixed(2)}M`;
        } else if (qty >= 1_000) {
          return `${(qty / 1_000).toFixed(2)}K`;
        } else if (qty >= 1) {
          return qty.toFixed(2);
        } else {
          return qty.toFixed(4);
        }
      };

      const lineText = `${position.side.toUpperCase()} ${formatQuantity(position.quantity)} @ $${position.avgPrice.toFixed(2)} (${position.leverage}x)`;

      // Use createShape API (available in standard Charting Library)
      // This creates a horizontal line at the specified price level
      const shapeId = this.chart.createShape(
        { price: position.avgPrice },
        {
          shape: "horizontal_line",
          lock: true,
          disableSelection: true,
          disableSave: true,
          disableUndo: true,
          overrides: {
            linecolor: lineColor,
            linewidth: 2,
            linestyle: 0, // Solid line
            showLabel: true,
            horzLabelsAlign: "right",
            vertLabelsAlign: "middle",
            textcolor: "#FFFFFF",
            fontsize: 12,
            bold: true,
            text: lineText,
          },
        }
      );

      if (shapeId) {
        this.positionLines.set(position.id, shapeId);
      }
    } catch (error) {
      console.error("[PositionService] Error drawing position line:", error);
    }
  }

  /**
   * Update position with new data (e.g., unrealized PnL)
   */
  updatePosition(positionId: string, updates: Partial<Position>): void {
    const position = this.positions.get(positionId);
    if (!position) {
      console.error(`[PositionService] Position ${positionId} not found`);
      return;
    }

    const updatedPosition = { ...position, ...updates };
    this.addPosition(updatedPosition);
  }

  /**
   * Get all current positions
   */
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get a specific position by ID
   */
  getPosition(positionId: string): Position | undefined {
    return this.positions.get(positionId);
  }

  /**
   * Clear all positions
   */
  clearAll(): void {
    if (this.chart) {
      this.positionLines.forEach((shapeId) => {
        try {
          this.chart.removeEntity(shapeId);
        } catch (e) {
          console.error("[PositionService] Error removing line:", e);
        }
      });
    }

    this.positions.clear();
    this.positionLines.clear();
    this.pendingPositions.clear();
  }
}

// Create a singleton instance
export const positionService = new PositionService();
