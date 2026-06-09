-- ============================================================================
-- DOTMX ASSETS & LEDGER DATABASE SCHEMA
-- Source of truth for user balances, deposit addresses, and transactions
-- ============================================================================

-- ============================================================================
-- SUPPORTED NETWORKS TABLE
-- Blockchain networks supported for deposits/withdrawals
-- ============================================================================
CREATE TABLE IF NOT EXISTS supported_networks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,          -- ETH, BSC, POLYGON, SOL, BASE
    name VARCHAR(100) NOT NULL,                -- Ethereum, BNB Smart Chain, etc.
    chain_type VARCHAR(20) NOT NULL,           -- EVM, SOL, BTC
    chain_id INTEGER,                          -- EVM chain ID (1 for ETH, 137 for Polygon)
    verexbase_chain_id UUID,                   -- VerexBase chain UUID
    is_testnet BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT TRUE,
    explorer_url TEXT,                         -- Block explorer URL
    rpc_url TEXT,                              -- RPC endpoint (for validation)
    native_symbol VARCHAR(10),                 -- ETH, BNB, MATIC, SOL
    native_decimals INTEGER DEFAULT 18,
    avg_block_time_seconds INTEGER DEFAULT 12,
    confirmations_required INTEGER DEFAULT 12, -- Blocks to wait before confirming
    min_deposit DECIMAL(24,8) DEFAULT 0,
    min_withdrawal DECIMAL(24,8) DEFAULT 0,
    withdrawal_fee DECIMAL(24,8) DEFAULT 0,
    icon_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default networks
INSERT INTO supported_networks (code, name, chain_type, chain_id, explorer_url, native_symbol, confirmations_required) VALUES
    ('ETH', 'Ethereum', 'EVM', 1, 'https://etherscan.io', 'ETH', 12),
    ('BASE', 'Base', 'EVM', 8453, 'https://basescan.org', 'ETH', 12),
    ('POLYGON', 'Polygon', 'EVM', 137, 'https://polygonscan.com', 'MATIC', 128),
    ('BSC', 'BNB Smart Chain', 'EVM', 56, 'https://bscscan.com', 'BNB', 15),
    ('ARBITRUM', 'Arbitrum One', 'EVM', 42161, 'https://arbiscan.io', 'ETH', 12),
    ('SOL', 'Solana', 'SOL', NULL, 'https://solscan.io', 'SOL', 32)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SUPPORTED ASSETS TABLE
-- Tokens/coins supported on the platform
-- ============================================================================
CREATE TABLE IF NOT EXISTS supported_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,               -- USDC, USDT, ETH, BTC, SOL
    name VARCHAR(100) NOT NULL,                -- USD Coin, Tether, etc.
    asset_type VARCHAR(20) NOT NULL,           -- native, erc20, spl
    decimals INTEGER NOT NULL DEFAULT 18,
    is_stablecoin BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT TRUE,
    min_deposit DECIMAL(24,8) DEFAULT 0,
    min_withdrawal DECIMAL(24,8) DEFAULT 0,
    icon_url TEXT,
    coingecko_id VARCHAR(100),                 -- For price feeds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(symbol)
);

-- ============================================================================
-- ASSET NETWORK MAPPINGS TABLE
-- Which assets are available on which networks (with contract addresses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS asset_networks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES supported_assets(id) ON DELETE CASCADE,
    network_id UUID NOT NULL REFERENCES supported_networks(id) ON DELETE CASCADE,
    contract_address VARCHAR(255),             -- NULL for native tokens
    is_enabled BOOLEAN DEFAULT TRUE,
    deposit_enabled BOOLEAN DEFAULT TRUE,
    withdrawal_enabled BOOLEAN DEFAULT TRUE,
    withdrawal_fee DECIMAL(24,8) DEFAULT 0,
    min_withdrawal DECIMAL(24,8) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(asset_id, network_id)
);

-- Insert default assets and mappings
INSERT INTO supported_assets (symbol, name, asset_type, decimals, is_stablecoin, coingecko_id) VALUES
    ('USDC', 'USD Coin', 'erc20', 6, TRUE, 'usd-coin'),
    ('USDT', 'Tether', 'erc20', 6, TRUE, 'tether'),
    ('ETH', 'Ethereum', 'native', 18, FALSE, 'ethereum'),
    ('BTC', 'Bitcoin', 'native', 8, FALSE, 'bitcoin'),
    ('SOL', 'Solana', 'native', 9, FALSE, 'solana')
ON CONFLICT (symbol) DO NOTHING;

-- ============================================================================
-- USER DEPOSIT ADDRESSES TABLE
-- Unique deposit addresses per user per network (generated via VerexBase HD wallet)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_deposit_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    network_id UUID NOT NULL REFERENCES supported_networks(id),
    address VARCHAR(255) NOT NULL,
    derivation_index INTEGER,                  -- HD wallet derivation index
    verexbase_vault_id UUID,                   -- VerexBase vault ID
    is_active BOOLEAN DEFAULT TRUE,
    total_deposits DECIMAL(24,8) DEFAULT 0,
    last_deposit_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, network_id),
    UNIQUE(address, network_id)
);

