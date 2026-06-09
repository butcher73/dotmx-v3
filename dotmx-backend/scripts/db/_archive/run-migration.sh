#!/bin/bash
# =============================================================================
# DotMX Database Migration Runner
# =============================================================================
# Run SQL migrations against the database
# Usage: ./scripts/db/run-migration.sh <migration_name>
#
# Examples:
#   ./scripts/db/run-migration.sh chains-tokens
#   ./scripts/db/run-migration.sh deposits-sweeps
#   ./scripts/db/run-migration.sh 001_custodial_wallet_system
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

# Parse arguments
MIGRATION_NAME="${1:-}"

if [ -z "$MIGRATION_NAME" ]; then
  log_error "Usage: $0 <migration_name>"
  echo ""
  echo "Available migrations:"
  ls -1 "$SCRIPT_DIR/migrations/"*.sql 2>/dev/null | xargs -I{} basename {} .sql | sed 's/^/  - /'
  exit 1
fi

# Load environment
load_env || exit 1

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-dotmx}"
DB_USER="${DB_USER:-dotmx}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Find migration file
MIGRATION_FILE=""

# Try exact match first
if [ -f "$SCRIPT_DIR/migrations/${MIGRATION_NAME}.sql" ]; then
  MIGRATION_FILE="$SCRIPT_DIR/migrations/${MIGRATION_NAME}.sql"
elif [ -f "$SCRIPT_DIR/migrations/${MIGRATION_NAME}" ]; then
  MIGRATION_FILE="$SCRIPT_DIR/migrations/${MIGRATION_NAME}"
else
  # Try pattern match (e.g., "chains-tokens" matches "002_chains_and_tokens_management.sql")
  MIGRATION_FILE=$(find "$SCRIPT_DIR/migrations" -name "*${MIGRATION_NAME}*.sql" 2>/dev/null | head -1)
fi

# Also check schema files in packages/shared/src/db/
if [ -z "$MIGRATION_FILE" ]; then
  SCHEMA_DIR="$SCRIPT_DIR/../../packages/shared/src/db"
  if [ -f "$SCHEMA_DIR/${MIGRATION_NAME}_schema.sql" ]; then
    MIGRATION_FILE="$SCHEMA_DIR/${MIGRATION_NAME}_schema.sql"
  elif [ -f "$SCHEMA_DIR/${MIGRATION_NAME}.sql" ]; then
    MIGRATION_FILE="$SCHEMA_DIR/${MIGRATION_NAME}.sql"
  else
    MIGRATION_FILE=$(find "$SCHEMA_DIR" -name "*${MIGRATION_NAME}*.sql" 2>/dev/null | head -1)
  fi
fi

if [ -z "$MIGRATION_FILE" ] || [ ! -f "$MIGRATION_FILE" ]; then
  log_error "Migration not found: ${MIGRATION_NAME}"
  echo ""
  echo "Searched in:"
  echo "  - $SCRIPT_DIR/migrations/"
  echo "  - $SCRIPT_DIR/../../packages/shared/src/db/"
  exit 1
fi

log_info "Migration: $(basename "$MIGRATION_FILE")"
log_info "Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Run migration
export PGPASSWORD="$DB_PASSWORD"
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"; then
  log_success "Migration completed: $(basename "$MIGRATION_FILE")"
else
  log_error "Migration failed"
  exit 1
fi
