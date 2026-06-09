-- ============================================================================
-- DOTMX USER SERVICE DATABASE SCHEMA
-- Separate database for user management, authentication, loyalty, and referrals
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ACCOUNT TYPE & ROLE ENUMS
-- ============================================================================
-- Account types for all stakeholders
DO $$ BEGIN
    CREATE TYPE account_type AS ENUM (
      'retail',              -- Regular retail traders
      'market_maker',        -- Market makers providing liquidity
      'liquidity_provider',  -- Liquidity providers
      'institutional',       -- Institutional traders (hedge funds, prop firms)
      'vip',                 -- VIP/High net worth individuals
      'affiliate',           -- Affiliate partners
      'api_trader',          -- API/algorithmic traders
      'demo'                 -- Demo/paper trading accounts
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- USERS TABLE (All Stakeholders)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    password_hash TEXT,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    username VARCHAR(50) UNIQUE,
    avatar_url TEXT,
    
    -- Account Classification
    account_type account_type DEFAULT 'retail',
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'trader', 'market_maker', 'liquidity_provider', 'affiliate', 'vip', 'moderator', 'support', 'admin', 'super_admin')),
    
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'deleted')),
    tier VARCHAR(20) DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
    
    -- Account Features
    is_institutional BOOLEAN DEFAULT false,
    is_market_maker BOOLEAN DEFAULT false,
    is_vip BOOLEAN DEFAULT false,
    is_affiliate BOOLEAN DEFAULT false,
    api_enabled BOOLEAN DEFAULT false,
    
    -- KYC/Verification
    kyc_verified BOOLEAN DEFAULT false,
    kyc_level INTEGER DEFAULT 0,
    kyc_provider VARCHAR(50),
    
    -- Security
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret TEXT,
    
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ============================================================================
-- WALLET LINKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS wallet_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(255) NOT NULL,
    chain_code VARCHAR(20) NOT NULL,
    chain_id INT,
    wallet_type VARCHAR(50) DEFAULT 'external',
    is_primary BOOLEAN DEFAULT FALSE,
    verified BOOLEAN DEFAULT FALSE,
    verexbase_vault_id UUID,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(wallet_address, chain_code)
);

CREATE INDEX IF NOT EXISTS idx_wallet_links_user_id ON wallet_links(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_links_wallet_address ON wallet_links(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_links_chain_code ON wallet_links(chain_code);
CREATE UNIQUE INDEX idx_wallet_links_primary_per_user ON wallet_links(user_id) WHERE is_primary = TRUE;

-- ============================================================================
-- SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL UNIQUE,
    access_token_jti TEXT,
    device_name VARCHAR(255),
    device_fingerprint TEXT,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token) WHERE revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================================
-- API KEYS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
    rate_limit_per_minute INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    last_used_ip INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash) WHERE is_active = TRUE;

-- ============================================================================
-- LOYALTY POINTS TABLE (Supports All Account Types)
-- ============================================================================
CREATE TABLE IF NOT EXISTS loyalty_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance BIGINT DEFAULT 0 CHECK (balance >= 0),
    lifetime_earned BIGINT DEFAULT 0,
    lifetime_spent BIGINT DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'bronze',
    
    -- Base multipliers
    multiplier DECIMAL(5,2) DEFAULT 1.00,
    daily_profit_multiplier DECIMAL(5,2) DEFAULT 1.00,
    referral_multiplier DECIMAL(5,2) DEFAULT 1.00,
    
    -- Account type specific multipliers
    volume_multiplier DECIMAL(5,2) DEFAULT 1.00,         -- High volume traders
    market_maker_multiplier DECIMAL(5,2) DEFAULT 1.00,   -- Market makers (liquidity provision bonus)
    institutional_multiplier DECIMAL(5,2) DEFAULT 1.00,  -- Institutional accounts
    vip_multiplier DECIMAL(5,2) DEFAULT 1.00,           -- VIP accounts
    affiliate_multiplier DECIMAL(5,2) DEFAULT 1.00,     -- Affiliates
    api_trader_multiplier DECIMAL(5,2) DEFAULT 1.00,    -- API traders
    
    -- Loyalty program type
    loyalty_program VARCHAR(50) DEFAULT 'standard' CHECK (loyalty_program IN ('standard', 'market_maker', 'institutional', 'vip', 'affiliate')),
    
    last_tier_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_loyalty_points_user_id ON loyalty_points(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_balance ON loyalty_points(balance);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_tier ON loyalty_points(tier);

-- ============================================================================
-- POINTS TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS points_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('earn', 'spend', 'bonus', 'referral', 'admin_adjust')),
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    source VARCHAR(100),
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_transactions_user_id ON points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_type ON points_transactions(type);
CREATE INDEX IF NOT EXISTS idx_points_transactions_created_at ON points_transactions(created_at);

