/**
 * Margin Management
 *
 * Calculates margin requirements and handles margin calls.
 */

import type { Position } from "../positions";
import type { Balance } from "../balances";

export interface MarginConfig {
  initialMarginRate: number; // e.g., 0.1 for 10x leverage
  maintenanceMarginRate: number; // e.g., 0.005 for 0.5%
  maxLeverage: number;
  minLeverage: number;
  liquidationFeeRate: number;
}

export const defaultMarginConfig: MarginConfig = {
  initialMarginRate: 0.1, // 10x default leverage
  maintenanceMarginRate: 0.005, // 0.5% maintenance margin
  maxLeverage: 100,
  minLeverage: 1,
  liquidationFeeRate: 0.0075, // 0.75% liquidation fee
};

export interface MarginState {
  userId: string;
  totalCollateral: number;
  totalMarginUsed: number;
  totalUnrealizedPnl: number;
  freeMargin: number;
  marginRatio: number; // Used margin / Collateral
  maintenanceMargin: number;
  isLiquidatable: boolean;
}

/**
 * Calculate margin state for a user
 */
export function calculateMarginState(
  balances: Balance[],
  positions: Position[],
  markPrices: Map<string, number>,
  config: MarginConfig = defaultMarginConfig
): MarginState {
  // Sum total collateral (USD value of all assets)
  let totalCollateral = 0;
  for (const balance of balances) {
    // Simplified: assume all assets are USD-denominated
    totalCollateral += balance.available + balance.margin;
  }

  // Sum position margins and PnL
  let totalMarginUsed = 0;
  let totalUnrealizedPnl = 0;
  let maintenanceMargin = 0;

  for (const position of positions) {
    if (position.side === "NONE") continue;

    const markPrice = markPrices.get(position.symbol) ?? position.entryPrice;
    const notional = position.size * markPrice;

    totalMarginUsed += position.margin;
    maintenanceMargin += notional * config.maintenanceMarginRate;

    // Calculate unrealized PnL
    const pnl =
      position.side === "LONG"
        ? position.size * (markPrice - position.entryPrice)
        : position.size * (position.entryPrice - markPrice);

    totalUnrealizedPnl += pnl;
  }

  const effectiveCollateral = totalCollateral + totalUnrealizedPnl;
  const freeMargin = effectiveCollateral - totalMarginUsed;
  const marginRatio = effectiveCollateral > 0 ? totalMarginUsed / effectiveCollateral : 0;
  const isLiquidatable = effectiveCollateral < maintenanceMargin;

  return {
    userId: balances[0]?.userId ?? "",
    totalCollateral,
    totalMarginUsed,
    totalUnrealizedPnl,
    freeMargin,
    marginRatio,
    maintenanceMargin,
    isLiquidatable,
  };
}

/**
 * Check if user can open a new position
 */
export function canOpenPosition(
  marginState: MarginState,
  notional: number,
  leverage: number,
  config: MarginConfig = defaultMarginConfig
): { allowed: boolean; reason?: string } {
  const requiredMargin = notional / leverage;

  if (marginState.freeMargin < requiredMargin) {
    return { allowed: false, reason: "INSUFFICIENT_MARGIN" };
  }

  if (leverage > config.maxLeverage) {
    return { allowed: false, reason: "LEVERAGE_TOO_HIGH" };
  }

  if (leverage < config.minLeverage) {
    return { allowed: false, reason: "LEVERAGE_TOO_LOW" };
  }

  return { allowed: true };
}

/**
 * Calculate required margin for a trade
 */
export function calculateRequiredMargin(
  size: number,
  price: number,
  leverage: number
): number {
  return (size * price) / leverage;
}

/**
 * Calculate effective leverage
 */
export function calculateEffectiveLeverage(
  notional: number,
  margin: number
): number {
  if (margin === 0) return 0;
  return notional / margin;
}

/**
 * Calculate margin call price
 */