CREATE INDEX IF NOT EXISTS idx_deposit_addresses_user_id ON user_deposit_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_address ON user_deposit_addresses(address);
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_vault_id ON user_deposit_addresses(verexbase_vault_id);

-- ============================================================================
-- USER BALANCES TABLE
-- Current balance snapshot per user per asset (source of truth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES supported_assets(id),
    available DECIMAL(24,8) NOT NULL DEFAULT 0 CHECK (available >= 0),
    locked DECIMAL(24,8) NOT NULL DEFAULT 0 CHECK (locked >= 0),     -- In orders/margin
    pending DECIMAL(24,8) NOT NULL DEFAULT 0 CHECK (pending >= 0),   -- Pending deposits
    total_deposited DECIMAL(24,8) NOT NULL DEFAULT 0,
    total_withdrawn DECIMAL(24,8) NOT NULL DEFAULT 0,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_user_balances_user_id ON user_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_balances_asset_id ON user_balances(asset_id);

-- ============================================================================
-- BALANCE TRANSACTIONS TABLE (LEDGER)
-- Immutable ledger of all balance changes
-- ============================================================================
CREATE TYPE balance_tx_type AS ENUM (
    'deposit',           -- On-chain deposit confirmed
    'deposit_pending',   -- Deposit detected, awaiting confirmations
    'withdrawal',        -- Withdrawal completed
    'withdrawal_pending',-- Withdrawal initiated
    'withdrawal_failed', -- Withdrawal failed
    'trade_buy',         -- Balance change from buying
    'trade_sell',        -- Balance change from selling
    'fee',               -- Trading fee deducted
    'margin_lock',       -- Locked for margin position
    'margin_unlock',     -- Released from margin
    'pnl_realized',      -- Realized PnL
    'funding_fee',       -- Funding rate fee
    'referral_bonus',    -- Referral reward
    'bonus',             -- Promotional bonus
    'adjustment'         -- Admin adjustment
);

CREATE TABLE IF NOT EXISTS balance_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES supported_assets(id),
    tx_type balance_tx_type NOT NULL,
    amount DECIMAL(24,8) NOT NULL,             -- Positive for credit, negative for debit
    fee DECIMAL(24,8) DEFAULT 0,
    balance_before DECIMAL(24,8) NOT NULL,
    balance_after DECIMAL(24,8) NOT NULL,
    
    -- On-chain transaction details (for deposits/withdrawals)
    network_id UUID REFERENCES supported_networks(id),
    tx_hash VARCHAR(255),                      -- Blockchain transaction hash
    from_address VARCHAR(255),
    to_address VARCHAR(255),
    confirmations INTEGER DEFAULT 0,
    required_confirmations INTEGER,
    
    -- Internal references
    order_id UUID,                             -- Reference to trade order
    withdrawal_request_id UUID,                -- Reference to withdrawal request
    verexbase_tx_id UUID,                      -- VerexBase transaction ID
    
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'confirming', 'completed', 'failed', 'cancelled')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_balance_tx_user_id ON balance_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_tx_asset_id ON balance_transactions(asset_id);
CREATE INDEX IF NOT EXISTS idx_balance_tx_type ON balance_transactions(tx_type);
CREATE INDEX IF NOT EXISTS idx_balance_tx_status ON balance_transactions(status);
CREATE INDEX IF NOT EXISTS idx_balance_tx_tx_hash ON balance_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_balance_tx_created_at ON balance_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_balance_tx_verexbase_id ON balance_transactions(verexbase_tx_id);

-- ============================================================================
-- WITHDRAWAL REQUESTS TABLE
-- Track withdrawal requests through their lifecycle
-- ============================================================================
CREATE TYPE withdrawal_status AS ENUM (
    'pending_approval',  -- Awaiting approval (if 2FA/whitelist required)
    'approved',          -- Approved, ready to process
    'processing',        -- Being processed by VerexBase
    'broadcasted',       -- Transaction broadcasted to blockchain
    'confirming',        -- Awaiting confirmations
    'completed',         -- Successfully completed
    'failed',            -- Failed to process
    'cancelled',         -- Cancelled by user
    'rejected'           -- Rejected (security/compliance)
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES supported_assets(id),
    network_id UUID NOT NULL REFERENCES supported_networks(id),
    amount DECIMAL(24,8) NOT NULL CHECK (amount > 0),
    fee DECIMAL(24,8) NOT NULL DEFAULT 0,
    net_amount DECIMAL(24,8) GENERATED ALWAYS AS (amount - fee) STORED,
    to_address VARCHAR(255) NOT NULL,
    
    status withdrawal_status DEFAULT 'pending_approval',
    
    -- VerexBase integration
    verexbase_tx_id UUID,
    tx_hash VARCHAR(255),
    confirmations INTEGER DEFAULT 0,
    
    -- Security
    requires_2fa BOOLEAN DEFAULT FALSE,
    is_2fa_verified BOOLEAN DEFAULT FALSE,
    requires_whitelist BOOLEAN DEFAULT FALSE,
    is_whitelisted BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id),
    broadcasted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON withdrawal_requests(created_at);

