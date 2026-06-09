# Custodial Wallet System Architecture

## Overview

The DotMX custodial wallet system manages user deposit addresses, sweeps incoming funds to a multisig warm wallet, and processes withdrawals through an offline signing workflow.

## Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     SECURITY LAYERS                              │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: GCP KMS (Master Seed Encryption)                      │
│  Layer 2: HD Wallet Derivation (Per-user addresses)             │
│  Layer 3: Sweep to Multisig (Funds protected by M-of-N)         │
│  Layer 4: Offline Signing (Keys never touch internet)           │
│  Layer 5: Rate Limiting & Delays (Large withdrawal protection)  │
└─────────────────────────────────────────────────────────────────┘
```

## System Components

### 1. GCP KMS Service
- Encrypts master seed using envelope encryption
- Data Encryption Key (DEK) encrypted by KMS Key Encryption Key (KEK)
- Master seed NEVER stored unencrypted
- All KMS operations logged in Cloud Audit Logs

### 2. HD Wallet Service
- Generates unique deposit addresses per user per chain
- Uses BIP-44 derivation: `m/44'/{coin_type}'/0'/0/{user_index}`
- Public addresses derived without exposing private keys
- Private keys derived on-demand for sweeping only

### 3. Sweeper Service
- Monitors deposit addresses for incoming transactions
- Waits for sufficient confirmations (chain-specific)
- Creates and signs sweep transactions
- Transfers funds to multisig warm wallet
- Handles gas estimation and retry logic

### 4. Withdrawal Service
- Processes user withdrawal requests
- Creates unsigned multisig transactions
- Exports transactions for offline signing
- Broadcasts signed transactions
- Updates internal balances

## Architecture Diagram

```
                                    DEPOSIT FLOW
                                    ============
                                    
User External Wallet
        │
        ▼
┌───────────────────┐
│  User Deposit     │  ◄── Unique per user per chain
│  Address          │      Derived from HD wallet
│  (Watch-only)     │
└───────────────────┘
        │
        │ (Detected by Sweeper)
        ▼
┌───────────────────┐
│  Sweeper Service  │  ◄── Runs continuously
│                   │      Signs with derived key
│  - Detect deposit │      via KMS
│  - Wait confirms  │
│  - Create sweep tx│
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Multisig Warm    │  ◄── M-of-N signatures required
│  Wallet           │      Gnosis Safe / Custom multisig
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Database         │  ◄── user_balances updated
│  (Internal Ledger)│      deposit record created
└───────────────────┘


                                  WITHDRAWAL FLOW
                                  ===============
                                  
┌───────────────────┐
│  User Request     │  ◄── POST /api/withdrawals
│  Withdrawal       │      Amount, destination address
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Validation       │  ◄── Balance check
│  - Balance check  │      Address validation
│  - Rate limits    │      Withdrawal limits
│  - Address valid  │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Create Unsigned  │  ◄── withdrawal_requests table
│  Transaction      │      Status: pending_signature
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Export for       │  ◄── GET /api/admin/withdrawals/export
│  Offline Signing  │      JSON/CSV with unsigned tx data
└───────────────────┘
        │
        │ (Offline process - signers use hardware wallets)
        ▼
┌───────────────────┐
│  Import Signed    │  ◄── POST /api/admin/withdrawals/submit
│  Transaction      │      Signed tx from multisig
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Broadcast        │  ◄── Submit to blockchain
│  Transaction      │      Update status: completed
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Update Balances  │  ◄── Deduct from user_balances
│  & Records        │      Create withdrawal record
└───────────────────┘
```

## Database Schema

### Core Tables