export function calculateMarginCallPrice(
  side: "LONG" | "SHORT",
  entryPrice: number,
  leverage: number,
  marginCallLevel: number = 0.8 // 80% of initial margin
): number {
  const marginRate = 1 / leverage;
  const threshold = marginRate * marginCallLevel;

  if (side === "LONG") {
    return entryPrice * (1 - threshold);
  } else {
    return entryPrice * (1 + threshold);
  }
}

/**
 * Funding rate calculation for perpetuals
 */
export interface FundingRate {
  symbol: string;
  rate: number; // e.g., 0.0001 for 0.01%
  timestamp: number;
  nextFundingTime: number;
}

export function calculateFundingPayment(
  position: Position,
  fundingRate: number
): number {
  if (position.side === "NONE") return 0;

  const notional = position.size * position.entryPrice;
  const payment = notional * fundingRate;

  // Long pays short when rate is positive
  // Short pays long when rate is negative
  if (position.side === "LONG") {
    return -payment; // Long pays
  } else {
    return payment; // Short receives
  }
}

/**
 * Auto-deleverage ranking
 */
export function calculateAdlRanking(
  pnlPercent: number,
  leverage: number
): number {
  // Higher PnL % and leverage = higher ADL priority
  return pnlPercent * leverage;
}

/**
 * Create margin manager
 */
export interface MarginManager {
  getState(userId: string): Promise<MarginState>;
  canTrade(userId: string, notional: number, leverage: number): Promise<{ allowed: boolean; reason?: string }>;
  checkLiquidations(markPrices: Map<string, number>): Promise<string[]>; // Returns user IDs to liquidate
}

/**
 * Optional provider for mark prices. If provided, getState() uses real mark prices
 * instead of falling back to entry price.
 */
export type MarkPriceProvider = (symbols: string[]) => Promise<Map<string, number>>;

/**
 * Provider to list all user IDs with open positions.
 * Required for checkLiquidations to iterate over users.
 */
export type ActiveUsersProvider = () => Promise<string[]>;

export function createMarginManager(
  getBalances: (userId: string) => Promise<Balance[]>,
  getPositions: (userId: string) => Promise<Position[]>,
  config: MarginConfig = defaultMarginConfig,
  options?: {
    markPriceProvider?: MarkPriceProvider;
    activeUsersProvider?: ActiveUsersProvider;
  }
): MarginManager {
  return {
    async getState(userId: string): Promise<MarginState> {
      const balances = await getBalances(userId);
      const positions = await getPositions(userId);

      // Collect symbols that need mark prices
      const symbols = positions
        .filter((p) => p.side !== "NONE")
        .map((p) => p.symbol);

      // Fetch real mark prices if provider is available
      let markPrices: Map<string, number>;
      if (options?.markPriceProvider && symbols.length > 0) {
        markPrices = await options.markPriceProvider(symbols);
      } else {
        // Fallback to entry price (less accurate but always available)
        markPrices = new Map<string, number>();
        for (const position of positions) {
          markPrices.set(position.symbol, position.entryPrice);
        }
      }

      return calculateMarginState(balances, positions, markPrices, config);
    },

    async canTrade(userId: string, notional: number, leverage: number) {
      const state = await this.getState(userId);
      return canOpenPosition(state, notional, leverage, config);
    },

    async checkLiquidations(markPrices: Map<string, number>): Promise<string[]> {
      const liquidatableUsers: string[] = [];

      // Get all users with open positions
      const userIds = options?.activeUsersProvider
        ? await options.activeUsersProvider()
        : [];

      for (const userId of userIds) {
        const balances = await getBalances(userId);
        const positions = await getPositions(userId);

        if (positions.length === 0) continue;

        const state = calculateMarginState(balances, positions, markPrices, config);
        if (state.isLiquidatable) {
          liquidatableUsers.push(userId);
        }
      }

      return liquidatableUsers;
    },
  };
}
