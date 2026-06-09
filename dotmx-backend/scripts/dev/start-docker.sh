#!/bin/bash
# =============================================================================
# Start Development Environment
# =============================================================================
# Starts Docker services (PostgreSQL, Redis, NATS) for local development
# Usage: ./scripts/dev/start-docker.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

PROJECT_ROOT="$(get_project_root)"
cd "$PROJECT_ROOT"

log_info "Starting DotMX Development Environment..."
echo ""

# Check Docker
check_docker || exit 1

# Start services
log_step "1/4" "Starting Docker services..."
docker-compose -f docker-compose.dev.yml up -d

log_step "2/4" "Waiting for services to be healthy..."
sleep 5

# Check PostgreSQL
log_step "3/4" "Testing PostgreSQL..."
if docker exec dotmx-postgres-dev pg_isready -U kowito &>/dev/null; then
  log_success "PostgreSQL is ready"
else
  log_warn "PostgreSQL still starting up..."
  sleep 5
fi

# Setup databases
log_step "4/4" "Setting up databases..."
docker exec dotmx-postgres-dev psql -U kowito -d postgres <<'EOF' 2>/dev/null || true
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_user WHERE usename = 'dotmx') THEN
    CREATE USER dotmx;
  END IF;
END $$;
SELECT 'CREATE DATABASE dotmx' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'dotmx') \gexec
SELECT 'CREATE DATABASE dotmx_users' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'dotmx_users') \gexec
EOF

log_success "Databases created"

# Check other services
echo ""
if docker exec dotmx-redis-dev redis-cli ping &>/dev/null; then
  log_success "Redis is ready"
fi

if docker exec dotmx-nats-dev /bin/sh -c "wget -q -O- http://localhost:8222/healthz" &>/dev/null; then
  log_success "NATS is ready"
fi

echo ""
log_success "All services running!"
echo ""
echo "Services:"
echo "  PostgreSQL: localhost:5432 (user: kowito)"
echo "  Redis:      localhost:6379"
echo "  NATS:       localhost:4222"
echo ""
echo "Next steps:"
echo "  1. Copy environment: cp .env.local .env"
echo "  2. Run tests:        bun test"
echo ""
echo "To stop: docker-compose -f docker-compose.dev.yml down"
