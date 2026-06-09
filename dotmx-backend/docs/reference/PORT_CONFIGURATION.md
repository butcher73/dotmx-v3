# Port Configuration Summary

## External Access (Internet-facing)

```
┌─────────────────────────────────────────────┐
│         Internet / api.dotmx.xyz            │
└────────────────┬────────────────────────────┘
                 │
         ┌───────▼────────┐
         │ Port 80 (HTTP) │
         │ Port 443(HTTPS)│
         └───────┬────────┘
                 │
         ┌───────▼────────┐
         │ Kong Gateway   │ ◄── Only service exposed to internet
         │   (DB-less)    │
         └───────┬────────┘
                 │
     ┌───────────┼────────────┐
     │           │            │
```

## Internal Routing (Kong → Backend Services)

### Route Mappings

| Public URL | Kong Route | Backend Service | Internal Port |
|------------|-----------|-----------------|---------------|
| `api.dotmx.xyz/api` | `/api` | api | 3003 |
| `api.dotmx.xyz/market` | `/market` | marketdata | 3002 |
| `api.dotmx.xyz/api/management` | `/api/management` | management | 3004 |
| Not exposed | N/A | engine | 3001 |

### Detailed Port Configuration

```
┌─────────────────────────────────────────────────────────────┐
│  Service: Kong API Gateway                                  │
│  Container: dotmx-kong                                      │
│  Exposed: 80:8000, 443:8443                                │
│  Purpose: Single entry point for all traffic               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Service: API                                               │
│  Container: dotmx-api                                       │
│  Internal Port: 3003                                        │
│  Access: http://api:3003 (internal only)                   │
│  Public Route: api.dotmx.xyz/api                           │
│  Purpose: Main REST API endpoints                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Service: Market Data                                       │
│  Container: dotmx-marketdata                                │
│  Internal Port: 3002                                        │
│  Access: http://marketdata:3002 (internal only)            │
│  Public Route: api.dotmx.xyz/market                        │
│  Purpose: Market data & WebSocket streaming                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Service: Management                                        │
│  Container: dotmx-management                                │
│  Internal Port: 3004                                        │
│  Access: http://management:3004 (internal only)            │
│  Public Route: api.dotmx.xyz/api/management                │
│  Purpose: Admin panel & management endpoints               │
│  Security: IP restricted + API key required                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Service: Engine (Rust)                                     │
│  Container: dotmx-engine                                    │
│  Internal Port: 3001                                        │
│  Access: http://engine:3001 (internal only)                │
│  Public Route: NOT EXPOSED                                 │
│  Purpose: Matching engine (internal communication only)    │
│  Metrics: http://engine:9090/metrics (internal)           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Service: NATS                                              │
│  Container: dotmx-nats                                      │
│  Internal Port: 4222 (client), 8222 (monitoring)           │
│  Access: nats://nats:4222 (internal only)                  │
│  Purpose: Message broker                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Service: Redis                                             │
│  Container: dotmx-redis                                     │
│  Internal Port: 6379                                        │
│  Access: redis://redis:6379 (internal only)                │
│  Purpose: Cache & rate limiting                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Service: PostgreSQL                                        │
│  Container: dotmx-postgres                                  │
│  Internal Port: 5432                                        │
│  Access: postgres:5432 (internal only)                     │
│  Purpose: Primary database                                 │
└─────────────────────────────────────────────────────────────┘
```

## Request Flow Examples

### 1. API Request
```
User → api.dotmx.xyz/api/v1/orders
     → Kong (Port 80)
     → Route: /api
     → api:3003/v1/orders
     ← Response
```

### 2. Market Data Request
```
User → api.dotmx.xyz/market/ticker/BTC-USDT
     → Kong (Port 80)
     → Route: /market
     → marketdata:3002/ticker/BTC-USDT
     ← Response
```

### 3. Management Request
```
Admin → api.dotmx.xyz/api/management/users
      → Kong (Port 80)
      → IP Check ✓
      → API Key Check ✓
      → Route: /api/management
      → management:3004/users
      ← Response
```

### 4. WebSocket Connection
```
User → ws://api.dotmx.xyz/market/ws
     → Kong (Port 80)
     → Route: /market/ws
     → marketdata:3002/ws
     ← WebSocket Stream
```

## Security Layers

```
Internet
    │
    ▼
┌────────────────────┐
│ Firewall           │ Layer 1: Network firewall
│ (Port 80, 443)     │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Kong Gateway       │ Layer 2: API Gateway
│ - Rate Limiting    │   - CORS
│ - IP Restriction   │   - Auth
│ - API Key Auth     │   - Validation
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Backend Services   │ Layer 3: Application
│ - Internal Network │   - Business Logic
│ - No Direct Access │   - Data Validation
└────────────────────┘
```

## Port Summary Table

| Service | Internal | External | Exposed | Protocol |
|---------|----------|----------|---------|----------|
| Kong | 8000 | 80 | ✅ | HTTP |
| Kong | 8443 | 443 | ✅ | HTTPS |
| API | 3003 | - | ❌ | HTTP |
| MarketData | 3002 | - | ❌ | HTTP/WS |
| Management | 3004 | - | ❌ | HTTP |
| Engine | 3001 | - | ❌ | Internal |
| Engine Metrics | 9090 | - | ❌ | HTTP |
| NATS | 4222 | - | ❌ | NATS |
| NATS Monitor | 8222 | - | ❌ | HTTP |
| Redis | 6379 | - | ❌ | Redis |
| PostgreSQL | 5432 | - | ❌ | PostgreSQL |

**Legend:**
- ✅ Exposed: Accessible from internet
- ❌ Not Exposed: Internal only

## Quick Reference

### Access Services from Internet
```bash
# API
curl http://api.dotmx.xyz/api/health

# Market Data
curl http://api.dotmx.xyz/market/ticker/BTC-USDT

# Management (requires auth)
curl -H "X-Admin-Key: YOUR_KEY" http://api.dotmx.xyz/api/management/users
```

### Access Services Internally (from within Docker network)
```bash
# From another container
curl http://api:3003/health
curl http://marketdata:3002/health
curl http://management:3004/health
curl http://engine:9090/metrics

# Via docker exec
docker exec dotmx-kong wget -qO- http://api:3003/health
```

## Configuration Files

- Port mapping: `docker-compose.yml`
- Route configuration: `docker/kong.yml`
- Service ports: Environment variables in each service

## Notes

1. **Only Kong is exposed** - All other services are internal only
2. **Engine port 3001** - NOT accessible from internet
3. **Management API** - Protected by IP restriction + API key
4. **All inter-service communication** - Uses internal Docker network
5. **No database exposed** - PostgreSQL only accessible within Docker network
