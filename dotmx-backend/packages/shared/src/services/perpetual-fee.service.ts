// ============================================================================
// PERPETUAL FUTURES FEE SERVICE
// ============================================================================
// Binance Futures-style fee system with maker rebates, funding fees,
// and liquidation penalties
// ============================================================================

import {
  type PerpetualFeeTier,
  type PerpFeeTierLevel,
  type TradeRole,
  type PositionSide,
  type FundingDirection,
  type LiquidationType,
  type TransactionFeeInput,
  type TransactionFeeResult,
  type FundingRateComputation,
  type FundingRateConfig,
  type FundingPaymentInput,
  type FundingPaymentResult,
  type LiquidationConfig,
  type LiquidationPenaltyInput,
  type LiquidationPenaltyResult,
  type InsuranceFund,
  type UserPerpetualFeeStatus,
  type FeeTierSummary,
  DEFAULT_PERP_FEE_CONFIG,
} from '../types/perpetual-fees.js';

// ============================================================================
// FEE TIER DATA (Binance Futures Style)
// ============================================================================

/**
 * Perpetual fee tiers with maker rebates
 * Maker fees are negative (rebates)
 */
const PERPETUAL_FEE_TIERS: Omit<PerpetualFeeTier, 'created_at' | 'updated_at'>[] = [
  {
    tier_level: 0,
    tier_name: 'Regular',
    min_30d_volume_usd: 0,
    min_dmx_holding: 0,
    maker_fee_rate: -0.00005,     // -0.005%
    taker_fee_rate: 0.00035,      // 0.035%
    maker_fee_adjustment: 0,
    taker_fee_adjustment: 0,
    effective_maker_fee: -0.00005,
    effective_taker_fee: 0.00035,
    funding_fee_discount: 0,
    liquidation_penalty_discount: 0,
    daily_withdrawal_limit_usd: 100000,
    max_leverage: 20,
    api_rate_limit_multiplier: 1,
    priority_execution: false,
    badge_color: '#808080',
    is_active: true,
  },
  {
    tier_level: 1,
    tier_name: 'Bronze',
    min_30d_volume_usd: 50000,
    min_dmx_holding: 500,
    maker_fee_rate: -0.00005,
    taker_fee_rate: 0.00035,
    maker_fee_adjustment: -0.00001,
    taker_fee_adjustment: -0.00001,
    effective_maker_fee: -0.00006, // -0.006%
    effective_taker_fee: 0.00034,  // 0.034%
    funding_fee_discount: 0,
    liquidation_penalty_discount: 0,
    daily_withdrawal_limit_usd: 250000,
    max_leverage: 25,
    api_rate_limit_multiplier: 1.5,
    priority_execution: false,
    badge_color: '#CD7F32',
    is_active: true,
  },
  {
    tier_level: 2,
    tier_name: 'Silver',
    min_30d_volume_usd: 250000,
    min_dmx_holding: 2500,
    maker_fee_rate: -0.00005,
    taker_fee_rate: 0.00035,
    maker_fee_adjustment: -0.00003,
    taker_fee_adjustment: -0.00003,
    effective_maker_fee: -0.00008, // -0.008%
    effective_taker_fee: 0.00032,  // 0.032%
    funding_fee_discount: 0.05,    // 5%
    liquidation_penalty_discount: 0.05,
    daily_withdrawal_limit_usd: 500000,
    max_leverage: 30,
    api_rate_limit_multiplier: 2,
    priority_execution: false,
    badge_color: '#C0C0C0',
    is_active: true,
  },
  {
    tier_level: 3,
    tier_name: 'Gold',
    min_30d_volume_usd: 1000000,
    min_dmx_holding: 10000,
    maker_fee_rate: -0.00005,
    taker_fee_rate: 0.00035,
    maker_fee_adjustment: -0.00005,
    taker_fee_adjustment: -0.00005,
    effective_maker_fee: -0.00010, // -0.010%
    effective_taker_fee: 0.00030,  // 0.030%
    funding_fee_discount: 0.10,    // 10%
    liquidation_penalty_discount: 0.10,
    daily_withdrawal_limit_usd: 1000000,
    max_leverage: 40,
    api_rate_limit_multiplier: 3,
    priority_execution: false,
    badge_color: '#FFD700',
    is_active: true,
  },
  {
    tier_level: 4,
    tier_name: 'Platinum',
    min_30d_volume_usd: 5000000,
    min_dmx_holding: 50000,
    maker_fee_rate: -0.00005,
    taker_fee_rate: 0.00035,
    maker_fee_adjustment: -0.00007,
    taker_fee_adjustment: -0.00007,
    effective_maker_fee: -0.00012, // -0.012%
    effective_taker_fee: 0.00028,  // 0.028%
    funding_fee_discount: 0.15,    // 15%
    liquidation_penalty_discount: 0.15,
    daily_withdrawal_limit_usd: 2500000,
    max_leverage: 50,
    api_rate_limit_multiplier: 4,
    priority_execution: true,
    badge_color: '#E5E4E2',
    is_active: true,
  },
  {
    tier_level: 5,
    tier_name: 'Diamond',
    min_30d_volume_usd: 15000000,
    min_dmx_holding: 150000,
    maker_fee_rate: -0.00005,
    taker_fee_rate: 0.00035,
    maker_fee_adjustment: -0.00010,
    taker_fee_adjustment: -0.00010,
    effective_maker_fee: -0.00015, // -0.015%
    effective_taker_fee: 0.00025,  // 0.025%
    funding_fee_discount: 0.20,    // 20%
    liquidation_penalty_discount: 0.20,
    daily_withdrawal_limit_usd: 5000000,
    max_leverage: 75,
    api_rate_limit_multiplier: 5,
    priority_execution: true,
    badge_color: '#B9F2FF',
    is_active: true,
  },
  {
    tier_level: 6,
    tier_name: 'Crown',
    min_30d_volume_usd: 50000000,
    min_dmx_holding: 500000,
    maker_fee_rate: -0.00005,
    taker_fee_rate: 0.00035,
    maker_fee_adjustment: -0.00013,
    taker_fee_adjustment: -0.00013,
    effective_maker_fee: -0.00018, // -0.018%
    effective_taker_fee: 0.00022,  // 0.022%
    funding_fee_discount: 0.25,    // 25%
    liquidation_penalty_discount: 0.25,
    daily_withdrawal_limit_usd: 10000000,
    max_leverage: 100,
    api_rate_limit_multiplier: 6,
    priority_execution: true,
    badge_color: '#9400D3',
    is_active: true,
  },
  {
    tier_level: 7,
    tier_name: 'Emperor',
    min_30d_volume_usd: 150000000,
    min_dmx_holding: 1500000,
    maker_fee_rate: -0.00005,
    taker_fee_rate: 0.00035,
    maker_fee_adjustment: -0.00015,
    taker_fee_adjustment: -0.00015,
    effective_maker_fee: -0.00020, // -0.020%
    effective_taker_fee: 0.00020,  // 0.020%
    funding_fee_discount: 0.30,    // 30%
    liquidation_penalty_discount: 0.30,
    daily_withdrawal_limit_usd: 25000000,
    max_leverage: 125,
    api_rate_limit_multiplier: 8,
    priority_execution: true,
    badge_color: '#DC143C',
    is_active: true,
  },
  {
    tier_level: 8,
    tier_name: 'Titan',
    min_30d_volume_usd: 500000000,
    min_dmx_holding: 5000000,
    maker_fee_rate: -0.00005,
    taker_fee_rate: 0.00035,
    maker_fee_adjustment: -0.00017,
    taker_fee_adjustment: -0.00017,
    effective_maker_fee: -0.00022, // -0.022%
    effective_taker_fee: 0.00018,  // 0.018%
    funding_fee_discount: 0.35,    // 35%
    liquidation_penalty_discount: 0.35,
    daily_withdrawal_limit_usd: 50000000,
    max_leverage: 150,
    api_rate_limit_multiplier: 10,
    priority_execution: true,
    badge_color: '#FF4500',
    is_active: true,
  },
  {
    tier_level: 9,
    tier_name: 'Legendary',
    min_30d_volume_usd: 1500000000,
    min_dmx_holding: 15000000,
    maker_fee_rate: -0.00005,
    taker_fee_rate: 0.00035,
    maker_fee_adjustment: -0.00020,
    taker_fee_adjustment: -0.00020,
    effective_maker_fee: -0.00025, // -0.025%
    effective_taker_fee: 0.00015,  // 0.015%
    funding_fee_discount: 0.50,    // 50%
    liquidation_penalty_discount: 0.50,
    daily_withdrawal_limit_usd: 100000000,
    max_leverage: 200,
    api_rate_limit_multiplier: 15,
    priority_execution: true,
    badge_color: '#FFD700',
    is_active: true,
  },
];

