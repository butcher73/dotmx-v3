# Database Schema Migration Audit Report

## Schema Changes Reference

| Old | New |
|---|---|
| Table `chains` | Table `networks` |
| Table `tokens` | Table `assets` |
| Table `token_chains` | Table `asset_networks` |
| Table `supported_networks` | Table `networks` |
| Table `supported_assets` | Table `assets` |
| Table `supported_tokens` | _(removed / merged)_ |
| Table `user_deposit_addresses` | Table `deposit_addresses` |
| Column `chain_code` | Column `code` |
| Column `chain_name` | Column `name` |
| Column `rpc_endpoint` | Column `rpc_url` |
| Column `native_currency_symbol` | Column `native_symbol` |
| Column `native_currency_decimals` | Column `native_decimals` |
| Column `block_confirmation_count` | Column `min_confirmations` |
| Column `average_block_time` | Column `avg_block_time_seconds` |
| Column `token_type` | Column `asset_type` |
| Column `display_order` | Column `sort_order` |
| FK `token_id` (on join tables) | FK `asset_id` |
| FK `chain_id` (on join tables) | FK `network_id` |
| Column `confirmations_required` | Column `min_confirmations` |

---

## SEVERITY LEGEND

- 🔴 **CRITICAL** — SQL query will fail at runtime (wrong table name or column)
- 🟡 **WARNING** — FK column name mismatch (query may work if column still exists, but inconsistent)
- 🟢 **OK** — Already uses new schema names
- ⚪ **INFO** — Type definition or non-SQL reference (interface/config, not a direct query)

---

## 1. `packages/api/src/routes/assets.routes.ts` (1436 lines)

**STATUS: 🔴 CRITICAL — Most broken file. Mixes old AND new schema names.**

### Old Table References

| Line(s) | Old Reference | Should Be | Severity |
|---|---|---|---|
| ~182/226 | `FROM tokens t` | `FROM assets t` | 🔴 |
| ~265/530/704 | `FROM chains` | `FROM networks` | 🔴 |
| ~312/559/732 | `FROM token_chains tc` | `FROM asset_networks an` | 🔴 |
| ~338/507/682 | `FROM tokens WHERE ...` | `FROM assets WHERE ...` | 🔴 |
| ~405/457 | `FROM tokens t LEFT JOIN user_balances ub ON t.id = ub.token_id` | `FROM assets a LEFT JOIN user_balances ub ON a.id = ub.asset_id` | 🔴 |
| ~881 | `FROM supported_networks WHERE code = $1` | `FROM networks WHERE code = $1` | 🔴 |
| ~892 | `FROM supported_assets a JOIN asset_networks an` | `FROM assets a JOIN asset_networks an` | 🔴 (`supported_assets` → `assets`) |
| ~921 | `FROM supported_networks WHERE id = $1` | `FROM networks WHERE id = $1` | 🔴 |
| ~1289/1342 | `FROM user_deposit_addresses WHERE address = $1` | `FROM deposit_addresses WHERE address = $1` | 🔴 |
| ~1301/1308/1354 | `FROM supported_assets WHERE symbol = $1` | `FROM assets WHERE symbol = $1` | 🔴 |
| ~1305/1349 | `FROM supported_networks WHERE id = $1` | `FROM networks WHERE id = $1` | 🔴 |

### Old Column References

| Line(s) | Old Column | Should Be | Context |
|---|---|---|---|
| ~260 | `native_currency_symbol as native_symbol` | `native_symbol` (no alias needed) | SELECT from `chains` |
| ~261 | `native_currency_decimals as native_decimals` | `native_decimals` (no alias needed) | SELECT from `chains` |
| ~525/529/700/703 | `native_currency_symbol` | `native_symbol` | SELECT from `chains` |
| ~312/559 | `tc.chain_id`, `tc.token_id` | `an.network_id`, `an.asset_id` | JOINs on `token_chains` |
| ~405/457 | `ub.token_id` | `ub.asset_id` | JOIN `user_balances` |
| ~1349 | `confirmations_required` | `min_confirmations` | SELECT from `supported_networks` |
| ~182 | `LEFT JOIN token_chains tc ON t.id = tc.token_id LEFT JOIN chains c ON tc.chain_id = c.id` | `LEFT JOIN asset_networks an ON a.id = an.asset_id LEFT JOIN networks n ON an.network_id = n.id` | Full JOIN chain |

