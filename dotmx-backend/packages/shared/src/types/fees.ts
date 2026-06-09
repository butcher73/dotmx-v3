// ============================================================================
// FEE TIER TYPES
// ============================================================================
// Types for Binance-style fee tier system with DMX token discount
// ============================================================================

/**
 * Fee tier levels (0-9)
 */
export type FeeTierLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * Fee tier configuration (matches fee_tiers table)
 */
export interface FeeTier {
  tier_level: FeeTierLevel;
  tier_name: string;
  
  // Requirements
  min_30d_volume_usd: number;
  min_dmx_holding: number;
  
  // Base fee rates
  maker_fee_rate: number;
  taker_fee_rate: number;
  
  // Fee discounts (absolute, not percentage)
  maker_fee_discount: number;
  taker_fee_discount: number;
  
  // Effective fees (base - discount)
  effective_maker_fee: number;
  effective_taker_fee: number;
  
  // Benefits
  daily_withdrawal_limit_usd: number;
  withdrawal_fee_discount: number;
  max_leverage: number;
  api_rate_limit_multiplier: number;
  
  // Display
  badge_color?: string;
  badge_icon?: string;
  description?: string;
  
  // Status
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * DMX fee discount configuration (matches dmx_fee_discount_config table)
 */
export interface DMXFeeDiscountConfig {
  id: string;
  
  // Discount settings
  discount_percentage: number; // 0.2500 = 25%
  is_enabled: boolean;
  
  // Requirements
  min_dmx_balance: number;
  auto_convert_enabled: boolean;
  
  // Limits
  max_discount_per_trade_usd?: number;
  max_discount_per_day_usd?: number;
  
  // Application rules
  applies_before_vip_discount: boolean;
  stackable_with_vip: boolean;
  
  // Metadata
  description?: string;
  effective_from: Date;
  effective_until?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * User fee tier status (matches user_fee_tier table)
 */
export interface UserFeeTier {
  user_id: string;
  
  // Current tier
  current_tier: FeeTierLevel;
  previous_tier?: FeeTierLevel;
  
  // Volume tracking
  volume_30d_usd: number;
  volume_calculation_start: Date;
  volume_calculation_end: Date;
  last_volume_update: Date;
  
  // DMX holdings
  current_dmx_balance: number;
  dmx_balance_last_updated: Date;
  
  // Fee payment preferences
  pay_fees_with_dmx: boolean;
  dmx_discount_enabled: boolean;
  
  // Effective fees (cached)
  effective_maker_fee: number;
  effective_taker_fee: number;
  effective_maker_fee_with_dmx?: number;
  effective_taker_fee_with_dmx?: number;
  
  // Next tier progress
  next_tier_level?: FeeTierLevel;
  next_tier_volume_needed?: number;
  next_tier_dmx_needed?: number;
  tier_upgrade_eligible: boolean;
  
  // Tier change tracking
  last_tier_upgrade?: Date;
  last_tier_downgrade?: Date;
  last_tier_check: Date;
  tier_locked_until?: Date;
  
  // Statistics
  total_fees_paid_usd: number;
  total_fees_paid_dmx: number;
  total_dmx_discount_received_usd: number;
  total_vip_discount_received_usd: number;
  lifetime_volume_usd: number;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
}

/**
 * Fee tier change history record (matches fee_tier_change_history table)
 */
export interface FeeTierChangeHistory {
  id: string;
  user_id: string;
  
  // Tier change
  from_tier: FeeTierLevel;
  to_tier: FeeTierLevel;
  change_type: 'upgrade' | 'downgrade' | 'manual';
  
  // Reason
  reason: string;
  
  // Volume at time of change
  volume_30d_usd: number;
  dmx_balance: number;
  
  // Fee changes
  old_maker_fee?: number;
  new_maker_fee?: number;
  old_taker_fee?: number;
  new_taker_fee?: number;
  
  // Admin
  changed_by?: string;
  admin_notes?: string;
  
  // Metadata
  created_at: Date;
}

/**
 * Trading fee record (matches trading_fees_collected table)
 */
export interface TradingFeeCollected {
  id: string;
  
  // Trade reference
  trade_id: string;
  order_id: string;
  user_id: string;
  symbol: string;
  
  // Fee tier at time of trade
  fee_tier_level: FeeTierLevel;
  
  // Trade details
  trade_side: 'maker' | 'taker';
  trade_price: number;
  trade_quantity: number;
  trade_value_usd: number;
  
  // Fee calculation
  base_fee_rate: number;
  vip_fee_discount: number;
  dmx_fee_discount: number;
  effective_fee_rate: number;
  
  // Fee amounts
  fee_amount_usd: number;
  fee_currency: string;
  fee_paid_in_dmx: boolean;
  dmx_amount?: number;
  dmx_usd_price?: number;
  
