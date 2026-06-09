-- =============================================================================
-- Migration 005: Withdrawal Limits & Webhook Notifications
-- =============================================================================
-- Adds:
--   - Withdrawal limits (per-user, per-tier, daily/monthly caps)
--   - Webhook subscriptions (outbound event notifications)
--   - Webhook delivery log (delivery tracking with retry)
--   - Alert configuration (admin alerting rules)
-- =============================================================================

-- ─── Withdrawal Limits ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS withdrawal_limits (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    -- NULL user_id = default limit for tier, non-NULL = user-specific override
    user_id VARCHAR(64),
    tier VARCHAR(32) NOT NULL DEFAULT 'default',
    -- Tiers: 'default', 'verified', 'premium', 'institutional', 'custom'
    
    -- Daily limits (24h rolling window)
    daily_limit_usd DECIMAL(24, 8) NOT NULL DEFAULT 100000,
    daily_withdrawal_count INTEGER NOT NULL DEFAULT 50,
    
    -- Monthly limits (30-day rolling window)
    monthly_limit_usd DECIMAL(24, 8) NOT NULL DEFAULT 1000000,
    monthly_withdrawal_count INTEGER NOT NULL DEFAULT 500,
    
    -- Per-transaction limits
    min_withdrawal_usd DECIMAL(24, 8) NOT NULL DEFAULT 10,
    max_withdrawal_usd DECIMAL(24, 8) NOT NULL DEFAULT 50000,
    
    -- Large withdrawal handling
    large_withdrawal_threshold_usd DECIMAL(24, 8) NOT NULL DEFAULT 10000,
    large_withdrawal_delay_hours INTEGER NOT NULL DEFAULT 24,
    requires_manual_approval_above_usd DECIMAL(24, 8) DEFAULT 50000,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id),  -- only one override per user
    UNIQUE(tier) -- only one config per tier (when user_id IS NULL)
);

-- In case the unique constraint on tier fails when user_id is not null,
-- we use a partial unique index instead
DROP INDEX IF EXISTS idx_withdrawal_limits_tier_default;
CREATE UNIQUE INDEX idx_withdrawal_limits_tier_default 
    ON withdrawal_limits(tier) WHERE user_id IS NULL;

-- Insert default tier limits
INSERT INTO withdrawal_limits (tier, daily_limit_usd, monthly_limit_usd, daily_withdrawal_count, monthly_withdrawal_count, min_withdrawal_usd, max_withdrawal_usd)
VALUES 
    ('default', 10000, 100000, 10, 100, 10, 5000),
    ('verified', 100000, 1000000, 50, 500, 10, 50000),
    ('premium', 500000, 5000000, 100, 1000, 1, 100000),
    ('institutional', 5000000, 50000000, 500, 5000, 1, 1000000)
ON CONFLICT DO NOTHING;

-- Track daily/monthly withdrawal usage
CREATE TABLE IF NOT EXISTS withdrawal_usage (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(64) NOT NULL,
    withdrawal_id VARCHAR(64) NOT NULL,
    amount_usd DECIMAL(24, 8) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_usage_user ON withdrawal_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_usage_time ON withdrawal_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_withdrawal_usage_user_time ON withdrawal_usage(user_id, timestamp);

-- ─── Webhook Subscriptions ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(64) NOT NULL,
    url TEXT NOT NULL,
    -- Events to subscribe to (array or '*' for all)
    events TEXT[] NOT NULL DEFAULT '{}',
    -- Supported events:
    --   order.placed, order.filled, order.partially_filled, order.cancelled, order.rejected
    --   trade.executed
    --   deposit.confirmed, deposit.pending
    --   withdrawal.approved, withdrawal.completed, withdrawal.failed, withdrawal.cancelled
    --   position.opened, position.closed, position.liquidated
    --   funding.payment
    --   margin.call
    
    -- Authentication
    secret VARCHAR(255) NOT NULL,
    -- HMAC-SHA256 secret for signature verification
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    failures INTEGER DEFAULT 0,
    max_failures INTEGER DEFAULT 10,
    -- After max_failures consecutive, subscription is auto-disabled
    
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    last_failure_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_subs_user ON webhook_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subs_active ON webhook_subscriptions(is_active);

-- ─── Webhook Delivery Log ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    subscription_id VARCHAR(64) NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    
    -- Delivery status
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    -- pending, success, failed, retrying
    
    -- Response details
    response_status INTEGER,
    response_body TEXT,
    response_time_ms INTEGER,
    
    -- Retry tracking
    attempt INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 5,
    next_retry_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_sub ON webhook_deliveries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_retry ON webhook_deliveries(next_retry_at) WHERE status = 'retrying';

-- ─── Alert Configuration ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alert_configs (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    
    -- Alert type
    alert_type VARCHAR(64) NOT NULL,
    -- Types: price_deviation, volume_spike, liquidation_cascade, insurance_fund_low,
    --        system_health, withdrawal_surge, large_withdrawal, circuit_breaker_trigger
    
    -- Condition (JSON)
    condition JSONB NOT NULL,
    -- Example: {"symbol": "BTC-USDT", "threshold_pct": 5.0, "window_seconds": 60}
    
    -- Notification channels
    channels TEXT[] NOT NULL DEFAULT '{}',
    -- Channels: email, webhook, slack, telegram
    
    -- Channel config
    channel_config JSONB DEFAULT '{}',
    -- Example: {"email": "admin@dotmx.com", "webhook_url": "https://...", "slack_channel": "#alerts"}
    
    -- Status
    is_enabled BOOLEAN DEFAULT TRUE,
    severity VARCHAR(16) NOT NULL DEFAULT 'warning',
    -- critical, warning, info
    
    -- Cooldown (avoid alert storms)
    cooldown_seconds INTEGER DEFAULT 300,
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0,
    
    created_by VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_configs_type ON alert_configs(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_configs_enabled ON alert_configs(is_enabled);

-- ─── Alert History ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alert_history (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    alert_config_id VARCHAR(64) REFERENCES alert_configs(id) ON DELETE SET NULL,
    alert_type VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    title VARCHAR(256) NOT NULL,
    message TEXT,
    data JSONB,
    
    -- Resolution
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(64),
    acknowledged_at TIMESTAMPTZ,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_type ON alert_history(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_history_time ON alert_history(created_at);
CREATE INDEX IF NOT EXISTS idx_alert_history_unacked ON alert_history(acknowledged) WHERE acknowledged = FALSE;