### Partially Correct (New Schema Used)

| Line(s) | Reference | Status |
|---|---|---|
| ~892 | `JOIN asset_networks an ON a.id = an.asset_id` | 🟢 Correct join table/FK |
| ~905 | `WHERE user_id = $1 AND asset_id = $2` | 🟢 Correct FK name |
| ~960 | `FROM asset_networks WHERE asset_id = $1 AND network_id = $2` | 🟢 Correct |

---

## 2. `packages/api/src/routes/wallet.routes.ts` (909 lines)

**STATUS: 🔴 CRITICAL**

| Line(s) | Old Reference | Should Be | Severity |
|---|---|---|---|
| ~220 | `LEFT JOIN chains c ON d.chain_id = c.id LEFT JOIN tokens t ON d.token_id = t.id` | `LEFT JOIN networks n ON d.network_id = n.id LEFT JOIN assets a ON d.asset_id = a.id` | 🔴 |
| ~433 | `FROM supported_tokens WHERE is_active = TRUE` | Table doesn't exist in new schema | 🔴 |
| ~440 | `user_balances` with `token_symbol, chain_code` columns | New schema uses `asset_id`, `network_id` FKs | 🔴 |
| ~455 | `FROM warm_wallets` with `chain_code` column | Needs `network_id` FK or verify column name | 🟡 |
| ~500 (shared) | `FROM supported_tokens WHERE is_active = TRUE ORDER BY chain_code, token_symbol` | Table doesn't exist | 🔴 |

---

## 3. `packages/api/src/routes/trading-advanced.routes.ts` (513 lines)

**STATUS: 🟡 WARNING**

| Line(s) | Old Reference | Should Be | Severity |
|---|---|---|---|
| ~120/130 | `FROM user_balances WHERE user_id = $1 AND asset = $2` | Column `asset` should be `asset_id` with FK reference | 🟡 |

---

## 4. `packages/api/src/routes/export.routes.ts` (484 lines)

**STATUS: 🟡 WARNING**

| Line(s) | Old Reference | Should Be | Severity |
|---|---|---|---|
| Various | `balance_transactions` with `asset` column | Verify column name matches new schema | 🟡 |

---

## 5. `packages/api/src/routes/positions.routes.ts`

**STATUS: 🟡 WARNING**

| Line(s) | Old Reference | Should Be | Severity |
|---|---|---|---|
| Various | `user_balances` with `asset` column | Should be `asset_id` FK | 🟡 |

---

## 6. `packages/api/src/routes/auth.routes.ts` (1134 lines)

**STATUS: 🟢 MOSTLY OK**

- Auth queries only touch `users`, `sessions`, `api_keys`, `user_2fa`, `wallet_auth_challenges`, `wallet_links`, `withdrawal_whitelist` tables
- `wallet_links` table has `chain_code` column — this is a wallet auth context (not the renamed network table column), but may need alignment
- `withdrawal_whitelist` has `chain` column — verify this exists

---

## 7. Other API Routes (OK)

- **`webhooks.routes.ts`** — Queries `webhook_logs`. 🟢 No chain/token issues.
- **`webhook-subscriptions.routes.ts`** — Queries `webhook_subscriptions`, `webhook_deliveries`. 🟢 No issues.
- **`marketdata.ts`** — Queries `orders`, `balance_transactions`. 🟢 No issues.
- **`perpetual-market.routes.ts`** — Queries `funding_rate_history`, `liquidation_history`, `positions`. 🟢 No issues.
- **`trading.ts`** — Queries `orders`, `balance_transactions`. 🟢 No issues.
- **`loyalty.routes.ts`** — No direct SQL. 🟢
- **`index.ts`** — Re-exports. 🟢

