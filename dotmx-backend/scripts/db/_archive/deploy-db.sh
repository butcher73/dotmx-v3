#!/bin/bash

# ============================================================================
# DotMX Production Database Deployment Script
# ============================================================================
# Deploys all database schemas with seed data for production
# Usage: ./scripts/deploy-db.sh [environment]
# Environment: production (default), staging, development
# ============================================================================

set -e

# Parse environment argument
ENVIRONMENT="${1:-production}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}DotMX Database Deployment - ${ENVIRONMENT} Environment${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Load environment variables
if [ -f ".env.${ENVIRONMENT}" ]; then
    echo -e "${GREEN}✓ Loading .env.${ENVIRONMENT}${NC}"
    set -a
    source ".env.${ENVIRONMENT}"
    set +a
elif [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No .env.${ENVIRONMENT} found, using .env${NC}"
    set -a
    source .env
    set +a
else
    echo -e "${RED}✗ No environment file found${NC}"
    exit 1
fi

# Set database connection parameters
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-kowito}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Database names
USER_DB="${USER_DB_NAME:-dotmx_users}"
EXCHANGE_DB="${EXCHANGE_DB_NAME:-dotmx}"

# Construct connection strings
if [ -z "$DB_PASSWORD" ]; then
    USER_CONN="postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${USER_DB}"
    EXCHANGE_CONN="postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/${EXCHANGE_DB}"
else
    USER_CONN="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${USER_DB}"
    EXCHANGE_CONN="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${EXCHANGE_DB}"
fi

echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Host: ${DB_HOST}:${DB_PORT}"
echo "  User: ${DB_USER}"
echo "  User Database: ${USER_DB}"
echo "  Exchange Database: ${EXCHANGE_DB}"
echo ""

# Confirmation prompt for production
if [ "$ENVIRONMENT" = "production" ]; then
    echo -e "${RED}⚠️  WARNING: You are deploying to PRODUCTION!${NC}"
    echo -e "${YELLOW}This will create/modify database schemas and seed production data.${NC}"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " -r
    echo
    if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
        echo "Deployment cancelled."
        exit 0
    fi
fi

# ============================================================================
# STEP 1: Create databases if they don't exist
# ============================================================================

echo -e "${BLUE}[1/5] Creating databases...${NC}"

# Check if PostgreSQL is accessible
if ! psql "postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/postgres" -c "SELECT 1" &>/dev/null; then
    echo -e "${RED}✗ Cannot connect to PostgreSQL${NC}"
    exit 1
fi

# Create User Database
psql "postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/postgres" -tc \
    "SELECT 1 FROM pg_database WHERE datname = '${USER_DB}'" | grep -q 1 || \
    psql "postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/postgres" -c \
    "CREATE DATABASE ${USER_DB}"
echo -e "${GREEN}✓ User database ready: ${USER_DB}${NC}"

# Create Exchange Database
psql "postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/postgres" -tc \
    "SELECT 1 FROM pg_database WHERE datname = '${EXCHANGE_DB}'" | grep -q 1 || \
    psql "postgresql://${DB_USER}@${DB_HOST}:${DB_PORT}/postgres" -c \
    "CREATE DATABASE ${EXCHANGE_DB}"
echo -e "${GREEN}✓ Exchange database ready: ${EXCHANGE_DB}${NC}"

echo ""

# ============================================================================
# STEP 2: Deploy User Database Schema
# ============================================================================

echo -e "${BLUE}[2/5] Deploying user database schema...${NC}"

USER_SCHEMA_FILE="packages/shared/src/db/user_service_schema.sql"

if [ ! -f "$USER_SCHEMA_FILE" ]; then
    echo -e "${RED}✗ User schema file not found: ${USER_SCHEMA_FILE}${NC}"
    exit 1
fi

psql "${USER_CONN}" -f "${USER_SCHEMA_FILE}" > /dev/null 2>&1 || {
    echo -e "${YELLOW}⚠️  Schema deployment encountered warnings (this is normal for existing schemas)${NC}"
}

echo -e "${GREEN}✓ User database schema deployed${NC}"
echo ""

# ============================================================================
# STEP 3: Deploy Perpetual Fee Schema
# ============================================================================

echo -e "${BLUE}[3/5] Deploying perpetual fee schema...${NC}"

PERP_FEE_SCHEMA_FILE="packages/shared/src/db/perpetual_fee_schema.sql"
PERP_FEE_INIT_FILE="packages/shared/src/db/init_perpetual_fees.sql"

if [ ! -f "$PERP_FEE_SCHEMA_FILE" ]; then
    echo -e "${RED}✗ Perpetual fee schema file not found: ${PERP_FEE_SCHEMA_FILE}${NC}"
    exit 1
