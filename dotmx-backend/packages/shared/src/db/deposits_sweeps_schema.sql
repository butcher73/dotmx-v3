-- ============================================================================
-- DOTMX DEPOSITS & SWEEP OPERATIONS SCHEMA
-- Tables for tracking deposits and sweep operations
-- ============================================================================

-- ============================================================================
-- DEPOSITS TABLE
-- Track incoming deposits from user deposit addresses
-- ============================================================================
CREATE TYPE deposit_status AS ENUM (
    'pending',           -- Detected, waiting for confirmations
    'confirming',        -- Has some confirmations but not enough
    'confirmed',         -- Fully confirmed, credited to user
    'swept',             -- Funds swept to warm/hot wallet
    'failed'             -- Failed to process
);

CREATE TABLE IF NOT EXISTS deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES supported_assets(id),
    network_id UUID NOT NULL REFERENCES supported_networks(id),
    
    -- Transaction details
    tx_hash VARCHAR(255) NOT NULL,
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255) NOT NULL,          -- User's deposit address
    amount DECIMAL(24,8) NOT NULL CHECK (amount > 0),
    
    -- Confirmation tracking
    confirmations INTEGER DEFAULT 0,
    required_confirmations INTEGER NOT NULL DEFAULT 12,
    
    -- Status
    status deposit_status DEFAULT 'pending',
    
    -- Timestamps
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    credited_at TIMESTAMP WITH TIME ZONE,
    swept_at TIMESTAMP WITH TIME ZONE,
    
    -- Sweep operation reference
    sweep_operation_id UUID,
    
    -- Integration IDs
    verexbase_tx_id UUID,
    balance_transaction_id UUID,              -- Reference to balance_transactions entry
    
    -- Metadata
    block_number BIGINT,
    block_hash VARCHAR(255),
    gas_price DECIMAL(24,18),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate deposits
    UNIQUE(tx_hash, network_id)
);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_tx_hash ON deposits(tx_hash);
CREATE INDEX IF NOT EXISTS idx_deposits_to_address ON deposits(to_address);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON deposits(created_at);
CREATE INDEX IF NOT EXISTS idx_deposits_network_id ON deposits(network_id);
CREATE INDEX IF NOT EXISTS idx_deposits_asset_id ON deposits(asset_id);

-- ============================================================================
-- SWEEP OPERATIONS TABLE
-- Track sweeping of funds from user deposit addresses to warm/hot wallets
-- ============================================================================
CREATE TYPE sweep_status AS ENUM (
    'pending',           -- Waiting to be swept
    'gas_sent',          -- Gas sent to deposit address for sweep (EVM tokens)
    'broadcasting',      -- Sweep transaction being broadcast
    'confirming',        -- Waiting for confirmations
    'completed',         -- Successfully swept
    'failed'             -- Failed to sweep
);

CREATE TABLE IF NOT EXISTS sweep_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Source and destination
    from_address VARCHAR(255) NOT NULL,        -- User's deposit address
    to_address VARCHAR(255) NOT NULL,          -- Warm/hot wallet address
    
    -- Asset and network
    asset_id UUID NOT NULL REFERENCES supported_assets(id),
    network_id UUID NOT NULL REFERENCES supported_networks(id),
    
    -- Amount
    amount DECIMAL(24,8) NOT NULL CHECK (amount > 0),
    
    -- Transaction details
    tx_hash VARCHAR(255),
    gas_tx_hash VARCHAR(255),                  -- Gas funding transaction (for ERC20 sweeps)
    gas_used DECIMAL(24,18),
    gas_price DECIMAL(24,18),
    total_gas_cost DECIMAL(24,18),
    
    -- Status
    status sweep_status DEFAULT 'pending',
    
    -- Timestamps
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    gas_sent_at TIMESTAMP WITH TIME ZONE,
    broadcasted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    
    -- Error handling
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    
    -- Block info
    block_number BIGINT,
    block_hash VARCHAR(255),
    confirmations INTEGER DEFAULT 0,
    
    -- Integration
    verexbase_tx_id UUID,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sweep_ops_status ON sweep_operations(status);
CREATE INDEX IF NOT EXISTS idx_sweep_ops_from_address ON sweep_operations(from_address);
CREATE INDEX IF NOT EXISTS idx_sweep_ops_network_id ON sweep_operations(network_id);
CREATE INDEX IF NOT EXISTS idx_sweep_ops_created_at ON sweep_operations(created_at);
CREATE INDEX IF NOT EXISTS idx_sweep_ops_scheduled_at ON sweep_operations(scheduled_at);

