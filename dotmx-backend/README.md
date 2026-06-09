# DotMX Backend — Monorepo

High-performance, deterministic matching engine for DotMX perpetual futures exchange.

## 🚀 Quick Links

### **New to DotMX?**
- [QUICKSTART.md](./QUICKSTART.md) - Get up and running in 15 minutes
- [docs/DOCUMENTATION_MAP.md](./docs/DOCUMENTATION_MAP.md) - Find what you need by role or goal
- [docs/INDEX.md](./docs/INDEX.md) - Complete documentation index

### **Want to Deploy?**
- **[PRODUCTION_CONFIG.md](./PRODUCTION_CONFIG.md)** - 🔥 **Production setup with Kong (NEW!)**
- **[PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)** - Complete production deployment guide
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Commands cheat sheet (2 min)
- [docs/operations/DEPLOYMENT_CHECKLIST.md](./docs/operations/DEPLOYMENT_CHECKLIST.md) - Full activation guide (5 min)
- [docs/operations/AUTOMATED_DEPLOYMENT_READY.md](./docs/operations/AUTOMATED_DEPLOYMENT_READY.md) - What's ready (10 min)

### **Production Deployment**
```bash
# One command to start everything with Kong
./deploy-production.sh

# Or manually
docker compose up -d
```

**Features:**
- ✅ Kong API Gateway (DB-less mode) as single entry point
- ✅ All services internal - only Kong exposed on port 80/443
- ✅ Rate limiting, CORS, security headers
- ✅ IP restrictions for management endpoints
- ✅ Health checks and auto-restart

### **Looking for Specific Docs?**
- **Architecture** → [docs/architecture/](./docs/architecture/)
- **API Reference** → [docs/api/](./docs/api/)
- **Security** → [docs/security/](./docs/security/)
- **Operations** → [docs/operations/](./docs/operations/)
- **Testing** → [docs/testing/](./docs/testing/)

## Architecture Overview

The backend consists of two main components:

1. **Rust Matching Engine** (`rust-engine/`) - High-performance order matching
2. **TypeScript Services** (`packages/`) - API, gateway, market data, persistence

```
                    ┌─────────────────────────────────────────────────────┐
                    │                    NATS JetStream                    │
                    └─────────────────────────────────────────────────────┘
                         ▲                    ▲                    ▲
                         │                    │                    │
┌────────────┐    ┌──────┴──────┐    ┌───────┴───────┐    ┌───────┴───────┐
│   Clients  │───▶│    Kong     │    │     Rust      │    │  TypeScript   │
│  (HTTP)    │    │  Gateway    │───▶│   Engine      │───▶│  Market Data  │
└────────────┘    │  (Auth/RL)  │    │  (Matching)   │    │   (Redis)     │
                  └─────┬───────┘    └───────────────┘    └───────────────┘
                        │                                          │
                  ┌─────┴───────┐                          ┌───────┴───────┐
                  │ TypeScript  │                          │  Persistence  │
                  │    API      │                          │  (Postgres)   │
                  │  (Elysia)   │                          │               │
                  └─────────────┘                          └───────────────┘
```

## Monorepo Structure

```
dotmx-backend/
├── rust-engine/           # 🦀 Rust matching engine
│   └── crates/
│       ├── dotmx-core/    # Types, orderbook, matching
│       ├── dotmx-risk/    # Pre-trade risk checks
│       ├── dotmx-transport/ # NATS communication
│       └── dotmx-engine/  # Main binary
├── packages/              # 📦 TypeScript packages
│   ├── shared/            # Types, utils, constants
│   ├── engine/            # Legacy TS engine (deprecated)
│   ├── api/               # ElysiaJS REST/WebSocket
│   ├── gateway/           # Routing, command bus
│   ├── persistence/       # Journal, snapshots, replay
│   ├── marketdata/        # L2 depth, trades, fanout
│   ├── ledger/            # Balances, positions
│   ├── zk/                # Zero-knowledge proofs
│   └── tools/             # Testing, benchmarks, CLI
├── docker/                # Dockerfiles
├── docs/                  # Architecture documentation
└── tests/                 # Integration tests
```

## Package Dependency Graph