---

## 8. `packages/shared/src/services/alchemy-webhook.service.ts` (648 lines)

**STATUS: 🔴 CRITICAL**

| Line(s) | Old Reference | Should Be | Severity |
|---|---|---|---|
| ~204-207 | `SELECT id, min_confirmations, native_currency_symbol FROM chains WHERE code = $1` | `SELECT id, min_confirmations, native_symbol FROM networks WHERE code = $1` | 🔴 |
| ~215 | `FROM deposit_addresses WHERE ... AND chain_id = $2` | `AND network_id = $2` | 🔴 |
| ~247 | `chain.native_currency_symbol` | `chain.native_symbol` | 🔴 |
| ~256 | `FROM token_chains tc JOIN tokens t ON t.id = tc.token_id WHERE tc.chain_id = $1 AND tc.is_native = true` | `FROM asset_networks an JOIN assets a ON a.id = an.asset_id WHERE an.network_id = $1 AND an.is_native = true` | 🔴 |
| ~285 | `FROM token_chains tc JOIN tokens t ON t.id = tc.token_id WHERE LOWER(tc.contract_address) = LOWER($1) AND tc.chain_id = $2` | Same pattern → `asset_networks` / `assets` / `network_id` | 🔴 |
| ~350 | `INSERT INTO deposits (... chain_id, token_id ...)` | `... network_id, asset_id ...` | 🔴 |
| ~470 | `SELECT c.code as chain_code, da.address FROM deposit_addresses da JOIN chains c ON c.id = da.chain_id` | `JOIN networks n ON n.id = da.network_id` | 🔴 |

---

## 9. `packages/shared/src/services/hd-wallet.service.ts` (403 lines)

**STATUS: 🔴 CRITICAL**

| Line(s) | Old Reference | Should Be | Severity |
|---|---|---|---|
| ~87 | `SELECT id, code, chain_id FROM chains WHERE code = $1` | `FROM networks` | 🔴 |
| ~115 | `FROM deposit_addresses WHERE user_id = $1 AND chain_id = $2` | `AND network_id = $2` | 🔴 |
| ~140 | `INSERT INTO deposit_addresses (user_id, chain_id, ...)` | `network_id` | 🔴 |
| ~163/167/198/217 | `SELECT id FROM chains WHERE code = $1` | `FROM networks` | 🔴 |
| ~170 | `SELECT da.*, c.code as chain_code FROM deposit_addresses da JOIN chains c ON c.id = da.chain_id` | `JOIN networks n ON n.id = da.network_id` | 🔴 |

---

## 10. `packages/shared/src/services/sweeper.service.ts` (636 lines)

**STATUS: 🔴 CRITICAL**

| Line(s) | Old Reference | Should Be | Severity |
|---|---|---|---|
| ~245 | `SELECT id FROM chains WHERE code = $1` | `FROM networks` | 🔴 |
| ~257 | `SELECT tc.token_id FROM token_chains tc WHERE LOWER(tc.contract_address) = LOWER($1) AND tc.chain_id = $2` | `FROM asset_networks an WHERE ... AND an.network_id = $2` + `an.asset_id` | 🔴 |
| ~265 | `SELECT tc.token_id FROM token_chains tc WHERE tc.chain_id = $1 AND tc.is_native = true` | Same pattern | 🔴 |
| ~320 | `INSERT INTO deposits (... chain_id, token_id ...)` | `network_id, asset_id` | 🔴 |
| ~370 | `JOIN chains c ON d.chain_id = c.id JOIN tokens t ON d.token_id = t.id LEFT JOIN token_chains tc ON tc.token_id = d.token_id AND tc.chain_id = d.chain_id` | Full rewrite: `networks`, `assets`, `asset_networks` | 🔴 |
| ~425/435 | `INSERT INTO sweep_transactions (... chain_id, token_id ...)` | `network_id, asset_id` | 🔴 |
| ~485-510 | `user_balances WHERE user_id = $1 AND token_id = $2` | `AND asset_id = $2` | 🔴 |
| ~490 | `INSERT INTO user_balances (user_id, token_id, available_balance, total_deposited)` | `asset_id` | 🔴 |
| ~505 | `INSERT INTO balance_audit_log (user_id, token_id, ...)` | `asset_id` | 🔴 |
| ~530 | `SELECT w.* FROM warm_wallets w JOIN chains c ON w.chain_id = c.id WHERE c.code = $1` | `JOIN networks n ON w.network_id = n.id` | 🔴 |
| ~555 | Full query: `FROM token_chains tc JOIN tokens t ON t.id = tc.token_id JOIN chains c ON tc.chain_id = c.id WHERE c.code = $1` | `FROM asset_networks an JOIN assets a ON a.id = an.asset_id JOIN networks n ON an.network_id = n.id WHERE n.code = $1` | 🔴 |

