# Production Setup Guide

## Architecture Overview

The production environment uses Kong API Gateway in DB-less mode as the only exposed service to the internet. All backend services run on internal ports and are accessible only through Kong.

### Port Configuration

| Service | Internal Port | Public Access | Purpose |
|---------|---------------|---------------|---------|
| Kong | 8000 → 80 | ✅ `api.dotmx.xyz` | API Gateway (Only exposed service) |
| Kong HTTPS | 8443 → 443 | ✅ `api.dotmx.xyz` | API Gateway (HTTPS) |
| Engine | 3001 | ❌ Internal only | Matching Engine (Not exposed) |
| MarketData | 3002 | ✅ via `/market` | Market data & WebSocket |
| API | 3003 | ✅ via `/api` | Main API endpoints |
| Management | 3004 | ✅ via `/api/management` | Admin panel (IP restricted) |

### Routing

All external traffic goes through Kong:

```
Internet → Kong (Port 80/443)
           ├─ /api → api:3003
           ├─ /market → marketdata:3002
           └─ /api/management → management:3004

Internal only:
  - engine:3001 (not exposed)
  - engine:9090 (metrics, internal only)
```

## Quick Start

### 1. Start All Services

```bash
docker compose up -d
```

This will start:
- Kong API Gateway (DB-less mode)
- NATS (message broker)
- Redis (caching)
- PostgreSQL (database)
- API service
- MarketData service
- Management service
- Engine service (Rust)

### 2. Verify Services

```bash
# Check all services are running
docker compose ps

# Check Kong health
curl http://localhost/health

# Check API health
curl http://localhost/api/health

# Check Market Data
curl http://localhost/market/health
```

### 3. Access Services

All services are accessible through Kong:

```bash
# API endpoints
curl http://localhost/api/v1/...

# Market data endpoints
curl http://localhost/market/ticker/BTC-USDT

# WebSocket (market data streaming)
wscat -c ws://localhost/market/ws

# Management API (requires admin key)
curl -H "X-Admin-Key: admin-key-change-this-in-production" \
     http://localhost/api/management/...
```

## Configuration

### Kong Configuration

Kong runs in **DB-less mode** using declarative configuration from [docker/kong.yml](docker/kong.yml).

Key features:
- No database required
- Configuration as code
- Easy to version control
- Fast startup time

To modify Kong configuration:
1. Edit [docker/kong.yml](docker/kong.yml)
2. Restart Kong: `docker compose restart kong`

### Environment Variables

Edit the service environment variables in [docker-compose.yml](docker-compose.yml):

```yaml
environment:
  NODE_ENV: production
  PORT: 3003
  NATS_URL: nats://nats:4222
  REDIS_URL: redis://redis:6379
  DATABASE_URL: postgresql://dotmx:dotmx_dev@postgres:5432/dotmx
  TRUST_PROXY: "true"
```

### Security

#### API Key Authentication

Management endpoints require API key authentication:

```bash
# Update the admin key in docker/kong.yml
consumers:
  - username: admin
    keyauth_credentials:
      - key: YOUR-SECURE-KEY-HERE
```

#### IP Restrictions

Management API is restricted to internal networks by default. Update allowed IPs in [docker/kong.yml](docker/kong.yml):

```yaml
- name: ip-restriction
  config:
    allow:
      - 10.0.0.0/8
      - 172.16.0.0/12
      - 192.168.0.0/16
      - YOUR-OFFICE-IP/32
```

## Deployment on Production Server

### Prerequisites

- Docker & Docker Compose installed
- Domain pointing to server (api.dotmx.xyz)
- SSL certificates (or use Let's Encrypt)

### Steps

1. **Clone repository on server**
   ```bash
   git clone <repo-url>
   cd dotmx-backend
   ```

2. **Update production secrets**
   - Change database passwords in docker-compose.yml
   - Update Kong admin API key in docker/kong.yml
   - Configure allowed IPs for management API

3. **Set up SSL (Optional but recommended)**
   
   Add SSL certificate volume mount to Kong service:
   ```yaml
   kong:
     volumes:
       - ./docker/kong.yml:/etc/kong/kong.yml:ro
       - /etc/letsencrypt:/etc/letsencrypt:ro
   ```

4. **Start services**
   ```bash
   docker compose up -d
   ```

5. **Set up reverse proxy (if needed)**
   
   If using nginx/caddy in front of Kong:
   ```nginx
   server {
       listen 80;
       server_name api.dotmx.xyz;
       
       location / {
           proxy_pass http://localhost:80;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

## Monitoring

### Service Health Checks

All services have health check endpoints:

```bash
# Kong
curl http://localhost/health

# API
curl http://localhost/api/health

# Market Data
curl http://localhost/market/health

# Management
curl http://localhost/api/management/health
```

### Logs

View logs for any service:

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f kong
docker compose logs -f api
docker compose logs -f marketdata
docker compose logs -f management
docker compose logs -f engine
```

### Metrics

Engine metrics are available internally:

```bash
# From within the Docker network
curl http://engine:9090/metrics

# Or access via docker exec
docker exec -it dotmx-kong wget -qO- http://engine:9090/metrics
```

## Maintenance

### Update Services

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose up -d --build
```

### Backup Database

```bash
docker exec dotmx-postgres pg_dump -U dotmx dotmx > backup.sql
```

### Restore Database

```bash
docker exec -i dotmx-postgres psql -U dotmx dotmx < backup.sql
```

### Clean Up

```bash
# Stop all services
docker compose down

# Remove volumes (WARNING: deletes data)
docker compose down -v

# Remove images
docker compose down --rmi all
```

## Troubleshooting

### Kong not starting

Check Kong configuration syntax:
```bash
docker run --rm -v $(pwd)/docker/kong.yml:/etc/kong/kong.yml kong:3.5-alpine kong config parse /etc/kong/kong.yml
```

### Service can't connect to NATS/Redis

Check network connectivity:
```bash
docker exec dotmx-api ping nats
docker exec dotmx-api ping redis
```

### 502 Bad Gateway from Kong

Check if backend service is healthy:
```bash
docker compose ps
docker compose logs api
docker compose logs marketdata
docker compose logs management
```

### Port already in use

If port 80 is already in use, you can change the external port:
```yaml
kong:
  ports:
    - "8080:8000"  # Access via port 8080 instead
```

## Development vs Production

For local development, use [docker-compose.dev.yml](docker-compose.dev.yml):

```bash
docker compose -f docker-compose.dev.yml up
```

Key differences:
- Dev exposes all service ports directly
- No authentication required
- Higher rate limits
- Uses host.docker.internal for easier debugging

## Support

For issues or questions:
1. Check logs: `docker compose logs -f [service]`
2. Verify health: `curl http://localhost/health`
3. Check Kong config: `docker exec dotmx-kong kong config -c /etc/kong/kong.yml`
