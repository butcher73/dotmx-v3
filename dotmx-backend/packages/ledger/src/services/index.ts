/**
 * Funding Rate Service
 *
 * Calculates and applies funding payments for perpetual contracts.
 */

import type { PositionStore, SimplePosition } from "@dotmx/ledger";
import { calculateAdlRanking } from "../margin";

/**
 * Calculate funding payment for a position.
 * Extracted here to work with SimplePosition.
 */
function calculateFundingPaymentForPosition(
  position: SimplePosition,
  fundingRate: number,
  markPrice: number
): number {
  if (position.size === 0) return 0;

  const notional = Math.abs(position.size) * markPrice;
  const payment = notional * fundingRate;

  // Long pays short when rate is positive
  // Short pays long when rate is negative
  // Size > 0 means long, size < 0 means short
  if (position.size > 0) {
    return -payment; // Long pays
  } else {
    return payment; // Short receives
  }
}

/**
 * Margin calculator interface for services.
 * This provides the calculation methods needed by services.
 */
export interface MarginCalculator {
  /** Apply funding payment to a user's margin */
  applyFunding(userId: string, symbol: string, payment: number): void;

  /** Check if a position should be liquidated */
  isLiquidatable(position: SimplePosition, markPrice: number): boolean;
}

export interface FundingConfig {
  intervalMs: number; // e.g., 8 hours = 28800000
  maxRate: number; // Max funding rate (e.g., 0.01 = 1%)
  dampening: number; // Dampening factor
}

export interface FundingRateResult {
  symbol: string;
  rate: number;
  markPrice: number;
  indexPrice: number;
  timestamp: number;
}

export interface FundingService {
  calculateRate(symbol: string, markPrice: number, indexPrice: number): number;
  applyFunding(symbol: string, rate: number, markPrice: number): Promise<FundingPaymentResult[]>;
  scheduleNext(): void;
  stop(): void;
}

export interface FundingPaymentResult {
  userId: string;
  symbol: string;
  payment: number;
  positionSize: number;
  timestamp: number;
}

