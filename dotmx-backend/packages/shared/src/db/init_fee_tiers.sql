-- ============================================================================
-- FEE TIER INITIALIZATION DATA
-- ============================================================================
-- Default fee tiers based on Binance's VIP program structure
-- Base maker/taker fee: 0.10% (0.001000)
-- ============================================================================

-- Insert default fee tiers (10 tiers: 0-9)
INSERT INTO fee_tiers (
    tier_level,
    tier_name,
    min_30d_volume_usd,
    min_dmx_holding,
    maker_fee_rate,
    taker_fee_rate,
    maker_fee_discount,
    taker_fee_discount,
    effective_maker_fee,
    effective_taker_fee,
    daily_withdrawal_limit_usd,
    withdrawal_fee_discount,
    max_leverage,
    api_rate_limit_multiplier,
    badge_color,
    badge_icon,
    description
) VALUES
-- Tier 0: Regular (Default)
(
    0,
    'Regular',
    0,
    0,
    0.001000, -- 0.10% base maker
    0.001000, -- 0.10% base taker
    0.000000, -- No discount
    0.000000, -- No discount
    0.001000, -- 0.10% effective
    0.001000, -- 0.10% effective
    10000,    -- $10K daily withdrawal
    0.0000,   -- No withdrawal fee discount
    20,       -- 20x leverage
    1.0,      -- 1x API rate limit
    'gray',
    'user',
    'Default tier for all new users'
),

-- Tier 1: Bronze
(
    1,
    'Bronze',
    50000,     -- $50K volume
    0,         -- No DMX requirement
    0.001000,
    0.001000,
    0.000050,  -- 0.005% discount
    0.000050,
    0.000950,  -- 0.095% effective
    0.000950,
    50000,     -- $50K daily withdrawal
    0.0500,    -- 5% withdrawal discount
    25,
    1.2,
    'bronze',
    'shield',
    'Entry-level trader tier'
),

-- Tier 2: Silver
(
    2,
    'Silver',
    250000,    -- $250K volume
    1000,      -- 1K DMX
    0.001000,
    0.001000,
    0.000100,  -- 0.010% discount
    0.000100,
    0.000900,  -- 0.090% effective
    0.000900,
    100000,    -- $100K daily withdrawal
    0.1000,    -- 10% withdrawal discount
    30,
    1.5,
    'silver',
    'shield',
    'Active trader tier with priority support'
),

-- Tier 3: Gold
(
    3,
    'Gold',
    1000000,   -- $1M volume
    5000,      -- 5K DMX
    0.001000,
    0.001000,
    0.000150,  -- 0.015% discount
    0.000150,
    0.000850,  -- 0.085% effective
    0.000850,
    500000,    -- $500K daily withdrawal
    0.1500,    -- 15% withdrawal discount
    50,
    2.0,
    'gold',
    'crown',
    'High-volume trader with exclusive events access'
),

-- Tier 4: Platinum
(
    4,
    'Platinum',
    5000000,   -- $5M volume
    10000,     -- 10K DMX
    0.001000,
    0.001000,
    0.000200,  -- 0.020% discount
    0.000200,
    0.000800,  -- 0.080% effective
    0.000800,
    1000000,   -- $1M daily withdrawal
    0.2000,    -- 20% withdrawal discount
    75,
    2.5,
    'platinum',
    'crown',
    'Professional trader with OTC access'
),

-- Tier 5: Diamond
(
    5,
    'Diamond',
    25000000,  -- $25M volume
    50000,     -- 50K DMX
    0.001000,
    0.001000,
    0.000250,  -- 0.025% discount
    0.000250,
    0.000750,  -- 0.075% effective
    0.000750,
    5000000,   -- $5M daily withdrawal
    0.2500,    -- 25% withdrawal discount
    100,
    3.0,
    'diamond',
    'gem',
    'Elite trader with dedicated account manager'
),

-- Tier 6: Master
(
    6,
    'Master',
    100000000, -- $100M volume
    100000,    -- 100K DMX
    0.001000,
    0.001000,
    0.000300,  -- 0.030% discount
    0.000300,
    0.000700,  -- 0.070% effective
    0.000700,
    10000000,  -- $10M daily withdrawal
    0.3000,    -- 30% withdrawal discount
    125,
    5.0,
    'blue',
    'star',
    'Master trader with maximum benefits'
),

-- Tier 7: Grandmaster
(
    7,
    'Grandmaster',
    300000000, -- $300M volume
    250000,    -- 250K DMX
    0.001000,
    0.001000,
    0.000350,  -- 0.035% discount
    0.000350,
    0.000650,  -- 0.065% effective
    0.000650,
    25000000,  -- $25M daily withdrawal
    0.3500,    -- 35% withdrawal discount
    150,
    6.0,
    'purple',
    'star',
    'Grandmaster tier with institutional-level benefits'
),

-- Tier 8: Elite
(
    8,
    'Elite',
    500000000, -- $500M volume
    500000,    -- 500K DMX
    0.001000,
    0.001000,
    0.000400,  -- 0.040% discount
    0.000400,
    0.000600,  -- 0.060% effective
    0.000600,
    50000000,  -- $50M daily withdrawal
    0.4000,    -- 40% withdrawal discount
    200,
    7.5,
    'red',
    'flame',
    'Elite tier for top institutional traders'
),