// ============================================================================
// PERPETUAL FEE SERVICE
// ============================================================================

export class PerpetualFeeService {
  private readonly fundingConfig: FundingRateConfig;
  private readonly liquidationConfig: LiquidationConfig;
  private readonly dmxDiscountPct: number;
  private readonly maxRebatePerTrade: number;

  constructor(options?: {
    fundingConfig?: Partial<FundingRateConfig>;
    liquidationConfig?: Partial<LiquidationConfig>;
    dmxDiscountPct?: number;
    maxRebatePerTrade?: number;
  }) {
    this.fundingConfig = {
      interval_hours: options?.fundingConfig?.interval_hours ?? DEFAULT_PERP_FEE_CONFIG.FUNDING_INTERVAL_HOURS,
      k: options?.fundingConfig?.k ?? DEFAULT_PERP_FEE_CONFIG.FUNDING_RATE_K,
      min_rate: options?.fundingConfig?.min_rate ?? DEFAULT_PERP_FEE_CONFIG.FUNDING_RATE_MIN,
      max_rate: options?.fundingConfig?.max_rate ?? DEFAULT_PERP_FEE_CONFIG.FUNDING_RATE_MAX,
    };

    this.liquidationConfig = {
      base_penalty_rate: options?.liquidationConfig?.base_penalty_rate ?? DEFAULT_PERP_FEE_CONFIG.LIQUIDATION_PENALTY,
      partial_liquidation_pct: options?.liquidationConfig?.partial_liquidation_pct ?? DEFAULT_PERP_FEE_CONFIG.PARTIAL_LIQUIDATION_PCT,
      maintenance_margin_ratio: options?.liquidationConfig?.maintenance_margin_ratio ?? DEFAULT_PERP_FEE_CONFIG.MAINTENANCE_MARGIN_RATIO,
      insurance_fund_contribution: options?.liquidationConfig?.insurance_fund_contribution ?? DEFAULT_PERP_FEE_CONFIG.INSURANCE_FUND_CONTRIBUTION,
    };

    this.dmxDiscountPct = options?.dmxDiscountPct ?? DEFAULT_PERP_FEE_CONFIG.DMX_DISCOUNT_PCT;
    this.maxRebatePerTrade = options?.maxRebatePerTrade ?? DEFAULT_PERP_FEE_CONFIG.MAX_REBATE_PER_TRADE_USD;
  }

