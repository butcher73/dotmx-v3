-- ============================================================================
-- DotMX Exchange — Seed Data
-- ============================================================================
--
-- Contains:
--   1. Networks (blockchain networks)
--   2. Assets (tokens/coins)
--   3. Asset–Network mappings
--   4. Trading pairs
--   5. Spot fee tiers (10 levels, VIP 0–9)
--   6. Perpetual fee tiers (10 levels, VIP 0–9)
--   7. DMX fee discount configuration
--   8. Retail VIP tiers
--   9. Withdrawal limits (default tier)
--  10. Insurance fund initialization
--  11. Test users & balances (DEV ONLY)
--
-- ============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. NETWORKS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO networks (code, name, chain_type, chain_id, native_symbol, native_decimals, rpc_url, explorer_url, min_confirmations, avg_block_time_seconds, deposit_enabled, withdrawal_enabled, sort_order) VALUES
('ETH',   'Ethereum',      'EVM',  1,     'ETH',  18, 'https://eth-mainnet.g.alchemy.com/v2/', 'https://etherscan.io',         12, 12,  TRUE,  TRUE,  1),
('BSC',   'BNB Smart Chain','EVM', 56,     'BNB',  18, 'https://bsc-dataseed1.binance.org',     'https://bscscan.com',          15, 3,   TRUE,  TRUE,  2),
('ARB',   'Arbitrum One',   'EVM',  42161, 'ETH',  18, 'https://arb-mainnet.g.alchemy.com/v2/', 'https://arbiscan.io',          12, 1,   TRUE,  TRUE,  3),
('OP',    'Optimism',       'EVM',  10,    'ETH',  18, 'https://opt-mainnet.g.alchemy.com/v2/', 'https://optimistic.etherscan.io', 12, 2, TRUE,  TRUE,  4),
('BASE',  'Base',           'EVM',  8453,  'ETH',  18, 'https://base-mainnet.g.alchemy.com/v2/','https://basescan.org',         12, 2,   TRUE,  TRUE,  5),
('SOL',   'Solana',         'SOL',  NULL,  'SOL',  9,  'https://api.mainnet-beta.solana.com',   'https://explorer.solana.com',  32, 1,   FALSE, FALSE, 6),
('TRON',  'TRON',           'TRON', NULL,  'TRX',  6,  'https://api.trongrid.io',               'https://tronscan.org',         20, 3,   FALSE, FALSE, 7),
('HYPE',  'Hyperliquid',    'EVM',  999,   'HYPE', 18, NULL,                                    NULL,                           12, 2,   FALSE, FALSE, 8),
('BTC',   'Bitcoin',        'BTC',  NULL,  'BTC',  8,  NULL,                                    'https://blockstream.info',     6,  600, FALSE, FALSE, 9),
('DOGE',  'Dogecoin',       'DOGE', NULL,  'DOGE', 8,  NULL,                                    'https://dogechain.info',       40, 60,  FALSE, FALSE, 10)
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ASSETS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO assets (symbol, name, asset_type, decimals, is_stablecoin, coingecko_id, sort_order) VALUES
('BTC',  'Bitcoin',        'native',  8,  FALSE, 'bitcoin',            1),
('ETH',  'Ethereum',       'native',  18, FALSE, 'ethereum',           2),
('USDT', 'Tether USD',     'erc20',   6,  TRUE,  'tether',             3),
('USDC', 'USD Coin',       'erc20',   6,  TRUE,  'usd-coin',           4),
('DAI',  'Dai Stablecoin', 'erc20',   18, TRUE,  'dai',                5),
('BNB',  'BNB',            'native',  18, FALSE, 'binancecoin',        6),
('SOL',  'Solana',         'native',  9,  FALSE, 'solana',             7),
('ARB',  'Arbitrum',       'erc20',   18, FALSE, 'arbitrum',           8),
('OP',   'Optimism',       'erc20',   18, FALSE, 'optimism',           9),
('DMX',  'DotMX Token',    'erc20',   18, FALSE, NULL,                10),
('WBTC', 'Wrapped Bitcoin','erc20',   8,  FALSE, 'wrapped-bitcoin',   11),
('WETH', 'Wrapped Ether',  'erc20',   18, FALSE, 'weth',              12),
('DOGE', 'Dogecoin',       'native',  8,  FALSE, 'dogecoin',          13)
ON CONFLICT (symbol) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. ASSET–NETWORK MAPPINGS
-- ═══════════════════════════════════════════════════════════════════════════

