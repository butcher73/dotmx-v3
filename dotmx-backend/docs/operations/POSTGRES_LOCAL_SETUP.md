# Local PostgreSQL Setup for DotMX

## Prerequisites

You have PostgreSQL running locally with user `kowito`.

## Quick Setup

### 1. Start PostgreSQL
```bash
brew services start postgresql
```

### 2. Run the setup script
```bash
chmod +x scripts/setup-local-postgres.sh
./scripts/setup-local-postgres.sh
```

This creates:
- **dotmx** database (exchange, user: `dotmx`, password: `dotmx_dev`)
- **dotmx_users** database (user service, user: `postgres`)
- **dotmx_exchange** database (alt exchange, user: `postgres`)

### 3. Verify setup
```bash
psql -U kowito -d postgres -c "\\l"
```

You should see all three databases.

## Environment Files

Two local environment files are provided:

**`.env.local`** - Exchange/API server
```
DATABASE_URL=postgresql://dotmx:dotmx_dev@localhost:5432/dotmx
TEST_EXCHANGE_DB_USER=dotmx
TEST_EXCHANGE_DB_PASSWORD=dotmx_dev
```

**`.env.loyalty.local`** - Loyalty/user service
```
USER_DB_USER=postgres
EXCHANGE_DB_USER=dotmx
```

### Using the local env files

For development:
```bash
# Copy to .env and .env.loyalty
cp .env.local .env
cp .env.loyalty.local .env.loyalty

# Or set them when running
NODE_ENV=development bun run dev
```

## Manual Setup (if script fails)

Connect to PostgreSQL as your user:
```bash
psql -U kowito -d postgres
```

Then run:
```sql
-- Create dotmx user and database
CREATE USER dotmx WITH PASSWORD 'dotmx_dev';
CREATE DATABASE dotmx OWNER dotmx;
GRANT ALL PRIVILEGES ON DATABASE dotmx TO dotmx;

-- Verify
\l                  -- List databases
\du                 -- List users
```

## Running Tests

With `.env.local` configured:
```bash
bun test
```

The tests will connect using credentials from your `.env` file.

## Troubleshooting

### "role 'dotmx' does not exist"
Run the setup script: `./scripts/setup-local-postgres.sh`

### "could not connect to server"
PostgreSQL is not running:
```bash
brew services start postgresql
brew services list  # Verify it's running
```

### "password authentication failed"
Check credentials in your `.env` files match the database setup.

## Stopping PostgreSQL
```bash
brew services stop postgresql
```
