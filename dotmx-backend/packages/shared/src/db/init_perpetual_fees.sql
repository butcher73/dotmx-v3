-- ============================================================================
-- PERPETUAL FUTURES FEE TIER INITIALIZATION
-- ============================================================================
-- Binance Futures style fee tiers:
-- Base: Maker -0.005% (rebate), Taker 0.035%
-- Higher tiers: Better rebates, lower taker fees
-- ============================================================================

-- Insert perpetual fee tiers (10 tiers: 0-9)
-- Based on Binance Futures VIP program
INSERT INTO perpetual_fee_tiers (
    tier_level,
    tier_name,
    min_30d_volume_usd,
    min_dmx_holding,
    maker_fee_rate,
    taker_fee_rate,
    maker_fee_adjustment,
    taker_fee_adjustment,
    effective_maker_fee,
    effective_taker_fee,
    funding_fee_discount,
    liquidation_penalty_discount,
    daily_withdrawal_limit_usd,
    max_leverage,
    api_rate_limit_multiplier,
    priority_execution,
    badge_color,
    badge_icon,
    description
) VALUES
-- Tier 0: Regular (Default)
-- Maker: -0.005% (rebate), Taker: 0.035%
(
    0,
    'Regular',
    0,                -- No volume requirement
    0,                -- No DMX requirement
    -0.000050,        -- -0.005% maker (rebate)
    0.000350,         -- 0.035% taker
    0,                -- No adjustment
    0,
    -0.000050,        -- -0.005% effective maker
    0.000350,         -- 0.035% effective taker
    0,                -- No funding discount
    0,                -- No liquidation discount
    10000,            -- $10K daily withdrawal
    20,               -- 20x leverage
    1.0,
    false,
    'gray',
    'user',
    'Default tier - Maker rebate: -0.005%, Taker: 0.035%'
),

-- Tier 1: Bronze
-- Maker: -0.006% (rebate), Taker: 0.034%
(
    1,
    'Bronze',
    50000,            -- $50K volume
    0,
    -0.000050,        -- Base maker
    0.000350,         -- Base taker
    -0.000010,        -- +0.001% rebate bonus
    -0.000010,        -- -0.001% taker reduction
    -0.000060,        -- -0.006% effective maker
    0.000340,         -- 0.034% effective taker
    0,
    0,
    50000,
    25,
    1.2,
    false,
    'bronze',
    'shield',
    'Bronze tier - Maker rebate: -0.006%, Taker: 0.034%'
),

-- Tier 2: Silver
-- Maker: -0.008% (rebate), Taker: 0.032%
(
    2,
    'Silver',
    250000,           -- $250K volume
    1000,             -- 1K DMX
    -0.000050,
    0.000350,
    -0.000030,        -- +0.003% rebate bonus
    -0.000030,        -- -0.003% taker reduction
    -0.000080,        -- -0.008% effective maker
    0.000320,         -- 0.032% effective taker
    0.05,             -- 5% funding discount
    0.05,             -- 5% liquidation discount
    100000,
    30,
    1.5,
    false,
    'silver',
    'shield',
    'Silver tier - Maker rebate: -0.008%, Taker: 0.032%'
),

-- Tier 3: Gold
-- Maker: -0.010% (rebate), Taker: 0.030%
(
    3,
    'Gold',
    1000000,          -- $1M volume
    5000,             -- 5K DMX
    -0.000050,
    0.000350,
    -0.000050,        -- +0.005% rebate bonus
    -0.000050,        -- -0.005% taker reduction
    -0.000100,        -- -0.010% effective maker
    0.000300,         -- 0.030% effective taker
    0.10,             -- 10% funding discount
    0.10,             -- 10% liquidation discount
    500000,
    50,
    2.0,
    false,
    'gold',
    'crown',
    'Gold tier - Maker rebate: -0.010%, Taker: 0.030%'
),

