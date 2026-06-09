#!/bin/bash
# =============================================================================
# Recreate Test Databases
# =============================================================================
# Drops and recreates test databases with fresh schema
# Usage: ./scripts/db/setup-test.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

# Load environment
load_env || exit 1

# Set defaults
DB_USER="${DB_USER:-kowito}"
DB_PASSWORD="${DB_PASSWORD:-}"
TEST_EXCHANGE_DB="${TEST_EXCHANGE_DB_NAME:-dotmx_test}"
TEST_USER_DB="${TEST_USER_DB_NAME:-dotmx_users_test}"

export PGPASSWORD="$DB_PASSWORD"

log_info "Recreating test databases: $TEST_EXCHANGE_DB, $TEST_USER_DB"

# Check postgres connection
if ! psql -U "$DB_USER" -d postgres -c "SELECT 1" &>/dev/null; then
  log_error "Cannot connect to PostgreSQL"
  exit 1
fi

# Drop and recreate for clean state
log_step "1/3" "Dropping existing test databases..."
psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$TEST_EXCHANGE_DB\"" 2>/dev/null || true
psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$TEST_USER_DB\"" 2>/dev/null || true

log_step "2/3" "Creating test databases..."
psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$TEST_EXCHANGE_DB\"" 2>/dev/null || true
psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$TEST_USER_DB\"" 2>/dev/null || true

# Load schema into user test database
log_step "3/3" "Loading schemas..."
PROJECT_ROOT="$SCRIPT_DIR/../.."
SCHEMA_FILES=(
  "$PROJECT_ROOT/packages/shared/src/db/user_service_schema.sql"
  "$PROJECT_ROOT/packages/shared/src/db/schema.sql"
  "$PROJECT_ROOT/packages/shared/src/db/fee_tier_schema.sql"
  "$PROJECT_ROOT/packages/shared/src/db/perpetual_fee_schema.sql"
)

for f in "${SCHEMA_FILES[@]}"; do
  if [ -f "$f" ]; then
    psql -U "$DB_USER" -d "$TEST_USER_DB" -f "$f" > /dev/null 2>&1 || true
    log_success "Loaded: $(basename "$f")"
  fi
done

log_success "Test databases ready!"
