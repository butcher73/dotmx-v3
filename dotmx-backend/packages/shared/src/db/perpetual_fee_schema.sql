-- ============================================================================
-- PERPETUAL FUTURES FEE SYSTEM SCHEMA
-- ============================================================================
-- Complete fee system for perpetual futures trading:
-- 1. Transaction Fees (Maker Rebate / Taker Fee)
-- 2. Funding Fees (8-hour intervals)
-- 3. Liquidation Penalties (0.4%)
-- 
-- Based on Binance Futures fee structure
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PERPETUAL FEE CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS perpetual_fee_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(50) UNIQUE NOT NULL,
    config_value DECIMAL(12, 8) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    effective_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE perpetual_fee_config IS 'Global perpetual futures fee configuration';

-- Insert base fee configuration (Binance Futures style)
INSERT INTO perpetual_fee_config (config_key, config_value, description) VALUES
    -- Transaction Fees
    ('base_maker_fee', -0.00005, 'Base maker fee rate: -0.005% (rebate)'),
    ('base_taker_fee', 0.00035, 'Base taker fee rate: 0.035%'),
    
    -- Funding Fees
    ('funding_interval_hours', 8, 'Funding fee interval in hours'),
    ('funding_rate_k', 0.00015, 'Funding rate sensitivity constant k'),
    ('funding_rate_min', -0.00015, 'Minimum funding rate: -0.015%'),
    ('funding_rate_max', 0.00015, 'Maximum funding rate: 0.015%'),
    
    -- Liquidation
    ('liquidation_penalty', 0.004, 'Liquidation penalty: 0.4% of notional'),
    ('partial_liquidation_pct', 0.25, 'Partial liquidation percentage: 25%'),
    ('maintenance_margin_ratio', 0.005, 'Maintenance margin ratio: 0.5%'),
    ('insurance_fund_contribution', 0.5, 'Insurance fund contribution: 50% of liquidation penalty'),
    
    -- Risk Parameters
    ('max_rebate_per_trade_usd', 10000, 'Maximum rebate per single trade in USD'),
    ('self_trade_prevention', 1, 'Enable self-trade prevention (1=enabled)')
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- ============================================================================
-- PERPETUAL FEE TIERS (BINANCE FUTURES STYLE)
-- ============================================================================
-- Base: Maker -0.005% (rebate), Taker 0.035%
-- Higher tiers get better rebates and lower taker fees

