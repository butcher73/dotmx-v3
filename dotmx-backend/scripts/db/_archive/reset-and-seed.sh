#!/bin/bash
# Reset and seed database from scratch
# Usage: ./scripts/db/reset-and-seed.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "⚠️  WARNING: This will DROP ALL DATA and recreate the database!"
read -p "Are you sure? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
fi

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/dotmx}"

echo "📦 Using database: $DATABASE_URL"

# Drop and recreate database
echo "🗑️  Dropping existing tables..."
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null || true

# Run init-db.sql (basic trading tables)
echo "📋 Running init-db.sql..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/init-db.sql"

# Run migrations in order
echo "📋 Running migration 001 (users)..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/migrations/001_users.sql"

echo "📋 Running migration 002 (chains, tokens, token_chains)..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/migrations/002_chains_and_tokens_management.sql"

echo "📋 Running migration 003 (custodial wallet system)..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/migrations/003_custodial_wallet_system.sql"

# Run seed data
echo "🌱 Running seed data..."
psql "$DATABASE_URL" -f "$SCRIPT_DIR/seed-data.sql"

echo "✅ Database reset and seeded successfully!"
echo ""
echo "Tables created:"
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
