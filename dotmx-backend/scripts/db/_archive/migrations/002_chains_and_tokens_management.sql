-- Chains and Tokens Management Enhancement
-- Migration: Create chains table and improve token management for Alfred admin panel

BEGIN;

-- ============================================
-- Chains table (blockchain networks)
-- ============================================
CREATE TABLE IF NOT EXISTS chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    chain_id INTEGER,
    network_type VARCHAR(20) NOT NULL DEFAULT 'mainnet' CHECK (network_type IN ('mainnet', 'testnet')),
    rpc_url VARCHAR(500),
    explorer_url VARCHAR(500),
    native_currency_symbol VARCHAR(10) NOT NULL,
    native_currency_decimals INTEGER NOT NULL DEFAULT 18,
    is_active BOOLEAN DEFAULT TRUE,
    deposit_enabled BOOLEAN DEFAULT TRUE,
    withdrawal_enabled BOOLEAN DEFAULT TRUE,
    min_confirmations INTEGER DEFAULT 12,
    avg_block_time_seconds INTEGER DEFAULT 12,
    icon_url VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chains_code ON chains(code);
CREATE INDEX IF NOT EXISTS idx_chains_active ON chains(is_active);

-- Insert default chains
INSERT INTO chains (code, name, chain_id, network_type, rpc_url, explorer_url, native_currency_symbol, native_currency_decimals, is_active, min_confirmations, avg_block_time_seconds, sort_order) VALUES
    ('ETH', 'Ethereum', 1, 'mainnet', 'https://eth.llamarpc.com', 'https://etherscan.io', 'ETH', 18, TRUE, 12, 12, 1),
    ('BSC', 'BNB Chain', 56, 'mainnet', 'https://bsc-dataseed.binance.org', 'https://bscscan.com', 'BNB', 18, TRUE, 15, 3, 2),
    ('SOL', 'Solana', NULL, 'mainnet', 'https://api.mainnet-beta.solana.com', 'https://solscan.io', 'SOL', 9, TRUE, 30, 400, 3),
    ('ARB', 'Arbitrum One', 42161, 'mainnet', 'https://arb1.arbitrum.io/rpc', 'https://arbiscan.io', 'ETH', 18, TRUE, 12, 1, 4),
    ('OP', 'Optimism', 10, 'mainnet', 'https://mainnet.optimism.io', 'https://optimistic.etherscan.io', 'ETH', 18, TRUE, 12, 2, 5),
    ('TRON', 'Tron', NULL, 'mainnet', 'https://api.trongrid.io', 'https://tronscan.org', 'TRX', 6, TRUE, 30, 3, 6),
    ('BASE', 'Base', 8453, 'mainnet', 'https://mainnet.base.org', 'https://basescan.org', 'ETH', 18, TRUE, 12, 2, 7),
    ('HYPE', 'Hyperliquid', NULL, 'mainnet', 'https://api.hyperliquid.xyz', 'https://app.hyperliquid.xyz', 'HYPE', 18, TRUE, 12, 1, 8)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    chain_id = EXCLUDED.chain_id,
    rpc_url = EXCLUDED.rpc_url,
    explorer_url = EXCLUDED.explorer_url,
    updated_at = NOW();

-- ============================================
-- Tokens table (improved token management)
-- ============================================
CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    logo_url VARCHAR(500),
    coingecko_id VARCHAR(100),
    is_stablecoin BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON tokens(symbol);

-- Insert common tokens
INSERT INTO tokens (symbol, name, coingecko_id, is_stablecoin, sort_order) VALUES
    ('ETH', 'Ethereum', 'ethereum', FALSE, 1),
    ('USDT', 'Tether USD', 'tether', TRUE, 2),
    ('USDC', 'USD Coin', 'usd-coin', TRUE, 3),
    ('BTC', 'Bitcoin', 'bitcoin', FALSE, 4),
    ('BNB', 'BNB', 'binancecoin', FALSE, 5),
    ('SOL', 'Solana', 'solana', FALSE, 6),
    ('DAI', 'Dai Stablecoin', 'dai', TRUE, 7),
    ('WBTC', 'Wrapped Bitcoin', 'wrapped-bitcoin', FALSE, 8),
    ('TRX', 'Tron', 'tron', FALSE, 9),
    ('HYPE', 'Hyperliquid', 'hyperliquid', FALSE, 10)
ON CONFLICT (symbol) DO UPDATE SET
    name = EXCLUDED.name,
    coingecko_id = EXCLUDED.coingecko_id,
    updated_at = NOW();

-- ============================================
-- Token chains mapping (many-to-many relationship)
-- ============================================
CREATE TABLE IF NOT EXISTS token_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
    chain_id UUID NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
    contract_address VARCHAR(255),
    decimals INTEGER NOT NULL DEFAULT 18,
    is_native BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    deposit_enabled BOOLEAN DEFAULT TRUE,
    withdrawal_enabled BOOLEAN DEFAULT TRUE,
    min_deposit DECIMAL(36, 18) DEFAULT 0,
    max_deposit DECIMAL(36, 18),
    min_withdrawal DECIMAL(36, 18) DEFAULT 0,
    max_withdrawal DECIMAL(36, 18),
    withdrawal_fee DECIMAL(36, 18) DEFAULT 0,
    withdrawal_fee_type VARCHAR(20) DEFAULT 'fixed' CHECK (withdrawal_fee_type IN ('fixed', 'percentage')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(token_id, chain_id),
    UNIQUE(chain_id, contract_address)
);

CREATE INDEX IF NOT EXISTS idx_token_chains_token ON token_chains(token_id);
CREATE INDEX IF NOT EXISTS idx_token_chains_chain ON token_chains(chain_id);
CREATE INDEX IF NOT EXISTS idx_token_chains_active ON token_chains(is_active);