---

## 11. `packages/shared/src/services/deposit-confirmation.service.ts` (328 lines)

**STATUS: 🔴 CRITICAL**

| Line(s) | Old Reference | Should Be | Severity |
|---|---|---|---|
| ~145 | `FROM deposits d LEFT JOIN chains c ON d.chain_id = c.id` | `LEFT JOIN networks n ON d.network_id = n.id` | 🔴 |
| ~260 | `SELECT available_balance FROM user_balances WHERE user_id = $1 AND token_id = $2` | `AND asset_id = $2` | 🔴 |
| ~270 | `INSERT INTO user_balances (user_id, token_id, ...)` | `asset_id` | 🔴 |
| ~285 | `INSERT INTO balance_audit_log (user_id, token_id, ...)` | `asset_id` | 🔴 |

---

## 12. `packages/shared/src/services/withdrawal.service.ts` (733 lines)

**STATUS: 🔴 CRITICAL**

| Line(s) | Old Reference | Should Be | Severity |
|---|---|---|---|
| ~210 | `INSERT INTO withdrawal_requests (user_id, chain_code, token_address, token_symbol, ...)` | Verify these are actual columns vs FK references | 🟡 |
| ~500 | `user_balances WHERE user_id = $1 AND token_symbol = $2 AND chain_code = $3` | New schema uses `asset_id` and `network_id` FKs | 🔴 |
| ~530/545 | `UPDATE user_balances SET locked_balance = ... WHERE user_id = $1 AND token_symbol = $2 AND chain_code = $3` | Same — needs `asset_id`/`network_id` | 🔴 |
| ~560 | `INSERT INTO balance_audit_log (user_id, token_symbol, chain_code, ...)` | Needs `asset_id`/`network_id` | 🔴 |
| ~681 | `SELECT * FROM supported_tokens WHERE chain_code = $1 AND token_symbol = $2 AND is_active = TRUE` | Table doesn't exist in new schema | 🔴 |
| ~695 | `SELECT * FROM warm_wallets WHERE chain_code = $1 AND is_active = TRUE` | Verify column name | 🟡 |

---

## 13. `packages/management/src/routes/chains.routes.ts` (entire file)

**STATUS: 🔴 CRITICAL — Every query references old `chains` table**

| Line(s) | Old Reference | Should Be | Severity |
|---|---|---|---|
| ~39 | `SELECT COUNT(*) as count FROM chains` | `FROM networks` | 🔴 |
| ~67 | `SELECT * FROM chains` | `FROM networks` | 🔴 |
| ~53-54 | Columns `native_currency_symbol`, `native_currency_decimals` | `native_symbol`, `native_decimals` | 🔴 |
| ~154 | `SELECT * FROM chains WHERE id = $1` | `FROM networks` | 🔴 |
| ~208 | `INSERT INTO chains (code, name, chain_id, ... native_currency_symbol, native_currency_decimals ...)` | `INSERT INTO networks (... native_symbol, native_decimals ...)` | 🔴 |
| ~296/300 | `UPDATE chains SET native_currency_symbol = ...` / `native_currency_decimals = ...` | `native_symbol` / `native_decimals` | 🔴 |
| ~386 | `DELETE FROM chains WHERE id = $1` | `FROM networks` | 🔴 |

