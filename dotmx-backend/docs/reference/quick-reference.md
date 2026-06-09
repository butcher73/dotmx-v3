# ⚡ Quick Reference: Automated Deployment

## 🎯 Start Here (Pick One)

### If you want to... 
**...just activate deployment in 5 minutes:**
```bash
# 1. Generate SSH keys
bash scripts/generate-deploy-keys.sh

# 2. Add public key to server
ssh root@calgary.petaex.com
# Paste public key into: ~/.ssh/authorized_keys

# 3. Add GitHub Secrets (6 values from step 1)
# Go to GitHub → Settings → Secrets and variables → Actions

# 4. Deploy!
git push origin main
```

**...see what happens during deployment:**
- See [AUTOMATED_DEPLOYMENT_READY.md](./AUTOMATED_DEPLOYMENT_READY.md) - "Deployment Flow" section

**...troubleshoot a failed deployment:**
- See [docs/operations/GITHUB_ACTIONS_SETUP.md](./docs/operations/GITHUB_ACTIONS_SETUP.md) - "Troubleshooting" section

**...understand the full setup:**
- Read [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - comprehensive guide

**...manually deploy without GitHub Actions:**
```bash
# SSH to server
ssh deploy@calgary.petaex.com

# Deploy database
bash /opt/dotmx-backend/scripts/deploy-db.sh production

# Build and start services
cd /opt/dotmx-backend
bun install && bun run build
bash scripts/restart-services.sh
```

---

## 📋 Essential Info

| What | Where | Command |
|---|---|---|
| Generate SSH keys | Local | `bash scripts/generate-deploy-keys.sh` |
| Deploy database manually | Server | `bash scripts/deploy-db.sh production` |
| Restart services | Server | `bash scripts/restart-services.sh` |
| Check service status | Server | `curl http://localhost:3000/health` |
| View API logs | Server | `tail -f /var/log/dotmx/api.log` |
| View deployment | GitHub | Actions tab → Latest workflow |

---

## 🔑 GitHub Secrets Needed

```
DEPLOY_HOST       = calgary.petaex.com
DEPLOY_USER       = deploy
DEPLOY_SSH_KEY    = (from generate-deploy-keys.sh)
DEPLOY_PORT       = 22
DEPLOY_PATH       = /opt/dotmx-backend
SLACK_WEBHOOK     = (optional)
```

---

## 📂 Important Files

| File | Purpose |
|---|---|
| `.github/workflows/deploy.yml` | What GitHub Actions runs |
| `scripts/deploy-db.sh` | Database setup script |
| `scripts/restart-services.sh` | Start/stop services |
| `scripts/generate-deploy-keys.sh` | Create SSH keys |
| `.env.production.example` | Environment template |

---

## ✅ Deployment Checklist

- [ ] Run `bash scripts/generate-deploy-keys.sh`
- [ ] Add public key to server's `~/.ssh/authorized_keys`
- [ ] Test: `ssh -i ~/.ssh/dotmx_deploy deploy@calgary.petaex.com`
- [ ] Add 6 GitHub Secrets
- [ ] Push to main: `git push origin main`
- [ ] Watch GitHub Actions tab
- [ ] Verify: `curl http://calgary.petaex.com/health`

---

## 🚀 What Each Deployment Does

```
1. TESTS (on GitHub)
   - Installs dependencies
   - Runs 357 tests
   - Checks TypeScript types
   - ↓ If pass → deploy

2. DATABASE (on server)
   - Creates/updates 97 tables
   - Seeds VIP tiers
   - Configures perpetual fees
   - Requires production confirmation

3. BUILD (on server)
   - Installs dependencies
   - Builds TypeScript
   - Packages application

4. SERVICES (on server)
   - Kills old processes
   - Starts 3 services
   - Verifies health
   - Confirms running

5. NOTIFY (on GitHub)
   - Slack message
   - Success/failure status
```

---

## 🐛 Common Issues & Fixes

| Issue | Fix |
|---|---|
| "SSH Permission denied" | Verify private key in DEPLOY_SSH_KEY secret |
| "Bun not found" | `curl -fsSL https://bun.sh/install \| bash` on server |
| "DB connection failed" | Check .env.production, PostgreSQL running |
| "Port already in use" | `lsof -i :3000` then `kill -9 <PID>` |
| "Tests failing" | `bun test` locally, fix issues before push |

---

## 📞 Get Help

- **Setup Guide**: [docs/operations/GITHUB_ACTIONS_SETUP.md](./docs/operations/GITHUB_ACTIONS_SETUP.md)
- **Full Status**: [AUTOMATED_DEPLOYMENT_READY.md](./AUTOMATED_DEPLOYMENT_READY.md)
- **Checklist**: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- **Deployment Docs**: [docs/operations/DATABASE_DEPLOYMENT.md](./docs/operations/DATABASE_DEPLOYMENT.md)

---

## 🎯 Status: READY TO DEPLOY ✅

All code complete. Just need to:
1. Generate keys
2. Configure secrets
3. Push to main

That's it! 🚀
