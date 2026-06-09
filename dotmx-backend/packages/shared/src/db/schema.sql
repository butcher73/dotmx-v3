-- User Authentication Schema for DotMX
-- Supports both email/password and wallet-based authentication

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Users Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    password_hash TEXT, -- bcrypt hash, nullable for wallet-only users
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    username VARCHAR(50) UNIQUE,
    avatar_url TEXT,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'deleted')),
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret TEXT,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ============================================================================
-- Wallet Links Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS wallet_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(255) NOT NULL,
    chain_code VARCHAR(20) NOT NULL, -- ETH, POLYGON, AVAX, etc.
    chain_id INT,
    wallet_type VARCHAR(50) DEFAULT 'external', -- external, verexbase, metamask, etc.
    is_primary BOOLEAN DEFAULT FALSE,
    verified BOOLEAN DEFAULT FALSE,
    verexbase_vault_id UUID, -- Link to VerexBase vault if applicable
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(wallet_address, chain_code)
);

-- Indexes for wallet_links
CREATE INDEX IF NOT EXISTS idx_wallet_links_user_id ON wallet_links(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_links_wallet_address ON wallet_links(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_links_chain_code ON wallet_links(chain_code);
CREATE INDEX IF NOT EXISTS idx_wallet_links_verexbase_vault_id ON wallet_links(verexbase_vault_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_links_primary_per_user 
    ON wallet_links(user_id) WHERE is_primary = TRUE;

-- ============================================================================
-- Sessions Table (Refresh Tokens)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL UNIQUE,
    access_token_jti TEXT, -- JWT ID for access token
    device_name VARCHAR(255),
    device_fingerprint TEXT,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token) WHERE revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_access_token_jti ON sessions(access_token_jti);

-- ============================================================================
-- API Keys Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE, -- Hash of the actual API key
    key_prefix VARCHAR(20) NOT NULL, -- First 8 chars for identification
    name VARCHAR(100) NOT NULL,
    scopes TEXT[] DEFAULT ARRAY[]::TEXT[], -- e.g., ['trading.read', 'trading.write']
    rate_limit_per_minute INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    last_used_ip INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);

-- ============================================================================
-- Email Verification Tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for email_verification_tokens
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token) WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);

-- ============================================================================
-- Password Reset Tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for password_reset_tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token) WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

-- ============================================================================
-- Audit Logs for Authentication Events
-- ============================================================================
CREATE TABLE IF NOT EXISTS auth_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- login, logout, register, password_change, etc.
    status VARCHAR(20) NOT NULL, -- success, failure
    ip_address INET,
    user_agent TEXT,
    email VARCHAR(255),
    wallet_address VARCHAR(255),
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for auth_audit_logs
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_user_id ON auth_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_event_type ON auth_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_created_at ON auth_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_email ON auth_audit_logs(email);

-- ============================================================================
-- Wallet Authentication Challenges
-- ============================================================================
CREATE TABLE IF NOT EXISTS wallet_auth_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(255) NOT NULL,
    chain_code VARCHAR(20) NOT NULL,
    challenge_message TEXT NOT NULL,
    nonce VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for wallet_auth_challenges
CREATE INDEX IF NOT EXISTS idx_wallet_auth_challenges_nonce ON wallet_auth_challenges(nonce) WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_wallet_auth_challenges_wallet_address ON wallet_auth_challenges(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_auth_challenges_expires_at ON wallet_auth_challenges(expires_at);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_links_updated_at BEFORE UPDATE ON wallet_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Functions for Auth Operations
-- ============================================================================

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM email_verification_tokens WHERE expires_at < NOW() AND used = FALSE;
    DELETE FROM password_reset_tokens WHERE expires_at < NOW() AND used = FALSE;
    DELETE FROM wallet_auth_challenges WHERE expires_at < NOW() AND used = FALSE;
    DELETE FROM sessions WHERE expires_at < NOW() OR revoked = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to increment failed login attempts
CREATE OR REPLACE FUNCTION increment_failed_login(p_user_id UUID)
RETURNS void AS $$
DECLARE
    v_attempts INT;
BEGIN
    UPDATE users 
    SET failed_login_attempts = failed_login_attempts + 1
    WHERE id = p_user_id
    RETURNING failed_login_attempts INTO v_attempts;
    
    -- Lock account after 5 failed attempts for 30 minutes
    IF v_attempts >= 5 THEN
        UPDATE users 
        SET locked_until = NOW() + INTERVAL '30 minutes'
        WHERE id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to reset failed login attempts
CREATE OR REPLACE FUNCTION reset_failed_login(p_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE users 
    SET failed_login_attempts = 0,
        locked_until = NULL
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts supporting email/password and wallet authentication';
COMMENT ON TABLE wallet_links IS 'Links user accounts to blockchain wallets (VerexBase or external)';
COMMENT ON TABLE sessions IS 'User sessions with refresh tokens for JWT authentication';
COMMENT ON TABLE api_keys IS 'API keys for programmatic access';
COMMENT ON TABLE auth_audit_logs IS 'Audit trail for all authentication events';
COMMENT ON TABLE wallet_auth_challenges IS 'Challenges for wallet signature-based authentication';
