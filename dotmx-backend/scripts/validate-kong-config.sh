#!/bin/bash

# Kong Configuration Validator
# This script validates the Kong declarative configuration before deployment

set -e

echo "🔍 Validating Kong configuration..."

# Check if kong.yml exists
if [ ! -f "docker/kong.yml" ]; then
    echo "❌ Error: docker/kong.yml not found"
    exit 1
fi

# Validate using Kong container
docker run --rm \
    -v "$(pwd)/docker/kong.yml:/etc/kong/kong.yml:ro" \
    kong:3.5-alpine \
    kong config parse /etc/kong/kong.yml

if [ $? -eq 0 ]; then
    echo "✅ Kong configuration is valid!"
    
    # Show basic info
    echo ""
    echo "📋 Configuration Summary:"
    echo "  Services: $(grep -c "^  - name:" docker/kong.yml || echo 0)"
    echo "  Routes: $(grep -c "  - name:.*route" docker/kong.yml || echo 0)"
    echo "  Upstreams: $(grep -c "^  - name:.*upstream" docker/kong.yml || echo 0)"
    echo "  Consumers: $(grep -c "^  - username:" docker/kong.yml || echo 0)"
    
    echo ""
    echo "🚀 Ready to deploy!"
else
    echo "❌ Kong configuration has errors"
    exit 1
fi
