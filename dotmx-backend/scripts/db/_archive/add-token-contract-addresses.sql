-- Add token contract addresses for deployed tokens
-- Replace these with your actual deployed token addresses

BEGIN;

-- Update DUSD on Sepolia (replace with your actual contract address)
UPDATE token_chains tc
SET contract_address = '0xYourDUSDContractAddressHere',
    is_native = FALSE,
    updated_at = NOW()
FROM tokens t, chains c
WHERE tc.token_id = t.id
  AND tc.chain_id = c.id
  AND t.symbol = 'DUSD'
  AND c.code = 'SEP';

-- Show current token contracts
SELECT 
  t.symbol,
  c.code as chain,
  c.name as chain_name,
  tc.contract_address,
  tc.is_native,
  tc.is_active,
  tc.deposit_enabled
FROM token_chains tc
JOIN tokens t ON t.id = tc.token_id
JOIN chains c ON c.id = tc.chain_id
WHERE c.code = 'SEP'
ORDER BY t.symbol;

COMMIT;

\echo ''
\echo '✅ Token contract addresses updated'
\echo 'ℹ️  Make sure to replace placeholder addresses with actual deployed contract addresses'