-- Tier 9: Legendary
(
    9,
    'Legendary',
    1000000000, -- $1B volume
    1000000,    -- 1M DMX
    0.001000,
    0.001000,
    0.000500,   -- 0.050% discount
    0.000500,
    0.000500,   -- 0.050% effective (50% off!)
    0.000500,
    100000000,  -- $100M daily withdrawal
    0.5000,     -- 50% withdrawal discount
    250,
    10.0,
    'rainbow',
    'trophy',
    'Legendary tier - the ultimate trading experience'
)
ON CONFLICT (tier_level) DO UPDATE SET
    tier_name = EXCLUDED.tier_name,
    min_30d_volume_usd = EXCLUDED.min_30d_volume_usd,
    min_dmx_holding = EXCLUDED.min_dmx_holding,
    maker_fee_rate = EXCLUDED.maker_fee_rate,
    taker_fee_rate = EXCLUDED.taker_fee_rate,
    maker_fee_discount = EXCLUDED.maker_fee_discount,
    taker_fee_discount = EXCLUDED.taker_fee_discount,
    effective_maker_fee = EXCLUDED.effective_maker_fee,
    effective_taker_fee = EXCLUDED.effective_taker_fee,
    daily_withdrawal_limit_usd = EXCLUDED.daily_withdrawal_limit_usd,
    withdrawal_fee_discount = EXCLUDED.withdrawal_fee_discount,
    max_leverage = EXCLUDED.max_leverage,
    api_rate_limit_multiplier = EXCLUDED.api_rate_limit_multiplier,
    badge_color = EXCLUDED.badge_color,
    badge_icon = EXCLUDED.badge_icon,
    description = EXCLUDED.description,
    updated_at = NOW();

-- ============================================================================
-- DMX FEE DISCOUNT CONFIGURATION
-- ============================================================================
-- Similar to Binance's BNB fee discount (25% off)
-- ============================================================================

INSERT INTO dmx_fee_discount_config (
    discount_percentage,
    is_enabled,
    min_dmx_balance,
    auto_convert_enabled,
    max_discount_per_trade_usd,
    max_discount_per_day_usd,
    applies_before_vip_discount,
    stackable_with_vip,
    description,
    effective_from
) VALUES (
    0.2500,       -- 25% discount (like BNB)
    true,         -- Enabled
    0,            -- No minimum balance required (any amount qualifies)
    true,         -- Auto-convert fees to DMX
    NULL,         -- No per-trade cap
    NULL,         -- No daily cap
    false,        -- Apply VIP discount first, then DMX
    true,         -- Can stack with VIP discount
    'DMX token fee discount - Pay trading fees with DMX to receive 25% discount on your trading fees. Stacks with VIP tier discounts for maximum savings.',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_fee_tier_composite ON user_fee_tier(current_tier, volume_30d_usd DESC, current_dmx_balance DESC);
CREATE INDEX IF NOT EXISTS idx_fees_collected_user_date ON trading_fees_collected(user_id, collected_at DESC) WHERE settlement_status = 'settled';
CREATE INDEX IF NOT EXISTS idx_fees_collected_analytics ON trading_fees_collected(collected_at, fee_tier_level, trade_side) WHERE settlement_status = 'settled';

-- Partial indexes for optimization
CREATE INDEX IF NOT EXISTS idx_user_fee_tier_dmx_payers ON user_fee_tier(user_id) WHERE pay_fees_with_dmx = true;
CREATE INDEX IF NOT EXISTS idx_user_fee_tier_high_volume ON user_fee_tier(user_id, volume_30d_usd DESC) WHERE volume_30d_usd > 1000000;

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- Display tier summary
SELECT 
    tier_level,
    tier_name,
    '$' || TRIM(TO_CHAR(min_30d_volume_usd, '999,999,999')) || '+' as "30d Volume",
    TRIM(TO_CHAR(min_dmx_holding, '999,999,999')) || ' DMX' as "Min DMX",
    (effective_maker_fee * 100)::TEXT || '%' as "Maker Fee",
    (effective_taker_fee * 100)::TEXT || '%' as "Taker Fee",
    '-' || (maker_fee_discount * 100)::TEXT || '%' as "Discount",
    '$' || TRIM(TO_CHAR(daily_withdrawal_limit_usd, '999,999,999')) as "Daily Limit"
FROM fee_tiers
ORDER BY tier_level;

-- Display DMX discount config
SELECT 
    'DMX Token Discount' as feature,
    (discount_percentage * 100)::TEXT || '%' as discount,
    CASE WHEN is_enabled THEN 'Enabled' ELSE 'Disabled' END as status,
    CASE WHEN stackable_with_vip THEN 'Yes' ELSE 'No' END as "Stacks with VIP",
    description
FROM dmx_fee_discount_config
WHERE effective_until IS NULL OR effective_until > NOW()
LIMIT 1;