```sql
-- User deposit addresses (one per user per chain)
CREATE TABLE deposit_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    chain_code VARCHAR(10) NOT NULL,          -- ETH, BTC, MATIC, etc.
    chain_id INTEGER,                          -- EVM chain ID
    address VARCHAR(255) NOT NULL,             -- Derived address
    derivation_index INTEGER NOT NULL,         -- HD wallet index
    derivation_path VARCHAR(255) NOT NULL,     -- Full BIP-44 path
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, chain_code),
    UNIQUE(address, chain_code)
);

-- Track all deposits
CREATE TABLE deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    deposit_address_id UUID REFERENCES deposit_addresses(id),
    chain_code VARCHAR(10) NOT NULL,
    token_address VARCHAR(255),                -- NULL for native token
    token_symbol VARCHAR(20) NOT NULL,
    amount DECIMAL(36, 18) NOT NULL,
    tx_hash VARCHAR(255) NOT NULL,
    block_number BIGINT NOT NULL,
    confirmations INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',      -- pending, confirmed, swept, failed
    sweep_tx_hash VARCHAR(255),
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    swept_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tx_hash, chain_code)
);

-- User balances (internal ledger)
CREATE TABLE user_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_symbol VARCHAR(20) NOT NULL,
    chain_code VARCHAR(10) NOT NULL,
    available_balance DECIMAL(36, 18) DEFAULT 0,
    locked_balance DECIMAL(36, 18) DEFAULT 0,  -- Pending withdrawals
    total_deposited DECIMAL(36, 18) DEFAULT 0,
    total_withdrawn DECIMAL(36, 18) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token_symbol, chain_code)
);

-- Withdrawal requests
CREATE TABLE withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    chain_code VARCHAR(10) NOT NULL,
    token_address VARCHAR(255),
    token_symbol VARCHAR(20) NOT NULL,
    amount DECIMAL(36, 18) NOT NULL,
    fee_amount DECIMAL(36, 18) DEFAULT 0,
    destination_address VARCHAR(255) NOT NULL,
    status VARCHAR(30) DEFAULT 'pending',      -- pending, pending_signature, signed, broadcasting, completed, failed, cancelled
    unsigned_tx TEXT,                          -- Serialized unsigned transaction
    signed_tx TEXT,                            -- Signed transaction (after offline signing)
    tx_hash VARCHAR(255),
    batch_id UUID,                             -- For batched withdrawals
    error_message TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    signed_at TIMESTAMPTZ,
    broadcast_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sweep transactions
CREATE TABLE sweep_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deposit_id UUID REFERENCES deposits(id),
    from_address VARCHAR(255) NOT NULL,
    to_address VARCHAR(255) NOT NULL,          -- Warm wallet
    chain_code VARCHAR(10) NOT NULL,
    token_address VARCHAR(255),
    token_symbol VARCHAR(20) NOT NULL,
    amount DECIMAL(36, 18) NOT NULL,
    gas_used DECIMAL(36, 18),
    gas_price DECIMAL(36, 18),
    tx_hash VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',      -- pending, submitted, confirmed, failed
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ
);

-- Warm wallet configuration
CREATE TABLE warm_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_code VARCHAR(10) NOT NULL,
    chain_id INTEGER,
    address VARCHAR(255) NOT NULL,
    wallet_type VARCHAR(20) NOT NULL,          -- gnosis_safe, custom_multisig
    required_signatures INTEGER NOT NULL,
    total_signers INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chain_code)
);

-- Balance audit log (for reconciliation)
CREATE TABLE balance_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    token_symbol VARCHAR(20) NOT NULL,
    chain_code VARCHAR(10) NOT NULL,
    operation VARCHAR(30) NOT NULL,            -- deposit, withdrawal, lock, unlock, fee, adjustment
    amount DECIMAL(36, 18) NOT NULL,
    balance_before DECIMAL(36, 18) NOT NULL,
    balance_after DECIMAL(36, 18) NOT NULL,
    reference_type VARCHAR(30),                -- deposit, withdrawal, trade, etc.
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Encrypted master seed storage
CREATE TABLE wallet_master_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_name VARCHAR(100) NOT NULL UNIQUE,     -- e.g., 'master_seed_v1'
    encrypted_dek BYTEA NOT NULL,              -- DEK encrypted by KMS KEK
    encrypted_seed BYTEA NOT NULL,             -- Seed encrypted by DEK
    kms_key_resource_name VARCHAR(500) NOT NULL, -- GCP KMS key path
    algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    rotated_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_deposit_addresses_user ON deposit_addresses(user_id);
CREATE INDEX idx_deposit_addresses_address ON deposit_addresses(address);
CREATE INDEX idx_deposits_user ON deposits(user_id);
CREATE INDEX idx_deposits_status ON deposits(status);
CREATE INDEX idx_deposits_tx_hash ON deposits(tx_hash);
CREATE INDEX idx_user_balances_user ON user_balances(user_id);
CREATE INDEX idx_withdrawal_requests_user ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX idx_sweep_transactions_status ON sweep_transactions(status);
CREATE INDEX idx_balance_audit_log_user ON balance_audit_log(user_id);
```

## GCP KMS Setup

### Key Hierarchy

