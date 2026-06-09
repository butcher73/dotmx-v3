#!/bin/bash
# Interactive GCP KMS Setup Helper
# This script guides you through the setup process and validates each step

# Load .env file if it exists BEFORE set -e
if [ -f ".env" ]; then
    echo "[Loading .env file...]" >&2
    # Load environment variables from .env (skip comments and empty lines)
    while IFS= read -r line; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        # Export the variable
        export "$line"
    done < .env
    echo "[.env loaded]" >&2
fi

# Verify DATABASE_URL was loaded
if [ -z "$DATABASE_URL" ]; then
    echo "WARNING: DATABASE_URL still not set after loading .env" >&2
fi

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Main script
main() {
    print_header "GCP KMS Interactive Setup Helper"
    
    echo "This script will guide you through setting up GCP KMS for DotMX."
    echo "It will check prerequisites and help you configure everything."
    echo ""
    
    # Show what was loaded
    if [ -f ".env" ]; then
        print_success ".env file loaded"
    else
        print_warning ".env file not found - some variables may not be set"
    fi
    echo ""
    
    # Show if environment variables are already loaded
    if [ -n "$GCP_PROJECT_ID" ] || [ -n "$GCP_KMS_LOCATION" ] || [ -n "$GCP_KMS_KEYRING" ] || [ -n "$GCP_KMS_KEY_NAME" ] || [ -n "$DATABASE_URL" ]; then
        print_info "Environment variables detected:"
        [ -n "$GCP_PROJECT_ID" ] && echo "  • GCP_PROJECT_ID=$GCP_PROJECT_ID"
        [ -n "$GCP_KMS_LOCATION" ] && echo "  • GCP_KMS_LOCATION=$GCP_KMS_LOCATION"
        [ -n "$GCP_KMS_KEYRING" ] && echo "  • GCP_KMS_KEYRING=$GCP_KMS_KEYRING"
        [ -n "$GCP_KMS_KEY_NAME" ] && echo "  • GCP_KMS_KEY_NAME=$GCP_KMS_KEY_NAME"
        [ -n "$DATABASE_URL" ] && echo "  • DATABASE_URL=[configured]"
        echo ""
    fi
    
    # Step 1: Check Prerequisites
    print_header "Step 1: Check Prerequisites"
    
    # Check gcloud
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI not found"
        echo "Install from: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    print_success "gcloud CLI installed"
    
    # Check authentication
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 &> /dev/null; then
        print_warning "Not authenticated with GCP"
        echo "Run: gcloud auth application-default login"
        exit 1
    fi
    print_success "GCP authentication configured"
    
    # Check psql
    if ! command -v psql &> /dev/null; then
        print_warning "psql not found (optional for now)"
    else
        print_success "PostgreSQL client installed"
    fi
    
    # Step 2: Get GCP Project ID
    print_header "Step 2: Configure GCP Project"
    
    # Check if GCP_PROJECT_ID is already set in environment
    if [ -n "$GCP_PROJECT_ID" ]; then
        print_info "Environment variable GCP_PROJECT_ID=$GCP_PROJECT_ID"
        echo "Use this project? (y/n)"
        read -r use_env
        if [ "$use_env" != "y" ]; then
            unset GCP_PROJECT_ID
        fi
    fi
    
    # If not set, ask user
    if [ -z "$GCP_PROJECT_ID" ]; then
        CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
        
        if [ -n "$CURRENT_PROJECT" ]; then
            print_info "Current gcloud project: $CURRENT_PROJECT"
            echo "Use this project? (y/n)"
            read -r use_current
            if [ "$use_current" = "y" ]; then
                GCP_PROJECT_ID=$CURRENT_PROJECT
            fi
        fi
        
        # If still not set, ask user to enter
        if [ -z "$GCP_PROJECT_ID" ]; then
            print_info "Available projects:"
            gcloud projects list --format='table(projectId)' | tail -n +2 | head -5
            echo ""
            echo "Enter your GCP Project ID (dotmx project should be dotmx-xxxxx):"
            read -r GCP_PROJECT_ID
        fi
    fi
    
    # Set gcloud config to this project
    gcloud config set project "$GCP_PROJECT_ID"
    print_success "Using GCP Project: $GCP_PROJECT_ID"
    
    # Step 3: Verify GCP Permissions
    print_header "Step 3: Verify GCP Permissions"
    
    echo "Checking required IAM roles..."
    
    MY_EMAIL=$(gcloud config get-value account)
    print_info "Checking permissions for: $MY_EMAIL"
    
    # Note: Full permission check is complex, so we'll do a basic check
    if gcloud projects get-iam-policy "$GCP_PROJECT_ID" \
        --flatten="bindings[].members" \
        --filter="bindings.members:$MY_EMAIL" &> /dev/null; then
        print_success "Has IAM roles in project"
    else
        print_warning "Could not verify IAM roles - make sure you have Editor or custom roles with KMS permissions"
    fi
    
    # Step 4: Enable APIs
    print_header "Step 4: Enable Required GCP APIs"
    
    echo "Enabling Cloud KMS API..."
    if gcloud services enable cloudkms.googleapis.com --project="$GCP_PROJECT_ID"; then
        print_success "Cloud KMS API enabled"
    else
        print_error "Failed to enable Cloud KMS API"
        exit 1
    fi
    
    # Step 5: Database Check
    print_header "Step 5: Verify Database Connection"
    
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL not set"
        echo ""
        echo "Your .env file should have:"
        echo "  DATABASE_URL=postgresql://dotmx:dotmx@localhost:5432/dotmx"
        echo ""
        echo "Make sure .env exists in the root directory and try again."
        exit 1
    else
        print_success "DATABASE_URL detected"
        echo "  postgresql://[user]:[pass]@[host]:[port]/[database]"
        
        if command -v psql &> /dev/null; then
            print_info "Testing database connection..."
            if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
                print_success "Database connection successful ✓"
            else
                print_warning "Database connection failed"
                echo "  Make sure PostgreSQL is running at the configured host/port"
                echo "  You can continue with KMS setup, but you won't be able to initialize the wallet yet"
            fi
        else
            print_info "psql not available - skipping connection test"
        fi
    fi
    
    # Step 6: Environment Setup
    print_header "Step 6: Setup Environment Variables"
    
    # Use environment variables if already set, otherwise use defaults
    GCP_PROJECT_ID=${GCP_PROJECT_ID:-$GCP_PROJECT_ID}
    GCP_KMS_LOCATION=${GCP_KMS_LOCATION:-us-central1}
    GCP_KMS_KEYRING=${GCP_KMS_KEYRING:-dotmx-wallet-keys}
    GCP_KMS_KEY_NAME=${GCP_KMS_KEY_NAME:-master-seed-kek}
    
    echo "Configure KMS settings (or press Enter to use current values):"
    echo ""
    
    read -p "GCP Project ID [$GCP_PROJECT_ID]: " input
    GCP_PROJECT_ID=${input:-$GCP_PROJECT_ID}
    
    read -p "KMS Location [$GCP_KMS_LOCATION]: " input
    GCP_KMS_LOCATION=${input:-$GCP_KMS_LOCATION}
    
    read -p "Key Ring [$GCP_KMS_KEYRING]: " input
    GCP_KMS_KEYRING=${input:-$GCP_KMS_KEYRING}
    
    read -p "Key Name [$GCP_KMS_KEY_NAME]: " input
    GCP_KMS_KEY_NAME=${input:-$GCP_KMS_KEY_NAME}
    
    echo ""
    print_info "KMS Configuration:"
    echo "  Project ID:   $GCP_PROJECT_ID"
    echo "  Location:     $GCP_KMS_LOCATION"
    echo "  Key Ring:     $GCP_KMS_KEYRING"
    echo "  Key Name:     $GCP_KMS_KEY_NAME"
    
    # Save to .env if requested
    echo ""
    read -p "Save to .env file? (y/n): " save_env
    if [ "$save_env" = "y" ]; then
        ENV_FILE=".env"
        if [ ! -f "$ENV_FILE" ]; then
            print_warning ".env file not found - creating from .env.example"
            if [ -f ".env.example" ]; then
                cp .env.example "$ENV_FILE"
            else
                touch "$ENV_FILE"
            fi
        fi
        
        # Update or add variables
        if grep -q "^GCP_PROJECT_ID=" "$ENV_FILE"; then
            sed -i.bak "s/^GCP_PROJECT_ID=.*/GCP_PROJECT_ID=$GCP_PROJECT_ID/" "$ENV_FILE"
        else
            echo "GCP_PROJECT_ID=$GCP_PROJECT_ID" >> "$ENV_FILE"
        fi
        
        if grep -q "^GCP_KMS_LOCATION=" "$ENV_FILE"; then
            sed -i.bak "s/^GCP_KMS_LOCATION=.*/GCP_KMS_LOCATION=$GCP_KMS_LOCATION/" "$ENV_FILE"
        else
            echo "GCP_KMS_LOCATION=$GCP_KMS_LOCATION" >> "$ENV_FILE"
        fi
        
        if grep -q "^GCP_KMS_KEYRING=" "$ENV_FILE"; then
            sed -i.bak "s/^GCP_KMS_KEYRING=.*/GCP_KMS_KEYRING=$GCP_KMS_KEYRING/" "$ENV_FILE"
        else
            echo "GCP_KMS_KEYRING=$GCP_KMS_KEYRING" >> "$ENV_FILE"
        fi
        
        if grep -q "^GCP_KMS_KEY_NAME=" "$ENV_FILE"; then
            sed -i.bak "s/^GCP_KMS_KEY_NAME=.*/GCP_KMS_KEY_NAME=$GCP_KMS_KEY_NAME/" "$ENV_FILE"
        else
            echo "GCP_KMS_KEY_NAME=$GCP_KMS_KEY_NAME" >> "$ENV_FILE"
        fi
        
        print_success "Environment variables saved to .env"
        rm -f .env.bak
    fi
    
    # Step 7: Run KMS Setup Script
    print_header "Step 7: Create GCP KMS Resources"
    
    echo "Ready to create KMS resources in GCP?"
    echo "This will:"
    echo "  • Create Key Ring: $GCP_KMS_KEYRING"
    echo "  • Create Crypto Key: $GCP_KMS_KEY_NAME"
    echo "  • Create Service Account: dotmx-wallet-service"
    echo "  • Grant required permissions"
    echo ""
    
    read -p "Continue? (y/n): " continue_setup
    if [ "$continue_setup" != "y" ]; then
        print_warning "Setup cancelled"
        exit 0
    fi
    
    # Export config for the setup script
    export GCP_PROJECT_ID
    export GCP_KMS_LOCATION
    export GCP_KMS_KEYRING
    export GCP_KMS_KEY_NAME
    
    # Run the actual setup script
    if [ -f "scripts/deploy/setup-gcp-kms.sh" ]; then
        chmod +x scripts/deploy/setup-gcp-kms.sh
        ./scripts/deploy/setup-gcp-kms.sh
    else
        print_error "Setup script not found at scripts/deploy/setup-gcp-kms.sh"
        exit 1
    fi
    
    # Step 8: Verify Setup
    print_header "Step 8: Verify KMS Resources"
    
    echo "Verifying created resources..."
    
    # Check key ring
    if gcloud kms keyrings describe "$GCP_KMS_KEYRING" \
        --location="$GCP_KMS_LOCATION" \
        --project="$GCP_PROJECT_ID" &> /dev/null; then
        print_success "Key Ring verified: $GCP_KMS_KEYRING"
    else
        print_error "Key Ring not found"
        exit 1
    fi
    
    # Check key
    if gcloud kms keys describe "$GCP_KMS_KEY_NAME" \
        --keyring="$GCP_KMS_KEYRING" \
        --location="$GCP_KMS_LOCATION" \
        --project="$GCP_PROJECT_ID" &> /dev/null; then
        print_success "Crypto Key verified: $GCP_KMS_KEY_NAME"
    else
        print_error "Crypto Key not found"
        exit 1
    fi
    
    # Step 9: Database Migration
    print_header "Step 9: Run Database Migration"
    
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL not set - cannot run migration"
        exit 1
    else
        echo "Ready to run database migration?"
        echo "This will create the wallet tables in your database."
        read -p "Continue? (y/n): " run_migration
        
        if [ "$run_migration" = "y" ]; then
            MIGRATION_FILE="scripts/db/migrations/003_custodial_wallet_system.sql"
            if [ ! -f "$MIGRATION_FILE" ]; then
                print_error "Migration file not found: $MIGRATION_FILE"
                exit 1
            fi
            
            if psql "$DATABASE_URL" -f "$MIGRATION_FILE"; then
                print_success "Database migration completed ✓"
            else
                print_error "Database migration failed"
                echo "To retry manually:"
                echo "  psql \"\$DATABASE_URL\" -f $MIGRATION_FILE"
                exit 1
            fi
        fi
    fi
    
    # Final summary
    print_header "✅ Setup Complete!"
    
    echo "Next steps:"
    echo ""
    echo "1. Initialize the HD Wallet (generates master seed):"
    echo "   bun run scripts/init-hd-wallet.ts"
    echo ""
    echo "2. ⚠️  Back up the mnemonic shown during initialization"
    echo ""
    echo "3. Start the API server:"
    echo "   npm run dev:api"
    echo ""
    echo "4. Test wallet endpoints:"
    echo "   curl http://localhost:3003/api/wallet/health"
    echo ""
    echo "For more information, see: docs/operations/GCP_KMS_SETUP.md"
}

# Run main function
main "$@"
