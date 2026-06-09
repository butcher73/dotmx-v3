/**
 * Account Types & Interfaces for All Stakeholders
 */

export type AccountType =
  | 'retail'              // Regular retail traders
  | 'market_maker'        // Market makers providing liquidity
  | 'liquidity_provider'  // Liquidity providers
  | 'institutional'       // Institutional traders
  | 'vip'                 // VIP/High net worth individuals
  | 'affiliate'           // Affiliate partners
  | 'api_trader'          // API/algorithmic traders
  | 'demo';               // Demo/paper trading

export type UserRole =
  | 'user'
  | 'trader'
  | 'market_maker'
  | 'liquidity_provider'
  | 'affiliate'
  | 'vip'
  | 'moderator'
  | 'support'
  | 'admin'
  | 'super_admin';

// ============================================================================
// RETAIL VIP TIERS (Binance-style)
// ============================================================================

export type VIPTierLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type VIPTierName = 
  | 'Regular'       // VIP 0
  | 'Bronze'        // VIP 1
  | 'Silver'        // VIP 2
  | 'Gold'          // VIP 3
  | 'Platinum'      // VIP 4
  | 'Diamond'       // VIP 5
  | 'Master'        // VIP 6
  | 'Grandmaster'   // VIP 7
  | 'Elite'         // VIP 8
  | 'Legendary';    // VIP 9

export interface RetailVIPTier {
  tier_level: VIPTierLevel;
  tier_name: VIPTierName;
  
  // Requirements
  min_30d_volume_usd: number;
  min_token_holding: number;
  
  // Fee discounts
  maker_fee_discount: number;
  taker_fee_discount: number;
  
  // Withdrawal benefits
  daily_withdrawal_limit_usd: number;
  withdrawal_fee_discount: number;
  
  // Trading benefits
  max_leverage: number;
  priority_customer_support: boolean;
  dedicated_account_manager: boolean;
  
  // API benefits
  api_rate_limit_multiplier: number;
  
  // Loyalty benefits
  loyalty_points_multiplier: number;
  
  // Exclusive features
  otc_trading_access: boolean;
  exclusive_events_access: boolean;
  early_feature_access: boolean;
  
  // Display
  badge_color: string;
  badge_icon: string;
  
  created_at: Date;
  updated_at: Date;
}

export interface UserVIPStatus {
  id: string;
  user_id: string;
  
  // Current tier
  current_tier: VIPTierLevel;
  previous_tier: VIPTierLevel;
  
  // Volume tracking (30-day rolling)
  volume_30d_usd: number;
  volume_30d_btc: number;
  
  // Token holdings
  current_token_holding: number;
  
  // Tier progression
  next_tier_volume_needed: number | null;
  next_tier_tokens_needed: number | null;
  tier_upgrade_eligible: boolean;
  
  // Benefits applied
  effective_maker_fee: number;
  effective_taker_fee: number;
  
  // Tier history
  total_tier_upgrades: number;
  highest_tier_achieved: VIPTierLevel;
  tier_upgraded_at: Date | null;
  tier_downgraded_at: Date | null;
  
  // Last calculations
  last_volume_calculation_at: Date;
  last_tier_check_at: Date;
  
  // Lock period
  tier_lock_until: Date | null;
  
  created_at: Date;
  updated_at: Date;
}

export interface VIPVolumeSnapshot {
  id: string;
  user_id: string;
  snapshot_date: Date;
  daily_volume_usd: number;
  daily_trades: number;
  spot_volume_usd: number;
  futures_volume_usd: number;
  options_volume_usd: number;
  created_at: Date;
}

export interface VIPTierHistory {
  id: string;
  user_id: string;
  from_tier: VIPTierLevel;
  to_tier: VIPTierLevel;
  change_type: 'upgrade' | 'downgrade' | 'manual';
  trigger_reason: string;
  volume_at_change: number;
  token_holding_at_change: number;
  admin_user_id: string | null;
  admin_notes: string | null;
  effective_date: Date;
  created_at: Date;
}

