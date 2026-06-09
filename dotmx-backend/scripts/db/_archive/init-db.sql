-- DotMX Database Schema

-- Orders (read model, not source of truth)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    side VARCHAR(4) NOT NULL,
    type VARCHAR(10) NOT NULL,
    price DECIMAL(24, 8),
    quantity DECIMAL(24, 8) NOT NULL,
    quantity_remaining DECIMAL(24, 8) NOT NULL,
    status VARCHAR(20) NOT NULL,
    time_in_force VARCHAR(3) DEFAULT 'GTC',
    client_order_id VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_symbol ON orders(symbol);
CREATE INDEX idx_orders_status ON orders(status);

-- Trades (read model)
CREATE TABLE IF NOT EXISTS trades (
    id VARCHAR(64) PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL,
    maker_order_id VARCHAR(64) NOT NULL,
    taker_order_id VARCHAR(64) NOT NULL,
    price DECIMAL(24, 8) NOT NULL,
    quantity DECIMAL(24, 8) NOT NULL,
    maker_fee DECIMAL(24, 8) DEFAULT 0,
    taker_fee DECIMAL(24, 8) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_created ON trades(created_at);

-- Balances (Phase 2)
CREATE TABLE IF NOT EXISTS balances (
    user_id VARCHAR(64) NOT NULL,
    asset VARCHAR(32) NOT NULL,
    available DECIMAL(24, 8) NOT NULL DEFAULT 0,
    locked DECIMAL(24, 8) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, asset)
);

-- Positions (Phase 2, Perps)
CREATE TABLE IF NOT EXISTS positions (
    user_id VARCHAR(64) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    size DECIMAL(24, 8) NOT NULL DEFAULT 0,
    entry_price DECIMAL(24, 8) NOT NULL DEFAULT 0,
    margin DECIMAL(24, 8) NOT NULL DEFAULT 0,
    leverage INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, symbol)
);

-- Event log (for auditing, optional persistence)
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(64) PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL,
    sequence_id BIGINT NOT NULL,
    kind VARCHAR(32) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_symbol_seq ON events(symbol, sequence_id);

-- Symbols configuration
CREATE TABLE IF NOT EXISTS trading_pairs (
    symbol VARCHAR(32) PRIMARY KEY,
    base_currency VARCHAR(16) NOT NULL,
    quote_currency VARCHAR(16) NOT NULL,
    tick_size DECIMAL(24, 8) NOT NULL,
    lot_size DECIMAL(24, 8) NOT NULL,
    min_order_size DECIMAL(24, 8) DEFAULT 0,
    max_order_size DECIMAL(24, 8) DEFAULT 1000000000,
    status VARCHAR(16) DEFAULT 'active',
    display_order INTEGER DEFAULT 0,
    maker_fee DECIMAL(6, 4) DEFAULT 0.0010,
    taker_fee DECIMAL(6, 4) DEFAULT 0.0020,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default trading pairs
INSERT INTO trading_pairs (symbol, base_currency, quote_currency, tick_size, lot_size, display_order) VALUES
    ('BTCUSDT', 'BTC', 'USDT', 0.01, 0.001, 1),
    ('ETHUSDT', 'ETH', 'USDT', 0.01, 0.01, 2),
    ('SOLUSDT', 'SOL', 'USDT', 0.01, 0.1, 3)
ON CONFLICT DO NOTHING;