  // ==========================================================================
  // FEE TIER METHODS
  // ==========================================================================

  /**
   * Get all fee tiers
   */
  getAllTiers(): typeof PERPETUAL_FEE_TIERS {
    return PERPETUAL_FEE_TIERS;
  }

  /**
   * Get fee tier by level
   */
  getTier(level: PerpFeeTierLevel): typeof PERPETUAL_FEE_TIERS[number] {
    const tier = PERPETUAL_FEE_TIERS.find(t => t.tier_level === level);
    if (!tier) {
      throw new Error(`Invalid tier level: ${level}`);
    }
    return tier;
  }

  /**
   * Determine user's tier based on volume and DMX holdings
   */
  determineTier(volume30dUsd: number, dmxHolding: number): PerpFeeTierLevel {
    for (let i = PERPETUAL_FEE_TIERS.length - 1; i >= 0; i--) {
      const tier = PERPETUAL_FEE_TIERS[i];
      if (
        volume30dUsd >= tier.min_30d_volume_usd &&
        dmxHolding >= tier.min_dmx_holding
      ) {
        return tier.tier_level;
      }
    }
    return 0;
  }

  /**
   * Get tier summary for display
   */
  getTierSummary(level: PerpFeeTierLevel): FeeTierSummary {
    const tier = this.getTier(level);

    return {
      tier_level: tier.tier_level,
      tier_name: tier.tier_name,
      min_volume: this.formatVolume(tier.min_30d_volume_usd),
      min_dmx: this.formatNumber(tier.min_dmx_holding),
      maker_fee: tier.effective_maker_fee < 0
        ? `${(tier.effective_maker_fee * 100).toFixed(3)}% (rebate)`
        : `${(tier.effective_maker_fee * 100).toFixed(3)}%`,
      taker_fee: `${(tier.effective_taker_fee * 100).toFixed(3)}%`,
      funding_discount: `${(tier.funding_fee_discount * 100).toFixed(0)}%`,
      liquidation_discount: `${(tier.liquidation_penalty_discount * 100).toFixed(0)}%`,
      max_leverage: `${tier.max_leverage}x`,
    };
  }