-- ETH on EVM chains
INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, NULL, 18, TRUE, 0.001
FROM assets a, networks n WHERE a.symbol = 'ETH' AND n.code = 'ETH'
ON CONFLICT (asset_id, network_id) DO NOTHING;

INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, NULL, 18, TRUE, 0.0001
FROM assets a, networks n WHERE a.symbol = 'ETH' AND n.code = 'ARB'
ON CONFLICT (asset_id, network_id) DO NOTHING;

INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, NULL, 18, TRUE, 0.0001
FROM assets a, networks n WHERE a.symbol = 'ETH' AND n.code = 'OP'
ON CONFLICT (asset_id, network_id) DO NOTHING;

INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, NULL, 18, TRUE, 0.0001
FROM assets a, networks n WHERE a.symbol = 'ETH' AND n.code = 'BASE'
ON CONFLICT (asset_id, network_id) DO NOTHING;

-- USDT on EVM chains
INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, FALSE, 1.0
FROM assets a, networks n WHERE a.symbol = 'USDT' AND n.code = 'ETH'
ON CONFLICT (asset_id, network_id) DO NOTHING;

INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, '0x55d398326f99059fF775485246999027B3197955', 18, FALSE, 0.5
FROM assets a, networks n WHERE a.symbol = 'USDT' AND n.code = 'BSC'
ON CONFLICT (asset_id, network_id) DO NOTHING;

INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 6, FALSE, 0.1
FROM assets a, networks n WHERE a.symbol = 'USDT' AND n.code = 'ARB'
ON CONFLICT (asset_id, network_id) DO NOTHING;

INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', 6, FALSE, 0.1
FROM assets a, networks n WHERE a.symbol = 'USDT' AND n.code = 'OP'
ON CONFLICT (asset_id, network_id) DO NOTHING;

-- USDC on EVM chains
INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, FALSE, 1.0
FROM assets a, networks n WHERE a.symbol = 'USDC' AND n.code = 'ETH'
ON CONFLICT (asset_id, network_id) DO NOTHING;

INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 18, FALSE, 0.5
FROM assets a, networks n WHERE a.symbol = 'USDC' AND n.code = 'BSC'
ON CONFLICT (asset_id, network_id) DO NOTHING;

INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 6, FALSE, 0.1
FROM assets a, networks n WHERE a.symbol = 'USDC' AND n.code = 'ARB'
ON CONFLICT (asset_id, network_id) DO NOTHING;

INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', 6, FALSE, 0.1
FROM assets a, networks n WHERE a.symbol = 'USDC' AND n.code = 'OP'
ON CONFLICT (asset_id, network_id) DO NOTHING;

INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 6, FALSE, 0.1
FROM assets a, networks n WHERE a.symbol = 'USDC' AND n.code = 'BASE'
ON CONFLICT (asset_id, network_id) DO NOTHING;

-- BNB on BSC (native)
INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, NULL, 18, TRUE, 0.001
FROM assets a, networks n WHERE a.symbol = 'BNB' AND n.code = 'BSC'
ON CONFLICT (asset_id, network_id) DO NOTHING;

-- DAI on Ethereum
INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, FALSE, 1.0
FROM assets a, networks n WHERE a.symbol = 'DAI' AND n.code = 'ETH'
ON CONFLICT (asset_id, network_id) DO NOTHING;

-- WBTC on Ethereum
INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 8, FALSE, 0.0003
FROM assets a, networks n WHERE a.symbol = 'WBTC' AND n.code = 'ETH'
ON CONFLICT (asset_id, network_id) DO NOTHING;

-- DMX on Ethereum (placeholder contract)
INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, '0x0000000000000000000000000000000000000000', 18, FALSE, 0
FROM assets a, networks n WHERE a.symbol = 'DMX' AND n.code = 'ETH'
ON CONFLICT (asset_id, network_id) DO NOTHING;

-- BTC on Bitcoin (native)
INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, NULL, 8, TRUE, 0.0005
FROM assets a, networks n WHERE a.symbol = 'BTC' AND n.code = 'BTC'
ON CONFLICT (asset_id, network_id) DO NOTHING;

