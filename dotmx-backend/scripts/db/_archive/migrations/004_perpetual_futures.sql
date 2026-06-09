-- =============================================================================
-- Migration 004: Perpetual Futures Tables
-- =============================================================================
-- Adds tables and columns needed for perpetual futures trading:
--   - Enhanced positions table with perpetual fields
--   - Position history (closed positions audit trail)
--   - Liquidation history (public liquidation feed)
--   - Insurance fund tracking
--   - Enhanced funding_rate_history with more columns
--   - Funding payments (per-user funding debits/credits)
-- =============================================================================

-- ─── Enhance positions table ─────────────────────────────────────────────────

ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS side VARCHAR(5) DEFAULT 'LONG',
  ADD COLUMN IF NOT EXISTS liquidation_price DECIMAL(24, 8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unrealized_pnl DECIMAL(24, 8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS realized_pnl DECIMAL(24, 8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS funding_accumulated DECIMAL(24, 8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_positions_user_status ON positions(user_id, status);

-- ─── Position history (closed positions) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS position_history (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(64) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    side VARCHAR(5) NOT NULL,
    size DECIMAL(24, 8) NOT NULL,
    entry_price DECIMAL(24, 8) NOT NULL,
    exit_price DECIMAL(24, 8) NOT NULL,
    leverage INTEGER DEFAULT 1,
    realized_pnl DECIMAL(24, 8) NOT NULL DEFAULT 0,
    funding_paid DECIMAL(24, 8) NOT NULL DEFAULT 0,
    fees_paid DECIMAL(24, 8) NOT NULL DEFAULT 0,
    close_reason VARCHAR(32) NOT NULL DEFAULT 'manual',
    -- close_reason: 'manual', 'liquidation', 'take_profit', 'stop_loss', 'adl'
    margin_used DECIMAL(24, 8) NOT NULL DEFAULT 0,
    duration_seconds INTEGER,
    opened_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_position_history_user ON position_history(user_id);
CREATE INDEX IF NOT EXISTS idx_position_history_symbol ON position_history(symbol);
CREATE INDEX IF NOT EXISTS idx_position_history_closed ON position_history(closed_at);

-- ─── Liquidation history ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS liquidation_history (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(64) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    side VARCHAR(5) NOT NULL,
    size DECIMAL(24, 8) NOT NULL,
    entry_price DECIMAL(24, 8) NOT NULL,
    liquidation_price DECIMAL(24, 8) NOT NULL,
    mark_price DECIMAL(24, 8) NOT NULL,
    margin_lost DECIMAL(24, 8) NOT NULL DEFAULT 0,
    insurance_fund_contribution DECIMAL(24, 8) NOT NULL DEFAULT 0,
    -- positive = fund gains, negative = fund pays (socialized loss)
    bankruptcy_price DECIMAL(24, 8),
    is_partial BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_liquidation_symbol ON liquidation_history(symbol);
CREATE INDEX IF NOT EXISTS idx_liquidation_time ON liquidation_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_liquidation_user ON liquidation_history(user_id);

-- ─── Insurance fund ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insurance_fund (
    id SERIAL PRIMARY KEY,
    asset VARCHAR(32) NOT NULL UNIQUE DEFAULT 'USDT',
    balance DECIMAL(24, 8) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insurance_fund_history (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    asset VARCHAR(32) NOT NULL DEFAULT 'USDT',
    amount DECIMAL(24, 8) NOT NULL,
    -- positive = contribution, negative = payout
    reason VARCHAR(64) NOT NULL,
    -- 'liquidation_surplus', 'liquidation_deficit', 'fee_contribution', 'manual_deposit'
    related_liquidation_id VARCHAR(64),
    balance_after DECIMAL(24, 8) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_history_time ON insurance_fund_history(timestamp);

-- Initialize insurance fund with zero balance
INSERT INTO insurance_fund (asset, balance)
VALUES ('USDT', 0)
ON CONFLICT (asset) DO NOTHING;

-- ─── Enhance funding_rate_history ────────────────────────────────────────────

-- Add columns if the table already exists (from init-db or earlier migration)
DO $$
BEGIN
    -- Check if funding_rate_history exists
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'funding_rate_history') THEN
        -- Add missing columns
        BEGIN ALTER TABLE funding_rate_history ADD COLUMN IF NOT EXISTS index_price DECIMAL(24, 8) DEFAULT 0; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER TABLE funding_rate_history ADD COLUMN IF NOT EXISTS open_interest DECIMAL(24, 8); EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER TABLE funding_rate_history ADD COLUMN IF NOT EXISTS next_funding_time TIMESTAMPTZ; EXCEPTION WHEN OTHERS THEN NULL; END;
    ELSE
        -- Create the table
        CREATE TABLE funding_rate_history (
            id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
            symbol VARCHAR(32) NOT NULL,
            funding_rate DECIMAL(24, 12) NOT NULL,
            mark_price DECIMAL(24, 8) NOT NULL,
            index_price DECIMAL(24, 8) DEFAULT 0,
            open_interest DECIMAL(24, 8),
            next_funding_time TIMESTAMPTZ,
            timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX idx_funding_symbol_time ON funding_rate_history(symbol, timestamp);
    END IF;
END
$$;

-- ─── Funding payments (per-user debits/credits) ─────────────────────────────

CREATE TABLE IF NOT EXISTS funding_payments (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(64) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    position_size DECIMAL(24, 8) NOT NULL,
    funding_rate DECIMAL(24, 12) NOT NULL,
    payment DECIMAL(24, 8) NOT NULL,
    -- positive = user received, negative = user paid
    mark_price DECIMAL(24, 8) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funding_payments_user ON funding_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_funding_payments_symbol ON funding_payments(symbol, timestamp);
CREATE INDEX IF NOT EXISTS idx_funding_payments_time ON funding_payments(timestamp);

-- ─── Orders table enhancements ───────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stop_price DECIMAL(24, 8),
  ADD COLUMN IF NOT EXISTS leverage INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reduce_only BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS post_only BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stp_mode VARCHAR(16);

-- ─── Trades table enhancements ───────────────────────────────────────────────

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS maker_user_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS taker_user_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS side VARCHAR(4),
  ADD COLUMN IF NOT EXISTS is_liquidation BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_trades_maker ON trades(maker_user_id);
CREATE INDEX IF NOT EXISTS idx_trades_taker ON trades(taker_user_id);

-- ─── Market Circuit Breaker Config ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS circuit_breaker_config (
    symbol VARCHAR(32) PRIMARY KEY,
    enabled BOOLEAN DEFAULT TRUE,
    price_threshold_pct DECIMAL(6, 4) DEFAULT 10.0,
    -- halt if price moves > threshold% in window
    window_seconds INTEGER DEFAULT 60,
    cooldown_seconds INTEGER DEFAULT 300,
    last_triggered_at TIMESTAMPTZ,
    is_halted BOOLEAN DEFAULT FALSE,
    halted_at TIMESTAMPTZ,
    halted_by VARCHAR(64),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default circuit breaker config for existing pairs
INSERT INTO circuit_breaker_config (symbol, price_threshold_pct, window_seconds, cooldown_seconds)
SELECT symbol, 10.0, 60, 300
FROM trading_pairs
ON CONFLICT (symbol) DO NOTHING;