CREATE TABLE IF NOT EXISTS perpetual_fee_tiers (
    tier_level INTEGER PRIMARY KEY CHECK (tier_level >= 0 AND tier_level <= 9),
    tier_name VARCHAR(50) NOT NULL,
    
    -- Volume requirements (30-day rolling)
    min_30d_volume_usd DECIMAL(20, 2) NOT NULL DEFAULT 0,
    
    -- DMX token holding requirements (optional boost)
    min_dmx_holding DECIMAL(24, 8) NOT NULL DEFAULT 0,
    
    -- Perpetual Futures Fee Rates (can be negative for maker rebates)
    maker_fee_rate DECIMAL(10, 8) NOT NULL DEFAULT -0.000050, -- -0.005% (rebate)
    taker_fee_rate DECIMAL(10, 8) NOT NULL DEFAULT 0.000350,  -- 0.035%
    
    -- Fee adjustments per tier
    maker_fee_adjustment DECIMAL(10, 8) NOT NULL DEFAULT 0, -- Additional rebate
    taker_fee_adjustment DECIMAL(10, 8) NOT NULL DEFAULT 0, -- Fee reduction
    
    -- Effective fees (calculated)
    effective_maker_fee DECIMAL(10, 8) NOT NULL DEFAULT -0.000050,
    effective_taker_fee DECIMAL(10, 8) NOT NULL DEFAULT 0.000350,
    
    -- Funding fee multiplier (higher tiers may have reduced impact)
    funding_fee_discount DECIMAL(5, 4) NOT NULL DEFAULT 0, -- 0-1 (0% to 100%)
    
    -- Liquidation penalty discount (higher tiers get reduced penalties)
    liquidation_penalty_discount DECIMAL(5, 4) NOT NULL DEFAULT 0,
    
    -- Additional benefits
    daily_withdrawal_limit_usd DECIMAL(20, 2) NOT NULL DEFAULT 10000,
    max_leverage INTEGER NOT NULL DEFAULT 20,
    api_rate_limit_multiplier DECIMAL(5, 2) NOT NULL DEFAULT 1.0,
    priority_execution BOOLEAN DEFAULT false, -- Higher tiers get priority
    
    -- Display
    badge_color VARCHAR(20),
    badge_icon VARCHAR(50),
    description TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE perpetual_fee_tiers IS 'Perpetual futures fee tiers (Binance Futures style)';
COMMENT ON COLUMN perpetual_fee_tiers.maker_fee_rate IS 'Negative = rebate (maker gets paid)';
COMMENT ON COLUMN perpetual_fee_tiers.taker_fee_rate IS 'Always positive (taker pays)';

CREATE INDEX IF NOT EXISTS idx_perp_fee_tiers_volume ON perpetual_fee_tiers(min_30d_volume_usd DESC);
CREATE INDEX IF NOT EXISTS idx_perp_fee_tiers_active ON perpetual_fee_tiers(is_active);

-- ============================================================================
-- FUNDING FEE TRACKING
-- ============================================================================

-- Funding rate history (computed every funding interval)
CREATE TABLE IF NOT EXISTS funding_rate_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    
    -- Funding rate computation
    funding_rate DECIMAL(12, 10) NOT NULL, -- Can be positive or negative
    funding_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    next_funding_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Market state at computation time
    mark_price DECIMAL(24, 8) NOT NULL,
    index_price DECIMAL(24, 8) NOT NULL,
    premium_index DECIMAL(12, 10),
    
    -- Open interest data
    long_open_interest DECIMAL(24, 8) NOT NULL,
    short_open_interest DECIMAL(24, 8) NOT NULL,
    total_open_interest DECIMAL(24, 8) NOT NULL,
    skew DECIMAL(12, 10) NOT NULL, -- (long - short) / total
    
    -- Raw vs clamped rate
    raw_funding_rate DECIMAL(12, 10), -- Before clamping
    was_clamped BOOLEAN DEFAULT false,
    
    -- Totals
    total_funding_transferred DECIMAL(24, 8) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE funding_rate_history IS 'Historical funding rates computed every 8 hours';
COMMENT ON COLUMN funding_rate_history.funding_rate IS 'Positive = longs pay shorts, Negative = shorts pay longs';
COMMENT ON COLUMN funding_rate_history.skew IS 'Position imbalance: (long_oi - short_oi) / total_oi';

CREATE INDEX IF NOT EXISTS idx_funding_rate_symbol ON funding_rate_history(symbol, funding_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_funding_rate_timestamp ON funding_rate_history(funding_timestamp DESC);
CREATE UNIQUE INDEX idx_funding_rate_unique ON funding_rate_history(symbol, funding_timestamp);

-- Individual user funding payments
CREATE TABLE IF NOT EXISTS funding_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position_id UUID NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    funding_rate_id UUID REFERENCES funding_rate_history(id),
    
    -- Position details at funding time
    position_side VARCHAR(10) NOT NULL CHECK (position_side IN ('long', 'short')),
    position_size DECIMAL(24, 8) NOT NULL,
    position_notional DECIMAL(24, 8) NOT NULL,
    mark_price DECIMAL(24, 8) NOT NULL,
    
    -- Funding calculation
    funding_rate DECIMAL(12, 10) NOT NULL,
    funding_amount DECIMAL(24, 8) NOT NULL, -- Positive = paid, Negative = received
    
    -- Payment direction
    payment_direction VARCHAR(10) NOT NULL CHECK (payment_direction IN ('paid', 'received')),
    counterparty_pool BOOLEAN DEFAULT true, -- true = P2P pool, false = specific user
    
    -- Fee tier at time of funding
    fee_tier_level INTEGER,
    funding_fee_discount DECIMAL(5, 4) DEFAULT 0,
    discount_amount DECIMAL(24, 8) DEFAULT 0,
    
    -- Settlement
    settlement_status VARCHAR(20) DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'settled', 'failed')),
    settled_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    funding_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE funding_payments IS 'Individual user funding fee payments/receipts';
COMMENT ON COLUMN funding_payments.funding_amount IS 'Positive = user paid, Negative = user received';

