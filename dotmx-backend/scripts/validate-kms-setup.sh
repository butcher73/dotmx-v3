#!/bin/bash
# GCP KMS Setup Validation Script
# Validates that all components are properly configured

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASS++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAIL++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC}  $1"
    ((WARN++))
}

check_info() {
    echo -e "${BLUE}ℹ${NC}  $1"
}

print_section() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Main validation
main() {
    print_section "GCP KMS Setup Validation"
    
    # Section 1: Environment
    print_section "1. Environment Variables"
    
    if [ -z "$GCP_PROJECT_ID" ]; then
        check_fail "GCP_PROJECT_ID not set"
        echo "   Run: export GCP_PROJECT_ID=your-project-id"
    else
        check_pass "GCP_PROJECT_ID=$GCP_PROJECT_ID"
    fi
    
    GCP_LOCATION="${GCP_KMS_LOCATION:-us-central1}"
    if [ "$GCP_LOCATION" = "us-central1" ]; then
        check_pass "GCP_KMS_LOCATION=$GCP_LOCATION (default)"
    else
        check_pass "GCP_KMS_LOCATION=$GCP_LOCATION"
    fi
    
    GCP_KEYRING="${GCP_KMS_KEY_RING:-dotmx-wallet-keys}"
    check_pass "GCP_KMS_KEY_RING=$GCP_KEYRING"
    
    GCP_KEYNAME="${GCP_KMS_KEY_NAME:-master-seed-kek}"
    check_pass "GCP_KMS_KEY_NAME=$GCP_KEYNAME"
    
    if [ -n "$DATABASE_URL" ]; then
        check_pass "DATABASE_URL configured"
    else
        check_fail "DATABASE_URL not set"
    fi
    
    # Section 2: GCP CLI
    print_section "2. GCP CLI Tools"
    
    if command -v gcloud &> /dev/null; then
        check_pass "gcloud CLI installed"
        GCLOUD_VERSION=$(gcloud --version | head -1)
        check_info "$GCLOUD_VERSION"
    else
        check_fail "gcloud CLI not found"
        echo "   Install: https://cloud.google.com/sdk/docs/install"
    fi
    
    # Section 3: GCP Authentication
    print_section "3. GCP Authentication"
    
    if gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
        check_pass "GCP authenticated as: $ACTIVE_ACCOUNT"
    else
        check_fail "Not authenticated with GCP"
        echo "   Run: gcloud auth application-default login"
    fi
    
    if [ -n "$GCP_PROJECT_ID" ]; then
        CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
        if [ "$CURRENT_PROJECT" = "$GCP_PROJECT_ID" ]; then
            check_pass "Project set correctly: $GCP_PROJECT_ID"
        else
            check_warn "Project mismatch: current=$CURRENT_PROJECT, env=$GCP_PROJECT_ID"
        fi
    fi
    
    # Section 4: GCP Services
    print_section "4. GCP Services"
    
    if [ -n "$GCP_PROJECT_ID" ]; then
        if gcloud services list --enabled --project="$GCP_PROJECT_ID" | grep -q cloudkms; then
            check_pass "Cloud KMS API enabled"
        else
            check_fail "Cloud KMS API not enabled"
            echo "   Run: gcloud services enable cloudkms.googleapis.com"
        fi
    else
        check_warn "Skipping (GCP_PROJECT_ID not set)"
    fi
    
    # Section 5: KMS Resources
    print_section "5. KMS Resources"
    
    if [ -n "$GCP_PROJECT_ID" ]; then
        # Check Key Ring
        if gcloud kms keyrings describe "$GCP_KEYRING" \
            --location="$GCP_LOCATION" \
            --project="$GCP_PROJECT_ID" &> /dev/null; then
            check_pass "Key Ring exists: $GCP_KEYRING"
        else
            check_fail "Key Ring not found: $GCP_KEYRING in $GCP_LOCATION"
        fi
        
        # Check Crypto Key
        if gcloud kms keys describe "$GCP_KEYNAME" \
            --keyring="$GCP_KEYRING" \
            --location="$GCP_LOCATION" \
            --project="$GCP_PROJECT_ID" &> /dev/null; then
            check_pass "Crypto Key exists: $GCP_KEYNAME"
            
            # Get key info
            KEY_INFO=$(gcloud kms keys describe "$GCP_KEYNAME" \
                --keyring="$GCP_KEYRING" \
                --location="$GCP_LOCATION" \
                --project="$GCP_PROJECT_ID" \
                --format="value(versionTemplate.protectionLevel,versionTemplate.algorithm)")
            check_info "Key details: $KEY_INFO"
        else
            check_fail "Crypto Key not found: $GCP_KEYNAME"
        fi
        
        # Check Service Account
        SERVICE_ACCOUNT="dotmx-wallet-service@$GCP_PROJECT_ID.iam.gserviceaccount.com"
        if gcloud iam service-accounts describe "$SERVICE_ACCOUNT" \
            --project="$GCP_PROJECT_ID" &> /dev/null; then
            check_pass "Service Account exists: dotmx-wallet-service"
        else
            check_fail "Service Account not found: dotmx-wallet-service"
        fi
        
        # Check permissions
        if gcloud kms keys get-iam-policy "$GCP_KEYNAME" \
            --keyring="$GCP_KEYRING" \
            --location="$GCP_LOCATION" \
            --project="$GCP_PROJECT_ID" 2>/dev/null | grep -q "$SERVICE_ACCOUNT"; then
            check_pass "Service Account has KMS permissions"
        else
            check_warn "Service Account may not have full KMS permissions"
        fi
    else
        check_warn "Skipping (GCP_PROJECT_ID not set)"
    fi
    
    # Section 6: Local Credentials
    print_section "6. Local Credentials"
    
    if [ -n "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
        if [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
            check_pass "Service Account key file exists"
            check_warn "Service account keys in version control are a security risk"
        else
            check_fail "Service Account key file not found: $GOOGLE_APPLICATION_CREDENTIALS"
        fi
    else
        check_warn "GOOGLE_APPLICATION_CREDENTIALS not set (required for local development)"
    fi
    
    # Section 7: Database
    print_section "7. Database"
    
    if command -v psql &> /dev/null; then
        if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
            check_pass "PostgreSQL connection successful"
            
            # Check tables
            if psql "$DATABASE_URL" -c "\dt wallet_master_keys" &> /dev/null; then
                check_pass "Custodial wallet tables exist"
            else
                check_warn "Custodial wallet tables not found"
                echo "   Run: psql \$DATABASE_URL -f scripts/migrations/001_custodial_wallet_system.sql"
            fi
        else
            check_fail "PostgreSQL connection failed"
            echo "   Check DATABASE_URL: $DATABASE_URL"
        fi
    else
        check_warn "psql not found (PostgreSQL client)"
    fi
    
    # Section 8: Node/Bun
    print_section "8. Runtime"
    
    if command -v bun &> /dev/null; then
        BUN_VERSION=$(bun --version)
        check_pass "Bun installed: $BUN_VERSION"
    elif command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        check_pass "Node.js installed: $NODE_VERSION"
        check_warn "Bun recommended for faster builds"
    else
        check_fail "Neither Node.js nor Bun found"
    fi
    
    # Section 9: KMS Encryption Test
    print_section "9. KMS Encryption Test"
    
    if [ -n "$GCP_PROJECT_ID" ] && [ -n "$GCP_KEYNAME" ]; then
        TEST_FILE="/tmp/kms-test-$$.txt"
        echo "test-data" > "$TEST_FILE"
        
        if gcloud kms encrypt \
            --keyring="$GCP_KEYRING" \
            --key="$GCP_KEYNAME" \
            --location="$GCP_LOCATION" \
            --plaintext-file="$TEST_FILE" \
            --ciphertext-file="${TEST_FILE}.encrypted" \
            --project="$GCP_PROJECT_ID" &> /dev/null; then
            check_pass "KMS encryption successful"
            
            # Try decryption
            if gcloud kms decrypt \
                --keyring="$GCP_KEYRING" \
                --key="$GCP_KEYNAME" \
                --location="$GCP_LOCATION" \
                --ciphertext-file="${TEST_FILE}.encrypted" \
                --plaintext-file="${TEST_FILE}.decrypted" \
                --project="$GCP_PROJECT_ID" &> /dev/null; then
                check_pass "KMS decryption successful"
                rm -f "$TEST_FILE" "${TEST_FILE}.encrypted" "${TEST_FILE}.decrypted"
            else
                check_fail "KMS decryption failed"
            fi
        else
            check_fail "KMS encryption failed (permission or key issue)"
        fi
    else
        check_warn "Skipping encryption test (GCP_PROJECT_ID or GCP_KEYNAME not set)"
    fi
    
    # Summary
    print_section "Validation Summary"
    
    echo -e "Results:"
    echo -e "  ${GREEN}✓ Passed: $PASS${NC}"
    if [ $FAIL -gt 0 ]; then
        echo -e "  ${RED}✗ Failed: $FAIL${NC}"
    fi
    if [ $WARN -gt 0 ]; then
        echo -e "  ${YELLOW}⚠ Warnings: $WARN${NC}"
    fi
    
    echo ""
    if [ $FAIL -eq 0 ]; then
        if [ $WARN -gt 0 ]; then
            echo -e "${YELLOW}⚠️  Setup complete with warnings. See above for details.${NC}"
            return 1
        else
            echo -e "${GREEN}✅ All checks passed! Setup is ready.${NC}"
            echo ""
            echo "Next steps:"
            echo "  1. bun run scripts/init-hd-wallet.ts"
            echo "  2. npm run dev:api"
            echo ""
            return 0
        fi
    else
        echo -e "${RED}❌ Setup validation failed. Fix the errors above.${NC}"
        echo ""
        echo "For help, see: docs/operations/GCP_KMS_SETUP.md"
        return 1
    fi
}

# Run validation
main "$@"