**This entire file needs renaming: the route prefix is `/chains`, all SQL references `chains`, and all column names use old schema. Consider renaming the file to `networks.routes.ts` and updating the prefix to `/networks`.**

---

## 14. `packages/management/src/routes/tokens.routes.ts` (673 lines)

**STATUS: 🔴 CRITICAL — Every query references old `tokens` / `token_chains` tables**

| Line(s) | Old Reference | Should Be | Severity |
|---|---|---|---|
| ~33 | `SELECT COUNT(*) as count FROM tokens t` | `FROM assets a` | 🔴 |
| ~52 | `SELECT * FROM tokens t` | `FROM assets a` | 🔴 |
| ~101 | `FROM token_chains tc JOIN chains c ON tc.chain_id = c.id WHERE tc.token_id IN (...)` | `FROM asset_networks an JOIN networks n ON an.network_id = n.id WHERE an.asset_id IN (...)` | 🔴 |
| ~191 | `SELECT * FROM tokens WHERE id = $1` | `FROM assets` | 🔴 |
| ~235 | `FROM token_chains tc JOIN chains c ON tc.chain_id = c.id WHERE tc.token_id = $1` | Same pattern | 🔴 |
| ~335 | `INSERT INTO tokens (...)` | `INSERT INTO assets (...)` | 🔴 |
| ~345 | `INSERT INTO token_chains (token_id, chain_id, ...)` | `INSERT INTO asset_networks (asset_id, network_id, ...)` | 🔴 |
| ~458 | `DELETE FROM tokens WHERE id = $1` | `FROM assets` | 🔴 |
| ~480 | `INSERT INTO token_chains (token_id, chain_id, ...)` | `asset_networks (asset_id, network_id, ...)` | 🔴 |
| ~610 | `UPDATE token_chains SET ... WHERE token_id = $X AND chain_id = $Y` | `UPDATE asset_networks SET ... WHERE asset_id = $X AND network_id = $Y` | 🔴 |
| ~650 | `DELETE FROM token_chains WHERE token_id = $1 AND chain_id = $2` | `FROM asset_networks WHERE asset_id = $1 AND network_id = $2` | 🔴 |

**This entire file needs renaming: route prefix `/tokens`, all SQL, all column names. Consider renaming to `assets.routes.ts` with prefix `/assets`.**

---

## 15. `packages/management/src/routes/deposits-withdrawals.routes.ts` (837 lines)

**STATUS: 🟡 WARNING — Uses database views (which may hide the old schema)**

| Line(s) | Reference | Status | Notes |
|---|---|---|---|
| Various | `deposits_view`, `withdrawals_view`, `sweep_operations_view` | 🟡 | These are DB views; if the views are updated to match the new schema, these queries will work. But the **views themselves** likely reference old table names internally. |
| ~766 | `JOIN chains c ON d.chain_id = c.id` | 🔴 | Direct table reference in sweeper status query |
| ~633 | `withdrawal_requests` with `asset_id` | 🟢 | Uses new FK name |
| ~643 | `user_balances` with `asset_id` | 🟢 | Uses new FK name |

---

## 16. `packages/management/src/routes/transactions.routes.ts`

**STATUS: 🔴 CRITICAL**

| Line(s) | Old Reference | Should Be | Severity |
|---|---|---|---|
| ~65/90 | `LEFT JOIN supported_assets sa ON bt.asset_id = sa.id` | `LEFT JOIN assets sa ON bt.asset_id = sa.id` | 🔴 (`supported_assets` → `assets`) |
| ~170 | `LEFT JOIN supported_networks sn ON bt.network_id = sn.id` | `LEFT JOIN networks sn ON bt.network_id = sn.id` | 🔴 (`supported_networks` → `networks`) |

---

## 17. `packages/management/src/routes/users.routes.ts` (585 lines)