```
GCP KMS Key Ring: dotmx-wallet-keys
├── Key: master-seed-kek (Key Encryption Key)
│   └── Purpose: Encrypt/decrypt DEK
│   └── Algorithm: GOOGLE_SYMMETRIC_ENCRYPTION
│   └── Protection: HSM
│
└── Key: operations-signing (Optional, for future use)
    └── Purpose: Sign operational messages
```

### Environment Variables

```env
# GCP KMS Configuration
GCP_PROJECT_ID=your-gcp-project-id
GCP_KMS_LOCATION=us-central1
GCP_KMS_KEY_RING=dotmx-wallet-keys
GCP_KMS_KEY_NAME=master-seed-kek

# Wallet Configuration
WARM_WALLET_ETH=0x... (Gnosis Safe address)
WARM_WALLET_MATIC=0x...

# Sweeper Configuration
SWEEPER_INTERVAL_MS=30000
SWEEPER_MIN_CONFIRMATIONS_ETH=12
SWEEPER_MIN_CONFIRMATIONS_MATIC=128

# Withdrawal Configuration
WITHDRAWAL_MIN_DELAY_SECONDS=0
WITHDRAWAL_LARGE_AMOUNT_THRESHOLD=10000
WITHDRAWAL_LARGE_AMOUNT_DELAY_HOURS=24
```

## Security Considerations

### 1. Master Seed Protection
- Encrypted with envelope encryption (DEK + KEK)
- DEK is AES-256-GCM encrypted
- KEK is managed by GCP Cloud HSM
- Seed decryption only happens in memory, wiped immediately

### 2. Access Control
- KMS access restricted to service accounts
- Separate service accounts for sweeper vs admin operations
- All KMS calls logged in Cloud Audit Logs
- IAM policies enforce least privilege

### 3. Withdrawal Security
- User balance locked when withdrawal requested
- Large withdrawals require additional delay
- All withdrawals require multisig approval
- Offline signing means keys never touch servers

### 4. Operational Security
- Regular balance reconciliation (blockchain vs database)
- Alerts for unusual activity patterns
- Rate limiting on all endpoints
- IP whitelisting for admin operations

## API Endpoints

### User Endpoints

```
POST   /api/wallet/deposit-address    Generate/get deposit address
GET    /api/wallet/balances           Get user balances
GET    /api/wallet/deposits           Get deposit history
POST   /api/wallet/withdraw           Request withdrawal
GET    /api/wallet/withdrawals        Get withdrawal history
```

### Admin Endpoints

```
GET    /api/admin/withdrawals/pending     List pending withdrawals
GET    /api/admin/withdrawals/export      Export unsigned transactions
POST   /api/admin/withdrawals/submit      Submit signed transactions
GET    /api/admin/sweeper/status          Sweeper health status
POST   /api/admin/sweeper/manual-sweep    Trigger manual sweep
GET    /api/admin/reconciliation          Run balance reconciliation
```

## Implementation Checklist

- [ ] GCP KMS Service (envelope encryption)
- [ ] HD Wallet Service (address derivation)
- [ ] Sweeper Service (deposit detection & sweeping)
- [ ] Withdrawal Service (request processing & export)
- [ ] API Routes (user & admin endpoints)
- [ ] Database migrations
- [ ] Integration with existing auth system
- [ ] Monitoring & alerting
- [ ] Admin dashboard (withdrawal approval)

## Chain Support

| Chain | Coin Type | Confirmations | Native Token |
|-------|-----------|---------------|--------------|
| ETH   | 60        | 12            | ETH          |
| MATIC | 966       | 128           | MATIC        |
| BSC   | 9006      | 15            | BNB          |
| ARB   | 60        | 12            | ETH          |
| OP    | 60        | 12            | ETH          |

## Multisig Workflow

### Gnosis Safe Integration

1. Create Gnosis Safe on each chain with M-of-N signers
2. Configure as warm wallet in `warm_wallets` table
3. Export unsigned transactions in Safe-compatible format
4. Signers use Safe app or CLI to sign
5. Import combined signatures and broadcast

### Export Format (for offline signing)

```json
{
  "batch_id": "uuid",
  "created_at": "2026-01-26T10:00:00Z",
  "chain_code": "ETH",
  "warm_wallet": "0x...",
  "transactions": [
    {
      "id": "uuid",
      "to": "0x...",
      "value": "1000000000000000000",
      "token": null,
      "data": "0x",
      "nonce": 42
    }
  ],
  "safe_tx_hash": "0x..."
}
```
