-- ============================================================================
-- DotMX Exchange — Complete Database Schema
-- ============================================================================
--
-- Version : 1.0.0
-- Updated : 2026-02-08
-- Database: dotmx (single database, split later if needed)
--
-- => This file is the SINGLE SOURCE OF TRUTH for the database.
-- => No migrations. Edit this file directly, then run reset.sh.
-- => When ready for production, freeze as v1 and start migrations from here.
--
-- TABLE OF CONTENTS
-- -----------------
--  §1  Extensions & Enums ............... Line ~30
--  §2  Users & Authentication ........... Line ~60
--  §3  KYC .............................. Line ~280
--  §4  Security ......................... Line ~370
--  §5  Networks & Assets ................ Line ~620
--  §6  Wallets & Deposit Addresses ...... Line ~750
--  §7  Balances & Ledger ................ Line ~850
--  §8  Deposits & Withdrawals ........... Line ~960
--  §9  Trading Engine ................... Line ~1200
--  §10 Perpetual Futures ................ Line ~1380
--  §11 Fee System ....................... Line ~1620
--  §12 Loyalty, Referrals & VIP ......... Line ~1870
--  §13 Webhooks & Notifications ......... Line ~2150
--  §14 Audit & Logging .................. Line ~2280
--  §15 Functions & Triggers ............. Line ~2360
--  §16 Views ............................ Line ~2500
--
-- CONVENTIONS
-- -----------
--  • All IDs are UUID (gen_random_uuid, native PG 13+)
--  • All timestamps are TIMESTAMPTZ DEFAULT NOW()
--  • All monetary amounts are DECIMAL(24, 8)
--  • snake_case for everything
--  • Soft-delete via deleted_at where applicable
--  • JSONB metadata column on core tables for flexibility
--
-- ============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- §1  EXTENSIONS & ENUMS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Account type enum
DO $$ BEGIN
  CREATE TYPE account_type AS ENUM (
    'retail', 'market_maker', 'liquidity_provider',
    'institutional', 'vip', 'affiliate', 'api_trader', 'demo'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- §2  USERS & AUTHENTICATION
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Users ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                 VARCHAR(255) UNIQUE,
    email_verified        BOOLEAN DEFAULT FALSE,
    password_hash         TEXT,                 -- bcrypt, nullable for wallet-only users
    first_name            VARCHAR(100),
    last_name             VARCHAR(100),
    username              VARCHAR(50) UNIQUE,
    avatar_url            TEXT,
    phone                 VARCHAR(50),

    -- Classification
    account_type          account_type DEFAULT 'retail',
    role                  VARCHAR(20) DEFAULT 'user'
                            CHECK (role IN ('user','admin','super_admin')),
    status                VARCHAR(20) DEFAULT 'active'
                            CHECK (status IN ('active','suspended','banned','deleted')),
    tier                  VARCHAR(20) DEFAULT 'bronze'
                            CHECK (tier IN ('bronze','silver','gold','platinum','diamond')),

    -- Feature flags
    is_market_maker       BOOLEAN DEFAULT FALSE,
    is_institutional      BOOLEAN DEFAULT FALSE,
    is_vip                BOOLEAN DEFAULT FALSE,
    is_affiliate          BOOLEAN DEFAULT FALSE,
    api_enabled           BOOLEAN DEFAULT FALSE,

    -- KYC
    kyc_verified          BOOLEAN DEFAULT FALSE,
    kyc_level             INTEGER DEFAULT 0,
    kyc_provider          VARCHAR(50),

    -- Security
    mfa_enabled           BOOLEAN DEFAULT FALSE,
    mfa_secret            TEXT,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until          TIMESTAMPTZ,
    last_login_at         TIMESTAMPTZ,
    last_login_ip         INET,

    -- Timestamps
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ,
    metadata              JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_username   ON users(username) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_status     ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role       ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ── Sessions (JWT refresh tokens) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token     TEXT NOT NULL UNIQUE,
    access_token_jti  TEXT,
    device_name       VARCHAR(255),
    device_fingerprint TEXT,
    ip_address        INET,
    user_agent        TEXT,
    expires_at        TIMESTAMPTZ NOT NULL,
    last_activity_at  TIMESTAMPTZ DEFAULT NOW(),
    revoked           BOOLEAN DEFAULT FALSE,
    revoked_at        TIMESTAMPTZ,
    revoked_reason    TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    metadata          JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id       ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token) WHERE revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at    ON sessions(expires_at);

-- ── Wallet Links (external wallets connected to accounts) ────────────────

CREATE TABLE IF NOT EXISTS wallet_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_address  VARCHAR(255) NOT NULL,
    chain_code      VARCHAR(20) NOT NULL,
    chain_id        INTEGER,
    wallet_type     VARCHAR(50) DEFAULT 'external',
    is_primary      BOOLEAN DEFAULT FALSE,
    verified        BOOLEAN DEFAULT FALSE,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    metadata        JSONB DEFAULT '{}',
    UNIQUE(wallet_address, chain_code)
);

