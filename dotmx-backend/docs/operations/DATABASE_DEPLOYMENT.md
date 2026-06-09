# Database Deployment Guide

## Quick Start

Deploy all databases with seed data for production:

```bash
npm run deploy:db
```

Or for other environments:

```bash
npm run deploy:db:staging
npm run deploy:db:dev
```

---

## What Gets Deployed

### 1. User Database (`dotmx_users`)
- User authentication & management
- Account types (retail, market maker, institutional, VIP, etc.)
- Loyalty points & rewards
- Referral system
- VIP tier system
- 2FA & security features
- Wallet authentication

### 2. Perpetual Futures Fee System
- 10-tier VIP fee structure
- Transaction fees (maker rebates & taker fees)
- Funding rate configuration (8-hour intervals)
- Liquidation penalty settings (0.4%)
- Insurance fund configuration

### 3. Exchange Database (`dotmx`)
- Orders & trades
- Balances
- Positions (perpetual futures)
- Market data

---

## Prerequisites

1. **PostgreSQL 14+** must be running
2. **Database user** with CREATE DATABASE permissions
3. **Environment configuration** (see below)

---

## Environment Configuration

### Option 1: Environment-specific files (Recommended)

Create `.env.production`:

```bash
cp .env.production.example .env.production
```

Edit `.env.production`:

```env
DB_HOST=your-production-db-host
DB_PORT=5432
DB_USER=your-db-user
DB_PASSWORD=your-secure-password

USER_DB_NAME=dotmx_users
EXCHANGE_DB_NAME=dotmx

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
```

### Option 2: Use existing .env

The script will fall back to `.env` if no environment-specific file exists.

---

## Deployment Commands

### Production Deployment

```bash
npm run deploy:db
```

This will:
1. Prompt for confirmation (production safety check)
2. Create databases if they don't exist
3. Deploy all schemas
4. Seed VIP tiers (10 tiers)
5. Seed perpetual fee configurations
6. Verify deployment

### Staging Deployment

```bash
npm run deploy:db:staging
```

Uses `.env.staging` or `.env`

### Development Deployment

```bash
npm run deploy:db:dev
```

Uses `.env.development` or `.env`

---

## Manual Deployment

If you prefer manual control:

```bash
./scripts/deploy-db.sh production
./scripts/deploy-db.sh staging
./scripts/deploy-db.sh development
```

---

## What Data Gets Seeded

### VIP Tiers (10 tiers)

| Tier | Name | 30d Volume | DMX Holding | Maker Fee | Taker Fee |
|------|------|------------|-------------|-----------|-----------|
| 0 | Regular | $0 | 0 | -0.005% | 0.035% |
| 1 | Bronze | $50K | 500 | -0.007% | 0.032% |
| 2 | Silver | $250K | 2,500 | -0.009% | 0.030% |
| 3 | Gold | $1M | 10K | -0.011% | 0.028% |
| 4 | Platinum | $5M | 50K | -0.013% | 0.026% |
| 5 | Diamond | $20M | 200K | -0.015% | 0.025% |
| 6 | Elite | $50M | 500K | -0.017% | 0.023% |
| 7 | Master | $100M | 1M | -0.020% | 0.020% |
| 8 | Grandmaster | $500M | 5M | -0.022% | 0.018% |
| 9 | Legendary | $2B | 20M | -0.025% | 0.015% |

### Perpetual Fee Configuration

- **Maker Fee**: -0.005% (rebate)
- **Taker Fee**: 0.035%
- **Funding Interval**: 8 hours
- **Funding Rate Cap**: ±0.015%
- **Liquidation Penalty**: 0.4%
- **Insurance Fund**: 50% of liquidation penalty

---

## Verification

After deployment, verify:

```bash
# Check user database
psql -U your-user -d dotmx_users -c "SELECT COUNT(*) FROM vip_tiers;"

# Check perpetual fee tiers
psql -U your-user -d dotmx_users -c "SELECT tier_name, maker_fee_rate, taker_fee_rate FROM perpetual_fee_tiers ORDER BY tier_level;"

# Check fee configuration
psql -U your-user -d dotmx_users -c "SELECT config_key, config_value, description FROM perpetual_fee_config;"

# Check exchange database
psql -U your-user -d dotmx -c "\\dt"
```

---

## Idempotency

The deployment script is **idempotent** - you can run it multiple times safely:

- Uses `CREATE TABLE IF NOT EXISTS`
- Uses `INSERT ... ON CONFLICT DO UPDATE`
- Existing data is preserved
- Only missing structures are created

---

## Troubleshooting

### "Cannot connect to PostgreSQL"

```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql@16

# Start PostgreSQL (Linux)
sudo systemctl start postgresql
```

### "Permission denied"

Your database user needs:
- `CREATEDB` privilege for creating databases
- `USAGE` privilege on schemas
- `CREATE` privilege on databases

```sql
ALTER USER your_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE dotmx_users TO your_user;
GRANT ALL PRIVILEGES ON DATABASE dotmx TO your_user;
```

### "Schema deployment warnings"

This is normal when redeploying. The script handles conflicts gracefully.

---

## Database Migrations

For schema changes after initial deployment:

1. Create migration files in `packages/shared/src/db/migrations/`
2. Run migrations separately (to be implemented)

---

## Backup Before Production Deployment

**Always backup production databases before deployment:**

```bash
# Backup user database
pg_dump -U your-user -Fc dotmx_users > dotmx_users_backup_$(date +%Y%m%d_%H%M%S).dump

# Backup exchange database
pg_dump -U your-user -Fc dotmx > dotmx_backup_$(date +%Y%m%d_%H%M%S).dump
```

Restore if needed:

```bash
pg_restore -U your-user -d dotmx_users dotmx_users_backup_20260123_120000.dump
```

---

## Next Steps After Deployment

1. **Verify connections** in your application
2. **Start services**:
   ```bash
   npm run dev:all
   ```
3. **Monitor logs** for database connection issues
4. **Run health checks** on your endpoints

---

## Support

If you encounter issues:

1. Check logs: `tail -f logs/database.log`
2. Verify environment variables: `printenv | grep DB_`
3. Test connection manually: `psql -U user -h host -d database`
4. Review [DATABASE_CONFIG.md](DATABASE_CONFIG.md) for detailed configuration

---

**Last Updated**: January 23, 2026