**STATUS: 🔴 CRITICAL**

| Line(s) | Old Reference | Should Be | Severity |
|---|---|---|---|
| ~196 | `LEFT JOIN tokens t ON t.id = ub.token_id` | `LEFT JOIN assets a ON a.id = ub.asset_id` | 🔴 |
| ~196 | `ub.token_id` column on `user_balances` | `ub.asset_id` | 🔴 |
| ~230 | `LEFT JOIN tokens t ON t.id = d.token_id` | `LEFT JOIN assets a ON a.id = d.asset_id` | 🔴 |
| ~230 | `d.token_id` on `deposits` | `d.asset_id` | 🔴 |
| ~252 | `LEFT JOIN tokens t ON t.id = w.token_id` on `withdrawals` | `LEFT JOIN assets a ON a.id = w.asset_id` | 🔴 |

---

## 18. `packages/management/src/routes/dashboard.routes.ts`

**STATUS: 🔴 CRITICAL — Uses non-existent table names**

| Line(s) | Old Reference | Should Be | Severity |
|---|---|---|---|
| ~31 | `FROM transactions WHERE type = 'trade'` | Table `transactions` doesn't exist — should be `balance_transactions` | 🔴 |
| ~39 | `FROM balances` | Table `balances` doesn't exist — should be `user_balances` | 🔴 |
| ~54 | `FROM transactions WHERE type = 'withdrawal'` | Same — `balance_transactions` or `withdrawal_requests` | 🔴 |
| ~101 | `FROM transactions WHERE type = 'trade'` | Same | 🔴 |
| ~153 | `FROM transactions t JOIN users u ON t.user_id = u.id` | Same | 🔴 |

---

## 19. Other Management Routes (OK or Minor)

- **`auth.routes.ts`** — Queries `users` only. 🟢
- **`kyc.routes.ts`** — Queries `kyc_applications`, `users`. 🟢
- **`settings.routes.ts`** — Queries `settings`. 🟢
- **`audit-log.routes.ts`** — Queries `audit_logs`, `users`. 🟢
- **`alerts.routes.ts`** — Queries `alert_configs`, `alert_history`. 🟢
- **`circuit-breaker.routes.ts`** — Queries `circuit_breaker_config`. 🟢
- **`metrics.routes.ts`** — Queries `trades`, `orders`, `positions`, `liquidation_history`. 🟢
- **`withdrawal-limits.routes.ts`** — Queries `withdrawal_limits`, `withdrawal_usage`, `users`. 🟢

---

## 20. `packages/shared/src/types/custodial-wallet.ts`

**STATUS: ⚪ INFO — Type definitions with old naming patterns**

| Reference | Description |
|---|---|
| `ChainConfig` interface with `chain_code`, `chain_id`, `confirmations_required` | In-memory config (not DB columns) but naming doesn't match new schema |
| `DepositAddress` interface with `chain_code`, `chain_id` | Should be `network_code`, `network_id` or at least `code` |
| `Deposit` interface with `chain_code`, `token_symbol`, `token_address` | DB column naming misalignment |
| `UserBalance` interface with `token_symbol`, `chain_code` | DB columns no longer match — new schema uses `asset_id`, `network_id` FKs |
| `CHAIN_CONFIGS` constant map | Uses `chain_code` keys — consider `network_code` |

---

## 21. Shared Services Without Issues

