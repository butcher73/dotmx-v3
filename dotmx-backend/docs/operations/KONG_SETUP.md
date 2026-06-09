# Kong API Gateway Setup for DotMX

## Overview

DotMX uses Kong API Gateway to provide:
- **API Authentication** via API keys with consumer groups
- **VIP Tier-Based Rate Limiting** with Redis backend (60-1200 req/min)
- **CORS** handling with configurable origins
- **Request/Response transformation** with security headers
- **Metrics** via Prometheus plugin (per-consumer tracking)
- **Request correlation** and distributed tracing
- **Security** features (IP restriction, HSTS, XSS protection)
- **Health checks** with circuit breaking (active + passive)
- **Load balancing** via upstreams with health monitoring

> 📖 For detailed rate limiting configuration, see [../api/kong-rate-limiting.md](../api/kong-rate-limiting.md)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Kong Gateway (Port 8000)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │   Plugins    │  │  Consumers   │  │      Upstreams            │ │
│  ├──────────────┤  ├──────────────┤  ├───────────────────────────┤ │
│  │ rate-limiting│  │ tier-0 users │  │ api-upstream (3001)       │ │
│  │ key-auth     │  │ tier-1 users │  │ marketdata-upstream (3002)│ │
│  │ prometheus   │  │ tier-3 users │  │ engine-upstream (9090)    │ │
│  │ cors         │  │ tier-5 users │  │                           │ │
│  │ ip-restrict  │  │ tier-7 users │  │ Health checks:            │ │
│  │ request-id   │  │              │  │ - Active: /health         │ │
│  │ correlation  │  │              │  │ - Passive: on failure     │ │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘ │
│                                                                     │
│                         ↓ Redis ↓                                   │
│                   (Distributed Rate Limit State)                    │
└─────────────────────────────────────────────────────────────────────┘
         │
    ┌────┴────┬──────────┐
    │         │          │
    ▼         ▼          ▼
┌────────┐ ┌─────────┐ ┌─────────┐
│   API  │ │ Market  │ │ Engine  │
│  :3001 │ │ Data    │ │ :9090   │
│        │ │ :3002   │ │ metrics │
└────────┘ └─────────┘ └─────────┘
```

## Configuration

### Production Setup

1. **Kong with PostgreSQL** (`docker-compose.yml`)
   - Full database-backed Kong for production
   - Supports dynamic configuration via Admin API
   - Persistent storage of configuration

2. **Services Configured**:
   - `dotmx-api` - Main API service
   - `engine-metrics` - Prometheus metrics
   - `marketdata-internal` - WebSocket market data

### Development Setup

1. **Kong DB-less mode** (`docker-compose.dev.yml`)
   - Uses declarative configuration (no database)
   - Faster startup
   - Configuration via `kong.dev.yml` file

## API Routes

### Public Routes

All routes are accessed through Kong at `http://localhost:8000`

#### Health Check (No Auth)
```bash
curl http://localhost:8000/api/health
```

#### Authenticated Routes (Require API Key)
```bash
# Place Order
curl -X POST http://localhost:8000/api/v1/orders \
  -H "apikey: demo-api-key-12345" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC-USDT",
    "side": "buy",
    "type": "limit",
    "price": 50000,
    "quantity": 0.1
  }'

# Get Order Status
curl http://localhost:8000/api/v1/orders/{orderId} \
  -H "apikey: demo-api-key-12345"

# Cancel Order
curl -X DELETE http://localhost:8000/api/v1/orders/{orderId} \
  -H "apikey: demo-api-key-12345"
```

### Metrics Endpoint (Internal Only)
```bash
# Prometheus metrics
curl http://localhost:8000/metrics
```

## API Keys

### Development Keys (from kong.dev.yml)
No authentication required in dev mode.

### Production Keys (from kong.yml)

Default demo keys (⚠️ **Change in production!**):

