-- Custodial Wallet System Database Schema
-- Migration: Create tables for deposit addresses, deposits, withdrawals, and balances
-- FIXED: Uses chains(id) UUID references, removed duplicate supported_tokens

BEGIN;

-- ============================================
-- User deposit addresses (one per user per chain)
-- Uses chains table from migration 002
-- ============================================
CREATE TABLE IF NOT EXISTS deposit_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chain_id UUID NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
    address VARCHAR(255) NOT NULL,
    derivation_index INTEGER NOT NULL,
    derivation_path VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, chain_id),
    UNIQUE(address, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_deposit_addresses_user ON deposit_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_address ON deposit_addresses(address);
CREATE INDEX IF NOT EXISTS idx_deposit_addresses_chain ON deposit_addresses(chain_id);

-- ============================================
-- Deposits tracking
-- ============================================
CREATE TABLE IF NOT EXISTS deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deposit_address_id UUID REFERENCES deposit_addresses(id),
    chain_id UUID NOT NULL REFERENCES chains(id),
    token_id UUID NOT NULL REFERENCES tokens(id),
    amount DECIMAL(36, 18) NOT NULL,
    tx_hash VARCHAR(255) NOT NULL,
    block_number BIGINT NOT NULL,
    confirmations INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirming', 'confirmed', 'swept', 'failed')),
    sweep_tx_hash VARCHAR(255),
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    swept_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tx_hash, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_tx_hash ON deposits(tx_hash);
CREATE INDEX IF NOT EXISTS idx_deposits_address ON deposits(deposit_address_id);
CREATE INDEX IF NOT EXISTS idx_deposits_chain ON deposits(chain_id);

-- ============================================
-- User balances (internal ledger)
-- ============================================
CREATE TABLE IF NOT EXISTS user_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id UUID NOT NULL REFERENCES tokens(id),
    available_balance DECIMAL(36, 18) DEFAULT 0 CHECK (available_balance >= 0),
    locked_balance DECIMAL(36, 18) DEFAULT 0 CHECK (locked_balance >= 0),
    total_deposited DECIMAL(36, 18) DEFAULT 0,
    total_withdrawn DECIMAL(36, 18) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token_id)
);

CREATE INDEX IF NOT EXISTS idx_user_balances_user ON user_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_balances_token ON user_balances(token_id);

-- ============================================
-- Withdrawal requests
-- ============================================
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chain_id UUID NOT NULL REFERENCES chains(id),
    token_id UUID NOT NULL REFERENCES tokens(id),
    amount DECIMAL(36, 18) NOT NULL CHECK (amount > 0),
    fee_amount DECIMAL(36, 18) DEFAULT 0,
    destination_address VARCHAR(255) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
        'pending',
        'pending_signature', 
        'signed', 
        'broadcasting', 
        'completed', 
        'failed', 
        'cancelled',
        'expired'
    )),
    unsigned_tx TEXT,
    signed_tx TEXT,
    tx_hash VARCHAR(255),
    batch_id UUID,
    error_message TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    signed_at TIMESTAMPTZ,
    broadcast_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_batch ON withdrawal_requests(batch_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_chain ON withdrawal_requests(chain_id);

-- ============================================
-- Sweep transactions
-- ============================================
CREATE TABLE IF NOT EXISTS sweep_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deposit_id UUID REFERENCES deposits(id),
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255) NOT NULL,
    chain_id UUID NOT NULL REFERENCES chains(id),
    token_id UUID NOT NULL REFERENCES tokens(id),
    amount DECIMAL(36, 18) NOT NULL,
    gas_used DECIMAL(36, 18),
    gas_price DECIMAL(36, 18),
    tx_hash VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed')),
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sweep_transactions_status ON sweep_transactions(status);
CREATE INDEX IF NOT EXISTS idx_sweep_transactions_deposit ON sweep_transactions(deposit_id);
CREATE INDEX IF NOT EXISTS idx_sweep_transactions_chain ON sweep_transactions(chain_id);

-- ============================================
-- Warm wallet configuration
-- ============================================
CREATE TABLE IF NOT EXISTS warm_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id UUID NOT NULL REFERENCES chains(id),
    address VARCHAR(255) NOT NULL,
    wallet_type VARCHAR(20) NOT NULL CHECK (wallet_type IN ('gnosis_safe', 'custom_multisig', 'eoa')),
    required_signatures INTEGER NOT NULL DEFAULT 1,
    total_signers INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chain_id)
);

-- ============================================
-- Balance audit log (for reconciliation)
-- ============================================
CREATE TABLE IF NOT EXISTS balance_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    token_id UUID NOT NULL REFERENCES tokens(id),
    operation VARCHAR(30) NOT NULL CHECK (operation IN (
        'deposit',
        'withdrawal',
        'withdrawal_lock',
        'withdrawal_unlock',
        'withdrawal_complete',
        'fee',
        'trade',
        'adjustment',
        'sweep'
    )),
    amount DECIMAL(36, 18) NOT NULL,
    balance_before DECIMAL(36, 18) NOT NULL,
    balance_after DECIMAL(36, 18) NOT NULL,
    reference_type VARCHAR(30),
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balance_audit_log_user ON balance_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_audit_log_operation ON balance_audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_balance_audit_log_reference ON balance_audit_log(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_balance_audit_log_created ON balance_audit_log(created_at);

-- ============================================
-- Encrypted master seed storage (for GCP KMS)
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_master_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name VARCHAR(100) NOT NULL UNIQUE,
    encrypted_dek BYTEA NOT NULL,
    encrypted_seed BYTEA NOT NULL,
    kms_key_resource_name VARCHAR(500) NOT NULL,
    algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    rotated_at TIMESTAMPTZ
);

-- ============================================
-- Derivation index counter (for HD wallet)
-- ============================================
CREATE TABLE IF NOT EXISTS derivation_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id UUID NOT NULL REFERENCES chains(id) UNIQUE,
    current_index INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Withdrawal batches (for efficient processing)
-- ============================================
CREATE TABLE IF NOT EXISTS withdrawal_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id UUID NOT NULL REFERENCES chains(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'exported', 'signed', 'broadcast', 'completed', 'failed')),
    total_amount DECIMAL(36, 18) NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    unsigned_tx_data JSONB,
    signed_tx_data JSONB,
    tx_hash VARCHAR(255),
    exported_at TIMESTAMPTZ,
    signed_at TIMESTAMPTZ,
    broadcast_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_batches_status ON withdrawal_batches(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_batches_chain ON withdrawal_batches(chain_id);

COMMIT;