```
@dotmx/shared (no deps)
    ↓
@dotmx/engine ← @dotmx/shared
    ↓
@dotmx/api ← @dotmx/engine, @dotmx/shared
@dotmx/gateway ← @dotmx/engine, @dotmx/shared
@dotmx/persistence ← @dotmx/shared
@dotmx/marketdata ← @dotmx/shared
@dotmx/ledger ← @dotmx/shared
@dotmx/zk ← @dotmx/shared
@dotmx/tools ← @dotmx/engine, @dotmx/shared
```

## Module → Package Mapping

| Doc Module | Package |
|------------|---------|
| 01 API | `@dotmx/api` |
| 02 Engine Architecture | `@dotmx/engine`, `@dotmx/gateway` |
| 03 Orderbook | `@dotmx/engine` |
| 04 Matching | `@dotmx/engine` |
| 05 Risk | `@dotmx/engine` |
| 06 Events | `@dotmx/engine` |
| 07 Persistence | `@dotmx/persistence` |
| 08 Sharding | `@dotmx/gateway` |
| 09 Market Data | `@dotmx/marketdata` |
| 10 Testing | `@dotmx/tools` |

## Getting Started

### Prerequisites

- **Rust** 1.75+ (for matching engine)
- **Bun** 1.0+ (for TypeScript services)
- **PostgreSQL** 14+ (for databases)
- **Docker** (optional, for infrastructure services)

### Quick Start

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd dotmx-backend
bun install

# 2. Set up environment
cp .env.production.example .env
# Edit .env with your database credentials

# 3. Deploy databases with seed data
npm run deploy:db:dev

# 4. Start services
npm run dev:all

# Or start full stack with Kong API Gateway
docker compose up -d
```

### Database Deployment

Deploy all databases with production-ready seed data:

```bash
# Development
npm run deploy:db:dev

# Staging
npm run deploy:db:staging

# Production (requires confirmation)
npm run deploy:db
```

This deploys:
- **User database** (dotmx_users) - Authentication, VIP tiers, loyalty, referrals
- **Exchange database** (dotmx) - Orders, trades, balances, positions
- **10-tier VIP system** - Bronze to Legendary with fee discounts
- **Perpetual fee config** - Maker rebates, taker fees, funding rates
- **All seed data** - Production-ready configurations

See [Database Deployment Guide](docs/operations/DATABASE_DEPLOYMENT.md) for details.

# 2. Wait for services to be healthy
docker compose ps

# 3. Test API through Kong (port 8000)
curl http://localhost:8000/api/health

# 4. Test authenticated endpoint (requires API key)
curl -H "apikey: demo-api-key-12345" \
  http://localhost:8000/api/v1/markets

# 5. View Kong Admin API
curl http://localhost:8001/
```

### Development Mode

```bash
# 1. Start infrastructure (NATS, Redis, PostgreSQL, Kong)
docker compose -f docker-compose.dev.yml up -d

# 2. Install TypeScript dependencies
pnpm install

# 3. Build TypeScript packages
pnpm build

# 4. Build Rust engine
cd rust-engine && cargo build --release

# 5. Start the Rust matching engine
./target/release/dotmx-engine &

# 6. Start the TypeScript API server
pnpm dev

# 7. Run tests
pnpm test
cd rust-engine && cargo test
```

### Docker Compose (Full Stack)

```bash
# Start everything with Docker (Kong + API + Engine + Infrastructure)
docker compose up -d

# Check Kong Gateway status
docker compose ps kong
docker compose logs kong

# API is accessible through Kong at port 8000
curl http://localhost:8000/api/health

# Kong Admin API at port 8001
curl http://localhost:8001/services

# View logs
docker compose logs -f engine

# Stop all services
docker compose down
```

### API Access

**All API requests go through Kong Gateway at port 8000:**

```bash
# Public endpoints (no auth)
curl http://localhost:8000/api/health

# Authenticated endpoints (require API key)
curl -H "apikey: demo-api-key-12345" \
  http://localhost:8000/api/v1/markets

# Place order with authentication
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
```

**Kong provides:**
- ✅ API Key Authentication
- ✅ Rate Limiting (100 req/min per user)
- ✅ CORS handling
- ✅ Request/Response transformation
- ✅ Prometheus metrics
- ✅ Request correlation IDs

