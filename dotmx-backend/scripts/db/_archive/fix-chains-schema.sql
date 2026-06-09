-- Fix chains, tokens, and token_chains tables schema
-- Ensures all required columns exist for HD Wallet deposit address generation

BEGIN;

-- ==================================================
-- FIX CHAINS TABLE
-- ==================================================
ALTER TABLE chains ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE chains ADD COLUMN IF NOT EXISTS deposit_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE chains ADD COLUMN IF NOT EXISTS withdrawal_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE chains ADD COLUMN IF NOT EXISTS min_confirmations INTEGER DEFAULT 12;
ALTER TABLE chains ADD COLUMN IF NOT EXISTS avg_block_time_seconds INTEGER DEFAULT 12;
ALTER TABLE chains ADD COLUMN IF NOT EXISTS icon_url VARCHAR(500);
ALTER TABLE chains ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE chains ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Update existing chains to have default values
UPDATE chains SET is_active = TRUE WHERE is_active IS NULL;
UPDATE chains SET deposit_enabled = TRUE WHERE deposit_enabled IS NULL;
UPDATE chains SET withdrawal_enabled = TRUE WHERE withdrawal_enabled IS NULL;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_chains_active ON chains(is_active);

-- ==================================================
-- FIX TOKENS TABLE  
-- ==================================================
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
UPDATE tokens SET is_active = TRUE WHERE is_active IS NULL;

CREATE INDEX IF NOT EXISTS idx_tokens_active ON tokens(is_active);

-- ==================================================
-- VERIFY SCHEMA (will show after running)
-- ==================================================
\echo '========================================='
\echo 'CHAINS TABLE COLUMNS:'
\echo '========================================='
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'chains' 
ORDER BY ordinal_position;

\echo ''
\echo '========================================='
\echo 'TOKENS TABLE COLUMNS:'
\echo '========================================='
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'tokens' 
ORDER BY ordinal_position;

COMMIT;

\echo ''
\echo '✅ Schema fix completed successfully!'
