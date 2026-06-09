/**
 * Risk Manager
 *
 * Monitors risk across all MM bot positions and triggers circuit breakers
 * when thresholds are exceeded.
 */

import { InventoryManager } from "./inventory";
import { log } from "./logger";

export interface RiskLimits {
  /** Max USD loss before halting all trading */
  maxLossUsd: number;
  /** Max position value per market (USD) */
  maxPositionPerMarketUsd: number;
  /** Max total position across all markets (USD) */
  maxTotalPositionUsd: number;
  /** Max orders per minute per market */
  maxOrdersPerMinute: number;
}

export type RiskEvent =
  | "MAX_LOSS_BREACHED"
  | "MAX_POSITION_BREACHED"
  | "RATE_LIMIT_WARNING";

export class RiskManager {
  private limits: RiskLimits;
  private halted = false;
  private haltReason: string | null = null;
  private orderCounts = new Map<string, { count: number; windowStart: number }>();
  private eventCallbacks: ((event: RiskEvent, detail: string) => void)[] = [];

  constructor(limits: RiskLimits) {
    this.limits = limits;
  }

  /** Register a callback for risk events */
  onRiskEvent(cb: (event: RiskEvent, detail: string) => void) {
    this.eventCallbacks.push(cb);
  }

  /** Check if trading is halted */
  isHalted(): boolean {
    return this.halted;
  }

  getHaltReason(): string | null {
    return this.haltReason;
  }

  /** Resume trading after halt */
  resume() {
    this.halted = false;
    this.haltReason = null;
    log.info("Risk", "Trading resumed");
  }

  /** Run pre-trade risk check */
  preTradeCheck(
    symbol: string,
    side: "BUY" | "SELL",
    usdValue: number,
    inventory: InventoryManager
  ): { allowed: boolean; reason?: string } {
    if (this.halted) {
      return { allowed: false, reason: `Trading halted: ${this.haltReason}` };
    }

    // ── Loss check ──
    const totalPnl = inventory.getTotalPnl();
    if (totalPnl < -this.limits.maxLossUsd) {
      this.halt(`Max loss exceeded: $${Math.abs(totalPnl).toFixed(2)}`);
      this.emit("MAX_LOSS_BREACHED", `PnL: $${totalPnl.toFixed(2)}`);
      return { allowed: false, reason: this.haltReason! };
    }

    // ── Position limit check ──
    if (!inventory.canTrade(symbol, side, usdValue)) {
      this.emit(
        "MAX_POSITION_BREACHED",
        `${symbol} would exceed max position`
      );
      return {
        allowed: false,
        reason: `Max position for ${symbol} would be exceeded`,
      };
    }

    // ── Rate limit check ──
    if (!this.checkRateLimit(symbol)) {
      this.emit("RATE_LIMIT_WARNING", `${symbol} rate limit reached`);
      return { allowed: false, reason: `Rate limit for ${symbol}` };
    }

    return { allowed: true };
  }

  /** Track order placement for rate limiting */
  recordOrder(symbol: string) {
    const now = Date.now();
    const entry = this.orderCounts.get(symbol) || {
      count: 0,
      windowStart: now,
    };

    if (now - entry.windowStart > 60_000) {
      entry.count = 0;
      entry.windowStart = now;
    }

    entry.count++;
    this.orderCounts.set(symbol, entry);
  }

  private checkRateLimit(symbol: string): boolean {
    const now = Date.now();
    const entry = this.orderCounts.get(symbol);
    if (!entry) return true;
    if (now - entry.windowStart > 60_000) return true;
    return entry.count < this.limits.maxOrdersPerMinute;
  }

  private halt(reason: string) {
    this.halted = true;
    this.haltReason = reason;
    log.error("Risk", `🛑 TRADING HALTED: ${reason}`);
  }

  private emit(event: RiskEvent, detail: string) {
    for (const cb of this.eventCallbacks) cb(event, detail);
  }
}
