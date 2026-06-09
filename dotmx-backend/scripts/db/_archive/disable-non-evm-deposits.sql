-- Disable deposits for non-EVM chains until proper implementation
-- Current HD Wallet only supports EVM chains (ETH, BSC, ARB, OP, BASE, MATIC, SEP)

BEGIN;

-- Disable deposits for non-EVM chains (requires specific SDK for each)
UPDATE chains 
SET deposit_enabled = FALSE,
    updated_at = NOW()
WHERE code IN ('SOL', 'TRON', 'HYPE')
  AND is_active = TRUE;

-- Also disable deposits for token_chains on these networks
UPDATE token_chains tc
SET deposit_enabled = FALSE,
    updated_at = NOW()
FROM chains c
WHERE tc.chain_id = c.id
  AND c.code IN ('SOL', 'TRON', 'HYPE')
  AND tc.is_active = TRUE;

-- Show what was updated
SELECT 
  'Disabled deposits for non-EVM chains:' as message,
  code,
  name,
  deposit_enabled,
  withdrawal_enabled
FROM chains
WHERE code IN ('SOL', 'TRON', 'HYPE')
ORDER BY code;

COMMIT;

\echo ''
\echo '✅ Non-EVM chain deposits disabled'
\echo 'ℹ️  Only EVM chains (ETH, BSC, ARB, OP, BASE, MATIC, SEP) support deposits currently'
\echo 'ℹ️  To enable non-EVM chains, implement proper address derivation for each chain'
