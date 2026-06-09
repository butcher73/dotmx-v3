# Production Deployment Checklist

Use this checklist before deploying to production.

## 🔒 Security (CRITICAL)

- [ ] **Change default passwords**
  - [ ] PostgreSQL password in `docker-compose.yml`
  - [ ] Update `DATABASE_URL` with new password
  
- [ ] **Update API keys**
  - [ ] Change admin key in `docker/kong.yml` (consumer section)
  - [ ] Generate strong API keys for production users
  - [ ] Remove demo/test consumers from `docker/kong.yml`

- [ ] **Configure IP restrictions**
  - [ ] Update management API allowed IPs in `docker/kong.yml`
  - [ ] Add your office/VPN IP addresses
  - [ ] Remove development IP ranges if not needed

- [ ] **CORS Configuration**
  - [ ] Update allowed origins in `docker/kong.yml`
  - [ ] Replace `"*"` with specific domains:
    - `https://dotmx.xyz`
    - `https://app.dotmx.xyz`
    - Add others as needed

## 🌐 Domain & SSL

- [ ] **DNS Configuration**
  - [ ] Point `api.dotmx.xyz` to server IP
  - [ ] Verify DNS propagation

- [ ] **SSL Certificate** (Recommended)
  - [ ] Install certbot or use your SSL provider
  - [ ] Generate certificate for api.dotmx.xyz
  - [ ] Mount certificate in Kong container
  - [ ] Update Kong to use HTTPS

## ⚙️ Configuration

- [ ] **Environment Variables**
  - [ ] Review all environment variables in `docker-compose.yml`
  - [ ] Set `NODE_ENV=production`
  - [ ] Configure proper database connection strings

- [ ] **Rate Limiting**
  - [ ] Review rate limits in `docker/kong.yml`
  - [ ] Adjust based on expected traffic
  - [ ] Configure Redis for rate limiting

- [ ] **Resource Limits** (Optional)
  - [ ] Add memory limits to services in `docker-compose.yml`
  - [ ] Configure CPU limits if needed

## � Perpetual Features Configuration

- [ ] **Funding Rates** (8-hour intervals)
  - [ ] Configure `priceProvider` for mark/index prices
  - [ ] Set `activeSymbols` list (e.g., BTC-USD, ETH-USD)
  - [ ] Verify funding scheduler starts on service init
  - [ ] Monitor funding settlement in database

- [ ] **Liquidation Service**
  - [ ] Configure `markPriceProvider` for real-time prices
  - [ ] Set `liquidationFeeRate` (typically 0.05 = 5%)
  - [ ] Set `checkIntervalMs` (suggested: 5000ms = 5 seconds)
  - [ ] Configure insurance fund wallet address
  - [ ] Test liquidation on staging environment
  - [ ] Document ADL (auto-deleveraging) procedures

- [ ] **Margin & Risk**
  - [ ] Set `initialMarginPercent` per symbol (e.g., 5% for 20x leverage)
  - [ ] Set `maintenanceMarginPercent` (typically 50% of initial)
  - [ ] Configure leverage range per symbol (e.g., 1x-50x)
  - [ ] Test margin checks on staging with real positions

## �📊 Monitoring & Logging

- [ ] **Log Aggregation**
  - [ ] Set up log collection (e.g., ELK, Loki)
  - [ ] Configure log rotation

- [ ] **Metrics**
  - [ ] Set up Prometheus scraping
  - [ ] Configure Grafana dashboards
  - [ ] Set up alerts

- [ ] **Health Checks**
  - [ ] Verify all health check endpoints work
  - [ ] Set up external monitoring (UptimeRobot, etc.)

## 💾 Backup & Recovery

- [ ] **Database Backups**
  - [ ] Set up automated PostgreSQL backups
  - [ ] Test restore procedure
  - [ ] Store backups off-site

- [ ] **Configuration Backups**
  - [ ] Back up Kong configuration
  - [ ] Back up environment variables
  - [ ] Document custom configurations

## 🧪 Testing

