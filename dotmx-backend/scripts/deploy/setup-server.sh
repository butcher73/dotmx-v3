#!/bin/bash

# ============================================================================
# Server Setup Script for Bare Metal Deployment
# ============================================================================
# Sets up the bare metal server for DotMX deployment
# Usage: ./scripts/setup-server.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}DotMX Bare Metal Server Setup${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# CHECK PREREQUISITES
# ============================================================================

echo -e "${BLUE}[1/8] Checking prerequisites...${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}This script must be run as root${NC}"
    exit 1
fi

# Check system
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo -e "${GREEN}✓ OS: $PRETTY_NAME${NC}"
else
    echo -e "${RED}Cannot determine OS${NC}"
    exit 1
fi

echo ""

# ============================================================================
# INSTALL SYSTEM DEPENDENCIES
# ============================================================================

echo -e "${BLUE}[2/8] Installing system dependencies...${NC}"

apt-get update
apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    pkg-config \
    libssl-dev \
    postgresql \
    postgresql-contrib \
    redis-server \
    nginx \
    supervisor \
    netcat-openbsd

echo -e "${GREEN}✓ System dependencies installed${NC}"
echo ""

# ============================================================================
# INSTALL RUST
# ============================================================================

echo -e "${BLUE}[3/8] Installing Rust...${NC}"

if ! command -v rustc &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.75.0
    source $HOME/.cargo/env
    echo -e "${GREEN}✓ Rust installed${NC}"
else
    echo -e "${GREEN}✓ Rust already installed: $(rustc --version)${NC}"
fi

echo ""

# ============================================================================
# INSTALL BUN
# ============================================================================

echo -e "${BLUE}[4/8] Installing Bun...${NC}"

if ! command -v bun &> /dev/null; then
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    echo -e "${GREEN}✓ Bun installed${NC}"
else
    echo -e "${GREEN}✓ Bun already installed: $(bun --version)${NC}"
fi

echo ""

# ============================================================================
# SETUP POSTGRESQL
# ============================================================================

echo -e "${BLUE}[5/8] Setting up PostgreSQL...${NC}"

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql
echo -e "${GREEN}✓ PostgreSQL started${NC}"

# Create deployment user if it doesn't exist
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename = 'dotmx'" | grep -q 1 || \
    sudo -u postgres createuser -d dotmx

echo -e "${GREEN}✓ PostgreSQL configured${NC}"
echo ""

# ============================================================================
# SETUP REDIS
# ============================================================================

echo -e "${BLUE}[6/8] Setting up Redis...${NC}"

systemctl start redis-server
systemctl enable redis-server
echo -e "${GREEN}✓ Redis configured${NC}"
echo ""

# ============================================================================
# SETUP APPLICATION DIRECTORY
# ============================================================================

echo -e "${BLUE}[7/8] Setting up application directory...${NC}"

# Create deployment directory
DEPLOY_DIR="/opt/dotmx-backend"
mkdir -p $DEPLOY_DIR
mkdir -p /var/log/dotmx
mkdir -p /var/run/dotmx

# Set permissions
chown -R $SUDO_USER:$SUDO_USER $DEPLOY_DIR
chown -R $SUDO_USER:$SUDO_USER /var/log/dotmx
chown -R $SUDO_USER:$SUDO_USER /var/run/dotmx

echo -e "${GREEN}✓ Application directory created at $DEPLOY_DIR${NC}"
echo ""

# ============================================================================
# SETUP NGINX
# ============================================================================

echo -e "${BLUE}[8/8] Setting up Nginx...${NC}"

cat > /etc/nginx/sites-available/dotmx << 'EOF'
upstream api_server {
    server localhost:3000;
}

upstream engine_server {
    server localhost:8080;
}

upstream marketdata_server {
    server localhost:8080;
}

server {
    listen 80;
    listen [::]:80;
    server_name _;
    
    # API endpoints
    location /api {
        proxy_pass http://api_server;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # WebSocket endpoints
    location /ws {
        proxy_pass http://api_server;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
    
    # Health check endpoints
    location /health {
        proxy_pass http://api_server;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/dotmx /etc/nginx/sites-enabled/dotmx 2>/dev/null || true

# Test and start Nginx
nginx -t
systemctl start nginx
systemctl enable nginx

echo -e "${GREEN}✓ Nginx configured${NC}"
echo ""

# ============================================================================
# FINAL SUMMARY
# ============================================================================

echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✅ Server setup complete!${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Clone the repository:"
echo "   git clone <repo-url> $DEPLOY_DIR"
echo ""
echo "2. Configure environment:"
echo "   cp $DEPLOY_DIR/.env.production.example $DEPLOY_DIR/.env.production"
echo "   # Edit with your settings"
echo ""
echo "3. Deploy database and start services:"
echo "   cd $DEPLOY_DIR"
echo "   bash scripts/deploy-db.sh production"
echo "   bash scripts/restart-services.sh"
echo ""
echo -e "${YELLOW}System Components:${NC}"
echo "  PostgreSQL:  ✓ Installed and running"
echo "  Redis:       ✓ Installed and running"
echo "  Rust:        ✓ Installed ($(rustc --version))"
echo "  Bun:         ✓ Installed ($(bun --version))"
echo "  Nginx:       ✓ Configured and running"
echo ""
echo -e "${YELLOW}Important Paths:${NC}"
echo "  App:         $DEPLOY_DIR"
echo "  Logs:        /var/log/dotmx"
echo "  Config:      $DEPLOY_DIR/.env.production"
echo "  Nginx:       /etc/nginx/sites-available/dotmx"
echo ""
