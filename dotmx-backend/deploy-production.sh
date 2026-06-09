#!/bin/bash

# Production Deployment Script
# Quick start for DotMX backend in production mode

set -e

echo "🚀 DotMX Production Deployment"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running${NC}"
    exit 1
fi

# Check if docker compose is available
if ! docker compose version > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: docker compose is not available${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Validate Kong configuration
echo "🔍 Validating Kong configuration..."
if [ -f "./scripts/validate-kong-config.sh" ]; then
    ./scripts/validate-kong-config.sh
else
    echo -e "${YELLOW}⚠️  Warning: Kong validation script not found, skipping...${NC}"
fi

echo ""
echo "📦 Building and starting services..."
echo ""

# Start services
docker compose up -d --build

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check service health
echo ""
echo "🏥 Health Check:"
echo "----------------"

# Function to check health
check_health() {
    local service=$1
    local url=$2
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $service is healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  $service is not responding yet${NC}"
    fi
}

check_health "Kong Gateway" "http://localhost/health"
check_health "API Service" "http://localhost/api/health"
check_health "Market Data" "http://localhost/market/health"

echo ""
echo "📊 Service Status:"
echo "----------------"
docker compose ps

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📍 Access points:"
echo "  - API:        http://localhost/api"
echo "  - Market:     http://localhost/market"
echo "  - Management: http://localhost/api/management"
echo "  - WebSocket:  ws://localhost/market/ws"
echo ""
echo "📋 Useful commands:"
echo "  - View logs:    docker compose logs -f"
echo "  - Stop:         docker compose down"
echo "  - Restart:      docker compose restart"
echo "  - Status:       docker compose ps"
echo ""
echo "📚 For more information, see PRODUCTION_SETUP.md"