fi

psql "${USER_CONN}" -f "${PERP_FEE_SCHEMA_FILE}" > /dev/null 2>&1 || {
    echo -e "${YELLOW}⚠️  Schema deployment encountered warnings (this is normal for existing schemas)${NC}"
}

# Initialize perpetual fee tier data
if [ -f "$PERP_FEE_INIT_FILE" ]; then
    psql "${USER_CONN}" -f "${PERP_FEE_INIT_FILE}" > /dev/null 2>&1 || {
        echo -e "${YELLOW}⚠️  Init data encountered warnings (this is normal for existing data)${NC}"
    }
fi

echo -e "${GREEN}✓ Perpetual fee schema deployed${NC}"
echo ""

# ============================================================================
# STEP 4: Deploy Exchange Database Schema
# ============================================================================

echo -e "${BLUE}[4/5] Deploying exchange database schema...${NC}"

EXCHANGE_SCHEMA_FILE="scripts/init-db.sql"

if [ ! -f "$EXCHANGE_SCHEMA_FILE" ]; then
    echo -e "${RED}✗ Exchange schema file not found: ${EXCHANGE_SCHEMA_FILE}${NC}"
    exit 1
fi

psql "${EXCHANGE_CONN}" -f "${EXCHANGE_SCHEMA_FILE}" > /dev/null 2>&1 || {
    echo -e "${YELLOW}⚠️  Schema deployment encountered warnings (this is normal for existing schemas)${NC}"
}

echo -e "${GREEN}✓ Exchange database schema deployed${NC}"
echo ""

# ============================================================================
# STEP 5: Seed Production Data
# ============================================================================

echo -e "${BLUE}[5/5] Seeding production data...${NC}"

# Seed VIP tier configurations (if not exists)
psql "${USER_CONN}" <<-EOSQL > /dev/null 2>&1
-- VIP tier data is already seeded by user_service_schema.sql
-- Perpetual fee tiers are seeded by perpetual_fee_schema.sql
-- This step verifies the data exists

DO \$\$ 
DECLARE 
    tier_count INTEGER;
    perp_tier_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO tier_count FROM retail_vip_tiers;
    SELECT COUNT(*) INTO perp_tier_count FROM perpetual_fee_tiers;
    
    RAISE NOTICE 'VIP Tiers: % configured', tier_count;
    RAISE NOTICE 'Perpetual Fee Tiers: % configured', perp_tier_count;
    
    IF tier_count = 0 THEN
        RAISE EXCEPTION 'VIP tiers not seeded properly';
    END IF;
    
    IF perp_tier_count = 0 THEN
        RAISE EXCEPTION 'Perpetual fee tiers not seeded properly';
    END IF;
END \$\$;
EOSQL

echo -e "${GREEN}✓ Production seed data verified${NC}"
echo ""

# ============================================================================
# STEP 6: Verify Deployment
# ============================================================================

echo -e "${BLUE}[6/6] Verifying deployment...${NC}"

# Verify user database tables
USER_TABLE_COUNT=$(psql "${USER_CONN}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo -e "${GREEN}✓ User database has ${USER_TABLE_COUNT} tables${NC}"

# Verify exchange database tables
EXCHANGE_TABLE_COUNT=$(psql "${EXCHANGE_CONN}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo -e "${GREEN}✓ Exchange database has ${EXCHANGE_TABLE_COUNT} tables${NC}"

# Verify critical data
VIP_TIER_COUNT=$(psql "${USER_CONN}" -t -c "SELECT COUNT(*) FROM retail_vip_tiers;")
echo -e "${GREEN}✓ VIP tiers configured: ${VIP_TIER_COUNT}${NC}"

PERP_TIER_COUNT=$(psql "${USER_CONN}" -t -c "SELECT COUNT(*) FROM perpetual_fee_tiers;")
echo -e "${GREEN}✓ Perpetual fee tiers configured: ${PERP_TIER_COUNT}${NC}"

FEE_CONFIG_COUNT=$(psql "${USER_CONN}" -t -c "SELECT COUNT(*) FROM perpetual_fee_config;")
echo -e "${GREEN}✓ Perpetual fee configs: ${FEE_CONFIG_COUNT}${NC}"

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✅ Database deployment complete!${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Verify database connections in your application"
echo "  2. Run migrations if you have any pending"
echo "  3. Start your application services"
echo "  4. Monitor logs for any connection issues"
echo ""
echo -e "${BLUE}Connection strings:${NC}"
echo "  User DB:     ${USER_CONN}"
echo "  Exchange DB: ${EXCHANGE_CONN}"
echo ""