- [ ] **Pre-deployment Tests**
  - [ ] Validate Kong configuration: `./scripts/validate-kong-config.sh`
  - [ ] Test all API endpoints
  - [ ] Test WebSocket connections
  - [ ] Verify rate limiting works
  - [ ] Test authentication/authorization

- [ ] **Load Testing**
  - [ ] Run performance tests
  - [ ] Verify system handles expected load
  - [ ] Test failover scenarios

## 🚀 Deployment

- [ ] **Server Preparation**
  - [ ] Install Docker and Docker Compose
  - [ ] Configure firewall (allow 80, 443)
  - [ ] Set up SSH access
  - [ ] Create deployment user

- [ ] **Initial Deployment**
  - [ ] Clone repository on server
  - [ ] Review and update all configurations
  - [ ] Build images: `docker compose build`
  - [ ] Start services: `docker compose up -d`

- [ ] **Post-deployment Verification**
  - [ ] Check all services are running: `docker compose ps`
  - [ ] Verify health checks pass
  - [ ] Test API from external network
  - [ ] Check logs for errors

## 📝 Documentation

- [ ] **Internal Documentation**
  - [ ] Document deployment procedure
  - [ ] Document rollback procedure
  - [ ] Document incident response
  - [ ] Create runbook for common issues

- [ ] **Access Documentation**
  - [ ] Document API endpoints
  - [ ] Document authentication method
  - [ ] Share API keys securely (use vault)

## 🔄 Maintenance

- [ ] **Update Strategy**
  - [ ] Plan for zero-downtime deployments
  - [ ] Set up staging environment
  - [ ] Document update procedure

- [ ] **Monitoring Schedule**
  - [ ] Daily: Check service health
  - [ ] Weekly: Review logs and metrics
  - [ ] Monthly: Security updates
  - [ ] Quarterly: Full system review

## ⚡ Performance Optimization

- [ ] **Redis Configuration**
  - [ ] Configure Redis persistence
  - [ ] Set up Redis clustering (if needed)
  - [ ] Optimize memory usage

- [ ] **Database Optimization**
  - [ ] Configure PostgreSQL performance tuning
  - [ ] Set up connection pooling
  - [ ] Create necessary indexes

- [ ] **Caching**
  - [ ] Configure Kong proxy cache settings
  - [ ] Set appropriate TTLs
  - [ ] Monitor cache hit rates

## 🔐 Compliance & Legal

- [ ] **Data Protection**
  - [ ] Ensure GDPR compliance (if applicable)
  - [ ] Implement data retention policies
  - [ ] Set up data encryption

- [ ] **Security Audit**
  - [ ] Run security scan
  - [ ] Review access controls
  - [ ] Document security measures

## ✅ Final Checks

- [ ] All services starting successfully
- [ ] Health checks passing
- [ ] No errors in logs
- [ ] External access working
- [ ] SSL certificate valid
- [ ] Rate limiting working
- [ ] Authentication working
- [ ] Monitoring active
- [ ] Backups configured
- [ ] Team notified

---

## Quick Commands

### Deployment
```bash
./deploy-production.sh
```

### Health Check
```bash
curl https://api.dotmx.xyz/health
curl https://api.dotmx.xyz/api/health
curl https://api.dotmx.xyz/market/health
```

### View Logs
```bash
docker compose logs -f
```

### Restart Services
```bash
docker compose restart kong
docker compose restart api
```

### Backup Database
```bash
docker exec dotmx-postgres pg_dump -U dotmx dotmx > backup-$(date +%Y%m%d).sql
```

### Update Services
```bash
git pull
docker compose up -d --build
```

---

## Need Help?

- 📚 [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md) - Detailed setup guide
- 📋 [PRODUCTION_CONFIG.md](PRODUCTION_CONFIG.md) - Configuration summary
- 🏗️ [ARCHITECTURE_DIAGRAM.txt](ARCHITECTURE_DIAGRAM.txt) - System architecture

## Support Contacts

- DevOps Lead: [Add contact]
- System Admin: [Add contact]
- On-call Engineer: [Add contact]
