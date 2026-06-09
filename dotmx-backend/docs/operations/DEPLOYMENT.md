# Deployment Guide

## Prerequisites

- Docker & Docker Compose
- Bun (for local development)
- pnpm (for package management)

## Development

### Start Infrastructure Only

```bash
# Start NATS, Redis, Postgres
docker compose -f docker-compose.dev.yml up -d

# Run services locally with hot reload
pnpm dev
```

### Full Local Stack

```bash
docker compose up -d
```

## Production Deployment

### Build Images

```bash
# Build all images
docker compose build

# Build specific service
docker compose build api
docker compose build engine
docker compose build marketdata
```

### Deploy

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Scale engine shards (example)
docker compose up -d --scale engine=3
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| API | 3001 | REST/WebSocket endpoints |
| Engine | - | Matching engine (internal) |
| Market Data | - | L2/Trade fanout (internal) |
| NATS | 4222, 8222 | Message bus |
| Redis | 6379 | Cache, pub-sub |
| Postgres | 5432 | Read model DB |

## Environment Variables

### API Service
- `PORT` - HTTP port (default: 3001)
- `NATS_URL` - NATS connection URL
- `REDIS_URL` - Redis connection URL
- `DATABASE_URL` - PostgreSQL connection URL

### Engine Service
- `NATS_URL` - NATS connection URL
- `REDIS_URL` - Redis connection URL
- `JOURNAL_PATH` - Path for event journal
- `SNAPSHOT_PATH` - Path for snapshots

### Market Data Service
- `NATS_URL` - NATS connection URL
- `REDIS_URL` - Redis connection URL
- `THROTTLE_MS` - Diff throttle interval

## Monitoring

### NATS Monitoring

```bash
# Check NATS health
curl http://localhost:8222/healthz

# View connections
curl http://localhost:8222/connz

# View JetStream info
curl http://localhost:8222/jsz
```

### Health Checks

```bash
# API health
curl http://localhost:8080/health
```

## Scaling

### Horizontal Scaling (Sharding)

Each symbol is handled by one shard. To scale:

1. Deploy multiple engine instances
2. Configure shard assignment in gateway
3. Route commands to correct shard via NATS subjects

```yaml
# docker-compose.override.yml
services:
  engine-btc:
    extends: engine
    environment:
      SYMBOLS: BTCUSDT
      
  engine-eth:
    extends: engine
    environment:
      SYMBOLS: ETHUSDT,SOLUSDT
```

### Hot Symbol Isolation

For high-volume symbols like BTCUSDT:

1. Dedicate a node/container
2. Increase journal sync frequency
3. Separate market data fanout

## Backup & Recovery

### Journal Backup

```bash
# Backup journal data
docker cp dotmx-engine:/data/journal ./backup/

# Restore
docker cp ./backup/journal dotmx-engine:/data/
```

### Database Backup

```bash
# Backup
docker exec dotmx-postgres pg_dump -U dotmx dotmx > backup.sql

# Restore
docker exec -i dotmx-postgres psql -U dotmx dotmx < backup.sql
```

## Troubleshooting

### Check Service Logs

```bash
docker compose logs api
docker compose logs engine
docker compose logs nats
```

### Restart Services

```bash
docker compose restart api
docker compose restart engine
```

### Reset Data

```bash
docker compose down -v  # Remove volumes
docker compose up -d
```