-- ============================================================================
-- TRADING VOLUME TABLE (Synced from Exchange DB)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_trading_volume (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_volume_usd DECIMAL(20,2) DEFAULT 0,
    buy_volume_usd DECIMAL(20,2) DEFAULT 0,
    sell_volume_usd DECIMAL(20,2) DEFAULT 0,
    trade_count INT DEFAULT 0,
    symbols_traded TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_trading_volume_user_id ON user_trading_volume(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trading_volume_date ON user_trading_volume(date);
CREATE INDEX IF NOT EXISTS idx_user_trading_volume_volume ON user_trading_volume(total_volume_usd);

-- ============================================================================
-- TRADING PROFIT TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_trading_profit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    realized_pnl_usd DECIMAL(20,2) DEFAULT 0,
    unrealized_pnl_usd DECIMAL(20,2) DEFAULT 0,
    total_pnl_usd DECIMAL(20,2) DEFAULT 0,
    profit_percentage DECIMAL(10,4) DEFAULT 0,
    starting_balance_usd DECIMAL(20,2) DEFAULT 0,
    ending_balance_usd DECIMAL(20,2) DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0,
    profit_factor DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_trading_profit_user_id ON user_trading_profit(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trading_profit_date ON user_trading_profit(date);
CREATE INDEX IF NOT EXISTS idx_user_trading_profit_percentage ON user_trading_profit(profit_percentage);

-- ============================================================================
-- PROFIT MULTIPLIER TIERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS profit_multiplier_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier_name VARCHAR(50) NOT NULL UNIQUE,
    min_profit_percentage DECIMAL(10,4) NOT NULL,
    max_profit_percentage DECIMAL(10,4),
    multiplier DECIMAL(5,2) NOT NULL,
    consecutive_days_required INT DEFAULT 1,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default multiplier tiers
INSERT INTO profit_multiplier_tiers (tier_name, min_profit_percentage, max_profit_percentage, multiplier, consecutive_days_required, description) VALUES
('no_bonus', -999999, 0, 1.00, 1, 'No profit or loss'),
('small_profit', 0.01, 2, 1.10, 1, 'Small daily profit (0.01% - 2%)'),
('medium_profit', 2.01, 5, 1.25, 1, 'Medium daily profit (2% - 5%)'),
('high_profit', 5.01, 10, 1.50, 1, 'High daily profit (5% - 10%)'),
('exceptional_profit', 10.01, 999999, 2.00, 1, 'Exceptional daily profit (>10%)'),
('consistent_winner_3d', 0.01, 999999, 1.30, 3, '3 consecutive days of profit'),
('consistent_winner_7d', 0.01, 999999, 1.60, 7, '7 consecutive days of profit'),
('consistent_winner_30d', 0.01, 999999, 2.50, 30, '30 consecutive days of profit')
ON CONFLICT (tier_name) DO NOTHING;

-- ============================================================================
-- REFERRAL CODES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS referral_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL UNIQUE,
    current_uses INT DEFAULT 0,
    max_uses INT,
    signup_reward_points INT DEFAULT 100,
    first_trade_reward_points INT DEFAULT 50,
    commission_percentage DECIMAL(5,2) DEFAULT 10.00,
    referrer_reward_percentage DECIMAL(5,2) DEFAULT 10.00,
    referee_reward_percentage DECIMAL(5,2) DEFAULT 5.00,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON referral_codes(is_active);

-- ============================================================================
-- REFERRALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referral_code_id UUID REFERENCES referral_codes(id) ON DELETE SET NULL,
    referral_code VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'expired', 'invalid')),
    referred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    first_trade_at TIMESTAMP WITH TIME ZONE,
    total_volume_usd DECIMAL(20,2) DEFAULT 0,
    total_rewards_distributed DECIMAL(20,2) DEFAULT 0,
    referrer_total_earned_points BIGINT DEFAULT 0,
    referee_total_earned_points BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(referee_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee_id ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at);

-- ============================================================================
-- REFERRAL REWARDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS referral_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('referrer', 'referee')),
    reward_type VARCHAR(50) NOT NULL CHECK (reward_type IN ('signup', 'first_trade', 'volume_milestone', 'monthly_commission')),
    points_amount BIGINT NOT NULL,
    commission_percentage DECIMAL(5,2),
    volume_amount_usd DECIMAL(20,2),
    description TEXT,
    distributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referral_id ON referral_rewards(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_recipient_id ON referral_rewards(recipient_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_created_at ON referral_rewards(created_at);

-- ============================================================================
-- USER STATISTICS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_trades BIGINT DEFAULT 0,
    total_volume_usd DECIMAL(20,2) DEFAULT 0,
    total_pnl_usd DECIMAL(20,2) DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0,
    avg_trade_size_usd DECIMAL(20,2) DEFAULT 0,
    best_day_pnl_usd DECIMAL(20,2) DEFAULT 0,
    worst_day_pnl_usd DECIMAL(20,2) DEFAULT 0,
    consecutive_profit_days INT DEFAULT 0,
    max_consecutive_profit_days INT DEFAULT 0,
    total_referrals INT DEFAULT 0,
    active_referrals INT DEFAULT 0,
    last_trade_at TIMESTAMP WITH TIME ZONE,
    last_profit_calculation_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_user_statistics_user_id ON user_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_statistics_total_volume ON user_statistics(total_volume_usd);
CREATE INDEX IF NOT EXISTS idx_user_statistics_total_pnl ON user_statistics(total_pnl_usd);

-- ============================================================================
-- AUTH AUDIT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS auth_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    email VARCHAR(255),
    wallet_address VARCHAR(255),
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_user_id ON auth_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_event_type ON auth_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_created_at ON auth_audit_logs(created_at);

-- ============================================================================
-- EMAIL VERIFICATION TOKENS
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token) WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);

-- ============================================================================
-- PASSWORD RESET TOKENS
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    token TEXT NOT NULL UNIQUE,
    token_hash TEXT, -- Hashed version for storage
    
    -- Validity
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    
    -- Request context
    request_ip VARCHAR(45),
    request_user_agent TEXT,
    ip_address INET,
    
    -- Usage context
    used_ip VARCHAR(45),
    used_user_agent TEXT,
    
    -- Security
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token) WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used ON password_reset_tokens(used);

