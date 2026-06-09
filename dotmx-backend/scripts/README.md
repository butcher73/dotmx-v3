# Scripts

Organized utility scripts for DotMX backend.

## Structure

```
scripts/
├── lib/
│   └── common.sh          # Shared shell utilities (source this in other scripts)
├── db/
│   ├── deploy-db.sh       # Production database deployment
│   ├── run-migration.sh   # Run any SQL migration
│   ├── setup-test.sh      # Recreate test databases
│   ├── test-connection.sh # Test database connections
│   ├── test-db.ts         # TypeScript test seeder
│   ├── init-db.sql        # Initial schema
│   └── migrations/        # SQL migration files
├── dev/
│   ├── start-docker.sh    # Start Docker services (PostgreSQL, Redis, NATS)
│   ├── start-services.sh  # Start all backend services
│   └── restart-services.sh# Restart services with health checks
├── deploy/
│   ├── setup-server.sh    # Bare metal server setup
│   ├── setup-gcp-kms.sh   # GCP KMS configuration
│   └── generate-deploy-keys.sh # SSH key generation for CI/CD
├── generate-openapi.ts    # Generate OpenAPI spec
├── init-hd-wallet.ts      # Initialize HD wallet
└── update-admin-password.ts # Update admin credentials
```

## Quick Start

### Development

```bash
# Start Docker services (PostgreSQL, Redis, NATS)
./scripts/dev/start-docker.sh

# Start all backend services
./scripts/dev/start-services.sh
```

### Database

```bash
# Test database connections
./scripts/db/test-connection.sh

# Setup test databases
./scripts/db/setup-test.sh

# Run a migration
./scripts/db/run-migration.sh chains-tokens
./scripts/db/run-migration.sh deposits-sweeps
```

### Deployment

```bash
# Setup bare metal server
sudo ./scripts/deploy/setup-server.sh

# Setup GCP KMS for wallet encryption
./scripts/deploy/setup-gcp-kms.sh

# Generate SSH keys for CI/CD
./scripts/deploy/generate-deploy-keys.sh
```

## Shared Utilities

All shell scripts should source the common library:

```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/common.sh"

# Now you can use:
log_info "Info message"
log_success "Success message"
log_warn "Warning message"
log_error "Error message"

load_env              # Load .env file
check_postgres        # Check PostgreSQL connection
wait_for_postgres     # Wait for PostgreSQL to be ready
check_docker          # Check if Docker is running
require_confirmation  # Prompt for confirmation
```
