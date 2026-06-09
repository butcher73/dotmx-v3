# 🚀 DotMX Backend — Production Ready!

Full perpetual futures exchange backend with 10.6M ops/sec matching engine, all order types, funding rates, and liquidation automation.

## 🚀 Quick Start

Deploy everything with one command:

```bash
./deploy-production.sh
```

Or manually:

```bash
docker compose up -d
```

## 📋 What Was Configured

### ✅ Services & Ports

| Service | Internal Port | Public Access |
|---------|---------------|---------------|
| Kong API Gateway | 80, 443 | ✅ **Only exposed service** |
| API | 3003 | ❌ Via Kong `/api` |
| MarketData | 3002 | ❌ Via Kong `/market` |
| Management | 3004 | ❌ Via Kong `/api/management` |
| Engine | 3001 | ❌ Internal only |

### ✅ Kong Configuration (DB-less mode)

- Routes configured for all services
- Rate limiting with Redis
- CORS enabled
- Security headers
- IP restrictions for management
- Health checks

### ✅ Docker Compose

- All services use internal networking
- Only Kong exposed on ports 80/443
- Auto-restart enabled
- Health checks configured

## 📚 Documentation

- **[PRODUCTION_CONFIG.md](PRODUCTION_CONFIG.md)** - Complete configuration summary
- **[PRODUCTION_SETUP.md](PRODUCTION_SETUP.md)** - Detailed setup guide
- **[PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)** - Pre-deployment checklist
- **[ARCHITECTURE_DIAGRAM.txt](ARCHITECTURE_DIAGRAM.txt)** - System architecture

## 🔒 Security Tasks (IMPORTANT!)

Before deploying to production:

1. ⚠️ **Change database password** in `docker-compose.yml`
2. ⚠️ **Update admin API key** in `docker/kong.yml`
3. ⚠️ **Configure IP restrictions** for management API
4. ⚠️ **Update CORS origins** to your domains
5. ⚠️ **Remove demo consumers** from Kong config

See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for complete list.

## 🧪 Test Configuration

Validate your setup:

```bash
./test-production-config.sh
```

Validate Kong config:

```bash
./scripts/validate-kong-config.sh
```

## 🌐 Domain Setup

For `api.dotmx.xyz`:

1. Point DNS A record to your server IP
2. Configure SSL certificate (Let's Encrypt recommended)
3. Update CORS origins in `docker/kong.yml`

## 📊 Monitor Services

Check health:

```bash
curl http://localhost/health
curl http://localhost/api/health
curl http://localhost/market/health
```

View logs:

```bash
docker compose logs -f
docker compose logs -f kong
docker compose logs -f api
```

## 🎯 API Access

All services accessible through Kong:

```bash
# API endpoints
curl http://localhost/api/v1/...

# Market data
curl http://localhost/market/ticker/BTC-USDT

# WebSocket
wscat -c ws://localhost/market/ws

# Management (requires API key)
curl -H "X-Admin-Key: YOUR-KEY" http://localhost/api/management/...
```

## 🔄 Updates

Update and restart:

```bash
git pull
docker compose up -d --build
```

## 📖 Architecture

```
Internet
    ↓
Kong (Port 80/443) ← Only exposed
    ├─ /api → api:3003
    ├─ /market → marketdata:3002
    └─ /api/management → management:3004

Internal:
    - engine:3001 (not exposed)
    - nats:4222
    - redis:6379
    - postgres:5432
```

## ✨ Key Features

- ✅ Single entry point (Kong only)
- ✅ DB-less Kong (no database required)
- ✅ Declarative configuration
- ✅ Auto-restart on failure
- ✅ Health monitoring
- ✅ Rate limiting
- ✅ CORS support
- ✅ Security headers
- ✅ Request tracing
- ✅ IP restrictions

## 🎉 Ready to Deploy!

You're all set! Just run:

```bash
./deploy-production.sh
```

And your entire backend will start with Kong as the only exposed service on port 80.

---

Need help? Check the documentation files or run `./test-production-config.sh` to verify your setup.
