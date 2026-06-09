-- ============================================================================
-- Trading Pairs Schema
-- Defines trading pairs/markets available on the exchange
-- ============================================================================

-- Trading Pairs Table
CREATE TABLE IF NOT EXISTS trading_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL UNIQUE,           -- e.g., 'BTC/USDT', 'ETH/USDT'
    base_currency VARCHAR(10) NOT NULL,           -- Base asset symbol (e.g., 'BTC')
    quote_currency VARCHAR(10) NOT NULL,          -- Quote asset symbol (e.g., 'USDT')
    
    -- Status
    status VARCHAR(20) DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'maintenance', 'delisted')),
    
    -- Order constraints
    min_order_size DECIMAL(24, 12) NOT NULL DEFAULT 0.00000001,  -- Minimum order size in base currency
    max_order_size DECIMAL(24, 12) DEFAULT NULL,                  -- Maximum order size (NULL = unlimited)
    min_notional DECIMAL(24, 8) DEFAULT 10,                       -- Minimum order value in quote currency
    
    -- Precision settings
    tick_size DECIMAL(24, 12) NOT NULL DEFAULT 0.01,             -- Price increment (price precision)
    lot_size DECIMAL(24, 12) NOT NULL DEFAULT 0.00000001,        -- Quantity increment (quantity precision)
    
    -- Fee structure (in basis points, e.g., 10 = 0.1%)
    maker_fee DECIMAL(8, 4) NOT NULL DEFAULT 0.001,              -- Maker fee (0.1%)
    taker_fee DECIMAL(8, 4) NOT NULL DEFAULT 0.002,              -- Taker fee (0.2%)
    
    -- Market data
    last_price DECIMAL(24, 12) DEFAULT 0,
    price_change_24h DECIMAL(10, 4) DEFAULT 0,                    -- Percentage change
    volume_24h DECIMAL(24, 8) DEFAULT 0,                          -- Volume in quote currency
    high_24h DECIMAL(24, 12) DEFAULT 0,
    low_24h DECIMAL(24, 12) DEFAULT 0,
    
    -- Limits for risk management
    max_price_deviation DECIMAL(8, 4) DEFAULT 0.10,              -- Max price movement per trade (10%)
    circuit_breaker_threshold DECIMAL(8, 4) DEFAULT 0.20,        -- Circuit breaker trigger (20%)
    
    -- Display settings
    display_order INT DEFAULT 0,                                  -- Sort order for display
    icon_url VARCHAR(500),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    delisted_at TIMESTAMPTZ,
    
    -- Constraints
    UNIQUE(base_currency, quote_currency)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trading_pairs_symbol ON trading_pairs(symbol);
CREATE INDEX IF NOT EXISTS idx_trading_pairs_status ON trading_pairs(status);
CREATE INDEX IF NOT EXISTS idx_trading_pairs_base ON trading_pairs(base_currency);
CREATE INDEX IF NOT EXISTS idx_trading_pairs_quote ON trading_pairs(quote_currency);
CREATE INDEX IF NOT EXISTS idx_trading_pairs_display_order ON trading_pairs(display_order);
CREATE INDEX IF NOT EXISTS idx_trading_pairs_volume ON trading_pairs(volume_24h DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_trading_pairs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trading_pairs_updated_at ON trading_pairs;
CREATE TRIGGER trading_pairs_updated_at
    BEFORE UPDATE ON trading_pairs
    FOR EACH ROW
    EXECUTE FUNCTION update_trading_pairs_timestamp();

-- Comments
COMMENT ON TABLE trading_pairs IS 'Available trading pairs/markets on the exchange';
COMMENT ON COLUMN trading_pairs.symbol IS 'Unique trading pair symbol (e.g., BTC/USDT)';
COMMENT ON COLUMN trading_pairs.tick_size IS 'Minimum price increment for orders';
COMMENT ON COLUMN trading_pairs.lot_size IS 'Minimum quantity increment for orders';
COMMENT ON COLUMN trading_pairs.maker_fee IS 'Fee rate for maker orders (as decimal, 0.001 = 0.1%)';
COMMENT ON COLUMN trading_pairs.taker_fee IS 'Fee rate for taker orders (as decimal, 0.002 = 0.2%)';

-- ============================================================================
-- Initial seed data
-- ============================================================================

INSERT INTO trading_pairs (symbol, base_currency, quote_currency, status, min_order_size, max_order_size, tick_size, lot_size, maker_fee, taker_fee, display_order)
VALUES 
    ('BTC/USDT', 'BTC', 'USDT', 'active', 0.0001, 100, 0.01, 0.0001, 0.001, 0.002, 1),
    ('ETH/USDT', 'ETH', 'USDT', 'active', 0.001, 1000, 0.01, 0.001, 0.001, 0.002, 2),
    ('SOL/USDT', 'SOL', 'USDT', 'active', 0.01, 10000, 0.01, 0.01, 0.001, 0.002, 3),
    ('AVAX/USDT', 'AVAX', 'USDT', 'active', 0.01, 10000, 0.01, 0.01, 0.001, 0.002, 4),
    ('DOT/USDT', 'DOT', 'USDT', 'active', 0.1, 100000, 0.001, 0.1, 0.001, 0.002, 5),
    ('LINK/USDT', 'LINK', 'USDT', 'active', 0.1, 100000, 0.001, 0.1, 0.001, 0.002, 6),
    ('UNI/USDT', 'UNI', 'USDT', 'inactive', 0.1, 100000, 0.001, 0.1, 0.001, 0.002, 7),
    ('MATIC/USDT', 'MATIC', 'USDT', 'active', 1, 1000000, 0.0001, 1, 0.001, 0.002, 8),
    ('ARB/USDT', 'ARB', 'USDT', 'active', 1, 1000000, 0.0001, 1, 0.001, 0.002, 9),
    ('OP/USDT', 'OP', 'USDT', 'active', 1, 1000000, 0.001, 1, 0.001, 0.002, 10),
    ('ETH/BTC', 'ETH', 'BTC', 'active', 0.001, 1000, 0.00001, 0.001, 0.0008, 0.0015, 11),
    ('SOL/BTC', 'SOL', 'BTC', 'inactive', 0.01, 10000, 0.000001, 0.01, 0.0008, 0.0015, 12)
ON CONFLICT (symbol) DO NOTHING;