-- Tier 4: Platinum
-- Maker: -0.012% (rebate), Taker: 0.028%
(
    4,
    'Platinum',
    5000000,          -- $5M volume
    10000,            -- 10K DMX
    -0.000050,
    0.000350,
    -0.000070,        -- +0.007% rebate bonus
    -0.000070,        -- -0.007% taker reduction
    -0.000120,        -- -0.012% effective maker
    0.000280,         -- 0.028% effective taker
    0.15,             -- 15% funding discount
    0.15,             -- 15% liquidation discount
    1000000,
    75,
    2.5,
    true,
    'platinum',
    'crown',
    'Platinum tier - Maker rebate: -0.012%, Taker: 0.028%'
),

-- Tier 5: Diamond
-- Maker: -0.015% (rebate), Taker: 0.025%
(
    5,
    'Diamond',
    25000000,         -- $25M volume
    50000,            -- 50K DMX
    -0.000050,
    0.000350,
    -0.000100,        -- +0.010% rebate bonus
    -0.000100,        -- -0.010% taker reduction
    -0.000150,        -- -0.015% effective maker
    0.000250,         -- 0.025% effective taker
    0.20,             -- 20% funding discount
    0.20,             -- 20% liquidation discount
    5000000,
    100,
    3.0,
    true,
    'diamond',
    'gem',
    'Diamond tier - Maker rebate: -0.015%, Taker: 0.025%'
),

-- Tier 6: Master
-- Maker: -0.018% (rebate), Taker: 0.022%
(
    6,
    'Master',
    100000000,        -- $100M volume
    100000,           -- 100K DMX
    -0.000050,
    0.000350,
    -0.000130,        -- +0.013% rebate bonus
    -0.000130,        -- -0.013% taker reduction
    -0.000180,        -- -0.018% effective maker
    0.000220,         -- 0.022% effective taker
    0.25,             -- 25% funding discount
    0.25,             -- 25% liquidation discount
    10000000,
    125,
    5.0,
    true,
    'blue',
    'star',
    'Master tier - Maker rebate: -0.018%, Taker: 0.022%'
),

-- Tier 7: Grandmaster
-- Maker: -0.020% (rebate), Taker: 0.020%
(
    7,
    'Grandmaster',
    300000000,        -- $300M volume
    250000,           -- 250K DMX
    -0.000050,
    0.000350,
    -0.000150,        -- +0.015% rebate bonus
    -0.000150,        -- -0.015% taker reduction
    -0.000200,        -- -0.020% effective maker
    0.000200,         -- 0.020% effective taker
    0.30,             -- 30% funding discount
    0.30,             -- 30% liquidation discount
    25000000,
    150,
    6.0,
    true,
    'purple',
    'star',
    'Grandmaster tier - Maker rebate: -0.020%, Taker: 0.020%'
),

-- Tier 8: Elite
-- Maker: -0.022% (rebate), Taker: 0.018%
(
    8,
    'Elite',
    500000000,        -- $500M volume
    500000,           -- 500K DMX
    -0.000050,
    0.000350,
    -0.000170,        -- +0.017% rebate bonus
    -0.000170,        -- -0.017% taker reduction
    -0.000220,        -- -0.022% effective maker
    0.000180,         -- 0.018% effective taker
    0.35,             -- 35% funding discount
    0.35,             -- 35% liquidation discount
    50000000,
    200,
    7.5,
    true,
    'red',
    'flame',
    'Elite tier - Maker rebate: -0.022%, Taker: 0.018%'
),