// VIP Tier Configuration
export const VIP_TIER_CONFIGS: Record<VIPTierLevel, RetailVIPTier> = {
  0: {
    tier_level: 0,
    tier_name: 'Regular',
    min_30d_volume_usd: 0,
    min_token_holding: 0,
    maker_fee_discount: 0,
    taker_fee_discount: 0,
    daily_withdrawal_limit_usd: 10000,
    withdrawal_fee_discount: 0,
    max_leverage: 20,
    priority_customer_support: false,
    dedicated_account_manager: false,
    api_rate_limit_multiplier: 1.0,
    loyalty_points_multiplier: 1.0,
    otc_trading_access: false,
    exclusive_events_access: false,
    early_feature_access: false,
    badge_color: 'gray',
    badge_icon: 'user',
    created_at: new Date(),
    updated_at: new Date(),
  },
  1: {
    tier_level: 1,
    tier_name: 'Bronze',
    min_30d_volume_usd: 50000,
    min_token_holding: 0,
    maker_fee_discount: 0.0005,
    taker_fee_discount: 0.0005,
    daily_withdrawal_limit_usd: 50000,
    withdrawal_fee_discount: 0.05,
    max_leverage: 25,
    priority_customer_support: false,
    dedicated_account_manager: false,
    api_rate_limit_multiplier: 1.2,
    loyalty_points_multiplier: 1.1,
    otc_trading_access: false,
    exclusive_events_access: false,
    early_feature_access: false,
    badge_color: 'bronze',
    badge_icon: 'shield',
    created_at: new Date(),
    updated_at: new Date(),
  },
  2: {
    tier_level: 2,
    tier_name: 'Silver',
    min_30d_volume_usd: 250000,
    min_token_holding: 1000,
    maker_fee_discount: 0.0010,
    taker_fee_discount: 0.0010,
    daily_withdrawal_limit_usd: 100000,
    withdrawal_fee_discount: 0.10,
    max_leverage: 30,
    priority_customer_support: true,
    dedicated_account_manager: false,
    api_rate_limit_multiplier: 1.5,
    loyalty_points_multiplier: 1.2,
    otc_trading_access: false,
    exclusive_events_access: false,
    early_feature_access: false,
    badge_color: 'silver',
    badge_icon: 'shield',
    created_at: new Date(),
    updated_at: new Date(),
  },
  3: {
    tier_level: 3,
    tier_name: 'Gold',
    min_30d_volume_usd: 1000000,
    min_token_holding: 5000,
    maker_fee_discount: 0.0015,
    taker_fee_discount: 0.0015,
    daily_withdrawal_limit_usd: 500000,
    withdrawal_fee_discount: 0.15,
    max_leverage: 50,
    priority_customer_support: true,
    dedicated_account_manager: false,
    api_rate_limit_multiplier: 2.0,
    loyalty_points_multiplier: 1.3,
    otc_trading_access: false,
    exclusive_events_access: true,
    early_feature_access: false,
    badge_color: 'gold',
    badge_icon: 'crown',
    created_at: new Date(),
    updated_at: new Date(),
  },
  4: {
    tier_level: 4,
    tier_name: 'Platinum',
    min_30d_volume_usd: 5000000,
    min_token_holding: 10000,
    maker_fee_discount: 0.0020,
    taker_fee_discount: 0.0020,
    daily_withdrawal_limit_usd: 1000000,
    withdrawal_fee_discount: 0.20,
    max_leverage: 75,
    priority_customer_support: true,
    dedicated_account_manager: false,
    api_rate_limit_multiplier: 2.5,
    loyalty_points_multiplier: 1.5,
    otc_trading_access: true,
    exclusive_events_access: true,
    early_feature_access: false,
    badge_color: 'platinum',
    badge_icon: 'crown',
    created_at: new Date(),
    updated_at: new Date(),
  },
  5: {
    tier_level: 5,
    tier_name: 'Diamond',
    min_30d_volume_usd: 25000000,
    min_token_holding: 50000,
    maker_fee_discount: 0.0025,
    taker_fee_discount: 0.0025,
    daily_withdrawal_limit_usd: 5000000,
    withdrawal_fee_discount: 0.25,
    max_leverage: 100,
    priority_customer_support: true,
    dedicated_account_manager: true,
    api_rate_limit_multiplier: 3.0,
    loyalty_points_multiplier: 1.75,
    otc_trading_access: true,
    exclusive_events_access: true,
    early_feature_access: true,
    badge_color: 'diamond',
    badge_icon: 'gem',
    created_at: new Date(),
    updated_at: new Date(),
  },
  6: {
    tier_level: 6,
    tier_name: 'Master',
    min_30d_volume_usd: 100000000,
    min_token_holding: 100000,
    maker_fee_discount: 0.0030,
    taker_fee_discount: 0.0030,
    daily_withdrawal_limit_usd: 10000000,
    withdrawal_fee_discount: 0.30,
    max_leverage: 125,
    priority_customer_support: true,
    dedicated_account_manager: true,
    api_rate_limit_multiplier: 4.0,
    loyalty_points_multiplier: 2.0,
    otc_trading_access: true,
    exclusive_events_access: true,
    early_feature_access: true,
    badge_color: 'blue',
    badge_icon: 'star',
    created_at: new Date(),
    updated_at: new Date(),
  },
  7: {
    tier_level: 7,
    tier_name: 'Grandmaster',
    min_30d_volume_usd: 250000000,
    min_token_holding: 250000,
    maker_fee_discount: 0.0035,
    taker_fee_discount: 0.0035,
    daily_withdrawal_limit_usd: 25000000,
    withdrawal_fee_discount: 0.35,
    max_leverage: 150,
    priority_customer_support: true,
    dedicated_account_manager: true,
    api_rate_limit_multiplier: 5.0,
    loyalty_points_multiplier: 2.5,
    otc_trading_access: true,
    exclusive_events_access: true,
    early_feature_access: true,
    badge_color: 'purple',
    badge_icon: 'star',
    created_at: new Date(),
    updated_at: new Date(),
  },
  8: {
    tier_level: 8,
    tier_name: 'Elite',
    min_30d_volume_usd: 500000000,
    min_token_holding: 500000,
    maker_fee_discount: 0.0040,
    taker_fee_discount: 0.0040,
    daily_withdrawal_limit_usd: 50000000,
    withdrawal_fee_discount: 0.40,
    max_leverage: 200,
    priority_customer_support: true,
    dedicated_account_manager: true,
    api_rate_limit_multiplier: 7.5,
    loyalty_points_multiplier: 3.0,
    otc_trading_access: true,
    exclusive_events_access: true,
    early_feature_access: true,
    badge_color: 'red',
    badge_icon: 'flame',
    created_at: new Date(),
    updated_at: new Date(),
  },
  9: {
    tier_level: 9,
    tier_name: 'Legendary',
    min_30d_volume_usd: 1000000000,
    min_token_holding: 1000000,
    maker_fee_discount: 0.0050,
    taker_fee_discount: 0.0050,
    daily_withdrawal_limit_usd: 100000000,
    withdrawal_fee_discount: 0.50,
    max_leverage: 250,
    priority_customer_support: true,
    dedicated_account_manager: true,
    api_rate_limit_multiplier: 10.0,
    loyalty_points_multiplier: 4.0,
    otc_trading_access: true,
    exclusive_events_access: true,
    early_feature_access: true,
    badge_color: 'rainbow',
    badge_icon: 'trophy',
    created_at: new Date(),
    updated_at: new Date(),
  },
};