| File | Status |
|---|---|
| `auth.service.ts` | 🟢 Queries `users`, `sessions`, `password_reset_tokens`, etc. |
| `wallet-auth.service.ts` | 🟢 Queries `wallet_auth_challenges`, `wallet_links`, `users`, `auth_audit_logs` |
| `account-management.service.ts` | 🟢 User/account tables only |
| `account-security.service.ts` | 🟢 Queries `user_2fa`, `login_attempts`, `trusted_devices`, etc. |
| `email.service.ts` | 🟢 No DB queries |
| `gcp-kms.service.ts` | 🟢 Queries `wallet_master_keys` only |
| `loyalty.service.ts` | 🟢 Queries `loyalty_points`, `points_transactions`, etc. |
| `referral.service.ts` | 🟢 Queries `referral_codes`, `referrals`, etc. |
| `volume-sync.service.ts` | 🟢 Queries `trades`, `balance_snapshots`, `user_statistics` |
| `fee-calculation.service.ts` | 🟢 Queries `fee_tiers`, `trading_fees_collected`, `user_fee_tier` |
| `perpetual-fee.service.ts` | 🟢 In-memory tier configs, no DB queries |
| `vip-tier.service.ts` | 🟢 Queries `vip_volume_snapshots`, `user_vip_status`, `vip_tier_history` |
| `user-database.service.ts` | 🟢 Generic DB helper, no table-specific SQL |
| `database.ts` | 🟢 Pool wrapper only |

---

## Summary Statistics

| Category | Count |
|---|---|
| Files with 🔴 CRITICAL issues | **14** |
| Files with 🟡 WARNING issues | **4** |
| Files with 🟢 no issues | **~25** |
| Total broken SQL queries (approx) | **~90** |
| Total old table references (`chains`) | **~30** |
| Total old table references (`tokens`) | **~20** |
| Total old table references (`token_chains`) | **~15** |
| Total old table references (`supported_*`) | **~10** |
| Total old FK references (`token_id`→`asset_id`) | **~15** |
| Total old FK references (`chain_id`→`network_id`) | **~15** |
| Total old column references (`native_currency_*`) | **~10** |

---

## Priority Fix Order

1. **`packages/management/src/routes/chains.routes.ts`** — Rename to `networks.routes.ts`, change all SQL
2. **`packages/management/src/routes/tokens.routes.ts`** — Rename to `assets.routes.ts`, change all SQL
3. **`packages/api/src/routes/assets.routes.ts`** — Most complex; ~30+ broken references
4. **`packages/shared/src/services/sweeper.service.ts`** — ~15 broken references
5. **`packages/shared/src/services/alchemy-webhook.service.ts`** — ~10 broken references
6. **`packages/shared/src/services/hd-wallet.service.ts`** — ~8 broken references
7. **`packages/shared/src/services/withdrawal.service.ts`** — ~8 broken references
8. **`packages/shared/src/services/deposit-confirmation.service.ts`** — ~5 broken references
9. **`packages/api/src/routes/wallet.routes.ts`** — ~5 broken references
10. **`packages/management/src/routes/dashboard.routes.ts`** — Wrong table names entirely
11. **`packages/management/src/routes/users.routes.ts`** — ~5 broken references
12. **`packages/management/src/routes/transactions.routes.ts`** — 2 broken table names
13. **`packages/management/src/routes/deposits-withdrawals.routes.ts`** — DB views + 1 direct reference
14. **`packages/shared/src/types/custodial-wallet.ts`** — Type definitions needing alignment

---

## Database Views to Update

The management routes reference these views. If they exist as actual DB views, their internal definitions also need updating:

- `deposits_view` — Likely JOINs `chains`/`tokens` internally
- `withdrawals_view` — Likely JOINs `chains`/`tokens` internally
- `sweep_operations_view` — Likely JOINs `chains`/`tokens` internally

---

## Notes

- The `user_balances` table appears in two different schemas across the codebase:
  - **Old schema** (sweeper, withdrawal): `user_id + token_id` or `user_id + token_symbol + chain_code`
  - **New schema** (assets.routes.ts endpoints): `user_id + asset_id`
  - This inconsistency must be resolved to a single FK-based approach (`user_id + asset_id`)

- The `deposits` table FK columns are used as both `chain_id`/`token_id` (old) and need moving to `network_id`/`asset_id` (new)

- The `balance_audit_log` table appears with both `token_id` FK (old, in sweeper) and potentially `asset_id` — needs standardization

- The `warm_wallets` table is referenced with both `chain_id` FK (sweeper) and `chain_code` column (withdrawal) — needs standardization to `network_id`