-- Tier 9: Legendary
-- Maker: -0.025% (rebate), Taker: 0.015%
(
    9,
    'Legendary',
    1000000000,       -- $1B volume
    1000000,          -- 1M DMX
    -0.000050,
    0.000350,
    -0.000200,        -- +0.020% rebate bonus
    -0.000200,        -- -0.020% taker reduction
    -0.000250,        -- -0.025% effective maker
    0.000150,         -- 0.015% effective taker
    0.50,             -- 50% funding discount
    0.50,             -- 50% liquidation discount
    100000000,
    250,
    10.0,
    true,
    'rainbow',
    'trophy',
    'Legendary tier - Maker rebate: -0.025%, Taker: 0.015%'
)
ON CONFLICT (tier_level) DO UPDATE SET
    tier_name = EXCLUDED.tier_name,
    min_30d_volume_usd = EXCLUDED.min_30d_volume_usd,
    min_dmx_holding = EXCLUDED.min_dmx_holding,
    maker_fee_rate = EXCLUDED.maker_fee_rate,
    taker_fee_rate = EXCLUDED.taker_fee_rate,
    maker_fee_adjustment = EXCLUDED.maker_fee_adjustment,
    taker_fee_adjustment = EXCLUDED.taker_fee_adjustment,
    effective_maker_fee = EXCLUDED.effective_maker_fee,
    effective_taker_fee = EXCLUDED.effective_taker_fee,
    funding_fee_discount = EXCLUDED.funding_fee_discount,
    liquidation_penalty_discount = EXCLUDED.liquidation_penalty_discount,
    daily_withdrawal_limit_usd = EXCLUDED.daily_withdrawal_limit_usd,
    max_leverage = EXCLUDED.max_leverage,
    api_rate_limit_multiplier = EXCLUDED.api_rate_limit_multiplier,
    priority_execution = EXCLUDED.priority_execution,
    badge_color = EXCLUDED.badge_color,
    badge_icon = EXCLUDED.badge_icon,
    description = EXCLUDED.description,
    updated_at = NOW();

-- ============================================================================
-- INITIALIZE INSURANCE FUND FOR DEFAULT SYMBOLS
-- ============================================================================

INSERT INTO insurance_fund (symbol, balance, target_balance, max_single_payout)
VALUES 
    ('BTC-USDT', 0, 1000000, 100000),
    ('ETH-USDT', 0, 500000, 50000),
    ('SOL-USDT', 0, 250000, 25000),
    ('ARB-USDT', 0, 100000, 10000),
    ('AVAX-USDT', 0, 100000, 10000),
    ('MATIC-USDT', 0, 100000, 10000),
    ('LINK-USDT', 0, 50000, 5000),
    ('UNI-USDT', 0, 50000, 5000)
ON CONFLICT (symbol) DO NOTHING;

-- ============================================================================
-- DISPLAY FEE SUMMARY
-- ============================================================================

SELECT 
    tier_level as "Tier",
    tier_name as "Name",
    '$' || TRIM(TO_CHAR(min_30d_volume_usd, '999,999,999,999')) as "30d Volume",
    TRIM(TO_CHAR(min_dmx_holding, '999,999,999')) || ' DMX' as "Min DMX",
    CASE WHEN effective_maker_fee < 0 
        THEN '-' || (ABS(effective_maker_fee) * 100)::TEXT || '% (rebate)'
        ELSE (effective_maker_fee * 100)::TEXT || '%'
    END as "Maker Fee",
    (effective_taker_fee * 100)::TEXT || '%' as "Taker Fee",
    (funding_fee_discount * 100)::TEXT || '%' as "Funding Discount",
    (liquidation_penalty_discount * 100)::TEXT || '%' as "Liq Discount"
FROM perpetual_fee_tiers
ORDER BY tier_level;

-- ============================================================================
-- FEE COMPARISON TABLE
-- ============================================================================

/*
Fee Comparison with Major Exchanges:

| Exchange    | Maker       | Taker  | Notes                        |
|-------------|-------------|--------|------------------------------|
| Binance     | -0.005%     | 0.035% | BNB discount available       |
| DotMX (Ours)| -0.005%     | 0.035% | DMX discount available       |
| Bybit       | -0.0025%    | 0.06%  | VIP tiers available          |
| OKX         | -0.005%     | 0.035% | OKB discount available       |
| Hyperliquid | 0%          | 0.02%  | Points system                |
| dYdX        | 0%          | 0.05%  | Trading rewards              |

Our Fee Structure:
- Competitive with Binance Futures
- Maker rebate incentivizes liquidity
- Progressive tiers reward high volume traders
- DMX token discount (25%) stacks with tiers
- Maximum rebate at Tier 9: -0.025%
- Minimum taker at Tier 9: 0.015%

Funding Fees:
- 8-hour intervals
- Rate capped at ±0.015%
- Smoothed tanh model prevents manipulation
- Higher tiers get funding fee discounts

Liquidation Penalty:
- 0.4% of liquidated notional
- Progressive liquidation (partial first)
- Higher tiers get penalty discounts
- Insurance fund capitalization
*/