| Username | API Key | VIP Tier | Rate Limit |
|----------|---------|----------|------------|
| demo-user | `demo-api-key-12345` | Tier 0 | 60/min |
| test-user | `test-api-key-67890` | Tier 3 | 300/min |
| vip-trader | `vip-api-key-elite-99999` | Tier 7 | 1,200/min |

### Managing API Keys (Production)

#### Create a new consumer and API key:
```bash
# Create consumer
curl -X POST http://localhost:8001/consumers \
  --data "username=production-user"

# Create API key for consumer
curl -X POST http://localhost:8001/consumers/production-user/key-auth \
  --data "key=your-secure-api-key-here"
```

#### List all consumers:
```bash
curl http://localhost:8001/consumers
```

#### Revoke an API key:
```bash
curl -X DELETE http://localhost:8001/consumers/production-user/key-auth/{key-id}
```

## Rate Limits

### VIP Tier Rate Limits

Rate limits are now based on VIP tier via consumer groups:

| Tier | Type | Rate Limit | Hourly | Use Case |
|------|------|------------|--------|----------|
| 0 | Free | 60/min | 1,000/hr | Basic users, trials |
| 1 | Basic | 120/min | 2,000/hr | Retail traders |
| 3 | Standard | 300/min | 5,000/hr | Active traders |
| 5 | Premium | 600/min | 10,000/hr | Professional traders |
| 7 | VIP | 1,200/min | 30,000/hr | Market makers, institutions |

### Route-Specific Limits

| Route | Limit | Description |
|-------|-------|-------------|
| `/api/v1/auth/*` | 30/min | Auth endpoints (strict) |
| `/api/v1/market/*` | 300/min | Public market data |
| `/api/v1/trading/*` | 120/min | Order placement |
| `/api/v1/account/*` | 60/min | Account management |
| `/ws/stream` | 60/min | WebSocket connections |
| `/health` | 120/min | Health checks |

### Customize Rate Limits

Rate limiting now uses **Redis** by default for distributed state across Kong instances.

To modify VIP tier limits, edit `docker/kong.yml` consumer groups:

```yaml
consumer_groups:
  - name: vip-tier-0
    plugins:
      - name: rate-limiting-advanced
        config:
          limit:
            - 60      # per minute
            - 1000    # per hour
          window_size:
            - 60
            - 3600
          sync_rate: 10
          strategy: redis
          redis:
            host: redis
            port: 6379
```

For route-specific limits, update the route plugin:
```yaml
routes:
  - name: api-trading
    plugins:
      - name: rate-limiting
        config:
          minute: 120
          hour: 3000
          policy: redis
          redis_host: redis
          redis_port: 6379
          limit_by: consumer  # Uses VIP tier
```

## Plugins Enabled

### Global Plugins
- **Prometheus** - Metrics collection
- **Request ID** - Unique ID for each request
- **Correlation ID** - Request correlation across services

### Route-Specific Plugins

#### CORS
Configured for all routes with:
- Allowed origins: `*` (customize in production)
- Credentials support
- Common headers allowed

#### Key Authentication
- Header: `apikey`
- Query parameter: `?apikey=xxx`
- Credentials hidden from upstream

#### Request Size Limiting
- Max payload: 1 MB
- Prevents large request attacks

#### Request Transformer
Adds headers:
- `X-Gateway: kong`
- `X-Request-ID: <uuid>`

#### IP Restriction (Metrics)
- Only internal networks can access `/metrics`
- Allowed: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16

## Running Kong

### Start Production Stack
```bash
cd dotmx-backend

# Start all services including Kong
docker compose up -d

# Check Kong status
docker compose ps kong
docker compose logs kong

# Access Kong Admin API
curl http://localhost:8001/
```

### Start Development Stack
```bash
# Start dev services
docker compose -f docker-compose.dev.yml up -d

# Kong is accessible at port 8000
curl http://localhost:8000/api/health
```

### Verify Kong Configuration
```bash
# Check loaded services
curl http://localhost:8001/services

# Check loaded routes
curl http://localhost:8001/routes

# Check loaded plugins
curl http://localhost:8001/plugins

# Check consumers
curl http://localhost:8001/consumers
```