// Helper functions for VIP tiers
export function getVIPTierConfig(tierLevel: VIPTierLevel): RetailVIPTier {
  return VIP_TIER_CONFIGS[tierLevel];
}

export function getVIPTierByVolume(volume30d: number, tokenHolding: number): VIPTierLevel {
  // Start from highest tier and work down
  const tiers = Object.values(VIP_TIER_CONFIGS).sort((a, b) => b.tier_level - a.tier_level);
  
  for (const tier of tiers) {
    if (volume30d >= tier.min_30d_volume_usd && tokenHolding >= tier.min_token_holding) {
      return tier.tier_level as VIPTierLevel;
    }
  }
  
  return 0; // Default to Regular
}

export function calculateFeeWithVIPDiscount(baseFee: number, vipDiscount: number): number {
  return Math.max(0, baseFee - vipDiscount);
}

export function getVIPBenefitsSummary(tierLevel: VIPTierLevel): {
  feeDiscount: string;
  withdrawalLimit: string;
  leverage: string;
  pointsMultiplier: string;
  specialFeatures: string[];
} {
  const config = VIP_TIER_CONFIGS[tierLevel];
  const specialFeatures: string[] = [];
  
  if (config.priority_customer_support) specialFeatures.push('Priority Support');
  if (config.dedicated_account_manager) specialFeatures.push('Account Manager');
  if (config.otc_trading_access) specialFeatures.push('OTC Trading');
  if (config.exclusive_events_access) specialFeatures.push('Exclusive Events');
  if (config.early_feature_access) specialFeatures.push('Early Feature Access');
  
  return {
    feeDiscount: `${(config.maker_fee_discount * 100).toFixed(2)}% Maker / ${(config.taker_fee_discount * 100).toFixed(2)}% Taker`,
    withdrawalLimit: `$${config.daily_withdrawal_limit_usd.toLocaleString()}/day`,
    leverage: `${config.max_leverage}x`,
    pointsMultiplier: `${config.loyalty_points_multiplier}x`,
    specialFeatures,
  };
}

