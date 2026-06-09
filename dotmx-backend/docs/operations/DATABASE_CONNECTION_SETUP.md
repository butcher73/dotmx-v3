# Database Connection Setup

## Testing Database Connections

Your project needs three database connections:

1. **Exchange Database** - `dotmx` (trading data)
2. **User Service Database** - `dotmx_users` (accounts, loyalty)
3. **Test Databases** - For running the test suite

## Quick Start Options

### Option 1: Using Docker (Recommended)

```bash
# Start services
docker-compose -f docker-compose.dev.yml up -d

# Setup will happen automatically
# PostgreSQL user: kowito (no password)
# Database ports: 5432 (PostgreSQL), 6379 (Redis), 4222 (NATS)
```

Then:
```bash
cp .env.local .env
bun test
```

### Option 2: Install PostgreSQL Locally

```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL
brew services start postgresql@15

# Run setup
./scripts/setup-local-postgres.sh

# Then test
cp .env.local .env
bun test
```

### Option 3: Skip Database Tests

If you don't have PostgreSQL available, most unit tests will pass. Only these will fail:
- `ReferralService` (needs user DB)
- `LoyaltyPointsService` (needs user DB)
- `VIPTierService` (needs exchange DB)
- `FeeCalculationService` (needs exchange DB)
- `AccountSecurityService` (needs exchange DB)

**Test the non-database tests:**
```bash
bun test packages/ledger packages/zk packages/tools packages/engine packages/gateway packages/persistence packages/marketdata packages/shared/tests/perpetual-fee.service.test.ts packages/shared/tests/vip-tier-helpers.test.ts
```

## Verify Connection (After Setup)

```bash
# Test exchange database
psql -U kowito -d dotmx -c "SELECT 1"

# Test user service database
psql -U kowito -d dotmx_users -c "SELECT 1"
```

## Environment Variables

Your `.env` file connects to:

```
DATABASE_URL=postgresql://kowito@localhost:5432/dotmx
EXCHANGE_DB_USER=kowito
EXCHANGE_DB_PASSWORD=
USER_DB_USER=kowito
USER_DB_PASSWORD=
```

All using the `kowito` PostgreSQL user with empty password (trust authentication).

## Troubleshooting

**"role 'kowito' does not exist"**
- Option 1: Install PostgreSQL (brew install postgresql@15)
- Option 2: Use Docker (docker-compose -f docker-compose.dev.yml up -d)

**"could not connect to server"**
- PostgreSQL is not running
- Try: `brew services start postgresql@15` or start Docker

**Tests still failing**
- You may only have the unit tests passing
- That's OK - 231 tests pass without a database

**Connection refused on port 5432**
- PostgreSQL isn't running on localhost
- Or you need to use the Docker setup