  // ==========================================================================
  // TRANSACTION FEE CALCULATION
  // ==========================================================================

  /**
   * Calculate transaction fee (maker rebate or taker fee)
   *
   * For makers: Returns negative fee (rebate)
   * For takers: Returns positive fee
   */
  calculateTransactionFee(input: TransactionFeeInput): TransactionFeeResult {
    const tier = this.getTier(input.fee_tier_level);

    // Get base fee rate based on role
    const baseFeeRate = input.trade_role === 'maker'
      ? tier.maker_fee_rate
      : tier.taker_fee_rate;

    // Get tier adjustment
    const tierAdjustment = input.trade_role === 'maker'
      ? tier.maker_fee_adjustment
      : tier.taker_fee_adjustment;

    // Effective fee rate
    const effectiveFeeRate = baseFeeRate + tierAdjustment;

    // Calculate fee amount
    let feeAmountUsd = input.notional_usd * effectiveFeeRate;

    // For maker rebates, cap at max rebate per trade
    if (feeAmountUsd < 0) {
      feeAmountUsd = Math.max(feeAmountUsd, -this.maxRebatePerTrade);
    }

    const isRebate = feeAmountUsd < 0;

    // Apply DMX discount (only applies to fees, not to rebates)
    let dmxDiscountApplied = false;
    let dmxDiscountAmount = 0;
    let finalFeeUsd = feeAmountUsd;

    if (input.pay_with_dmx && !isRebate) {
      const discountPct = input.dmx_discount_pct ?? this.dmxDiscountPct;
      dmxDiscountAmount = feeAmountUsd * discountPct;
      finalFeeUsd = feeAmountUsd - dmxDiscountAmount;
      dmxDiscountApplied = true;
    }

    return {
      trade_role: input.trade_role,
      notional_usd: input.notional_usd,

      base_fee_rate: baseFeeRate,
      tier_adjustment: tierAdjustment,
      effective_fee_rate: effectiveFeeRate,

      fee_amount_usd: feeAmountUsd,
      is_rebate: isRebate,

      dmx_discount_applied: dmxDiscountApplied,
      dmx_discount_amount: dmxDiscountAmount,
      final_fee_usd: finalFeeUsd,

      rebate_amount_usd: isRebate ? Math.abs(feeAmountUsd) : undefined,

      breakdown: {
        notional: input.notional_usd,
        base_fee: input.notional_usd * baseFeeRate,
        tier_adjustment: input.notional_usd * tierAdjustment,
        dmx_discount: dmxDiscountAmount,
        final: finalFeeUsd,
      },
    };
  }

  /**
   * Calculate both maker and taker fees for a given notional
   */
  calculateBothFees(
    notionalUsd: number,
    feeTierLevel: PerpFeeTierLevel,
    payWithDmx: boolean = false,
  ): { maker: TransactionFeeResult; taker: TransactionFeeResult } {
    return {
      maker: this.calculateTransactionFee({
        user_id: '',
        trade_role: 'maker',
        notional_usd: notionalUsd,
        fee_tier_level: feeTierLevel,
        pay_with_dmx: payWithDmx,
      }),
      taker: this.calculateTransactionFee({
        user_id: '',
        trade_role: 'taker',
        notional_usd: notionalUsd,
        fee_tier_level: feeTierLevel,
        pay_with_dmx: payWithDmx,
      }),
    };
  }

  // ==========================================================================
  // FUNDING RATE CALCULATION
  // ==========================================================================