// ============================================================================
// ORIGINAL USER INTERFACE
// ============================================================================

export interface User {
  id: string;
  email: string;
  username: string;
  account_type: AccountType;
  role: UserRole;
  status: 'active' | 'suspended' | 'banned' | 'deleted';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  is_institutional: boolean;
  is_market_maker: boolean;
  is_vip: boolean;
  is_affiliate: boolean;
  api_enabled: boolean;
  kyc_verified: boolean;
  kyc_level: number;
  
  // VIP tier info (for retail users)
  vip_tier?: VIPTierLevel;
  vip_status?: UserVIPStatus;
  
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// MARKET MAKER
// ============================================================================

export interface MarketMakerStats {
  id: string;
  user_id: string;
  total_liquidity_provided_usd: number;
  active_orders_count: number;
  average_spread_bps: number;
  uptime_percentage: number;
  quote_acceptance_rate: number;
  maker_volume_usd: number;
  taker_volume_usd: number;
  total_mm_volume_usd: number;
  total_maker_fees_earned: number;
  total_rebates_earned: number;
  total_mm_rewards: number;
  best_day_volume: number;
  best_day_earnings: number;
  current_mm_tier: 'tier_1' | 'tier_2' | 'tier_3' | 'elite';
  last_quote_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface MarketMakerConfig {
  min_spread_bps: number;
  max_position_size: number;
  required_uptime_pct: number;
  rebate_structure: {
    tier: string;
    maker_rebate_bps: number;
    min_monthly_volume: number;
  }[];
}

// ============================================================================
// INSTITUTIONAL
// ============================================================================

export interface InstitutionalAccount {
  id: string;
  user_id: string;
  company_name: string;
  company_type: 'hedge_fund' | 'prop_firm' | 'bank' | 'broker' | 'family_office' | 'exchange' | 'other';
  registration_number: string;
  tax_id: string;
  jurisdiction: string;
  assets_under_management: number;
  daily_volume_limit: number;
  position_size_limit: number;
  max_leverage: number;
  custom_fee_structure: boolean;
  fee_tier: string;
  dedicated_support: boolean;
  api_rate_limit_multiplier: number;
  otc_access: boolean;
  private_pools_access: boolean;
  primary_contact_name: string;
  primary_contact_email: string;
  compliance_contact: string;
  risk_officer_contact: string;
  documents: any[];
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// VIP
// ============================================================================

export interface VIPBenefits {
  id: string;
  user_id: string;
  vip_tier: 'vip_1' | 'vip_2' | 'vip_3' | 'whale' | 'ultra';
  fee_discount_percentage: number;
  maker_fee_override: number | null;
  taker_fee_override: number | null;
  withdrawal_fee_waived: boolean;
  priority_support: boolean;
  dedicated_account_manager: boolean;
  account_manager_name: string | null;
  account_manager_email: string | null;
  account_manager_telegram: string | null;
  higher_leverage_enabled: boolean;
  max_leverage_multiplier: number;
  instant_withdrawals: boolean;
  higher_withdrawal_limits: boolean;
  otc_trading_enabled: boolean;
  private_sale_access: boolean;
  points_multiplier: number;
  monthly_bonus_points: number;
  early_feature_access: boolean;
  governance_voting: boolean;
  exclusive_events_access: boolean;
  vip_since: Date;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// AFFILIATE
// ============================================================================

export interface AffiliateAccount {
  id: string;
  user_id: string;
  affiliate_tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'ambassador';
  affiliate_code: string;
  company_name: string | null;
  website: string | null;
  social_media: Record<string, string>;
  base_commission_percentage: number;
  tier_bonus_percentage: number;
  lifetime_commission: boolean;
  commission_type: 'revenue_share' | 'cpa' | 'hybrid';
  cpa_amount: number | null;
  cpa_conversions: number;
  total_referrals: number;
  active_referrals: number;
  total_referral_volume: number;
  total_commission_earned: number;
  total_commission_paid: number;
  pending_commission: number;
  current_month_referrals: number;
  current_month_volume: number;
  current_month_commission: number;
  payment_method: 'crypto' | 'bank_transfer' | 'paypal' | 'points';
  payment_address: string;
  payment_currency: string;
  payment_schedule: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  min_payout_amount: number;
  custom_landing_page: string | null;
  tracking_pixel_id: string | null;
  marketing_materials: any[];
  is_verified: boolean;
  is_active: boolean;
  verification_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// LIQUIDITY PROVIDER
// ============================================================================

export interface LiquidityProviderStats {
  id: string;
  user_id: string;
  total_pools_joined: number;
  active_pools: number;
  total_liquidity_provided: number;
  current_liquidity_active: number;
  total_fees_earned: number;
  total_rewards_earned: number;
  impermanent_loss: number;
  net_earnings: number;
  average_apr: number;
  best_pool_apr: number;
  total_days_active: number;
  lp_tier: 'standard' | 'preferred' | 'elite';
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// API TRADER
// ============================================================================

export interface APITraderConfig {
  id: string;
  user_id: string;
  requests_per_second: number;
  requests_per_minute: number;
  requests_per_hour: number;
  daily_order_limit: number;
  max_concurrent_orders: number;
  max_order_size: number | null;
  websocket_enabled: boolean;
  fix_api_enabled: boolean;
  market_data_access: boolean;
  advanced_order_types: boolean;
  total_api_calls: number;
  total_orders_placed: number;
  average_latency_ms: number | null;
  alert_on_rate_limit: boolean;
  alert_email: string | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// LOYALTY POINTS (Enhanced)
// ============================================================================

export interface LoyaltyPoints {
  id: string;
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  multiplier: number;
  daily_profit_multiplier: number;
  referral_multiplier: number;
  volume_multiplier: number;
  market_maker_multiplier: number;
  institutional_multiplier: number;
  vip_multiplier: number;
  affiliate_multiplier: number;
  api_trader_multiplier: number;
  loyalty_program: 'standard' | 'market_maker' | 'institutional' | 'vip' | 'affiliate';
  last_tier_update: Date;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// ACCOUNT TYPE UTILITIES
// ============================================================================

export interface AccountTypeConfig {
  account_type: AccountType;
  display_name: string;
  description: string;
  features: string[];
  default_loyalty_program: string;
  requires_kyc: boolean;
  min_kyc_level: number;
  requires_verification: boolean;
  base_fee_discount: number;
  points_multiplier: number;
}

export const ACCOUNT_TYPE_CONFIGS: Record<AccountType, AccountTypeConfig> = {
  retail: {
    account_type: 'retail',
    display_name: 'Retail Trader',
    description: 'Standard trading account for individual traders',
    features: ['spot_trading', 'margin_trading', 'loyalty_points', 'referrals'],
    default_loyalty_program: 'standard',
    requires_kyc: true,
    min_kyc_level: 1,
    requires_verification: false,
    base_fee_discount: 0,
    points_multiplier: 1.0,
  },
  market_maker: {
    account_type: 'market_maker',
    display_name: 'Market Maker',
    description: 'Liquidity provider with maker rebates',
    features: ['market_making', 'rebates', 'high_rate_limits', 'dedicated_support', 'custom_fees'],
    default_loyalty_program: 'market_maker',
    requires_kyc: true,
    min_kyc_level: 2,
    requires_verification: true,
    base_fee_discount: 50,
    points_multiplier: 2.0,
  },
  liquidity_provider: {
    account_type: 'liquidity_provider',
    display_name: 'Liquidity Provider',
    description: 'Pool liquidity provider',
    features: ['pool_staking', 'fee_sharing', 'rewards', 'governance'],
    default_loyalty_program: 'standard',
    requires_kyc: true,
    min_kyc_level: 1,
    requires_verification: false,
    base_fee_discount: 25,
    points_multiplier: 1.5,
  },
  institutional: {
    account_type: 'institutional',
    display_name: 'Institutional',
    description: 'Enterprise trading account',
    features: ['high_limits', 'otc_trading', 'custom_fees', 'dedicated_support', 'compliance_tools', 'multi_user'],
    default_loyalty_program: 'institutional',
    requires_kyc: true,
    min_kyc_level: 3,
    requires_verification: true,
    base_fee_discount: 40,
    points_multiplier: 3.0,
  },
  vip: {
    account_type: 'vip',
    display_name: 'VIP',
    description: 'High net worth individual account',
    features: ['priority_support', 'fee_discounts', 'instant_withdrawals', 'exclusive_features', 'account_manager'],
    default_loyalty_program: 'vip',
    requires_kyc: true,
    min_kyc_level: 2,
    requires_verification: true,
    base_fee_discount: 30,
    points_multiplier: 2.5,
  },
  affiliate: {
    account_type: 'affiliate',
    display_name: 'Affiliate Partner',
    description: 'Revenue sharing partner account',
    features: ['referral_tracking', 'commissions', 'marketing_materials', 'analytics', 'custom_landing_pages'],
    default_loyalty_program: 'affiliate',
    requires_kyc: true,
    min_kyc_level: 1,
    requires_verification: true,
    base_fee_discount: 0,
    points_multiplier: 1.5,
  },
  api_trader: {
    account_type: 'api_trader',
    display_name: 'API Trader',
    description: 'Algorithmic trading account',
    features: ['rest_api', 'websocket', 'fix_api', 'high_rate_limits', 'advanced_orders'],
    default_loyalty_program: 'standard',
    requires_kyc: true,
    min_kyc_level: 2,
    requires_verification: true,
    base_fee_discount: 10,
    points_multiplier: 1.2,
  },
  demo: {
    account_type: 'demo',
    display_name: 'Demo Account',
    description: 'Paper trading account',
    features: ['paper_trading', 'no_risk'],
    default_loyalty_program: 'standard',
    requires_kyc: false,
    min_kyc_level: 0,
    requires_verification: false,
    base_fee_discount: 0,
    points_multiplier: 0,
  },
};

// Helper functions
export function getAccountTypeConfig(accountType: AccountType): AccountTypeConfig {
  return ACCOUNT_TYPE_CONFIGS[accountType];
}

export function isInstitutionalAccount(user: User): boolean {
  return user.account_type === 'institutional' || user.is_institutional;
}

export function isMarketMaker(user: User): boolean {
  return user.account_type === 'market_maker' || user.is_market_maker;
}

export function isVIP(user: User): boolean {
  return user.account_type === 'vip' || user.is_vip;
}

export function isAffiliate(user: User): boolean {
  return user.account_type === 'affiliate' || user.is_affiliate;
}

export function hasFeature(user: User, feature: string): boolean {
  const config = getAccountTypeConfig(user.account_type);
  return config.features.includes(feature);
}

export function getPointsMultiplier(user: User, loyaltyPoints: LoyaltyPoints): number {
  const baseMultiplier = loyaltyPoints.multiplier;
  const profitMultiplier = loyaltyPoints.daily_profit_multiplier;
  const referralMultiplier = loyaltyPoints.referral_multiplier;
  
  let accountTypeMultiplier = 1.0;
  
  switch (user.account_type) {
    case 'market_maker':
      accountTypeMultiplier = loyaltyPoints.market_maker_multiplier;
      break;
    case 'institutional':
      accountTypeMultiplier = loyaltyPoints.institutional_multiplier;
      break;
    case 'vip':
      accountTypeMultiplier = loyaltyPoints.vip_multiplier;
      break;
    case 'affiliate':
      accountTypeMultiplier = loyaltyPoints.affiliate_multiplier;
      break;
    case 'api_trader':
      accountTypeMultiplier = loyaltyPoints.api_trader_multiplier;
      break;
    default:
      accountTypeMultiplier = 1.0;
  }
  
  return baseMultiplier * profitMultiplier * referralMultiplier * accountTypeMultiplier;
}