-- ============================================================================
-- VEREXBASE WEBHOOK EVENTS TABLE
-- Log all incoming webhook events from VerexBase
-- ============================================================================
CREATE TABLE IF NOT EXISTS verexbase_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) NOT NULL UNIQUE,     -- VerexBase event ID (for deduplication)
    event_type VARCHAR(100) NOT NULL,          -- transaction.confirmed, etc.
    payload JSONB NOT NULL,
    signature VARCHAR(255),                    -- Webhook signature for verification
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON verexbase_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON verexbase_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON verexbase_webhook_events(created_at);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update user balance atomically
CREATE OR REPLACE FUNCTION update_user_balance(
    p_user_id UUID,
    p_asset_id UUID,
    p_amount DECIMAL(24,8),
    p_tx_type balance_tx_type,
    p_description TEXT DEFAULT NULL,
    p_tx_hash VARCHAR(255) DEFAULT NULL,
    p_network_id UUID DEFAULT NULL,
    p_from_address VARCHAR(255) DEFAULT NULL,
    p_to_address VARCHAR(255) DEFAULT NULL,
    p_verexbase_tx_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_balance_before DECIMAL(24,8);
    v_balance_after DECIMAL(24,8);
    v_tx_id UUID;
BEGIN
    -- Get or create user balance record
    INSERT INTO user_balances (user_id, asset_id)
    VALUES (p_user_id, p_asset_id)
    ON CONFLICT (user_id, asset_id) DO NOTHING;
    
    -- Get current balance
    SELECT available INTO v_balance_before
    FROM user_balances
    WHERE user_id = p_user_id AND asset_id = p_asset_id
    FOR UPDATE;
    
    v_balance_after := v_balance_before + p_amount;
    
    -- Validate balance doesn't go negative
    IF v_balance_after < 0 THEN
        RAISE EXCEPTION 'Insufficient balance: % + % = %', v_balance_before, p_amount, v_balance_after;
    END IF;
    
    -- Update balance
    UPDATE user_balances
    SET available = v_balance_after,
        last_updated_at = NOW(),
        total_deposited = CASE WHEN p_amount > 0 AND p_tx_type = 'deposit' THEN total_deposited + p_amount ELSE total_deposited END,
        total_withdrawn = CASE WHEN p_amount < 0 AND p_tx_type = 'withdrawal' THEN total_withdrawn + ABS(p_amount) ELSE total_withdrawn END
    WHERE user_id = p_user_id AND asset_id = p_asset_id;
    
    -- Create ledger entry
    INSERT INTO balance_transactions (
        user_id, asset_id, tx_type, amount, balance_before, balance_after,
        tx_hash, network_id, from_address, to_address, verexbase_tx_id,
        description, status, metadata
    ) VALUES (
        p_user_id, p_asset_id, p_tx_type, p_amount, v_balance_before, v_balance_after,
        p_tx_hash, p_network_id, p_from_address, p_to_address, p_verexbase_tx_id,
        p_description, 'completed', p_metadata
    )
    RETURNING id INTO v_tx_id;
    
    RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql;

-- Function to lock balance for orders/margin
CREATE OR REPLACE FUNCTION lock_user_balance(
    p_user_id UUID,
    p_asset_id UUID,
    p_amount DECIMAL(24,8)
) RETURNS BOOLEAN AS $$
DECLARE
    v_available DECIMAL(24,8);
BEGIN
    SELECT available INTO v_available
    FROM user_balances
    WHERE user_id = p_user_id AND asset_id = p_asset_id
    FOR UPDATE;
    
    IF v_available IS NULL OR v_available < p_amount THEN
        RETURN FALSE;
    END IF;
    
    UPDATE user_balances
    SET available = available - p_amount,
        locked = locked + p_amount,
        last_updated_at = NOW()
    WHERE user_id = p_user_id AND asset_id = p_asset_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to unlock balance
CREATE OR REPLACE FUNCTION unlock_user_balance(
    p_user_id UUID,
    p_asset_id UUID,
    p_amount DECIMAL(24,8)
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE user_balances
    SET available = available + p_amount,
        locked = locked - p_amount,
        last_updated_at = NOW()
    WHERE user_id = p_user_id AND asset_id = p_asset_id
      AND locked >= p_amount;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
