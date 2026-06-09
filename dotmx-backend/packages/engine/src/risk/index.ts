/**
 * Module 05 — Risk Checks (Fast Path)
 *
 * Block invalid orders before matching without slowing hot path.
 * - O(1) checks only
 * - No DB queries
 * - Use cached risk state
 */

import type { RiskCheckContext, RiskCheckResult, OrderSide } from "@dotmx/shared";

export interface RiskConfig {
  maxOrderSize: number;
  maxNotional: number;
  priceDeviationThreshold: number;
  tickSize: number;
  lotSize: number;
}

export const defaultRiskConfig: RiskConfig = {
  maxOrderSize: 1_000_000,
  maxNotional: 50_000_000,
  priceDeviationThreshold: 0.05, // 5%
  tickSize: 0.01,
  lotSize: 0.001,
};

/**
 * Validate tick size
 */
export function validateTickSize(price: number, tickSize: number): boolean {
  const remainder = Math.abs(price % tickSize);
  return remainder < 1e-10 || Math.abs(remainder - tickSize) < 1e-10;
}

/**
 * Validate lot size
 */
export function validateLotSize(quantity: number, lotSize: number): boolean {
  const remainder = Math.abs(quantity % lotSize);
  return remainder < 1e-10 || Math.abs(remainder - lotSize) < 1e-10;
}

/**
 * Check price bands (anti-fat-finger)
 */
export function checkPriceBands(
  price: number,
  markPrice: number,
  threshold: number
): boolean {
  if (markPrice <= 0) return true; // No mark price available
  const deviation = Math.abs(price - markPrice) / markPrice;
  return deviation <= threshold;
}

/**
 * Full risk check
 */
export function checkRisk(
  ctx: RiskCheckContext,
  markPrice: number,
  config: RiskConfig = defaultRiskConfig
): RiskCheckResult {
  // Check quantity > 0
  if (ctx.quantity <= 0) {
    return { allowed: false, reason: "INVALID_QUANTITY" };
  }

  // Check price > 0 (for limit orders)
  if (ctx.price <= 0) {
    return { allowed: false, reason: "INVALID_PRICE" };
  }

  // Check max order size
  if (ctx.quantity > config.maxOrderSize) {
    return { allowed: false, reason: "ORDER_SIZE_EXCEEDED" };
  }

  // Check max notional
  const notional = ctx.price * ctx.quantity;
  if (notional > config.maxNotional) {
    return { allowed: false, reason: "NOTIONAL_EXCEEDED" };
  }

  // Check tick size
  if (!validateTickSize(ctx.price, config.tickSize)) {
    return { allowed: false, reason: "INVALID_TICK_SIZE" };
  }

  // Check lot size
  if (!validateLotSize(ctx.quantity, config.lotSize)) {
    return { allowed: false, reason: "INVALID_LOT_SIZE" };
  }

  // Check price bands (anti-fat-finger)
  if (markPrice > 0 && !checkPriceBands(ctx.price, markPrice, config.priceDeviationThreshold)) {
    return { allowed: false, reason: "PRICE_DEVIATION_EXCEEDED" };
  }

  return { allowed: true };
}

/**
 * Check if user can place order based on cached state
 */
export function checkUserLimits(
  ctx: RiskCheckContext,
  maxOpenOrders: number = 200,
  currentOpenOrders: number = 0
): RiskCheckResult {
  if (currentOpenOrders >= maxOpenOrders) {
    return { allowed: false, reason: "MAX_OPEN_ORDERS_EXCEEDED" };
  }

  return { allowed: true };
}
