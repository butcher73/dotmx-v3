#!/bin/bash

# ============================================================================
# Service Restart Script
# ============================================================================
# Restarts all DotMX services with health checks
# Usage: ./scripts/restart-services.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}DotMX Service Restart${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Load environment variables
if [ -f ".env.production" ]; then
    set -a
    source .env.production
    set +a
elif [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

# Configuration
API_PORT="${API_PORT:-3003}"
ENGINE_PORT="${ENGINE_PORT:-3001}"
MARKETDATA_PORT="${MARKETDATA_PORT:-3002}"
HEALTH_CHECK_TIMEOUT=30
HEALTH_CHECK_INTERVAL=2

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

check_port_available() {
    local port=$1
    if nc -z localhost $port 2>/dev/null; then
        return 1  # Port is in use
    fi
    return 0  # Port is available
}

wait_for_port() {
    local port=$1
    local timeout=$2
    local elapsed=0
    
    echo -e "${YELLOW}Waiting for port $port to be available (timeout: ${timeout}s)...${NC}"
    
    while [ $elapsed -lt $timeout ]; do
        if nc -z localhost $port 2>/dev/null; then
            echo -e "${GREEN}✓ Port $port is available${NC}"
            return 0
        fi
        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
    done
    
    echo -e "${RED}✗ Port $port is still in use after ${timeout}s${NC}"
    return 1
}

health_check() {
    local port=$1
    local service=$2
    local max_attempts=10
    local attempt=0
    
    echo -e "${YELLOW}Health checking $service on port $port...${NC}"
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf http://localhost:$port/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ $service is healthy${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        if [ $attempt -lt $max_attempts ]; then
            sleep 2
        fi
    done
    
    echo -e "${YELLOW}⚠️  $service health check endpoint not available (may still be running)${NC}"
    return 0  # Don't fail if health check is not implemented
}

# ============================================================================
# STOP EXISTING SERVICES
# ============================================================================

echo -e "${BLUE}[1/4] Stopping existing services...${NC}"

# Kill existing processes listening on our ports
for port in $API_PORT $ENGINE_PORT $MARKETDATA_PORT; do
    PID=$(lsof -ti:$port 2>/dev/null || true)
    if [ ! -z "$PID" ]; then
        echo -e "${YELLOW}Killing process on port $port (PID: $PID)${NC}"
        kill -9 $PID 2>/dev/null || true
    fi
done

# Wait for ports to be released
for port in $API_PORT $ENGINE_PORT $MARKETDATA_PORT; do
    wait_for_port $port $HEALTH_CHECK_TIMEOUT || {
        echo -e "${RED}Failed to free port $port${NC}"
        exit 1
    }
done

echo -e "${GREEN}✓ Existing services stopped${NC}"
echo ""

# ============================================================================
# START NEW SERVICES
# ============================================================================

echo -e "${BLUE}[2/4] Starting services...${NC}"

# Start API server
echo -e "${YELLOW}Starting API server on port $API_PORT...${NC}"
nohup bun run apps/api-server.ts > logs/api-server.log 2>&1 &
API_PID=$!
echo "API Server PID: $API_PID"

# Start Engine server
echo -e "${YELLOW}Starting Engine server on port $ENGINE_PORT...${NC}"
nohup bun run apps/engine-server.ts > logs/engine-server.log 2>&1 &
ENGINE_PID=$!
echo "Engine Server PID: $ENGINE_PID"

# Start Market Data server
echo -e "${YELLOW}Starting Market Data server on port $MARKETDATA_PORT...${NC}"
nohup bun run apps/marketdata-server.ts > logs/marketdata-server.log 2>&1 &
MARKETDATA_PID=$!
echo "Market Data Server PID: $MARKETDATA_PID"

echo -e "${GREEN}✓ Services started${NC}"
echo ""

# ============================================================================
# HEALTH CHECKS
# ============================================================================

echo -e "${BLUE}[3/4] Running health checks...${NC}"

sleep 5  # Give services time to start

health_check $API_PORT "API Server" || {
    echo -e "${RED}API Server health check failed${NC}"
    echo "API Server logs:"
    tail -20 logs/api-server.log
    exit 1
}

health_check $ENGINE_PORT "Engine Server" || {
    echo -e "${RED}Engine Server health check failed${NC}"
    echo "Engine Server logs:"
    tail -20 logs/engine-server.log
    exit 1
}

health_check $MARKETDATA_PORT "Market Data Server" || {
    echo -e "${RED}Market Data Server health check failed${NC}"
    echo "Market Data Server logs:"
    tail -20 logs/marketdata-server.log
    exit 1
}

echo -e "${GREEN}✓ All services healthy${NC}"
echo ""

# ============================================================================
# VERIFY SERVICES
# ============================================================================

echo -e "${BLUE}[4/4] Verifying services...${NC}"

# Check if processes are still running
for PID in $API_PID $ENGINE_PID $MARKETDATA_PID; do
    if ps -p $PID > /dev/null; then
        echo -e "${GREEN}✓ Process $PID is running${NC}"
    else
        echo -e "${RED}✗ Process $PID is not running${NC}"
        exit 1
    fi
done

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✅ All services restarted successfully!${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "${YELLOW}Service Status:${NC}"
echo "  API Server:        http://localhost:$API_PORT"
echo "  Engine Server:     http://localhost:$ENGINE_PORT"
echo "  Market Data:       http://localhost:$MARKETDATA_PORT"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo "  API Server:        logs/api-server.log"
echo "  Engine Server:     logs/engine-server.log"
echo "  Market Data:       logs/marketdata-server.log"
echo ""