-- Insert default token-chain mappings
-- ETH on various chains (native)
INSERT INTO token_chains (token_id, chain_id, contract_address, decimals, is_native, min_deposit, min_withdrawal, withdrawal_fee)
SELECT t.id, c.id, NULL, 18, TRUE, 0.001, 0.001, 0.0001
FROM tokens t, chains c
WHERE t.symbol = 'ETH' AND c.code IN ('ETH', 'ARB', 'OP', 'BASE')
ON CONFLICT (token_id, chain_id) DO NOTHING;

-- USDT on multiple chains
INSERT INTO token_chains (token_id, chain_id, contract_address, decimals, is_native, min_deposit, min_withdrawal, withdrawal_fee)
SELECT t.id, c.id, 
    CASE c.code
        WHEN 'ETH' THEN '0xdAC17F958D2ee523a2206206994597C13D831ec7'
        WHEN 'BSC' THEN '0x55d398326f99059fF775485246999027B3197955'
        WHEN 'SOL' THEN 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenErt'
        WHEN 'ARB' THEN '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
        WHEN 'OP' THEN '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'
        WHEN 'TRON' THEN 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
        WHEN 'BASE' THEN '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'
    END,
    CASE c.code WHEN 'BSC' THEN 18 WHEN 'SOL' THEN 6 WHEN 'TRON' THEN 6 ELSE 6 END,
    FALSE, 10, 10, 1
FROM tokens t, chains c
WHERE t.symbol = 'USDT' AND c.code IN ('ETH', 'BSC', 'SOL', 'ARB', 'OP', 'TRON', 'BASE')
ON CONFLICT (token_id, chain_id) DO NOTHING;

-- USDC on multiple chains
INSERT INTO token_chains (token_id, chain_id, contract_address, decimals, is_native, min_deposit, min_withdrawal, withdrawal_fee)
SELECT t.id, c.id,
    CASE c.code
        WHEN 'ETH' THEN '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        WHEN 'BSC' THEN '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
        WHEN 'SOL' THEN 'EPjFWaJgt46qAY5gMXrZnK8U9xe2Cc1drv1KWfwXUmb'
        WHEN 'ARB' THEN '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'
        WHEN 'OP' THEN '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'
        WHEN 'BASE' THEN '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    END,
    6, FALSE, 10, 10, 1
FROM tokens t, chains c
WHERE t.symbol = 'USDC' AND c.code IN ('ETH', 'BSC', 'SOL', 'ARB', 'OP', 'BASE')
ON CONFLICT (token_id, chain_id) DO NOTHING;

-- DAI on multiple chains
INSERT INTO token_chains (token_id, chain_id, contract_address, decimals, is_native, min_deposit, min_withdrawal, withdrawal_fee)
SELECT t.id, c.id,
    CASE c.code
        WHEN 'ETH' THEN '0x6B175474E89094C44Da98b954EedeAC495271d0F'
        WHEN 'ARB' THEN '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'
        WHEN 'OP' THEN '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'
        WHEN 'BASE' THEN '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'
    END,
    18, FALSE, 10, 10, 1
FROM tokens t, chains c
WHERE t.symbol = 'DAI' AND c.code IN ('ETH', 'ARB', 'OP', 'BASE')
ON CONFLICT (token_id, chain_id) DO NOTHING;

-- Native tokens on their own chains
INSERT INTO token_chains (token_id, chain_id, contract_address, decimals, is_native, min_deposit, min_withdrawal, withdrawal_fee)
SELECT t.id, c.id, NULL, 18, TRUE, 0.01, 0.01, 0.001
FROM tokens t, chains c
WHERE t.symbol = 'BNB' AND c.code = 'BSC'
ON CONFLICT (token_id, chain_id) DO NOTHING;

INSERT INTO token_chains (token_id, chain_id, contract_address, decimals, is_native, min_deposit, min_withdrawal, withdrawal_fee)
SELECT t.id, c.id, NULL, 9, TRUE, 0.01, 0.01, 0.001
FROM tokens t, chains c
WHERE t.symbol = 'SOL' AND c.code = 'SOL'
ON CONFLICT (token_id, chain_id) DO NOTHING;

INSERT INTO token_chains (token_id, chain_id, contract_address, decimals, is_native, min_deposit, min_withdrawal, withdrawal_fee)
SELECT t.id, c.id, NULL, 6, TRUE, 1, 1, 0.1
FROM tokens t, chains c
WHERE t.symbol = 'TRX' AND c.code = 'TRON'
ON CONFLICT (token_id, chain_id) DO NOTHING;

-- ============================================
-- Update existing tables to reference chains
-- ============================================

-- Add foreign key to deposits (if table and column exist)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deposits') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deposits' AND column_name = 'chain_code') THEN
        ALTER TABLE deposits ADD CONSTRAINT fk_deposits_chain 
        FOREIGN KEY (chain_code) REFERENCES chains(code);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add foreign key to withdrawal_requests (if table and column exist)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'withdrawal_requests') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'withdrawal_requests' AND column_name = 'chain_code') THEN
        ALTER TABLE withdrawal_requests ADD CONSTRAINT fk_withdrawal_requests_chain 
        FOREIGN KEY (chain_code) REFERENCES chains(code);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add foreign key to deposit_addresses (if table and column exist)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deposit_addresses') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deposit_addresses' AND column_name = 'chain_code') THEN
        ALTER TABLE deposit_addresses ADD CONSTRAINT fk_deposit_addresses_chain 
        FOREIGN KEY (chain_code) REFERENCES chains(code);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