See [docs/KONG_SETUP.md](docs/KONG_SETUP.md) for detailed Kong configuration.

## ✨ Advanced Order Types

✅ **PostOnly Orders** - Place maker-only orders; rejected if they would immediately cross the spread
✅ **Stop Orders** - StopLimit (trigger at price, place limit) and StopMarket (trigger at price, place market)
✅ **IOC / FOK** - Immediate-or-cancel and fill-or-kill orders
✅ **Batch Orders** - Submit up to 20 orders in one request
✅ **Order Modification** - Atomic cancel-replace for price/quantity updates

## Perpetual Futures Features

✅ **Leverage Trading** - 1×–50× configurable per symbol
✅ **Funding Rates** - Auto-settlement every 8 hours (GTC BTC-USDT)
✅ **Liquidation** - Automatic position checking and force-close on margin breach
✅ **ADL** - Auto-deleveraging when insurance fund is depleted
✅ **Mark Price** - Multiple pricing strategies (index+premium, last trade, custom)

## Rust Engine Performance

| Operation | P50 | P99 |
|-----------|-----|-----|
| Order Add | 1μs | 5μs |
| Order Match | 2μs | 8μs |
| L2 Snapshot | 3μs | 10μs |

Throughput: **10.6M orders/second** (single-threaded @ 10.6ns/op)
Tests: **119/119 passing** ✅

## Design Principles

- **Monorepo**: Separate packages for independent development and deployment
- **Deterministic**: Same input → same output, always
- **Low latency**: Microseconds to single-digit milliseconds
- **High throughput**: Scale horizontally by sharding on symbol
- **Crash safe**: Event-sourced, fully replayable
- **Binance-like**: Price-time priority, per-market single writer

## Package Dependency Graph

```
@dotmx/shared (no deps)
    ↓
@dotmx/engine ← @dotmx/shared (legacy TS engine)
    ↓
@dotmx/api ← @dotmx/shared
@dotmx/gateway ← @dotmx/shared ──► Rust Engine (via NATS)
@dotmx/persistence ← @dotmx/shared
@dotmx/marketdata ← @dotmx/shared
@dotmx/ledger ← @dotmx/shared
@dotmx/zk ← @dotmx/shared
@dotmx/tools ← @dotmx/shared
```

## NATS Message Flow

```
Clients                Kong Gateway           API Server              NATS                Rust Engine
   │                       │                      │                    │                       │
   ├─── POST /orders ─────►│                      │                    │                       │
   │                       ├─ auth check         │                    │                       │
   │                       ├─ rate limit         │                    │                       │
   │                       └─────────────────────►│                    │                       │
   │                                              ├─── PlaceOrder ────►│                       │
   │                                              │                    ├── engine.{sym}.place ►│
   │                                              │                    │                       ├─ Match
   │                                              │                    │◄── events.{sym}.trade ┤
   │                                              │◄── TradeExecuted ──┤                       │
   │◄──────────── 200 OK ────────────────────────┤                    │                       │
   │                                              │                    │                       │
```

## Documentation

See [docs/](docs/) for detailed architecture documentation:

- [00 Overview](docs/00_OVERVIEW.md)
- [01 API](docs/01_API_ELYSIA.md)
- [02 Engine Architecture](docs/02_ENGINE_ARCHITECTURE.md)
- [03 Orderbook](docs/03_ORDERBOOK_DATA_STRUCTURES.md)
- [04 Matching Algorithm](docs/04_MATCHING_ALGORITHM.md)
- [05 Risk](docs/05_RISK_FAST_PATH.md)
- [06 Events](docs/06_EVENT_MODEL_SEQUENCING.md)
- [07 Persistence](docs/07_PERSISTENCE_REPLAY.md)
- [08 Sharding](docs/08_SHARDING_SCALING_DEPLOYMENT.md)
- [09 Market Data](docs/09_MARKET_DATA_PIPELINE.md)
- [10 Testing](docs/10_TESTING_PERF.md)
- **[Kong API Gateway Setup](docs/KONG_SETUP.md)** ← API Gateway configuration

## License

MIT