## Monitoring Kong

### Prometheus Metrics
Kong exposes metrics at:
```bash
curl http://localhost:8001/metrics
```

Metrics include:
- Request count per service/route
- Latency percentiles (p50, p95, p99)
- Bandwidth usage
- HTTP status codes
- Kong uptime

### Kong Admin API
Available at `http://localhost:8001`

Key endpoints:
- `/status` - Kong status
- `/services` - All services
- `/routes` - All routes
- `/consumers` - All consumers
- `/plugins` - All plugins
- `/upstreams` - Upstream health

## Security Best Practices

### Production Checklist

- [ ] Change default API keys
- [ ] Use HTTPS (port 8443) with valid SSL certificates
- [ ] Restrict Admin API access (port 8001) to internal network only
- [ ] Enable rate limiting with Redis for distributed systems
- [ ] Set up proper CORS origins (don't use `*`)
- [ ] Enable IP whitelisting for sensitive endpoints
- [ ] Use strong authentication (consider OAuth2 or JWT plugins)
- [ ] Enable request/response logging for audit
- [ ] Set up monitoring and alerting
- [ ] Regular security updates for Kong image

### SSL/TLS Configuration

For production HTTPS:

1. Add SSL certificates to volume:
```yaml
volumes:
  - ./certs:/etc/kong/certs:ro
```

2. Update Kong environment:
```yaml
environment:
  KONG_SSL_CERT: /etc/kong/certs/server.crt
  KONG_SSL_CERT_KEY: /etc/kong/certs/server.key
```

3. Access via HTTPS:
```bash
curl https://localhost:8443/api/health
```

## Troubleshooting

### Kong won't start
```bash
# Check database connection
docker compose logs kong-db

# Check migrations
docker compose logs kong-migrations

# Verify Kong config
docker compose exec kong kong check /etc/kong/kong.yml
```

### Routes not working
```bash
# Reload declarative config
docker compose exec kong kong reload

# Check route configuration
curl http://localhost:8001/routes

# Check service configuration
curl http://localhost:8001/services
```

### API returning 401 Unauthorized
```bash
# Verify API key exists
curl http://localhost:8001/consumers/demo-user/key-auth

# Check plugin is enabled
curl http://localhost:8001/routes/api-public/plugins

# Test with correct header
curl -H "apikey: demo-api-key-12345" http://localhost:8000/api/v1/orders
```

### Rate limit errors
```bash
# Check current rate limit config
curl http://localhost:8001/plugins | grep rate-limiting

# Check if consumer has rate limit override
curl http://localhost:8001/consumers/demo-user/plugins
```

## Advanced Configuration

### Custom Plugins

To add custom plugins:

1. Create plugin directory:
```bash
mkdir -p docker/kong-plugins
```

2. Update Kong Dockerfile to include custom plugins

3. Update `KONG_PLUGINS` environment variable to include your plugin name

### Multi-Environment Setup

For different environments (staging, production):

1. Create environment-specific configs:
   - `kong.staging.yml`
   - `kong.production.yml`

2. Use environment variables in docker-compose:
```yaml
environment:
  KONG_DECLARATIVE_CONFIG: /etc/kong/kong.${ENV}.yml
```

### Load Balancing

For multiple API instances:

```yaml
services:
  - name: dotmx-api-cluster
    url: http://api-upstream
    # Kong will load balance across targets
upstreams:
  - name: api-upstream
    targets:
      - target: api-1:3001
      - target: api-2:3001
      - target: api-3:3001
```

## References

- [Kong Documentation](https://docs.konghq.com/)
- [Kong Plugins Hub](https://docs.konghq.com/hub/)
- [Kong Admin API Reference](https://docs.konghq.com/gateway/latest/admin-api/)
- [Kong Declarative Configuration](https://docs.konghq.com/gateway/latest/production/deployment-topologies/db-less-and-declarative-config/)
