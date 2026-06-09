// ============================================================================
// PERPETUAL FUTURES FEE TYPES
// ============================================================================
// Types for perpetual futures fee system with funding and liquidation
// ============================================================================

/**
 * Fee tier level (0-9)
 */
export type PerpFeeTierLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * Trade role
 */
export type TradeRole = 'maker' | 'taker';

/**
 * Position side
 */
export type PositionSide = 'long' | 'short';

/**
 * Funding payment direction
 */
export type FundingDirection = 'paid' | 'received';

/**
 * Liquidation type
 */
export type LiquidationType = 'partial' | 'full' | 'bankruptcy';

// ============================================================================
// PERPETUAL FEE TIER
// ============================================================================

/**
 * Perpetual futures fee tier configuration
 */
export interface PerpetualFeeTier {
  tier_level: PerpFeeTierLevel;
  tier_name: string;
  
  // Requirements
  min_30d_volume_usd: number;
  min_dmx_holding: number;
  
  // Fee rates (maker can be negative = rebate)
  maker_fee_rate: number;        // Base: -0.00005 (-0.005%)
  taker_fee_rate: number;        // Base: 0.00035 (0.035%)
  maker_fee_adjustment: number;  // Additional rebate for tier
  taker_fee_adjustment: number;  // Fee reduction for tier
  
  // Effective fees
  effective_maker_fee: number;   // Negative = rebate
  effective_taker_fee: number;   // Always positive
  
  // Discounts
  funding_fee_discount: number;       // 0-1
  liquidation_penalty_discount: number; // 0-1
  
  // Benefits
  daily_withdrawal_limit_usd: number;
  max_leverage: number;
  api_rate_limit_multiplier: number;
  priority_execution: boolean;
  
  // Display
  badge_color?: string;
  badge_icon?: string;
  description?: string;
  
  // Status
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// TRANSACTION FEE
// ============================================================================

/**
 * Transaction fee calculation input
 */
export interface TransactionFeeInput {
  user_id: string;
  trade_role: TradeRole;
  notional_usd: number;          // price × size
  fee_tier_level: PerpFeeTierLevel;
  pay_with_dmx: boolean;
  dmx_discount_pct?: number;     // e.g., 0.25 for 25%
}

/**
 * Transaction fee calculation result
 */
export interface TransactionFeeResult {
  // Role
  trade_role: TradeRole;
  
  // Notional
  notional_usd: number;
  
  // Fee rates
  base_fee_rate: number;
  tier_adjustment: number;
  effective_fee_rate: number;
  
  // Fee amounts
  fee_amount_usd: number;        // Negative = rebate
  is_rebate: boolean;
  
  // DMX discount
  dmx_discount_applied: boolean;
  dmx_discount_amount: number;
  final_fee_usd: number;         // After DMX discount
  
  // For rebates
  rebate_amount_usd?: number;    // If maker, this is what they receive
  
  // Breakdown
  breakdown: {
    notional: number;
    base_fee: number;
    tier_adjustment: number;
    dmx_discount: number;
    final: number;
  };
}

// ============================================================================
// FUNDING FEE
// ============================================================================

/**
 * Funding rate computation
 */
export interface FundingRateComputation {
  symbol: string;
  funding_rate: number;          // Can be positive or negative
  funding_timestamp: Date;
  next_funding_timestamp: Date;
  
  // Market state
  mark_price: number;
  index_price: number;
  premium_index?: number;
  
  // Open interest
  long_open_interest: number;
  short_open_interest: number;
  total_open_interest: number;
  skew: number;                  // (long - short) / total
  
  // Raw vs clamped
  raw_funding_rate?: number;
  was_clamped: boolean;
  
  // Direction
  direction: 'longs_pay' | 'shorts_pay' | 'neutral';
}

/**
 * Funding rate configuration
 */
export interface FundingRateConfig {
  interval_hours: number;        // 8 hours
  k: number;                     // Sensitivity constant (0.00015)
  min_rate: number;              // -0.00015 (-0.015%)
  max_rate: number;              // 0.00015 (0.015%)
}

/**
 * Individual funding payment
 */
export interface FundingPayment {
  id: string;
  user_id: string;
  position_id: string;
  symbol: string;
  funding_rate_id?: string;
  
  // Position at funding time
  position_side: PositionSide;
  position_size: number;
  position_notional: number;
  mark_price: number;
  
  // Funding
  funding_rate: number;
  funding_amount: number;        // Positive = paid, Negative = received
  payment_direction: FundingDirection;
  
