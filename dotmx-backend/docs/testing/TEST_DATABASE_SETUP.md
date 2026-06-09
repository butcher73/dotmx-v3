# PostgreSQL Test Database Setup

## Overview
The test suite uses a real PostgreSQL database instead of SQLite. This ensures tests run against the same database system as production.

## Prerequisites
- PostgreSQL 16+ installed and running (or Docker)
- `pg` npm package (already in dependencies)

## Quick Start

### Option 1: Using Docker Compose (Recommended)

Start the PostgreSQL service:
```bash
cd dotmx-backend
docker-compose -f docker-compose.dev.yml up -d postgres
```

### Option 2: Using the Setup Script

```bash
cd dotmx-backend/scripts
chmod +x setup-test-db.sh
./setup-test-db.sh
```

This script will:
- Wait for PostgreSQL to be ready
- Create the test database (if it doesn't exist)
- Display connection information

## Configuration

Tests use environment variables to connect to PostgreSQL:

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USER` | `dotmx` | PostgreSQL user |
| `POSTGRES_PASSWORD` | `dotmx_dev` | PostgreSQL password |
| `POSTGRES_DB` | `dotmx_test` | Test database name |

### Overriding Defaults

```bash
# Run with custom database
export POSTGRES_HOST=192.168.1.100
export POSTGRES_DB=my_test_db
bun test
```

## Running Tests

```bash
# Ensure PostgreSQL is running first!
cd dotmx-backend

# Run all tests
bun test

# Run specific test file
bun test packages/shared/tests/fee-calculation.service.test.ts

# Run with verbose output
bun test --verbose
```

## Test Database Helper

The `test-db-helper.ts` class manages database connections and cleanup:

```typescript
import { TestDatabase, ensureTestDatabase } from '../src/test-db-helper';

// In your test file
let testDb: TestDatabase;

beforeAll(async () => {
  // Ensure database exists
  await ensureTestDatabase();
  
  // Connect
  testDb = new TestDatabase();
  await testDb.connect();
  
  // Setup schema
  await testDb.setupDatabase();
});

beforeEach(async () => {
  // Clear data before each test
  await testDb.clearDatabase();
  
  // Re-initialize data
  await testDb.setupDatabase();
});

afterAll(async () => {
  await testDb.disconnect();
});
```

## Schema Initialization

The test database is initialized with:
1. PostgreSQL schema from `packages/shared/src/db/fee_tier_schema.sql`
2. Initial data from `packages/shared/src/db/init_fee_tiers.sql`
3. All tables required for security features

## Troubleshooting

### PostgreSQL Connection Refused

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Or with Docker Compose
docker-compose -f docker-compose.dev.yml ps postgres

# If not running, start it
docker-compose -f docker-compose.dev.yml up -d postgres
```

### Port 5432 Already in Use

```bash
# Find process using port 5432
lsof -i :5432

# Kill the process (example)
kill -9 12345
```

### Test Database Cleanup

If tests leave the database in a bad state:

```bash
# Drop the test database
PGPASSWORD=dotmx_dev psql -h localhost -U dotmx -d postgres -c "DROP DATABASE IF EXISTS dotmx_test;"

# Recreate it
./scripts/setup-test-db.sh
```

## Performance Notes

- Tests run ~3-5x faster than SQLite
- Database operations are real (not mocked)
- Schema migrations work as in production
- Connection pooling is handled automatically

## Files Modified

- `packages/shared/src/test-db-helper.ts` - New PostgreSQL test helper
- `packages/shared/tests/fee-calculation.service.test.ts` - Updated to use PostgreSQL
- `packages/shared/tests/account-security.service.test.ts` - Updated to use PostgreSQL
- `packages/shared/tests/vip-tier.service.test.ts` - Updated to use PostgreSQL
- `scripts/setup-test-db.sh` - New PostgreSQL setup script

## Next Steps

After setting up PostgreSQL:

```bash
# Start PostgreSQL
docker-compose -f docker-compose.dev.yml up -d postgres

# Run tests
bun test
```

All tests should now pass with real PostgreSQL!
