#!/bin/bash
# =============================================================================
# Test Database Connections
# =============================================================================
# Tests both exchange and user service database connections
# Usage: ./scripts/db/test-connection.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

log_info "Testing DotMX Database Connections..."
echo ""

# Load environment
load_env || exit 1

# Test Exchange Database
log_step "1/2" "Testing Exchange Database..."
echo "  Host: ${EXCHANGE_DB_HOST:-localhost}"
echo "  Port: ${EXCHANGE_DB_PORT:-5432}"
echo "  Name: ${EXCHANGE_DB_NAME:-dotmx}"

if psql -h "${EXCHANGE_DB_HOST:-localhost}" \
        -p "${EXCHANGE_DB_PORT:-5432}" \
        -U "${EXCHANGE_DB_USER:-kowito}" \
        -d "${EXCHANGE_DB_NAME:-dotmx}" \
        -c "SELECT 1" &>/dev/null; then
  log_success "Exchange database OK"
else
  log_error "Exchange database connection FAILED"
  exit 1
fi

echo ""

# Test User Service Database
log_step "2/2" "Testing User Service Database..."
echo "  Host: ${USER_DB_HOST:-localhost}"
echo "  Port: ${USER_DB_PORT:-5432}"
echo "  Name: ${USER_DB_NAME:-dotmx_users}"

export PGPASSWORD="${USER_DB_PASSWORD:-}"
if psql -h "${USER_DB_HOST:-localhost}" \
        -p "${USER_DB_PORT:-5432}" \
        -U "${USER_DB_USER:-kowito}" \
        -d "${USER_DB_NAME:-dotmx_users}" \
        -c "SELECT 1" &>/dev/null; then
  log_success "User service database OK"
else
  log_error "User service database connection FAILED"
  exit 1
fi

echo ""
log_success "All database connections working!"
echo ""
echo "You can now run: bun test"
