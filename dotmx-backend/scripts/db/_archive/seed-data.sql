-- Seed Data for DotMX
-- Run after migrations to populate initial data

BEGIN;

-- ============================================
-- Test Users (password: admin123 for all)
-- Hash generated with: Bun.password.hash('admin123', { algorithm: 'bcrypt', cost: 12 })
-- ============================================
INSERT INTO users (id, email, username, password_hash, role, status, kyc_status, email_verified) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'admin@dotmx.xyz', 'admin', '$2b$12$9cbLXMfZaDdKh9StAa4jp.T8pDdAEJMBjfOJ/yL9.eBeypGb4vDJW', 'superadmin', 'active', 'approved', TRUE),
    ('550e8400-e29b-41d4-a716-446655440002', 'test@dotmx.xyz', 'testuser', '$2b$12$9cbLXMfZaDdKh9StAa4jp.T8pDdAEJMBjfOJ/yL9.eBeypGb4vDJW', 'user', 'active', 'approved', TRUE),
    ('550e8400-e29b-41d4-a716-446655440003', 'demo@dotmx.xyz', 'demouser', '$2b$12$9cbLXMfZaDdKh9StAa4jp.T8pDdAEJMBjfOJ/yL9.eBeypGb4vDJW', 'user', 'active', 'pending', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Initialize derivation counters for each chain
-- ============================================
INSERT INTO derivation_counters (chain_id, current_index)
SELECT id, 0 FROM chains WHERE is_active = TRUE
ON CONFLICT (chain_id) DO NOTHING;

-- ============================================
-- Test Balances for demo user
-- ============================================
INSERT INTO user_balances (user_id, token_id, available_balance, locked_balance, total_deposited)
SELECT 
    '550e8400-e29b-41d4-a716-446655440002'::UUID,
    t.id,
    CASE t.symbol
        WHEN 'USDT' THEN 10000.00
        WHEN 'USDC' THEN 5000.00
        WHEN 'ETH' THEN 1.5
        WHEN 'BTC' THEN 0.1
        ELSE 0
    END,
    0,
    CASE t.symbol
        WHEN 'USDT' THEN 10000.00
        WHEN 'USDC' THEN 5000.00
        WHEN 'ETH' THEN 1.5
        WHEN 'BTC' THEN 0.1
        ELSE 0
    END
FROM tokens t
WHERE t.symbol IN ('USDT', 'USDC', 'ETH', 'BTC')
ON CONFLICT (user_id, token_id) DO NOTHING;

COMMIT;

-- ============================================
-- Summary
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ Seed data loaded successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Test Users:';
    RAISE NOTICE '  - admin@dotmx.xyz (password: admin123) - superadmin';
    RAISE NOTICE '  - test@dotmx.xyz (password: admin123) - user with balances';
    RAISE NOTICE '  - demo@dotmx.xyz (password: admin123) - user pending KYC';
END $$;
