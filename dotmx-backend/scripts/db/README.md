# DotMX Database

> **Single source of truth for the database schema.**  
> No migrations. Edit `schema.sql`, then run `reset.sh`.

## Quick Start

```bash
# Reset everything (drops all data!)
./reset.sh

# Schema only, no seed data
./reset.sh --schema-only

# Custom connection
DB_HOST=db.example.com DB_PORT=5432 DB_NAME=dotmx DB_USER=dotmx DB_PASSWORD=secret ./reset.sh

# Skip confirmation prompt (CI/scripts)
FORCE=true ./reset.sh
```

## File Structure

```
scripts/db/
├── schema.sql     ← THE schema (source of truth)
├── seed.sql       ← Reference data + test users
├── reset.sh       ← Drop & recreate the database
└── README.md      ← You are here
```

## How to Make Changes

1. Edit `schema.sql` directly
2. Run `./reset.sh` to apply
3. Commit the change

That's it. No migration files, no versioning, no runner. For a pre-launch dev database, this is the simplest and most reliable approach. When we launch to production, freeze the schema as v1 and start proper migrations from that baseline.

## Schema Sections

| § | Section | Key Tables |
|---|---------|------------|
| 1 | Extensions & Enums | `pgcrypto`, `account_type` enum |
| 2 | Users & Auth | `users`, `sessions`, `wallet_links`, `api_keys`, `email_verification_tokens`, `password_reset_tokens`, `wallet_auth_challenges` |
| 3 | KYC | `kyc_applications`, `kyc_documents` |
| 4 | Security | `user_2fa`, `login_attempts`, `trusted_devices`, `account_lockout`, `ip_access_control`, `user_security_settings`, `password_history`, `security_activity_logs`, `withdrawal_whitelist`, `security_alerts` |
| 5 | Networks & Assets | `networks`, `assets`, `asset_networks` |
| 6 | Wallets | `wallet_master_keys`, `derivation_counters`, `deposit_addresses`, `warm_wallets` |
| 7 | Balances & Ledger | `user_balances`, `balance_transactions` |
| 8 | Deposits & Withdrawals | `deposits`, `sweep_operations`, `sweeper_status`, `withdrawal_requests`, `withdrawal_batches`, `withdrawal_limits`, `withdrawal_usage`, `webhook_logs` |
| 9 | Trading Engine | `trading_pairs`, `orders`, `trades`, `events`, `engine_balances`, `circuit_breaker_config` |
| 10 | Perpetual Futures | `positions`, `position_history`, `funding_rate_history`, `funding_payments`, `liquidation_events`, `insurance_fund`, `insurance_fund_transactions` |
| 11 | Fee System | `fee_config`, `fee_tiers`, `perpetual_fee_tiers`, `dmx_fee_discount_config`, `user_fee_tier`, `user_perpetual_fee_status`, `fee_tier_change_history`, `trading_fees_collected` |
| 12 | Loyalty & VIP | `retail_vip_tiers`, `user_vip_status`, `loyalty_points`, `points_transactions`, `user_statistics`, `user_trading_volume`, `referral_codes`, `referrals`, `referral_rewards` |
| 13 | Webhooks & Alerts | `webhook_subscriptions`, `webhook_deliveries`, `alert_configs`, `alert_history` |
| 14 | Audit & Logging | `auth_audit_logs`, `audit_logs` |
| 15 | Functions & Triggers | `update_updated_at_column()`, `increment_failed_login()`, `cleanup_expired_tokens()`, `update_user_balance()`, `lock_user_balance()`, `unlock_user_balance()`, `calculate_effective_fee()`, `calculate_funding_rate()`, `calculate_liquidation_penalty()`, `initialize_user_extras()` |
| 16 | Views | `v_current_funding_rates`, `v_user_current_fees`, `v_deposits`, `v_withdrawals` |

## Conventions

- **IDs**: UUID everywhere (`gen_random_uuid()`, native PG 13+)
- **Timestamps**: `TIMESTAMPTZ DEFAULT NOW()`
- **Money**: `DECIMAL(24, 8)` for amounts
- **Naming**: `snake_case`, singular where possible
- **Soft delete**: `deleted_at TIMESTAMPTZ` where applicable
- **Flexibility**: `metadata JSONB DEFAULT '{}'` on core tables
- **Auto-updated**: `updated_at` auto-triggers on all applicable tables

## Seed Data

`seed.sql` includes:

| Data | Details |
|------|---------|
| Networks | 8 chains (ETH, BSC, ARB, OP, BASE, SOL, TRON, HYPE) |
| Assets | 12 tokens (BTC, ETH, USDT, USDC, DAI, BNB, SOL, ARB, OP, DMX, WBTC, WETH) |
| Asset–Network mappings | EVM chains with real contract addresses |
| Trading pairs | 12 pairs (BTC/USDT, ETH/USDT, etc.) |
| Spot fee tiers | 10 levels (VIP 0–9, Binance-style) |
| Perpetual fee tiers | 10 levels (maker rebate model) |
| DMX discount | 25% fee discount for DMX token holders |
| VIP tiers | 10 retail VIP levels |
| Withdrawal limits | Default tier limits |
| Insurance fund | 8 perpetual markets initialized |
| Test users | admin, alice, bob, carol (password: `TestPass123!`) |
| Test balances | Alice: 100k USDT, 2.5 BTC, 50 ETH, 10k DMX |

## Test Users

| Email | Role | KYC | Password |
|-------|------|-----|----------|
| admin@dotmx.com | super_admin | Level 3 | TestPass123! |
| alice@test.com | user | Level 2 | TestPass123! |
| bob@test.com | user | Level 1 | TestPass123! |
| carol@test.com | user | None | TestPass123! |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `dotmx` | Database name |
| `DB_USER` | `dotmx` | Database user |
| `DB_PASSWORD` | `dotmx_dev` | Database password |
| `FORCE` | - | Set to `true` to skip confirmation |
| `CI` | - | Set to `true` in CI environments |

## Migration Strategy (for production launch)

When ready to launch:

1. Freeze `schema.sql` as the v1 baseline
2. Create a `migrations/` directory
3. Use a proper migration tool (e.g., `dbmate`, `golang-migrate`, or custom)
4. Each migration is a numbered SQL file applied sequentially
5. Track applied migrations in a `schema_migrations` table

Until then: **edit schema.sql directly, run reset.sh**.
