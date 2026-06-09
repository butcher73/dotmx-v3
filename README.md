# DotMX v3 — Cryptocurrency Exchange Platform

**Status:** Feature-complete. See [docs/README.md](docs/README.md) for full documentation.

## Monorepo Structure

```
dotmx-v3/
├── dotmx-backend/     # Core trading engine (Bun/Elysia + Rust)
│   ├── apps/          # Server entry points (6 servers)
│   ├── packages/      # 10 packages (api, engine, gateway, ledger,
│   │                  #   management, marketdata, persistence, shared, tools, zk)
│   ├── rust-engine/   # High-performance matching engine (4 crates)
│   ├── scripts/       # DB migrations, deployment scripts
│   ├── docker/        # Dockerfiles, Kong config
│   └── docs/          # Architecture, API, operations docs
├── dotmx-frontend/     # User trading platform (Next.js 15, React 19)
├── dotmx-alfred/      # Admin management dashboard (Next.js 16, React 19)
├── dotmx-mm-bot/      # Market maker bot (Bun/TypeScript, 10 bots)
└── docs/              # Central documentation hub
```

## Quick Start

```bash
# Backend
cd dotmx-backend
pnpm dev:api          # API server on :3003
pnpm dev:management   # Management API on :3004
pnpm dev:marketdata   # Market data on :3002
pnpm dev:engine       # Engine server on :3001

# Frontend
cd dotmx-frontend && npm run dev     # Trading platform :3000
cd dotmx-alfred && npm run dev       # Admin dashboard :3310

# Database
cd dotmx-backend
bash scripts/db/reset.sh             # Reset and seed

# Tests
cd dotmx-backend && bun test packages/   # All TypeScript tests
cd dotmx-backend/rust-engine && cargo test  # Rust engine (119 tests)
```

## Architecture

```
                              ┌─────────────────┐
Internet → Nginx (:8080) ────→│ API Server      │ :3003 /api
                              │ Market Data     │ :3002 /marketdata
                              │ Management      │ :3004 /admin
                              │ Engine (internal)│ :3001 NATS only
                              └─────────────────┘

Frontend (Next.js :3000)  ────→ Nginx (:8080) ────→ Backend
Alfred (Next.js :3310)    ────→ Nginx (:8080) ────→ Backend
MM Bot (10 accounts)      ────→ Nginx (:8080) ────→ Backend
```

## Key Technologies

| Layer | Stack |
|---|---|
| Backend runtime | Bun + Elysia.js + TypeScript |
| Matching engine | Rust (dotmx-core, dotmx-engine, dotmx-risk, dotmx-transport) |
| Frontend | Next.js 15/16, React 19, Tailwind CSS 4 |
| Charts | TradingView charting_library, Recharts, Chart.js |
| Database | PostgreSQL (dual DB: dotmx_users + dotmx) |
| Messaging | NATS JetStream (engine ↔ services) |
| Gateway | Nginx (dev) / Kong (production) |
| Infrastructure | Docker Compose |

## Documentation

All docs are in [`docs/`](docs/README.md):
- [Project Roadmap](docs/project/ROADMAP.md)
- [Module Status](docs/backend/MODULE_STATUS.md)
- [Endpoint Reference](docs/backend/ENDPOINT_REFERENCE.md)
- [Audit Reports](docs/audits/)
- [Backend Architecture](dotmx-backend/docs/INDEX.md)