CREATE INDEX IF NOT EXISTS idx_wallet_links_user_id ON wallet_links(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_links_address ON wallet_links(wallet_address);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_links_primary
    ON wallet_links(user_id) WHERE is_primary = TRUE;

-- ── Email Verification Tokens ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    email       VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN DEFAULT FALSE,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_tokens_token   ON email_verification_tokens(token) WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_email_tokens_user_id ON email_verification_tokens(user_id);

-- ── Password Reset Tokens ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           TEXT NOT NULL UNIQUE,
    token_hash      TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    used            BOOLEAN DEFAULT FALSE,
    used_at         TIMESTAMPTZ,
    ip_address      INET,
    attempt_count   INTEGER DEFAULT 0,
    max_attempts    INTEGER DEFAULT 3,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pw_reset_token   ON password_reset_tokens(token) WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_pw_reset_user_id ON password_reset_tokens(user_id);

-- ── Wallet Auth Challenges (sign-message login) ─────────────────────────

CREATE TABLE IF NOT EXISTS wallet_auth_challenges (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address    VARCHAR(255) NOT NULL,
    chain_code        VARCHAR(20) NOT NULL,
    challenge_message TEXT NOT NULL,
    nonce             VARCHAR(64) NOT NULL UNIQUE,
    expires_at        TIMESTAMPTZ NOT NULL,
    used              BOOLEAN DEFAULT FALSE,
    used_at           TIMESTAMPTZ,
    ip_address        INET,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_challenges_nonce ON wallet_auth_challenges(nonce) WHERE used = FALSE;

-- ── API Keys ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash             TEXT NOT NULL UNIQUE,
    key_prefix           VARCHAR(20) NOT NULL,
    name                 VARCHAR(100) NOT NULL,
    scopes               TEXT[] DEFAULT '{}',
    rate_limit_per_minute INTEGER DEFAULT 100,
    is_active            BOOLEAN DEFAULT TRUE,
    expires_at           TIMESTAMPTZ,
    last_used_at         TIMESTAMPTZ,
    last_used_ip         INET,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW(),
    metadata             JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id  ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix   ON api_keys(key_prefix);


-- ═══════════════════════════════════════════════════════════════════════════
-- §3  KYC
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kyc_applications (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level            INTEGER NOT NULL DEFAULT 1 CHECK (level IN (1,2,3)),
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','in_review','approved','rejected','expired')),

    -- Personal
    first_name       VARCHAR(100),
    last_name        VARCHAR(100),
    date_of_birth    DATE,
    nationality      VARCHAR(100),
    phone            VARCHAR(50),
    occupation       VARCHAR(100),
    source_of_funds  TEXT,

    -- Address
    country          VARCHAR(100),
    state_province   VARCHAR(100),
    city             VARCHAR(100),
    postal_code      VARCHAR(20),
    address_line1    VARCHAR(255),
    address_line2    VARCHAR(255),

    -- Review
    reviewed_by      UUID REFERENCES users(id),
    reviewed_at      TIMESTAMPTZ,
    rejection_reason TEXT,
    admin_notes      TEXT,
    risk_score       INTEGER,
    risk_level       VARCHAR(20) CHECK (risk_level IN ('low','medium','high','critical')),

    -- Data
    submitted_data   JSONB DEFAULT '{}',
    metadata         JSONB DEFAULT '{}',

    -- Timestamps
    submitted_at     TIMESTAMPTZ DEFAULT NOW(),
    approved_at      TIMESTAMPTZ,
    rejected_at      TIMESTAMPTZ,
    expires_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_apps_user_id ON kyc_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_apps_status  ON kyc_applications(status);

CREATE TABLE IF NOT EXISTS kyc_documents (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_id   UUID REFERENCES kyc_applications(id) ON DELETE CASCADE,
    document_type    VARCHAR(50) NOT NULL
                       CHECK (document_type IN ('id_card','passport','drivers_license','proof_of_address','selfie')),
    file_url         VARCHAR(500) NOT NULL,
    file_hash        VARCHAR(255),
    status           VARCHAR(20) DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','rejected')),
    rejection_reason TEXT,
    reviewed_by      UUID REFERENCES users(id),
    reviewed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_docs_user_id ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_docs_status  ON kyc_documents(status);


-- ═══════════════════════════════════════════════════════════════════════════
-- §4  SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Two-Factor Authentication ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_2fa (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    method                VARCHAR(20) NOT NULL CHECK (method IN ('totp','sms','email','authenticator')),
    enabled               BOOLEAN DEFAULT FALSE,
    totp_secret           TEXT,
    totp_backup_codes     TEXT[],
    totp_backup_codes_used INTEGER DEFAULT 0,
    phone_number          VARCHAR(20),
    phone_verified        BOOLEAN DEFAULT FALSE,
    last_used_at          TIMESTAMPTZ,
    total_uses            INTEGER DEFAULT 0,
    failed_attempts       INTEGER DEFAULT 0,
    setup_completed_at    TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Login Attempts ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS login_attempts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
    email             VARCHAR(255),
    attempt_type      VARCHAR(20) CHECK (attempt_type IN ('password','wallet','2fa','api_key')),
    success           BOOLEAN NOT NULL,
    failure_reason    VARCHAR(100),
    ip_address        VARCHAR(45) NOT NULL,
    user_agent        TEXT,
    device_fingerprint VARCHAR(255),
    country_code      VARCHAR(2),
    is_suspicious     BOOLEAN DEFAULT FALSE,
    risk_score        INTEGER DEFAULT 0,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id    ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip         ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at);

-- ── Trusted Devices ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trusted_devices (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(255) NOT NULL,
    device_name        VARCHAR(100),
    device_type        VARCHAR(20) CHECK (device_type IN ('desktop','mobile','tablet','unknown')),
    browser            VARCHAR(50),
    os                 VARCHAR(50),
    trusted            BOOLEAN DEFAULT FALSE,
    trust_expires_at   TIMESTAMPTZ,
    first_ip           VARCHAR(45),
    last_ip            VARCHAR(45),
    first_seen_at      TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at       TIMESTAMPTZ DEFAULT NOW(),
    login_count        INTEGER DEFAULT 1,
    revoked            BOOLEAN DEFAULT FALSE,
    revoked_at         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_fingerprint)
);

-- ── Account Lockout ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS account_lockout (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    is_locked             BOOLEAN DEFAULT FALSE,
    locked_at             TIMESTAMPTZ,
    locked_until          TIMESTAMPTZ,
    lock_reason           VARCHAR(100),
    failed_login_attempts INTEGER DEFAULT 0,
    failed_2fa_attempts   INTEGER DEFAULT 0,
    auto_unlock_enabled   BOOLEAN DEFAULT TRUE,
    unlock_after_minutes  INTEGER DEFAULT 30,
    total_lockouts        INTEGER DEFAULT 0,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── IP Access Control ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ip_access_control (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL = global
    ip_address      VARCHAR(45) NOT NULL,
    ip_range_cidr   VARCHAR(50),
    access_type     VARCHAR(20) NOT NULL CHECK (access_type IN ('whitelist','blacklist')),
    scope           VARCHAR(20) DEFAULT 'user' CHECK (scope IN ('user','global')),
    reason          VARCHAR(255),
    enabled         BOOLEAN DEFAULT TRUE,
    expires_at      TIMESTAMPTZ,
    hit_count       INTEGER DEFAULT 0,
    last_hit_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_access_ip   ON ip_access_control(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_access_type ON ip_access_control(access_type);

-- ── User Security Settings ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_security_settings (
    id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                      UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    require_2fa_for_login        BOOLEAN DEFAULT FALSE,
    require_2fa_for_withdrawal   BOOLEAN DEFAULT TRUE,
    require_2fa_for_api_key      BOOLEAN DEFAULT TRUE,
    session_timeout_minutes      INTEGER DEFAULT 60,
    max_concurrent_sessions      INTEGER DEFAULT 5,
    allow_password_login         BOOLEAN DEFAULT TRUE,
    allow_wallet_login           BOOLEAN DEFAULT TRUE,
    restrict_to_whitelisted_ips  BOOLEAN DEFAULT FALSE,
    notify_on_login              BOOLEAN DEFAULT TRUE,
    notify_on_new_device         BOOLEAN DEFAULT TRUE,
    notify_on_withdrawal         BOOLEAN DEFAULT TRUE,
    notify_on_password_change    BOOLEAN DEFAULT TRUE,
    notification_email           VARCHAR(255),
    created_at                   TIMESTAMPTZ DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Password History ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash   TEXT NOT NULL,
    changed_from_ip VARCHAR(45),
    change_reason   VARCHAR(50),
    strength_score  INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);

-- ── Security Activity Logs ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS security_activity_logs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type      VARCHAR(50) NOT NULL,
    activity_category  VARCHAR(20) CHECK (activity_category IN
                         ('authentication','account_change','security_setting','financial','access_control')),
    description        TEXT,
    severity           VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
    ip_address         VARCHAR(45),
    user_agent         TEXT,
    device_fingerprint VARCHAR(255),
    country_code       VARCHAR(2),
    old_value          TEXT,
    new_value          TEXT,
    risk_score         INTEGER DEFAULT 0,
    is_anomaly         BOOLEAN DEFAULT FALSE,
    metadata           JSONB DEFAULT '{}',
    created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sec_activity_user_id    ON security_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sec_activity_type       ON security_activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_sec_activity_created_at ON security_activity_logs(created_at);

-- ── Withdrawal Whitelist ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS withdrawal_whitelist (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label               VARCHAR(100) NOT NULL,
    address             VARCHAR(255) NOT NULL,
    chain               VARCHAR(20) NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE,
    verified_at         TIMESTAMPTZ,
    verification_method VARCHAR(50),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, address, chain)
);

CREATE INDEX IF NOT EXISTS idx_whitelist_user_id ON withdrawal_whitelist(user_id);

-- ── Security Alerts ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS security_alerts (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_type            VARCHAR(50) NOT NULL,
    severity              VARCHAR(20) NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    title                 VARCHAR(255) NOT NULL,
    message               TEXT NOT NULL,
    ip_address            VARCHAR(45),
    device_fingerprint    VARCHAR(255),
    status                VARCHAR(20) DEFAULT 'pending'
                            CHECK (status IN ('pending','acknowledged','resolved','dismissed')),
    acknowledged_at       TIMESTAMPTZ,
    resolved_at           TIMESTAMPTZ,
    requires_action       BOOLEAN DEFAULT FALSE,
    action_type           VARCHAR(50),
    notification_sent     BOOLEAN DEFAULT FALSE,
    notification_channels TEXT[],
    metadata              JSONB DEFAULT '{}',
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sec_alerts_user_id ON security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_sec_alerts_status  ON security_alerts(status);


-- ═══════════════════════════════════════════════════════════════════════════
-- §5  NETWORKS & ASSETS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Networks (blockchain networks) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS networks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                    VARCHAR(20) NOT NULL UNIQUE,   -- ETH, BSC, ARB, BASE, SOL, TRON
    name                    VARCHAR(100) NOT NULL,
    chain_type              VARCHAR(20) NOT NULL DEFAULT 'EVM', -- EVM, SOL, TRON, BTC, DOGE
    chain_id                INTEGER,                       -- EVM chain ID
    network_type            VARCHAR(20) DEFAULT 'mainnet'
                              CHECK (network_type IN ('mainnet','testnet')),
    rpc_url                 TEXT,
    explorer_url            TEXT,
    native_symbol           VARCHAR(10) NOT NULL,
    native_decimals         INTEGER NOT NULL DEFAULT 18,
    is_active               BOOLEAN DEFAULT TRUE,
    deposit_enabled         BOOLEAN DEFAULT TRUE,
    withdrawal_enabled      BOOLEAN DEFAULT TRUE,
    min_confirmations       INTEGER DEFAULT 12,
    avg_block_time_seconds  INTEGER DEFAULT 12,
    icon_url                VARCHAR(500),
    sort_order              INTEGER DEFAULT 0,
    metadata                JSONB DEFAULT '{}',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_networks_code   ON networks(code);
CREATE INDEX IF NOT EXISTS idx_networks_active ON networks(is_active);

-- ── Assets (tokens / coins) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assets (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol         VARCHAR(20) NOT NULL UNIQUE,
    name           VARCHAR(100) NOT NULL,
    asset_type     VARCHAR(20) DEFAULT 'erc20',  -- native, erc20, spl, trc20, brc20
    decimals       INTEGER NOT NULL DEFAULT 18,
    is_stablecoin  BOOLEAN DEFAULT FALSE,
    is_active      BOOLEAN DEFAULT TRUE,
    coingecko_id   VARCHAR(100),
    logo_url       VARCHAR(500),
    sort_order     INTEGER DEFAULT 0,
    metadata       JSONB DEFAULT '{}',
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_symbol ON assets(symbol);
CREATE INDEX IF NOT EXISTS idx_assets_active ON assets(is_active);

-- ── Asset–Network mappings (which tokens on which chains) ────────────────

CREATE TABLE IF NOT EXISTS asset_networks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id            UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    network_id          UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
    contract_address    VARCHAR(255),          -- NULL for native tokens
    decimals            INTEGER NOT NULL DEFAULT 18,
    is_native           BOOLEAN DEFAULT FALSE,
    is_active           BOOLEAN DEFAULT TRUE,
    deposit_enabled     BOOLEAN DEFAULT TRUE,
    withdrawal_enabled  BOOLEAN DEFAULT TRUE,
    min_deposit         DECIMAL(24,8) DEFAULT 0,
    max_deposit         DECIMAL(24,8),
    min_withdrawal      DECIMAL(24,8) DEFAULT 0,
    max_withdrawal      DECIMAL(24,8),
    withdrawal_fee      DECIMAL(24,8) DEFAULT 0,
    withdrawal_fee_type VARCHAR(20) DEFAULT 'fixed'
                          CHECK (withdrawal_fee_type IN ('fixed','percentage')),
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(asset_id, network_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_networks_asset   ON asset_networks(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_networks_network ON asset_networks(network_id);
CREATE INDEX IF NOT EXISTS idx_asset_networks_active  ON asset_networks(is_active);


-- ═══════════════════════════════════════════════════════════════════════════
-- §6  WALLETS & DEPOSIT ADDRESSES
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Encrypted HD Wallet Master Keys ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallet_master_keys (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name              VARCHAR(100) NOT NULL UNIQUE,
    encrypted_dek         BYTEA NOT NULL,
    encrypted_seed        BYTEA NOT NULL,
    kms_key_resource_name VARCHAR(500) NOT NULL,
    algorithm             VARCHAR(50) DEFAULT 'AES-256-GCM',
    version               INTEGER DEFAULT 1,
    is_active             BOOLEAN DEFAULT TRUE,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    rotated_at            TIMESTAMPTZ
);

-- ── HD Derivation Counters ───────────────────────────────────────────────
-- network_id can be NULL for global counter (used for EVM chains)
-- or specific network UUID for per-chain counters (future: non-EVM chains)
CREATE TABLE IF NOT EXISTS derivation_counters (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id    UUID REFERENCES networks(id),
    current_index INTEGER NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one global counter (NULL) + one counter per network
CREATE UNIQUE INDEX derivation_counters_network_unique 
    ON derivation_counters (network_id) 
    WHERE network_id IS NOT NULL;
CREATE UNIQUE INDEX derivation_counters_global_unique 
    ON derivation_counters ((network_id IS NULL)) 
    WHERE network_id IS NULL;

-- ── User Deposit Addresses ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deposit_addresses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    network_id       UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
    address          VARCHAR(255) NOT NULL,
    derivation_index INTEGER NOT NULL,
    derivation_path  VARCHAR(255),
    is_active        BOOLEAN DEFAULT TRUE,
    total_deposits   DECIMAL(24,8) DEFAULT 0,
    last_deposit_at  TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    metadata         JSONB DEFAULT '{}',
    UNIQUE(user_id, network_id),
    UNIQUE(address, network_id)
);

CREATE INDEX IF NOT EXISTS idx_deposit_addr_user_id ON deposit_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_addr_address ON deposit_addresses(address);

-- ── Warm / Hot Wallets ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS warm_wallets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id          UUID NOT NULL REFERENCES networks(id) UNIQUE,
    address             VARCHAR(255) NOT NULL,
    wallet_type         VARCHAR(20) NOT NULL
                          CHECK (wallet_type IN ('gnosis_safe','custom_multisig','eoa')),
    required_signatures INTEGER NOT NULL DEFAULT 1,
    total_signers       INTEGER NOT NULL DEFAULT 1,
    is_active           BOOLEAN DEFAULT TRUE,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════
-- §7  BALANCES & LEDGER
-- ═══════════════════════════════════════════════════════════════════════════

-- ── User Balances (source of truth for available funds) ──────────────────

CREATE TABLE IF NOT EXISTS user_balances (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id         UUID NOT NULL REFERENCES assets(id),
    available        DECIMAL(24,8) NOT NULL DEFAULT 0 CHECK (available >= 0),
    locked           DECIMAL(24,8) NOT NULL DEFAULT 0 CHECK (locked >= 0),
    pending          DECIMAL(24,8) NOT NULL DEFAULT 0 CHECK (pending >= 0),
    total_deposited  DECIMAL(24,8) NOT NULL DEFAULT 0,
    total_withdrawn  DECIMAL(24,8) NOT NULL DEFAULT 0,
    last_updated_at  TIMESTAMPTZ DEFAULT NOW(),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_user_balances_user_id  ON user_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_balances_asset_id ON user_balances(asset_id);

-- ── Balance Transactions (immutable ledger) ──────────────────────────────

CREATE TABLE IF NOT EXISTS balance_transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id                UUID NOT NULL REFERENCES assets(id),
    tx_type                 VARCHAR(30) NOT NULL
                              CHECK (tx_type IN (
                                'deposit','deposit_pending','withdrawal','withdrawal_pending',
                                'withdrawal_failed','trade_buy','trade_sell','fee',
                                'margin_lock','margin_unlock','pnl_realized','funding_fee',
                                'referral_bonus','bonus','adjustment'
                              )),
    amount                  DECIMAL(24,8) NOT NULL,       -- positive=credit, negative=debit
    fee                     DECIMAL(24,8) DEFAULT 0,
    balance_before          DECIMAL(24,8) NOT NULL,
    balance_after           DECIMAL(24,8) NOT NULL,

    -- On-chain details (optional)
    network_id              UUID REFERENCES networks(id),
    tx_hash                 VARCHAR(255),
    from_address            VARCHAR(255),
    to_address              VARCHAR(255),

    -- Internal references
    order_id                UUID,
    withdrawal_request_id   UUID,

    status                  VARCHAR(20) DEFAULT 'completed'
                              CHECK (status IN ('pending','confirming','completed','failed','cancelled')),
    description             TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at            TIMESTAMPTZ,
    metadata                JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_bal_tx_user_id    ON balance_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bal_tx_asset_id   ON balance_transactions(asset_id);
CREATE INDEX IF NOT EXISTS idx_bal_tx_type       ON balance_transactions(tx_type);
CREATE INDEX IF NOT EXISTS idx_bal_tx_tx_hash    ON balance_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_bal_tx_created_at ON balance_transactions(created_at);


-- ═══════════════════════════════════════════════════════════════════════════
-- §8  DEPOSITS & WITHDRAWALS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Deposits ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deposits (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deposit_address_id     UUID REFERENCES deposit_addresses(id),
    network_id             UUID NOT NULL REFERENCES networks(id),
    asset_id               UUID NOT NULL REFERENCES assets(id),
    amount                 DECIMAL(24,8) NOT NULL CHECK (amount > 0),
    tx_hash                VARCHAR(255) NOT NULL,
    from_address           VARCHAR(255),
    to_address             VARCHAR(255),
    block_number           BIGINT,
    confirmations          INTEGER DEFAULT 0,
    required_confirmations INTEGER DEFAULT 12,
    status                 VARCHAR(20) DEFAULT 'pending'
                             CHECK (status IN ('pending','confirming','confirmed','swept','failed')),
    sweep_operation_id     UUID,
    balance_transaction_id UUID,
    detected_at            TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at           TIMESTAMPTZ,
    credited_at            TIMESTAMPTZ,
    swept_at               TIMESTAMPTZ,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW(),
    metadata               JSONB DEFAULT '{}',
    UNIQUE(tx_hash, network_id)
);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id    ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status     ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_tx_hash    ON deposits(tx_hash);
CREATE INDEX IF NOT EXISTS idx_deposits_to_address ON deposits(to_address);
CREATE INDEX IF NOT EXISTS idx_deposits_network_id ON deposits(network_id);

-- ── Sweep Operations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sweep_operations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deposit_id      UUID REFERENCES deposits(id),
    from_address    VARCHAR(255) NOT NULL,
    to_address      VARCHAR(255) NOT NULL,
    network_id      UUID NOT NULL REFERENCES networks(id),
    asset_id        UUID NOT NULL REFERENCES assets(id),
    amount          DECIMAL(24,8) NOT NULL CHECK (amount > 0),
    tx_hash         VARCHAR(255),
    gas_tx_hash     VARCHAR(255),
    gas_used        DECIMAL(24,18),
    gas_price       DECIMAL(24,18),
    total_gas_cost  DECIMAL(24,18),
    status          VARCHAR(20) DEFAULT 'pending'
                      CHECK (status IN ('pending','gas_sent','broadcasting','confirming','completed','failed')),
    failure_reason  TEXT,
    retry_count     INTEGER DEFAULT 0,
    max_retries     INTEGER DEFAULT 3,
    next_retry_at   TIMESTAMPTZ,
    block_number    BIGINT,
    confirmations   INTEGER DEFAULT 0,
    scheduled_at    TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sweep_ops_status     ON sweep_operations(status);
CREATE INDEX IF NOT EXISTS idx_sweep_ops_network_id ON sweep_operations(network_id);

-- FK from deposits -> sweep_operations
DO $$ BEGIN
  ALTER TABLE deposits
    ADD CONSTRAINT fk_deposits_sweep_operation
    FOREIGN KEY (sweep_operation_id) REFERENCES sweep_operations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Sweeper Status (singleton) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sweeper_status (
    id                       INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    is_running               BOOLEAN DEFAULT FALSE,
    last_run_at              TIMESTAMPTZ,
    last_success_at          TIMESTAMPTZ,
    last_error               TEXT,
    last_error_at            TIMESTAMPTZ,
    total_swept_24h          DECIMAL(24,8) DEFAULT 0,
    operations_completed_24h INTEGER DEFAULT 0,
    operations_failed_24h    INTEGER DEFAULT 0,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO sweeper_status (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ── Withdrawal Requests ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    network_id         UUID NOT NULL REFERENCES networks(id),
    asset_id           UUID NOT NULL REFERENCES assets(id),
    amount             DECIMAL(24,8) NOT NULL CHECK (amount > 0),
    fee                DECIMAL(24,8) NOT NULL DEFAULT 0,
    net_amount         DECIMAL(24,8) GENERATED ALWAYS AS (amount - fee) STORED,
    to_address         VARCHAR(255) NOT NULL,
    status             VARCHAR(30) DEFAULT 'pending_approval'
                         CHECK (status IN (
                           'pending_approval','approved','processing','broadcasted',
                           'confirming','completed','failed','cancelled','rejected'
                         )),
    tx_hash            VARCHAR(255),
    confirmations      INTEGER DEFAULT 0,
    batch_id           UUID,
    error_message      TEXT,
    requires_2fa       BOOLEAN DEFAULT FALSE,
    is_2fa_verified    BOOLEAN DEFAULT FALSE,
    ip_address         INET,
    user_agent         TEXT,
    approved_at        TIMESTAMPTZ,
    approved_by        UUID REFERENCES users(id),
    broadcasted_at     TIMESTAMPTZ,
    completed_at       TIMESTAMPTZ,
    failed_at          TIMESTAMPTZ,
    failure_reason     TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW(),
    metadata           JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status  ON withdrawal_requests(status);

-- ── Withdrawal Batches ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS withdrawal_batches (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id        UUID NOT NULL REFERENCES networks(id),
    status            VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending','exported','signed','broadcast','completed','failed')),
    total_amount      DECIMAL(24,8) NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    unsigned_tx_data  JSONB,
    signed_tx_data    JSONB,
    tx_hash           VARCHAR(255),
    exported_at       TIMESTAMPTZ,
    signed_at         TIMESTAMPTZ,
    broadcast_at      TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Withdrawal Limits (per-tier defaults + per-user overrides) ───────────

CREATE TABLE IF NOT EXISTS withdrawal_limits (
    id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                             UUID UNIQUE,   -- NULL = tier default
    tier                                VARCHAR(32) NOT NULL DEFAULT 'default',
    daily_limit_usd                     DECIMAL(24,8) NOT NULL DEFAULT 100000,
    daily_withdrawal_count              INTEGER NOT NULL DEFAULT 50,
    monthly_limit_usd                   DECIMAL(24,8) NOT NULL DEFAULT 1000000,
    monthly_withdrawal_count            INTEGER NOT NULL DEFAULT 500,
    min_withdrawal_usd                  DECIMAL(24,8) NOT NULL DEFAULT 10,
    max_withdrawal_usd                  DECIMAL(24,8) NOT NULL DEFAULT 50000,
    large_withdrawal_threshold_usd      DECIMAL(24,8) NOT NULL DEFAULT 10000,
    large_withdrawal_delay_hours        INTEGER NOT NULL DEFAULT 24,
    requires_manual_approval_above_usd  DECIMAL(24,8) DEFAULT 50000,
    is_active                           BOOLEAN DEFAULT TRUE,
    created_at                          TIMESTAMPTZ DEFAULT NOW(),
    updated_at                          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawal_limits_tier_default
    ON withdrawal_limits(tier) WHERE user_id IS NULL;

-- ── Withdrawal Usage Tracking ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS withdrawal_usage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    withdrawal_id   UUID NOT NULL,
    amount_usd      DECIMAL(24,8) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_usage_user_time ON withdrawal_usage(user_id, created_at);

-- ── Blockchain Webhook Logs (Alchemy, etc.) ──────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source            VARCHAR(50) NOT NULL DEFAULT 'alchemy',
    webhook_id        VARCHAR(100),
    event_type        VARCHAR(50),
    network           VARCHAR(50),
    payload           JSONB NOT NULL,
    processing_result JSONB,
    status            VARCHAR(20) NOT NULL DEFAULT 'received'
                        CHECK (status IN ('received','processed','rejected','error','reprocessed')),
    error_message     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status     ON webhook_logs(status);


-- ═══════════════════════════════════════════════════════════════════════════
-- §9  TRADING ENGINE
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Trading Pairs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trading_pairs (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol                    VARCHAR(20) NOT NULL UNIQUE,      -- BTC/USDT
    base_currency             VARCHAR(10) NOT NULL,
    quote_currency            VARCHAR(10) NOT NULL,
    status                    VARCHAR(20) DEFAULT 'active'
                                CHECK (status IN ('active','inactive','maintenance','delisted')),
    min_order_size            DECIMAL(24,12) NOT NULL DEFAULT 0.00000001,
    max_order_size            DECIMAL(24,12),
    min_notional              DECIMAL(24,8) DEFAULT 10,
    tick_size                 DECIMAL(24,12) NOT NULL DEFAULT 0.01,
    lot_size                  DECIMAL(24,12) NOT NULL DEFAULT 0.00000001,
    maker_fee                 DECIMAL(8,4) NOT NULL DEFAULT 0.001,
    taker_fee                 DECIMAL(8,4) NOT NULL DEFAULT 0.002,
    last_price                DECIMAL(24,12) DEFAULT 0,
    price_change_24h          DECIMAL(10,4) DEFAULT 0,
    volume_24h                DECIMAL(24,8) DEFAULT 0,
    high_24h                  DECIMAL(24,12) DEFAULT 0,
    low_24h                   DECIMAL(24,12) DEFAULT 0,
    max_price_deviation       DECIMAL(8,4) DEFAULT 0.10,
    circuit_breaker_threshold DECIMAL(8,4) DEFAULT 0.20,
    display_order             INTEGER DEFAULT 0,
    icon_url                  VARCHAR(500),
    created_at                TIMESTAMPTZ DEFAULT NOW(),
    updated_at                TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(base_currency, quote_currency)
);

CREATE INDEX IF NOT EXISTS idx_trading_pairs_symbol ON trading_pairs(symbol);
CREATE INDEX IF NOT EXISTS idx_trading_pairs_status ON trading_pairs(status);

-- ── Orders (read model from matching engine) ─────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
    id                 VARCHAR(64) PRIMARY KEY,
    user_id            VARCHAR(64) NOT NULL,
    symbol             VARCHAR(32) NOT NULL,
    side               VARCHAR(4) NOT NULL,
    type               VARCHAR(10) NOT NULL,
    price              DECIMAL(24,8),
    quantity           DECIMAL(24,8) NOT NULL,
    quantity_remaining DECIMAL(24,8) NOT NULL,
    status             VARCHAR(20) NOT NULL,
    time_in_force      VARCHAR(3) DEFAULT 'GTC',
    client_order_id    VARCHAR(64),
    stop_price         DECIMAL(24,8),
    leverage           INTEGER DEFAULT 1,
    reduce_only        BOOLEAN DEFAULT FALSE,
    post_only          BOOLEAN DEFAULT FALSE,
    stp_mode           VARCHAR(16),
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_symbol  ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);

-- ── Trades (read model from matching engine) ─────────────────────────────

CREATE TABLE IF NOT EXISTS trades (
    id              VARCHAR(64) PRIMARY KEY,
    symbol          VARCHAR(32) NOT NULL,
    maker_order_id  VARCHAR(64) NOT NULL,
    taker_order_id  VARCHAR(64) NOT NULL,
    maker_user_id   VARCHAR(64),
    taker_user_id   VARCHAR(64),
    price           DECIMAL(24,8) NOT NULL,
    quantity        DECIMAL(24,8) NOT NULL,
    side            VARCHAR(4),
    maker_fee       DECIMAL(24,8) DEFAULT 0,
    taker_fee       DECIMAL(24,8) DEFAULT 0,
    is_liquidation  BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol     ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);
CREATE INDEX IF NOT EXISTS idx_trades_maker_user ON trades(maker_user_id);
CREATE INDEX IF NOT EXISTS idx_trades_taker_user ON trades(taker_user_id);

-- ── Engine Event Log (event sourcing) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
    id          VARCHAR(64) PRIMARY KEY,
    symbol      VARCHAR(32) NOT NULL,
    sequence_id BIGINT NOT NULL,
    kind        VARCHAR(32) NOT NULL,
    payload     JSONB NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_symbol_seq ON events(symbol, sequence_id);

-- ── Engine Balances (matching engine internal state) ─────────────────────

CREATE TABLE IF NOT EXISTS engine_balances (
    user_id    VARCHAR(64) NOT NULL,
    asset      VARCHAR(32) NOT NULL,
    available  DECIMAL(24,8) NOT NULL DEFAULT 0,
    locked     DECIMAL(24,8) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, asset)
);

-- ── Circuit Breaker Config ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS circuit_breaker_config (
    symbol               VARCHAR(32) PRIMARY KEY,
    enabled              BOOLEAN DEFAULT TRUE,
    price_threshold_pct  DECIMAL(6,4) DEFAULT 10.0,
    window_seconds       INTEGER DEFAULT 60,
    cooldown_seconds     INTEGER DEFAULT 300,
    last_triggered_at    TIMESTAMPTZ,
    is_halted            BOOLEAN DEFAULT FALSE,
    halted_at            TIMESTAMPTZ,
    halted_by            VARCHAR(64),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════
-- §9b  MARKET DATA (aggregated from external feeds)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Klines / Candlesticks (OHLCV) ───────────────────────────────────────
-- Stores historical candlestick data from external exchange feeds.
-- One row per symbol per interval per period. Upserted on each update.

CREATE TABLE IF NOT EXISTS market_klines (
    symbol      VARCHAR(32) NOT NULL,               -- BTCUSDT
    interval    VARCHAR(8)  NOT NULL,                -- 1m, 5m, 15m, 1H, 4H, 1D
    open_time   BIGINT      NOT NULL,                -- Unix ms when candle opened
    close_time  BIGINT      NOT NULL,                -- Unix ms when candle closes
    open        DECIMAL(24,12) NOT NULL,
    high        DECIMAL(24,12) NOT NULL,
    low         DECIMAL(24,12) NOT NULL,
    close       DECIMAL(24,12) NOT NULL,
    volume      DECIMAL(24,12) NOT NULL DEFAULT 0,
    trades      INTEGER        NOT NULL DEFAULT 0,
    source      VARCHAR(16) NOT NULL DEFAULT 'bitget', -- exchange source
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (symbol, interval, open_time)
);

-- Fast lookups: recent candles for a symbol+interval (chart queries)
CREATE INDEX IF NOT EXISTS idx_market_klines_lookup
    ON market_klines(symbol, interval, open_time DESC);

-- ── Market Trades (external exchange trades) ─────────────────────────────
-- Recent trades from external feeds. Kept for a rolling window (pruned).

CREATE TABLE IF NOT EXISTS market_trades (
    id          BIGSERIAL   PRIMARY KEY,
    symbol      VARCHAR(32) NOT NULL,
    trade_id    VARCHAR(64),                         -- exchange trade ID
    price       DECIMAL(24,12) NOT NULL,
    quantity    DECIMAL(24,12) NOT NULL,
    side        VARCHAR(4)  NOT NULL CHECK (side IN ('buy','sell')),
    source      VARCHAR(16) NOT NULL DEFAULT 'bitget',
    ts          BIGINT      NOT NULL,                -- exchange timestamp (ms)
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_trades_symbol_ts
    ON market_trades(symbol, ts DESC);

-- ── Ticker Snapshots (periodic 24h stats) ────────────────────────────────
-- Snapshots of 24h ticker data, taken periodically (e.g. every 10s).
-- Used for historical analysis and startup recovery.

CREATE TABLE IF NOT EXISTS market_ticker_snapshots (
    id              BIGSERIAL   PRIMARY KEY,
    symbol          VARCHAR(32) NOT NULL,
    last_price      DECIMAL(24,12) NOT NULL,
    mark_price      DECIMAL(24,12),
    index_price     DECIMAL(24,12),
    bid             DECIMAL(24,12),
    ask             DECIMAL(24,12),
    high_24h        DECIMAL(24,12),
    low_24h         DECIMAL(24,12),
    volume_24h      DECIMAL(24,12),
    volume_quote_24h DECIMAL(24,12),
    price_change_24h DECIMAL(24,12),
    price_change_pct_24h DECIMAL(10,4),
    funding_rate    DECIMAL(18,12),
    source          VARCHAR(16) NOT NULL DEFAULT 'bitget',
    ts              BIGINT      NOT NULL,            -- exchange timestamp
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_ticker_snapshots_symbol_ts
    ON market_ticker_snapshots(symbol, created_at DESC);

-- Prune old snapshots (keep last 24h by default, configurable)
-- Run: DELETE FROM market_ticker_snapshots WHERE created_at < NOW() - INTERVAL '24 hours';

-- Prune old trades (keep last 24h by default)
-- Run: DELETE FROM market_trades WHERE created_at < NOW() - INTERVAL '24 hours';


-- ═══════════════════════════════════════════════════════════════════════════
-- §10  PERPETUAL FUTURES
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Positions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS positions (
    id                  VARCHAR(64) DEFAULT gen_random_uuid()::text,
    user_id             VARCHAR(64) NOT NULL,
    symbol              VARCHAR(32) NOT NULL,
    side                VARCHAR(5) DEFAULT 'LONG',
    size                DECIMAL(24,8) NOT NULL DEFAULT 0,
    entry_price         DECIMAL(24,8) NOT NULL DEFAULT 0,
    margin              DECIMAL(24,8) NOT NULL DEFAULT 0,
    leverage            INTEGER DEFAULT 1,
    liquidation_price   DECIMAL(24,8) DEFAULT 0,
    unrealized_pnl      DECIMAL(24,8) DEFAULT 0,
    realized_pnl        DECIMAL(24,8) DEFAULT 0,
    funding_accumulated DECIMAL(24,8) DEFAULT 0,
    status              VARCHAR(16) DEFAULT 'open',
    opened_at           TIMESTAMPTZ DEFAULT NOW(),
    closed_at           TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_positions_status      ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_user_status  ON positions(user_id, status);

-- ── Position History (closed positions) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS position_history (
    id               VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id          VARCHAR(64) NOT NULL,
    symbol           VARCHAR(32) NOT NULL,
    side             VARCHAR(5) NOT NULL,
    size             DECIMAL(24,8) NOT NULL,
    entry_price      DECIMAL(24,8) NOT NULL,
    exit_price       DECIMAL(24,8) NOT NULL,
    leverage         INTEGER DEFAULT 1,
    realized_pnl     DECIMAL(24,8) NOT NULL DEFAULT 0,
    funding_paid     DECIMAL(24,8) NOT NULL DEFAULT 0,
    fees_paid        DECIMAL(24,8) NOT NULL DEFAULT 0,
    close_reason     VARCHAR(32) NOT NULL DEFAULT 'manual',
    margin_used      DECIMAL(24,8) NOT NULL DEFAULT 0,
    duration_seconds INTEGER,
    opened_at        TIMESTAMPTZ NOT NULL,
    closed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_history_user_id  ON position_history(user_id);
CREATE INDEX IF NOT EXISTS idx_pos_history_symbol   ON position_history(symbol);
CREATE INDEX IF NOT EXISTS idx_pos_history_closed   ON position_history(closed_at);

-- ── Funding Rate History ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS funding_rate_history (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol                 VARCHAR(32) NOT NULL,
    funding_rate           DECIMAL(12,10) NOT NULL,
    mark_price             DECIMAL(24,8) NOT NULL,
    index_price            DECIMAL(24,8) DEFAULT 0,
    long_open_interest     DECIMAL(24,8),
    short_open_interest    DECIMAL(24,8),
    total_open_interest    DECIMAL(24,8),
    skew                   DECIMAL(12,10),
    raw_funding_rate       DECIMAL(12,10),
    was_clamped            BOOLEAN DEFAULT FALSE,
    next_funding_time      TIMESTAMPTZ,
    funding_timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_funding_rate_unique
    ON funding_rate_history(symbol, funding_timestamp);
CREATE INDEX IF NOT EXISTS idx_funding_rate_symbol_time
    ON funding_rate_history(symbol, funding_timestamp DESC);

-- ── Funding Payments (per-user) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS funding_payments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           VARCHAR(64) NOT NULL,
    symbol            VARCHAR(32) NOT NULL,
    funding_rate_id   UUID REFERENCES funding_rate_history(id),
    position_side     VARCHAR(10) CHECK (position_side IN ('long','short')),
    position_size     DECIMAL(24,8) NOT NULL,
    position_notional DECIMAL(24,8),
    mark_price        DECIMAL(24,8) NOT NULL,
    funding_rate      DECIMAL(24,12) NOT NULL,
    payment           DECIMAL(24,8) NOT NULL,  -- positive=paid, negative=received
    payment_direction VARCHAR(10) CHECK (payment_direction IN ('paid','received')),
    funding_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funding_payments_user   ON funding_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_funding_payments_symbol ON funding_payments(symbol, funding_timestamp);

-- ── Liquidation Events ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS liquidation_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 VARCHAR(64) NOT NULL,
    symbol                  VARCHAR(32) NOT NULL,
    liquidation_type        VARCHAR(20) NOT NULL
                              CHECK (liquidation_type IN ('partial','full','bankruptcy')),
    position_side           VARCHAR(10) NOT NULL CHECK (position_side IN ('long','short')),
    original_size           DECIMAL(24,8) NOT NULL,
    liquidated_size         DECIMAL(24,8) NOT NULL,
    remaining_size          DECIMAL(24,8) NOT NULL,
    entry_price             DECIMAL(24,8) NOT NULL,
    mark_price              DECIMAL(24,8) NOT NULL,
    liquidation_price       DECIMAL(24,8) NOT NULL,
    bankruptcy_price        DECIMAL(24,8),
    execution_price         DECIMAL(24,8) NOT NULL,
    margin_balance          DECIMAL(24,8) NOT NULL,
    margin_ratio            DECIMAL(10,8) NOT NULL,
    unrealized_pnl          DECIMAL(24,8) NOT NULL,
    realized_pnl            DECIMAL(24,8) NOT NULL,
    liquidated_notional     DECIMAL(24,8) NOT NULL,
    penalty_amount          DECIMAL(24,8) NOT NULL,
    insurance_fund_contribution DECIMAL(24,8) NOT NULL,
    socialized_loss         DECIMAL(24,8) DEFAULT 0,
    execution_status        VARCHAR(20) DEFAULT 'pending'
                              CHECK (execution_status IN ('pending','executed','failed','cancelled')),
    triggered_at            TIMESTAMPTZ DEFAULT NOW(),
    executed_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_liq_events_user_id ON liquidation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_liq_events_symbol  ON liquidation_events(symbol);

-- ── Insurance Fund ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insurance_fund (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol                 VARCHAR(32) NOT NULL UNIQUE,
    balance                DECIMAL(24,8) NOT NULL DEFAULT 0,
    total_contributions    DECIMAL(24,8) NOT NULL DEFAULT 0,
    total_payouts          DECIMAL(24,8) NOT NULL DEFAULT 0,
    target_balance         DECIMAL(24,8),
    max_single_payout      DECIMAL(24,8),
    is_active              BOOLEAN DEFAULT TRUE,
    last_contribution_at   TIMESTAMPTZ,
    last_payout_at         TIMESTAMPTZ,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insurance_fund_transactions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol           VARCHAR(32) NOT NULL,
    transaction_type VARCHAR(30) NOT NULL
                       CHECK (transaction_type IN (
                         'liquidation_penalty','socialized_loss_payout',
                         'manual_contribution','manual_withdrawal','fee_contribution'
                       )),
    amount           DECIMAL(24,8) NOT NULL,
    balance_before   DECIMAL(24,8) NOT NULL,
    balance_after    DECIMAL(24,8) NOT NULL,
    liquidation_id   UUID REFERENCES liquidation_events(id),
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════
-- §11  FEE SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Global Fee Configuration ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fee_config (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key     VARCHAR(50) UNIQUE NOT NULL,
    config_value   DECIMAL(12,8) NOT NULL,
    description    TEXT,
    is_active      BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Spot Fee Tiers (Binance-style VIP) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS fee_tiers (
    tier_level                 INTEGER PRIMARY KEY CHECK (tier_level >= 0 AND tier_level <= 9),
    tier_name                  VARCHAR(50) NOT NULL,
    min_30d_volume_usd         DECIMAL(20,2) NOT NULL DEFAULT 0,
    min_dmx_holding            DECIMAL(24,8) NOT NULL DEFAULT 0,
    maker_fee_rate             DECIMAL(8,6) NOT NULL DEFAULT 0.001000,
    taker_fee_rate             DECIMAL(8,6) NOT NULL DEFAULT 0.001000,
    maker_fee_discount         DECIMAL(8,6) NOT NULL DEFAULT 0,
    taker_fee_discount         DECIMAL(8,6) NOT NULL DEFAULT 0,
    effective_maker_fee        DECIMAL(8,6) NOT NULL DEFAULT 0.001000,
    effective_taker_fee        DECIMAL(8,6) NOT NULL DEFAULT 0.001000,
    daily_withdrawal_limit_usd DECIMAL(20,2) NOT NULL DEFAULT 10000,
    withdrawal_fee_discount    DECIMAL(5,4) NOT NULL DEFAULT 0,
    max_leverage               INTEGER NOT NULL DEFAULT 20,
    api_rate_limit_multiplier  DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    badge_color                VARCHAR(20),
    badge_icon                 VARCHAR(50),
    description                TEXT,
    is_active                  BOOLEAN DEFAULT TRUE,
    created_at                 TIMESTAMPTZ DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- ── Perpetual Fee Tiers ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS perpetual_fee_tiers (
    tier_level                    INTEGER PRIMARY KEY CHECK (tier_level >= 0 AND tier_level <= 9),
    tier_name                     VARCHAR(50) NOT NULL,
    min_30d_volume_usd            DECIMAL(20,2) NOT NULL DEFAULT 0,
    min_dmx_holding               DECIMAL(24,8) NOT NULL DEFAULT 0,
    maker_fee_rate                DECIMAL(10,8) NOT NULL DEFAULT -0.000050,  -- negative = rebate
    taker_fee_rate                DECIMAL(10,8) NOT NULL DEFAULT 0.000350,
    maker_fee_adjustment          DECIMAL(10,8) NOT NULL DEFAULT 0,
    taker_fee_adjustment          DECIMAL(10,8) NOT NULL DEFAULT 0,
    effective_maker_fee           DECIMAL(10,8) NOT NULL DEFAULT -0.000050,
    effective_taker_fee           DECIMAL(10,8) NOT NULL DEFAULT 0.000350,
    funding_fee_discount          DECIMAL(5,4) NOT NULL DEFAULT 0,
    liquidation_penalty_discount  DECIMAL(5,4) NOT NULL DEFAULT 0,
    daily_withdrawal_limit_usd    DECIMAL(20,2) NOT NULL DEFAULT 10000,
    max_leverage                  INTEGER NOT NULL DEFAULT 20,
    api_rate_limit_multiplier     DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    priority_execution            BOOLEAN DEFAULT FALSE,
    badge_color                   VARCHAR(20),
    badge_icon                    VARCHAR(50),
    description                   TEXT,
    is_active                     BOOLEAN DEFAULT TRUE,
    created_at                    TIMESTAMPTZ DEFAULT NOW(),
    updated_at                    TIMESTAMPTZ DEFAULT NOW()
);

-- ── DMX Token Fee Discount ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dmx_fee_discount_config (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_percentage       DECIMAL(5,4) NOT NULL DEFAULT 0.2500,  -- 25%
    is_enabled                BOOLEAN DEFAULT TRUE,
    min_dmx_balance           DECIMAL(24,8) NOT NULL DEFAULT 0,
    auto_convert_enabled      BOOLEAN DEFAULT TRUE,
    max_discount_per_trade_usd DECIMAL(20,2),
    max_discount_per_day_usd  DECIMAL(20,2),
    applies_before_vip_discount BOOLEAN DEFAULT FALSE,
    stackable_with_vip        BOOLEAN DEFAULT TRUE,
    description               TEXT,
    effective_from            TIMESTAMPTZ DEFAULT NOW(),
    effective_until           TIMESTAMPTZ,
    created_at                TIMESTAMPTZ DEFAULT NOW(),
    updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ── User Spot Fee Status ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_fee_tier (
    user_id                        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_tier                   INTEGER NOT NULL DEFAULT 0 REFERENCES fee_tiers(tier_level),
    previous_tier                  INTEGER DEFAULT 0,
    volume_30d_usd                 DECIMAL(20,2) NOT NULL DEFAULT 0,
    current_dmx_balance            DECIMAL(24,8) NOT NULL DEFAULT 0,
    pay_fees_with_dmx              BOOLEAN DEFAULT FALSE,
    effective_maker_fee            DECIMAL(8,6) NOT NULL DEFAULT 0.001000,
    effective_taker_fee            DECIMAL(8,6) NOT NULL DEFAULT 0.001000,
    effective_maker_fee_with_dmx   DECIMAL(8,6),
    effective_taker_fee_with_dmx   DECIMAL(8,6),
    next_tier_level                INTEGER,
    next_tier_volume_needed        DECIMAL(20,2),
    tier_upgrade_eligible          BOOLEAN DEFAULT FALSE,
    last_tier_upgrade              TIMESTAMPTZ,
    last_tier_downgrade            TIMESTAMPTZ,
    tier_locked_until              TIMESTAMPTZ,
    total_fees_paid_usd            DECIMAL(24,8) DEFAULT 0,
    total_fees_paid_dmx            DECIMAL(24,8) DEFAULT 0,
    total_dmx_discount_received_usd DECIMAL(24,8) DEFAULT 0,
    total_vip_discount_received_usd DECIMAL(24,8) DEFAULT 0,
    lifetime_volume_usd            DECIMAL(24,2) DEFAULT 0,
    created_at                     TIMESTAMPTZ DEFAULT NOW(),
    updated_at                     TIMESTAMPTZ DEFAULT NOW()
);

-- ── User Perpetual Fee Status ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_perpetual_fee_status (
    user_id                         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_tier                    INTEGER NOT NULL DEFAULT 0 REFERENCES perpetual_fee_tiers(tier_level),
    previous_tier                   INTEGER DEFAULT 0,
    volume_30d_usd                  DECIMAL(20,2) NOT NULL DEFAULT 0,
    current_dmx_balance             DECIMAL(24,8) NOT NULL DEFAULT 0,
    pay_fees_with_dmx               BOOLEAN DEFAULT FALSE,
    effective_maker_fee             DECIMAL(10,8) NOT NULL DEFAULT -0.000050,
    effective_taker_fee             DECIMAL(10,8) NOT NULL DEFAULT 0.000350,
    effective_maker_fee_with_dmx    DECIMAL(10,8),
    effective_taker_fee_with_dmx    DECIMAL(10,8),
    funding_fee_discount            DECIMAL(5,4) DEFAULT 0,
    liquidation_penalty_discount    DECIMAL(5,4) DEFAULT 0,
    total_maker_rebates_usd         DECIMAL(24,8) DEFAULT 0,
    total_taker_fees_usd            DECIMAL(24,8) DEFAULT 0,
    total_funding_paid_usd          DECIMAL(24,8) DEFAULT 0,
    total_funding_received_usd      DECIMAL(24,8) DEFAULT 0,
    total_liquidation_penalties_usd DECIMAL(24,8) DEFAULT 0,
    created_at                      TIMESTAMPTZ DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Fee Tier Change History (audit) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS fee_tier_change_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fee_type        VARCHAR(10) NOT NULL DEFAULT 'spot'
                      CHECK (fee_type IN ('spot','perpetual')),
    from_tier       INTEGER NOT NULL,
    to_tier         INTEGER NOT NULL,
    change_type     VARCHAR(20) NOT NULL CHECK (change_type IN ('upgrade','downgrade','manual')),
    reason          VARCHAR(100) NOT NULL,
    volume_30d_usd  DECIMAL(20,2) NOT NULL,
    dmx_balance     DECIMAL(24,8) NOT NULL,
    old_maker_fee   DECIMAL(10,8),
    new_maker_fee   DECIMAL(10,8),
    old_taker_fee   DECIMAL(10,8),
    new_taker_fee   DECIMAL(10,8),
    changed_by      UUID REFERENCES users(id),
    admin_notes     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_history_user ON fee_tier_change_history(user_id, created_at DESC);

-- ── Trading Fees Collected ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trading_fees_collected (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id          UUID NOT NULL,
    order_id          UUID NOT NULL,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol            VARCHAR(20) NOT NULL,
    fee_type          VARCHAR(10) NOT NULL DEFAULT 'spot'
                        CHECK (fee_type IN ('spot','perpetual')),
    fee_tier_level    INTEGER NOT NULL,
    trade_side        VARCHAR(10) NOT NULL CHECK (trade_side IN ('maker','taker')),
    trade_price       DECIMAL(24,8) NOT NULL,
    trade_quantity    DECIMAL(24,8) NOT NULL,
    trade_value_usd   DECIMAL(24,8) NOT NULL,
    base_fee_rate     DECIMAL(10,8) NOT NULL,
    vip_fee_discount  DECIMAL(10,8) DEFAULT 0,
    dmx_fee_discount  DECIMAL(10,8) DEFAULT 0,
    effective_fee_rate DECIMAL(10,8) NOT NULL,
    fee_amount_usd    DECIMAL(24,8) NOT NULL,
    fee_currency      VARCHAR(10) NOT NULL DEFAULT 'USD',
    fee_paid_in_dmx   BOOLEAN DEFAULT FALSE,
    dmx_amount        DECIMAL(24,8),
    total_discount_usd DECIMAL(24,8) DEFAULT 0,
    settlement_status VARCHAR(20) DEFAULT 'pending'
                        CHECK (settlement_status IN ('pending','settled','refunded')),
    collected_at      TIMESTAMPTZ DEFAULT NOW(),
    settled_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fees_collected_user   ON trading_fees_collected(user_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_fees_collected_symbol ON trading_fees_collected(symbol, collected_at DESC);


-- ═══════════════════════════════════════════════════════════════════════════
-- §12  LOYALTY, REFERRALS & VIP
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Retail VIP Tiers ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS retail_vip_tiers (
    tier_level                  INTEGER PRIMARY KEY CHECK (tier_level >= 0 AND tier_level <= 9),
    tier_name                   VARCHAR(50) NOT NULL,
    min_30d_volume_usd          DECIMAL(20,2) NOT NULL DEFAULT 0,
    min_token_holding           DECIMAL(20,8) DEFAULT 0,
    maker_fee_discount          DECIMAL(5,4) NOT NULL DEFAULT 0,
    taker_fee_discount          DECIMAL(5,4) NOT NULL DEFAULT 0,
    daily_withdrawal_limit_usd  DECIMAL(20,2) NOT NULL,
    withdrawal_fee_discount     DECIMAL(5,4) DEFAULT 0,
    max_leverage                INTEGER DEFAULT 20,
    priority_customer_support   BOOLEAN DEFAULT FALSE,
    dedicated_account_manager   BOOLEAN DEFAULT FALSE,
    api_rate_limit_multiplier   DECIMAL(5,2) DEFAULT 1.0,
    loyalty_points_multiplier   DECIMAL(5,2) DEFAULT 1.0,
    otc_trading_access          BOOLEAN DEFAULT FALSE,
    exclusive_events_access     BOOLEAN DEFAULT FALSE,
    early_feature_access        BOOLEAN DEFAULT FALSE,
    badge_color                 VARCHAR(20),
    badge_icon                  VARCHAR(50),
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ── User VIP Status ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_vip_status (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    current_tier             INTEGER NOT NULL DEFAULT 0 REFERENCES retail_vip_tiers(tier_level),
    previous_tier            INTEGER DEFAULT 0,
    volume_30d_usd           DECIMAL(20,2) DEFAULT 0,
    current_token_holding    DECIMAL(20,8) DEFAULT 0,
    tier_upgrade_eligible    BOOLEAN DEFAULT FALSE,
    effective_maker_fee      DECIMAL(5,4),
    effective_taker_fee      DECIMAL(5,4),
    highest_tier_achieved    INTEGER DEFAULT 0,
    last_volume_calculation_at TIMESTAMPTZ DEFAULT NOW(),
    last_tier_check_at       TIMESTAMPTZ DEFAULT NOW(),
    tier_lock_until          TIMESTAMPTZ,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ── Loyalty Points ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_points (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance             BIGINT DEFAULT 0 CHECK (balance >= 0),
    lifetime_earned     BIGINT DEFAULT 0,
    lifetime_spent      BIGINT DEFAULT 0,
    tier                VARCHAR(20) DEFAULT 'bronze',
    multiplier          DECIMAL(5,2) DEFAULT 1.00,
    loyalty_program     VARCHAR(50) DEFAULT 'standard',
    last_tier_update    TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS points_transactions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         VARCHAR(50) NOT NULL
                   CHECK (type IN ('earn','spend','bonus','referral','admin_adjust')),
    amount       BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    source       VARCHAR(100),
    description  TEXT,
    metadata     JSONB DEFAULT '{}',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_tx_user_id ON points_transactions(user_id);

-- ── User Statistics ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_statistics (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_trades                BIGINT DEFAULT 0,
    total_volume_usd            DECIMAL(20,2) DEFAULT 0,
    total_pnl_usd               DECIMAL(20,2) DEFAULT 0,
    win_rate                    DECIMAL(5,2) DEFAULT 0,
    avg_trade_size_usd          DECIMAL(20,2) DEFAULT 0,
    consecutive_profit_days     INTEGER DEFAULT 0,
    max_consecutive_profit_days INTEGER DEFAULT 0,
    total_referrals             INTEGER DEFAULT 0,
    active_referrals            INTEGER DEFAULT 0,
    last_trade_at               TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ── User Trading Volume (daily snapshots) ────────────────────────────────

CREATE TABLE IF NOT EXISTS user_trading_volume (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date             DATE NOT NULL,
    total_volume_usd DECIMAL(20,2) DEFAULT 0,
    buy_volume_usd   DECIMAL(20,2) DEFAULT 0,
    sell_volume_usd  DECIMAL(20,2) DEFAULT 0,
    trade_count      INTEGER DEFAULT 0,
    symbols_traded   TEXT[] DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_trading_vol_user_date ON user_trading_volume(user_id, date);

-- ── Referral System ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referral_codes (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code                       VARCHAR(50) NOT NULL UNIQUE,
    current_uses               INTEGER DEFAULT 0,
    max_uses                   INTEGER,
    signup_reward_points       INTEGER DEFAULT 100,
    first_trade_reward_points  INTEGER DEFAULT 50,
    commission_percentage      DECIMAL(5,2) DEFAULT 10.00,
    referrer_reward_percentage DECIMAL(5,2) DEFAULT 10.00,
    referee_reward_percentage  DECIMAL(5,2) DEFAULT 5.00,
    is_active                  BOOLEAN DEFAULT TRUE,
    expires_at                 TIMESTAMPTZ,
    created_at                 TIMESTAMPTZ DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ DEFAULT NOW(),
    metadata                   JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code    ON referral_codes(code);

CREATE TABLE IF NOT EXISTS referrals (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referee_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    referral_code_id           UUID REFERENCES referral_codes(id) ON DELETE SET NULL,
    referral_code              VARCHAR(50) NOT NULL,
    status                     VARCHAR(20) DEFAULT 'pending'
                                 CHECK (status IN ('pending','active','completed','expired','invalid')),
    referred_at                TIMESTAMPTZ DEFAULT NOW(),
    first_trade_at             TIMESTAMPTZ,
    total_volume_usd           DECIMAL(20,2) DEFAULT 0,
    referrer_total_earned_points BIGINT DEFAULT 0,
    referee_total_earned_points  BIGINT DEFAULT 0,
    created_at                 TIMESTAMPTZ DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ DEFAULT NOW(),
    metadata                   JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status   ON referrals(status);

CREATE TABLE IF NOT EXISTS referral_rewards (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id        UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    recipient_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_type     VARCHAR(20) NOT NULL CHECK (recipient_type IN ('referrer','referee')),
    reward_type        VARCHAR(50) NOT NULL
                         CHECK (reward_type IN ('signup','first_trade','volume_milestone','monthly_commission')),
    points_amount      BIGINT NOT NULL,
    commission_percentage DECIMAL(5,2),
    volume_amount_usd  DECIMAL(20,2),
    description        TEXT,
    distributed_at     TIMESTAMPTZ DEFAULT NOW(),
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    metadata           JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_recipient ON referral_rewards(recipient_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- §13  WEBHOOKS & NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Webhook Subscriptions (outbound, user-facing) ────────────────────────

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL,
    url                TEXT NOT NULL,
    events             TEXT[] NOT NULL DEFAULT '{}',
    secret             VARCHAR(255) NOT NULL,
    is_active          BOOLEAN DEFAULT TRUE,
    failures           INTEGER DEFAULT 0,
    max_failures       INTEGER DEFAULT 10,
    last_success_at    TIMESTAMPTZ,
    last_failure_at    TIMESTAMPTZ,
    last_failure_reason TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    event_type      VARCHAR(64) NOT NULL,
    payload         JSONB NOT NULL,
    status          VARCHAR(16) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','success','failed','retrying')),
    response_status INTEGER,
    response_body   TEXT,
    response_time_ms INTEGER,
    attempt         INTEGER DEFAULT 1,
    max_attempts    INTEGER DEFAULT 5,
    next_retry_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    delivered_at    TIMESTAMPTZ
);

-- ── Alert Configuration ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alert_configs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(128) NOT NULL,
    description      TEXT,
    alert_type       VARCHAR(64) NOT NULL,
    condition        JSONB NOT NULL,
    channels         TEXT[] NOT NULL DEFAULT '{}',
    channel_config   JSONB DEFAULT '{}',
    is_enabled       BOOLEAN DEFAULT TRUE,
    severity         VARCHAR(16) NOT NULL DEFAULT 'warning'
                       CHECK (severity IN ('critical','warning','info')),
    cooldown_seconds INTEGER DEFAULT 300,
    last_triggered_at TIMESTAMPTZ,
    trigger_count    INTEGER DEFAULT 0,
    created_by       VARCHAR(64),
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_config_id UUID REFERENCES alert_configs(id) ON DELETE SET NULL,
    alert_type      VARCHAR(64) NOT NULL,
    severity        VARCHAR(16) NOT NULL,
    title           VARCHAR(256) NOT NULL,
    message         TEXT,
    data            JSONB,
    acknowledged    BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(64),
    acknowledged_at TIMESTAMPTZ,
    resolved        BOOLEAN DEFAULT FALSE,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_type    ON alert_history(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_history_created ON alert_history(created_at);


-- ═══════════════════════════════════════════════════════════════════════════
-- §14  AUDIT & LOGGING
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Auth Audit Logs ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auth_audit_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type     VARCHAR(50) NOT NULL,
    status         VARCHAR(20) NOT NULL,
    ip_address     INET,
    user_agent     TEXT,
    email          VARCHAR(255),
    wallet_address VARCHAR(255),
    failure_reason TEXT,
    metadata       JSONB DEFAULT '{}',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_user_id    ON auth_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_event_type ON auth_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_created_at ON auth_audit_logs(created_at);

-- ── General Audit Logs (admin actions) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    action        VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id   VARCHAR(100),
    old_value     JSONB,
    new_value     JSONB,
    ip_address    VARCHAR(45),
    user_agent    TEXT,
    metadata      JSONB DEFAULT '{}',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id  ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action   ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created  ON audit_logs(created_at);


-- ═══════════════════════════════════════════════════════════════════════════
-- §15  FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Generic updated_at trigger ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'updated_at'
          AND table_name NOT IN ('events','trades','balance_transactions','auth_audit_logs','audit_logs')
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I; '
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
            t, t, t, t
        );
    END LOOP;
END $$;

-- ── Auth helper functions ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_failed_login(p_user_id UUID)
RETURNS VOID AS $$
DECLARE v_count INTEGER;
BEGIN
    UPDATE users
    SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1
    WHERE id = p_user_id
    RETURNING failed_login_attempts INTO v_count;

    IF v_count >= 5 THEN
        UPDATE users SET locked_until = NOW() + INTERVAL '30 minutes'
        WHERE id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reset_failed_login(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE users
    SET failed_login_attempts = 0, locked_until = NULL
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ── Token cleanup ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS VOID AS $$
BEGIN
    DELETE FROM email_verification_tokens WHERE expires_at < NOW() AND used = FALSE;
    DELETE FROM password_reset_tokens WHERE expires_at < NOW() AND used = FALSE;
    DELETE FROM wallet_auth_challenges WHERE expires_at < NOW() AND used = FALSE;
    DELETE FROM sessions WHERE expires_at < NOW() OR revoked = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ── Balance operations ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_user_balance(
    p_user_id UUID,
    p_asset_id UUID,
    p_amount DECIMAL(24,8),
    p_tx_type VARCHAR(30),
    p_description TEXT DEFAULT NULL,
    p_tx_hash VARCHAR(255) DEFAULT NULL,
    p_network_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_before DECIMAL(24,8);
    v_after  DECIMAL(24,8);
    v_tx_id  UUID;
BEGIN
    INSERT INTO user_balances (user_id, asset_id) VALUES (p_user_id, p_asset_id)
    ON CONFLICT (user_id, asset_id) DO NOTHING;

    SELECT available INTO v_before FROM user_balances
    WHERE user_id = p_user_id AND asset_id = p_asset_id FOR UPDATE;

    v_after := v_before + p_amount;
    IF v_after < 0 THEN
        RAISE EXCEPTION 'Insufficient balance: % + % = %', v_before, p_amount, v_after;
    END IF;

    UPDATE user_balances SET
        available = v_after,
        last_updated_at = NOW(),
        total_deposited = CASE WHEN p_amount > 0 AND p_tx_type = 'deposit' THEN total_deposited + p_amount ELSE total_deposited END,
        total_withdrawn = CASE WHEN p_amount < 0 AND p_tx_type = 'withdrawal' THEN total_withdrawn + ABS(p_amount) ELSE total_withdrawn END
    WHERE user_id = p_user_id AND asset_id = p_asset_id;

    INSERT INTO balance_transactions (user_id, asset_id, tx_type, amount, balance_before, balance_after,
        tx_hash, network_id, description, status, metadata)
    VALUES (p_user_id, p_asset_id, p_tx_type, p_amount, v_before, v_after,
        p_tx_hash, p_network_id, p_description, 'completed', p_metadata)
    RETURNING id INTO v_tx_id;

    RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql;

-- ── Lock / Unlock balance ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION lock_user_balance(p_user_id UUID, p_asset_id UUID, p_amount DECIMAL(24,8))
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE user_balances SET available = available - p_amount, locked = locked + p_amount, last_updated_at = NOW()
    WHERE user_id = p_user_id AND asset_id = p_asset_id AND available >= p_amount;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION unlock_user_balance(p_user_id UUID, p_asset_id UUID, p_amount DECIMAL(24,8))
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE user_balances SET available = available + p_amount, locked = locked - p_amount, last_updated_at = NOW()
    WHERE user_id = p_user_id AND asset_id = p_asset_id AND locked >= p_amount;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ── Fee calculation ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION calculate_effective_fee(
    p_base_fee DECIMAL(8,6), p_vip_discount DECIMAL(8,6),
    p_dmx_discount_pct DECIMAL(5,4), p_apply_dmx BOOLEAN DEFAULT TRUE
) RETURNS DECIMAL(8,6) AS $$
DECLARE v_fee DECIMAL(8,6);
BEGIN
    v_fee := GREATEST(0, p_base_fee - p_vip_discount);
    IF p_apply_dmx THEN v_fee := v_fee * (1 - p_dmx_discount_pct); END IF;
    RETURN GREATEST(0, v_fee);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── Funding rate calculation ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION calculate_funding_rate(
    p_long_oi DECIMAL(24,8), p_short_oi DECIMAL(24,8),
    p_k DECIMAL(12,8) DEFAULT 0.00015,
    p_min DECIMAL(12,10) DEFAULT -0.00015, p_max DECIMAL(12,10) DEFAULT 0.00015
) RETURNS DECIMAL(12,10) AS $$
DECLARE v_total DECIMAL(24,8); v_skew DECIMAL(12,10);
BEGIN
    v_total := p_long_oi + p_short_oi;
    IF v_total = 0 THEN RETURN 0; END IF;
    v_skew := (p_long_oi - p_short_oi) / v_total;
    RETURN GREATEST(p_min, LEAST(p_max, p_k * TANH(v_skew * 10)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── Liquidation penalty ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION calculate_liquidation_penalty(
    p_notional DECIMAL(24,8), p_base_penalty DECIMAL(10,8) DEFAULT 0.004,
    p_tier_discount DECIMAL(5,4) DEFAULT 0
) RETURNS DECIMAL(24,8) AS $$
BEGIN
    RETURN p_notional * p_base_penalty * (1 - p_tier_discount);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── Initialize loyalty for new user ──────────────────────────────────────

CREATE OR REPLACE FUNCTION initialize_user_extras()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO loyalty_points (user_id, balance, tier, multiplier) VALUES (NEW.id, 0, 'bronze', 1.00);
    INSERT INTO user_statistics (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_initialize_user_extras ON users;
CREATE TRIGGER trg_initialize_user_extras
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION initialize_user_extras();


-- ═══════════════════════════════════════════════════════════════════════════
-- §16  VIEWS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Current funding rates ────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_current_funding_rates AS
SELECT DISTINCT ON (symbol)
    symbol, funding_rate, mark_price, index_price,
    long_open_interest, short_open_interest, skew,
    CASE WHEN funding_rate > 0 THEN 'longs_pay' ELSE 'shorts_pay' END AS direction,
    funding_timestamp, next_funding_time
FROM funding_rate_history
ORDER BY symbol, funding_timestamp DESC;

-- ── User fee summary ─────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_user_current_fees AS
SELECT
    uft.user_id, uft.current_tier, ft.tier_name,
    uft.volume_30d_usd, uft.current_dmx_balance, uft.pay_fees_with_dmx,
    uft.effective_maker_fee, uft.effective_taker_fee,
    uft.effective_maker_fee_with_dmx, uft.effective_taker_fee_with_dmx,
    uft.next_tier_level, uft.next_tier_volume_needed,
    uft.tier_upgrade_eligible, uft.total_fees_paid_usd,
    uft.updated_at
FROM user_fee_tier uft
JOIN fee_tiers ft ON uft.current_tier = ft.tier_level;

-- ── Deposits view with asset/network info ────────────────────────────────

CREATE OR REPLACE VIEW v_deposits AS
SELECT
    d.id, d.user_id, u.email AS user_email,
    a.symbol AS token_symbol, a.name AS token_name,
    n.code AS chain_code, n.name AS chain_name,
    d.tx_hash, d.from_address, d.to_address,
    d.amount, d.confirmations, d.required_confirmations, d.status,
    d.detected_at, d.confirmed_at, d.credited_at, d.swept_at,
    d.created_at
FROM deposits d
JOIN users u ON d.user_id = u.id
JOIN assets a ON d.asset_id = a.id
JOIN networks n ON d.network_id = n.id;

-- ── Withdrawals view with asset/network info ─────────────────────────────

CREATE OR REPLACE VIEW v_withdrawals AS
SELECT
    wr.id, wr.user_id, u.email AS user_email,
    a.symbol AS token_symbol, a.name AS token_name,
    n.code AS chain_code, n.name AS chain_name,
    wr.amount, wr.fee, wr.net_amount, wr.to_address,
    wr.status, wr.tx_hash, wr.confirmations,
    wr.approved_at, wr.broadcasted_at, wr.completed_at,
    wr.failure_reason, wr.created_at
FROM withdrawal_requests wr
JOIN users u ON wr.user_id = u.id
JOIN assets a ON wr.asset_id = a.id
JOIN networks n ON wr.network_id = n.id;


COMMIT;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
