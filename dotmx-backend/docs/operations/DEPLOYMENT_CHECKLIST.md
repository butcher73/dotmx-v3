# Automated Deployment Checklist

Your GitHub Actions CI/CD pipeline is ready! Follow these steps to enable automated deployments to calgary.petaex.com.

## ✅ Completed Setup

- [x] GitHub Actions workflow created (`.github/workflows/deploy.yml`)
- [x] Database deployment script created (`scripts/deploy-db.sh`)
- [x] Service restart script created (`scripts/restart-services.sh`)
- [x] Server setup script created (`scripts/setup-server.sh`)
- [x] Key generation script created (`scripts/generate-deploy-keys.sh`)
- [x] GitHub Actions setup guide created (`docs/operations/GITHUB_ACTIONS_SETUP.md`)
- [x] All code committed and pushed to main branch

## 🚀 Quick Start (5 minutes)

### Step 1: Generate SSH Keys (2 min)

```bash
bash scripts/generate-deploy-keys.sh
```

This will:
- Generate SSH key pair
- Display the public key (for server)
- Display the private key (for GitHub Secrets)
- Show instructions

### Step 2: Configure Server Access (2 min)

SSH into your server and add the public key:

```bash
ssh root@calgary.petaex.com

# Add public key to authorized_keys
echo "PASTE-PUBLIC-KEY-HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Test connection:
```bash
ssh -i ~/.ssh/dotmx_deploy deploy@calgary.petaex.com "echo 'Success!'"
```

### Step 3: Add GitHub Secrets (1 min)

Go to **GitHub Repo → Settings → Secrets and variables → Actions** and add:

| Secret Name | Value |
|---|---|
| `DEPLOY_HOST` | `calgary.petaex.com` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | *Contents of private key from Step 1* |
| `DEPLOY_PORT` | `22` |
| `DEPLOY_PATH` | `/opt/dotmx-backend` |
| `SLACK_WEBHOOK` | *(optional - for notifications)* |

## 📋 Before First Deployment

Ensure your server has these tools installed:

```bash
ssh deploy@calgary.petaex.com << 'EOF'
# Check prerequisites
bun --version   # Required: Bun runtime
git --version   # Required: Git
psql --version  # Required: PostgreSQL client
curl --version  # Required: For health checks

# Create required directories
mkdir -p /var/log/dotmx
mkdir -p /var/run/dotmx
EOF
```

**Option A (Recommended):** Run complete server setup:
```bash
# On your server (as root)
wget https://raw.githubusercontent.com/YOUR-REPO/main/scripts/setup-server.sh
bash setup-server.sh
```

**Option B:** Install prerequisites manually on server:
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Install PostgreSQL (if not already installed)
sudo apt-get install -y postgresql postgresql-contrib

# Install other tools
sudo apt-get install -y git curl nginx redis-server
```

## 🎯 Trigger Deployment

### Option 1: Push to main (Recommended)
```bash
git push origin main
```

### Option 2: Manual trigger from GitHub
1. Go to **Actions** tab
2. Select **Deploy to Production**
3. Click **Run workflow**
4. Click the running workflow to watch logs

## 📊 Monitor Deployment

1. **GitHub Actions Tab**: Watch real-time logs
   - Test job: Runs `bun test` (357 tests)
   - Deploy job: Deploys code and database
   - Notify job: Sends Slack notification

2. **Server Logs**:
   ```bash
   ssh deploy@calgary.petaex.com tail -f /var/log/dotmx/*.log
   ```

3. **Service Status**:
   ```bash
   curl http://calgary.petaex.com/health
   ```

## 🔍 What Happens on Deployment

1. **Test Phase** (GitHub Actions)
   - Downloads code
   - `bun install` installs dependencies
   - `bun test` runs 357 tests
   - `bun run typecheck` checks TypeScript
   - ✅ If all pass → Deploy phase starts

2. **Deploy Phase** (SSH to calgary.petaex.com)
   - Connect via SSH using DEPLOY_SSH_KEY
   - Clone/update repository
   - Run `bash scripts/deploy-db.sh production` (requires manual confirmation on first run)
   - Run `bun install && bun run build` 
   - Run `bash scripts/restart-services.sh` to restart services

3. **Verify Phase**
   - Health check on API server (:3000)
   - Health check on Engine server (:3001)
   - Health check on Market Data server (:3002)

4. **Notify Phase** (Optional)
   - Send Slack notification if webhook configured

## 📁 Key Files

| File | Purpose |
|---|---|
| `.github/workflows/deploy.yml` | GitHub Actions workflow - triggers on push |
| `scripts/deploy-db.sh` | Database deployment with seed data |
| `scripts/restart-services.sh` | Service manager - kills, starts, verifies services |
| `scripts/setup-server.sh` | Server initialization script |
| `scripts/generate-deploy-keys.sh` | SSH key generation helper |
| `docs/operations/GITHUB_ACTIONS_SETUP.md` | Detailed setup guide |

## 🐛 Troubleshooting

### "SSH Permission Denied"
- Verify private key content in DEPLOY_SSH_KEY secret (should include -----BEGIN/END lines)
- Check authorized_keys on server: `cat ~/.ssh/authorized_keys`
- Test locally: `ssh -i ~/.ssh/dotmx_deploy deploy@calgary.petaex.com`

### "Bun not found"
- Run setup script: `bash scripts/setup-server.sh` on server
- Or manually: `curl -fsSL https://bun.sh/install | bash`

### "Database connection failed"
- Check DB_HOST/PORT in .env.production on server
- Verify PostgreSQL is running: `systemctl status postgresql`
- Check environment variables exported

### "Port already in use"
- restart-services.sh kills existing processes
- Manual cleanup: `lsof -i :3000` then `kill -9 <PID>`

### "Tests failing locally but not in GitHub Actions"
- Ensure Bun version matches: `bun --version`
- Run locally: `bun test` should pass before pushing

## ✨ After First Successful Deployment

1. ✅ Verify services running: `curl http://calgary.petaex.com/health`
2. ✅ Check logs: `tail -f /var/log/dotmx/api.log`
3. ✅ Test API endpoints
4. ✅ Set up automated backups (optional)
5. ✅ Configure monitoring/alerts (optional)

## 📞 Support

For detailed information, see:
- **Setup Guide**: [docs/operations/GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md)
- **Database Deployment**: [docs/operations/DATABASE_DEPLOYMENT.md](./DATABASE_DEPLOYMENT.md)
- **Deployment Guide**: [docs/operations/DEPLOYMENT.md](./DEPLOYMENT.md)
- **API Documentation**: [docs/api/API.md](../api/API.md)

---

**Status:** ✅ Ready for automated CI/CD deployment

**Next Action:** Run `bash scripts/generate-deploy-keys.sh` to get started!
