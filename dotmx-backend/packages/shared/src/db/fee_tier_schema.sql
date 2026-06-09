-- ============================================================================
-- FEE TIER SYSTEM (BINANCE-STYLE)
-- ============================================================================
-- Production-ready fee tier system with VIP tiers and DMX token discounts
-- Similar to Binance's fee structure with BNB discount
-- 
-- Features:
-- - 10 VIP tiers (0-9) based on 30-day trading volume
-- - Progressive maker/taker fee discounts
-- - DMX token payment discount (25% off, similar to BNB)
-- - Real-time fee calculation
-- - Automatic tier updates based on rolling volume
-- - Complete audit trail
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- FEE TIERS CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS fee_tiers (
    tier_level INTEGER PRIMARY KEY CHECK (tier_level >= 0 AND tier_level <= 9),
    tier_name VARCHAR(50) NOT NULL,
    
    -- Volume requirements (30-day rolling)
    min_30d_volume_usd DECIMAL(20, 2) NOT NULL DEFAULT 0,
    
    -- DMX token holding requirements (optional boost)
    min_dmx_holding DECIMAL(24, 8) NOT NULL DEFAULT 0,
    
    -- Fee rates (base rates before any discounts)
    maker_fee_rate DECIMAL(8, 6) NOT NULL DEFAULT 0.001000, -- 0.10% default
    taker_fee_rate DECIMAL(8, 6) NOT NULL DEFAULT 0.001000, -- 0.10% default
    
    -- Fee discounts from base rate
    maker_fee_discount DECIMAL(8, 6) NOT NULL DEFAULT 0, -- Absolute discount (e.g., 0.000050 = 0.005%)
    taker_fee_discount DECIMAL(8, 6) NOT NULL DEFAULT 0,
    
    -- Effective fee rates (calculated: base - discount)
    effective_maker_fee DECIMAL(8, 6) NOT NULL DEFAULT 0.001000,
    effective_taker_fee DECIMAL(8, 6) NOT NULL DEFAULT 0.001000,
    
    -- Additional benefits
    daily_withdrawal_limit_usd DECIMAL(20, 2) NOT NULL DEFAULT 10000,
    withdrawal_fee_discount DECIMAL(5, 4) NOT NULL DEFAULT 0, -- 0-1 (0% to 100%)
    max_leverage INTEGER NOT NULL DEFAULT 20,
    api_rate_limit_multiplier DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
    
    -- Display
    badge_color VARCHAR(20),
    badge_icon VARCHAR(50),
    description TEXT,
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE fee_tiers IS 'Fee tier configuration (Binance-style) with 10 VIP levels';
COMMENT ON COLUMN fee_tiers.maker_fee_discount IS 'Absolute discount from base maker fee (e.g., 0.000050 = 0.005% discount)';
COMMENT ON COLUMN fee_tiers.taker_fee_discount IS 'Absolute discount from base taker fee';
COMMENT ON COLUMN fee_tiers.effective_maker_fee IS 'Final maker fee rate = base - discount';
COMMENT ON COLUMN fee_tiers.effective_taker_fee IS 'Final taker fee rate = base - discount';

CREATE INDEX IF NOT EXISTS idx_fee_tiers_volume ON fee_tiers(min_30d_volume_usd DESC);
CREATE INDEX IF NOT EXISTS idx_fee_tiers_active ON fee_tiers(is_active);

-- ============================================================================
-- DMX TOKEN FEE DISCOUNT CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS dmx_fee_discount_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Discount configuration
    discount_percentage DECIMAL(5, 4) NOT NULL DEFAULT 0.2500, -- 25% discount (like BNB)
    is_enabled BOOLEAN DEFAULT true,
    
    -- Requirements
    min_dmx_balance DECIMAL(24, 8) NOT NULL DEFAULT 0, -- Minimum DMX to qualify
    auto_convert_enabled BOOLEAN DEFAULT true, -- Auto-convert fees to DMX
    
    -- Limits
    max_discount_per_trade_usd DECIMAL(20, 2), -- Optional cap per trade
    max_discount_per_day_usd DECIMAL(20, 2), -- Optional daily cap
    
    -- Priority
    applies_before_vip_discount BOOLEAN DEFAULT false, -- false = VIP first, then DMX
    stackable_with_vip BOOLEAN DEFAULT true, -- Can combine with VIP discounts
    
    -- Metadata
    description TEXT,
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    effective_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE dmx_fee_discount_config IS 'DMX token fee discount configuration (similar to Binance BNB discount)';
COMMENT ON COLUMN dmx_fee_discount_config.discount_percentage IS '25% = 0.2500 (pay fees with DMX to get 25% off)';
COMMENT ON COLUMN dmx_fee_discount_config.applies_before_vip_discount IS 'Order of discount application (typically VIP first, then DMX)';
COMMENT ON COLUMN dmx_fee_discount_config.stackable_with_vip IS 'Whether DMX discount can stack with VIP discount';

-- ============================================================================
-- USER FEE TIER STATUS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_fee_tier (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Current tier
    current_tier INTEGER NOT NULL DEFAULT 0 REFERENCES fee_tiers(tier_level),
    previous_tier INTEGER DEFAULT 0,
    
    -- Volume tracking (30-day rolling)
    volume_30d_usd DECIMAL(20, 2) NOT NULL DEFAULT 0,
    volume_calculation_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    volume_calculation_end TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_volume_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- DMX token holdings
    current_dmx_balance DECIMAL(24, 8) NOT NULL DEFAULT 0,
    dmx_balance_last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Fee payment preferences
    pay_fees_with_dmx BOOLEAN DEFAULT false,
    dmx_discount_enabled BOOLEAN DEFAULT true,
    
    -- Effective fees (cached for performance)
    effective_maker_fee DECIMAL(8, 6) NOT NULL DEFAULT 0.001000,
    effective_taker_fee DECIMAL(8, 6) NOT NULL DEFAULT 0.001000,
    effective_maker_fee_with_dmx DECIMAL(8, 6), -- If paying with DMX
    effective_taker_fee_with_dmx DECIMAL(8, 6), -- If paying with DMX
    
    -- Next tier progress
    next_tier_level INTEGER,
    next_tier_volume_needed DECIMAL(20, 2),
    next_tier_dmx_needed DECIMAL(24, 8),
    tier_upgrade_eligible BOOLEAN DEFAULT false,
    
    -- Tier change tracking
    last_tier_upgrade TIMESTAMP WITH TIME ZONE,
    last_tier_downgrade TIMESTAMP WITH TIME ZONE,
    last_tier_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tier_locked_until TIMESTAMP WITH TIME ZONE, -- 7-day lock after upgrade
    
    -- Statistics
    total_fees_paid_usd DECIMAL(24, 8) DEFAULT 0,
    total_fees_paid_dmx DECIMAL(24, 8) DEFAULT 0,
    total_dmx_discount_received_usd DECIMAL(24, 8) DEFAULT 0,
    total_vip_discount_received_usd DECIMAL(24, 8) DEFAULT 0,
    lifetime_volume_usd DECIMAL(24, 2) DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_fee_tier IS 'User fee tier status with 30-day rolling volume and DMX holdings';
COMMENT ON COLUMN user_fee_tier.pay_fees_with_dmx IS 'User preference to pay trading fees with DMX token';
COMMENT ON COLUMN user_fee_tier.effective_maker_fee_with_dmx IS 'Maker fee rate when paying with DMX (VIP + DMX discount)';
COMMENT ON COLUMN user_fee_tier.tier_locked_until IS '7-day lock period after tier upgrade to prevent manipulation';

CREATE INDEX IF NOT EXISTS idx_user_fee_tier_tier ON user_fee_tier(current_tier);
CREATE INDEX IF NOT EXISTS idx_user_fee_tier_volume ON user_fee_tier(volume_30d_usd DESC);
CREATE INDEX IF NOT EXISTS idx_user_fee_tier_dmx ON user_fee_tier(current_dmx_balance DESC);
CREATE INDEX IF NOT EXISTS idx_user_fee_tier_upgrade ON user_fee_tier(tier_upgrade_eligible) WHERE tier_upgrade_eligible = true;
CREATE INDEX IF NOT EXISTS idx_user_fee_tier_updated ON user_fee_tier(updated_at);

-- ============================================================================
-- FEE TIER CHANGE HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS fee_tier_change_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Tier change
    from_tier INTEGER NOT NULL,
    to_tier INTEGER NOT NULL,
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('upgrade', 'downgrade', 'manual')),
    
    -- Reason
    reason VARCHAR(100) NOT NULL, -- 'volume_increase', 'volume_decrease', 'dmx_staking', 'admin_adjustment'
    
    -- Volume at time of change
    volume_30d_usd DECIMAL(20, 2) NOT NULL,
    dmx_balance DECIMAL(24, 8) NOT NULL,
    
    -- Fee changes
    old_maker_fee DECIMAL(8, 6),
    new_maker_fee DECIMAL(8, 6),
    old_taker_fee DECIMAL(8, 6),
    new_taker_fee DECIMAL(8, 6),
    
    -- Admin
    changed_by UUID REFERENCES users(id),
    admin_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE fee_tier_change_history IS 'Audit trail of all fee tier changes';

CREATE INDEX IF NOT EXISTS idx_fee_tier_history_user ON fee_tier_change_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fee_tier_history_type ON fee_tier_change_history(change_type);
CREATE INDEX IF NOT EXISTS idx_fee_tier_history_date ON fee_tier_change_history(created_at DESC);

-- ============================================================================
-- TRADING FEES COLLECTED (For analytics and reconciliation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trading_fees_collected (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Trade reference
    trade_id UUID NOT NULL,
    order_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    
    -- Fee tier at time of trade
    fee_tier_level INTEGER NOT NULL,
    
    -- Trade details
    trade_side VARCHAR(10) NOT NULL CHECK (trade_side IN ('maker', 'taker')),
    trade_price DECIMAL(24, 8) NOT NULL,
    trade_quantity DECIMAL(24, 8) NOT NULL,
    trade_value_usd DECIMAL(24, 8) NOT NULL,
    
    -- Fee calculation
    base_fee_rate DECIMAL(8, 6) NOT NULL, -- Base rate before discounts
    vip_fee_discount DECIMAL(8, 6) DEFAULT 0,
    dmx_fee_discount DECIMAL(8, 6) DEFAULT 0,
    effective_fee_rate DECIMAL(8, 6) NOT NULL, -- Final rate applied
    
    -- Fee amounts
    fee_amount_usd DECIMAL(24, 8) NOT NULL,
    fee_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    fee_paid_in_dmx BOOLEAN DEFAULT false,
    dmx_amount DECIMAL(24, 8), -- If paid in DMX
    dmx_usd_price DECIMAL(24, 8), -- DMX price at time of payment
    
    -- Discounts received
    vip_discount_usd DECIMAL(24, 8) DEFAULT 0,
    dmx_discount_usd DECIMAL(24, 8) DEFAULT 0,
    total_discount_usd DECIMAL(24, 8) DEFAULT 0,
    
    -- Timestamp
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Settlement
    settlement_status VARCHAR(20) DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'settled', 'refunded')),
    settled_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE trading_fees_collected IS 'Record of all trading fees collected with full discount breakdown';

CREATE INDEX IF NOT EXISTS idx_fees_collected_user ON trading_fees_collected(user_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_fees_collected_trade ON trading_fees_collected(trade_id);
CREATE INDEX IF NOT EXISTS idx_fees_collected_order ON trading_fees_collected(order_id);
CREATE INDEX IF NOT EXISTS idx_fees_collected_symbol ON trading_fees_collected(symbol, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_fees_collected_tier ON trading_fees_collected(fee_tier_level);
CREATE INDEX IF NOT EXISTS idx_fees_collected_date ON trading_fees_collected(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_fees_collected_dmx ON trading_fees_collected(fee_paid_in_dmx) WHERE fee_paid_in_dmx = true;
CREATE INDEX IF NOT EXISTS idx_fees_collected_settlement ON trading_fees_collected(settlement_status) WHERE settlement_status = 'pending';

-- ============================================================================
-- VIEWS FOR CONVENIENCE
-- ============================================================================

-- User current fee rates view
CREATE OR REPLACE VIEW v_user_current_fees AS
SELECT 
    uft.user_id,
    uft.current_tier,
    ft.tier_name,
    uft.volume_30d_usd,
    uft.current_dmx_balance,
    uft.pay_fees_with_dmx,
    
    -- Maker fees
    ft.effective_maker_fee as base_maker_fee,
    uft.effective_maker_fee as vip_maker_fee,
    uft.effective_maker_fee_with_dmx as dmx_maker_fee,
    
    -- Taker fees
    ft.effective_taker_fee as base_taker_fee,
    uft.effective_taker_fee as vip_taker_fee,
    uft.effective_taker_fee_with_dmx as dmx_taker_fee,
    
    -- Discounts
    (ft.effective_maker_fee - uft.effective_maker_fee) as vip_maker_discount,
    (ft.effective_taker_fee - uft.effective_taker_fee) as vip_taker_discount,
    
    -- Progress
    uft.next_tier_level,
    uft.next_tier_volume_needed,
    uft.tier_upgrade_eligible,
    
    -- Stats
    uft.total_fees_paid_usd,
    uft.total_dmx_discount_received_usd,
    uft.total_vip_discount_received_usd,
    
    uft.updated_at
FROM user_fee_tier uft
JOIN fee_tiers ft ON uft.current_tier = ft.tier_level;

COMMENT ON VIEW v_user_current_fees IS 'Convenient view of user current fee rates and tier status';

-- Fee tier leaderboard
CREATE OR REPLACE VIEW v_fee_tier_leaderboard AS
SELECT 
    uft.user_id,
    u.email,
    u.username,
    uft.current_tier,
    ft.tier_name,
    uft.volume_30d_usd,
    uft.current_dmx_balance,
    uft.effective_maker_fee,
    uft.effective_taker_fee,
    uft.total_fees_paid_usd,
    uft.total_dmx_discount_received_usd + uft.total_vip_discount_received_usd as total_discounts_usd,
    RANK() OVER (ORDER BY uft.volume_30d_usd DESC) as volume_rank,
    RANK() OVER (ORDER BY uft.current_tier DESC) as tier_rank
FROM user_fee_tier uft
JOIN users u ON uft.user_id = u.id
JOIN fee_tiers ft ON uft.current_tier = ft.tier_level
WHERE u.is_active = true
ORDER BY uft.current_tier DESC, uft.volume_30d_usd DESC;

COMMENT ON VIEW v_fee_tier_leaderboard IS 'Leaderboard of users by fee tier and trading volume';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to calculate effective fee with all discounts
CREATE OR REPLACE FUNCTION calculate_effective_fee(
    p_base_fee DECIMAL(8,6),
    p_vip_discount DECIMAL(8,6),
    p_dmx_discount_pct DECIMAL(5,4),
    p_apply_dmx BOOLEAN DEFAULT true
) RETURNS DECIMAL(8,6) AS $$
DECLARE
    v_fee_after_vip DECIMAL(8,6);
    v_final_fee DECIMAL(8,6);
BEGIN
    -- Apply VIP discount first
    v_fee_after_vip := GREATEST(0, p_base_fee - p_vip_discount);
    
    -- Apply DMX discount if enabled (percentage discount)
    IF p_apply_dmx THEN
        v_final_fee := v_fee_after_vip * (1 - p_dmx_discount_pct);
    ELSE
        v_final_fee := v_fee_after_vip;
    END IF;
    
    -- Ensure non-negative
    RETURN GREATEST(0, v_final_fee);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_effective_fee IS 'Calculate final fee with VIP and DMX discounts applied';

-- Function to get fee tier by volume
CREATE OR REPLACE FUNCTION get_fee_tier_by_volume(
    p_volume_30d DECIMAL(20,2),
    p_dmx_balance DECIMAL(24,8) DEFAULT 0
) RETURNS INTEGER AS $$
DECLARE
    v_tier INTEGER;
BEGIN
    SELECT tier_level INTO v_tier
    FROM fee_tiers
    WHERE is_active = true
        AND p_volume_30d >= min_30d_volume_usd
        AND p_dmx_balance >= min_dmx_holding
    ORDER BY tier_level DESC
    LIMIT 1;
    
    RETURN COALESCE(v_tier, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_fee_tier_by_volume IS 'Determine fee tier based on 30-day volume and DMX holdings';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fee_tier_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fee_tiers_updated
    BEFORE UPDATE ON fee_tiers
    FOR EACH ROW
    EXECUTE FUNCTION update_fee_tier_timestamp();

CREATE TRIGGER trigger_user_fee_tier_updated
    BEFORE UPDATE ON user_fee_tier
    FOR EACH ROW
    EXECUTE FUNCTION update_fee_tier_timestamp();

CREATE TRIGGER trigger_dmx_discount_config_updated
    BEFORE UPDATE ON dmx_fee_discount_config
    FOR EACH ROW
    EXECUTE FUNCTION update_fee_tier_timestamp();
