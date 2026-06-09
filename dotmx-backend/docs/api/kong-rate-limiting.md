# Kong Rate Limiting & API Gateway Configuration

## Overview

DotMX uses Kong API Gateway for all infrastructure-level concerns:

- **Rate Limiting**: VIP tier-based limits with Redis backend
- **Authentication**: API key validation with consumer groups
- **Load Balancing**: Upstream health checks and circuit breaking
- **Security**: IP filtering, security headers, CORS
- **Observability**: Prometheus metrics, request tracing

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
```

## VIP Tier Rate Limits

| Tier | Type | Rate Limit | Use Case |
|------|------|------------|----------|
| 0 | Free | 60/min | Basic users, trials |
| 1 | Basic | 120/min | Retail traders |
| 3 | Standard | 300/min | Active traders |
| 5 | Premium | 600/min | Professional traders |
| 7 | VIP | 1200/min | Market makers, institutions |

### Consumer Group Configuration

```yaml
consumer_groups:
  - name: vip-tier-0
    plugins:
      - name: rate-limiting-advanced
        config:
          limit: [60]
          window_size: [60]
          sync_rate: 10

  - name: vip-tier-7
    plugins:
      - name: rate-limiting-advanced
        config:
          limit: [1200]
          window_size: [60]
          sync_rate: 10
```

## Route-Specific Rate Limits

Different endpoints have different base rate limits (before VIP multiplier):

| Route | Base Limit | Description |
|-------|------------|-------------|
| `/api/v1/auth/*` | 10/min | Authentication endpoints |
| `/api/v1/markets/*` | 120/min | Public market data |
| `/api/v1/trading/*` | 60/min | Order placement |
| `/api/v1/account/*` | 60/min | Account management |
| `/ws/stream` | 10/min | WebSocket connections |
| `/metrics` | IP restricted | Internal only |

## Health Checks

### Active Health Checks
- **Interval**: Every 5 seconds
- **Threshold**: 2 successes to mark healthy
- **Endpoint**: `/health`
- **Timeout**: 3 seconds

### Passive Health Checks (Circuit Breaker)
- **Unhealthy threshold**: 3 failures
- **Timeouts count as failures**: Yes
- **HTTP failures tracked**: 429, 500, 502, 503

## Security Headers

All responses include:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## IP Filtering

Internal endpoints (`/metrics`) are restricted to:
- `10.0.0.0/8` (Private)
- `172.16.0.0/12` (Docker)
- `192.168.0.0/16` (Private)
- `127.0.0.1` (Localhost)

## Request Tracing

Every request gets:
- `X-Request-ID`: UUID for request tracking
- `X-Correlation-ID`: UUID for distributed tracing
- `X-Gateway`: Identifier (`kong`)

## Development vs Production

### Development (`kong.dev.yml`)
- Rate limit: 10,000/min (effectively unlimited)
- No authentication required
- CORS allows all origins
- All endpoints accessible

### Production (`kong.yml`)
- Tiered rate limiting with Redis
- API key authentication required
- CORS restricted to approved origins
- Internal endpoints IP-restricted

## Redis Configuration

For production, configure Redis in docker-compose:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  kong:
    environment:
      KONG_RATE_LIMITING_REDIS_HOST: redis
      KONG_RATE_LIMITING_REDIS_PORT: 6379
```

## Prometheus Metrics

Kong exposes metrics at `:8001/metrics`:

- `kong_http_requests_total` - Total requests by consumer
- `kong_http_status` - HTTP status codes
- `kong_latency_*` - Latency histograms
- `kong_bandwidth` - Bandwidth usage
- `kong_upstream_target_health` - Upstream health status

## Troubleshooting

### Rate Limit Exceeded
```bash
# Check current limits
curl -I http://localhost:8000/api/v1/markets
# Look for: X-RateLimit-Remaining header
```

### Consumer Not Found
```bash
# Verify API key
curl http://localhost:8001/consumers
curl http://localhost:8001/consumers/{username}/key-auth
```

### Upstream Unhealthy
```bash
# Check upstream health
curl http://localhost:8001/upstreams/api-upstream/health
```

## Migration from App-Level Rate Limiting

The application-level rate limiter (`packages/api/src/middleware/ratelimit.ts`) has been removed. All rate limiting is now handled by Kong, providing:

1. **Consistent enforcement** across all services
2. **Distributed state** via Redis
3. **VIP tier support** through consumer groups
4. **Lower latency** (no app-level checks)
5. **Better observability** via Prometheus