-- SOL on Solana (native)
INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, NULL, 9, TRUE, 0.01
FROM assets a, networks n WHERE a.symbol = 'SOL' AND n.code = 'SOL'
ON CONFLICT (asset_id, network_id) DO NOTHING;

-- USDT on Solana (SPL token)
INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 6, FALSE, 1.0
FROM assets a, networks n WHERE a.symbol = 'USDT' AND n.code = 'SOL'
ON CONFLICT (asset_id, network_id) DO NOTHING;

-- USDC on Solana (SPL token)
INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 6, FALSE, 1.0
FROM assets a, networks n WHERE a.symbol = 'USDC' AND n.code = 'SOL'
ON CONFLICT (asset_id, network_id) DO NOTHING;

-- USDT on TRON (TRC20)
INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 6, FALSE, 1.0
FROM assets a, networks n WHERE a.symbol = 'USDT' AND n.code = 'TRON'
ON CONFLICT (asset_id, network_id) DO NOTHING;

-- DOGE on Dogecoin (native)
INSERT INTO asset_networks (asset_id, network_id, contract_address, decimals, is_native, withdrawal_fee)
SELECT a.id, n.id, NULL, 8, TRUE, 5.0
FROM assets a, networks n WHERE a.symbol = 'DOGE' AND n.code = 'DOGE'
ON CONFLICT (asset_id, network_id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. TRADING PAIRS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO trading_pairs (symbol, base_currency, quote_currency, tick_size, lot_size, min_order_size, min_notional, maker_fee, taker_fee, display_order) VALUES
('BTC/USDT',  'BTC',  'USDT', 0.01,       0.00001,    0.00001,    10, 0.001, 0.002, 1),
('ETH/USDT',  'ETH',  'USDT', 0.01,       0.0001,     0.0001,     10, 0.001, 0.002, 2),
('BNB/USDT',  'BNB',  'USDT', 0.01,       0.001,      0.001,      10, 0.001, 0.002, 3),
('SOL/USDT',  'SOL',  'USDT', 0.01,       0.01,       0.01,       10, 0.001, 0.002, 4),
('ARB/USDT',  'ARB',  'USDT', 0.0001,     0.1,        0.1,        10, 0.001, 0.002, 5),
('OP/USDT',   'OP',   'USDT', 0.0001,     0.1,        0.1,        10, 0.001, 0.002, 6),
('DMX/USDT',  'DMX',  'USDT', 0.00001,    1.0,        1.0,        10, 0.001, 0.002, 7),
('ETH/BTC',   'ETH',  'BTC',  0.00001,    0.001,      0.001,      0.0001, 0.001, 0.002, 8),
('BTC/USDC',  'BTC',  'USDC', 0.01,       0.00001,    0.00001,    10, 0.001, 0.002, 9),
('ETH/USDC',  'ETH',  'USDC', 0.01,       0.0001,     0.0001,     10, 0.001, 0.002, 10),
('DAI/USDT',  'DAI',  'USDT', 0.0001,     1.0,        1.0,        10, 0.001, 0.002, 11),
('WBTC/USDT', 'WBTC', 'USDT', 0.01,       0.00001,    0.00001,    10, 0.001, 0.002, 12),
('DOGE/USDT', 'DOGE', 'USDT', 0.00001,    1.0,        1.0,        10, 0.001, 0.002, 13)
ON CONFLICT (symbol) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. SPOT FEE TIERS (Binance-style VIP 0–9)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO fee_tiers (tier_level, tier_name, min_30d_volume_usd, min_dmx_holding, maker_fee_rate, taker_fee_rate, maker_fee_discount, taker_fee_discount, effective_maker_fee, effective_taker_fee, daily_withdrawal_limit_usd, withdrawal_fee_discount, max_leverage, api_rate_limit_multiplier, badge_color, description) VALUES
(0, 'Regular',  0,          0,       0.001000, 0.001000, 0.000000, 0.000000, 0.001000, 0.001000, 10000,     0.00, 20,  1.0, '#808080', 'Default tier'),
(1, 'VIP 1',    1000000,    50,      0.000900, 0.001000, 0.000100, 0.000000, 0.000900, 0.001000, 50000,     0.05, 30,  1.2, '#CD7F32', 'VIP 1 – Beginner trader'),
(2, 'VIP 2',    5000000,    200,     0.000800, 0.001000, 0.000200, 0.000000, 0.000800, 0.001000, 100000,    0.10, 40,  1.5, '#C0C0C0', 'VIP 2 – Active trader'),
(3, 'VIP 3',    10000000,   500,     0.000500, 0.000700, 0.000500, 0.000300, 0.000500, 0.000700, 200000,    0.15, 50,  2.0, '#FFD700', 'VIP 3 – Experienced trader'),
(4, 'VIP 4',    20000000,   1000,    0.000400, 0.000600, 0.000600, 0.000400, 0.000400, 0.000600, 300000,    0.20, 60,  2.5, '#E5E4E2', 'VIP 4 – Advanced trader'),
(5, 'VIP 5',    50000000,   2000,    0.000300, 0.000500, 0.000700, 0.000500, 0.000300, 0.000500, 500000,    0.25, 75,  3.0, '#B9F2FF', 'VIP 5 – Pro trader'),
(6, 'VIP 6',    100000000,  5000,    0.000200, 0.000400, 0.000800, 0.000600, 0.000200, 0.000400, 500000,    0.30, 100, 4.0, '#E0115F', 'VIP 6 – Elite trader'),
(7, 'VIP 7',    250000000,  10000,   0.000100, 0.000300, 0.000900, 0.000700, 0.000100, 0.000300, 1000000,   0.40, 100, 5.0, '#50C878', 'VIP 7 – Master trader'),
(8, 'VIP 8',    500000000,  25000,   0.000050, 0.000200, 0.000950, 0.000800, 0.000050, 0.000200, 2000000,   0.50, 125, 7.5, '#0F52BA', 'VIP 8 – Legend'),
(9, 'VIP 9',    1000000000, 50000,   0.000000, 0.000100, 0.001000, 0.000900, 0.000000, 0.000100, 5000000,   0.60, 150, 10.0,'#E6E8FA', 'VIP 9 – VVIP')
ON CONFLICT (tier_level) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. PERPETUAL FEE TIERS (VIP 0–9, maker rebate model)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO perpetual_fee_tiers (tier_level, tier_name, min_30d_volume_usd, min_dmx_holding, maker_fee_rate, taker_fee_rate, maker_fee_adjustment, taker_fee_adjustment, effective_maker_fee, effective_taker_fee, funding_fee_discount, liquidation_penalty_discount, daily_withdrawal_limit_usd, max_leverage, api_rate_limit_multiplier, priority_execution, badge_color, description) VALUES
(0, 'Regular',  0,          0,       0.000200,  0.000500, 0.000000,  0.000000, 0.000200,  0.000500, 0.00, 0.00, 10000,    20,  1.0,  FALSE, '#808080', 'Default perpetual tier'),
(1, 'VIP 1',    1000000,    50,      0.000150,  0.000450, 0.000050,  0.000050, 0.000150,  0.000450, 0.05, 0.02, 50000,    30,  1.2,  FALSE, '#CD7F32', 'VIP 1'),
(2, 'VIP 2',    5000000,    200,     0.000100,  0.000400, 0.000100,  0.000100, 0.000100,  0.000400, 0.08, 0.05, 100000,   40,  1.5,  FALSE, '#C0C0C0', 'VIP 2'),
(3, 'VIP 3',    10000000,   500,     0.000050,  0.000350, 0.000150,  0.000150, 0.000050,  0.000350, 0.10, 0.08, 200000,   50,  2.0,  FALSE, '#FFD700', 'VIP 3'),
(4, 'VIP 4',    20000000,   1000,    0.000000,  0.000300, 0.000200,  0.000200, 0.000000,  0.000300, 0.12, 0.10, 300000,   60,  2.5,  FALSE, '#E5E4E2', 'VIP 4'),
(5, 'VIP 5',    50000000,   2000,   -0.000010,  0.000270, 0.000210,  0.000230,-0.000010,  0.000270, 0.15, 0.12, 500000,   75,  3.0,  TRUE,  '#B9F2FF', 'VIP 5 – maker rebates start'),
(6, 'VIP 6',    100000000,  5000,   -0.000020,  0.000250, 0.000220,  0.000250,-0.000020,  0.000250, 0.18, 0.15, 500000,   100, 4.0,  TRUE,  '#E0115F', 'VIP 6'),
(7, 'VIP 7',    250000000,  10000,  -0.000030,  0.000220, 0.000230,  0.000280,-0.000030,  0.000220, 0.20, 0.18, 1000000,  100, 5.0,  TRUE,  '#50C878', 'VIP 7'),
(8, 'VIP 8',    500000000,  25000,  -0.000040,  0.000180, 0.000240,  0.000320,-0.000040,  0.000180, 0.25, 0.20, 2000000,  125, 7.5,  TRUE,  '#0F52BA', 'VIP 8'),
(9, 'VIP 9',    1000000000, 50000,  -0.000050,  0.000150, 0.000250,  0.000350,-0.000050,  0.000150, 0.30, 0.25, 5000000,  150, 10.0, TRUE,  '#E6E8FA', 'VIP 9')
ON CONFLICT (tier_level) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. DMX FEE DISCOUNT CONFIG
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO dmx_fee_discount_config (discount_percentage, is_enabled, min_dmx_balance, auto_convert_enabled, stackable_with_vip, applies_before_vip_discount, description) VALUES
(0.2500, TRUE, 0, TRUE, TRUE, FALSE, 'Pay fees with DMX token for 25% discount (like BNB on Binance)')
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. RETAIL VIP TIERS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO retail_vip_tiers (tier_level, tier_name, min_30d_volume_usd, min_token_holding, maker_fee_discount, taker_fee_discount, daily_withdrawal_limit_usd, withdrawal_fee_discount, max_leverage, loyalty_points_multiplier, priority_customer_support, dedicated_account_manager, api_rate_limit_multiplier, badge_color) VALUES
(0, 'Regular',  0,          0,     0.0000, 0.0000, 10000,    0.00, 20,  1.0, FALSE, FALSE, 1.0, '#808080'),
(1, 'Bronze',   1000000,    50,    0.0100, 0.0000, 50000,    0.05, 30,  1.1, FALSE, FALSE, 1.2, '#CD7F32'),
(2, 'Silver',   5000000,    200,   0.0200, 0.0000, 100000,   0.10, 40,  1.2, FALSE, FALSE, 1.5, '#C0C0C0'),
(3, 'Gold',     10000000,   500,   0.0500, 0.0300, 200000,   0.15, 50,  1.5, TRUE,  FALSE, 2.0, '#FFD700'),
(4, 'Platinum', 20000000,   1000,  0.0600, 0.0400, 300000,   0.20, 60,  1.8, TRUE,  FALSE, 2.5, '#E5E4E2'),
(5, 'Diamond',  50000000,   2000,  0.0700, 0.0500, 500000,   0.25, 75,  2.0, TRUE,  TRUE,  3.0, '#B9F2FF'),
(6, 'Elite',    100000000,  5000,  0.0800, 0.0600, 500000,   0.30, 100, 2.5, TRUE,  TRUE,  4.0, '#E0115F'),
(7, 'Master',   250000000,  10000, 0.0900, 0.0700, 1000000,  0.40, 100, 3.0, TRUE,  TRUE,  5.0, '#50C878'),
(8, 'Legend',   500000000,  25000, 0.0950, 0.0800, 2000000,  0.50, 125, 4.0, TRUE,  TRUE,  7.5, '#0F52BA'),
(9, 'VVIP',     1000000000, 50000, 0.1000, 0.0900, 5000000,  0.60, 150, 5.0, TRUE,  TRUE,  10.0,'#E6E8FA')
ON CONFLICT (tier_level) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. WITHDRAWAL LIMITS (default tier)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO withdrawal_limits (tier, daily_limit_usd, daily_withdrawal_count, monthly_limit_usd, monthly_withdrawal_count, min_withdrawal_usd, max_withdrawal_usd, large_withdrawal_threshold_usd, large_withdrawal_delay_hours, requires_manual_approval_above_usd)
VALUES ('default', 100000, 50, 1000000, 500, 10, 50000, 10000, 24, 50000)
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 10. INSURANCE FUND INITIALIZATION
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO insurance_fund (symbol, balance, target_balance, max_single_payout, is_active) VALUES
('BTC/USDT',  0, 1000000, 100000, TRUE),
('ETH/USDT',  0, 500000,  50000,  TRUE),
('BNB/USDT',  0, 200000,  20000,  TRUE),
('SOL/USDT',  0, 200000,  20000,  TRUE),
('ARB/USDT',  0, 100000,  10000,  TRUE),
('OP/USDT',   0, 100000,  10000,  TRUE),
('DMX/USDT',  0, 100000,  10000,  TRUE),
('WBTC/USDT', 0, 100000,  10000,  TRUE)
ON CONFLICT (symbol) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 11. TEST USERS & BALANCES (DEV ONLY — remove before production)
-- ═══════════════════════════════════════════════════════════════════════════

-- Password for all test users: "TestPass123!"
-- Argon2id hash (OWASP recommended: memoryCost=64MB, timeCost=3, parallelism=1)
DO $$
DECLARE
    v_admin_id UUID;
    v_alice_id UUID;
    v_bob_id   UUID;
    v_carol_id UUID;
    v_usdt_id  UUID;
    v_usdc_id  UUID;
    v_btc_id   UUID;
    v_eth_id   UUID;
    v_dmx_id   UUID;
    v_pw_hash  TEXT := '$argon2id$v=19$m=65536,t=3,p=1$JDTxIhLl00qydWihBlxMWKFRFL30myKzQXn83tEehsw$exvsHGIQIWzXw8g6k+731BRGDJEzuvMnGE/TSLeuX6Y';
BEGIN
    -- Admin user
    INSERT INTO users (id, email, email_verified, password_hash, first_name, last_name, username, role, status, kyc_verified, kyc_level)
    VALUES (gen_random_uuid(), 'admin@dotmx.com', TRUE, v_pw_hash, 'Admin', 'DotMX', 'admin', 'super_admin', 'active', TRUE, 3)
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO v_admin_id;

    -- Test trader: Alice
    INSERT INTO users (id, email, email_verified, password_hash, first_name, last_name, username, role, status, kyc_verified, kyc_level)
    VALUES (gen_random_uuid(), 'alice@test.com', TRUE, v_pw_hash, 'Alice', 'Trader', 'alice', 'user', 'active', TRUE, 2)
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO v_alice_id;

    -- Test trader: Bob
    INSERT INTO users (id, email, email_verified, password_hash, first_name, last_name, username, role, status, kyc_verified, kyc_level)
    VALUES (gen_random_uuid(), 'bob@test.com', TRUE, v_pw_hash, 'Bob', 'Trader', 'bob', 'user', 'active', TRUE, 1)
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO v_bob_id;

    -- Test trader: Carol (unverified)
    INSERT INTO users (id, email, email_verified, password_hash, first_name, last_name, username, role, status)
    VALUES (gen_random_uuid(), 'carol@test.com', FALSE, v_pw_hash, 'Carol', 'New', 'carol', 'user', 'active')
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO v_carol_id;

    -- Get asset IDs
    SELECT id INTO v_usdt_id FROM assets WHERE symbol = 'USDT';
    SELECT id INTO v_usdc_id FROM assets WHERE symbol = 'USDC';
    SELECT id INTO v_btc_id  FROM assets WHERE symbol = 'BTC';
    SELECT id INTO v_eth_id  FROM assets WHERE symbol = 'ETH';
    SELECT id INTO v_dmx_id  FROM assets WHERE symbol = 'DMX';

    -- Seed balances (only if users were created)
    IF v_alice_id IS NOT NULL AND v_usdt_id IS NOT NULL THEN
        INSERT INTO user_balances (user_id, asset_id, available) VALUES
            (v_alice_id, v_usdt_id, 100000.00),
            (v_alice_id, v_btc_id,  2.50000000),
            (v_alice_id, v_eth_id,  50.00000000),
            (v_alice_id, v_dmx_id,  10000.00000000)
        ON CONFLICT (user_id, asset_id) DO NOTHING;
    END IF;

    IF v_bob_id IS NOT NULL AND v_usdt_id IS NOT NULL THEN
        INSERT INTO user_balances (user_id, asset_id, available) VALUES
            (v_bob_id, v_usdt_id, 50000.00),
            (v_bob_id, v_btc_id,  1.00000000),
            (v_bob_id, v_eth_id,  25.00000000)
        ON CONFLICT (user_id, asset_id) DO NOTHING;
    END IF;

    -- Initialize global derivation counter (network_id = NULL)
    -- Used for EVM chains with sequential address derivation
    INSERT INTO derivation_counters (network_id, current_index)
    SELECT NULL, 0
    WHERE NOT EXISTS (SELECT 1 FROM derivation_counters WHERE network_id IS NULL);
END $$;

COMMIT;

-- ============================================================================
-- END OF SEED DATA
-- ============================================================================
