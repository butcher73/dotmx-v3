#!/bin/bash

# Production Configuration Test
# Verify all production configurations are correct

set -e

echo "🧪 Testing Production Configuration"
echo "===================================="
echo ""

FAILED=0
PASSED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test function
test_check() {
    local name=$1
    local command=$2
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ $name${NC}"
        ((FAILED++))
    fi
}

# Test file existence
test_file() {
    local name=$1
    local file=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $name exists${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ $name missing${NC}"
        ((FAILED++))
    fi
}

echo "📁 File Checks:"
echo "---------------"
test_file "docker-compose.yml" "docker-compose.yml"
test_file "Kong config" "docker/kong.yml"
test_file "API Dockerfile" "docker/Dockerfile.api"
test_file "Deploy script" "deploy-production.sh"
test_file "Validate script" "scripts/validate-kong-config.sh"
test_file "Production setup docs" "PRODUCTION_SETUP.md"
test_file "Production config docs" "PRODUCTION_CONFIG.md"
test_file "Deployment checklist" "PRODUCTION_CHECKLIST.md"

echo ""
echo "🔧 Configuration Checks:"
echo "------------------------"

# Check Kong config has required services
if grep -q "dotmx-api" docker/kong.yml; then
    echo -e "${GREEN}✅ Kong config has API service${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Kong config missing API service${NC}"
    ((FAILED++))
fi

if grep -q "dotmx-marketdata" docker/kong.yml; then
    echo -e "${GREEN}✅ Kong config has MarketData service${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Kong config missing MarketData service${NC}"
    ((FAILED++))
fi

if grep -q "dotmx-management" docker/kong.yml; then
    echo -e "${GREEN}✅ Kong config has Management service${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Kong config missing Management service${NC}"
    ((FAILED++))
fi

# Check docker-compose has required services
if grep -q "service.*kong:" docker-compose.yml; then
    echo -e "${GREEN}✅ docker-compose has Kong service${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ docker-compose missing Kong service${NC}"
    ((FAILED++))
fi

if grep -q "service.*management:" docker-compose.yml; then
    echo -e "${GREEN}✅ docker-compose has Management service${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ docker-compose missing Management service${NC}"
    ((FAILED++))
fi

# Check Kong is in DB-less mode
if grep -q 'KONG_DATABASE: "off"' docker-compose.yml; then
    echo -e "${GREEN}✅ Kong configured in DB-less mode${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Kong not in DB-less mode${NC}"
    ((FAILED++))
fi

# Check Kong exposes port 80
if grep -q '"80:8000"' docker-compose.yml; then
    echo -e "${GREEN}✅ Kong exposes port 80${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  Kong not exposing port 80 (might use different port)${NC}"
fi

# Check services use expose instead of ports
if grep -q "expose:" docker-compose.yml | grep -A1 "api:" | grep -q "expose:"; then
    echo -e "${GREEN}✅ API service uses internal ports only${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  API service port configuration might be different${NC}"
fi

echo ""
echo "🔒 Security Checks:"
echo "-------------------"

# Check if default passwords need to be changed
if grep -q "dotmx_dev" docker-compose.yml; then
    echo -e "${YELLOW}⚠️  Default database password detected - CHANGE IN PRODUCTION!${NC}"
fi

if grep -q "admin-key-change-this-in-production" docker/kong.yml; then
    echo -e "${YELLOW}⚠️  Default admin key detected - CHANGE IN PRODUCTION!${NC}"
fi

if grep -q "demo-api-key" docker/kong.yml; then
    echo -e "${YELLOW}⚠️  Demo API key detected - REMOVE IN PRODUCTION!${NC}"
fi

# Check IP restrictions exist
if grep -q "ip-restriction" docker/kong.yml; then
    echo -e "${GREEN}✅ IP restrictions configured for management${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ No IP restrictions found for management API${NC}"
    ((FAILED++))
fi

echo ""
echo "📊 Results:"
echo "-----------"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Configuration looks good.${NC}"
    echo ""
    echo "⚠️  Remember to:"
    echo "  1. Change default passwords"
    echo "  2. Update API keys"
    echo "  3. Configure allowed IPs"
    echo "  4. Update CORS origins"
    echo ""
    echo "See PRODUCTION_CHECKLIST.md for complete deployment steps."
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please review the configuration.${NC}"
    exit 1
fi