  /**
   * Calculate funding rate based on market skew
   *
   * Uses smoothed tanh model: rate = k × tanh(skew)
   * Clamped to [min_rate, max_rate]
   */
  calculateFundingRate(
    longOpenInterest: number,
    shortOpenInterest: number,
    symbol: string,
    markPrice: number,
    indexPrice?: number,
  ): FundingRateComputation {
    const totalOpenInterest = longOpenInterest + shortOpenInterest;

    // Calculate skew
    const skew = totalOpenInterest > 0
      ? (longOpenInterest - shortOpenInterest) / totalOpenInterest
      : 0;

    // Calculate raw funding rate using tanh smoothing
    const rawFundingRate = this.fundingConfig.k * Math.tanh(skew);

    // Clamp to bounds
    const fundingRate = Math.max(
      this.fundingConfig.min_rate,
      Math.min(this.fundingConfig.max_rate, rawFundingRate),
    );

    const wasClamped = fundingRate !== rawFundingRate;

    // Calculate timestamps
    const now = new Date();
    const nextFundingTimestamp = this.getNextFundingTimestamp(now);

    // Determine direction
    let direction: 'longs_pay' | 'shorts_pay' | 'neutral';
    if (Math.abs(fundingRate) < 0.000001) {
      direction = 'neutral';
    } else if (fundingRate > 0) {
      direction = 'longs_pay';
    } else {
      direction = 'shorts_pay';
    }

    return {
      symbol,
      funding_rate: fundingRate,
      funding_timestamp: now,
      next_funding_timestamp: nextFundingTimestamp,

      mark_price: markPrice,
      index_price: indexPrice ?? markPrice,

      long_open_interest: longOpenInterest,
      short_open_interest: shortOpenInterest,
      total_open_interest: totalOpenInterest,
      skew,

      raw_funding_rate: rawFundingRate,
      was_clamped: wasClamped,

      direction,
    };
  }

  /**
   * Get next funding timestamp
   * Funding occurs at 00:00, 08:00, 16:00 UTC
   */
  getNextFundingTimestamp(from: Date = new Date()): Date {
    const hours = from.getUTCHours();
    const mins = from.getUTCMinutes();
    const secs = from.getUTCSeconds();
    const intervalHours = this.fundingConfig.interval_hours;

    // Compute next interval boundary. Always return the next 8-hour mark.
    // Example: at 07:59 → floor(7/8)=0 → (0+1)*8=8 (correct: 08:00)
    // Example: at 08:00:00 → floor(8/8)=1 → (1+1)*8=16 (correct: 16:00)
    const nextFundingHour = (Math.floor(hours / intervalHours) + 1) * intervalHours;

    const next = new Date(from);
    next.setUTCHours(nextFundingHour % 24, 0, 0, 0);
    if (nextFundingHour >= 24) {
      next.setUTCDate(next.getUTCDate() + 1);
    }

    return next;
  }

  /**
   * Calculate funding payment for a position
   *
   * If rate > 0: longs pay shorts
   * If rate < 0: shorts pay longs
   */
  calculateFundingPayment(input: FundingPaymentInput): FundingPaymentResult {
    const tier = this.getTier(input.fee_tier_level);

    // Calculate position notional
    const positionNotional = input.position_size * input.mark_price;

    // Base funding amount = notional × rate
    let baseFundingAmount = positionNotional * Math.abs(input.funding_rate);

    // Determine payment direction
    let paymentDirection: FundingDirection;

    if (input.funding_rate > 0) {
      // Longs pay, shorts receive
      paymentDirection = input.position_side === 'long' ? 'paid' : 'received';
    } else if (input.funding_rate < 0) {
      // Shorts pay, longs receive
      paymentDirection = input.position_side === 'short' ? 'paid' : 'received';
    } else {
      // No funding
      paymentDirection = 'received'; // Actually zero
      baseFundingAmount = 0;
    }

    // Apply tier discount (only for payers)
    let discountRate = 0;
    let discountAmount = 0;
    let finalFundingAmount = baseFundingAmount;

    if (paymentDirection === 'paid' && tier.funding_fee_discount > 0) {
      discountRate = tier.funding_fee_discount;
      discountAmount = baseFundingAmount * discountRate;
      finalFundingAmount = baseFundingAmount - discountAmount;
    }

    // Sign the amount: positive = pay, negative = receive
    if (paymentDirection === 'received') {
      finalFundingAmount = -finalFundingAmount;
    }

    return {
      position_notional: positionNotional,
      funding_rate: input.funding_rate,

      base_funding_amount: baseFundingAmount,

      discount_rate: discountRate,
      discount_amount: discountAmount,

      final_funding_amount: finalFundingAmount,
      payment_direction: paymentDirection,

      breakdown: {
        position_notional: positionNotional,
        funding_rate: input.funding_rate,
        raw_amount: baseFundingAmount,
        discount: discountAmount,
        final: finalFundingAmount,
      },
    };
  }