CREATE INDEX IF NOT EXISTS idx_funding_payments_user ON funding_payments(user_id, funding_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_funding_payments_position ON funding_payments(position_id, funding_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_funding_payments_symbol ON funding_payments(symbol, funding_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_funding_payments_settlement ON funding_payments(settlement_status) WHERE settlement_status = 'pending';

-- ============================================================================
-- LIQUIDATION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS liquidation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position_id UUID NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    
    -- Liquidation type
    liquidation_type VARCHAR(20) NOT NULL CHECK (liquidation_type IN ('partial', 'full', 'bankruptcy')),
    liquidation_stage INTEGER DEFAULT 1, -- For progressive liquidation
    
    -- Position details before liquidation
    position_side VARCHAR(10) NOT NULL CHECK (position_side IN ('long', 'short')),
    original_size DECIMAL(24, 8) NOT NULL,
    liquidated_size DECIMAL(24, 8) NOT NULL,
    remaining_size DECIMAL(24, 8) NOT NULL,
    
    -- Prices
    entry_price DECIMAL(24, 8) NOT NULL,
    mark_price DECIMAL(24, 8) NOT NULL,
    liquidation_price DECIMAL(24, 8) NOT NULL,
    bankruptcy_price DECIMAL(24, 8),
    execution_price DECIMAL(24, 8) NOT NULL,
    
    -- Margin details
    initial_margin DECIMAL(24, 8) NOT NULL,
    maintenance_margin DECIMAL(24, 8) NOT NULL,
    margin_balance DECIMAL(24, 8) NOT NULL,
    margin_ratio DECIMAL(10, 8) NOT NULL,
    
    -- PnL
    unrealized_pnl DECIMAL(24, 8) NOT NULL,
    realized_pnl DECIMAL(24, 8) NOT NULL,
    
    -- Notional value
    liquidated_notional DECIMAL(24, 8) NOT NULL,
    
    -- Fees and penalties
    base_liquidation_penalty DECIMAL(10, 8) NOT NULL DEFAULT 0.004, -- 0.4%
    fee_tier_level INTEGER,
    liquidation_penalty_discount DECIMAL(5, 4) DEFAULT 0,
    
    penalty_amount DECIMAL(24, 8) NOT NULL, -- Actual penalty charged
    penalty_to_insurance DECIMAL(24, 8) NOT NULL, -- Amount to insurance fund
    penalty_to_liquidator DECIMAL(24, 8) DEFAULT 0, -- If using external liquidators
    
    -- Insurance fund
    insurance_fund_contribution DECIMAL(24, 8) NOT NULL,
    socialized_loss DECIMAL(24, 8) DEFAULT 0, -- If insurance fund insufficient
    
    -- Liquidator (if applicable)
    liquidator_type VARCHAR(20) DEFAULT 'system' CHECK (liquidator_type IN ('system', 'keeper', 'auction')),
    liquidator_id UUID,
    liquidator_reward DECIMAL(24, 8) DEFAULT 0,
    
    -- Execution
    execution_status VARCHAR(20) DEFAULT 'pending' CHECK (execution_status IN ('pending', 'executed', 'failed', 'cancelled')),
    execution_method VARCHAR(20) DEFAULT 'market' CHECK (execution_method IN ('market', 'limit', 'auction')),
    counterparty_order_id UUID,
    
    -- Timestamps
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE liquidation_events IS 'Record of all liquidation events with penalties';
COMMENT ON COLUMN liquidation_events.liquidation_type IS 'partial=reduce position, full=close position, bankruptcy=socialized loss';
COMMENT ON COLUMN liquidation_events.penalty_amount IS '0.4% of liquidated notional (less any tier discount)';

CREATE INDEX IF NOT EXISTS idx_liquidation_user ON liquidation_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidation_position ON liquidation_events(position_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidation_symbol ON liquidation_events(symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidation_type ON liquidation_events(liquidation_type);
CREATE INDEX IF NOT EXISTS idx_liquidation_status ON liquidation_events(execution_status) WHERE execution_status = 'pending';

-- ============================================================================
-- INSURANCE FUND
-- ============================================================================

CREATE TABLE IF NOT EXISTS insurance_fund (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    
    -- Balance
    balance DECIMAL(24, 8) NOT NULL DEFAULT 0,
    total_contributions DECIMAL(24, 8) NOT NULL DEFAULT 0,
    total_payouts DECIMAL(24, 8) NOT NULL DEFAULT 0,
    
    -- Metrics
    liquidations_covered INTEGER DEFAULT 0,
    socialized_losses_count INTEGER DEFAULT 0,
    total_socialized_loss DECIMAL(24, 8) DEFAULT 0,
    
    -- Thresholds
    min_balance DECIMAL(24, 8) DEFAULT 0,
    target_balance DECIMAL(24, 8),
    max_single_payout DECIMAL(24, 8),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_contribution_at TIMESTAMP WITH TIME ZONE,
    last_payout_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(symbol)
);

COMMENT ON TABLE insurance_fund IS 'Insurance fund balance and metrics per symbol';

CREATE INDEX IF NOT EXISTS idx_insurance_fund_symbol ON insurance_fund(symbol);
CREATE INDEX IF NOT EXISTS idx_insurance_fund_active ON insurance_fund(is_active);

-- Insurance fund transactions
CREATE TABLE IF NOT EXISTS insurance_fund_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    
    -- Transaction type
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN (
        'liquidation_penalty',
        'socialized_loss_payout',
        'manual_contribution',
        'manual_withdrawal',
        'fee_contribution'
    )),
    
    -- Amount
    amount DECIMAL(24, 8) NOT NULL, -- Positive = inflow, Negative = outflow
    balance_before DECIMAL(24, 8) NOT NULL,
    balance_after DECIMAL(24, 8) NOT NULL,
    
    -- References
    liquidation_id UUID REFERENCES liquidation_events(id),
    user_id UUID REFERENCES users(id),
    admin_id UUID,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE insurance_fund_transactions IS 'All insurance fund inflows and outflows';

CREATE INDEX IF NOT EXISTS idx_insurance_fund_tx_symbol ON insurance_fund_transactions(symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insurance_fund_tx_type ON insurance_fund_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_insurance_fund_tx_liquidation ON insurance_fund_transactions(liquidation_id);

-- ============================================================================
-- USER PERPETUAL FEE STATUS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_perpetual_fee_status (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Current tier
    current_tier INTEGER NOT NULL DEFAULT 0 REFERENCES perpetual_fee_tiers(tier_level),
    previous_tier INTEGER DEFAULT 0,
    
    -- Volume tracking (30-day rolling)
    volume_30d_usd DECIMAL(20, 2) NOT NULL DEFAULT 0,
    last_volume_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- DMX holdings
    current_dmx_balance DECIMAL(24, 8) NOT NULL DEFAULT 0,
    
    -- Fee preferences
    pay_fees_with_dmx BOOLEAN DEFAULT false,
    
    -- Effective fees (cached)
    effective_maker_fee DECIMAL(10, 8) NOT NULL DEFAULT -0.000050, -- -0.005%
    effective_taker_fee DECIMAL(10, 8) NOT NULL DEFAULT 0.000350,  -- 0.035%
    effective_maker_fee_with_dmx DECIMAL(10, 8),
    effective_taker_fee_with_dmx DECIMAL(10, 8),
    
    -- Funding fee settings
    funding_fee_discount DECIMAL(5, 4) DEFAULT 0,
    
    -- Liquidation penalty discount
    liquidation_penalty_discount DECIMAL(5, 4) DEFAULT 0,
    
    -- Statistics
    total_maker_rebates_usd DECIMAL(24, 8) DEFAULT 0,
    total_taker_fees_usd DECIMAL(24, 8) DEFAULT 0,
    total_funding_paid_usd DECIMAL(24, 8) DEFAULT 0,
    total_funding_received_usd DECIMAL(24, 8) DEFAULT 0,
    total_liquidation_penalties_usd DECIMAL(24, 8) DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_perpetual_fee_status IS 'User perpetual futures fee tier status';
COMMENT ON COLUMN user_perpetual_fee_status.effective_maker_fee IS 'Negative = rebate';

CREATE INDEX IF NOT EXISTS idx_user_perp_fee_tier ON user_perpetual_fee_status(current_tier);
CREATE INDEX IF NOT EXISTS idx_user_perp_fee_volume ON user_perpetual_fee_status(volume_30d_usd DESC);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Current funding rate view
CREATE OR REPLACE VIEW v_current_funding_rates AS
SELECT DISTINCT ON (symbol)
    symbol,
    funding_rate,
    funding_timestamp,
    next_funding_timestamp,
    mark_price,
    index_price,
    long_open_interest,
    short_open_interest,
    skew,
    CASE WHEN funding_rate > 0 THEN 'longs_pay' ELSE 'shorts_pay' END as direction
FROM funding_rate_history
ORDER BY symbol, funding_timestamp DESC;

COMMENT ON VIEW v_current_funding_rates IS 'Most recent funding rate for each symbol';

-- User fee summary view
CREATE OR REPLACE VIEW v_user_perpetual_fees AS
SELECT 
    upfs.user_id,
    upfs.current_tier,
    pft.tier_name,
    upfs.volume_30d_usd,
    upfs.effective_maker_fee,
    upfs.effective_taker_fee,
    upfs.effective_maker_fee_with_dmx,
    upfs.effective_taker_fee_with_dmx,
    upfs.funding_fee_discount,
    upfs.liquidation_penalty_discount,
    upfs.total_maker_rebates_usd,
    upfs.total_taker_fees_usd,
    upfs.total_funding_paid_usd,
    upfs.total_funding_received_usd,
    upfs.total_liquidation_penalties_usd,
    (upfs.total_maker_rebates_usd - upfs.total_taker_fees_usd) as net_trading_fees,
    (upfs.total_funding_received_usd - upfs.total_funding_paid_usd) as net_funding,
    upfs.updated_at
FROM user_perpetual_fee_status upfs
JOIN perpetual_fee_tiers pft ON upfs.current_tier = pft.tier_level;

COMMENT ON VIEW v_user_perpetual_fees IS 'User perpetual fee summary with tier benefits';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Calculate funding rate using smoothed model
CREATE OR REPLACE FUNCTION calculate_funding_rate(
    p_long_oi DECIMAL(24,8),
    p_short_oi DECIMAL(24,8),
    p_k DECIMAL(12,8) DEFAULT 0.00015,
    p_min_rate DECIMAL(12,10) DEFAULT -0.00015,
    p_max_rate DECIMAL(12,10) DEFAULT 0.00015
) RETURNS DECIMAL(12,10) AS $$
DECLARE
    v_total_oi DECIMAL(24,8);
    v_skew DECIMAL(12,10);
    v_raw_rate DECIMAL(12,10);
    v_clamped_rate DECIMAL(12,10);
BEGIN
    v_total_oi := p_long_oi + p_short_oi;
    
    IF v_total_oi = 0 THEN
        RETURN 0;
    END IF;
    
    -- Calculate skew: (long - short) / total
    v_skew := (p_long_oi - p_short_oi) / v_total_oi;
    
    -- Apply tanh-like smoothing: k * tanh(skew)
    -- Approximation: k * skew for small values, capped at extremes
    v_raw_rate := p_k * TANH(v_skew * 10); -- Scale skew for tanh sensitivity
    
    -- Clamp to min/max
    v_clamped_rate := GREATEST(p_min_rate, LEAST(p_max_rate, v_raw_rate));
    
    RETURN v_clamped_rate;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_funding_rate IS 'Calculate funding rate using smoothed tanh model with clamping';

-- Calculate liquidation penalty
CREATE OR REPLACE FUNCTION calculate_liquidation_penalty(
    p_notional DECIMAL(24,8),
    p_base_penalty DECIMAL(10,8) DEFAULT 0.004, -- 0.4%
    p_tier_discount DECIMAL(5,4) DEFAULT 0
) RETURNS DECIMAL(24,8) AS $$
BEGIN
    RETURN p_notional * p_base_penalty * (1 - p_tier_discount);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_liquidation_penalty IS 'Calculate liquidation penalty with tier discount';

-- Calculate transaction fee (supports negative maker rebates)
CREATE OR REPLACE FUNCTION calculate_transaction_fee(
    p_notional DECIMAL(24,8),
    p_fee_rate DECIMAL(10,8), -- Can be negative for maker rebate
    p_dmx_discount DECIMAL(5,4) DEFAULT 0,
    p_apply_dmx BOOLEAN DEFAULT false
) RETURNS DECIMAL(24,8) AS $$
DECLARE
    v_fee DECIMAL(24,8);
BEGIN
    v_fee := p_notional * p_fee_rate;
    
    -- Apply DMX discount only to positive fees (taker)
    IF p_apply_dmx AND v_fee > 0 THEN
        v_fee := v_fee * (1 - p_dmx_discount);
    END IF;
    
    -- For rebates (negative), DMX discount increases the rebate
    IF p_apply_dmx AND v_fee < 0 THEN
        v_fee := v_fee * (1 + p_dmx_discount * 0.5); -- 50% bonus on rebates
    END IF;
    
    RETURN v_fee;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_transaction_fee IS 'Calculate transaction fee (negative = rebate for makers)';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_perpetual_fee_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_perp_fee_tiers_updated
    BEFORE UPDATE ON perpetual_fee_tiers
    FOR EACH ROW
    EXECUTE FUNCTION update_perpetual_fee_timestamp();

CREATE TRIGGER trigger_user_perp_fee_updated
    BEFORE UPDATE ON user_perpetual_fee_status
    FOR EACH ROW
    EXECUTE FUNCTION update_perpetual_fee_timestamp();

CREATE TRIGGER trigger_insurance_fund_updated
    BEFORE UPDATE ON insurance_fund
    FOR EACH ROW
    EXECUTE FUNCTION update_perpetual_fee_timestamp();