-- ============================================================================
-- SWEEPER STATUS TABLE
-- Track the sweeper service status and metrics
-- ============================================================================
CREATE TABLE IF NOT EXISTS sweeper_status (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- Singleton row
    is_running BOOLEAN DEFAULT FALSE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    last_error_at TIMESTAMP WITH TIME ZONE,
    total_swept_24h DECIMAL(24,8) DEFAULT 0,
    operations_completed_24h INTEGER DEFAULT 0,
    operations_failed_24h INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial sweeper status
INSERT INTO sweeper_status (id, is_running) VALUES (1, false) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ADD FOREIGN KEY TO DEPOSITS TABLE
-- ============================================================================
ALTER TABLE deposits 
    ADD CONSTRAINT fk_deposits_sweep_operation 
    FOREIGN KEY (sweep_operation_id) 
    REFERENCES sweep_operations(id) 
    ON DELETE SET NULL;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for deposits with user and asset info
CREATE OR REPLACE VIEW deposits_view AS
SELECT 
    d.id,
    d.user_id,
    u.email as user_email,
    d.asset_id,
    sa.symbol as token_symbol,
    sa.name as token_name,
    d.network_id,
    sn.code as chain_code,
    sn.name as chain_name,
    d.tx_hash,
    d.from_address,
    d.to_address,
    d.amount,
    d.confirmations,
    d.required_confirmations,
    d.status,
    d.detected_at,
    d.confirmed_at,
    d.credited_at,
    d.swept_at,
    d.sweep_operation_id,
    d.block_number,
    d.created_at,
    d.updated_at
FROM deposits d
JOIN users u ON d.user_id = u.id
JOIN supported_assets sa ON d.asset_id = sa.id
JOIN supported_networks sn ON d.network_id = sn.id;

-- View for withdrawal requests with user and asset info
CREATE OR REPLACE VIEW withdrawals_view AS
SELECT 
    wr.id,
    wr.user_id,
    u.email as user_email,
    wr.asset_id,
    sa.symbol as token_symbol,
    sa.name as token_name,
    wr.network_id,
    sn.code as chain_code,
    sn.name as chain_name,
    wr.amount,
    wr.fee as fee_amount,
    wr.net_amount,
    wr.to_address as destination_address,
    wr.status,
    wr.tx_hash,
    wr.confirmations,
    wr.approved_at,
    wr.broadcasted_at,
    wr.completed_at,
    wr.failed_at,
    wr.failure_reason,
    wr.created_at,
    wr.updated_at
FROM withdrawal_requests wr
JOIN users u ON wr.user_id = u.id
JOIN supported_assets sa ON wr.asset_id = sa.id
JOIN supported_networks sn ON wr.network_id = sn.id;

-- View for sweep operations with asset info
CREATE OR REPLACE VIEW sweep_operations_view AS
SELECT 
    so.id,
    so.from_address,
    so.to_address,
    so.asset_id,
    sa.symbol as token_symbol,
    sa.name as token_name,
    so.network_id,
    sn.code as chain_code,
    sn.name as chain_name,
    so.amount,
    so.tx_hash,
    so.gas_tx_hash,
    so.gas_used,
    so.gas_price,
    so.total_gas_cost,
    so.status,
    so.scheduled_at,
    so.gas_sent_at,
    so.broadcasted_at,
    so.completed_at,
    so.failed_at,
    so.failure_reason,
    so.retry_count,
    so.block_number,
    so.confirmations,
    so.created_at,
    so.updated_at
FROM sweep_operations so
JOIN supported_assets sa ON so.asset_id = sa.id
JOIN supported_networks sn ON so.network_id = sn.id;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get deposit/withdrawal stats
CREATE OR REPLACE FUNCTION get_deposits_withdrawals_stats()
RETURNS TABLE (
    total_deposits_today BIGINT,
    total_deposits_value_today DECIMAL(24,8),
    total_withdrawals_today BIGINT,
    total_withdrawals_value_today DECIMAL(24,8),
    pending_deposits BIGINT,
    pending_approvals BIGINT,
    net_flow_today DECIMAL(24,8)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM deposits WHERE detected_at >= CURRENT_DATE)::BIGINT,
        COALESCE((SELECT SUM(amount) FROM deposits WHERE detected_at >= CURRENT_DATE), 0),
        (SELECT COUNT(*) FROM withdrawal_requests WHERE created_at >= CURRENT_DATE)::BIGINT,
        COALESCE((SELECT SUM(amount) FROM withdrawal_requests WHERE created_at >= CURRENT_DATE), 0),
        (SELECT COUNT(*) FROM deposits WHERE status IN ('pending', 'confirming'))::BIGINT,
        (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'pending_approval')::BIGINT,
        COALESCE((SELECT SUM(amount) FROM deposits WHERE detected_at >= CURRENT_DATE), 0) - 
            COALESCE((SELECT SUM(amount) FROM withdrawal_requests WHERE created_at >= CURRENT_DATE), 0);
END;
$$ LANGUAGE plpgsql;