  // Discounts received
  vip_discount_usd: number;
  dmx_discount_usd: number;
  total_discount_usd: number;
  
  // Timestamp
  collected_at: Date;
  
  // Settlement
  settlement_status: 'pending' | 'settled' | 'refunded';
  settled_at?: Date;
}

/**
 * Fee calculation input parameters
 */
export interface FeeCalculationInput {
  user_id: string;
  trade_side: 'maker' | 'taker';
  trade_value_usd: number;
  fee_tier_level: FeeTierLevel;
  dmx_balance: number;
  pay_with_dmx: boolean;
  dmx_usd_price?: number;
}

/**
 * Fee calculation result
 */
export interface FeeCalculationResult {
  // Fee amounts
  base_fee_usd: number;
  vip_discount_usd: number;
  dmx_discount_usd: number;
  final_fee_usd: number;
  
  // Fee rates
  base_fee_rate: number;
  vip_fee_discount: number;
  dmx_fee_discount_rate: number;
  effective_fee_rate: number;
  
  // DMX payment
  fee_paid_in_dmx: boolean;
  dmx_amount?: number;
  dmx_usd_price?: number;
  
  // Savings
  total_discount_usd: number;
  discount_percentage: number;
  
  // Breakdown
  breakdown: {
    original_fee: number;
    after_vip_discount: number;
    after_dmx_discount: number;
    final_amount: number;
  };
}

/**
 * User current fees view (matches v_user_current_fees)
 */
export interface UserCurrentFeesView {
  user_id: string;
  current_tier: FeeTierLevel;
  tier_name: string;
  volume_30d_usd: number;
  current_dmx_balance: number;
  pay_fees_with_dmx: boolean;
  
  // Maker fees
  base_maker_fee: number;
  vip_maker_fee: number;
  dmx_maker_fee?: number;
  
  // Taker fees
  base_taker_fee: number;
  vip_taker_fee: number;
  dmx_taker_fee?: number;
  
  // Discounts
  vip_maker_discount: number;
  vip_taker_discount: number;
  
  // Progress
  next_tier_level?: FeeTierLevel;
  next_tier_volume_needed?: number;
  tier_upgrade_eligible: boolean;
  
  // Stats
  total_fees_paid_usd: number;
  total_dmx_discount_received_usd: number;
  total_vip_discount_received_usd: number;
  
  updated_at: Date;
}

/**
 * Fee tier leaderboard entry (matches v_fee_tier_leaderboard)
 */
export interface FeeTierLeaderboardEntry {
  user_id: string;
  email?: string;
  username?: string;
  current_tier: FeeTierLevel;
  tier_name: string;
  volume_30d_usd: number;
  current_dmx_balance: number;
  effective_maker_fee: number;
  effective_taker_fee: number;
  total_fees_paid_usd: number;
  total_discounts_usd: number;
  volume_rank: number;
  tier_rank: number;
}

/**
 * Fee tier upgrade/downgrade check result
 */
export interface TierCheckResult {
  current_tier: FeeTierLevel;
  calculated_tier: FeeTierLevel;
  should_change: boolean;
  change_type?: 'upgrade' | 'downgrade';
  is_locked: boolean;
  locked_until?: Date;
  next_tier_requirements?: {
    tier_level: FeeTierLevel;
    volume_needed: number;
    dmx_needed: number;
    volume_progress_pct: number;
    dmx_progress_pct: number;
  };
}

/**
 * Fee statistics summary
 */
export interface FeeStatistics {
  user_id: string;
  period_start: Date;
  period_end: Date;
  
  // Volume
  total_volume_usd: number;
  total_trades: number;
  maker_trades: number;
  taker_trades: number;
  
  // Fees paid
  total_fees_paid_usd: number;
  total_fees_paid_dmx: number;
  maker_fees_paid_usd: number;
  taker_fees_paid_usd: number;
  
  // Discounts received
  total_vip_discount_usd: number;
  total_dmx_discount_usd: number;
  total_discount_usd: number;
  
  // Average rates
  avg_maker_fee_rate: number;
  avg_taker_fee_rate: number;
  avg_effective_fee_rate: number;
  
  // Savings
  total_savings_usd: number;
  savings_percentage: number;
}

/**
 * DMX discount eligibility check
 */
export interface DMXDiscountEligibility {
  is_eligible: boolean;
  has_sufficient_balance: boolean;
  discount_percentage: number;
  min_balance_required: number;
  current_balance: number;
  is_enabled: boolean;
  reason?: string;
}

/**
 * Fee tier requirements summary
 */
export interface FeeTierRequirements {
  tier_level: FeeTierLevel;
  tier_name: string;
  min_30d_volume_usd: number;
  min_dmx_holding: number;
  maker_fee: string; // Formatted (e.g., "0.095%")
  taker_fee: string; // Formatted
  discount_from_base: string; // Formatted
  benefits: string[];
}
