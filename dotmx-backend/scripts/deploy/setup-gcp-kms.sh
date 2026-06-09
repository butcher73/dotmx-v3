#!/bin/bash
# GCP KMS Setup Script for Custodial Wallet
# This script creates the required KMS resources
# Uses environment variables: GCP_PROJECT_ID, GCP_KMS_LOCATION, GCP_KMS_KEYRING, GCP_KMS_KEY_NAME

set -e

# Configuration - Uses environment variables or defaults
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
LOCATION="${GCP_KMS_LOCATION:-us-central1}"
KEY_RING="${GCP_KMS_KEYRING:-dotmx-wallet-keys}"
KEY_NAME="${GCP_KMS_KEY_NAME:-master-seed-kek}"

# Validate that PROJECT_ID is set properly
if [ "$PROJECT_ID" = "your-project-id" ]; then
    echo "❌ GCP_PROJECT_ID environment variable not set!"
    echo "   Please set it before running this script:"
    echo "   export GCP_PROJECT_ID=your-actual-project-id"
    echo "   Or pass via .env file and source it: source .env"
    exit 1
fi

echo "🔐 Setting up GCP KMS for Custodial Wallet System"
echo "================================================"
echo "Using environment variables:"
echo "Project:   $PROJECT_ID (GCP_PROJECT_ID)"
echo "Location:  $LOCATION (GCP_KMS_LOCATION)"
echo "Key Ring:  $KEY_RING (GCP_KMS_KEYRING)"
echo "Key Name:  $KEY_NAME (GCP_KMS_KEY_NAME)"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install it from https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check authentication
echo "📋 Checking GCP authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1; then
    echo "❌ Not authenticated. Run: gcloud auth login"
    exit 1
fi

# Set project
echo "📋 Setting project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

# Enable KMS API
echo "📋 Enabling Cloud KMS API..."
gcloud services enable cloudkms.googleapis.com

# Create key ring if it doesn't exist
echo "📋 Creating key ring: $KEY_RING..."
if gcloud kms keyrings describe "$KEY_RING" --location="$LOCATION" &> /dev/null; then
    echo "   Key ring already exists"
else
    gcloud kms keyrings create "$KEY_RING" --location="$LOCATION"
    echo "   ✅ Key ring created"
fi

# Create crypto key if it doesn't exist
echo "📋 Creating crypto key: $KEY_NAME..."
if gcloud kms keys describe "$KEY_NAME" --keyring="$KEY_RING" --location="$LOCATION" &> /dev/null; then
    echo "   Key already exists"
else
    gcloud kms keys create "$KEY_NAME" \
        --keyring="$KEY_RING" \
        --location="$LOCATION" \
        --purpose="encryption" \
        --protection-level="hsm" \
        --rotation-period="90d" \
        --next-rotation-time="$(date -u -v+90d '+%Y-%m-%dT%H:%M:%SZ')"
    echo "   ✅ Key created with HSM protection and 90-day rotation"
fi

# Create service account for the application
SERVICE_ACCOUNT="dotmx-wallet-service"
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com"

echo "📋 Creating service account: $SERVICE_ACCOUNT..."
if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" &> /dev/null; then
    echo "   Service account already exists"
else
    gcloud iam service-accounts create "$SERVICE_ACCOUNT" \
        --display-name="DotMX Wallet Service"
    echo "   ✅ Service account created"
fi

# Grant KMS permissions to service account
echo "📋 Granting KMS permissions..."
gcloud kms keys add-iam-policy-binding "$KEY_NAME" \
    --keyring="$KEY_RING" \
    --location="$LOCATION" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/cloudkms.cryptoKeyEncrypterDecrypter" \
    --quiet

echo "   ✅ Granted encrypt/decrypt permissions"

# Create key file for local development (optional)
KEY_FILE="./secrets/gcp-service-account.json"
echo ""
echo "📋 Creating service account key for local development..."
echo "   ⚠️  This key should NOT be committed to version control"
mkdir -p ./secrets
if [ -f "$KEY_FILE" ]; then
    echo "   Key file already exists at $KEY_FILE"
else
    gcloud iam service-accounts keys create "$KEY_FILE" \
        --iam-account="$SERVICE_ACCOUNT_EMAIL"
    echo "   ✅ Key file created at $KEY_FILE"
fi

echo ""
echo "================================================"
echo "✅ GCP KMS Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Add to your .env file:"
echo "   GCP_PROJECT_ID=$PROJECT_ID"
echo "   GCP_KMS_LOCATION=$LOCATION"
echo "   GCP_KMS_KEYRING=$KEY_RING"
echo "   GCP_KMS_KEY_NAME=$KEY_NAME"
echo ""
echo "2. For local development, set:"
echo "   export GOOGLE_APPLICATION_CREDENTIALS=$KEY_FILE"
echo ""
echo "3. For production, use Workload Identity or attach"
echo "   the service account to your GCE/GKE workload."
echo ""
echo "4. Run the database migration:"
echo "   psql \$DATABASE_URL -f scripts/migrations/001_custodial_wallet_system.sql"
echo ""
echo "5. Initialize the HD wallet (generates master seed):"
echo "   bun run scripts/init-hd-wallet.ts"
echo ""
echo "⚠️  IMPORTANT: Back up the mnemonic shown during initialization!"
echo "   Store it securely offline. It's the ONLY way to recover funds."
echo ""
