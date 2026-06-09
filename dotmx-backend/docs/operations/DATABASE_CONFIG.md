# Environment Configuration Guide

## Database Connections

All database connection settings are centralized in `.env`. The project uses a **single user account (kowito)** for all database operations, and databases are **automatically created if they don't exist** on first connection.

### Database Configuration
```
USER: kowito (your PostgreSQL superuser)
PASSWORD: (empty for local development)
HOST: localhost
PORT: 5432
```

### Databases (auto-created)
1. **dotmx** - Main exchange database (orders, trades, orderbook)
2. **dotmx_users** - User service database (loyalty, accounts, referrals)
3. **dotmx_test** - Test exchange database
4. **dotmx_users_test** - Test user database

## Connection String Format

Primary exchange connection (used in `DATABASE_URL`):
```
postgresql://kowito@localhost:5432/dotmx
```

## Using the Configuration

### For Development
```bash
# Start PostgreSQL
brew services start postgresql@16

# Start your app (databases will be auto-created)
bun run dev
```

### For Testing
```bash
# Tests automatically use TEST_* prefixed variables from .env
# Test databases are auto-created on first test run
bun test
```

### For Production
Update credentials in your deployment environment:
- Set `DB_USER` to your production database user
- Set `DB_PASSWORD` to a secure password
- Set `DB_HOST` to your production database host

## Connection Variables in .env

### PostgreSQL Configuration
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_USER` - PostgreSQL user (default: kowito)
- `DB_PASSWORD` - PostgreSQL password (empty for local)

### Database Names
- `EXCHANGE_DB_NAME` - Main exchange database (default: dotmx)
- `USER_DB_NAME` - User service database (default: dotmx_users)
- `TEST_EXCHANGE_DB_NAME` - Test exchange database (default: dotmx_test)
- `TEST_USER_DB_NAME` - Test user database (default: dotmx_users_test)

### Connection Pool Sizes
- `EXCHANGE_DB_POOL_SIZE` - Exchange pool size (default: 50)
- `USER_DB_POOL_SIZE` - User service pool size (default: 20)

### Auto-Generated
- `DATABASE_URL` - Full connection string for main exchange

## Setup Instructions

1. **Ensure PostgreSQL is running:**
   ```bash
   brew services start postgresql@16
   ```

2. **Verify your user can connect:**
   ```bash
   psql -U kowito -d postgres -c "SELECT 1"
   ```

3. **Start the application:**
   ```bash
   bun run dev
   ```
   
   Databases will be automatically created on first connection.

## Benefits of This Approach

✅ **Simplified Configuration** - Single user account for all databases
✅ **Auto-Creation** - No manual database setup required
✅ **Consistent** - Same configuration across dev, test, and production
✅ **Secure** - No hardcoded passwords in scripts
✅ **Flexible** - Easy to switch between environments
   psql -U dotmx -d dotmx -c "SELECT 1"
   
   # User service database
   psql -U postgres -d dotmx_users -c "SELECT 1"
   ```

4. **Run tests:**
   ```bash
   bun test
   ```

## Security Notes

- Store `your_secure_password` in a secure location (pass manager, vault)
- Change `JWT_SECRET` in production
- Never commit actual passwords to git - use placeholder values
- For production: use separate credentials and connection pooling service
