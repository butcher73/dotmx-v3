# Custodial Wallet Quick Start Guide

## Overview

This guide helps you set up the custodial wallet system for DotMX exchange.

## Prerequisites

1. GCP Project with billing enabled
2. PostgreSQL database
3. Node.js/Bun runtime

## Setup Steps

### 1. Set Up GCP KMS

```bash
# Set environment variables first
export GCP_PROJECT_ID=your-project-id
export GCP_KMS_LOCATION=us-central1
export GCP_KMS_KEY_RING=dotmx-wallet-keys
export GCP_KMS_KEY_NAME=master-seed-kek

# Run the setup script
chmod +x scripts/deploy/setup-gcp-kms.sh
./scripts/deploy/setup-gcp-kms.sh
```

### 2. Run Database Migration

```bash
psql $DATABASE_URL -f scripts/db/migrations/003_custodial_wallet_system.sql
```

### 3. Configure Environment

Add to your `.env`:

```env
# GCP KMS
GCP_PROJECT_ID=your-project-id
GCP_KMS_LOCATION=us-central1
GCP_KMS_KEY_RING=dotmx-wallet-keys
GCP_KMS_KEY_NAME=master-seed-kek

# Set path to service account key (local dev only)
GOOGLE_APPLICATION_CREDENTIALS=./secrets/gcp-service-account.json

# Blockchain RPC (use your own nodes for production)
ETH_RPC_URL=https://eth.llamarpc.com
MATIC_RPC_URL=https://polygon-rpc.com
```

### 4. Initialize HD Wallet

⚠️ **CRITICAL**: This generates the master seed. Back it up immediately!

```bash
bun run scripts/init-hd-wallet.ts
```

Save the mnemonic shown securely. It's the ONLY recovery method.

### 5. Configure Warm Wallets

Create your multisig wallets (e.g., Gnosis Safe) on each chain, then register them:

```bash
curl -X POST http://localhost:8080/api/admin/wallet/warm-wallets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "chain_code": "ETH",
    "chain_id": 1,
    "address": "0xYourGnosisSafeAddress",
    "wallet_type": "gnosis_safe",
    "required_signatures": 2,
    "total_signers": 3
  }'
```

### 6. Start Services

The wallet routes will be available at:
- `POST /api/wallet/deposit-address` - Get deposit address
- `GET /api/wallet/balances` - Get user balances
- `POST /api/wallet/withdraw` - Request withdrawal

Admin routes:
- `GET /api/admin/wallet/withdrawals/pending` - Pending withdrawals
- `POST /api/admin/wallet/withdrawals/batch` - Create batch
- `GET /api/admin/wallet/withdrawals/batch/:id/export` - Export for signing

## Withdrawal Process

### For Operators

1. **View Pending Withdrawals**
   ```bash
   curl http://localhost:8080/api/admin/wallet/withdrawals/pending \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

2. **Create Batch**
   ```bash
   curl -X POST http://localhost:8080/api/admin/wallet/withdrawals/batch \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"chain_code": "ETH"}'
   ```

3. **Export for Signing**
   ```bash
   curl http://localhost:8080/api/admin/wallet/withdrawals/batch/BATCH_ID/export \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -o withdrawal_batch.json
   ```

4. **Sign Offline** (using Gnosis Safe or hardware wallets)

5. **Submit Signed Transaction**
   ```bash
   curl -X POST http://localhost:8080/api/admin/wallet/withdrawals/batch/BATCH_ID/submit \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"signed_tx": "0x..."}'
   ```

## Security Checklist

- [ ] GCP KMS key uses HSM protection level
- [ ] Service account has minimal permissions (encrypt/decrypt only)
- [ ] Master seed mnemonic backed up securely offline
- [ ] Multisig requires 2+ signatures
- [ ] Warm wallet signers are geographically distributed
- [ ] Rate limiting enabled on API
- [ ] Audit logs are being collected
- [ ] Regular balance reconciliation scheduled

## Monitoring

Check system status:

```bash
curl http://localhost:8080/api/admin/wallet/status \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Troubleshooting

### KMS Permission Denied

Ensure the service account has the `cloudkms.cryptoKeyEncrypterDecrypter` role.

### Sweeper Not Detecting Deposits

1. Check RPC URL is valid
2. Verify deposit address is in `deposit_addresses` table
3. Check sweeper status: `GET /api/admin/wallet/sweeper/status`

### Withdrawal Stuck

1. Check batch status in `withdrawal_batches` table
2. Verify warm wallet has sufficient balance
3. Check gas price isn't too high

## Files Created

- [docs/architecture/Custodial-Wallet-System.md](../architecture/Custodial-Wallet-System.md) - Full architecture docs
[scripts/db/_archive/migrations/003_custodial_wallet_system.sql](../../scripts/db/_archive/migrations/003_custodial_wallet_system.sql) - Database schema
- [scripts/deploy/setup-gcp-kms.sh](../../scripts/deploy/setup-gcp-kms.sh) - GCP KMS setup
- [scripts/init-hd-wallet.ts](../../scripts/init-hd-wallet.ts) - HD wallet initialization
- `packages/shared/src/services/gcp-kms.service.ts` - KMS encryption
- `packages/shared/src/services/hd-wallet.service.ts` - Address derivation
- `packages/shared/src/services/sweeper.service.ts` - Deposit sweeping
- `packages/shared/src/services/withdrawal.service.ts` - Withdrawal management
- `packages/shared/src/routes/wallet.routes.ts` - API routes
- `packages/shared/src/types/custodial-wallet.ts` - Type definitions
