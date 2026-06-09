#!/bin/bash
# =============================================================================
# DotMX Shared Shell Utilities
# =============================================================================
# Source this file in other scripts: source "$(dirname "$0")/lib/common.sh"

set -e

# -----------------------------------------------------------------------------
# Colors
# -----------------------------------------------------------------------------
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export BLUE='\033[0;34m'
export YELLOW='\033[1;33m'
export CYAN='\033[0;36m'
export NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------
log_info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error()   { echo -e "${RED}❌ $1${NC}"; }
log_step()    { echo -e "${CYAN}[$1] $2${NC}"; }

# -----------------------------------------------------------------------------
# Environment Loading
# -----------------------------------------------------------------------------
load_env() {
  local env_name="${1:-}"
  
  if [ -n "$env_name" ] && [ -f ".env.${env_name}" ]; then
    log_info "Loading .env.${env_name}"
    set -a
    source ".env.${env_name}"
    set +a
    return 0
  elif [ -f ".env" ]; then
    log_info "Loading .env"
    set -a
    source .env
    set +a
    return 0
  else
    log_error "No environment file found"
    return 1
  fi
}

# -----------------------------------------------------------------------------
# Database Utilities
# -----------------------------------------------------------------------------

# Build PostgreSQL connection string
# Usage: build_pg_conn <host> <port> <user> <password> <database>
build_pg_conn() {
  local host="${1:-localhost}"
  local port="${2:-5432}"
  local user="${3:-kowito}"
  local password="${4:-}"
  local database="${5:-postgres}"
  
  if [ -z "$password" ]; then
    echo "postgresql://${user}@${host}:${port}/${database}"
  else
    echo "postgresql://${user}:${password}@${host}:${port}/${database}"
  fi
}

# Check if PostgreSQL is accessible
# Usage: check_postgres <connection_string>
check_postgres() {
  local conn="${1:-postgresql://localhost:5432/postgres}"
  if psql "$conn" -c "SELECT 1" &>/dev/null; then
    return 0
  fi
  return 1
}

# Wait for PostgreSQL to be ready
# Usage: wait_for_postgres <host> <port> <user> [timeout_seconds]
wait_for_postgres() {
  local host="${1:-localhost}"
  local port="${2:-5432}"
  local user="${3:-kowito}"
  local timeout="${4:-30}"
  local elapsed=0
  
  log_info "Waiting for PostgreSQL at ${host}:${port}..."
  
  while [ $elapsed -lt $timeout ]; do
    if psql -h "$host" -p "$port" -U "$user" -d postgres -c "SELECT 1" &>/dev/null; then
      log_success "PostgreSQL is ready"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  
  log_error "PostgreSQL did not respond in ${timeout}s"
  return 1
}

# Create database if it doesn't exist
# Usage: ensure_database <connection_string> <database_name>
ensure_database() {
  local conn="$1"
  local db_name="$2"
  
  if psql "$conn" -tc "SELECT 1 FROM pg_database WHERE datname = '${db_name}'" | grep -q 1; then
    log_info "Database ${db_name} already exists"
  else
    psql "$conn" -c "CREATE DATABASE \"${db_name}\""
    log_success "Created database: ${db_name}"
  fi
}

# -----------------------------------------------------------------------------
# Port & Health Checks
# -----------------------------------------------------------------------------

# Check if a port is in use
# Usage: check_port <port>
check_port() {
  local port="$1"
  if nc -z localhost "$port" 2>/dev/null; then
    return 0  # Port is in use
  fi
  return 1  # Port is available
}

# Wait for a port to become available
# Usage: wait_for_port <port> [timeout_seconds]
wait_for_port() {
  local port="$1"
  local timeout="${2:-30}"
  local elapsed=0
  
  while [ $elapsed -lt $timeout ]; do
    if check_port "$port"; then
      log_success "Port $port is available"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  
  log_error "Port $port not available after ${timeout}s"
  return 1
}

# HTTP health check
# Usage: health_check <url> [max_attempts]
health_check() {
  local url="$1"
  local max_attempts="${2:-10}"
  local attempt=0
  
  while [ $attempt -lt $max_attempts ]; do
    if curl -sf "$url" > /dev/null 2>&1; then
      log_success "Health check passed: $url"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  
  log_warn "Health check failed after $max_attempts attempts: $url"
  return 1
}

# -----------------------------------------------------------------------------
# Docker Utilities
# -----------------------------------------------------------------------------

# Check if Docker is running
check_docker() {
  if docker ps &>/dev/null; then
    return 0
  fi
  log_error "Docker is not running"
  return 1
}

# -----------------------------------------------------------------------------
# Script Setup
# -----------------------------------------------------------------------------

# Get the root directory of the project
get_project_root() {
  local script_dir="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
  # Navigate up until we find package.json (project root)
  local dir="$script_dir"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/package.json" ]; then
      echo "$dir"
      return
    fi
    dir="$(dirname "$dir")"
  done
  # Fallback to two levels up from scripts/lib
  echo "$(cd "$script_dir/../.." && pwd)"
}

# Require confirmation for dangerous operations
# Usage: require_confirmation "Are you sure?"
require_confirmation() {
  local message="${1:-Are you sure you want to continue?}"
  echo -e "${YELLOW}$message${NC}"
  read -p "(yes/no): " -r
  if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
    log_warn "Operation cancelled"
    exit 0
  fi
}
