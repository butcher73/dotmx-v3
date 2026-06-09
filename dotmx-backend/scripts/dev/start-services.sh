#!/bin/bash
# =============================================================================
# Start All Backend Services
# =============================================================================
# Runs all DotMX backend services concurrently
# Usage: ./scripts/dev/start-services.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

PROJECT_ROOT="$(get_project_root)"
cd "$PROJECT_ROOT"

# Load environment
load_env || {
  log_warn "No .env file found, using defaults..."
}

# Default environment variables
export DATABASE_URL="${DATABASE_URL:-postgresql://dotmx:dotmx@localhost:5432/dotmx}"
export JWT_SECRET="${JWT_SECRET:-dev-secret-key-change-in-production}"
export NODE_ENV="${NODE_ENV:-development}"

log_info "Starting all DotMX backend services..."
echo ""

# Check if ports are available
REQUIRED_PORTS=(3001 3002 3003 3004)
PORTS_IN_USE=()

log_info "Checking port availability..."
for port in "${REQUIRED_PORTS[@]}"; do
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    PORTS_IN_USE+=($port)
    log_error "Port $port is already in use"
  fi
done

if [ ${#PORTS_IN_USE[@]} -ne 0 ]; then
  echo ""
  log_error "❌ Cannot start services - ports in use: ${PORTS_IN_USE[*]}"
  echo ""
  echo "Please stop the processes using these ports:"
  for port in "${PORTS_IN_USE[@]}"; do
    echo "  Port $port:"
    lsof -Pi :$port -sTCP:LISTEN | tail -n +2 | awk '{printf "    PID %s - %s\n", $2, $1}'
  done
  echo ""
  echo "To stop processes: kill \$(lsof -t -i:PORT_NUMBER)"
  echo "To stop all: pkill -f \"bun run apps\""
  exit 1
fi

log_success "✅ All required ports are available"
echo ""

# Cleanup function
cleanup() {
  echo ""
  log_warn "Stopping all services..."
  jobs -p | xargs kill 2>/dev/null || true
  wait
  log_error "All services stopped"
  exit
}

trap cleanup SIGINT SIGTERM EXIT

# Start services
log_step "1/4" "Starting Engine Server (port 3001)..."
PORT=3001 bun run apps/engine-server.ts 2>&1 | sed "s/^/[ENGINE] /" &
sleep 1

log_step "2/4" "Starting Market Data Server (port 3002)..."
PORT=3002 bun run apps/marketdata-server.ts 2>&1 | sed "s/^/[MARKETDATA] /" &
sleep 1

log_step "3/4" "Starting API Server (port 3003)..."
PORT=3003 bun run apps/api-server-with-auth.ts 2>&1 | sed "s/^/[API] /" &
sleep 1

log_step "4/4" "Starting Management Server (port 3004)..."
MANAGEMENT_API_PORT=3004 bun run apps/management-server.ts 2>&1 | sed "s/^/[MANAGEMENT] /" &

echo ""
log_success "All services started!"
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                 DotMX Backend Services                       ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  PORT 3001 - Engine Server      (Order matching engine)      ║"
echo "║  PORT 3002 - MarketData Server  (Price feeds, orderbook)     ║"
echo "║  PORT 3003 - API Server         (User-facing REST API)       ║"
echo "║  PORT 3004 - Management Server  (Admin panel API)            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
log_warn "Press Ctrl+C to stop all services"
echo ""

# Wait for all background processes
wait
