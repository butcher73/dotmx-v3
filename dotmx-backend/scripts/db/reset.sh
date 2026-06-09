#!/usr/bin/env bash
# ============================================================================
# DotMX Exchange — Database Reset Script
# ============================================================================
#
# Usage:
#   ./reset.sh                   # Reset with seed data
#   ./reset.sh --schema-only     # Schema only, no seed
#   ./reset.sh --help            # Show help
#
# Environment variables (defaults for local dev):
#   DB_HOST     (default: localhost)
#   DB_PORT     (default: 5432)
#   DB_NAME     (default: dotmx)
#   DB_USER     (default: dotmx)
#   DB_PASSWORD (default: dotmx_dev)
#
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Config ────────────────────────────────────────────────────────────────

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-dotmx}"
DB_USER="${DB_USER:-dotmx}"
DB_PASSWORD="${DB_PASSWORD:-dotmx_dev}"

SCHEMA_FILE="$SCRIPT_DIR/schema.sql"
SEED_FILE="$SCRIPT_DIR/seed.sql"

# ── Colors ────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No color

# ── Helpers ───────────────────────────────────────────────────────────────

log()   { echo -e "${BLUE}[dotmx]${NC} $1"; }
ok()    { echo -e "${GREEN}  ✓${NC} $1"; }
warn()  { echo -e "${YELLOW}  ⚠${NC} $1"; }
fail()  { echo -e "${RED}  ✗${NC} $1"; exit 1; }

run_sql() {
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$1" \
        -v ON_ERROR_STOP=1 \
        --quiet \
        -f "$2"
}

run_sql_cmd() {
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$1" \
        -v ON_ERROR_STOP=1 \
        --quiet \
        -c "$2"
}

# ── Parse args ────────────────────────────────────────────────────────────

SCHEMA_ONLY=false

case "${1:-}" in
    --schema-only)
        SCHEMA_ONLY=true
        ;;
    --help|-h)
        echo "Usage: $0 [--schema-only] [--help]"
        echo ""
        echo "Drops and recreates the DotMX database from scratch."
        echo ""
        echo "Options:"
        echo "  --schema-only   Apply schema but skip seed data"
        echo "  --help          Show this help"
        echo ""
        echo "Environment:"
        echo "  DB_HOST=$DB_HOST  DB_PORT=$DB_PORT  DB_NAME=$DB_NAME"
        echo "  DB_USER=$DB_USER"
        exit 0
        ;;
esac

# ── Preflight checks ─────────────────────────────────────────────────────

log "DotMX Database Reset"
echo ""
log "Target: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""

if ! command -v psql &>/dev/null; then
    fail "psql not found. Install PostgreSQL client: brew install postgresql"
fi

if [ ! -f "$SCHEMA_FILE" ]; then
    fail "Schema file not found: $SCHEMA_FILE"
fi

if [ "$SCHEMA_ONLY" = false ] && [ ! -f "$SEED_FILE" ]; then
    warn "Seed file not found: $SEED_FILE (continuing without seed data)"
    SCHEMA_ONLY=true
fi

# ── Confirm (safety for non-CI environments) ─────────────────────────────

if [ "${CI:-}" != "true" ] && [ "${FORCE:-}" != "true" ]; then
    echo -e "${YELLOW}This will DROP AND RECREATE the '${DB_NAME}' database.${NC}"
    echo -e "${YELLOW}All data will be lost.${NC}"
    echo ""
    read -r -p "Continue? [y/N] " response
    case "$response" in
        [yY][eE][sS]|[yY]) ;;
        *) echo "Aborted."; exit 0 ;;
    esac
    echo ""
fi

# ── Step 1: Create database if not exists ─────────────────────────────────

log "Step 1/4: Ensuring database exists..."

PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
    --quiet -tc \
    "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" \
    | grep -q 1 || {
        PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
            --quiet -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
        ok "Created database '$DB_NAME'"
    }
ok "Database '$DB_NAME' exists"

# ── Step 2: Drop all tables (clean slate) ─────────────────────────────────

log "Step 2/4: Dropping all objects..."

run_sql_cmd "$DB_NAME" "
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO $DB_USER;
    GRANT ALL ON SCHEMA public TO public;
"
ok "Schema reset"

# ── Step 3: Apply schema ─────────────────────────────────────────────────

log "Step 3/4: Applying schema..."

run_sql "$DB_NAME" "$SCHEMA_FILE"

TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" \
    | tr -d ' ')
ok "Schema applied ($TABLE_COUNT tables created)"

# ── Step 4: Apply seed data ──────────────────────────────────────────────

if [ "$SCHEMA_ONLY" = true ]; then
    log "Step 4/4: Skipping seed data (--schema-only)"
else
    log "Step 4/4: Seeding reference data..."
    run_sql "$DB_NAME" "$SEED_FILE"
    ok "Seed data applied"
fi

# ── Summary ──────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Database reset complete!${NC}"
echo -e "${GREEN}  $TABLE_COUNT tables in '${DB_NAME}'${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Connection string:"
echo "  postgresql://${DB_USER}:****@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""
