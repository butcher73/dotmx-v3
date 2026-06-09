# GitHub Actions CI/CD Setup Guide

This guide explains how to configure GitHub Secrets and SSH keys for automated deployment to your bare metal server (calgary.petaex.com).

## Prerequisites

- GitHub repository with admin/settings access
- Bare metal server SSH access
- SSH key pair (can generate new one)

## Step 1: Generate SSH Key Pair

If you don't already have an SSH key pair, generate one:

```bash
# Generate SSH key (press Enter for default location and no passphrase)
ssh-keygen -t rsa -b 4096 -f ~/.ssh/dotmx_deploy -C "dotmx-deploy"

# This creates:
# ~/.ssh/dotmx_deploy (private key - keep secret!)
# ~/.ssh/dotmx_deploy.pub (public key - goes on server)
```

## Step 2: Add Public Key to Bare Metal Server

On your bare metal server (calgary.petaex.com):

```bash
# Log in to the server
ssh root@calgary.petaex.com

# Create .ssh directory if it doesn't exist
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add your public key to authorized_keys
# Option A: Copy and paste the contents of ~/.ssh/dotmx_deploy.pub into:
echo "paste-public-key-content-here" >> ~/.ssh/authorized_keys

# Option B: From your local machine, use ssh-copy-id
ssh-copy-id -i ~/.ssh/dotmx_deploy.pub deploy@calgary.petaex.com

# Set correct permissions
chmod 600 ~/.ssh/authorized_keys

# Test the connection
ssh -i ~/.ssh/dotmx_deploy deploy@calgary.petaex.com "echo 'SSH Key works!'"
```

## Step 3: Add GitHub Secrets

In your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add each of the following:

### Required Secrets

#### 1. DEPLOY_HOST
- **Value:** `calgary.petaex.com`
- **Description:** The hostname or IP of your bare metal server

#### 2. DEPLOY_USER
- **Value:** `deploy` (or your SSH username)
- **Description:** The username for SSH authentication

#### 3. DEPLOY_SSH_KEY
- **Value:** Contents of `~/.ssh/dotmx_deploy` (the private key)
- **How to get it:**
  ```bash
  cat ~/.ssh/dotmx_deploy
  ```
- **Important:** Copy the entire file content including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`
- **⚠️ Security:** Never commit this to git, keep it secret!

#### 4. DEPLOY_PORT
- **Value:** `22` (or your custom SSH port)
- **Description:** SSH port on the bare metal server

#### 5. DEPLOY_PATH
- **Value:** `/opt/dotmx-backend` (or wherever you want the code deployed)
- **Description:** The deployment directory on the bare metal server

#### 6. SLACK_WEBHOOK (Optional)
- **Value:** Your Slack webhook URL
- **Description:** For deployment notifications (optional, can skip)
- **How to set up:**
  1. Create a Slack App at https://api.slack.com/apps
  2. Enable Incoming Webhooks
  3. Create a webhook for your channel
  4. Copy the URL as the secret value

## Step 4: Verify Server Setup

Before first deployment, ensure your server has prerequisites:

```bash
ssh deploy@calgary.petaex.com << 'EOF'
# Check required tools
echo "=== System Check ==="
bun --version && echo "✓ Bun installed" || echo "✗ Bun NOT installed"
git --version && echo "✓ Git installed" || echo "✗ Git NOT installed"
psql --version && echo "✓ PostgreSQL installed" || echo "✗ PostgreSQL NOT installed"
curl --version && echo "✓ Curl installed" || echo "✗ Curl NOT installed"

# Check directories
echo ""
echo "=== Directory Check ==="
ls -la /opt/dotmx-backend 2>/dev/null && echo "✓ /opt/dotmx-backend exists" || echo "✗ /opt/dotmx-backend NOT exists"
mkdir -p /var/log/dotmx && echo "✓ /var/log/dotmx ready"

# Check permissions
echo ""
echo "=== Permissions Check ==="
id && echo "✓ SSH login works"
EOF
```

## Step 5: First Deployment

After adding all secrets, trigger your first deployment:

```bash
# Option A: Push to main/master branch
git push origin main