-- ============================================================================
-- WALLET AUTH CHALLENGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS wallet_auth_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(255) NOT NULL,
    chain_code VARCHAR(20) NOT NULL,
    challenge_message TEXT NOT NULL,
    nonce VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_auth_challenges_nonce ON wallet_auth_challenges(nonce) WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_wallet_auth_challenges_wallet_address ON wallet_auth_challenges(wallet_address);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_links_updated_at BEFORE UPDATE ON wallet_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_points_updated_at BEFORE UPDATE ON loyalty_points
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_trading_volume_updated_at BEFORE UPDATE ON user_trading_volume
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_trading_profit_updated_at BEFORE UPDATE ON user_trading_profit
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_statistics_updated_at BEFORE UPDATE ON user_statistics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Initialize loyalty points for new user
CREATE OR REPLACE FUNCTION initialize_loyalty_points()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO loyalty_points (user_id, balance, tier, multiplier)
    VALUES (NEW.id, 0, 'bronze', 1.00);
    
    INSERT INTO user_statistics (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_initialize_loyalty_points
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION initialize_loyalty_points();

-- Calculate points multiplier based on profit and volume
CREATE OR REPLACE FUNCTION calculate_points_multiplier(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_base_multiplier DECIMAL(5,2) := 1.00;
    v_profit_multiplier DECIMAL(5,2) := 1.00;
    v_referral_multiplier DECIMAL(5,2) := 1.00;
    v_consecutive_days INT;
    v_latest_profit_pct DECIMAL(10,4);
BEGIN
    -- Get consecutive profit days
    SELECT consecutive_profit_days INTO v_consecutive_days
    FROM user_statistics
    WHERE user_id = p_user_id;
    
    -- Get latest profit percentage
    SELECT profit_percentage INTO v_latest_profit_pct
    FROM user_trading_profit
    WHERE user_id = p_user_id
    ORDER BY date DESC
    LIMIT 1;
    
    -- Calculate profit multiplier
    SELECT MAX(multiplier) INTO v_profit_multiplier
    FROM profit_multiplier_tiers
    WHERE v_latest_profit_pct >= min_profit_percentage
      AND (max_profit_percentage IS NULL OR v_latest_profit_pct <= max_profit_percentage)
      AND v_consecutive_days >= consecutive_days_required;
    
    -- Get referral multiplier (1.1x if user has active referrals)
    SELECT CASE WHEN active_referrals > 0 THEN 1.10 ELSE 1.00 END
    INTO v_referral_multiplier
    FROM user_statistics
    WHERE user_id = p_user_id;
    
    -- Update loyalty_points table
    UPDATE loyalty_points
    SET daily_profit_multiplier = COALESCE(v_profit_multiplier, 1.00),
        referral_multiplier = v_referral_multiplier,
        multiplier = COALESCE(v_profit_multiplier, 1.00) * v_referral_multiplier
    WHERE user_id = p_user_id;
    
    RETURN COALESCE(v_profit_multiplier, 1.00) * v_referral_multiplier;
END;
$$ LANGUAGE plpgsql;

-- Award loyalty points
CREATE OR REPLACE FUNCTION award_loyalty_points(
    p_user_id UUID,
    p_type VARCHAR(50),
    p_amount BIGINT,
    p_source VARCHAR(100),
    p_description TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID;
    v_new_balance BIGINT;
    v_multiplier DECIMAL(5,2);
    v_final_amount BIGINT;
BEGIN
    -- Get current multiplier
    SELECT multiplier INTO v_multiplier
    FROM loyalty_points
    WHERE user_id = p_user_id;
    
    -- Calculate final amount with multiplier (only for 'earn' type)
    IF p_type = 'earn' THEN
        v_final_amount := FLOOR(p_amount * v_multiplier);
    ELSE
        v_final_amount := p_amount;
    END IF;
    
    -- Update balance
    UPDATE loyalty_points
    SET balance = balance + v_final_amount,
        lifetime_earned = CASE WHEN p_type IN ('earn', 'bonus', 'referral') 
                              THEN lifetime_earned + v_final_amount 
                              ELSE lifetime_earned END,
        lifetime_spent = CASE WHEN p_type = 'spend' 
                             THEN lifetime_spent + ABS(v_final_amount) 
                             ELSE lifetime_spent END
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;
    
    -- Create transaction record
    INSERT INTO points_transactions (user_id, type, amount, balance_after, source, description, metadata)
    VALUES (p_user_id, p_type, v_final_amount, v_new_balance, p_source, p_description, p_metadata)
    RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE users IS 'User accounts for all stakeholders (retail, market makers, institutions, affiliates)';
COMMENT ON TABLE loyalty_points IS 'Loyalty points system with profit-based multipliers for all account types';
COMMENT ON TABLE user_trading_volume IS 'Daily trading volume synced from exchange database';
COMMENT ON TABLE user_trading_profit IS 'Daily profit tracking for multiplier calculation';
COMMENT ON TABLE referrals IS 'Referral system tracking referrer-referee relationships';
COMMENT ON TABLE referral_rewards IS 'Rewards distributed through referral program';

-- ============================================================================
-- MARKET MAKER SPECIFIC TABLES
-- ============================================================================

-- Market maker statistics and performance
CREATE TABLE IF NOT EXISTS market_maker_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Liquidity provision metrics
    total_liquidity_provided_usd DECIMAL(20,2) DEFAULT 0,
    active_orders_count INTEGER DEFAULT 0,
    average_spread_bps DECIMAL(10,4) DEFAULT 0,
    uptime_percentage DECIMAL(5,2) DEFAULT 0,
    quote_acceptance_rate DECIMAL(5,2) DEFAULT 0,
    
    -- Volume breakdown
    maker_volume_usd DECIMAL(20,2) DEFAULT 0,
    taker_volume_usd DECIMAL(20,2) DEFAULT 0,
    total_mm_volume_usd DECIMAL(20,2) DEFAULT 0,
    
    -- Earnings
    total_maker_fees_earned DECIMAL(20,2) DEFAULT 0,
    total_rebates_earned DECIMAL(20,2) DEFAULT 0,
    total_mm_rewards DECIMAL(20,2) DEFAULT 0,
    
    -- Performance metrics
    best_day_volume DECIMAL(20,2) DEFAULT 0,
    best_day_earnings DECIMAL(20,2) DEFAULT 0,
    current_mm_tier VARCHAR(20) DEFAULT 'tier_1' CHECK (current_mm_tier IN ('tier_1', 'tier_2', 'tier_3', 'elite')),
    
    -- Time tracking
    last_quote_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_market_maker_stats_user ON market_maker_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_market_maker_stats_tier ON market_maker_stats(current_mm_tier);
CREATE INDEX IF NOT EXISTS idx_market_maker_stats_volume ON market_maker_stats(total_mm_volume_usd);

-- ============================================================================
-- INSTITUTIONAL ACCOUNTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS institutional_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Company information
    company_name VARCHAR(255) NOT NULL,
    company_type VARCHAR(50) CHECK (company_type IN ('hedge_fund', 'prop_firm', 'bank', 'broker', 'family_office', 'exchange', 'other')),
    registration_number VARCHAR(100),
    tax_id VARCHAR(100),
    jurisdiction VARCHAR(100),
    
    -- AUM and limits
    assets_under_management DECIMAL(20,2),
    daily_volume_limit DECIMAL(20,2),
    position_size_limit DECIMAL(20,2),
    max_leverage DECIMAL(5,2) DEFAULT 1.0,
    
    -- Features
    custom_fee_structure BOOLEAN DEFAULT false,
    fee_tier VARCHAR(20) DEFAULT 'standard',
    dedicated_support BOOLEAN DEFAULT true,
    api_rate_limit_multiplier DECIMAL(5,2) DEFAULT 10.0,
    otc_access BOOLEAN DEFAULT true,
    private_pools_access BOOLEAN DEFAULT false,
    
    -- Contacts
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    compliance_contact VARCHAR(255),
    risk_officer_contact VARCHAR(255),
    
    -- Documentation
    documents JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_institutional_accounts_user ON institutional_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_institutional_accounts_type ON institutional_accounts(company_type);

-- ============================================================================
-- VIP ACCOUNTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS vip_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- VIP tier
    vip_tier VARCHAR(20) DEFAULT 'vip_1' CHECK (vip_tier IN ('vip_1', 'vip_2', 'vip_3', 'whale', 'ultra')),
    
    -- Fee benefits
    fee_discount_percentage DECIMAL(5,2) DEFAULT 0,
    maker_fee_override DECIMAL(5,4),
    taker_fee_override DECIMAL(5,4),
    withdrawal_fee_waived BOOLEAN DEFAULT false,
    
    -- Service benefits
    priority_support BOOLEAN DEFAULT true,
    dedicated_account_manager BOOLEAN DEFAULT false,
    account_manager_name VARCHAR(255),
    account_manager_email VARCHAR(255),
    account_manager_telegram VARCHAR(255),
    
    -- Trading benefits
    higher_leverage_enabled BOOLEAN DEFAULT false,
    max_leverage_multiplier DECIMAL(5,2) DEFAULT 1.0,
    instant_withdrawals BOOLEAN DEFAULT false,
    higher_withdrawal_limits BOOLEAN DEFAULT false,
    otc_trading_enabled BOOLEAN DEFAULT false,
    private_sale_access BOOLEAN DEFAULT false,
    
    -- Points & rewards
    points_multiplier DECIMAL(5,2) DEFAULT 2.0,
    monthly_bonus_points INTEGER DEFAULT 0,
    
    -- Exclusive features
    early_feature_access BOOLEAN DEFAULT false,
    governance_voting BOOLEAN DEFAULT false,
    exclusive_events_access BOOLEAN DEFAULT false,
    
    vip_since TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_vip_benefits_user ON vip_benefits(user_id);
CREATE INDEX IF NOT EXISTS idx_vip_benefits_tier ON vip_benefits(vip_tier);

-- ============================================================================
-- AFFILIATE PROGRAM
-- ============================================================================

CREATE TABLE IF NOT EXISTS affiliate_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Affiliate information
    affiliate_tier VARCHAR(20) DEFAULT 'bronze' CHECK (affiliate_tier IN ('bronze', 'silver', 'gold', 'platinum', 'ambassador')),
    affiliate_code VARCHAR(50) UNIQUE,
    company_name VARCHAR(255),
    website VARCHAR(255),
    social_media JSONB DEFAULT '{}'::jsonb,
    
    -- Commission structure
    base_commission_percentage DECIMAL(5,2) DEFAULT 10.0,
    tier_bonus_percentage DECIMAL(5,2) DEFAULT 0,
    lifetime_commission BOOLEAN DEFAULT false,
    commission_type VARCHAR(20) DEFAULT 'revenue_share' CHECK (commission_type IN ('revenue_share', 'cpa', 'hybrid')),
    
    -- CPA rates (if applicable)
    cpa_amount DECIMAL(10,2),
    cpa_conversions INTEGER DEFAULT 0,
    
    -- Performance tracking
    total_referrals INTEGER DEFAULT 0,
    active_referrals INTEGER DEFAULT 0,
    total_referral_volume DECIMAL(20,2) DEFAULT 0,
    total_commission_earned DECIMAL(20,2) DEFAULT 0,
    total_commission_paid DECIMAL(20,2) DEFAULT 0,
    pending_commission DECIMAL(20,2) DEFAULT 0,
    
    -- Monthly tracking
    current_month_referrals INTEGER DEFAULT 0,
    current_month_volume DECIMAL(20,2) DEFAULT 0,
    current_month_commission DECIMAL(20,2) DEFAULT 0,
    
    -- Payment information
    payment_method VARCHAR(50) CHECK (payment_method IN ('crypto', 'bank_transfer', 'paypal', 'points')),
    payment_address VARCHAR(255),
    payment_currency VARCHAR(10) DEFAULT 'USDT',
    payment_schedule VARCHAR(20) DEFAULT 'monthly' CHECK (payment_schedule IN ('weekly', 'biweekly', 'monthly', 'quarterly')),
    min_payout_amount DECIMAL(10,2) DEFAULT 100,
    
    -- Marketing materials
    custom_landing_page VARCHAR(255),
    tracking_pixel_id VARCHAR(100),
    marketing_materials JSONB DEFAULT '[]'::jsonb,
    
    -- Status
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    verification_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_accounts_user ON affiliate_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_accounts_code ON affiliate_accounts(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_accounts_tier ON affiliate_accounts(affiliate_tier);
CREATE INDEX IF NOT EXISTS idx_affiliate_accounts_active ON affiliate_accounts(is_active);

-- ============================================================================
-- LIQUIDITY PROVIDER STATS
-- ============================================================================

CREATE TABLE IF NOT EXISTS liquidity_provider_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Pool participation
    total_pools_joined INTEGER DEFAULT 0,
    active_pools INTEGER DEFAULT 0,
    total_liquidity_provided DECIMAL(20,2) DEFAULT 0,
    current_liquidity_active DECIMAL(20,2) DEFAULT 0,
    
    -- Earnings
    total_fees_earned DECIMAL(20,2) DEFAULT 0,
    total_rewards_earned DECIMAL(20,2) DEFAULT 0,
    impermanent_loss DECIMAL(20,2) DEFAULT 0,
    net_earnings DECIMAL(20,2) DEFAULT 0,
    
    -- Performance
    average_apr DECIMAL(5,2) DEFAULT 0,
    best_pool_apr DECIMAL(5,2) DEFAULT 0,
    total_days_active INTEGER DEFAULT 0,
    
    -- Tier
    lp_tier VARCHAR(20) DEFAULT 'standard' CHECK (lp_tier IN ('standard', 'preferred', 'elite')),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_liquidity_provider_stats_user ON liquidity_provider_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_liquidity_provider_stats_tier ON liquidity_provider_stats(lp_tier);

-- ============================================================================
-- API TRADER CONFIGURATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_trader_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Rate limits
    requests_per_second INTEGER DEFAULT 10,
    requests_per_minute INTEGER DEFAULT 600,
    requests_per_hour INTEGER DEFAULT 10000,
    
    -- Quotas
    daily_order_limit INTEGER DEFAULT 10000,
    max_concurrent_orders INTEGER DEFAULT 100,
    max_order_size DECIMAL(20,2),
    
    -- Features
    websocket_enabled BOOLEAN DEFAULT true,
    fix_api_enabled BOOLEAN DEFAULT false,
    market_data_access BOOLEAN DEFAULT true,
    advanced_order_types BOOLEAN DEFAULT false,
    
    -- Performance
    total_api_calls BIGINT DEFAULT 0,
    total_orders_placed BIGINT DEFAULT 0,
    average_latency_ms DECIMAL(10,2),
    
    -- Monitoring
    alert_on_rate_limit BOOLEAN DEFAULT true,
    alert_email VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_api_trader_configs_user ON api_trader_configs(user_id);

-- ============================================================================
-- RETAIL VIP TIERS (Binance-style VIP system for retail users)
-- ============================================================================
-- VIP tier definitions with requirements and benefits
CREATE TABLE IF NOT EXISTS retail_vip_tiers (
    tier_level INTEGER PRIMARY KEY CHECK (tier_level >= 0 AND tier_level <= 9),
    tier_name VARCHAR(50) NOT NULL,
    
    -- Requirements (30-day rolling)
    min_30d_volume_usd DECIMAL(20,2) NOT NULL DEFAULT 0,
    min_token_holding DECIMAL(20,8) DEFAULT 0, -- DMX token holdings for tier boost
    
    -- Fee discounts (in percentage points reduction)
    maker_fee_discount DECIMAL(5,4) NOT NULL DEFAULT 0, -- e.g., 0.0200 = 2% discount
    taker_fee_discount DECIMAL(5,4) NOT NULL DEFAULT 0,
    
    -- Withdrawal benefits
    daily_withdrawal_limit_usd DECIMAL(20,2) NOT NULL,
    withdrawal_fee_discount DECIMAL(5,4) DEFAULT 0,
    
    -- Trading benefits
    max_leverage INTEGER DEFAULT 20,
    priority_customer_support BOOLEAN DEFAULT false,
    dedicated_account_manager BOOLEAN DEFAULT false,
    
    -- API benefits
    api_rate_limit_multiplier DECIMAL(5,2) DEFAULT 1.0, -- 1.5 = 50% more API calls
    
    -- Loyalty benefits
    loyalty_points_multiplier DECIMAL(5,2) DEFAULT 1.0,
    
    -- Exclusive features
    otc_trading_access BOOLEAN DEFAULT false,
    exclusive_events_access BOOLEAN DEFAULT false,
    early_feature_access BOOLEAN DEFAULT false,
    
    -- Display
    badge_color VARCHAR(20),
    badge_icon VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pre-populate VIP tiers (Binance-inspired structure)
INSERT INTO retail_vip_tiers (tier_level, tier_name, min_30d_volume_usd, min_token_holding, 
                              maker_fee_discount, taker_fee_discount, 
                              daily_withdrawal_limit_usd, withdrawal_fee_discount,
                              max_leverage, priority_customer_support, dedicated_account_manager,
                              api_rate_limit_multiplier, loyalty_points_multiplier,
                              otc_trading_access, exclusive_events_access, early_feature_access,
                              badge_color, badge_icon)
VALUES 
    -- VIP 0 (Default)
    (0, 'Regular', 0, 0, 
     0.0000, 0.0000, 
     10000, 0.0000,
     20, false, false,
     1.0, 1.0,
     false, false, false,
     'gray', 'user'),
     
    -- VIP 1
    (1, 'Bronze', 50000, 0, 
     0.0005, 0.0005, 
     50000, 0.05,
     25, false, false,
     1.2, 1.1,
     false, false, false,
     'bronze', 'shield'),
     
    -- VIP 2
    (2, 'Silver', 250000, 1000, 
     0.0010, 0.0010, 
     100000, 0.10,
     30, true, false,
     1.5, 1.2,
     false, false, false,
     'silver', 'shield'),
     
    -- VIP 3
    (3, 'Gold', 1000000, 5000, 
     0.0015, 0.0015, 
     500000, 0.15,
     50, true, false,
     2.0, 1.3,
     false, true, false,
     'gold', 'crown'),
     
    -- VIP 4
    (4, 'Platinum', 5000000, 10000, 
     0.0020, 0.0020, 
     1000000, 0.20,
     75, true, false,
     2.5, 1.5,
     true, true, false,
     'platinum', 'crown'),
     
    -- VIP 5
    (5, 'Diamond', 25000000, 50000, 
     0.0025, 0.0025, 
     5000000, 0.25,
     100, true, true,
     3.0, 1.75,
     true, true, true,
     'diamond', 'gem'),
     
    -- VIP 6
    (6, 'Master', 100000000, 100000, 
     0.0030, 0.0030, 
     10000000, 0.30,
     125, true, true,
     4.0, 2.0,
     true, true, true,
     'blue', 'star'),
     
    -- VIP 7
    (7, 'Grandmaster', 250000000, 250000, 
     0.0035, 0.0035, 
     25000000, 0.35,
     150, true, true,
     5.0, 2.5,
     true, true, true,
     'purple', 'star'),
     
    -- VIP 8
    (8, 'Elite', 500000000, 500000, 
     0.0040, 0.0040, 
     50000000, 0.40,
     200, true, true,
     7.5, 3.0,
     true, true, true,
     'red', 'flame'),
     
    -- VIP 9
    (9, 'Legendary', 1000000000, 1000000, 
     0.0050, 0.0050, 
     100000000, 0.50,
     250, true, true,
     10.0, 4.0,
     true, true, true,
     'rainbow', 'trophy');

CREATE INDEX IF NOT EXISTS idx_retail_vip_tiers_volume ON retail_vip_tiers(min_30d_volume_usd);

-- ============================================================================
-- USER VIP STATUS (Track current VIP tier for each retail user)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_vip_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Current tier
    current_tier INTEGER NOT NULL DEFAULT 0 REFERENCES retail_vip_tiers(tier_level),
    previous_tier INTEGER DEFAULT 0,
    
    -- Volume tracking (30-day rolling)
    volume_30d_usd DECIMAL(20,2) DEFAULT 0,
    volume_30d_btc DECIMAL(20,8) DEFAULT 0,
    
    -- Token holdings
    current_token_holding DECIMAL(20,8) DEFAULT 0,
    
    -- Tier progression
    next_tier_volume_needed DECIMAL(20,2),
    next_tier_tokens_needed DECIMAL(20,8),
    tier_upgrade_eligible BOOLEAN DEFAULT false,
    
    -- Benefits applied
    effective_maker_fee DECIMAL(5,4), -- Final fee after discount
    effective_taker_fee DECIMAL(5,4),
    
    -- Tier history
    total_tier_upgrades INTEGER DEFAULT 0,
    highest_tier_achieved INTEGER DEFAULT 0,
    tier_upgraded_at TIMESTAMP WITH TIME ZONE,
    tier_downgraded_at TIMESTAMP WITH TIME ZONE,
    
    -- Last calculations
    last_volume_calculation_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_tier_check_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Lock period (prevent tier manipulation)
    tier_lock_until TIMESTAMP WITH TIME ZONE, -- Tier changes locked for N days after upgrade
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_vip_status_user_id ON user_vip_status(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vip_status_tier ON user_vip_status(current_tier);
CREATE INDEX IF NOT EXISTS idx_user_vip_status_volume ON user_vip_status(volume_30d_usd);
CREATE INDEX IF NOT EXISTS idx_user_vip_status_last_check ON user_vip_status(last_tier_check_at);

-- ============================================================================
-- VIP VOLUME SNAPSHOTS (Daily volume tracking for 30-day rolling calculation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vip_volume_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    snapshot_date DATE NOT NULL,
    daily_volume_usd DECIMAL(20,2) NOT NULL DEFAULT 0,
    daily_trades INTEGER DEFAULT 0,
    
    -- Market breakdown
    spot_volume_usd DECIMAL(20,2) DEFAULT 0,
    futures_volume_usd DECIMAL(20,2) DEFAULT 0,
    options_volume_usd DECIMAL(20,2) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_vip_volume_snapshots_user ON vip_volume_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_vip_volume_snapshots_date ON vip_volume_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_vip_volume_snapshots_user_date ON vip_volume_snapshots(user_id, snapshot_date);

-- ============================================================================
-- VIP TIER HISTORY (Audit trail of tier changes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vip_tier_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    from_tier INTEGER NOT NULL,
    to_tier INTEGER NOT NULL,
    change_type VARCHAR(20) CHECK (change_type IN ('upgrade', 'downgrade', 'manual')),
    
    -- Reason for change
    trigger_reason VARCHAR(100), -- 'volume_threshold', 'token_holding', 'admin_override', 'monthly_review'
    volume_at_change DECIMAL(20,2),
    token_holding_at_change DECIMAL(20,8),
    
    -- Admin override
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_notes TEXT,
    
    -- Metadata
    effective_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vip_tier_history_user ON vip_tier_history(user_id);
CREATE INDEX IF NOT EXISTS idx_vip_tier_history_date ON vip_tier_history(effective_date);
CREATE INDEX IF NOT EXISTS idx_vip_tier_history_change_type ON vip_tier_history(change_type);

-- ============================================================================
-- ACCOUNT SECURITY - TWO-FACTOR AUTHENTICATION (2FA)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_2fa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- 2FA Method
    method VARCHAR(20) NOT NULL CHECK (method IN ('totp', 'sms', 'email', 'authenticator')),
    enabled BOOLEAN DEFAULT false,
    
    -- TOTP (Time-based One-Time Password) - Google Authenticator, Authy
    totp_secret TEXT, -- Encrypted secret key
    totp_backup_codes TEXT[], -- Array of backup codes (hashed)
    totp_backup_codes_used INTEGER DEFAULT 0,
    
    -- SMS 2FA
    phone_number VARCHAR(20),
    phone_verified BOOLEAN DEFAULT false,
    
    -- Configuration
    is_mandatory BOOLEAN DEFAULT false, -- Force 2FA for this account
    grace_period_until TIMESTAMP WITH TIME ZONE, -- Allow login without 2FA until this date
    
    -- Usage tracking
    last_used_at TIMESTAMP WITH TIME ZONE,
    total_uses INTEGER DEFAULT 0,
    failed_attempts INTEGER DEFAULT 0,
    last_failed_at TIMESTAMP WITH TIME ZONE,
    
    -- Setup
    setup_completed_at TIMESTAMP WITH TIME ZONE,
    setup_by_ip VARCHAR(45),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_2fa_user_id ON user_2fa(user_id);
CREATE INDEX IF NOT EXISTS idx_user_2fa_enabled ON user_2fa(enabled);

-- ============================================================================
-- LOGIN ATTEMPTS TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Attempt details
    email VARCHAR(255),
    username VARCHAR(50),
    attempt_type VARCHAR(20) CHECK (attempt_type IN ('password', 'wallet', '2fa', 'api_key')),
    
    -- Result
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100), -- 'invalid_credentials', 'account_locked', '2fa_failed', 'ip_blocked'
    
    -- Location & Device
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    country_code VARCHAR(2),
    city VARCHAR(100),
    
    -- Security context
    is_suspicious BOOLEAN DEFAULT false,
    risk_score INTEGER DEFAULT 0, -- 0-100
    blocked_by_rule VARCHAR(50), -- 'rate_limit', 'ip_blacklist', 'geo_block'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success ON login_attempts(success);
CREATE INDEX IF NOT EXISTS idx_login_attempts_suspicious ON login_attempts(is_suspicious);

-- ============================================================================
-- TRUSTED DEVICES
-- ============================================================================
CREATE TABLE IF NOT EXISTS trusted_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Device identification
    device_fingerprint VARCHAR(255) NOT NULL,
    device_name VARCHAR(100), -- User-friendly name
    device_type VARCHAR(20) CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
    
    -- Device details
    browser VARCHAR(50),
    os VARCHAR(50),
    user_agent TEXT,
    
    -- Trust status
    trusted BOOLEAN DEFAULT false,
    trust_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Location
    first_ip VARCHAR(45),
    last_ip VARCHAR(45),
    country_code VARCHAR(2),
    city VARCHAR(100),
    
    -- Activity
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    login_count INTEGER DEFAULT 1,
    
    -- Revocation
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason VARCHAR(100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_trusted ON trusted_devices(trusted);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_last_seen ON trusted_devices(last_seen_at);

-- ============================================================================
-- IP WHITELIST & BLACKLIST
-- ============================================================================
CREATE TABLE IF NOT EXISTS ip_access_control (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for global rules
    
    -- IP or CIDR range
    ip_address VARCHAR(45) NOT NULL,
    ip_range_cidr VARCHAR(50), -- e.g., "192.168.1.0/24"
    
    -- Access control
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('whitelist', 'blacklist')),
    scope VARCHAR(20) DEFAULT 'user' CHECK (scope IN ('user', 'global')), -- User-specific or platform-wide
    
    -- Details
    reason VARCHAR(255),
    added_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Effectiveness
    enabled BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Statistics
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_access_control_user_id ON ip_access_control(user_id);
CREATE INDEX IF NOT EXISTS idx_ip_access_control_ip ON ip_access_control(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_access_control_type ON ip_access_control(access_type);
CREATE INDEX IF NOT EXISTS idx_ip_access_control_enabled ON ip_access_control(enabled);

-- ============================================================================
-- ACCOUNT LOCKOUT SETTINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS account_lockout (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Lockout status
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_until TIMESTAMP WITH TIME ZONE,
    lock_reason VARCHAR(100), -- 'too_many_attempts', 'suspicious_activity', 'admin_action', 'security_breach'
    
    -- Failed attempts tracking
    failed_login_attempts INTEGER DEFAULT 0,
    failed_2fa_attempts INTEGER DEFAULT 0,
    last_failed_attempt_at TIMESTAMP WITH TIME ZONE,
    
    -- Auto-unlock
    auto_unlock_enabled BOOLEAN DEFAULT true,
    unlock_after_minutes INTEGER DEFAULT 30,
    
    -- Manual unlock
    unlocked_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    unlock_reason TEXT,
    
    -- Lockout history count
    total_lockouts INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_lockout_user_id ON account_lockout(user_id);
CREATE INDEX IF NOT EXISTS idx_account_lockout_locked ON account_lockout(is_locked);
CREATE INDEX IF NOT EXISTS idx_account_lockout_locked_until ON account_lockout(locked_until);

-- ============================================================================
-- SECURITY ACTIVITY LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS security_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Activity type
    activity_type VARCHAR(50) NOT NULL, -- 'login', 'logout', 'password_change', '2fa_enabled', '2fa_disabled', 'email_change', 'withdrawal', 'api_key_created', 'device_trusted'
    activity_category VARCHAR(20) CHECK (activity_category IN ('authentication', 'account_change', 'security_setting', 'financial', 'access_control')),
    
    -- Activity details
    description TEXT,
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    
    -- Context
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    country_code VARCHAR(2),
    city VARCHAR(100),
    
    -- Changes (for audit)
    old_value TEXT,
    new_value TEXT,
    
    -- Risk assessment
    risk_score INTEGER DEFAULT 0, -- 0-100
    is_anomaly BOOLEAN DEFAULT false, -- Flagged as unusual activity
    
    -- Notification
    user_notified BOOLEAN DEFAULT false,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional data
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_activity_logs_user_id ON security_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_activity_logs_type ON security_activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_security_activity_logs_category ON security_activity_logs(activity_category);
CREATE INDEX IF NOT EXISTS idx_security_activity_logs_created_at ON security_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_activity_logs_severity ON security_activity_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_activity_logs_anomaly ON security_activity_logs(is_anomaly);

-- ============================================================================
-- PASSWORD SECURITY & HISTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    password_hash TEXT NOT NULL,
    
    -- Context
    changed_from_ip VARCHAR(45),
    changed_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL, -- If admin forced password change
    change_reason VARCHAR(50), -- 'user_requested', 'expired', 'compromised', 'admin_forced'
    
    -- Password strength at time of change
    strength_score INTEGER, -- 0-100
    had_uppercase BOOLEAN,
    had_lowercase BOOLEAN,
    had_numbers BOOLEAN,
    had_special_chars BOOLEAN,
    length INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at);

-- NOTE: password_reset_tokens table is defined earlier in this file

-- ============================================================================
-- SECURITY SETTINGS (Per-user preferences)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_security_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- 2FA Settings
    require_2fa_for_login BOOLEAN DEFAULT false,
    require_2fa_for_withdrawal BOOLEAN DEFAULT true,
    require_2fa_for_api_key BOOLEAN DEFAULT true,
    require_2fa_for_settings_change BOOLEAN DEFAULT false,
    
    -- Session Settings
    session_timeout_minutes INTEGER DEFAULT 60,
    remember_device_days INTEGER DEFAULT 30,
    max_concurrent_sessions INTEGER DEFAULT 5,
    
    -- Login Security
    allow_password_login BOOLEAN DEFAULT true,
    allow_wallet_login BOOLEAN DEFAULT true,
    restrict_to_whitelisted_ips BOOLEAN DEFAULT false,
    
    -- Notification Preferences
    notify_on_login BOOLEAN DEFAULT true,
    notify_on_new_device BOOLEAN DEFAULT true,
    notify_on_withdrawal BOOLEAN DEFAULT true,
    notify_on_api_key_usage BOOLEAN DEFAULT false,
    notify_on_password_change BOOLEAN DEFAULT true,
    notify_on_suspicious_activity BOOLEAN DEFAULT true,
    
    -- Email notifications
    notification_email VARCHAR(255),
    
    -- Advanced Security
    require_device_confirmation BOOLEAN DEFAULT false,
    auto_logout_on_ip_change BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_security_settings_user_id ON user_security_settings(user_id);

-- ============================================================================
-- ACTIVE SESSIONS (Enhanced with security tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS active_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session identification
    session_token TEXT NOT NULL UNIQUE,
    refresh_token TEXT UNIQUE,
    device_fingerprint VARCHAR(255),
    
    -- Device details
    device_type VARCHAR(20),
    browser VARCHAR(50),
    os VARCHAR(50),
    user_agent TEXT,
    
    -- Location
    ip_address VARCHAR(45) NOT NULL,
    country_code VARCHAR(2),
    city VARCHAR(100),
    
    -- Session state
    is_active BOOLEAN DEFAULT true,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Security
    is_trusted_device BOOLEAN DEFAULT false,
    risk_score INTEGER DEFAULT 0,
    
    -- Expiry
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Termination
    terminated_at TIMESTAMP WITH TIME ZONE,
    termination_reason VARCHAR(50), -- 'logout', 'timeout', 'admin_forced', 'security_breach', 'ip_change'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_active_sessions_active ON active_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires_at ON active_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_active_sessions_last_activity ON active_sessions(last_activity_at);

-- ============================================================================
-- SECURITY ALERTS & NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Alert details
    alert_type VARCHAR(50) NOT NULL, -- 'new_device', 'unusual_location', 'failed_login_attempts', 'withdrawal_attempt', 'api_key_usage', 'password_change'
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Context
    trigger_event_id UUID, -- Reference to related log entry
    ip_address VARCHAR(45),
    device_fingerprint VARCHAR(255),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved', 'dismissed')),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Action required
    requires_action BOOLEAN DEFAULT false,
    action_type VARCHAR(50), -- 'confirm_device', 'reset_password', 'contact_support'
    action_url TEXT,
    action_taken BOOLEAN DEFAULT false,
    action_taken_at TIMESTAMP WITH TIME ZONE,
    
    -- Notification
    notification_sent BOOLEAN DEFAULT false,
    notification_channels TEXT[], -- ['email', 'sms', 'push']
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON security_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_security_alerts_requires_action ON security_alerts(requires_action);

-- ============================================================================
-- WITHDRAWAL WHITELIST
-- ============================================================================
CREATE TABLE IF NOT EXISTS withdrawal_whitelist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Address details
    label VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    chain VARCHAR(20) NOT NULL, -- 'ETH', 'BTC', 'SOL', 'MATIC', 'ARB', 'OP', 'BASE'
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Verification (optional for added security)
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_method VARCHAR(50), -- '2fa', 'email', 'sms'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, address, chain)
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_whitelist_user_id ON withdrawal_whitelist(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_whitelist_chain ON withdrawal_whitelist(chain);
CREATE INDEX IF NOT EXISTS idx_withdrawal_whitelist_active ON withdrawal_whitelist(is_active);
