# Database Schema Refactoring Tasks

## Overview
The database has duplicate/conflicting tables causing issues. This document tracks all refactoring tasks.

---

## AUDIT COMPLETE ✅

### Tables in `init-db.sql`:
- `orders` - Trading orders
- `trades` - Trade history  
- `balances` - Basic user balances
- `positions` - Perps positions
- `events` - Event log
- `symbols` - Trading pairs

### Tables in `001_custodial_wallet_system.sql`:
- `deposit_addresses` - User deposit addresses (chain_code, derivation_path)
- `deposits` - Deposit tracking
- `user_balances` - Detailed user balances
- `withdrawal_requests` - Withdrawal tracking
- `sweep_transactions` - Sweep tracking
- `warm_wallets` - Warm wallet config
- `balance_audit_log` - Audit trail
- `wallet_master_keys` - Encrypted seed storage
- `derivation_counters` - HD wallet index counter
- `supported_tokens` - ❌ DUPLICATE with tokens/token_chains
- `withdrawal_batches` - Batch withdrawals

### Tables in `002_chains_and_tokens_management.sql`:
- `chains` - Blockchain networks ✅ KEEP
- `tokens` - Token definitions ✅ KEEP
- `token_chains` - Token-chain mappings ✅ KEEP

### Tables in `003_deposit_addresses_table.sql`:
- `deposit_addresses` - ❌ DUPLICATE with 001!

---

## DUPLICATE TABLES

| Concept | Migration 001 | Migration 002/003 | Action |
|---------|--------------|-------------------|--------|
| Deposit addresses | deposit_addresses (chain_code) | deposit_addresses (chain_id UUID) | MERGE |
| Tokens | supported_tokens | tokens + token_chains | DELETE supported_tokens |
| Balances | balances + user_balances | - | KEEP user_balances only |

---

## Task 1: ✅ Audit Current Database Schema
- [x] List all tables in database
- [x] Identify duplicate/conflicting tables
- [x] Document which tables are actually used

## Task 2: ✅ Identify Duplicate Tables
- [x] `supported_tokens` duplicates `tokens + token_chains`
- [x] `deposit_addresses` defined in BOTH 001 AND 003
- [x] `balances` duplicates `user_balances`

## Task 3: ✅ Create Clean Unified Schema
- [x] Delete migration 003 (duplicate deposit_addresses)
- [x] Remove supported_tokens from 001 (use tokens+token_chains)
- [x] Fix deposit_addresses to reference chains(id) UUID
- [x] Create proper migration order: 001_users → 002_chains → 003_custodial

**Migration Files:**
- `001_users.sql` - Users, sessions, KYC, audit logs
- `002_chains_and_tokens_management.sql` - Chains, tokens, token_chains
- `003_custodial_wallet_system.sql` - Deposits, withdrawals, wallets

## Task 4: ✅ Fix Wallet Address Generation  
- [x] Use HDWalletService.getOrCreateDepositAddress() 
- [x] Updated HDWalletService to use chains table (chain_id UUID)
- [x] Updated assets.routes.ts to use hdWalletService when configured
- [x] Falls back to placeholder in dev mode (when GCP KMS not configured)

**Files Updated:**
- `packages/api/src/routes/assets.routes.ts` - Uses hdWalletService
- `packages/shared/src/services/hd-wallet.service.ts` - Uses chain_id UUID
- `apps/api-server-with-auth.ts` - Passes hdWalletService to routes

## Task 5: ✅ Create Seed Data Script
- [x] `reset-and-seed.sh` - Full database reset
- [x] `seed-data.sql` - Test users and initial data

## Task 6: [ ] Test Everything
- [ ] Run fresh migration
- [ ] Run seed data
- [ ] Test deposit page end-to-end

---