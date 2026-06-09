#!/bin/bash

# ============================================================================
# SSH Key Generator for GitHub Actions Deployment
# ============================================================================
# This script generates and displays SSH keys for GitHub Actions deployment
# Uses ED25519 encryption (modern, secure standard)
# Usage: bash scripts/generate-deploy-keys.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

KEY_NAME="dotmx_deploy"
KEY_PATH="$HOME/.ssh/$KEY_NAME"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}DotMX GitHub Actions SSH Key Generator${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Check if key already exists
if [ -f "$KEY_PATH" ]; then
    echo -e "${YELLOW}SSH key already exists at $KEY_PATH${NC}"
    read -p "Do you want to regenerate it? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Using existing key...${NC}"
        EXISTING=true
    else
        echo -e "${YELLOW}Backing up existing key...${NC}"
        mv "$KEY_PATH" "$KEY_PATH.backup"
        mv "$KEY_PATH.pub" "$KEY_PATH.pub.backup"
        echo -e "${GREEN}✓ Existing key backed up${NC}"
        EXISTING=false
    fi
else
    EXISTING=false
fi

# Generate new key if needed
if [ "$EXISTING" != "true" ]; then
    echo -e "${BLUE}Generating SSH key pair...${NC}"
    ssh-keygen -t ed25519 -f "$KEY_PATH" -N "" -C "dotmx-deploy"
    echo -e "${GREEN}✓ SSH key generated${NC}"
    echo ""
fi

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}SSH Key Information${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Display public key
echo -e "${YELLOW}PUBLIC KEY (add to server authorized_keys):${NC}"
echo -e "${GREEN}────────────────────────────────────────────────────────────────────────${NC}"
cat "$KEY_PATH.pub"
echo -e "${GREEN}────────────────────────────────────────────────────────────────────────${NC}"
echo ""

# Display private key for GitHub
echo -e "${YELLOW}PRIVATE KEY (add to GitHub Secrets as DEPLOY_SSH_KEY):${NC}"
echo -e "${RED}⚠️  KEEP THIS SECRET - DO NOT COMMIT TO GIT${NC}"
echo -e "${GREEN}────────────────────────────────────────────────────────────────────────${NC}"
cat "$KEY_PATH"
echo -e "${GREEN}────────────────────────────────────────────────────────────────────────${NC}"
echo ""

# Copy instructions
echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Next Steps${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

echo -e "${YELLOW}1. Add public key to your server:${NC}"
echo ""
echo "   On your server (calgary.petaex.com):"
echo "   mkdir -p ~/.ssh && chmod 700 ~/.ssh"
echo ""
echo "   Then paste the PUBLIC KEY above into:"
echo "   echo '$(cat $KEY_PATH.pub)' >> ~/.ssh/authorized_keys"
echo "   chmod 600 ~/.ssh/authorized_keys"
echo ""

echo -e "${YELLOW}2. Add PRIVATE KEY to GitHub Secrets:${NC}"
echo ""
echo "   a) Copy the PRIVATE KEY above (entire content)"
echo "   b) Go to GitHub: Settings → Secrets and variables → Actions"
echo "   c) Click 'New repository secret'"
echo "   d) Name: DEPLOY_SSH_KEY"
echo "   e) Paste the entire private key content"
echo "   f) Click 'Add secret'"
echo ""

echo -e "${YELLOW}3. Test SSH connection:${NC}"
echo ""
echo "   ssh -i $KEY_PATH deploy@calgary.petaex.com"
echo ""

echo -e "${YELLOW}4. Add other required secrets:${NC}"
echo "   - DEPLOY_HOST: calgary.petaex.com"
echo "   - DEPLOY_USER: deploy"
echo "   - DEPLOY_PORT: 22"
echo "   - DEPLOY_PATH: /opt/dotmx-backend"
echo "   - SLACK_WEBHOOK: (optional)"
echo ""

echo -e "${GREEN}✓ Key generation complete!${NC}"
echo ""