export function createFundingService(
  config: FundingConfig,
  positionStore: PositionStore,
  marginCalculator: MarginCalculator,
  onFundingApplied?: (result: FundingPaymentResult[]) => void,
  /** Callback to fetch current mark/index prices per symbol for auto-settlement */
  priceProvider?: (symbol: string) => { markPrice: number; indexPrice: number } | null,
  /** List of active symbols the scheduler should settle */
  activeSymbols?: string[]
): FundingService {
  let timer: Timer | null = null;

  return {
    calculateRate(symbol: string, markPrice: number, indexPrice: number): number {
      // Premium = (Mark - Index) / Index
      const premium = (markPrice - indexPrice) / indexPrice;

      // Apply dampening and clamp
      const rate = Math.max(-config.maxRate, Math.min(config.maxRate, premium * config.dampening));

      return rate;
    },

    async applyFunding(symbol: string, rate: number, markPrice: number): Promise<FundingPaymentResult[]> {
      const results: FundingPaymentResult[] = [];
      const positions = positionStore.getAllPositions(symbol);

      for (const { userId, position } of positions) {
        // Use local calculateFundingPaymentForPosition function
        const payment = calculateFundingPaymentForPosition(position, rate, markPrice);

        // Apply funding via the calculator
        marginCalculator.applyFunding(userId, symbol, payment);

        results.push({
          userId,
          symbol,
          payment,
          positionSize: position.size,
          timestamp: Date.now(),
        });
      }

      if (onFundingApplied) {
        onFundingApplied(results);
      }

      return results;
    },

    scheduleNext(): void {
      if (timer) return;

      // Calculate time until next funding interval
      const now = Date.now();
      const nextFunding = Math.ceil(now / config.intervalMs) * config.intervalMs;
      const delay = nextFunding - now;

      timer = setTimeout(async () => {
        timer = null;

        // Auto-settle funding for all active symbols
        const symbols = activeSymbols ?? [];
        for (const symbol of symbols) {
          try {
            const prices = priceProvider?.(symbol);
            if (prices && prices.markPrice > 0 && prices.indexPrice > 0) {
              const rate = this.calculateRate(symbol, prices.markPrice, prices.indexPrice);
              await this.applyFunding(symbol, rate, prices.markPrice);
            }
          } catch (err) {
            console.error(`[FundingService] Failed to settle funding for ${symbol}:`, err);
          }
        }

        // Schedule next interval
        this.scheduleNext();
      }, delay);
    },

    stop(): void {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

// =============================================================================
// LIQUIDATION SERVICE
// =============================================================================

export interface LiquidationConfig {
  checkIntervalMs: number;
  liquidationFeeRate: number; // Fee taken from remaining margin
  insuranceFundAddress: string;
}

export interface LiquidationResult {
  userId: string;
  symbol: string;
  size: number;
  entryPrice: number;
  markPrice: number;
  margin: number;
  pnl: number;
  liquidationFee: number;
  timestamp: number;
}

export interface LiquidationService {
  checkPosition(userId: string, symbol: string, markPrice: number): LiquidationResult | null;
  checkAllPositions(symbol: string, markPrice: number): LiquidationResult[];
  executeLiquidation(result: LiquidationResult): Promise<void>;
  start(): void;
  stop(): void;
}

export function createLiquidationService(
  config: LiquidationConfig,
  positionStore: PositionStore,
  marginCalculator: MarginCalculator,
  onLiquidation?: (result: LiquidationResult) => void,
  /** Callback to fetch current mark price per symbol */
  markPriceProvider?: (symbol: string) => number,
  /** List of active symbols to monitor */
  activeSymbols?: string[]
): LiquidationService {
  let timer: Timer | null = null;

  return {
    checkPosition(userId: string, symbol: string, markPrice: number): LiquidationResult | null {
      const position = positionStore.getPosition(userId, symbol);
      if (!position) return null;

      const pnl = positionStore.calculatePnL(userId, symbol, markPrice);

      // Use the marginCalculator interface to check liquidation
      const isLiquidatable = marginCalculator.isLiquidatable(position, markPrice);

      if (!isLiquidatable) return null;

      const liquidationFee = position.margin * config.liquidationFeeRate;

      return {
        userId,
        symbol,
        size: position.size,
        entryPrice: position.entryPrice,
        markPrice,
        margin: position.margin,
        pnl,
        liquidationFee,
        timestamp: Date.now(),
      };
    },

    checkAllPositions(symbol: string, markPrice: number): LiquidationResult[] {
      const results: LiquidationResult[] = [];
      const positions = positionStore.getAllPositions(symbol);

      for (const { userId } of positions) {
        const result = this.checkPosition(userId, symbol, markPrice);
        if (result) {
          results.push(result);
        }
      }

      // Sort by ADL ranking (highest PnL ratio first for deleveraging)
      return results.sort((a, b) => {
        // Calculate PnL percent and leverage for ranking
        const pnlPercentA = a.margin > 0 ? a.pnl / a.margin : 0;
        const leverageA = a.margin > 0 ? (a.size * a.markPrice) / a.margin : 0;
        const pnlPercentB = b.margin > 0 ? b.pnl / b.margin : 0;
        const leverageB = b.margin > 0 ? (b.size * b.markPrice) / b.margin : 0;

        const rankA = calculateAdlRanking(pnlPercentA, leverageA);
        const rankB = calculateAdlRanking(pnlPercentB, leverageB);
        return rankB - rankA;
      });
    },

    async executeLiquidation(result: LiquidationResult): Promise<void> {
      // 1. Close the position
      const closedPosition = positionStore.closePosition(result.userId, result.symbol);

      // 2. Calculate remaining margin after PnL and fees
      const remainingMargin = result.margin + result.pnl - result.liquidationFee;

      // 3. Transfer liquidation fee to insurance fund
      //    (insurance fund is tracked as a special system account)
      if (result.liquidationFee > 0) {
        const insuranceFundUserId = config.insuranceFundAddress;
        const currentInsurance = positionStore.getPosition(insuranceFundUserId, "INSURANCE");
        if (currentInsurance) {
          positionStore.updatePosition(insuranceFundUserId, "INSURANCE", {
            margin: currentInsurance.margin + result.liquidationFee,
          });
        } else {
          positionStore.openPosition(
            insuranceFundUserId, "INSURANCE",
            0, 0, result.liquidationFee, 1
          );
        }
      }

      // 4. If remaining margin is negative (bankrupt), debit from insurance fund
      //    If positive, it stays as user's available balance
      if (remainingMargin < 0) {
        // Socialized loss — insurance fund absorbs deficit
        const insuranceFundUserId = config.insuranceFundAddress;
        const insurance = positionStore.getPosition(insuranceFundUserId, "INSURANCE");
        if (insurance) {
          positionStore.updatePosition(insuranceFundUserId, "INSURANCE", {
            margin: Math.max(0, insurance.margin + remainingMargin),
          });
        }
      }

      // 5. Notify listeners
      if (onLiquidation) {
        onLiquidation(result);
      }
    },

    start(): void {
      if (timer) return;

      timer = setInterval(async () => {
        const symbols = activeSymbols ?? [];
        for (const symbol of symbols) {
          try {
            const markPrice = markPriceProvider?.(symbol) ?? 0;
            if (markPrice <= 0) continue;

            const liquidations = this.checkAllPositions(symbol, markPrice);
            for (const liq of liquidations) {
              await this.executeLiquidation(liq);
            }
          } catch (err) {
            console.error(`[LiquidationService] Failed to check ${symbol}:`, err);
          }
        }
      }, config.checkIntervalMs);
    },

    stop(): void {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}

// =============================================================================
// ADL (AUTO-DELEVERAGING) SERVICE
// =============================================================================

export interface ADLConfig {
  enabled: boolean;
  threshold: number; // Insurance fund threshold to trigger ADL
}

export interface ADLResult {
  counterpartyUserId: string;
  symbol: string;
  size: number;
  price: number;
  timestamp: number;
}

export interface ADLService {
  findCounterparties(symbol: string, side: "LONG" | "SHORT", sizeNeeded: number): ADLResult[];
  executeADL(liquidation: LiquidationResult, counterparties: ADLResult[]): Promise<void>;
}

export function createADLService(
  config: ADLConfig,
  positionStore: PositionStore,
  _marginCalculator: MarginCalculator
): ADLService {
  return {
    findCounterparties(symbol: string, side: "LONG" | "SHORT", sizeNeeded: number): ADLResult[] {
      const results: ADLResult[] = [];
      const positions = positionStore.getAllPositions(symbol);

      // Find opposite side positions
      const oppositePositions = positions.filter(({ position }) => {
        if (side === "LONG") return position.size < 0; // Find shorts
        return position.size > 0; // Find longs
      });

      // Rank by profitability (highest profit first for ADL)
      const ranked = oppositePositions
        .map(({ userId, position }) => {
          const markPrice = position.entryPrice; // Would use actual mark price
          const pnl = positionStore.calculatePnL(userId, symbol, markPrice);

          // Calculate PnL percent and leverage for ADL ranking
          const pnlPercent = position.margin > 0 ? pnl / position.margin : 0;
          const leverage = position.margin > 0 ? (Math.abs(position.size) * markPrice) / position.margin : 0;
          const rank = calculateAdlRanking(pnlPercent, leverage);

          return { userId, position, rank };
        })
        .sort((a, b) => b.rank - a.rank);

      // Select counterparties until size is filled
      let remainingSize = sizeNeeded;

      for (const { userId, position } of ranked) {
        if (remainingSize <= 0) break;

        const delevSize = Math.min(Math.abs(position.size), remainingSize);
        results.push({
          counterpartyUserId: userId,
          symbol,
          size: delevSize,
          price: position.entryPrice, // Would use bankruptcy price
          timestamp: Date.now(),
        });

        remainingSize -= delevSize;
      }

      return results;
    },

    async executeADL(liquidation: LiquidationResult, counterparties: ADLResult[]): Promise<void> {
      for (const cp of counterparties) {
        // Reduce counterparty position
        const position = positionStore.getPosition(cp.counterpartyUserId, cp.symbol);
        if (position) {
          const newSize = position.size > 0 ? position.size - cp.size : position.size + cp.size;

          if (newSize === 0) {
            positionStore.closePosition(cp.counterpartyUserId, cp.symbol);
          } else {
            positionStore.updatePosition(cp.counterpartyUserId, cp.symbol, { size: newSize });
          }
        }
      }
    },
  };
}