  // Tier discount
  fee_tier_level?: PerpFeeTierLevel;
  funding_fee_discount: number;
  discount_amount: number;
  
  // Settlement
  settlement_status: 'pending' | 'settled' | 'failed';
  settled_at?: Date;
  
  // Timestamps
  funding_timestamp: Date;
  created_at: Date;
}

/**
 * Funding payment calculation input
 */
export interface FundingPaymentInput {
  user_id: string;
  position_id: string;
  symbol: string;
  position_side: PositionSide;
  position_size: number;
  mark_price: number;
  funding_rate: number;
  fee_tier_level: PerpFeeTierLevel;
}

/**
 * Funding payment calculation result
 */
export interface FundingPaymentResult {
  position_notional: number;
  funding_rate: number;
  
  // Base calculation
  base_funding_amount: number;
  
  // Tier discount
  discount_rate: number;
  discount_amount: number;
  
  // Final
  final_funding_amount: number;  // Positive = pay, Negative = receive
  payment_direction: FundingDirection;
  
  // Breakdown
  breakdown: {
    position_notional: number;
    funding_rate: number;
    raw_amount: number;
    discount: number;
    final: number;
  };
}

// ============================================================================
// LIQUIDATION
// ============================================================================

/**
 * Liquidation penalty configuration
 */
export interface LiquidationConfig {
  base_penalty_rate: number;     // 0.004 (0.4%)
  partial_liquidation_pct: number; // 0.25 (25%)
  maintenance_margin_ratio: number;
  insurance_fund_contribution: number; // 0.5 (50% of penalty)
}

/**
 * Liquidation event
 */
export interface LiquidationEvent {
  id: string;
  user_id: string;
  position_id: string;
  symbol: string;
  
  // Type
  liquidation_type: LiquidationType;
  liquidation_stage: number;
  
  // Position
  position_side: PositionSide;
  original_size: number;
  liquidated_size: number;
  remaining_size: number;
  
  // Prices
  entry_price: number;
  mark_price: number;
  liquidation_price: number;
  bankruptcy_price?: number;
  execution_price: number;
  
  // Margin
  initial_margin: number;
  maintenance_margin: number;
  margin_balance: number;
  margin_ratio: number;
  
  // PnL
  unrealized_pnl: number;
  realized_pnl: number;
  
  // Notional
  liquidated_notional: number;
  
  // Penalty
  base_liquidation_penalty: number;
  fee_tier_level?: PerpFeeTierLevel;
  liquidation_penalty_discount: number;
  penalty_amount: number;
  penalty_to_insurance: number;
  penalty_to_liquidator: number;
  
  // Insurance
  insurance_fund_contribution: number;
  socialized_loss: number;
  
  // Execution
  execution_status: 'pending' | 'executed' | 'failed' | 'cancelled';
  execution_method: 'market' | 'limit' | 'auction';
  
  // Timestamps
  triggered_at: Date;
  executed_at?: Date;
  created_at: Date;
}

/**
 * Liquidation penalty calculation input
 */
export interface LiquidationPenaltyInput {
  user_id: string;
  position_id: string;
  symbol: string;
  liquidated_notional: number;
  fee_tier_level: PerpFeeTierLevel;
  liquidation_type: LiquidationType;
}

/**
 * Liquidation penalty calculation result
 */
export interface LiquidationPenaltyResult {
  liquidated_notional: number;
  
  // Penalty rates
  base_penalty_rate: number;     // 0.4%
  tier_discount_rate: number;
  effective_penalty_rate: number;
  
  // Amounts
  base_penalty_amount: number;
  discount_amount: number;
  final_penalty_amount: number;
  
  // Distribution
  insurance_fund_amount: number;
  liquidator_reward: number;
  
  // Breakdown
  breakdown: {
    notional: number;
    base_penalty: number;
    tier_discount: number;
    final_penalty: number;
    to_insurance: number;
    to_liquidator: number;
  };
}

// ============================================================================
// INSURANCE FUND
// ============================================================================

/**
 * Insurance fund status
 */
export interface InsuranceFund {
  id: string;
  symbol: string;
  balance: number;
  total_contributions: number;
  total_payouts: number;
  liquidations_covered: number;
  socialized_losses_count: number;
  total_socialized_loss: number;
  min_balance: number;
  target_balance?: number;
  max_single_payout?: number;
  is_active: boolean;
  last_contribution_at?: Date;
  last_payout_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Insurance fund transaction
 */
export interface InsuranceFundTransaction {
  id: string;
  symbol: string;
  transaction_type: 'liquidation_penalty' | 'socialized_loss_payout' | 'manual_contribution' | 'manual_withdrawal' | 'fee_contribution';
  amount: number;
  balance_before: number;
  balance_after: number;
  liquidation_id?: string;
  user_id?: string;
  admin_id?: string;
  notes?: string;
  created_at: Date;
}

// ============================================================================
// USER STATUS
// ============================================================================

/**
 * User perpetual fee status
 */
export interface UserPerpetualFeeStatus {
  user_id: string;
  