# Option B: Manually trigger from GitHub
# 1. Go to Actions tab
# 2. Select "Deploy to Production" workflow
# 3. Click "Run workflow"
```

## Step 6: Monitor Deployment

1. Go to your GitHub repository
2. Click **Actions** tab
3. Find the workflow run
4. Click on it to see real-time logs:
   - **Test job**: Bun installation, tests, typecheck
   - **Deploy job**: SSH connection, database deployment, build, restart services
   - **Notify job**: Slack notification (if configured)

## Troubleshooting

### SSH Connection Failed
```
Error: "Permission denied (publickey)"
```
**Solution:**
- Verify the private key is exactly correct (copied all of it)
- Check authorized_keys on server: `cat ~/.ssh/authorized_keys`
- Verify key permissions: `chmod 600 ~/.ssh/authorized_keys`
- Test locally: `ssh -i ~/.ssh/dotmx_deploy deploy@calgary.petaex.com`

### Bun Not Found on Server
```
Error: "command not found: bun"
```
**Solution:**
- Install Bun on server: `curl -fsSL https://bun.sh/install | bash`
- Or use the setup script: `bash scripts/setup-server.sh`

### PostgreSQL Connection Failed
```
Error: "FATAL: could not connect to server"
```
**Solution:**
- Ensure PostgreSQL is running: `systemctl status postgresql`
- Check environment variables in .env.production
- Verify database exists: `psql -l`

### Port Already in Use
```
Error: "Address already in use"
```
**Solution:**
- The restart-services.sh script kills existing processes
- Check for orphaned processes: `lsof -i :3000`
- Manual kill: `kill -9 $(lsof -t -i :3000)`

### Secrets Not Working
```
Error: "DEPLOY_SSH_KEY is not set"
```
**Solution:**
- Verify all secrets were added: Settings → Secrets and variables → Actions
- Check secret names match workflow exactly
- Common mistake: Copying from GitHub UI adds extra whitespace

## Workflow Diagram

```
Developer pushes to main
    ↓
GitHub Actions triggered
    ↓
Test Job Runs
  ├─ bun install
  ├─ bun test (357 tests)
  └─ bun typecheck
    ↓
Tests Pass?
  ├─ No → Notify on failure, stop
  └─ Yes → Continue
    ↓
Deploy Job Runs
  ├─ SSH to calgary.petaex.com
  ├─ git fetch && git reset
  ├─ bash scripts/deploy-db.sh production
  ├─ bun install && bun run build
  └─ bash scripts/restart-services.sh
    ↓
Services Running?
  ├─ No → Check logs at /var/log/dotmx
  └─ Yes → Notify success
    ↓
Slack Notification (if configured)
```

## Workflow Files

### `.github/workflows/deploy.yml`
Main CI/CD workflow triggered on push to main/master or manual dispatch.

**Jobs:**
1. **test**: Validates code and tests
2. **deploy**: Deploys to production (requires test success)
3. **notify**: Sends Slack notification

### `scripts/deploy-db.sh`
Database deployment script supporting multiple environments:
- `production`: Requires manual confirmation
- `staging`: Automatic deployment
- `dev`: Automatic deployment with verbose output

### `scripts/restart-services.sh`
Service management script that:
- Kills existing processes
- Starts 3 services (API, Engine, Market Data)
- Verifies health checks
- Confirms all services running

## Environment Variables

Create `.env.production` on the server with:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=dotmx
DB_PASSWORD=your-secure-password
DB_NAME_USERS=dotmx_users
DB_NAME_EXCHANGE=dotmx

# API Server
API_PORT=3000
API_HOST=localhost

# Engine Server
ENGINE_PORT=3001
ENGINE_HOST=localhost

# Market Data Server
MARKETDATA_PORT=3002
MARKETDATA_HOST=localhost

# Authentication
JWT_SECRET=your-jwt-secret-key-min-32-chars
JWT_EXPIRES_IN=24h

# Redis
REDIS_URL=redis://localhost:6379

# NATS
NATS_URL=nats://localhost:4222

# Logging
LOG_LEVEL=info
LOG_DIR=/var/log/dotmx
```

## Next Steps

1. ✅ Generate SSH key pair
2. ✅ Add public key to server's authorized_keys
3. ✅ Add 6 secrets to GitHub
4. ✅ Verify server has prerequisites
5. ✅ Push to main branch to trigger first deployment
6. ✅ Monitor Actions tab for deployment status
7. ✅ Verify services running: `curl http://calgary.petaex.com/health`

## Support

For issues, check:
- GitHub Actions logs (Settings → Actions → Run workflow)
- Server logs: `ssh deploy@calgary.petaex.com tail -f /var/log/dotmx/*.log`
- Database status: `ssh deploy@calgary.petaex.com psql -l`
- Service status: `ssh deploy@calgary.petaex.com lsof -i :3000`
