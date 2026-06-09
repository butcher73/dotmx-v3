/**
 * Inventory Manager
 *
 * Tracks the MM bot's net position per market and calculates
 * inventory skew to discourage accumulating directional exposure.
 *
 * Skew adjusts bid/ask spreads:
 *   - Long inventory → widen bid spread, tighten ask (attract sells)
 *   - Short inventory → tighten bid spread, widen ask (attract buys)
 */

import { log } from "./logger";

export interface InventoryState {
  /** Net position in base asset (positive = long, negative = short) */
  netPosition: number;
  /** Current position value in USD */
  positionValueUsd: number;
  /** Skew factor: -1 (max short) to +1 (max long) */
  skewFactor: number;
  /** Total filled buy volume (USD) */
  totalBoughtUsd: number;
  /** Total filled sell volume (USD) */
  totalSoldUsd: number;
}

export class InventoryManager {
  private positions = new Map<string, InventoryState>();
  private maxPositionUsd: number;
  private skewSensitivity: number;

  constructor(maxPositionUsd: number, skewSensitivity = 0.3) {
    this.maxPositionUsd = maxPositionUsd;
    this.skewSensitivity = skewSensitivity;
  }

  /** Record a fill event */
  recordFill(
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number,
    price: number
  ) {
    const state = this.getState(symbol);
    const usdValue = quantity * price;

    if (side === "BUY") {
      state.netPosition += quantity;
      state.totalBoughtUsd += usdValue;
    } else {
      state.netPosition -= quantity;
      state.totalSoldUsd += usdValue;
    }

    state.positionValueUsd = Math.abs(state.netPosition * price);
    state.skewFactor = this.calcSkew(state);

    this.positions.set(symbol, state);

    log.debug(
      "Inventory",
      `${symbol} fill: ${side} ${quantity}@${price} → net=${state.netPosition.toFixed(6)} skew=${state.skewFactor.toFixed(3)}`
    );
  }

  /** Update position value with current price */
  markToMarket(symbol: string, currentPrice: number) {
    const state = this.getState(symbol);
    state.positionValueUsd = Math.abs(state.netPosition * currentPrice);
    state.skewFactor = this.calcSkew(state);
  }

  /** Get inventory state for a symbol */
  getState(symbol: string): InventoryState {
    if (!this.positions.has(symbol)) {
      this.positions.set(symbol, {
        netPosition: 0,
        positionValueUsd: 0,
        skewFactor: 0,
        totalBoughtUsd: 0,
        totalSoldUsd: 0,
      });
    }
    return this.positions.get(symbol)!;
  }

  /** Check if position is within risk limit */
  canTrade(symbol: string, side: "BUY" | "SELL", usdValue: number): boolean {
    const state = this.getState(symbol);
    const projected =
      side === "BUY"
        ? state.positionValueUsd + usdValue
        : state.positionValueUsd - usdValue;

    return Math.abs(projected) <= this.maxPositionUsd;
  }

  /**
   * Calculate bid/ask spread adjustment based on inventory.
   *
   * Returns [bidSpreadMultiplier, askSpreadMultiplier]
   * - When long:  bid spread widens (>1), ask spread tightens (<1)
   * - When short: bid spread tightens (<1), ask spread widens (>1)
   */
  getSpreadAdjustment(symbol: string): [number, number] {
    const state = this.getState(symbol);
    const skew = state.skewFactor * this.skewSensitivity;

    return [1 + skew, 1 - skew]; // [bidMultiplier, askMultiplier]
  }

  /**
   * Get total mark-to-market PnL across all positions.
   * Includes unrealized value of held inventory.
   *
   * PnL = (totalSold - totalBought) + currentInventoryValue
   *   where currentInventoryValue is signed (+long, -short)
   */
  getTotalPnl(): number {
    let totalPnl = 0;
    for (const state of this.positions.values()) {
      const flowPnl = state.totalSoldUsd - state.totalBoughtUsd;
      const inventoryValue =
        state.netPosition >= 0
          ? state.positionValueUsd
          : -state.positionValueUsd;
      totalPnl += flowPnl + inventoryValue;
    }
    return totalPnl;
  }

  /** Reset state for a symbol */
  reset(symbol: string) {
    this.positions.delete(symbol);
  }

  private calcSkew(state: InventoryState): number {
    if (this.maxPositionUsd === 0) return 0;
    // Normalize to [-1, 1] based on max position
    const raw = state.positionValueUsd / this.maxPositionUsd;
    const signed = state.netPosition >= 0 ? raw : -raw;
    return Math.max(-1, Math.min(1, signed));
  }
}