  // Tier
  current_tier: PerpFeeTierLevel;
  previous_tier?: PerpFeeTierLevel;
  
  // Volume
  volume_30d_usd: number;
  last_volume_update: Date;
  
  // DMX
  current_dmx_balance: number;
  pay_fees_with_dmx: boolean;
  
  // Effective fees
  effective_maker_fee: number;
  effective_taker_fee: number;
  effective_maker_fee_with_dmx?: number;
  effective_taker_fee_with_dmx?: number;
  
  // Discounts
  funding_fee_discount: number;
  liquidation_penalty_discount: number;
  
  // Statistics
  total_maker_rebates_usd: number;
  total_taker_fees_usd: number;
  total_funding_paid_usd: number;
  total_funding_received_usd: number;
  total_liquidation_penalties_usd: number;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// VIEWS & SUMMARIES
// ============================================================================

/**
 * User perpetual fees view
 */
export interface UserPerpetualFeesView {
  user_id: string;
  current_tier: PerpFeeTierLevel;
  tier_name: string;
  volume_30d_usd: number;
  
  // Fees
  effective_maker_fee: number;
  effective_taker_fee: number;
  effective_maker_fee_with_dmx?: number;
  effective_taker_fee_with_dmx?: number;
  
  // Discounts
  funding_fee_discount: number;
  liquidation_penalty_discount: number;
  
  // Statistics
  total_maker_rebates_usd: number;
  total_taker_fees_usd: number;
  total_funding_paid_usd: number;
  total_funding_received_usd: number;
  total_liquidation_penalties_usd: number;
  
  // Net
  net_trading_fees: number;      // rebates - taker fees
  net_funding: number;           // received - paid
  
  updated_at: Date;
}

/**
 * Current funding rate view
 */
export interface CurrentFundingRate {
  symbol: string;
  funding_rate: number;
  funding_timestamp: Date;
  next_funding_timestamp: Date;
  mark_price: number;
  index_price: number;
  long_open_interest: number;
  short_open_interest: number;
  skew: number;
  direction: 'longs_pay' | 'shorts_pay' | 'neutral';
}

/**
 * Fee tier summary for display
 */
export interface FeeTierSummary {
  tier_level: PerpFeeTierLevel;
  tier_name: string;
  min_volume: string;            // Formatted
  min_dmx: string;               // Formatted
  maker_fee: string;             // e.g., "-0.005% (rebate)"
  taker_fee: string;             // e.g., "0.035%"
  funding_discount: string;      // e.g., "10%"
  liquidation_discount: string;  // e.g., "10%"
  max_leverage: string;          // e.g., "50x"
}

/**
 * Fee priority order for application
 */
export const FEE_PRIORITY_ORDER = [
  'transaction',    // 1. Transaction fee (maker rebate / taker fee)
  'funding',        // 2. Funding fee (P2P transfer)
  'liquidation',    // 3. Liquidation penalty (if applicable)
] as const;

export type FeePriorityType = typeof FEE_PRIORITY_ORDER[number];

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default fee configuration (Binance Futures style)
 */
export const DEFAULT_PERP_FEE_CONFIG = {
  // Transaction fees
  BASE_MAKER_FEE: -0.00005,      // -0.005% (rebate)
  BASE_TAKER_FEE: 0.00035,       // 0.035%
  
  // Funding
  FUNDING_INTERVAL_HOURS: 8,
  FUNDING_RATE_K: 0.00015,
  FUNDING_RATE_MIN: -0.00015,    // -0.015%
  FUNDING_RATE_MAX: 0.00015,     // 0.015%
  
  // Liquidation
  LIQUIDATION_PENALTY: 0.004,    // 0.4%
  PARTIAL_LIQUIDATION_PCT: 0.25, // 25%
  MAINTENANCE_MARGIN_RATIO: 0.005,
  INSURANCE_FUND_CONTRIBUTION: 0.5, // 50% of penalty
  
  // DMX discount
  DMX_DISCOUNT_PCT: 0.25,        // 25%
  
  // Risk
  MAX_REBATE_PER_TRADE_USD: 10000,
} as const;