  // ==========================================================================
  // LIQUIDATION PENALTY CALCULATION
  // ==========================================================================

  /**
   * Calculate liquidation penalty
   * Base: 0.4% of liquidated notional
   */
  calculateLiquidationPenalty(input: LiquidationPenaltyInput): LiquidationPenaltyResult {
    const tier = this.getTier(input.fee_tier_level);

    // Base penalty rate
    const basePenaltyRate = this.liquidationConfig.base_penalty_rate;

    // Tier discount
    const tierDiscountRate = tier.liquidation_penalty_discount;
    const effectivePenaltyRate = basePenaltyRate * (1 - tierDiscountRate);

    // Calculate amounts
    const basePenaltyAmount = input.liquidated_notional * basePenaltyRate;
    const discountAmount = basePenaltyAmount * tierDiscountRate;
    const finalPenaltyAmount = basePenaltyAmount - discountAmount;

    // Distribution
    const insuranceContribution = this.liquidationConfig.insurance_fund_contribution;
    const insuranceFundAmount = finalPenaltyAmount * insuranceContribution;
    const liquidatorReward = finalPenaltyAmount - insuranceFundAmount;

    return {
      liquidated_notional: input.liquidated_notional,

      base_penalty_rate: basePenaltyRate,
      tier_discount_rate: tierDiscountRate,
      effective_penalty_rate: effectivePenaltyRate,

      base_penalty_amount: basePenaltyAmount,
      discount_amount: discountAmount,
      final_penalty_amount: finalPenaltyAmount,

      insurance_fund_amount: insuranceFundAmount,
      liquidator_reward: liquidatorReward,

      breakdown: {
        notional: input.liquidated_notional,
        base_penalty: basePenaltyAmount,
        tier_discount: discountAmount,
        final_penalty: finalPenaltyAmount,
        to_insurance: insuranceFundAmount,
        to_liquidator: liquidatorReward,
      },
    };
  }

  /**
   * Calculate partial liquidation size
   */
  calculatePartialLiquidationSize(positionSize: number): number {
    return positionSize * this.liquidationConfig.partial_liquidation_pct;
  }

  /**
   * Check if position should be liquidated
   */
  shouldLiquidate(
    marginBalance: number,
    positionNotional: number,
    leverage: number,
  ): { shouldLiquidate: boolean; marginRatio: number; maintenanceMargin: number } {
    const maintenanceMargin = positionNotional * this.liquidationConfig.maintenance_margin_ratio;
    const marginRatio = marginBalance / maintenanceMargin;

    return {
      shouldLiquidate: marginBalance <= maintenanceMargin,
      marginRatio,
      maintenanceMargin,
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Format volume for display
   */
  private formatVolume(amount: number): string {
    if (amount >= 1_000_000_000) {
      return `$${(amount / 1_000_000_000).toFixed(1)}B`;
    }
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(1)}M`;
    }
    if (amount >= 1_000) {
      return `$${(amount / 1_000).toFixed(0)}K`;
    }
    return `$${amount}`;
  }

  /**
   * Format number for display
   */
  private formatNumber(amount: number): string {
    if (amount >= 1_000_000) {
      return `${(amount / 1_000_000).toFixed(1)}M`;
    }
    if (amount >= 1_000) {
      return `${(amount / 1_000).toFixed(0)}K`;
    }
    return `${amount}`;
  }

  /**
   * Get funding config
   */
  getFundingConfig(): FundingRateConfig {
    return { ...this.fundingConfig };
  }

  /**
   * Get liquidation config
   */
  getLiquidationConfig(): LiquidationConfig {
    return { ...this.liquidationConfig };
  }

  /**
   * Get DMX discount percentage
   */
  getDmxDiscountPct(): number {
    return this.dmxDiscountPct;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const perpetualFeeService = new PerpetualFeeService();
